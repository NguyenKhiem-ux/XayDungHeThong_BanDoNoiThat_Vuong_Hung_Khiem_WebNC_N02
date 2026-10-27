export interface User {
  id: number;
  fullName: string;
  username: string | null;
  email: string;
  phone?: string | null;
  role?: 'USER' | 'ADMIN';
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
  productId: number;
}

export interface Cart {
  itemCount: number;
  total: number;
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
