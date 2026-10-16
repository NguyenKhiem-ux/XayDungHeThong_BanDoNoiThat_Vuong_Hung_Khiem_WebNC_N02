// file chứa mã nguồn phục vụ chức năng AuthContext của dự án.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi, favoriteApi } from '../api/services';
import type { User } from '../api/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  favoriteIds: number[];
  favoritesReady: boolean;
  toggleFavorite: (productId: number) => Promise<void>;
  login: (usernameOrEmail: string, password: string) => Promise<User>;
  register: (data: { fullName: string; username: string; email: string; password: string; phone?: string }) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [favoritesReady, setFavoritesReady] = useState(false);

  useEffect(() => {
    let active = true;
    setFavoriteIds([]);
    setFavoritesReady(!user);
    if (user) favoriteApi.list().then(({ data }) => {
      if (active) setFavoriteIds(data.map(item => item.productId));
    }).catch(() => {}).finally(() => { if (active) setFavoritesReady(true); });
    return () => { active = false; };
  }, [user?.id]);

  const refresh = async () => {
    const token = localStorage.getItem('giadung_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await authApi.me();
      setUser(data);
    } catch {
      localStorage.removeItem('giadung_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    favoriteIds,
    favoritesReady,
    async toggleFavorite(productId) {
      const isSaved = favoriteIds.includes(productId);
      if (isSaved) await favoriteApi.remove(productId);
      else await favoriteApi.add(productId);
      setFavoriteIds(current => isSaved ? current.filter(id => id !== productId) : [...current, productId]);
      window.dispatchEvent(new CustomEvent('favorite-changed'));
    },
    async login(usernameOrEmail, password) {
      const { data } = await authApi.login({ usernameOrEmail, password });
      localStorage.setItem('giadung_token', data.accessToken);
      setUser(data.user);
      setLoading(false);
      return data.user;
    },
    async register(data) {
      const result = await authApi.register(data);
      localStorage.setItem('giadung_token', result.data.accessToken);
      setUser(result.data.user);
      setLoading(false);
      return result.data.user;
    },
    logout() {
      localStorage.removeItem('giadung_token');
      setUser(null);
    },
    refresh,
  }), [user, loading, favoriteIds, favoritesReady]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
