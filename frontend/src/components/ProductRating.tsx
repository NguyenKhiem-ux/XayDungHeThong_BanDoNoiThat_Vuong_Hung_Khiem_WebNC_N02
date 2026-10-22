import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import type { Product } from '../api/types';

export function RatingStars({ value, size = 14 }: { value: number; size?: number }) {
  return <span className="rating-stars" aria-hidden="true">{[0, 1, 2, 3, 4].map(index => <span className="rating-star" key={index} style={{ width: size, height: size }}>
    <Star size={size} className="rating-star-base" /><span className="rating-star-fill" style={{ width: `${Math.min(1, Math.max(0, value - index)) * 100}%` }}><Star size={size} /></span>
  </span>)}</span>;
}

export function ProductRating({ product, preview = false }: { product: Pick<Product, 'id' | 'averageRating' | 'reviewCount'>; preview?: boolean }) {
  const count = product.reviewCount ?? 0, average = product.averageRating ?? 0;
  return <Link to={`/products/${product.id}#product-reviews`} className="product-rating" onClick={preview ? event => event.preventDefault() : undefined} tabIndex={preview ? -1 : undefined}
    aria-label={count ? `${average} trên 5 sao, ${count} đánh giá. Xem đánh giá sản phẩm` : 'Chưa có đánh giá. Xem đánh giá sản phẩm'}>
    <RatingStars value={average} /><span>({count})</span>
  </Link>;
}
