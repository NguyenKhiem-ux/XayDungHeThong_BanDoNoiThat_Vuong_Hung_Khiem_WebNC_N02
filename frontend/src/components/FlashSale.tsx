import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Clock3, Flame, RotateCw, Zap } from 'lucide-react';
import type { PromotionEvent } from '../api/types';
import { usePromotion } from '../hooks/usePromotion';
import { ProductCard, ProductCardSkeleton } from './ProductCard';

export function FlashCountdown({ endsAt, clock }: { endsAt: string; clock: { serverTime: string; receivedAt: number } }) {
  const remaining = () => Math.max(0, Math.ceil((Date.parse(endsAt) - Date.parse(clock.serverTime) - (performance.now() - clock.receivedAt)) / 1000));
  const [seconds, setSeconds] = useState(remaining);
  useEffect(() => { setSeconds(remaining()); const timer = window.setInterval(() => setSeconds(remaining()), 1000); return () => window.clearInterval(timer); }, [endsAt, clock]);
  const days = Math.floor(seconds / 86400);
  const units = [[Math.floor(seconds % 86400 / 3600), 'giờ'], [Math.floor(seconds % 3600 / 60), 'phút'], [seconds % 60, 'giây']] as const;
  return <div className="flash-clock"><span className="flash-clock-label"><Clock3 size={15} /> {seconds ? 'Kết thúc sau' : 'Đã kết thúc'}</span>
    <div className="flash-clock-digits" role="timer" aria-label={`${days} ngày ${units[0][0]} giờ ${units[1][0]} phút ${units[2][0]} giây`}>
      {days > 0 && <span className="flash-clock-days">{days} ngày</span>}
      {units.map(([value, label]) => <span className="flash-clock-unit" key={label}><b>{String(value).padStart(2, '0')}</b><small>{label}</small></span>)}
    </div></div>;
}

export function FlashSaleView({ event, clock, preview = false, all = false }: { event: PromotionEvent; clock: { serverTime: string; receivedAt: number }; preview?: boolean; all?: boolean }) {
  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(0), [event.id]);
  const start = Math.min(offset, Math.max(0, event.products.length - 4));
  const percent = event.displayDiscountPercent ?? Math.min(event.bannerDiscountPercent ?? event.maxDiscountPercent, event.maxDiscountPercent);
  const titleWords = (event.title || 'Tên sự kiện').trim().split(/\s+/);
  return <section className={`flash-sale${preview ? ' flash-preview' : ''}`} aria-label={preview ? 'Xem trước sự kiện ưu đãi' : event.title}>
    <div className="flash-banner">
      <div className="flash-banner-copy"><span className="flash-banner-kicker"><Zap size={27} fill="currentColor" /> FLASH SALE</span><h2><span>{titleWords.slice(0, 2).join(' ')}</span>{titleWords.length > 2 && <> <strong>{titleWords.slice(2).join(' ')}</strong></>}</h2>{event.description && <p>{event.description}</p>}<span className="flash-banner-brand">GIA DỤNG VIỆT</span></div>
      <div className="flash-banner-offer">{percent > 0 && <><span>Giảm đến</span><strong>{percent}<sup>%</sup></strong></>}<small>Ưu đãi có thời hạn</small></div>
    </div>
    <div className="flash-sale-panel">
    <div className="flash-heading">
      <h3><Flame size={29} fill="currentColor" /> SẢN PHẨM GIẢM GIÁ</h3>
      <FlashCountdown endsAt={event.endsAt} clock={clock} />
      {!preview && !all && <Link className="flash-view-all" to="/offers">Xem tất cả ưu đãi <ArrowRight size={17} /></Link>}
    </div>
    {event.products.length ? <div className="flash-products-track">
      {!all && event.products.length > 4 && <button type="button" className="flash-carousel-prev" aria-label="Sản phẩm ưu đãi trước" disabled={!start} onClick={() => setOffset(Math.max(0, start - 4))}><ChevronLeft size={23} /></button>}
      <div className="flash-grid">{(all ? event.products : event.products.slice(start, start + 4)).map((product, index) => <ProductCard key={product.id} product={product} index={index} home deal preview={preview} />)}</div>
      {!all && event.products.length > 4 && <button type="button" className="flash-carousel-next" aria-label="Sản phẩm ưu đãi tiếp theo" disabled={start + 4 >= event.products.length} onClick={() => setOffset(Math.min(event.products.length - 4, start + 4))}><ChevronRight size={23} /></button>}
    </div>
      : <div className="flash-empty" role="status"><Zap size={26} aria-hidden="true" /><h3>{preview ? 'Chọn sản phẩm còn hàng để xem trước' : 'Các sản phẩm ưu đãi đã hết hàng'}</h3><p>{preview ? 'Giá và hình ảnh sẽ hiển thị từ danh mục thật của cửa hàng.' : 'Bạn có thể khám phá thêm các sản phẩm khác trong cửa hàng.'}</p>{!preview && <Link to="/products" className="btn btn-outline">Khám phá sản phẩm <ArrowRight size={16} /></Link>}</div>}
    <div className="flash-footer"><span>Ưu đãi tự kết thúc theo lịch. Mã giảm giá chỉ áp dụng cho hàng không sale.</span>{!all && event.products.length > 4 && <span>{start + 1}–{Math.min(start + 4, event.products.length)} / {event.products.length} sản phẩm</span>}</div>
    </div>
  </section>;
}

export function FlashSale({ all = false }: { all?: boolean }) {
  const { event, clock, loading, error, retry } = usePromotion();
  if (loading) return <section className="flash-sale flash-loading" role="status" aria-label="Đang tải ưu đãi" aria-busy="true"><div className="flash-heading-skeleton" /><div className="flash-grid">{Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}</div></section>;
  if (error) return <section className="flash-sale flash-error" role="alert"><div><h2>Chưa thể tải ưu đãi</h2><p>Vui lòng thử lại để xem giá mới nhất từ cửa hàng.</p></div><button type="button" className="btn btn-outline" onClick={retry}><RotateCw size={16} /> Thử lại</button></section>;
  if (!event) return all ? <section className="section"><div className="empty-state"><Zap size={32} /><h1>Chưa có sự kiện đang diễn ra</h1><p>Khám phá danh mục và quay lại để cập nhật ưu đãi mới.</p><Link to="/products" className="btn btn-primary">Xem sản phẩm</Link></div></section> : null;
  return <FlashSaleView event={event} clock={clock} all={all} />;
}
