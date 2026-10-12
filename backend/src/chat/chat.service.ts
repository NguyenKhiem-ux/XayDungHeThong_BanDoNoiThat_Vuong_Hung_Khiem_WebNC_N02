import { HttpException, Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ChatProductsService, ProductContext, productAnswer, productQuery } from './chat-products.service';
import { KnowledgeService } from './knowledge.service';
import { IntentService } from './intent.service';
import { SmallTalkService } from './small-talk.service';
import { GeminiService } from './gemini.service';
import { ChatIntent, RiskLevel } from './chat.types';
import { normalizeText } from './chat-matching';

type ChatSession = { context: ProductContext; query: string; expiresAt: number };
const SESSION_TTL = 30 * 60 * 1000;
const MAX_SESSIONS = 1000;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  // ponytail: counters cover this process since restart; persist aggregates when multi-instance reporting is needed.
  private readonly counters = { since: new Date().toISOString(), totalQuestions: 0, knowledgeHits: 0, geminiCalls: 0,
    smallTalkHandled: 0, autoApproved: 0, productQueries: 0, errors: 0, pendingSaveFailures: 0 };
  // ponytail: bounded in-memory context; use a session store only when multiple backend instances need shared history.
  private readonly sessions = new Map<string, ChatSession>();

  constructor(private readonly knowledge: KnowledgeService, private readonly products: ChatProductsService,
    private readonly intents: IntentService, private readonly smallTalk: SmallTalkService, private readonly gemini: GeminiService) {}

  async stats() {
    const rate = (count: number) => this.counters.totalQuestions ? Math.round(count / this.counters.totalQuestions * 10000) / 100 : 0;
    return { ...this.counters, ...await this.knowledge.counts(), knowledgeHitRate: rate(this.counters.knowledgeHits), geminiUsageRate: rate(this.counters.geminiCalls) };
  }

  async send(message: string, sessionId?: string) {
    this.counters.totalQuestions++;
    message = message.trim().replace(/\s+/g, ' ');
    try {
      const classification = this.intents.classify(message);
      let { intent } = classification;
      const small = this.smallTalk.match(message);
      if (small) {
        this.counters.smallTalkHandled++;
        return { ...small, source: 'small_talk' as const, cached: false };
      }
      if (!classification.shouldStore) {
        return { message: classification.riskLevel === RiskLevel.HIGH ?
          'Mình không thể tra cứu thông tin riêng qua chatbot. Bạn vui lòng dùng mục tài khoản/đơn hàng hoặc liên hệ cửa hàng; đừng gửi mật khẩu hay mã OTP nhé.' :
          'Mình là trợ lý AI chuyên hỗ trợ tìm hiểu và mua sắm đồ gia dụng 😊 Bạn muốn tìm sản phẩm hoặc hỏi điều gì về cửa hàng?',
          source: 'system' as const, intent, cached: false };
      }

      const session = this.getSession(sessionId);
      const followUp = !!session && this.isContextFollowUp(message, intent);
      const candidates = followUp ? [] : await this.knowledge.candidates(message);
      let context: ProductContext | null = null;
      if (intent.startsWith('product_')) {
        try { context = followUp ? await this.products.context(`${session!.query} ton kho`) ?? session!.context : await this.products.context(message); } catch {
          throw new ServiceUnavailableException('Chưa thể kiểm tra sản phẩm lúc này. Vui lòng thử lại sau.');
        }
        if (context) this.counters.productQueries++;
        else return { message: 'Bạn muốn hỏi sản phẩm nào? Cho mình tên hoặc loại sản phẩm để kiểm tra giá và tồn kho chính xác nhé.', source: 'system' as const, intent, cached: false };
      }
      if (followUp && context) return this.productResponse(context, intent);
      if (context && sessionId) this.remember(sessionId, context, message);
      const matching = candidates.find(row => row.contextHash === (context?.hash ?? '') && row.intent === intent);
      if (matching && await this.knowledge.use(matching)) {
        this.counters.knowledgeHits++;
        return { message: matching.answer, source: 'knowledge' as const, intent, cached: true, knowledgeId: matching.id };
      }
      // Current product facts can be rendered directly: no model or additional knowledge row needed.
      if (context) return this.productResponse(context, intent);

      // Pending/rejected answers are never reused; only their existence suppresses another draft.
      const existing = await this.knowledge.reviewedOrPending(message);
      if (existing) return this.reviewAnswer(intent, true);

      const ragContext = intent.startsWith('product_') ? [] : await this.knowledge.retrieveContext(message, intent);
      const draft = await this.gemini.draft(message, classification, ragContext, () => this.counters.geminiCalls++);
      const stored = await this.knowledge.saveDraft(message, draft);
      if (!stored.saved) this.counters.pendingSaveFailures++;
      if (stored.autoApproved) this.counters.autoApproved++;
      if (classification.riskLevel !== RiskLevel.LOW || this.intents.effectiveRisk(classification, draft) !== RiskLevel.LOW ||
        draft.intent !== 'general_question' || !this.intents.safeAnswer(draft.answer)) return this.reviewAnswer(intent, stored.saved);
      return { message: draft.answer, source: 'gemini' as const, intent, cached: false };
    } catch (error) {
      this.counters.errors++;
      if (error instanceof HttpException) throw error;
      this.logger.warn('CHAT request_failed');
      throw new InternalServerErrorException('Không thể xử lý câu hỏi lúc này. Vui lòng thử lại sau.');
    }
  }

  private reviewAnswer(intent: ChatIntent, recorded: boolean) {
    return { message: 'Hiện tại mình chưa có thông tin chính xác đã được xác nhận về vấn đề này. ' + (recorded ?
      'Câu hỏi đã được ghi nhận trong hệ thống để cửa hàng kiểm tra. Bạn có thể liên hệ cửa hàng nếu cần hỗ trợ ngay.' :
      'Mình chưa lưu được câu hỏi. Bạn vui lòng thử lại sau hoặc liên hệ cửa hàng để được hỗ trợ.'),
      source: 'system' as const, intent, cached: false };
  }

  private isContextFollowUp(message: string, intent: ChatIntent) {
    if (!['product_price', 'product_stock', 'product_detail'].includes(intent)) return false;
    const query = productQuery(message);
    return !query.terms.length || /\b(nay|do|ay)\b/.test(normalizeText(message));
  }

  private productResponse(context: ProductContext, intent: ChatIntent) {
    return {
      message: productAnswer(context, ['product_detail', 'product_comparison', 'product_category'].includes(intent), intent),
      products: context.products.map(product => ({
        id: product.id, name: product.name, price: Number(product.price), stock: Number(product.stock),
        category: product.category ?? null, brand: product.brand ?? null, description: product.description ?? null,
        specifications: product.specifications ?? null, origin: product.origin ?? null,
        imageUrl: product.imageUrl ?? null, isFeatured: !!product.isFeatured,
      })),
      source: 'product' as const, intent, cached: false,
    };
  }

  private getSession(sessionId?: string) {
    if (!sessionId) return undefined;
    const session = this.sessions.get(sessionId);
    if (!session || session.expiresAt < Date.now()) {
      if (session) this.sessions.delete(sessionId);
      return undefined;
    }
    return session;
  }

  private remember(sessionId: string, context: ProductContext, query: string) {
    if (this.sessions.size >= MAX_SESSIONS && !this.sessions.has(sessionId)) this.sessions.delete(this.sessions.keys().next().value!);
    this.sessions.set(sessionId, { context, query, expiresAt: Date.now() + SESSION_TTL });
  }
}
