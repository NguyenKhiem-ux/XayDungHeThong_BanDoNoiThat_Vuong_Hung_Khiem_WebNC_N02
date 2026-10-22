import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, ChevronLeft, ChevronRight, MessageSquare, RotateCw, Star } from 'lucide-react';
import { reviewApi } from '../api/services';
import type { OwnReview, ReviewPage, ReviewSummary } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { RatingStars } from './ProductRating';

const errorMessage = (error: unknown) => {
  const message = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join(' · ') : message || 'Chưa thể tải đánh giá. Vui lòng thử lại.';
};

export function ProductReviews({ productId, onChange }: { productId: number; onChange: (summary: ReviewSummary) => void }) {
  const { user } = useAuth();
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const [data, setData] = useState<ReviewPage | null>(null);
  const [own, setOwn] = useState<OwnReview | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [filter, setFilter] = useState(0);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ownError, setOwnError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (window.location.hash === '#product-reviews') document.getElementById('product-reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [productId]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    reviewApi.list(productId, { page, rating: filter || undefined }, controller.signal)
      .then(({ data }) => { if (!controller.signal.aborted) setData(data); })
      .catch(error => { if (!controller.signal.aborted) { setData(null); setError(errorMessage(error)); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [productId, page, filter, revision]);
  useEffect(() => {
    setOwn(null); setRating(0); setComment(''); setOwnError(''); setSaveError(''); setSaved(false);
  }, [productId, user?.id]);
  useEffect(() => {
    const controller = new AbortController(); setOwnError('');
    if (user) reviewApi.mine(productId, controller.signal).then(({ data }) => {
      if (controller.signal.aborted) return;
      setOwn(data); setRating(data.review?.rating ?? 0); setComment(data.review?.comment ?? '');
    }).catch(error => { if (!controller.signal.aborted) setOwnError(errorMessage(error)); });
    return () => controller.abort();
  }, [productId, user?.id, revision]);

  const save = async (event: FormEvent) => {
    event.preventDefault(); if (busy || !rating) return;
    setBusy(true); setSaveError(''); setSaved(false);
    const userId = user?.id;
    try {
      const { data } = await reviewApi.save(productId, { rating, comment });
      if (owner.current !== userId) return;
      setOwn(data); onChange(data.summary); setFilter(0); setPage(1); setRevision(value => value + 1); setSaved(true);
    } catch (error) { setSaveError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const chooseFilter = (value: number) => { setFilter(value); setPage(1); };
  const retry = () => setRevision(value => value + 1);

  return <section className="product-reviews" id="product-reviews" aria-labelledby="reviews-title">
    <div className="reviews-heading"><div><span className="eyebrow">GÓC NHÌN NGƯỜI MUA</span><h2 id="reviews-title">Đánh giá sản phẩm</h2></div><span className="reviews-verified"><BadgeCheck size={17} /> Từ khách đã mua hàng</span></div>
    {loading && !data ? <div className="reviews-skeleton" role="status" aria-label="Đang tải đánh giá"><div /><div /><div /></div> : data && <div className="reviews-overview">
      <div className="reviews-score"><div><strong>{data.summary.reviewCount ? data.summary.averageRating.toLocaleString('vi-VN') : '0'}</strong><span>/ 5</span></div><RatingStars value={data.summary.averageRating} size={23} /><p>{data.summary.reviewCount} đánh giá đã xác minh</p></div>
      <div className="reviews-distribution" aria-label="Số lượt đánh giá theo số sao">{[5, 4, 3, 2, 1].map(stars => <button key={stars} type="button" aria-pressed={filter === stars} onClick={() => chooseFilter(filter === stars ? 0 : stars)}><span>{stars} <Star size={13} fill="currentColor" /></span><span className="review-bar"><span style={{ width: `${data.summary.reviewCount ? data.summary.ratingCounts[stars] / data.summary.reviewCount * 100 : 0}%` }} /></span><b>{data.summary.ratingCounts[stars] ?? 0}</b></button>)}</div>
      <div className="reviews-overview-note"><MessageSquare size={27} /><strong>Trải nghiệm thật, lựa chọn tốt hơn</strong><p>Chia sẻ cảm nhận sau khi nhận hàng để giúp những người mua tiếp theo.</p></div>
    </div>}
    {error && <div className="reviews-error" role="alert"><span>{error}</span><button type="button" onClick={retry}><RotateCw size={15} /> Thử lại</button></div>}

    {user ? ownError ? <div className="reviews-error" role="alert">{ownError}<button type="button" onClick={retry}>Kiểm tra lại</button></div> : own?.canReview ? <form className="review-form" onSubmit={save}>
      <div><h3>{own.review ? 'Đánh giá của bạn' : 'Chia sẻ đánh giá của bạn'}</h3><p>Mỗi người mua có một đánh giá cho sản phẩm và có thể cập nhật cảm nhận.</p></div>
      <fieldset className="review-rating-picker" disabled={busy}><legend>Chất lượng sản phẩm</legend>{[1, 2, 3, 4, 5].map(stars => <label key={stars}><input type="radio" name={`review-rating-${productId}`} value={stars} checked={rating === stars} onChange={() => setRating(stars)} required /><span><Star size={26} fill={stars <= rating ? 'currentColor' : 'none'} /><span className="sr-only">{stars} sao</span></span></label>)}<small>{rating ? `${rating}/5 sao` : 'Chọn số sao'}</small></fieldset>
      <label className="review-comment-label" htmlFor={`review-comment-${productId}`}>Nhận xét của bạn <span>(không bắt buộc)</span></label><textarea id={`review-comment-${productId}`} rows={3} maxLength={2000} disabled={busy} placeholder="Sản phẩm có đáp ứng mong đợi của bạn?" value={comment} onChange={event => setComment(event.target.value)} />
      <div className="review-form-footer"><span>{comment.length}/2000 ký tự · Không chia sẻ số điện thoại, địa chỉ trong đánh giá.</span><button type="submit" className="btn btn-primary" disabled={busy || !rating}>{busy ? 'Đang lưu…' : own.review ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}</button></div>
      {saveError && <p className="reviews-error" role="alert">{saveError}</p>}
    </form> : own ? <p className="review-access-note"><BadgeCheck size={18} /> Bạn có thể đánh giá sau khi đơn hàng chứa sản phẩm này đã giao và thanh toán. <Link to="/orders">Xem đơn hàng</Link></p>
      : <p className="review-access-note">Đang kiểm tra đơn hàng của bạn…</p> : <p className="review-access-note"><Link to="/login">Đăng nhập</Link> để đánh giá sản phẩm bạn đã mua. Đánh giá chỉ mở sau khi giao hàng và thanh toán.</p>}
    {saved && <p className="review-saved" role="status"><BadgeCheck size={17} /> Đã lưu đánh giá của bạn.</p>}

    {data && <><div className="reviews-filters" aria-label="Lọc đánh giá"><button type="button" aria-pressed={!filter} onClick={() => chooseFilter(0)}>Tất cả ({data.summary.reviewCount})</button>{[5, 4, 3, 2, 1].map(stars => <button key={stars} type="button" aria-pressed={filter === stars} onClick={() => chooseFilter(stars)}>{stars} sao ({data.summary.ratingCounts[stars] ?? 0})</button>)}</div>
      <div className="reviews-list" aria-busy={loading}>{data.reviews.length ? data.reviews.map(review => <article className="review-item" key={review.id}><div className="review-item-top"><div className="review-avatar" aria-hidden="true">{review.author[0]}</div><div><strong>{review.author}</strong><span><BadgeCheck size={13} /> Đã mua hàng</span></div><time dateTime={review.updatedAt}>{new Date(review.updatedAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time></div><RatingStars value={review.rating} size={16} />{review.comment && <p>{review.comment}</p>}</article>) : <div className="reviews-empty"><MessageSquare size={27} /><h3>{filter ? `Chưa có đánh giá ${filter} sao` : 'Chưa có đánh giá cho sản phẩm này'}</h3><p>Những nhận xét từ người mua sẽ xuất hiện tại đây.</p></div>}</div>
      {data.total > data.pageSize && <nav className="reviews-pagination" aria-label="Trang đánh giá"><button type="button" disabled={loading || page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /> Trước</button><span>Trang {page}/{Math.ceil(data.total / data.pageSize)}</span><button type="button" disabled={loading || page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Sau <ChevronRight size={16} /></button></nav>}
    </>}
  </section>;
}
