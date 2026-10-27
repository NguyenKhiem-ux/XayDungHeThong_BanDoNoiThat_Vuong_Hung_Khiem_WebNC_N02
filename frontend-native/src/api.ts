import * as SecureStore from 'expo-secure-store';
import { Linking, Platform } from 'react-native';
import type { Cart, ChatAction, ChatResponse, Favorite, Product, PromotionResponse, User } from './types';

const DEFAULT_BACKEND_ORIGIN = 'http://localhost:3000';
const API_BASE = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'web' ? '/api' : `${DEFAULT_BACKEND_ORIGIN}/api`);
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

export const API_ORIGIN = process.env.EXPO_PUBLIC_API_ORIGIN || (API_BASE.startsWith('/') ? DEFAULT_BACKEND_ORIGIN : API_BASE.replace(/\/api\/?$/, ''));

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
  const token = await getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
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

export const authApi = {
  login: (usernameOrEmail: string, password: string) => request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ usernameOrEmail, password }),
  }),
  register: (data: RegisterInput) => request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

export const productApi = {
  detail: (id: number) => request<Product>(`/products/${id}`),
};

export const accountApi = {
  me: () => request<User>('/auth/me'),
  favorites: () => request<Favorite[]>('/favorites'),
  cart: () => request<Cart>('/cart'),
  addToCart: (productId: number, quantity = 1) => request<Cart>('/cart/add', { method: 'POST', body: JSON.stringify({ productId, quantity }) }),
  addFavorite: (productId: number) => request<Favorite>(`/favorites/${productId}`, { method: 'POST' }),
  removeFavorite: (productId: number) => request<void>(`/favorites/${productId}`, { method: 'DELETE' }),
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

export function legacyUrl(path: string) {
  return `${WEB_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function openLegacy(path: string) {
  const url = legacyUrl(path);
  if (Platform.OS === 'web') globalThis.location.assign(url);
  else await Linking.openURL(url);
}
