// file chứa mã nguồn phục vụ chức năng CartContext của dự án.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cartApi } from '../api/services';
import type { Cart } from '../api/types';
import { useAuth } from './AuthContext';

interface CartContextValue {
  cart: Cart | null;
  loading: boolean;
  refresh: () => Promise<void>;
  add: (productId: number, quantity?: number) => Promise<void>;
  update: (productId: number, quantity: number) => Promise<void>;
  remove: (productId: number) => Promise<void>;
  clear: () => Promise<void>;
  sync: (cart: Cart) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<{ userId: number; cart: Cart } | null>(null);
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const cart = snapshot?.userId === user?.id ? snapshot?.cart ?? null : null;
  const sync = (next: Cart) => { if (user && owner.current === user.id) setSnapshot({ userId: user.id, cart: next }); };
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!user) { setSnapshot(null); return; }
    setLoading(true);
    try { sync((await cartApi.get()).data); } finally { if (owner.current === user.id) setLoading(false); }
  };
  useEffect(() => { setLoading(false); void refresh().catch(() => {}); }, [user?.id]);

  const value = useMemo<CartContextValue>(() => ({
    cart, loading, refresh, sync,
    async add(productId, quantity = 1) { sync((await cartApi.add(productId, quantity)).data); },
    async update(productId, quantity) { sync((await cartApi.update(productId, quantity)).data); },
    async remove(productId) { sync((await cartApi.remove(productId)).data); },
    async clear() { sync((await cartApi.clear()).data); },
  }), [cart, loading, user?.id]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
