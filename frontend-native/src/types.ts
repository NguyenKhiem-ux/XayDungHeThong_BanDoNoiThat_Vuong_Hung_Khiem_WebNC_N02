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
  endsAt: string;
  maxDiscountPercent: number;
  products: Product[];
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
  endDate: string;
  isActive: boolean;
  freeShipping: boolean;
}

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
  cart?: Cart;
  favorites?: Favorite[];
  actions?: ChatAction[];
  checkoutUrl?: string;
  error?: { code: string; retryable: boolean };
}
