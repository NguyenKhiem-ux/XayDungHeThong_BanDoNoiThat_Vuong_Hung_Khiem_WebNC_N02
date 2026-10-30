import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { productApi } from '../api';
import type { Product } from '../types';

export type ProductSort = '' | 'price-asc' | 'price-desc' | 'name';

// Cùng các mốc với bộ lọc của frontend Vite; lọc theo giá đang bán, lấy cả hai đầu như backend.
export const PRICE_RANGES: Array<{ label: string; min: number; max: number | null }> = [
  { label: 'Dưới 5 triệu', min: 0, max: 5_000_000 },
  { label: '5 – 15 triệu', min: 5_000_000, max: 15_000_000 },
  { label: '15 – 25 triệu', min: 15_000_000, max: 25_000_000 },
  { label: '25 – 35 triệu', min: 25_000_000, max: 35_000_000 },
  { label: '35 – 45 triệu', min: 35_000_000, max: 45_000_000 },
  { label: '45 – 60 triệu', min: 45_000_000, max: 60_000_000 },
  { label: '60 – 80 triệu', min: 60_000_000, max: 80_000_000 },
  { label: 'Từ 80 triệu trở lên', min: 80_000_000, max: null },
];

const first = (value?: string | string[]) => Array.isArray(value) ? value[0] || '' : value || '';

export function useProductList() {
  const router = useRouter();
  const params = useLocalSearchParams<{ keyword?: string | string[]; category?: string | string[] }>();
  const keyword = first(params.keyword).trim();
  const category = first(params.category).trim();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [sort, setSort] = useState<ProductSort>('');
  const [priceRange, setPriceRange] = useState('');
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

  const range = PRICE_RANGES[Number(priceRange)];
  const visibleProducts = useMemo(() => products.filter(product => !priceRange || (product.price >= range.min && (range.max === null || product.price <= range.max))).sort((a, b) => sort === 'price-asc'
    ? a.price - b.price
    : sort === 'price-desc'
      ? b.price - a.price
      : sort === 'name'
        ? a.name.localeCompare(b.name, 'vi')
        : 0), [priceRange, products, range, sort]);

  const updateUrl = (nextKeyword = keyword, nextCategory = category) => {
    const next: Record<string, string> = {};
    if (nextKeyword.trim()) next.keyword = nextKeyword.trim();
    if (nextCategory) next.category = nextCategory;
    router.replace({ pathname: '/products', params: next });
  };

  return {
    category,
    categories,
    clearFilters: () => { setPriceRange(''); updateUrl('', ''); },
    error,
    keyword,
    loading,
    priceRange,
    products: visibleProducts,
    retry: () => setRetryKey(value => value + 1),
    setCategory: (value: string) => updateUrl(keyword, value),
    setKeyword: (value: string) => updateUrl(value, category),
    setPriceRange,
    setSort,
    sort,
  };
}
