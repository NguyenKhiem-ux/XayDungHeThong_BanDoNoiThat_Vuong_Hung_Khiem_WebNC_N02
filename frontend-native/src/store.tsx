import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { accountApi, ApiError, authApi, clearToken, getToken, saveToken, type RegisterInput } from './api';
import type { Cart, ChatResponse, User } from './types';

interface StoreValue {
  user: User | null;
  authReady: boolean;
  cart: Cart | null;
  favoriteIds: number[];
  notice: string;
  setNotice: (message: string) => void;
  login: (usernameOrEmail: string, password: string) => Promise<User>;
  register: (data: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  addToCart: (productId: number, quantity?: number) => Promise<boolean>;
  toggleFavorite: (productId: number) => Promise<boolean>;
  syncChat: (response: ChatResponse) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cart, setCart] = useState<Cart | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [notice, setNoticeState] = useState('');

  const setNotice = useCallback((message: string) => {
    setNoticeState(message);
    setTimeout(() => setNoticeState(''), 2600);
  }, []);

  const loadAccountData = useCallback(async () => {
    const [cartResult, favoriteResult] = await Promise.allSettled([accountApi.cart(), accountApi.favorites()]);
    if (cartResult.status === 'fulfilled') setCart(cartResult.value);
    if (favoriteResult.status === 'fulfilled') setFavoriteIds(favoriteResult.value.map(item => item.productId));
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!await getToken()) return;
        const account = await accountApi.me();
        if (!active) return;
        setUser(account);
        await loadAccountData();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) await clearToken();
      } finally {
        if (active) setAuthReady(true);
      }
    })();
    return () => { active = false; };
  }, [loadAccountData]);

  const applyAuth = useCallback(async (response: { accessToken: string; user: User }) => {
    await saveToken(response.accessToken);
    setUser(response.user);
    setAuthReady(true);
    await loadAccountData();
    return response.user;
  }, [loadAccountData]);

  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    return applyAuth(await authApi.login(usernameOrEmail, password));
  }, [applyAuth]);

  const register = useCallback(async (data: RegisterInput) => {
    return applyAuth(await authApi.register(data));
  }, [applyAuth]);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
    setCart(null);
    setFavoriteIds([]);
    setNotice('Đã đăng xuất.');
  }, [setNotice]);

  const requireAccount = useCallback(() => {
    if (user) return true;
    setNotice('Vui lòng đăng nhập để tiếp tục.');
    return false;
  }, [setNotice, user]);

  const addToCart = useCallback(async (productId: number, quantity = 1) => {
    if (!requireAccount()) return false;
    try {
      setCart(await accountApi.addToCart(productId, quantity));
      setNotice('Đã thêm sản phẩm vào giỏ hàng.');
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể thêm sản phẩm.');
      return false;
    }
  }, [requireAccount, setNotice]);

  const toggleFavorite = useCallback(async (productId: number) => {
    if (!requireAccount()) return false;
    const saved = favoriteIds.includes(productId);
    try {
      if (saved) await accountApi.removeFavorite(productId);
      else await accountApi.addFavorite(productId);
      setFavoriteIds(current => saved ? current.filter(id => id !== productId) : [...current, productId]);
      setNotice(saved ? 'Đã xóa khỏi yêu thích.' : 'Đã thêm vào yêu thích.');
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể cập nhật yêu thích.');
      return false;
    }
  }, [favoriteIds, requireAccount, setNotice]);

  const syncChat = useCallback((response: ChatResponse) => {
    if (response.cart) setCart(response.cart);
    if (response.favorites) setFavoriteIds(response.favorites.map(item => item.productId));
  }, []);

  const value = useMemo(() => ({ user, authReady, cart, favoriteIds, notice, setNotice, login, register, logout, addToCart, toggleFavorite, syncChat }), [user, authReady, cart, favoriteIds, notice, setNotice, login, register, logout, addToCart, toggleFavorite, syncChat]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider');
  return value;
}
