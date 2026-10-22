import { useState } from 'react';
import { formatVnd } from '../api/client';
import type { CartItem, ChatAction, ChatCheckoutView } from '../api/types';
import { DemoCardPaymentForm } from './DemoCardPaymentForm';

const stageLabels: Record<ChatCheckoutView['stage'], string> = {
  collecting_items: '1 · Sản phẩm', collecting_address: '2 · Địa chỉ nhận hàng', selecting_voucher: '3 · Voucher',
  selecting_payment: '4 · Thanh toán', awaiting_confirmation: '5 · Kiểm tra & xác nhận', creating_order: 'Đang tạo đơn',
  awaiting_payment: 'Chờ thanh toán', completed: 'Đơn hàng đã tạo', cancelled: 'Đã hủy checkout',
};
const methodLabels = { CASH: 'Tiền mặt khi nhận hàng', QR: 'PayOS / QR', PAYOS: 'PayOS / QR', CARD: 'Thẻ mô phỏng (không thu tiền thật)' };
const orderLabels = { PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy' };

export function ChatCheckoutCards({ flow, disabled, onAction }: { flow: ChatCheckoutView; disabled: boolean; onAction: (action: ChatAction) => void }) {
  const [addressId, setAddressId] = useState(String(flow.addressId ?? flow.addresses[0]?.id ?? ''));
  const [newAddress, setNewAddress] = useState(!flow.addresses.length);
  const [method, setMethod] = useState(flow.paymentMethod ?? 'QR');
  const [code, setCode] = useState(flow.couponCode ?? '');
  const action = (type: ChatAction['type']) => flow.actions.find(item => item.type === type);
  const addressAction = action('checkout_address');
  const voucherAction = action('checkout_voucher');
  const paymentAction = action('checkout_payment');
  const quote = flow.quote;
  const order = flow.order;
  const appliedVoucher = flow.appliedVoucher;
  const paymentUrl = safePaymentUrl(flow.paymentUrl);
  const formTypes = ['checkout_address', 'checkout_payment'];
  return <div className="chat-shopping-summary chat-checkout">
    <div className="chat-checkout-heading"><strong>{stageLabels[flow.stage]}</strong>{!order && <small>Checkout trong chat</small>}</div>
    {!order && appliedVoucher && <p role="status">Đã áp dụng voucher <b>{appliedVoucher.code}</b> · Giảm {formatVnd(appliedVoucher.discountAmount)}</p>}
    {!order && !quote && flow.cart.items.map(item => <CheckoutItem key={`${item.productId}-${item.quantity}`} item={item} actions={flow.actions} disabled={disabled} onAction={onAction} />)}
    {!order && !quote && !!flow.cart.items.length && <>
      <div className="chat-checkout-totals"><div><span>Tạm tính</span><b>{formatVnd(flow.cart.total)}</b></div>{appliedVoucher && <div><span>Voucher {appliedVoucher.code}</span><b>−{formatVnd(appliedVoucher.discountAmount)}</b></div>}</div>
      <div className="chat-total"><span>Tổng sau giảm giá</span><strong>{formatVnd(appliedVoucher?.finalAmount ?? flow.cart.total)}</strong></div>
    </>}
    {addressAction && <div className="chat-checkout-form">
      {!!flow.addresses.length && <><label>Địa chỉ đã lưu<select disabled={disabled || newAddress} value={addressId} onChange={event => setAddressId(event.target.value)}>
        {flow.addresses.map(address => <option key={address.id} value={address.id}>{address.fullName} · {address.phone} · {address.address}{address.isDefault ? ' (Mặc định)' : ''}</option>)}
      </select></label><label className="chat-checkout-choice"><input type="checkbox" checked={newAddress} disabled={disabled} onChange={event => setNewAddress(event.target.checked)} /> Thêm địa chỉ mới</label></>}
      {newAddress ? <form onSubmit={event => {
        event.preventDefault(); const fields = new FormData(event.currentTarget);
        onAction({ ...addressAction, label: 'Lưu và dùng địa chỉ nhận hàng', address: { fullName: String(fields.get('fullName')), phone: String(fields.get('phone')), address: String(fields.get('address')) } });
      }}><label>Người nhận<input name="fullName" autoComplete="name" maxLength={100} required disabled={disabled} /></label>
        <label>Số điện thoại<input name="phone" autoComplete="tel" type="tel" maxLength={15} required disabled={disabled} /></label>
        <label>Địa chỉ giao hàng<textarea name="address" autoComplete="street-address" required maxLength={1000} disabled={disabled} /></label>
        <button type="submit" disabled={disabled}>Lưu và dùng địa chỉ này</button></form>
        : <button type="button" disabled={disabled || !addressId} onClick={() => onAction({ ...addressAction, addressId: Number(addressId) })}>{addressAction.label}</button>}
    </div>}
    {voucherAction && <div className="chat-checkout-form">
      {flow.coupons.map(view => <div className="chat-checkout-voucher" key={view.coupon.id}><div><b>{view.coupon.code}</b><small>{view.eligible ? `Giảm ${formatVnd(view.discountAmount ?? 0)}` : view.reason}</small></div>
        <button type="button" disabled={disabled || !view.eligible} onClick={() => onAction({ ...voucherAction, label: `Áp dụng voucher ${view.coupon.code}`, code: view.coupon.code })}>Áp dụng</button></div>)}
      <form onSubmit={event => { event.preventDefault(); onAction({ ...voucherAction, label: 'Áp dụng voucher đã nhập', code }); }}>
        <label>Mã voucher<input value={code} maxLength={50} disabled={disabled} onChange={event => setCode(event.target.value)} /></label>
        <button type="submit" disabled={disabled || !code.trim()}>Áp dụng mã</button></form>
    </div>}
    {paymentAction && <form className="chat-checkout-form" onSubmit={event => { event.preventDefault(); onAction({ ...paymentAction, paymentMethod: method }); }}>
      {flow.paymentMethods.map(option => <label className="chat-checkout-choice" key={option.value}><input type="radio" name="checkout-method" value={option.value} checked={method === option.value} disabled={disabled} onChange={() => setMethod(option.value)} /><span>{option.label}<small>{option.description}</small></span></label>)}
      <button type="submit" disabled={disabled}>Xem bản tóm tắt cuối cùng</button>
    </form>}
    {quote && !order && <>
      {quote.items.map(item => <div className="chat-cart-line" key={item.productId}><span>{item.name}<small>{item.quantity} × {formatVnd(item.price)}</small></span><strong>{formatVnd(item.subtotal)}</strong></div>)}
      <div className="chat-checkout-recipient"><b>{quote.address.fullName}</b><span>{quote.address.phone} · {quote.email}</span><span>{quote.address.address}</span><span>{methodLabels[quote.paymentMethod]}</span></div>
      <div className="chat-checkout-totals"><div><span>Tạm tính</span><b>{formatVnd(quote.subtotal)}</b></div><div><span>Voucher {quote.couponCode ?? '(không dùng)'}</span><b>−{formatVnd(quote.discountAmount)}</b></div><div><span>Phí giao hàng</span><b>{quote.shippingFee === 0 ? 'Miễn phí' : formatVnd(quote.shippingFee)}</b></div></div>
      <div className="chat-total"><span>Tổng thanh toán</span><strong>{formatVnd(quote.total)}</strong></div>
      <p>Chưa tạo đơn. Giá và tồn kho được kiểm tra lại khi xác nhận.</p>
    </>}
    {order && <>
      <strong>Đơn #{order.id} · {orderLabels[order.status]}</strong>
      {order.items.map(item => <div className="chat-cart-line" key={item.id}><span>{item.productName}<small>{item.quantity} × {formatVnd(item.price)}</small></span><b>{formatVnd(item.subtotal)}</b></div>)}
      <div className="chat-checkout-recipient"><b>{order.fullName} · {order.phone}</b><span>{order.address}</span><span>{methodLabels[order.paymentMethod]}</span></div>
      {order.discountAmount > 0 && <div className="chat-checkout-totals"><div><span>Tạm tính</span><b>{formatVnd(order.subtotalAmount)}</b></div><div><span>Voucher {order.couponCode}</span><b>−{formatVnd(order.discountAmount)}</b></div></div>}
      <div className="chat-total"><span>Tổng thanh toán</span><strong>{formatVnd(order.totalAmount)}</strong></div>
      <p role="status">{order.paymentStatus === 'PAID' ? order.paymentMethod === 'CARD' ? 'Đã thanh toán mô phỏng' : 'Đã xác minh thanh toán' : 'Chưa thanh toán'}</p>
      {order.paymentStatus === 'UNPAID' && order.status !== 'CANCELLED' && <>
        {paymentUrl && <a className="chat-checkout-pay" href={paymentUrl} target="_blank" rel="noopener noreferrer">Mở thanh toán PayOS / QR ↗</a>}
        {order.paymentMethod === 'CARD' && !disabled && <DemoCardPaymentForm orderId={order.id} onPaid={() => { const status = action('checkout_status'); if (status) onAction(status); }} />}
        {['QR', 'PAYOS'].includes(order.paymentMethod) && <p>Sau khi thanh toán, bấm Kiểm tra trạng thái. Đóng cửa sổ thanh toán không hủy đơn hàng.</p>}
      </>}
      {flow.paymentError && <p className="chat-error" role="alert">{flow.paymentError}</p>}
    </>}
    <div className="chat-actions">{flow.actions.filter(item => !formTypes.includes(item.type) && !['checkout_item_update', 'checkout_item_remove'].includes(item.type)).map(item => <button key={item.type} type="button" className={item.type === 'checkout_place_order' ? 'is-primary' : item.type === 'checkout_cancel' ? 'is-danger' : undefined} disabled={disabled} onClick={() => onAction(item)}>{item.label}</button>)}</div>
  </div>;
}

function CheckoutItem({ item, actions, disabled, onAction }: { item: CartItem; actions: ChatAction[]; disabled: boolean; onAction: (action: ChatAction) => void }) {
  const [quantity, setQuantity] = useState(String(item.quantity));
  const update = actions.find(action => action.type === 'checkout_item_update' && action.productId === item.productId);
  const remove = actions.find(action => action.type === 'checkout_item_remove' && action.productId === item.productId);
  return <div className="chat-cart-item"><div className="chat-cart-line"><span>{item.product.name}<small>{item.quantity} × {formatVnd(item.product.price)}</small></span><b>{formatVnd(item.subtotal)}</b></div>
    {update && <form className="chat-cart-controls" onSubmit={event => { event.preventDefault(); onAction({ ...update, quantity: Number(quantity) }); }}>
      <input type="number" aria-label={`Số lượng ${item.product.name}`} min={1} max={Math.min(item.product.stock, 9999)} step={1} required value={quantity} disabled={disabled} onChange={event => setQuantity(event.target.value)} /><button type="submit" disabled={disabled}>Cập nhật</button>{remove && <button type="button" disabled={disabled} onClick={() => onAction(remove)}>Xóa</button>}</form>}
  </div>;
}

function safePaymentUrl(value?: string) {
  try { const url = new URL(value ?? ''); return url.origin === 'https://pay.payos.vn' && !url.username && !url.password && /^\/web\/[a-zA-Z0-9_-]+$/.test(url.pathname) ? url.href : null; } catch { return null; }
}
