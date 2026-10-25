import { BadRequestException, HttpException, Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ChatProductsService, ProductContext, productResponse, productQuery } from './chat-products.service';
import { KnowledgeService } from './knowledge.service';
import { IntentService } from './intent.service';
import { SmallTalkService } from './small-talk.service';
import { GeminiService } from './gemini.service';
import { ChatIntent, ChatReply, ChatStream, RiskLevel } from './chat.types';
import { normalizeText } from './chat-matching';
import { AuthUser } from '../common/types/auth-user.type';
import { ChatDto } from './dto/chat.dto';
import { ChatShoppingService, ShoppingSession } from './chat-shopping.service';
import { ChatUserActionsService, UserActionSession, hasChatSecret } from './chat-user-actions.service';
import { ChatCheckoutService, CheckoutSession } from './chat-checkout.service';

type ChatSession = ShoppingSession & UserActionSession & CheckoutSession & { expiresAt: number; requests: Map<string, { fingerprint: string; result: Promise<ChatReply> }> };
const SESSION_TTL = 30 * 60 * 1000;
const MAX_SESSIONS = 1000;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  // ponytail: counters cover this process since restart; persist aggregates when multi-instance reporting is needed.
  private readonly counters = { since: new Date().toISOString(), totalQuestions: 0, knowledgeHits: 0, geminiCalls: 0,
    smallTalkHandled: 0, autoApproved: 0, productQueries: 0, errors: 0, pendingSaveFailures: 0 };
  // shortcut: scoped RAM sessions expire safely; use shared storage before running multiple backend instances.
  private readonly sessions = new Map<string, ChatSession>();
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(private readonly knowledge: KnowledgeService, private readonly products: ChatProductsService,
    private readonly intents: IntentService, private readonly smallTalk: SmallTalkService, private readonly gemini: GeminiService,
    private readonly shopping: ChatShoppingService, private readonly userActions: ChatUserActionsService, private readonly checkout: ChatCheckoutService) {}

  async stats() {
    const rate = (count: number) => this.counters.totalQuestions ? Math.round(count / this.counters.totalQuestions * 10000) / 100 : 0;
    const geminiCalls = this.counters.geminiCalls + (this.gemini.actionCalls ?? 0);
    return { ...this.counters, geminiCalls, ...await this.knowledge.counts(), knowledgeHitRate: rate(this.counters.knowledgeHits), geminiUsageRate: rate(geminiCalls) };
  }

  async send(message: string, sessionId?: string, user?: AuthUser, options?: ChatDto, stream?: ChatStream): Promise<ChatReply> {
    if (hasChatSecret(message)) return { message: 'Đừng gửi mật khẩu, OTP, PIN, token hoặc thông tin thẻ vào chatbot. Hãy dùng trang tài khoản/thanh toán.', source: 'system', intent: 'account', cached: false };
    const dto: ChatDto = { ...options, message: message.trim().replace(/\s+/g, ' '), sessionId };
    const scope = `${user ? `user:${user.id}` : 'guest'}:${sessionId ?? ''}`;
    const session = sessionId ? this.getSession(scope) : this.newSession();
    const fingerprint = JSON.stringify({ ...dto, requestId: undefined });
    const previous = dto.requestId ? session.requests.get(dto.requestId) : undefined;
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new BadRequestException('requestId đã được sử dụng cho nội dung khác.');
      return previous.result;
    }
    if (dto.requestId && session.requests.size >= 100) throw new BadRequestException('Phiên đã có quá nhiều thao tác. Vui lòng mở phiên trò chuyện mới.');
    // Serialize each user's requests, including actions from different chat tabs.
    const queueKey = user ? `user:${user.id}` : scope;
    const result = (this.queues.get(queueKey) ?? Promise.resolve()).catch(() => {}).then(() => this.respond(dto, session, user, stream));
    this.queues.set(queueKey, result);
    if (dto.requestId) session.requests.set(dto.requestId, { fingerprint, result });
    try { return await result; } finally {
      if (this.queues.get(queueKey) === result) this.queues.delete(queueKey);
    }
  }

  private async respond(dto: ChatDto, session: ChatSession, user?: AuthUser, stream?: ChatStream): Promise<ChatReply> {
    this.counters.totalQuestions++;
    const message = dto.message;
    try {
      const classification = this.intents.classify(message);
      let { intent } = classification;
      const checkoutReply = await this.checkout.handle(dto, session, user, stream?.signal);
      if (checkoutReply) return checkoutReply;
      const accountReply = await this.userActions.handle(dto, session, user, stream?.signal);
      if (accountReply) return accountReply;
      session.confirmation = undefined;
      session.addressDraft = undefined;
      session.pendingSelection = undefined;
      session.userDomain = undefined;
      const shopping = await this.shopping.handle(dto, intent, session, user);
      if (shopping) return shopping;
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

      const followUp = !!session.context && this.isContextFollowUp(message, intent);
      const candidates = followUp ? [] : await this.knowledge.candidates(message);
      let context: ProductContext | null = null;
      if (intent.startsWith('product_')) {
        if (!followUp) {
          session.context = undefined;
          session.selectedId = undefined;
          session.review = undefined;
          session.pendingQuantity = undefined;
          session.quantity = 1;
        }
        try { context = followUp ? await this.products.context(`${session.query} ton kho`) : await this.products.context(message); } catch {
          throw new ServiceUnavailableException('Chưa thể kiểm tra sản phẩm lúc này. Vui lòng thử lại sau.');
        }
        if (context) this.counters.productQueries++;
        else return { message: 'Bạn muốn hỏi sản phẩm nào? Cho mình tên hoặc loại sản phẩm để kiểm tra giá và tồn kho chính xác nhé.', source: 'system' as const, intent, cached: false };
      }
      if (followUp && context) return productResponse(context, intent);
      if (context) { session.context = context; session.query = message; }
      // The context hash includes current sale prices; stale product answers cannot match.
      const matching = candidates.find(row => row.contextHash === (context?.hash ?? '') && row.intent === intent);
      if (matching && await this.knowledge.use(matching)) {
        this.counters.knowledgeHits++;
        return { ...(context ? productResponse(context, intent) : {}), message: matching.answer, source: 'knowledge' as const, intent, cached: true, knowledgeId: matching.id };
      }
      if (context) return productResponse(context, intent);

      // Pending/rejected answers are never reused; only their existence suppresses another draft.
      const existing = await this.knowledge.reviewedOrPending(message);
      if (existing) return this.reviewAnswer(intent, true);

      const ragContext = intent.startsWith('product_') ? [] : await this.knowledge.retrieveContext(message, intent);
      let partial = '';
      let blocked = false;
      const draft = await this.gemini.draft(message, classification, ragContext, () => this.counters.geminiCalls++, stream && {
        signal: stream.signal,
        // Policy drafts remain private; general advice also passes the existing content guard as it arrives.
        onText: classification.intent === 'general_question' && classification.riskLevel === RiskLevel.LOW ? text => {
          partial += text;
          blocked ||= !this.intents.safeAnswer(partial);
          if (!blocked) stream.onDelta(text);
        } : undefined,
      });
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

  private newSession(): ChatSession {
    return { quantity: 1, expiresAt: Date.now() + SESSION_TTL, requests: new Map() };
  }

  private getSession(key: string) {
    for (const [id, session] of this.sessions) if (session.expiresAt < Date.now()) this.sessions.delete(id);
    let session = this.sessions.get(key);
    if (!session) {
      if (this.sessions.size >= MAX_SESSIONS) this.sessions.delete(this.sessions.keys().next().value!);
      session = this.newSession();
      this.sessions.set(key, session);
    }
    session.expiresAt = Date.now() + SESSION_TTL;
    return session;
  }
}
