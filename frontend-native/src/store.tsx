import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { accountApi, ApiError, authApi, clearToken, getToken, saveToken, type RegisterInput } from './api';
import type { Cart, ChatResponse, CheckoutShipping, User } from './types';

interface StoreValue {
  user: User | null;
  authReady: boolean;
  cart: Cart | null;
  checkoutShipping: CheckoutShipping | null;
  checkoutPaymentPin: string;
  cartLoading: boolean;
  cartError: string;
  favoriteIds: number[];
  notice: string;
  setNotice: (message: string) => void;
  setCheckoutShipping: (shipping: CheckoutShipping | null) => void;
  setCheckoutPaymentPin: (pin: string) => void;
  login: (usernameOrEmail: string, password: string) => Promise<User>;
  register: (data: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  refreshCart: () => Promise<void>;
  addToCart: (productId: number, quantity?: number) => Promise<boolean>;
  updateCart: (productId: number, quantity: number) => Promise<boolean>;
  removeFromCart: (productId: number) => Promise<boolean>;
  toggleFavorite: (productId: number) => Promise<boolean>;
  syncChat: (response: ChatResponse) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cart, setCart] = useState<Cart | null>(null);
  const [checkoutShipping, setCheckoutShipping] = useState<CheckoutShipping | null>(null);
  const [checkoutPaymentPin, setCheckoutPaymentPin] = useState('');
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [notice, setNoticeState] = useState('');

  const setNotice = useCallback((message: string) => {
    setNoticeState(message);
    setTimeout(() => setNoticeState(''), 2600);
  }, []);

  const loadAccountData = useCallback(async () => {
    setCartLoading(true);
    setCartError('');
    const [cartResult, favoriteResult] = await Promise.allSettled([accountApi.cart(), accountApi.favorites()]);
    if (cartResult.status === 'fulfilled') setCart(cartResult.value);
    else setCartError(cartResult.reason instanceof Error ? cartResult.reason.message : 'Không thể tải giỏ hàng.');
    if (favoriteResult.status === 'fulfilled') setFavoriteIds(favoriteResult.value.map(item => item.productId));
    setCartLoading(false);
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
    setCheckoutShipping(null);
    setCheckoutPaymentPin('');
    setCartError('');
    setCartLoading(false);
    setFavoriteIds([]);
    setNotice('Đã đăng xuất.');
  }, [setNotice]);

  const refreshCart = useCallback(async () => {
    if (!user) {
      setCart(null);
      setCartError('');
      return;
    }
    setCartLoading(true);
    setCartError('');
    try {
      setCart(await accountApi.cart());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải giỏ hàng.';
      setCartError(message);
      throw error;
    } finally {
      setCartLoading(false);
    }
  }, [user]);

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

  const updateCart = useCallback(async (productId: number, quantity: number) => {
    if (!requireAccount()) return false;
    try {
      setCart(await accountApi.updateCart(productId, quantity));
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể cập nhật giỏ hàng.');
      return false;
    }
  }, [requireAccount, setNotice]);

  const removeFromCart = useCallback(async (productId: number) => {
    if (!requireAccount()) return false;
    try {
      setCart(await accountApi.removeFromCart(productId));
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể xóa sản phẩm khỏi giỏ hàng.');
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

  const value = useMemo(() => ({ user, authReady, cart, checkoutShipping, checkoutPaymentPin, cartLoading, cartError, favoriteIds, notice, setNotice, setCheckoutShipping, setCheckoutPaymentPin, login, register, logout, refreshCart, addToCart, updateCart, removeFromCart, toggleFavorite, syncChat }), [user, authReady, cart, checkoutShipping, checkoutPaymentPin, cartLoading, cartError, favoriteIds, notice, setNotice, setCheckoutShipping, setCheckoutPaymentPin, login, register, logout, refreshCart, addToCart, updateCart, removeFromCart, toggleFavorite, syncChat]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider');
  return value;
}
