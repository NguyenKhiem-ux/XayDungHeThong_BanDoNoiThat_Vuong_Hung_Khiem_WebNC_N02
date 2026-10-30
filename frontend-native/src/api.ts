import * as SecureStore from 'expo-secure-store';
import { Alert, Linking, Platform } from 'react-native';
import type { AdminUser, AvailableCoupon, Cart, ChatAction, ChatResponse, ChatbotKnowledge, ChatIntent, CheckoutQuote, ContactMessage, Coupon, CouponInput, DashboardData, Favorite, KnowledgeInput, KnowledgeListResponse, KnowledgeStatus, OwnReview, Order, PaymentMethod, Product, ProductPage, ProductSort, PromotionAdminResponse, PromotionEvent, PromotionInput, PromotionResponse, RevenueRow, ReviewPage, ReviewSummary, RiskLevel, User, UserAddress } from './types';

const WEB_DEV_BACKEND_ORIGIN = 'http://localhost:3000';
const LOOPBACK_URL = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?=[:/]|$)/i;

function normalizeApiBase(value?: string) {
  const base = value?.trim().replace(/\/+$/, '') || '';
  return !base || /\/api$/i.test(base) ? base : `${base}/api`;
}

const configuredApiBase = normalizeApiBase(process.env.EXPO_PUBLIC_API_URL);
const API_BASE = configuredApiBase || (Platform.OS === 'web' ? '/api' : '');
const WEB_BASE = (process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:5173').replace(/\/$/, '');
const TOKEN_KEY = 'giadung_token';

export interface RegisterInput {
  fullName: string;
  username: string;
  email: string;
  password: string;
  phone?: string;
}

interface AuthResponse {
  accessToken: string;
  user: User;
}

export const API_ORIGIN = (process.env.EXPO_PUBLIC_API_ORIGIN?.trim().replace(/\/+$/, '') || (API_BASE.startsWith('/') ? WEB_DEV_BACKEND_ORIGIN : API_BASE.replace(/\/api$/i, '')));

const API_CONFIG_ERROR = Platform.OS === 'web' ? ''
  : !API_BASE
    ? 'Thiếu EXPO_PUBLIC_API_URL. Android Emulator dùng http://10.0.2.2:3000/api; thiết bị thật dùng IP LAN hoặc Backend HTTPS.'
    : !/^https?:\/\//i.test(API_BASE) || LOOPBACK_URL.test(API_BASE)
      ? 'EXPO_PUBLIC_API_URL trên Android/iOS phải là URL HTTP(S) truy cập được, không dùng localhost. Dùng 10.0.2.2 cho Android Emulator hoặc IP LAN/HTTPS cho thiết bị thật.'
      : !/^https?:\/\//i.test(API_ORIGIN) || LOOPBACK_URL.test(API_ORIGIN)
        ? 'EXPO_PUBLIC_API_ORIGIN trên Android/iOS phải là origin HTTP(S) truy cập được và không dùng localhost.'
        : '';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function getToken() {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken() {
  if (Platform.OS === 'web') globalThis.localStorage?.removeItem(TOKEN_KEY);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function saveToken(token: string) {
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(TOKEN_KEY, token);
  else await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (API_CONFIG_ERROR) throw new Error(API_CONFIG_ERROR);
  const token = await getToken();
  const isMultipart = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(!isMultipart ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string | string[] } | null;
    const message = Array.isArray(payload?.message) ? payload.message.join('. ') : payload?.message;
    throw new ApiError(message || `Yêu cầu thất bại (${response.status})`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const homeApi = {
  featured: () => request<Product[]>('/products/featured'),
  categories: () => request<string[]>('/products/categories/list'),
  promotion: () => request<PromotionResponse>('/promotions/current'),
};

export const promotionApi = {
  list: (signal?: AbortSignal) => request<PromotionAdminResponse>('/promotions/admin', { signal }),
  create: (data: PromotionInput) => request<PromotionEvent>('/promotions', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: PromotionInput) => request<PromotionEvent>(`/promotions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const contactApi = {
  create: (data: { name: string; email: string; phone?: string; message: string }) => request<unknown>('/contact', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  adminList: (signal?: AbortSignal) => request<ContactMessage[]>('/contact/admin', { signal }),
  markRead: (id: number) => request<ContactMessage>(`/contact/admin/${id}/read`, { method: 'POST' }),
  remove: (id: number) => request<{ message: string }>(`/contact/admin/${id}`, { method: 'DELETE' }),
};

const KNOWLEDGE_PATH = '/admin/chatbot/knowledge';
export const knowledgeApi = {
  list: (query: { status: KnowledgeStatus | ''; page: number; risk: RiskLevel | ''; intent: ChatIntent | '' }, signal?: AbortSignal) =>
    request<KnowledgeListResponse>(`${KNOWLEDGE_PATH}?${knowledgeQueryString(query)}`, { signal }),
  detail: (id: number) => request<ChatbotKnowledge>(`${KNOWLEDGE_PATH}/${id}`),
  create: (data: KnowledgeInput) => request<ChatbotKnowledge>(KNOWLEDGE_PATH, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: KnowledgeInput) => request<ChatbotKnowledge>(`${KNOWLEDGE_PATH}/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  approve: (id: number) => request<ChatbotKnowledge>(`${KNOWLEDGE_PATH}/${id}/approve`, { method: 'PATCH' }),
  reject: (id: number) => request<ChatbotKnowledge>(`${KNOWLEDGE_PATH}/${id}/reject`, { method: 'PATCH' }),
  remove: (id: number) => request<{ message: string }>(`${KNOWLEDGE_PATH}/${id}`, { method: 'DELETE' }),
};

function knowledgeQueryString(query: { status: KnowledgeStatus | ''; page: number; risk: RiskLevel | ''; intent: ChatIntent | '' }) {
  const params = new URLSearchParams({ page: String(query.page), limit: '20' });
  if (query.status) params.set('status', query.status);
  if (query.risk) params.set('risk', query.risk);
  if (query.intent) params.set('intent', query.intent);
  return params.toString();
}

export const authApi = {
  login: (usernameOrEmail: string, password: string) => request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ usernameOrEmail, password }),
  }),
  register: (data: RegisterInput) => request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  forgotPassword: (email: string) => request<{ message: string; expiresAt: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),
  verifyResetOtp: (email: string, otp: string) => request<{ message: string }>('/auth/verify-reset-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  }),
  resetPassword: (email: string, otp: string, newPassword: string) => request<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, otp, newPassword }),
  }),
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => request<{ message: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
  }),
};

