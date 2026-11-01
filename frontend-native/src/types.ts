export interface User {
  id: number;
  fullName: string;
  username: string | null;
  email: string;
  phone?: string | null;
  birthDate?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  address?: string | null;
  avatarUrl?: string | null;
  savedCard?: SavedDemoCard | null;
  hasTransactionPin?: boolean;
  role?: 'USER' | 'ADMIN';
}

export interface AdminUser {
  id: number;
  fullName: string;
  username: string | null;
  email: string;
  phone: string | null;
  role: 'USER' | 'ADMIN';
  createdAt: string;
}

export interface SavedDemoCard {
  holder: string;
  type: 'DOMESTIC' | 'INTERNATIONAL';
  provider: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface UserAddress {
  id: number;
  userId: number;
  fullName: string;
  phone: string;
  address: string;
  isDefault: boolean;
}

export interface CheckoutShipping {
  fullName: string;
  phone: string;
  province: string;
  district: string;
  address: string;
  note: string;
}

export type PaymentMethod = 'QR' | 'CARD' | 'CASH' | 'PAYOS';

export interface CheckoutQuote {
  id: string;
  hash: string;
  expiresAt: string;
  items: Array<{ productId: number; name: string; imageUrl: string | null; price: number; quantity: number; subtotal: number }>;
  address: { id?: number; fullName: string; phone: string; address: string };
  email: string;
  paymentMethod: PaymentMethod;
  couponCode: string | null;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  total: number;
}

export interface Order {
  id: number;
  createdAt: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  totalAmount: number;
  subtotalAmount: number;
  discountAmount: number;
  shippingFee?: number;
  couponCode: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';
  paymentMethod: PaymentMethod;
  paymentStatus: 'UNPAID' | 'PAID';
  note: string | null;
  items: Array<{ id: number; productId: number | null; productName: string; productImage: string | null; price: number; quantity: number; subtotal: number }>;
}

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

export interface RevenueRow {
  period: string;
  orders: number;
  revenue: number;
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

export type KnowledgeInput = Pick<ChatbotKnowledge, 'question' | 'answer' | 'keywords'>;
export interface KnowledgeListResponse { items: ChatbotKnowledge[]; total: number; page: number; limit: number }

export interface Product {
  id: number;
  name: string;
  description?: string | null;
  specifications?: string | null;
  origin?: string | null;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  savings?: number;
  stock: number;
  category: string | null;
  brand: string | null;
  imageUrl: string | null;
  isFeatured: boolean;
  averageRating?: number;
  reviewCount?: number;
  promotionId?: number | null;
  promotionTitle?: string | null;
  saleEndsAt?: string | null;
}

export type ProductSort = 'newest' | 'price-asc' | 'price-desc' | 'name';

export interface ProductPage {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface ReviewSummary {
  averageRating: number;
  reviewCount: number;
  ratingCounts: Record<number, number>;
}

export interface ProductReview {
  id: number;
  rating: number;
  comment: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewPage {
  summary: ReviewSummary;
  reviews: ProductReview[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OwnReview {
  canReview: boolean;
  review: { rating: number; comment: string } | null;
}

export interface PromotionEvent {
  bannerDiscountPercent?: number | null;
  displayDiscountPercent?: number;
  id: number;
  title: string;
  description: string;
  status: 'draft' | 'published' | 'paused';
  phase: 'draft' | 'paused' | 'scheduled' | 'active' | 'ended';
  startsAt: string;
  endsAt: string;
  maxDiscountPercent: number;
  products: Product[];
}

export interface PromotionInput {
  bannerDiscountPercent: number | null;
  title: string;
  description: string;
  status: PromotionEvent['status'];
  startsAt: string;
  endsAt: string;
  items: Array<{ productId: number; discountPercent: number }>;
}

export interface PromotionAdminResponse {
  serverTime: string;
  events: PromotionEvent[];
}

export interface PromotionResponse {
  serverTime: string;
  event: PromotionEvent | null;
}

export interface Favorite {
  id: number;
  productId: number;
  createdAt?: string;
  product: Product;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface AvailableCoupon {
  valid: true;
  coupon: Coupon;
  discountAmount: number;
  finalAmount: number;
}

export type CouponInput = Omit<Coupon, 'id' | 'usedCount' | 'createdAt' | 'updatedAt'>;

export interface Cart {
  itemCount: number;
  total: number;
  couponEligibleTotal?: number;
  saleSavings?: number;
  items: Array<{
    productId: number;
    quantity: number;
    subtotal: number;
    product: Product;
  }>;
}

export interface ChatAction {
  type: string;
  label: string;
  productId?: number;
  quantity?: number;
  [key: string]: unknown;
}

export interface ChatResponse {
  message: string;
  products?: Product[];
  chips?: string[];
  cart?: Cart;
  favorites?: Favorite[];
  actions?: ChatAction[];
  checkout?: ChatCheckoutReview;
  checkoutFlow?: ChatCheckoutView;
  checkoutUrl?: string;
  error?: { code: string; retryable: boolean };
  orders?: Order[];
  addresses?: UserAddress[];
  coupons?: ChatCouponView[];
  addressForm?: { addressId?: number; values: ChatAddressInput; missingFields: string[] };
  confirmation?: { id: string; summary: string };
}

export interface ChatAddressInput {
  fullName?: string;
  phone?: string;
  address?: string;
  isDefault?: boolean;
}

export interface ChatCouponView {
  coupon: Coupon;
  active: boolean;
  eligible: boolean;
  reason: string;
  discountAmount?: number;
  finalAmount?: number;
}

export interface ChatCheckoutReview {
  id: string;
  total: number;
  items: Array<{ product: Pick<Product, 'id' | 'name' | 'price' | 'stock'>; quantity: number; subtotal: number }>;
  addresses: UserAddress[];
  addressId?: number;
  missingFields: string[];
  confirmed: boolean;
}

export interface ChatCheckoutView {
  stage: 'collecting_items' | 'collecting_address' | 'selecting_voucher' | 'selecting_payment' | 'awaiting_confirmation' | 'creating_order' | 'awaiting_payment' | 'completed' | 'cancelled';
  appliedVoucher?: { code: string; discountAmount: number; finalAmount: number };
  addressId?: number;
  couponCode?: string;
  paymentMethod?: PaymentMethod;
  quote?: Pick<CheckoutQuote, 'id' | 'hash' | 'items' | 'address' | 'email' | 'paymentMethod' | 'couponCode' | 'subtotal' | 'discountAmount' | 'shippingFee' | 'total'>;
  order?: Order;
  paymentUrl?: string;
  paymentError?: string;
  cart: Cart;
  addresses: UserAddress[];
  coupons: ChatCouponView[];
  paymentMethods: Array<{ value: PaymentMethod; label: string; description: string }>;
  actions: ChatAction[];
}
