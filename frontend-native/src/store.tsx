import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { accountApi, ApiError, authApi, clearToken, getToken, saveToken, type RegisterInput } from './api';
import { addFavorite as addFavoriteToList, favoriteIds as getFavoriteIds, removeFavorite as removeFavoriteFromList } from './favorites.mjs';
import type { Cart, ChatResponse, CheckoutShipping, Favorite, User } from './types';

interface PasswordResetState {
  email: string;
  expiresAt: string;
  otp: string;
}

interface StoreValue {
  user: User | null;
  authReady: boolean;
  cart: Cart | null;
  checkoutShipping: CheckoutShipping | null;
  checkoutCouponCode: string;
  checkoutPaymentPin: string;
  passwordReset: PasswordResetState | null;
  cartLoading: boolean;
  cartError: string;
  favorites: Favorite[];
  favoriteIds: number[];
  favoritesLoading: boolean;
  favoritesError: string;
  notice: string;
  setNotice: (message: string) => void;
  refreshUser: () => Promise<User | null>;
  setCheckoutShipping: (shipping: CheckoutShipping | null) => void;
  setCheckoutCouponCode: (code: string) => void;
  setCheckoutPaymentPin: (pin: string) => void;
  setPasswordReset: (state: PasswordResetState | null) => void;
  login: (usernameOrEmail: string, password: string) => Promise<User>;
  register: (data: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  refreshCart: () => Promise<void>;
  refreshFavorites: () => Promise<void>;
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
  const [checkoutCouponCode, setCheckoutCouponCode] = useState('');
  const [checkoutPaymentPin, setCheckoutPaymentPin] = useState('');
  const [passwordReset, setPasswordReset] = useState<PasswordResetState | null>(null);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState('');
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState('');
  const [notice, setNoticeState] = useState('');
  const accountDataVersion = useRef(0);
  const favoriteMutations = useRef(new Set<number>());
  const favoriteIds = useMemo(() => getFavoriteIds(favorites), [favorites]);

  const setNotice = useCallback((message: string) => {
    setNoticeState(message);
    setTimeout(() => setNoticeState(''), 2600);
  }, []);

  const refreshFavorites = useCallback(async () => {
    const version = accountDataVersion.current;
    setFavoritesLoading(true);
    setFavoritesError('');
    try {
      const result = await accountApi.favorites();
      if (version === accountDataVersion.current) setFavorites(result);
    } catch (error) {
      if (version === accountDataVersion.current) setFavoritesError(error instanceof Error ? error.message : 'Không thể tải sản phẩm yêu thích.');
    } finally {
      if (version === accountDataVersion.current) setFavoritesLoading(false);
    }
  }, []);

  const loadAccountData = useCallback(async () => {
    const version = accountDataVersion.current;
    setCartLoading(true);
    setCartError('');
    const [cartResult] = await Promise.allSettled([accountApi.cart(), refreshFavorites()]);
    if (version !== accountDataVersion.current) return;
    if (cartResult.status === 'fulfilled') setCart(cartResult.value);
    else setCartError(cartResult.reason instanceof Error ? cartResult.reason.message : 'Không thể tải giỏ hàng.');
    setCartLoading(false);
  }, [refreshFavorites]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!await getToken()) return;
        const account = await accountApi.me();
        if (!active) return;
        accountDataVersion.current++;
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
    accountDataVersion.current++;
    setPasswordReset(null);
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
    accountDataVersion.current++;
    await clearToken();
    setUser(null);
    setCart(null);
    setCheckoutShipping(null);
    setCheckoutCouponCode('');
    setCheckoutPaymentPin('');
    setPasswordReset(null);
    setCartError('');
    setCartLoading(false);
    setFavorites([]);
    setFavoritesError('');
    setFavoritesLoading(false);
    setNotice('Đã đăng xuất.');
  }, [setNotice]);

  const refreshUser = useCallback(async () => {
    if (!user) return null;
    const account = await accountApi.me();
    setUser(account);
    return account;
  }, [user]);

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
    if (favoriteMutations.current.has(productId)) return false;
    const version = accountDataVersion.current;
    const saved = favoriteIds.includes(productId);
    favoriteMutations.current.add(productId);
    try {
      if (saved) {
        await accountApi.removeFavorite(productId);
        if (version !== accountDataVersion.current) return false;
        setFavorites(current => removeFavoriteFromList(current, productId));
      } else {
        const favorite = await accountApi.addFavorite(productId);
        if (version !== accountDataVersion.current) return false;
        setFavorites(current => addFavoriteToList(current, favorite));
      }
      setNotice(saved ? 'Đã xóa khỏi yêu thích.' : 'Đã thêm vào yêu thích.');
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể cập nhật yêu thích.');
      return false;
    } finally {
      favoriteMutations.current.delete(productId);
    }
  }, [favoriteIds, requireAccount, setNotice]);

  const syncChat = useCallback((response: ChatResponse) => {
    if (response.cart) setCart(response.cart);
    if (response.favorites) setFavorites(response.favorites);
  }, []);

  const value = useMemo(() => ({ user, authReady, cart, checkoutShipping, checkoutCouponCode, checkoutPaymentPin, passwordReset, cartLoading, cartError, favorites, favoriteIds, favoritesLoading, favoritesError, notice, setNotice, refreshUser, setCheckoutShipping, setCheckoutCouponCode, setCheckoutPaymentPin, setPasswordReset, login, register, logout, refreshCart, refreshFavorites, addToCart, updateCart, removeFromCart, toggleFavorite, syncChat }), [user, authReady, cart, checkoutShipping, checkoutCouponCode, checkoutPaymentPin, passwordReset, cartLoading, cartError, favorites, favoriteIds, favoritesLoading, favoritesError, notice, setNotice, refreshUser, setCheckoutShipping, setCheckoutCouponCode, setCheckoutPaymentPin, login, register, logout, refreshCart, refreshFavorites, addToCart, updateCart, removeFromCart, toggleFavorite, syncChat]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider');
  return value;
}
