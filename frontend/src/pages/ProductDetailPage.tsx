// file là trang productdetail của giao diện người dùng.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { productApi } from '../api/services';
import { formatVnd, imageUrl } from '../api/client';
import type { Product } from '../api/types';
import { useCart } from '../context/CartContext';
import { FavoriteButton } from '../components/FavoriteButton';

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  useEffect(() => { if (id) productApi.detail(Number(id)).then(r=>setProduct(r.data)).catch(()=>navigate('/products')); }, [id]);
  if (!product) return <div className="loading-page">Đang tải sản phẩm...</div>;
  const soldOut = product.stock <= 0;
  const addCart = async () => { if (!soldOut) { await add(product.id, qty); navigate('/cart'); } };

  return <section className="detail-page section detail-pro">
    <nav className="breadcrumb">
      <Link to="/">Trang chủ</Link><i className="fa-solid fa-chevron-right" />
      <Link to="/products">Sản phẩm</Link><i className="fa-solid fa-chevron-right" /><span>{product.name}</span>
    </nav>
    <div className="detail-grid detail-pro-grid">
      <div className="detail-media-wrap reveal-left">
        <div className="detail-media">
          {product.imageUrl ? <img src={imageUrl(product.imageUrl)} alt={product.name} onError={e=>{e.currentTarget.style.display='none'; const n=e.currentTarget.nextElementSibling as HTMLElement|null;if(n)n.style.display='flex';}}/>:null}
          <div className="detail-fallback" style={{display:product.imageUrl?'none':'flex'}}><i className="fa-solid fa-house-code" /></div>
          {product.isFeatured && <span className="badge">Nổi bật</span>}
        </div>
        <div className="detail-mini-strip">
          <span><i className="fa-solid fa-box-open" /> Kiểm hàng</span>
          <span><i className="fa-solid fa-screwdriver-wrench" /> Tư vấn sử dụng</span>
          <span><i className="fa-solid fa-headset" /> Tư vấn nhanh</span>
        </div>
      </div>
      <div className="detail-info reveal-right">
        <div className="detail-heading">
          <span className="product-category">{product.category || 'Gia dụng'}</span>
          <h1>{product.name}</h1>
          <FavoriteButton productId={product.id} className="detail-favorite-button" />
          {product.brand && <p className="detail-brand">Thương hiệu: <strong>{product.brand}</strong></p>}
        </div>
        <div className="price-stock-row">
          <strong className="detail-price">{formatVnd(product.price)}</strong>
          {!soldOut ? <p className="stock ok"><i className="fa-solid fa-circle-check" /> Còn {product.stock}</p> : <p className="stock out"><i className="fa-solid fa-circle-xmark" /> Hết hàng</p>}
        </div>
        {product.description && <p className="detail-desc">{product.description}</p>}
        {!soldOut && <div className="buy-box">
          <div className="buy-row"><label>Số lượng</label><div className="qty-control">
            <button type="button" className="qty-btn" onClick={()=>setQty(Math.max(1,qty-1))}>-</button>
            <input className="qty-input" type="number" min={1} max={product.stock} value={qty} onChange={e=>setQty(Math.max(1,Math.min(product.stock,Number(e.target.value)||1)))} />
            <button type="button" className="qty-btn" onClick={()=>setQty(Math.min(product.stock,qty+1))}>+</button>
          </div></div>
          <button type="button" className="btn btn-primary btn-wide" onClick={addCart}><i className="fa-solid fa-cart-plus" /> Thêm vào giỏ hàng</button>
        </div>}
        <div className="trust-grid">
          <span><i className="fa-solid fa-shield-halved" /> Bảo hành 12-24 tháng</span>
          <span><i className="fa-solid fa-truck-fast" /> Giao nhanh toàn quốc</span>
          <span><i className="fa-solid fa-rotate-left" /> Đổi trả 7 ngày</span>
          <span><i className="fa-solid fa-certificate" /> Chính hãng 100%</span>
        </div>
      </div>
    </div>
    {product.specifications && <div className="spec-card reveal"><div><span className="product-category">Specifications</span><h2>Thông số kỹ thuật</h2></div><p>{product.specifications}</p></div>}
  </section>;
}
