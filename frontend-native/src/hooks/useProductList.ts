import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { productApi } from '../api';
import type { Product } from '../types';

export type ProductSort = '' | 'price-asc' | 'price-desc' | 'name';

const first = (value?: string | string[]) => Array.isArray(value) ? value[0] || '' : value || '';

export function useProductList() {
  const router = useRouter();
  const params = useLocalSearchParams<{ keyword?: string | string[]; category?: string | string[] }>();
  const keyword = first(params.keyword).trim();
  const category = first(params.category).trim();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [sort, setSort] = useState<ProductSort>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void productApi.categories(controller.signal).then(setCategories).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void productApi.list(keyword || undefined, category || undefined, controller.signal)
      .then(setProducts)
      .catch(reason => {
        if (reason instanceof Error && reason.name === 'AbortError') return;
        setProducts([]);
        setError(reason instanceof Error ? reason.message : 'Không thể tải danh sách sản phẩm.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [category, keyword, retryKey]);

  const visibleProducts = useMemo(() => [...products].sort((a, b) => sort === 'price-asc'
    ? a.price - b.price
    : sort === 'price-desc'
      ? b.price - a.price
      : sort === 'name'
        ? a.name.localeCompare(b.name, 'vi')
        : 0), [products, sort]);

  const updateUrl = (nextKeyword = keyword, nextCategory = category) => {
    const next: Record<string, string> = {};
    if (nextKeyword.trim()) next.keyword = nextKeyword.trim();
    if (nextCategory) next.category = nextCategory;
    router.replace({ pathname: '/products', params: next });
  };

  return {
    category,
    categories,
    clearFilters: () => updateUrl('', ''),
    error,
    keyword,
    loading,
    products: visibleProducts,
    retry: () => setRetryKey(value => value + 1),
    setCategory: (value: string) => updateUrl(keyword, value),
    setKeyword: (value: string) => updateUrl(value, category),
    setSort,
    sort,
  };
}
