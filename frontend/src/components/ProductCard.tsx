// file hiển thị thông tin một sản phẩm dưới dạng thẻ trong giao diện.
import { Link } from 'react-router-dom';
import { imageUrl, formatVnd } from '../api/client';
import type { Product } from '../api/types';
import { useCart } from '../context/CartContext';
import { FavoriteButton } from './FavoriteButton';

export function ProductCard({ product, home = false, index = 0 }: { product: Product; home?: boolean; index?: number }) {
  const { add } = useCart();
  const soldOut = product.stock <= 0;
  const handleAdd = async () => {
    try {
      await add(product.id);
      window.dispatchEvent(new CustomEvent('toast', { detail: 'Đã thêm vào giỏ hàng' }));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('toast', { detail: e instanceof Error ? e.message : 'Không thể thêm sản phẩm' }));
    }
  };

  return <article className="product-card reveal" style={{ '--delay': `${index * (home ? 70 : 55)}ms` } as React.CSSProperties}>
    <Link to={`/products/${product.id}`} className="product-media">
      {product.imageUrl ? <img src={imageUrl(product.imageUrl)} alt={product.name} loading="lazy"
        onError={e => { e.currentTarget.style.display = 'none'; const n = e.currentTarget.nextElementSibling as HTMLElement | null; if (n) n.style.display = 'flex'; }} /> : null}
      <div className="product-fallback" style={{ display: product.imageUrl ? 'none' : 'flex' }}><i className="fa-solid fa-bowl-food" /></div>
      {product.isFeatured && <span className="badge">Nổi bật</span>}
      {!product.isFeatured && soldOut && <span className="badge muted">Hết hàng</span>}
    </Link>
    <FavoriteButton productId={product.id} className="product-favorite-button" />
    <div className="product-info">
      <span className="product-category">{product.category || 'Gia dụng'}</span>
      <h3><Link to={`/products/${product.id}`}>{product.name}</Link></h3>
      <div className="product-row"><strong>{formatVnd(product.price)}</strong><span>{soldOut ? 'Hết hàng' : `Còn ${product.stock}`}</span></div>
      {home ? (
        <button type="button" className="btn btn-small btn-primary" disabled={soldOut} onClick={handleAdd}>
          <i className="fa-solid fa-cart-plus" /> {soldOut ? 'Hết hàng' : 'Thêm giỏ'}
        </button>
      ) : (
        <Link to={`/products/${product.id}`} className="btn btn-small btn-primary"><i className="fa-solid fa-eye" /> Xem chi tiết</Link>
      )}
    </div>
  </article>;
}

export function ProductCardSkeleton() {
  return <div className="product-card product-skeleton" aria-hidden="true"><div className="product-media" /><div className="product-info"><span /><span /><span /><span /></div></div>;
}
