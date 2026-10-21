// file định nghĩa các kiểu dữ liệu typescript dùng khi làm việc với api.

export interface DashboardData {
  revenue: number;
  orders: number;
  pendingOrders: number;
  users: number;
  products: number;
  recentOrders: Order[];
  chartRevenueByDay: Array<{ day: string; value: number }>;
  chartOrdersByDay: Array<{ day: string; value: number }>;
}
export type Role = 'USER' | 'ADMIN';

export interface SavedDemoCard {
  holder: string;
  type: 'DOMESTIC' | 'INTERNATIONAL';
  provider: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface User {
  id: number;
  fullName: string;
  username: string | null;
  email: string;
  phone: string | null;
  birthDate?: string | null;
  address?: string | null;
  gender?: string;
  avatarUrl?: string | null;
  role: Role;
  savedCard?: SavedDemoCard | null;
  hasTransactionPin?: boolean;
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  specifications: string | null;
  origin: string | null;
  price: number;
  stock: number;
  category: string | null;
  brand: string | null;
  imageUrl: string | null;
  isFeatured: boolean;
}

export interface Favorite {
  id: number;
  productId: number;
  createdAt: string;
  product: Product;
}

export interface UserAddress {
  id: number;
  userId: number;
  fullName: string;
  phone: string;
  address: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CouponDiscountType = 'percentage' | 'fixed';

export interface Coupon {
  id: number;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number | string;
  minOrderAmount: number | string;
  maxDiscountAmount: number | string | null;
  usageLimit: number | null;
  usedCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  userId: number | null;
  freeShipping: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: number;
  productId: number;
  quantity: number;
  subtotal: number;
  product: Pick<Product, 'id' | 'name' | 'price' | 'stock' | 'imageUrl' | 'category' | 'brand'>;
}

export interface Cart {
  id: number;
  items: CartItem[];
  itemCount: number;
  total: number;
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';
export type PaymentMethod = 'QR' | 'CARD' | 'CASH' | 'PAYOS';

export interface OrderItem {
  id: number;
  productId: number | null;
  productName: string;
  productImage: string | null;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  totalAmount: number;
  subtotalAmount: number;
  discountAmount: number;
  couponCode: string | null;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: 'UNPAID' | 'PAID';
  note: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ChatResponse {
  message: string;
  source: 'knowledge' | 'gemini' | 'product' | 'small_talk' | 'system' | 'shopping';
  intent: ChatIntent;
  cached: boolean;
  products?: Product[];
  knowledgeId?: number;
  type?: 'text' | 'product_result' | 'cart' | 'checkout_review' | 'error';
  cart?: Cart;
  actions?: ChatAction[];
  checkout?: CheckoutReview;
  checkoutUrl?: '/checkout/info';
  error?: { code: string; retryable: boolean };
  orders?: Order[];
  addresses?: UserAddress[];
  favorites?: Favorite[];
  coupons?: Array<{ coupon: Coupon; active: boolean; eligible: boolean; reason: string; discountAmount?: number; finalAmount?: number }>;
  addressForm?: { addressId?: number; values: ChatAddressInput; missingFields: string[] };
  confirmation?: { id: string; summary: string };
}

export type ChatActionType = 'product_select' | 'cart_add' | 'cart_remove' | 'cart_update_quantity' | 'cart_view' | 'buy_now' | 'checkout_review' | 'checkout_confirm' |
  'orders_list' | 'order_detail' | 'favorites_list' | 'favorite_add' | 'favorite_remove' | 'addresses_list' |
  'address_create' | 'address_update' | 'address_delete' | 'address_default' | 'coupons_list' | 'coupon_detail' |
  'cart_add_many' | 'cart_clear' | 'action_confirm' | 'action_cancel';
export type ChatAddressInput = Partial<Pick<UserAddress, 'fullName' | 'phone' | 'address' | 'isDefault'>>;
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
  address?: ChatAddressInput;
  items?: Array<{ productId: number; quantity: number }>;
}
export type ChatRequestOptions = Partial<Omit<ChatAction, 'type' | 'label'>> & { action?: ChatActionType; requestId: string };
export interface CheckoutReview {
  id: string;
  product: Product;
  quantity: number;
  subtotal: number;
  total: number;
  items: Array<{ product: Pick<Product, 'id' | 'name' | 'price' | 'stock'>; quantity: number; subtotal: number }>;
  addresses: Array<Pick<UserAddress, 'id' | 'fullName' | 'phone' | 'address' | 'isDefault'>>;
  addressId?: number;
  missingFields: string[];
  confirmed: boolean;
}

export type KnowledgeStatus = 'pending_review' | 'approved' | 'rejected';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export const chatIntents = ['small_talk', 'greeting', 'thanks', 'goodbye', 'product_search', 'product_detail',
  'product_recommendation', 'product_comparison', 'product_price', 'product_stock', 'product_category',
  'product_select', 'cart_add', 'cart_remove', 'cart_update_quantity', 'cart_view', 'buy_now', 'checkout_review',
  'shipping', 'payment', 'promotion', 'warranty', 'return', 'refund', 'order', 'complaint', 'account',
  'password', 'legal', 'general_store_question', 'general_question', 'unknown'] as const;
export type ChatIntent = typeof chatIntents[number];

export interface ChatbotKnowledge {
  id: number;
  question: string;
  answer: string;
  keywords: string;
  contextHash: string;
  normalizedQuestion: string;
  intent: ChatIntent;
  confidenceScore: number;
  riskLevel: RiskLevel;
  source: 'gemini' | 'admin' | 'system';
  shouldStore: boolean;
  reviewedBy: number | null;
  reviewedAt: string | null;
  status: KnowledgeStatus;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatbotStats {
  since: string;
  totalQuestions: number;
  knowledgeHits: number;
  geminiCalls: number;
  productQueries: number;
  knowledgeHitRate: number;
  errors: number;
  pendingSaveFailures: number;
  smallTalkHandled: number;
  autoApproved: number;
  pendingReview: number;
  rejected: number;
  geminiUsageRate: number;
}