export const productApi = {
  list: (keyword?: string, category?: string, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (keyword) params.set('keyword', keyword);
    if (category) params.set('category', category);
    const query = params.toString();
    return request<Product[]>(`/products${query ? `?${query}` : ''}`, { signal });
  },
  categories: (signal?: AbortSignal) => request<string[]>('/products/categories/list', { signal }),
  detail: (id: number) => request<Product>(`/products/${id}`),
  page: (query: { page: number; limit: number; keyword?: string; category?: string; sort?: ProductSort }, signal?: AbortSignal) => {
    const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
    if (query.keyword) params.set('keyword', query.keyword);
    if (query.category) params.set('category', query.category);
    if (query.sort) params.set('sort', query.sort);
    return request<ProductPage>(`/products?${params.toString()}`, { signal });
  },
  create: (data: FormData) => request<Product>('/products', { method: 'POST', body: data }),
  update: (id: number, data: FormData) => request<Product>(`/products/${id}`, { method: 'PATCH', body: data }),
  remove: (id: number) => request<{ message: string }>(`/products/${id}`, { method: 'DELETE' }),
};

export const reviewApi = {
  list: (productId: number, page: number, rating?: number, signal?: AbortSignal) => request<ReviewPage>(`/products/${productId}/reviews?page=${page}${rating ? `&rating=${rating}` : ''}`, { signal }),
  mine: (productId: number, signal?: AbortSignal) => request<OwnReview>(`/products/${productId}/reviews/mine`, { signal }),
  save: (productId: number, rating: number, comment: string) => request<OwnReview & { summary: ReviewSummary }>(`/products/${productId}/reviews`, {
    method: 'PUT',
    body: JSON.stringify({ rating, comment }),
  }),
};

