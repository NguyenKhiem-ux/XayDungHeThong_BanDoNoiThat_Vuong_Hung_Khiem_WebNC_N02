// file là trang cart của giao diện người dùng.
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { formatVnd, imageUrl } from '../api/client';
import { useCart } from '../context/CartContext';
import { ProductPrice } from '../components/ProductPrice';

export function CartPage(){
 const {cart,loading,update,remove}=useCart(); const navigate=useNavigate();
 if(loading&&!cart)return <div className="loading-page">Đang tải giỏ hàng...</div>;
 return <>
  <section className="page-hero compact"><span className="eyebrow dark">Shopping cart</span><h1>Giỏ hàng của bạn</h1><p>Kiểm tra sản phẩm, cập nhật số lượng và tiến hành thanh toán.</p></section>
  <section className="section cart-layout">
   {cart?.items?.length ? <div className="cart-panel reveal-left">{cart.items.map(item=><div className="cart-row" key={item.id}>
    <Link className="cart-thumb" to={`/products/${item.product.id}`}>{item.product.imageUrl?<img src={imageUrl(item.product.imageUrl)} alt={item.product.name}/>:<i className="fa-solid fa-house"/>}</Link>
    <div><p className="cart-name">{item.product.name}</p><span className="product-category">{item.product.category}</span><ProductPrice product={item.product} /></div>
    <div className="qty-control"><button className="qty-btn" onClick={()=>update(item.productId,Math.max(1,item.quantity-1))}>-</button><input className="qty-input" value={item.quantity} min={1} onChange={e=>update(item.productId,Math.max(1,Number(e.target.value)||1))}/><button className="qty-btn" onClick={()=>update(item.productId,item.quantity+1)}>+</button></div>
    <button className="icon-btn" onClick={()=>remove(item.productId)} aria-label="Xóa sản phẩm"><i className="fa-solid fa-trash"/></button>
   </div>)}</div>:
   <div className="empty-state reveal-left"><i className="fa-solid fa-bag-shopping"/><h2>Giỏ hàng đang trống</h2><p>Chọn một vài sản phẩm gia dụng yêu thích rồi quay lại đây nhé.</p><Link to="/products" className="btn btn-primary">Mua sắm ngay</Link></div>}
   <aside className="cart-summary reveal-right"><h2>Tóm tắt đơn hàng</h2><div className="summary-line"><span>Số lượng</span><strong>{cart?.itemCount||0}</strong></div><div className="summary-line summary-total"><span>Tổng cộng</span><strong>{formatVnd(cart?.total||0)}</strong></div><button className="btn btn-primary btn-wide" style={{marginTop:18}} disabled={!cart?.items?.length} onClick={()=>navigate('/checkout/info')}>Thanh toán</button><Link to="/products" className="btn btn-light btn-wide" style={{marginTop:10}}>Tiếp tục mua</Link></aside>
  </section>
 </>;
}
