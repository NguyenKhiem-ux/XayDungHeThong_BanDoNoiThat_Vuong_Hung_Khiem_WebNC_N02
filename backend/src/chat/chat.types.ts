export const CHAT_INTENTS = [
  'small_talk', 'greeting', 'thanks', 'goodbye',
  'product_search', 'product_detail', 'product_recommendation', 'product_comparison',
  'product_price', 'product_stock', 'product_category',
  'product_select', 'cart_add', 'cart_remove', 'cart_update_quantity', 'cart_view', 'buy_now', 'checkout_review',
  'shipping', 'payment', 'promotion', 'warranty', 'return', 'refund', 'order',
  'complaint', 'account', 'password', 'legal', 'general_store_question', 'general_question', 'unknown',
] as const;
export type ChatIntent = typeof CHAT_INTENTS[number];
export enum RiskLevel { LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH' }
export interface Classification {
  intent: ChatIntent;
  riskLevel: RiskLevel;
  shouldStore: boolean;
}
export interface GeminiDraft {
  answer: string;
  intent: ChatIntent;
  confidence_score: number;
  risk_level: RiskLevel;
  should_auto_approve: boolean;
}

export interface RagContext {
  question: string;
  answer: string;
  intent: ChatIntent;
}

export const CHAT_ACTIONS = ['product_select', 'cart_add', 'cart_remove', 'cart_update_quantity', 'cart_view',
  'buy_now', 'checkout_review', 'checkout_confirm'] as const;
export type ChatActionType = typeof CHAT_ACTIONS[number];
export interface ChatAction {
  type: ChatActionType;
  label: string;
  productId?: number;
  quantity?: number;
  reviewId?: string;
  addressId?: number;
}
export type ChatProduct = Omit<import('./chat-products.service').ProductContext['products'][number], 'price'> & { price: number };
export type ChatCart = Awaited<ReturnType<import('../cart/cart.service').CartService['get']>>;
export interface CheckoutReview {
  id: string;
  product: ChatProduct;
  quantity: number;
  subtotal: number;
  total: number;
  items: Array<{ product: Pick<ChatProduct, 'id' | 'name' | 'price' | 'stock'>; quantity: number; subtotal: number }>;
  addresses: Array<{ id: number; fullName: string; phone: string; address: string; isDefault: boolean }>;
  addressId?: number;
  missingFields: string[];
  confirmed: boolean;
}
export interface ChatReply {
  message: string;
  source: 'knowledge' | 'gemini' | 'product' | 'small_talk' | 'system' | 'shopping';
  intent: ChatIntent;
  cached: boolean;
  type?: 'text' | 'product_result' | 'cart' | 'checkout_review' | 'error';
  products?: ChatProduct[];
  cart?: ChatCart;
  actions?: ChatAction[];
  checkout?: CheckoutReview;
  checkoutUrl?: '/checkout/info';
  knowledgeId?: number;
  error?: { code: string; retryable: boolean };
}
