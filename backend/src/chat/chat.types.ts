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

export interface ChatStream {
  onDelta: (text: string) => void;
  signal: AbortSignal;
}

export const USER_ACTIONS = ['orders_list', 'order_detail', 'favorites_list', 'favorite_add', 'favorite_remove',
  'addresses_list', 'address_create', 'address_update', 'address_delete', 'address_default',
  'coupons_list', 'coupon_detail', 'cart_add_many', 'cart_clear', 'action_confirm', 'action_cancel'] as const;
export const CHECKOUT_ACTIONS = ['checkout_start', 'checkout_address', 'checkout_voucher', 'checkout_best_voucher', 'checkout_payment',
  'checkout_preview', 'checkout_place_order', 'checkout_cancel', 'checkout_edit_items', 'checkout_edit_address', 'checkout_edit_voucher',
  'checkout_edit_payment', 'checkout_item_update', 'checkout_item_remove', 'checkout_payment_link', 'checkout_status'] as const;
export const CHAT_ACTIONS = ['product_select', 'cart_add', 'cart_remove', 'cart_update_quantity', 'cart_view',
  'buy_now', 'checkout_review', 'checkout_confirm', ...USER_ACTIONS, ...CHECKOUT_ACTIONS] as const;
export type ChatActionType = typeof CHAT_ACTIONS[number];
export interface ChatAction {
  type: ChatActionType;
  label: string;
  productId?: number;
  quantity?: number;
  reviewId?: string;
  addressId?: number;
  orderId?: number;
  code?: string;
  confirmationId?: string;
  address?: Partial<import('../addresses/dto/address.dto').CreateAddressDto>;
  items?: Array<{ productId: number; quantity: number }>;
  checkoutId?: string;
  quoteHash?: string;
  paymentMethod?: import('../database/entities/enums').PaymentMethod;
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
  // Câu trả lời nhanh khách bấm để gửi như tin nhắn (tối đa 4).
  chips?: string[];
  cart?: ChatCart;
  actions?: ChatAction[];
  checkout?: CheckoutReview;
  checkoutUrl?: '/checkout/info';
  knowledgeId?: number;
  error?: { code: string; retryable: boolean };
  orders?: Array<Awaited<ReturnType<import('../orders/orders.service').OrdersService['getOneForUser']>>>;
  addresses?: import('../database/entities/user-address.entity').UserAddress[];
  favorites?: Awaited<ReturnType<import('../favorites/favorites.service').FavoritesService['list']>>;
  coupons?: Array<ChatCoupon>;
  addressForm?: { addressId?: number; values: Partial<import('../addresses/dto/address.dto').CreateAddressDto>; missingFields: string[] };
  confirmation?: { id: string; summary: string };
  checkoutFlow?: import('./chat-checkout.service').CheckoutView;
}
export interface ChatCoupon {
  coupon: import('../database/entities/coupon.entity').Coupon;
  active: boolean;
  eligible: boolean;
  reason: string;
  discountAmount?: number;
  finalAmount?: number;
}
