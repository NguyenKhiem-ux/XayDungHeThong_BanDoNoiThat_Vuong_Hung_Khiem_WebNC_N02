import { useEffect, type FormEvent } from 'react';
import { Alert, Button, Col, Form, ProgressBar, Row, Spinner } from 'react-bootstrap';
import { useRouter } from 'expo-router';
import { useProductReviews } from '../hooks/useProductReviews';
import type { ReviewSummary } from '../types';

export function ProductReviews({ productId, onChange }: { productId: number; onChange: (summary: ReviewSummary) => void }) {
  const router = useRouter();
  const reviews = useProductReviews(productId, onChange);
  const { busy, chooseFilter, comment, data, error, filter, loading, own, ownError, page, rating, retry, save, saved, saveError, setComment, setPage, setRating, user } = reviews;

  useEffect(() => {
    if (globalThis.location?.hash === '#product-reviews') globalThis.document?.getElementById('product-reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [productId]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save();
  };

  return (
    <section className="gdv-reviews" id="product-reviews" aria-labelledby="reviews-title">
      <div className="gdv-section-heading">
        <div><span>GÓC NHÌN NGƯỜI MUA</span><h2 id="reviews-title">Đánh giá sản phẩm</h2></div>
        <strong>✓ Từ khách đã mua hàng</strong>
      </div>

      {loading && !data ? <div className="gdv-review-loading"><Spinner animation="border" size="sm" /><span>Đang tải đánh giá…</span></div> : data && <Row className="gdv-review-overview g-0">
        <Col md={3} className="gdv-review-score"><div><b>{data.summary.reviewCount ? data.summary.averageRating.toLocaleString('vi-VN') : '0'}</b><span>/5</span></div><Stars value={data.summary.averageRating} /><p>{data.summary.reviewCount} đánh giá đã xác minh</p></Col>
        <Col md={5} className="gdv-review-distribution" aria-label="Số lượt đánh giá theo số sao">{[5, 4, 3, 2, 1].map(stars => <button key={stars} type="button" aria-pressed={filter === stars} onClick={() => chooseFilter(filter === stars ? 0 : stars)}><span>{stars} ★</span><ProgressBar now={data.summary.reviewCount ? (data.summary.ratingCounts[stars] ?? 0) / data.summary.reviewCount * 100 : 0} /><b>{data.summary.ratingCounts[stars] ?? 0}</b></button>)}</Col>
        <Col md={4} className="gdv-review-note"><span className="gdv-note-icon">▢</span><strong>Trải nghiệm thật, lựa chọn tốt hơn</strong><p>Chia sẻ cảm nhận sau khi nhận hàng để giúp những người mua tiếp theo.</p></Col>
      </Row>}

      {!!error && <Alert variant="danger" className="gdv-alert"><span>{error}</span><Button variant="outline-danger" size="sm" onClick={retry}>Thử lại</Button></Alert>}

      {user ? ownError ? <Alert variant="danger" className="gdv-alert">{ownError}<Button variant="outline-danger" size="sm" onClick={retry}>Kiểm tra lại</Button></Alert> : own?.canReview ? <Form className="gdv-review-form" onSubmit={submit}>
        <div><h3>{own.review ? 'Đánh giá của bạn' : 'Chia sẻ đánh giá của bạn'}</h3><p>Mỗi người mua có một đánh giá cho sản phẩm và có thể cập nhật cảm nhận.</p></div>
        <Form.Group className="mb-3"><Form.Label>Chất lượng sản phẩm</Form.Label><div className="gdv-rating-picker" role="radiogroup" aria-label="Chất lượng sản phẩm">{[1, 2, 3, 4, 5].map(stars => <Button key={stars} type="button" disabled={busy} aria-pressed={rating === stars} aria-label={`${stars} sao`} onClick={() => setRating(stars)}>{stars <= rating ? '★' : '☆'}</Button>)}<small>{rating ? `${rating}/5 sao` : 'Chọn số sao'}</small></div></Form.Group>
        <Form.Group><Form.Label htmlFor={`review-comment-${productId}`}>Nhận xét của bạn <span>(không bắt buộc)</span></Form.Label><Form.Control id={`review-comment-${productId}`} as="textarea" rows={3} maxLength={2000} disabled={busy} placeholder="Sản phẩm có đáp ứng mong đợi của bạn?" value={comment} onChange={event => setComment(event.target.value)} /></Form.Group>
        <div className="gdv-review-form-footer"><span>{comment.length}/2000 ký tự · Không chia sẻ số điện thoại, địa chỉ trong đánh giá.</span><Button type="submit" disabled={busy || !rating}>{busy ? 'Đang lưu…' : own.review ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}</Button></div>
        {!!saveError && <Alert variant="danger" className="mt-3 mb-0">{saveError}</Alert>}
      </Form> : own ? <div className="gdv-review-access">✓ Bạn có thể đánh giá sau khi đơn hàng chứa sản phẩm này đã giao và thanh toán. <button type="button" onClick={() => router.push('/orders')}>Xem đơn hàng</button></div> : <div className="gdv-review-access">Đang kiểm tra đơn hàng của bạn…</div> : <div className="gdv-review-access"><button type="button" onClick={() => router.push({ pathname: '/login', params: { redirect: `/products/${productId}` } })}>Đăng nhập</button> để đánh giá sản phẩm bạn đã mua. Đánh giá chỉ mở sau khi giao hàng và thanh toán.</div>}
      {saved && <Alert variant="success" className="gdv-review-saved">✓ Đã lưu đánh giá của bạn.</Alert>}

      {data && <><div className="gdv-review-filters" aria-label="Lọc đánh giá"><Button aria-pressed={!filter} className={!filter ? 'active' : ''} onClick={() => chooseFilter(0)}>Tất cả ({data.summary.reviewCount})</Button>{[5, 4, 3, 2, 1].map(stars => <Button key={stars} aria-pressed={filter === stars} className={filter === stars ? 'active' : ''} onClick={() => chooseFilter(stars)}>{stars} sao ({data.summary.ratingCounts[stars] ?? 0})</Button>)}</div>
        <div className="gdv-review-list" aria-busy={loading}>{data.reviews.length ? data.reviews.map(review => <article key={review.id} className="gdv-review-item"><div className="gdv-review-author"><div aria-hidden="true">{review.author[0]}</div><span><strong>{review.author}</strong><small>✓ Đã mua hàng</small></span><time dateTime={review.updatedAt}>{new Date(review.updatedAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time></div><Stars value={review.rating} />{!!review.comment && <p>{review.comment}</p>}</article>) : <div className="gdv-review-empty"><span>▢</span><h3>{filter ? `Chưa có đánh giá ${filter} sao` : 'Chưa có đánh giá cho sản phẩm này'}</h3><p>Những nhận xét từ người mua sẽ xuất hiện tại đây.</p></div>}</div>
        {data.total > data.pageSize && <nav className="gdv-review-pagination" aria-label="Trang đánh giá"><Button disabled={loading || page === 1} onClick={() => setPage(page - 1)}>← Trước</Button><span>Trang {page}/{Math.ceil(data.total / data.pageSize)}</span><Button disabled={loading || page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Sau →</Button></nav>}
      </>}
    </section>
  );
}

function Stars({ value }: { value: number }) {
  return <span className="gdv-stars" aria-label={`${value.toLocaleString('vi-VN')} trên 5 sao`}>{[1, 2, 3, 4, 5].map(star => <span key={star}>{star <= Math.round(value) ? '★' : '☆'}</span>)}</span>;
}
