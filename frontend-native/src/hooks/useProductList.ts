import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { productApi } from '../api';
import { productPageCount } from '../productPagination.mjs';
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

export function useProductList(pageSize = 12) {
  const router = useRouter();
  const params = useLocalSearchParams<{ keyword?: string | string[]; category?: string | string[] }>();
  const keyword = first(params.keyword).trim();
  const category = first(params.category).trim();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
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
    setPage(1);
  }, [category, keyword, pageSize, priceRange, sort]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const range = priceRange === '' ? undefined : PRICE_RANGES[Number(priceRange)];
    void productApi.page({
      page,
      limit: pageSize,
      keyword: keyword || undefined,
      category: category || undefined,
      sort: sort || undefined,
      minPrice: range?.min,
      maxPrice: range?.max ?? undefined,
    }, controller.signal)
      .then(result => {
        const lastPage = productPageCount(result.total, result.limit);
        if (page > lastPage) {
          setProducts([]);
          setTotal(result.total);
          setPage(lastPage);
          return;
        }
        setProducts(result.items);
        setTotal(result.total);
      })
      .catch(reason => {
        if (reason instanceof Error && reason.name === 'AbortError') return;
        setProducts([]);
        setTotal(0);
        setError(reason instanceof Error ? reason.message : 'Không thể tải danh sách sản phẩm.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [category, keyword, page, pageSize, priceRange, retryKey, sort]);

  const pageCount = productPageCount(total, pageSize);

  const updateUrl = (nextKeyword = keyword, nextCategory = category) => {
    const next: Record<string, string> = {};
    if (nextKeyword.trim()) next.keyword = nextKeyword.trim();
    if (nextCategory) next.category = nextCategory;
    router.replace({ pathname: '/products', params: next });
  };

  return {
    category,
    categories,
    clearFilters: () => { setPage(1); setPriceRange(''); setSort(''); updateUrl('', ''); },
    error,
    keyword,
    loading,
    page,
    pageCount,
    priceRange,
    products,
    retry: () => setRetryKey(value => value + 1),
    setCategory: (value: string) => { setPage(1); updateUrl(keyword, value); },
    setKeyword: (value: string) => { setPage(1); updateUrl(value, category); },
    setPage: (value: number) => setPage(Math.min(pageCount, Math.max(1, value))),
    setPriceRange: (value: string) => { setPage(1); setPriceRange(value); },
    setSort: (value: ProductSort) => { setPage(1); setSort(value); },
    sort,
    total,
  };
}
