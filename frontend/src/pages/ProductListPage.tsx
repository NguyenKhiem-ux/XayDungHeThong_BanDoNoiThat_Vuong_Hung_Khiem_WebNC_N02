// file là trang productlist của giao diện người dùng.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { productApi } from '../api/services';
import type { ProductPage, ProductSort } from '../api/types';
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard';
import { usePriceRevision } from '../hooks/usePriceRevision';

const PAGE_SIZE = 12;
const SORTS: ProductSort[] = ['price-asc', 'price-desc', 'name'];

const quickPriceRanges = [
  { label: 'Dưới 5 triệu', min: 0, max: 5_000_000 },
  { label: '5 – 15 triệu', min: 5_000_000, max: 15_000_000 },
  { label: '15 – 25 triệu', min: 15_000_000, max: 25_000_000 },
  { label: '25 – 35 triệu', min: 25_000_000, max: 35_000_000 },
  { label: '35 – 45 triệu', min: 35_000_000, max: 45_000_000 },
  { label: '45 – 60 triệu', min: 45_000_000, max: 60_000_000 },
  { label: '60 – 80 triệu', min: 60_000_000, max: 80_000_000 },
  { label: 'Từ 80 triệu trở lên', min: 80_000_000, max: null },
];

// Trang hiện tại và các trang lân cận, thêm trang đầu/cuối; null là dấu "…".
function pageNumbers(current: number, last: number) {
  const pages = [...new Set([1, current - 1, current, current + 1, last])].filter(p => p >= 1 && p <= last).sort((a, b) => a - b);
  return pages.flatMap((p, i) => i && p - pages[i - 1] > 1 ? [null, p] : [p]);
}

export function ProductListPage() {
  const priceRevision = usePriceRevision();
  // Toàn bộ bộ lọc nằm trên URL nên tải lại trang hoặc chia sẻ link vẫn giữ nguyên.
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<ProductPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const keyword = params.get('keyword') || undefined;
  const category = params.get('category') || undefined;
  const pricePreset = quickPriceRanges[Number(params.get('price'))] ? params.get('price')! : '';
  const range = pricePreset ? quickPriceRanges[Number(pricePreset)] : null;
  const sort = SORTS.find(value => value === params.get('sort')) ?? '';
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1);
  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) if (value) next.set(key, value); else next.delete(key);
    // Đổi bộ lọc thì quay về trang 1; chỉ giữ số trang khi chính nó được đổi.
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };
  const goToPage = (target: number) => {
    update({ page: target > 1 ? String(target) : null });
    document.querySelector('.shop-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    productApi.page({ keyword, category, page, limit: PAGE_SIZE, sort: sort || undefined, minPrice: range?.min, maxPrice: range?.max ?? undefined }, controller.signal)
      .then(r => setData(r.data))
      .catch(() => { if (!controller.signal.aborted) { setData(null); setFailed(true); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [keyword, category, page, sort, range?.min, range?.max, retry, priceRevision]);

  return <>
    <section className="page-hero compact">
      <nav className="breadcrumb" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><span>Sản phẩm</span></nav>
      <h1>{keyword ? <>Kết quả cho “{keyword}”</> : category || 'Tất cả sản phẩm'}</h1>
      <p>Lọc nhanh nồi cơm điện, máy xay, máy hút bụi và thiết bị gia dụng chính hãng.</p>
    </section>
    <section className="shop-layout section">
      <div className="shop-content">
        <div className="shop-toolbar reveal">
          <span role="status">{loading ? 'Đang tải sản phẩm...' : failed ? 'Chưa thể tải sản phẩm' : <>Tìm thấy <strong>{data?.total ?? 0}</strong> sản phẩm{lastPage > 1 && <> · trang {page}/{lastPage}</>}</>}</span>
          <div className="product-filter-controls">
            <div className="price-filter" aria-label="Lọc sản phẩm theo giá">
              <label htmlFor="price-range-filter">Khoảng giá</label>
              <select id="price-range-filter" className="price-range-select" value={pricePreset} disabled={failed} onChange={(event) => update({ price: event.target.value || null })}>
                <option value="">Tất cả mức giá</option>
                {quickPriceRanges.map((item, index) => <option key={item.label} value={index}>{item.label}</option>)}
              </select>
            </div>
            <div className="product-sort">
              <label htmlFor="sortSelect">Sắp xếp</label>
              <select id="sortSelect" aria-label="Sắp xếp sản phẩm" disabled={failed} value={sort} onChange={(event) => update({ sort: event.target.value || null })}>
                <option value="">Mặc định</option><option value="price-asc">Giá tăng dần</option><option value="price-desc">Giá giảm dần</option><option value="name">Tên A-Z</option>
              </select>
            </div>
          </div>
        </div>
        {loading ? <div className="product-grid" role="status" aria-label="Đang tải sản phẩm" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)}</div> :
          failed ? <div className="empty-state" role="alert"><RotateCw size={32} /><h2>Chưa thể tải sản phẩm</h2><p>Vui lòng kiểm tra kết nối và thử lại.</p><button className="btn btn-primary" onClick={() => setRetry(v => v + 1)}><RotateCw size={16} /> Thử lại</button></div> :
          data?.items.length ? <>
            <div className="product-grid" id="productsGrid">{data.items.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}</div>
            {lastPage > 1 && <nav className="shop-pagination" aria-label="Phân trang sản phẩm">
              <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}><ChevronLeft size={16} /> Trước</button>
              {pageNumbers(page, lastPage).map((p, i) => p === null ? <span key={`gap-${i}`} aria-hidden="true">…</span> :
                <button type="button" key={p} className={p === page ? 'active' : undefined} aria-current={p === page ? 'page' : undefined} onClick={() => goToPage(p)}>{p}</button>)}
              <button type="button" disabled={page >= lastPage} onClick={() => goToPage(page + 1)}>Sau <ChevronRight size={16} /></button>
            </nav>}
          </> :
          page > 1 && data?.total ? <div className="empty-state reveal"><h2>Trang này không có sản phẩm</h2><p>Danh sách đã thay đổi hoặc số trang không hợp lệ.</p><button type="button" className="btn btn-primary" onClick={() => goToPage(1)}>Về trang đầu</button></div> :
          <div className="empty-state reveal"><i className="fa-solid fa-magnifying-glass" /><h2>{range ? 'Không có sản phẩm trong khoảng giá này' : 'Không tìm thấy sản phẩm'}</h2><p>{range ? 'Hãy chọn một khoảng giá khác.' : 'Thử từ khóa khác hoặc quay về toàn bộ sản phẩm.'}</p>{range ? <button type="button" className="btn btn-primary" onClick={() => update({ price: null })}>Xem tất cả mức giá</button> : <Link to="/products" className="btn btn-primary">Xem tất cả</Link>}</div>}
      </div>
    </section>
  </>;
}
