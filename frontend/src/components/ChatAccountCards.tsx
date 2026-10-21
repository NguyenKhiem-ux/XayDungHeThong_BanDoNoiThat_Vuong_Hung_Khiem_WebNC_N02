import { useState } from 'react';
import type { ChatAction, ChatResponse, ChatAddressInput } from '../api/types';
import { formatVnd } from '../api/client';
import { ProductCard } from './ProductCard';

type Props = { response: ChatResponse; disabled: boolean; onAction: (action: ChatAction) => void };
const orderStatus = { PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy' };
const paymentMethod = { QR: 'QR', CARD: 'Thẻ', CASH: 'Tiền mặt', PAYOS: 'PayOS' };
const date = (value: string) => new Date(value).toLocaleDateString('vi-VN');

export function ChatAccountCards({ response, disabled, onAction }: Props) {
  const buttons = (actions: ChatAction[]) => actions.length ? <div className="chat-actions">{actions.map((action, index) => <button key={`${action.type}-${index}`} type="button" disabled={disabled}
    className={action.type === 'action_confirm' ? 'is-destructive' : ['address_delete', 'cart_clear', 'favorite_remove'].includes(action.type) ? 'is-danger' : action.type === 'cart_add_many' ? 'is-primary' : undefined}
    onClick={() => onAction(action)}>{action.label}</button>)}</div> : null;
  const actions = response.actions ?? [];
  return <>
    {!!response.orders?.length && <div className="chat-resource-grid">{response.orders.map((order, index) => <article className="chat-shopping-summary" key={order.id}>
      <div className="chat-card-heading"><strong>{index + 1}. Đơn #{order.id}</strong><time dateTime={order.createdAt}>{date(order.createdAt)}</time></div>
      <div className="chat-statuses"><span className={`chat-status ${order.status === 'DELIVERED' ? 'is-positive' : order.status === 'PENDING' ? 'is-warning' : ''}`}>{orderStatus[order.status]}</span>
        <span className={`chat-status ${order.paymentStatus === 'PAID' ? 'is-positive' : ''}`}>{order.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</span></div>
      <div className="chat-total"><span>Tổng thanh toán</span><strong>{formatVnd(order.totalAmount)}</strong></div>
      <details className="chat-order-details" open={!actions.some(action => action.type === 'order_detail' && action.orderId === order.id)}>
        <summary>Sản phẩm và thông tin giao hàng</summary>
        {order.items.map(item => <div className="chat-cart-line" key={item.id}><span>{item.productName}<small>{item.quantity} × {formatVnd(item.price)}</small></span><strong>{formatVnd(item.subtotal)}</strong></div>)}
        {order.discountAmount > 0 && <small>Đã giảm {formatVnd(order.discountAmount)}{order.couponCode ? ` · ${order.couponCode}` : ''}</small>}
        <p>{paymentMethod[order.paymentMethod]}<br />{order.fullName} · {order.phone}<br />{order.address}</p>
      </details>
      {buttons(actions.filter(a => a.orderId === order.id))}
    </article>)}</div>}
    {response.favorites && <div className="chat-products">{response.favorites.map((favorite, index) => <div className="chat-product-choice" key={favorite.productId}>
      <span className="chat-product-number">Yêu thích {index + 1}</span>
      <ProductCard product={favorite.product} index={index} />
      {buttons(actions.filter(a => a.productId === favorite.productId || a.items?.some(i => i.productId === favorite.productId)))}
    </div>)}</div>}
    {!!response.addresses?.length && <div className="chat-resource-grid">{response.addresses.map((address, index) => <article className="chat-shopping-summary" key={address.id}>
      <div className="chat-card-heading"><strong>{index + 1}. {address.fullName}</strong>{address.isDefault && <span className="chat-status is-positive">Mặc định</span>}</div>
      <p className="chat-address-text">{address.address}</p>
      <div className="chat-address-contact">{address.phone}</div>
      {buttons(actions.filter(a => a.addressId === address.id))}
    </article>)}</div>}
    {!!response.coupons?.length && <div className="chat-resource-grid">{response.coupons.map(({ coupon, active, eligible, reason, discountAmount, finalAmount }, index) => <article className="chat-shopping-summary" key={coupon.id}>
      <div className="chat-card-heading"><strong>{index + 1}. {coupon.code}</strong><span className="chat-status is-positive">Giảm {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : formatVnd(Number(coupon.discountValue))}</span></div>
      {coupon.description && <p>{coupon.description}</p>}
      <div className="chat-statuses"><span className="chat-status">{active ? 'Đang hiệu lực' : 'Không khả dụng'}</span><span className={`chat-status ${eligible ? 'is-positive' : 'is-warning'}`}>{eligible ? 'Đủ điều kiện' : 'Chưa đủ điều kiện'}</span></div>
      <dl className="chat-facts">
        <div><dt>Đơn tối thiểu</dt><dd>{formatVnd(Number(coupon.minOrderAmount))}</dd></div>
        {coupon.maxDiscountAmount !== null && <div><dt>Giảm tối đa</dt><dd>{formatVnd(Number(coupon.maxDiscountAmount))}</dd></div>}
        <div className="chat-facts-wide"><dt>Thời hạn</dt><dd>{date(coupon.startDate)} đến {date(coupon.endDate)}</dd></div>
        <div><dt>Lượt sử dụng</dt><dd>{coupon.usedCount}/{coupon.usageLimit ?? 'không giới hạn'}</dd></div>
        {coupon.freeShipping && <div><dt>Vận chuyển</dt><dd>Ưu đãi miễn phí theo mã</dd></div>}
      </dl>
      <p>{reason}</p>
      {eligible && discountAmount !== undefined && <div className="chat-voucher-estimate">Dự kiến giảm {formatVnd(discountAmount)} · Còn {formatVnd(finalAmount ?? 0)} (chưa áp dụng)</div>}
      {buttons(actions.filter(a => a.code === coupon.code))}
    </article>)}</div>}
    {response.addressForm && <AddressForm key={`${response.addressForm.addressId ?? 'new'}-${JSON.stringify(response.addressForm.values)}`} form={response.addressForm} disabled={disabled} onAction={onAction} />}
    {response.confirmation && <div className="chat-shopping-summary chat-confirmation"><strong>Xác nhận thao tác</strong><p>{response.confirmation.summary}</p>{buttons(actions.filter(a => a.type === 'action_confirm' || a.type === 'action_cancel'))}</div>}
    {!response.confirmation && buttons(actions.filter(a => !a.productId && !a.items && !a.addressId && !a.orderId && !a.code && !['checkout_confirm', 'action_confirm', 'action_cancel'].includes(a.type)))}
  </>;
}

function AddressForm({ form, disabled, onAction }: { form: NonNullable<ChatResponse['addressForm']>; disabled: boolean; onAction: Props['onAction'] }) {
  const [values, setValues] = useState<ChatAddressInput>(form.values);
  const field = (key: 'fullName' | 'phone' | 'address', label: string, maxLength: number) => <label>{label}<input type={key === 'phone' ? 'tel' : 'text'} name={key} autoComplete={key === 'fullName' ? 'name' : key === 'phone' ? 'tel' : 'street-address'} maxLength={maxLength} required value={values[key] ?? ''} disabled={disabled} onChange={event => setValues(previous => ({ ...previous, [key]: event.target.value }))} /></label>;
  return <form className="chat-shopping-summary chat-address-form" onSubmit={event => {
    event.preventDefault(); onAction({ type: form.addressId ? 'address_update' : 'address_create', label: form.addressId ? 'Lưu thay đổi địa chỉ' : 'Lưu địa chỉ mới', addressId: form.addressId, address: values });
  }}>
    <strong>{form.addressId ? 'Chỉnh sửa địa chỉ' : 'Thêm địa chỉ mới'}</strong>
    <div className="chat-address-fields">{field('fullName', 'Họ tên người nhận', 100)}
    {field('phone', 'Số điện thoại', 15)}
    {field('address', 'Địa chỉ đầy đủ', 1000)}</div>
    <label className="chat-checkbox"><input type="checkbox" checked={!!values.isDefault} disabled={disabled} onChange={event => setValues(previous => ({ ...previous, isDefault: event.target.checked }))} /> Đặt mặc định</label>
    <div className="chat-actions"><button type="submit" className="is-primary" disabled={disabled}>Lưu địa chỉ</button><button type="button" disabled={disabled} onClick={() => onAction({ type: 'action_cancel', label: 'Hủy sửa địa chỉ' })}>Hủy</button></div>
  </form>;
}