export const accountApi = {
  me: () => request<User>('/auth/me'),
  updateAvatar: (data: FormData) => request<User>('/auth/me/avatar', { method: 'POST', body: data }),
  updateProfile: (data: { fullName: string; phone: string | null; birthDate: string | null; gender: User['gender']; address: string | null }) => request<User>('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
  updateCardProfile: (data: { holder: string; type: 'DOMESTIC' | 'INTERNATIONAL'; provider: string; last4: string; expMonth: number; expYear: number; pin?: string }) => request<User>('/auth/me/card', { method: 'PATCH', body: JSON.stringify(data) }),
  addresses: () => request<UserAddress[]>('/addresses'),
  createAddress: (data: Pick<UserAddress, 'fullName' | 'phone' | 'address' | 'isDefault'>) => request<UserAddress>('/addresses', { method: 'POST', body: JSON.stringify(data) }),
  updateAddress: (id: number, data: Partial<Pick<UserAddress, 'fullName' | 'phone' | 'address' | 'isDefault'>>) => request<UserAddress>(`/addresses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeAddress: (id: number) => request<void>(`/addresses/${id}`, { method: 'DELETE' }),
  favorites: () => request<Favorite[]>('/favorites'),
  orders: () => request<Order[]>('/orders'),
  coupons: () => request<Coupon[]>('/coupons'),
  cart: () => request<Cart>('/cart'),
  addToCart: (productId: number, quantity = 1) => request<Cart>('/cart/add', { method: 'POST', body: JSON.stringify({ productId, quantity }) }),
  updateCart: (productId: number, quantity: number) => request<Cart>('/cart/update', { method: 'PUT', body: JSON.stringify({ productId, quantity }) }),
  removeFromCart: (productId: number) => request<Cart>(`/cart/remove/${productId}`, { method: 'DELETE' }),
  addFavorite: (productId: number) => request<Favorite>(`/favorites/${productId}`, { method: 'POST' }),
  removeFavorite: (productId: number) => request<void>(`/favorites/${productId}`, { method: 'DELETE' }),
};

export const adminApi = {
  dashboard: () => request<DashboardData>('/admin/dashboard'),
  revenue: (signal?: AbortSignal) => request<RevenueRow[]>('/admin/revenue', { signal }),
  users: (signal?: AbortSignal) => request<AdminUser[]>('/admin/users', { signal }),
};

export interface OrderInput {
  productId?: number;
  quoteId?: string;
  quoteHash?: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  paymentMethod: PaymentMethod;
  note?: string;
  couponCode?: string;
}

export const orderApi = {
  preview: (data: OrderInput) => request<CheckoutQuote>('/orders/preview', { method: 'POST', body: JSON.stringify(data) }),
  create: (data: OrderInput) => request<Order>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  list: () => request<Order[]>('/orders'),
  detail: (id: number) => request<Order>(`/orders/${id}`),
  adminList: (signal?: AbortSignal) => request<Order[]>('/admin/orders', { signal }),
  adminUpdateStatus: (id: number, status: Order['status']) => request<Order>(`/admin/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
};

export const couponApi = {
  list: () => request<Coupon[]>('/coupons'),
  available: (productId?: number) => request<AvailableCoupon[]>('/coupons/available', {
    method: 'POST',
    body: JSON.stringify({ productId }),
  }),
  adminList: (signal?: AbortSignal) => request<Coupon[]>('/coupons/admin/list', { signal }),
  create: (data: CouponInput) => request<Coupon>('/coupons', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: CouponInput) => request<Coupon>(`/coupons/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: number) => request<{ message: string }>(`/coupons/${id}`, { method: 'DELETE' }),
  validate: (code: string, orderAmount: number, productId?: number) => request<{ valid: boolean; coupon: Coupon; discountAmount: number; finalAmount: number }>('/coupons/validate', {
    method: 'POST',
    body: JSON.stringify({ code, orderAmount, productId }),
  }),
};

export const paymentApi = {
  createPayOSPaymentLink: (orderId: number) => request<{ checkoutUrl: string }>(`/payment/payos/create-link/${orderId}`, { method: 'POST' }),
  confirmCardPayment: (orderId: number, pin: string) => request<{ success: boolean; simulated: boolean }>(`/payment/card/confirm/${orderId}`, { method: 'POST', body: JSON.stringify({ pin }) }),
};

export const chatApi = {
  send: (message: string, sessionId: string, chatAction?: ChatAction) => {
    const { type: action, label: _label, ...options } = chatAction ?? { type: undefined, label: undefined };
    return request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, sessionId, ...options, ...(action ? { action, requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}` } : {}) }),
    });
  },
};

export function imageUrl(value?: string | null) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return `${API_ORIGIN}${value}`;
  return value;
}

export function formatVnd(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value) + '₫';
}

// Alert.alert không hiện hộp thoại trên Expo Web nên web dùng window.confirm.
export function confirmAction(message: string) {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm(message));
  return new Promise<boolean>(resolve => Alert.alert('Xác nhận', message, [{ text: 'Hủy', style: 'cancel', onPress: () => resolve(false) }, { text: 'Đồng ý', onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) }));
}

export function ratingStars(value = 0) {
  return [1, 2, 3, 4, 5].map(star => star <= Math.round(value) ? '★' : '☆').join('');
}

export function legacyUrl(path: string) {
  return `${WEB_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function openLegacy(path: string) {
  const url = legacyUrl(path);
  if (Platform.OS !== 'web' && LOOPBACK_URL.test(url)) return;
  if (Platform.OS === 'web') globalThis.location.assign(url);
  else await Linking.openURL(url);
}
