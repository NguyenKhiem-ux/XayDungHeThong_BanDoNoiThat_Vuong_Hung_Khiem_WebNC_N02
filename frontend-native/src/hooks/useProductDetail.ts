import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { productApi } from '../api';
import { useStore } from '../store';
import type { Product, ReviewSummary } from '../types';

export function useProductDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const { addToCart, favoriteIds, notice, setNotice, toggleFavorite, user } = useStore();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const productId = Number(rawId);
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cartBusy, setCartBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!Number.isInteger(productId) || productId <= 0) throw new Error('Sản phẩm không hợp lệ.');
      setProduct(await productApi.detail(productId));
      setQuantity(1);
    } catch (failure) {
      setProduct(null);
      setError(failure instanceof Error ? failure.message : 'Không thể tải thông tin sản phẩm.');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { void load(); }, [load]);

  const requireAccount = useCallback(() => {
    if (user) return true;
    setNotice('Vui lòng đăng nhập để tiếp tục.');
    router.push({ pathname: '/login', params: { redirect: `/products/${productId}` } });
    return false;
  }, [productId, router, setNotice, user]);

  const add = useCallback(async () => {
    if (!product || product.stock <= 0 || cartBusy || !requireAccount()) return;
    setCartBusy(true);
    try {
      await addToCart(product.id, quantity);
    } finally {
      setCartBusy(false);
    }
  }, [addToCart, cartBusy, product, quantity, requireAccount]);

  const toggleSaved = useCallback(async () => {
    if (product && requireAccount()) await toggleFavorite(product.id);
  }, [product, requireAccount, toggleFavorite]);

  const changeQuantity = useCallback((value: number) => {
    if (!product) return;
    setQuantity(Math.max(1, Math.min(product.stock, Number.isFinite(value) ? value : 1)));
  }, [product]);

  const updateSummary = useCallback((summary: ReviewSummary) => {
    setProduct(current => current?.id === productId ? { ...current, ...summary } : current);
  }, [productId]);

  return {
    add,
    cartBusy,
    changeQuantity,
    error,
    favoriteIds,
    load,
    loading,
    notice,
    product,
    productId,
    quantity,
    router,
    toggleSaved,
    updateSummary,
    user,
  };
}
