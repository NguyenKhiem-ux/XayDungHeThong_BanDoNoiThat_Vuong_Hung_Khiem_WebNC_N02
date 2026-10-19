import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, PackageCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { formatVnd, imageUrl } from '../api/client';
import { orderApi, paymentApi } from '../api/services';
import type { Order } from '../api/types';

const labels: Record<Order['status'], string> = {
  PENDING: 'Chờ xử lý',
  CONFIRMED: 'Đã xác nhận',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
};

export function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [cardPin, setCardPin] = useState('');

  useEffect(() => { if (id) orderApi.detail(Number(id)).then(r => setOrder(r.data)).catch(() => setOrder(null)); }, [id]);

  const retryPayment = async () => {
    if (!order || paying) return;
    setPaying(true);
    setPaymentError('');
    try {
      if (order.paymentMethod === 'QR' || order.paymentMethod === 'PAYOS') {
        const { data } = await paymentApi.createPayOSPaymentLink(order.id);
        window.location.assign(data.checkoutUrl);
        return;
      }
      await paymentApi.confirmCardPayment(order.id, cardPin);
      const { data } = await orderApi.detail(order.id);
      setOrder(data);
      setCardPin('');
    } catch (error) {
      setPaymentError((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Chưa thể thanh toán. Vui lòng thử lại.');
    } finally { setPaying(false); }
  };

  if (!order) return <div className="loading-page">Đang tải đơn hàng...</div>;
  const canRetry = order.paymentStatus === 'UNPAID' && order.status !== 'CANCELLED'
    && (order.paymentMethod === 'QR' || order.paymentMethod === 'PAYOS' || order.paymentMethod === 'CARD');

  return <section className="section order-detail"><div className="container">
    <Link to="/orders" className="text-link"><ArrowLeft size={16} /> Quay lại</Link>
    <div className="section-heading"><div><div className="eyebrow">ORDER #{order.id}</div><h1>Chi tiết đơn hàng</h1></div><span className={`status-badge status-${order.status.toLowerCase()}`}>{labels[order.status]}</span></div>
    <div className="detail-grid">
      <div className="card"><h3>Sản phẩm</h3>{order.items.map(item => <div className="product-row" key={item.id}><img src={imageUrl(item.productImage)} alt={item.productName} /><div className="product-info"><h3>{item.productName}</h3><span>{formatVnd(item.price)} × {item.quantity}</span></div><strong>{formatVnd(item.subtotal)}</strong></div>)}<div className="order-price-breakdown"><div><span>Tạm tính</span><strong>{formatVnd(order.subtotalAmount || order.totalAmount)}</strong></div>{order.discountAmount > 0 && <div><span>Voucher {order.couponCode}</span><strong>−{formatVnd(order.discountAmount)}</strong></div>}<div className="order-final-total"><span>Thành tiền</span><strong>{formatVnd(order.totalAmount)}</strong></div></div></div>
      <div className="card"><h3><MapPin size={17} /> Thông tin nhận hàng</h3><p><b>{order.fullName}</b></p><p>{order.phone} • {order.email}</p><p>{order.address}</p><p>Thanh toán: {order.paymentMethod === 'CARD' ? 'Thẻ mô phỏng' : order.paymentMethod}</p><p>Trạng thái thanh toán: {order.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</p>{order.note && <p>Ghi chú: {order.note}</p>}
        {canRetry && (order.paymentMethod === 'CARD'
          ? <div className="order-card-retry"><p>Thanh toán thẻ đang ở chế độ mô phỏng, không thu tiền thật. Nhập PIN 6 số đã tạo trong hồ sơ để thử lại.</p><label htmlFor="retry-card-pin">PIN thanh toán</label><input id="retry-card-pin" type="password" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={cardPin} onChange={event => setCardPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" /><button type="button" className="btn btn-primary" onClick={retryPayment} disabled={paying || cardPin.length !== 6}>{paying ? 'Đang xác minh…' : 'Thanh toán lại bằng thẻ'}</button></div>
          : <button type="button" className="btn btn-primary" onClick={retryPayment} disabled={paying}>{paying ? 'Đang mở thanh toán…' : 'Thanh toán lại bằng QR'}</button>)}
        {paymentError && <p role="alert" style={{ color: '#b42318' }}>{paymentError}</p>}
        <div className="review-band compact"><PackageCheck size={20} /> Đơn hàng đang được xử lý theo trạng thái hiện tại.</div>
      </div>
    </div>
  </div></section>;
}
