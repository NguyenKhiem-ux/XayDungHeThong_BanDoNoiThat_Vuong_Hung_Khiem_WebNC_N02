import { ConflictException, HttpException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { ChatbotKnowledge, KnowledgeStatus } from '../database/entities/chatbot-knowledge.entity';
import { ChatProductsService } from './chat-products.service';
import { normalizeText, questionKey, questionWords, similarity } from './chat-matching';
import { CreateKnowledgeDto, ListKnowledgeDto, UpdateKnowledgeDto } from './dto/knowledge.dto';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @InjectRepository(ChatbotKnowledge) private readonly knowledge: Repository<ChatbotKnowledge>,
    private readonly products: ChatProductsService,
  ) {}

  async candidates(question: string) {
    return this.database(async () => {
      const exact = await this.knowledge.find({
        where: { questionKey: questionKey(question), status: KnowledgeStatus.APPROVED },
        order: { id: 'DESC' }, take: 10,
      });
      if (exact.length) return exact;
      const words = questionWords(question).slice(0, 12);
      if (!words.length) return [];
      const qb = this.knowledge.createQueryBuilder('k')
        .where('k.status = :status', { status: KnowledgeStatus.APPROVED })
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

  async use(row: ChatbotKnowledge) {
    return this.database(async () => {
      const result = await this.knowledge.increment({
        id: row.id, status: KnowledgeStatus.APPROVED, questionKey: row.questionKey, answer: row.answer, contextHash: row.contextHash,
      }, 'usageCount', 1);
      return !!result.affected;
    });
  }

  async savePending(question: string, answer: string, contextHash: string) {
    try {
      await this.knowledge.insert({
        question, answer, questionKey: questionKey(question), contextHash,
        keywords: questionWords(question).join(' ').slice(0, 1000),
        status: KnowledgeStatus.PENDING, usageCount: 0,
      });
    } catch (error) {
      // Repeated questions never overwrite an administrator's edits or moderation decision.
      if ((error as { code?: string })?.code !== 'ER_DUP_ENTRY') {
        this.logger.warn('CHAT pending_save_failed');
        return false;
      }
    }
    return true;
  }

  list(query: ListKnowledgeDto) {
    return this.database(async () => {
      const [items, total] = await this.knowledge.findAndCount({
        where: query.status === KnowledgeStatus.PENDING
          ? { status: In([KnowledgeStatus.PENDING, KnowledgeStatus.LEGACY_PENDING_REVIEW]) }
          : query.status ? { status: query.status } : {},
        order: { createdAt: 'DESC', id: 'DESC' },
        skip: (query.page - 1) * query.limit, take: query.limit,
      });
      return {
        items: items.map((item) => item.status === KnowledgeStatus.LEGACY_PENDING_REVIEW
          ? { ...item, status: KnowledgeStatus.PENDING }
          : item),
        total, page: query.page, limit: query.limit,
      };
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
    return this.database(async () => this.knowledge.save(this.knowledge.create({
      ...dto, questionKey: questionKey(dto.question),
      keywords: this.keywords(dto.question, dto.keywords),
      contextHash: (await this.products.context(dto.question))?.hash ?? '',
      status: KnowledgeStatus.PENDING, usageCount: 0,
    })));
  }

  update(id: number, dto: UpdateKnowledgeDto) {
    return this.database(async () => {
      const row = await this.detail(id);
      const question = dto.question ?? row.question;
      const result = await this.knowledge.update({ id, question: row.question, answer: row.answer, contextHash: row.contextHash }, {
        ...dto,
        questionKey: questionKey(question), keywords: this.keywords(question, dto.keywords ?? row.keywords),
        contextHash: (await this.products.context(question))?.hash ?? '', status: KnowledgeStatus.PENDING,
      });
      if (!result.affected) throw new ConflictException('Nội dung vừa thay đổi. Vui lòng tải lại.');
      return this.detail(id);
    });
  }

  moderate(id: number, status: KnowledgeStatus.APPROVED | KnowledgeStatus.REJECTED) {
    return this.database(async () => {
      const row = await this.detail(id);
      if (status === KnowledgeStatus.APPROVED) {
        const currentHash = (await this.products.context(row.question))?.hash ?? '';
        if (currentHash !== row.contextHash) {
          throw new ConflictException('Dữ liệu sản phẩm đã thay đổi. Hãy kiểm tra, sửa và lưu câu trả lời trước khi duyệt.');
        }
      }
      // A concurrent edit must not be silently approved using a stale admin read.
      const result = await this.knowledge.update({ id, question: row.question, answer: row.answer, contextHash: row.contextHash }, { status });
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
