import { BadRequestException, ConflictException, HttpException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { ChatbotKnowledge, KnowledgeStatus } from '../database/entities/chatbot-knowledge.entity';
import { ChatProductsService } from './chat-products.service';
import { normalizeQuestion, normalizeText, questionKey, questionWords, similarity } from './chat-matching';
import { CreateKnowledgeDto, ListKnowledgeDto, UpdateKnowledgeDto } from './dto/knowledge.dto';
import { IntentService } from './intent.service';
import { ChatIntent, GeminiDraft, RagContext, RiskLevel } from './chat.types';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @InjectRepository(ChatbotKnowledge) private readonly knowledge: Repository<ChatbotKnowledge>,
    private readonly products: ChatProductsService,
    private readonly intents: IntentService,
  ) {}

  async candidates(question: string) {
    return this.database(async () => {
      const exact = await this.knowledge.find({
        where: { questionKey: questionKey(question), status: KnowledgeStatus.APPROVED, shouldStore: true },
        order: { id: 'DESC' }, take: 10,
      });
      if (exact.length) return exact;
      const words = questionWords(question).slice(0, 12);
      if (!words.length) return [];
      const qb = this.knowledge.createQueryBuilder('k')
        .where('k.status = :status', { status: KnowledgeStatus.APPROVED })
        .andWhere('k.shouldStore = :shouldStore', { shouldStore: true })
        .andWhere("k.contextHash = ''")
        .andWhere(new Brackets(sub => {
          words.forEach((word, index) => sub.orWhere(`CONCAT(' ', k.keywords, ' ') LIKE :word${index}`, { [`word${index}`]: `% ${word} %` }));
        }));
      // ponytail: bounded lexical shortlist; add FULLTEXT/embeddings if a large KB needs higher recall.
      const rows = await qb.orderBy('k.usageCount', 'DESC').addOrderBy('k.id', 'DESC').take(100).getMany();
      const matches = rows.map(row => ({ row, score: similarity(question, row.question) }))
        .filter(match => match.score >= 0.9).sort((a, b) => b.score - a.score);
      if (!matches.length || (matches[1] && matches[0].score - matches[1].score < 0.08)) return [];
      return [matches[0].row];
    });
  }

  async retrieveContext(question: string, intent?: ChatIntent, limit = 3): Promise<RagContext[]> {
    return this.database(async () => {
      const words = questionWords(question).slice(0, 12);
      if (!words.length) return [];
      const qb = this.knowledge.createQueryBuilder('k')
        .where('k.status = :status', { status: KnowledgeStatus.APPROVED })
        .andWhere('k.shouldStore = :shouldStore', { shouldStore: true })
        .andWhere("k.contextHash = ''");
      if (intent) qb.andWhere('k.intent = :ragIntent', { ragIntent: intent });
      const rows = await qb.andWhere(new Brackets(sub => {
          words.forEach((word, index) => sub.orWhere(`CONCAT(' ', k.keywords, ' ') LIKE :ragWord${index}`, { [`ragWord${index}`]: `% ${word} %` }));
        }))
        .orderBy('k.usageCount', 'DESC').addOrderBy('k.id', 'DESC').take(100).getMany();
      return rows.map(row => ({ row, score: similarity(question, row.question) }))
        .filter(match => match.score >= 0.6)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ row }) => ({ question: row.question.slice(0, 1000), answer: row.answer.slice(0, 3000), intent: row.intent }));
    });
  }

  async use(row: ChatbotKnowledge) {
    return this.database(async () => {
      const result = await this.knowledge.increment({
        id: row.id, status: KnowledgeStatus.APPROVED, shouldStore: true, questionKey: row.questionKey, answer: row.answer, contextHash: row.contextHash,
      }, 'usageCount', 1);
      return !!result.affected;
    });
  }

  async reviewedOrPending(question: string, contextHash = '') {
    return this.database(() => this.knowledge.findOneBy({ questionKey: questionKey(question), contextHash, shouldStore: true }));
  }

  async saveDraft(question: string, draft: GeminiDraft) {
    const classification = this.intents.classify(question);
    if (!classification.shouldStore) return { saved: false, autoApproved: false };
    const autoApproved = this.intents.canAutoApprove(classification, draft);
    const levels = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH];
    const riskLevel = levels[Math.max(levels.indexOf(classification.riskLevel), levels.indexOf(this.intents.effectiveRisk(classification, draft)), this.intents.safeAnswer(draft.answer) ? 0 : 2)];
    try {
      await this.knowledge.insert({
        question, answer: draft.answer, questionKey: questionKey(question), contextHash: '',
        normalizedQuestion: normalizeQuestion(question), intent: classification.intent,
        riskLevel, confidenceScore: draft.confidence_score, source: 'gemini', shouldStore: true,
        reviewedBy: null, reviewedAt: autoApproved ? new Date() : null,
        keywords: questionWords(question).join(' ').slice(0, 1000),
        status: autoApproved ? KnowledgeStatus.APPROVED : KnowledgeStatus.PENDING, usageCount: 0,
      });
    } catch (error) {
      // Repeated questions never overwrite an administrator's edits or moderation decision.
      if ((error as { code?: string })?.code === 'ER_DUP_ENTRY') return { saved: true, autoApproved: false };
      this.logger.warn('CHAT pending_save_failed');
      return { saved: false, autoApproved: false };
    }
    return { saved: true, autoApproved };
  }

  counts() {
    return this.database(async () => {
      const [pendingReview, rejected] = await Promise.all([
        this.knowledge.countBy({ status: KnowledgeStatus.PENDING, shouldStore: true }),
        this.knowledge.countBy({ status: KnowledgeStatus.REJECTED, shouldStore: true }),
      ]);
      return { pendingReview, rejected };
    });
  }

  list(query: ListKnowledgeDto) {
    return this.database(async () => {
      const [items, total] = await this.knowledge.findAndCount({
        where: { shouldStore: true, ...(query.status ? { status: query.status } : {}),
          ...(query.risk ? { riskLevel: query.risk } : {}), ...(query.intent ? { intent: query.intent } : {}) },
        order: { createdAt: 'DESC', id: 'DESC' },
        skip: (query.page - 1) * query.limit, take: query.limit,
      });
      return { items, total, page: query.page, limit: query.limit };
    });
  }

  detail(id: number) {
    return this.database(async () => {
      const row = await this.knowledge.findOneBy({ id });
      if (!row) throw new NotFoundException('Không tìm thấy kiến thức.');
      return row;
    });
  }

  create(dto: CreateKnowledgeDto) {
    return this.database(async () => {
      const classification = this.storable(dto.question);
      return this.knowledge.save(this.knowledge.create({
        ...dto, ...classification, normalizedQuestion: normalizeQuestion(dto.question), questionKey: questionKey(dto.question),
        keywords: this.keywords(dto.question, dto.keywords),
        contextHash: await this.contextHash(dto.question), source: 'admin', confidenceScore: 0,
        reviewedBy: null, reviewedAt: null, status: KnowledgeStatus.PENDING, usageCount: 0,
      }));
    });
  }

  update(id: number, dto: UpdateKnowledgeDto) {
    return this.database(async () => {
      const row = await this.detail(id);
      const question = dto.question ?? row.question;
      const classification = this.storable(question);
      const result = await this.knowledge.update({ id, question: row.question, answer: row.answer, contextHash: row.contextHash }, {
        ...dto, ...classification, normalizedQuestion: normalizeQuestion(question),
        questionKey: questionKey(question), keywords: this.keywords(question, dto.keywords ?? row.keywords),
        contextHash: await this.contextHash(question), status: KnowledgeStatus.PENDING,
        source: 'admin', confidenceScore: 0, reviewedBy: null, reviewedAt: null,
      });
      if (!result.affected) throw new ConflictException('Nội dung vừa thay đổi. Vui lòng tải lại.');
      return this.detail(id);
    });
  }

  moderate(id: number, status: KnowledgeStatus.APPROVED | KnowledgeStatus.REJECTED, reviewedBy: number) {
    return this.database(async () => {
      const row = await this.detail(id);
      if (status === KnowledgeStatus.APPROVED) {
        this.storable(row.question);
        const currentHash = await this.contextHash(row.question);
        if (currentHash !== row.contextHash) {
          throw new ConflictException('Dữ liệu sản phẩm đã thay đổi. Hãy kiểm tra, sửa và lưu câu trả lời trước khi duyệt.');
        }
      }
      // A concurrent edit must not be silently approved using a stale admin read.
      const result = await this.knowledge.update({ id, question: row.question, answer: row.answer, contextHash: row.contextHash }, { status, reviewedBy, reviewedAt: new Date() });
      if (!result.affected) throw new ConflictException('Nội dung vừa thay đổi. Vui lòng tải lại.');
      return this.detail(id);
    });
  }

  remove(id: number) {
    return this.database(async () => {
      const result = await this.knowledge.delete(id);
      if (!result.affected) throw new NotFoundException('Không tìm thấy kiến thức.');
      return { message: 'Đã xóa kiến thức.' };
    });
  }

  private keywords(question: string, extra = '') {
    return [...new Set([...questionWords(question), ...normalizeText(extra).split(' ')])].join(' ').slice(0, 1000);
  }

  private storable(question: string) {
    const classification = this.intents.classify(question);
    if (!classification.shouldStore) throw new BadRequestException('Chỉ lưu câu hỏi hữu ích về cửa hàng; không lưu xã giao, spam hoặc thông tin riêng của khách.');
    return classification;
  }

  private async contextHash(question: string) {
    return this.intents.classify(question).intent.startsWith('product_') ? (await this.products.context(question))?.hash ?? '' : '';
  }

  private async database<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); } catch (error) {
      if (error instanceof HttpException) throw error;
      if ((error as { code?: string })?.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Câu hỏi này đã tồn tại. Hãy sửa mục đã có.');
      }
      this.logger.warn('CHAT knowledge_database_unavailable');
      throw new ServiceUnavailableException('Chưa thể truy cập kho kiến thức. Vui lòng thử lại sau.');
    }
  }
}
