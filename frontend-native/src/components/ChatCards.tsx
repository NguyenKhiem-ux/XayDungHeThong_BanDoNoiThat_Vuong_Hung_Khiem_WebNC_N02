// file hiển thị các thẻ trong tin nhắn chatbot bản native: nút trả lời nhanh, giỏ hàng, checkout trong chat, đơn hàng, địa chỉ, voucher và xác nhận thao tác.
import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatVnd, paymentApi } from '../api';
import { withTypography } from '../typography';
import type { Cart, ChatAction, ChatAddressInput, ChatCheckoutView, ChatResponse } from '../types';
import { colors } from '../theme';

type OnAction = (action: ChatAction) => void;
type CartItem = Cart['items'][number];

const stageLabels: Record<ChatCheckoutView['stage'], string> = {
  collecting_items: '1 · Sản phẩm', collecting_address: '2 · Địa chỉ nhận hàng', selecting_voucher: '3 · Voucher',
  selecting_payment: '4 · Thanh toán', awaiting_confirmation: '5 · Kiểm tra & xác nhận', creating_order: 'Đang tạo đơn',
  awaiting_payment: 'Chờ thanh toán', completed: 'Đơn hàng đã tạo', cancelled: 'Đã hủy checkout',
};
const methodLabels: Record<string, string> = { CASH: 'Tiền mặt khi nhận hàng', QR: 'PayOS / QR', PAYOS: 'PayOS / QR', CARD: 'Thẻ mô phỏng (không thu tiền thật)' };
const orderLabels: Record<string, string> = { PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy' };
const dangerTypes = ['address_delete', 'cart_clear', 'cart_remove', 'favorite_remove', 'checkout_cancel', 'action_confirm', 'checkout_item_remove'];
const primaryTypes = ['cart_add', 'cart_add_many', 'checkout_place_order', 'checkout_confirm'];

export function Buttons({ actions, disabled, onAction }: { actions: ChatAction[]; disabled: boolean; onAction: OnAction }) {
  if (!actions.length) return null;
  return <View style={styles.actions}>{actions.map((action, index) => <Pressable key={`${action.type}-${index}`} accessibilityRole="button" disabled={disabled} onPress={() => onAction(action)}
    style={[styles.button, primaryTypes.includes(action.type) && styles.primary, dangerTypes.includes(action.type) && styles.danger, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, dangerTypes.includes(action.type) && styles.dangerText]}>{action.label}</Text>
  </Pressable>)}</View>;
}

export function ChatChips({ chips, disabled, onPick }: { chips?: string[]; disabled: boolean; onPick: (text: string) => void }) {
  if (!chips?.length) return null;
  return <View accessibilityLabel="Gợi ý trả lời nhanh" style={styles.actions}>{chips.map(chip => <Pressable key={chip} accessibilityRole="button" disabled={disabled} onPress={() => onPick(chip)} style={[styles.chip, disabled && styles.disabled]}><Text style={styles.chipText}>{chip}</Text></Pressable>)}</View>;
}

// Dòng sản phẩm có nút -/+ và xóa; dùng chung cho giỏ hàng (cart_*) và checkout trong chat (checkout_item_*).
export function ChatItemRow({ item, update, remove, disabled, onAction }: { item: CartItem; update?: ChatAction; remove?: ChatAction; disabled: boolean; onAction: OnAction }) {
  const max = Math.min(item.product.stock, 9999);
  return <View style={styles.item}>
    <Line label={item.product.name} note={`${item.quantity} × ${formatVnd(item.product.price)}`} value={formatVnd(item.subtotal)} />
    {(update || remove) && <View style={styles.actions}>
      {update && <>
        <Pressable accessibilityLabel={`Giảm số lượng ${item.product.name}`} disabled={disabled || item.quantity <= 1} onPress={() => onAction({ ...update, quantity: item.quantity - 1 })} style={[styles.button, (disabled || item.quantity <= 1) && styles.disabled]}><Text style={styles.buttonText}>−</Text></Pressable>
        <Pressable accessibilityLabel={`Tăng số lượng ${item.product.name}`} disabled={disabled || item.quantity >= max} onPress={() => onAction({ ...update, quantity: item.quantity + 1 })} style={[styles.button, (disabled || item.quantity >= max) && styles.disabled]}><Text style={styles.buttonText}>+</Text></Pressable>
      </>}
      {remove && <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onAction(remove)} style={[styles.button, styles.danger, disabled && styles.disabled]}><Text style={[styles.buttonText, styles.dangerText]}>Xóa</Text></Pressable>}
    </View>}
  </View>;
}

export function ChatCartCard({ cart, actions, disabled, onAction, onOpenCart }: { cart: Cart; actions: ChatAction[]; disabled: boolean; onAction: OnAction; onOpenCart: () => void }) {
  return <View style={styles.card}>
    <Text style={styles.cardTitle}>Giỏ hàng · {cart.itemCount} sản phẩm</Text>
    {!cart.items.length && <Text style={styles.muted}>Giỏ hàng đang trống.</Text>}
    {cart.items.map(item => <ChatItemRow key={`${item.productId}-${item.quantity}`} item={item} disabled={disabled} onAction={onAction}
      update={actions.find(a => a.type === 'cart_update_quantity' && a.productId === item.productId)} remove={actions.find(a => a.type === 'cart_remove' && a.productId === item.productId)} />)}
    <Total label="Tổng cộng" value={cart.total} />
    <Pressable accessibilityRole="link" onPress={onOpenCart}><Text style={styles.link}>Mở trang giỏ hàng →</Text></Pressable>
  </View>;
}

export function ChatAccountCards({ response, disabled, onAction }: { response: ChatResponse; disabled: boolean; onAction: OnAction }) {
  const actions = response.actions ?? [];
  return <>
    {response.orders?.map(order => <View key={order.id} style={styles.card}>
      <Text style={styles.cardTitle}>Đơn #{order.id} · {orderLabels[order.status]}</Text>
      <Text style={styles.muted}>{new Date(order.createdAt).toLocaleDateString('vi-VN')} · {methodLabels[order.paymentMethod]} · {order.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</Text>
      {order.items.map(item => <Line key={item.id} label={item.productName} note={`${item.quantity} × ${formatVnd(item.price)}`} value={formatVnd(item.subtotal)} />)}
      <Total label="Tổng thanh toán" value={order.totalAmount} />
      <Buttons actions={actions.filter(a => a.orderId === order.id)} disabled={disabled} onAction={onAction} />
    </View>)}
    {response.favorites?.map(favorite => <View key={favorite.productId} style={styles.card}>
      <Line label={favorite.product.name} value={formatVnd(favorite.product.price)} />
      <Buttons actions={actions.filter(a => a.productId === favorite.productId || (a.items as Array<{ productId: number }> | undefined)?.some(i => i.productId === favorite.productId))} disabled={disabled} onAction={onAction} />
    </View>)}
    {response.addresses?.map(address => <View key={address.id} style={styles.card}>
      <Text style={styles.cardTitle}>{address.fullName}{address.isDefault ? ' · Mặc định' : ''}</Text>
      <Text style={styles.muted}>{address.phone}</Text>
      <Text style={styles.body}>{address.address}</Text>
      <Buttons actions={actions.filter(a => a.addressId === address.id)} disabled={disabled} onAction={onAction} />
    </View>)}
    {response.coupons?.map(({ coupon, active, eligible, reason, discountAmount, finalAmount }) => <View key={coupon.id} style={styles.card}>
      <Text style={styles.cardTitle}>{coupon.code} · Giảm {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : formatVnd(Number(coupon.discountValue))}</Text>
      {!!coupon.description && <Text style={styles.body}>{coupon.description}</Text>}
      <Text style={styles.muted}>{active ? 'Đang hiệu lực' : 'Không khả dụng'} · {eligible ? 'Đủ điều kiện' : 'Chưa đủ điều kiện'} · Đơn tối thiểu {formatVnd(Number(coupon.minOrderAmount))}</Text>
      <Text style={styles.body}>{reason}</Text>
      {eligible && discountAmount !== undefined && <Text style={styles.body}>Dự kiến giảm {formatVnd(discountAmount)} · Còn {formatVnd(finalAmount ?? 0)} (chưa áp dụng)</Text>}
      <Buttons actions={actions.filter(a => a.code === coupon.code)} disabled={disabled} onAction={onAction} />
    </View>)}
    {response.addressForm && <AddressForm key={`${response.addressForm.addressId ?? 'new'}-${JSON.stringify(response.addressForm.values)}`} initial={response.addressForm.values} disabled={disabled}
      onSubmit={address => onAction({ type: response.addressForm!.addressId ? 'address_update' : 'address_create', label: response.addressForm!.addressId ? 'Lưu thay đổi địa chỉ' : 'Lưu địa chỉ mới', addressId: response.addressForm!.addressId, address })}
      onCancel={() => onAction({ type: 'action_cancel', label: 'Hủy sửa địa chỉ' })} />}
    {response.confirmation && <View style={styles.card}>
      <Text style={styles.cardTitle}>Xác nhận thao tác</Text>
      <Text style={styles.body}>{response.confirmation.summary}</Text>
      <Buttons actions={actions.filter(a => a.type === 'action_confirm' || a.type === 'action_cancel')} disabled={disabled} onAction={onAction} />
    </View>}
    {!response.confirmation && <Buttons actions={actions.filter(a => !a.productId && !a.items && !a.addressId && !a.orderId && !a.code && !['checkout_confirm', 'action_confirm', 'action_cancel'].includes(a.type))} disabled={disabled} onAction={onAction} />}
  </>;
}

export function ChatCheckoutReview({ response, disabled, onAction, onContinue }: { response: ChatResponse; disabled: boolean; onAction: OnAction; onContinue: () => void }) {
  const review = response.checkout!;
  return <View style={styles.card}>
    <Text style={styles.cardTitle}>{review.confirmed ? 'Đã xác nhận tóm tắt' : 'Xem trước mua hàng'}</Text>
    {review.items.map(item => <Line key={item.product.id} label={item.product.name} note={`${item.quantity} × ${formatVnd(item.product.price)}`} value={formatVnd(item.subtotal)} />)}
    <Total label="Tạm tính toàn bộ giỏ" value={review.total} />
    {!!review.addresses.length && <>
      <Text style={styles.label}>Địa chỉ nhận hàng</Text>
      {review.addresses.map(address => <Choice key={address.id} selected={review.addressId === address.id} disabled={disabled || review.confirmed}
        title={`${address.fullName} · ${address.phone}`} note={address.address}
        onPress={() => onAction({ type: 'checkout_review', label: 'Chọn địa chỉ nhận hàng', reviewId: review.id, addressId: address.id })} />)}
    </>}
    {!!review.missingFields.length && <Text style={styles.muted}>Cần bổ sung tại checkout: {review.missingFields.join(', ')}.</Text>}
    <Buttons actions={(response.actions ?? []).filter(a => a.type === 'checkout_confirm')} disabled={disabled} onAction={onAction} />
    {!!response.checkoutUrl && <Pressable accessibilityRole="link" onPress={onContinue}><Text style={styles.link}>Tiếp tục đến checkout →</Text></Pressable>}
  </View>;
}

export function ChatCheckoutCards({ flow, disabled, onAction }: { flow: ChatCheckoutView; disabled: boolean; onAction: OnAction }) {
  const [newAddress, setNewAddress] = useState(!flow.addresses.length);
  const [code, setCode] = useState(flow.couponCode ?? '');
  const [pin, setPin] = useState('');
  const [cardError, setCardError] = useState('');
  const find = (type: string) => flow.actions.find(item => item.type === type);
  const addressAction = find('checkout_address');
  const voucherAction = find('checkout_voucher');
  const paymentAction = find('checkout_payment');
  const { quote, order, appliedVoucher } = flow;
  const paymentUrl = safePaymentUrl(flow.paymentUrl);
  const payCard = async () => {
    if (!order || !/^\d{6}$/.test(pin)) { setCardError('Vui lòng nhập PIN mô phỏng gồm 6 chữ số.'); return; }
    setCardError('');
    try {
      if (!(await paymentApi.confirmCardPayment(order.id, pin)).success) throw new Error('Thanh toán thẻ mô phỏng chưa được xác nhận.');
      setPin('');
      const status = find('checkout_status');
      if (status) onAction(status);
    } catch (error) { setCardError(error instanceof Error ? error.message : 'Không thể xác minh thanh toán thẻ.'); }
  };
  return <View style={styles.card}>
    <Text style={styles.cardTitle}>{stageLabels[flow.stage]}</Text>
    {!order && appliedVoucher && <Text style={styles.body}>Đã áp dụng voucher {appliedVoucher.code} · Giảm {formatVnd(appliedVoucher.discountAmount)}</Text>}
    {!order && !quote && <>
      {flow.cart.items.map(item => <ChatItemRow key={`${item.productId}-${item.quantity}`} item={item} disabled={disabled} onAction={onAction}
        update={flow.actions.find(a => a.type === 'checkout_item_update' && a.productId === item.productId)} remove={flow.actions.find(a => a.type === 'checkout_item_remove' && a.productId === item.productId)} />)}
      {!!flow.cart.items.length && <Total label="Tổng sau giảm giá" value={appliedVoucher?.finalAmount ?? flow.cart.total} />}
    </>}
    {addressAction && <View style={styles.section}>
      {!newAddress && flow.addresses.map(address => <Choice key={address.id} selected={flow.addressId === address.id} disabled={disabled}
        title={`${address.fullName} · ${address.phone}${address.isDefault ? ' (Mặc định)' : ''}`} note={address.address}
        onPress={() => onAction({ ...addressAction, addressId: address.id })} />)}
      {!!flow.addresses.length && <Pressable disabled={disabled} onPress={() => setNewAddress(value => !value)}><Text style={styles.link}>{newAddress ? '← Chọn địa chỉ đã lưu' : '+ Thêm địa chỉ mới'}</Text></Pressable>}
      {newAddress && <AddressForm initial={{}} disabled={disabled} submitLabel="Lưu và dùng địa chỉ này" onSubmit={address => onAction({ ...addressAction, label: 'Lưu và dùng địa chỉ nhận hàng', address })} />}
    </View>}
    {voucherAction && <View style={styles.section}>
      {flow.coupons.map(view => <Choice key={view.coupon.id} disabled={disabled || !view.eligible} title={view.coupon.code}
        note={view.eligible ? `Giảm ${formatVnd(view.discountAmount ?? 0)}` : view.reason}
        onPress={() => onAction({ ...voucherAction, label: `Áp dụng voucher ${view.coupon.code}`, code: view.coupon.code })} />)}
      <View style={styles.row}>
        <TextInput accessibilityLabel="Mã voucher" value={code} onChangeText={setCode} maxLength={50} editable={!disabled} autoCapitalize="characters" placeholder="Nhập mã voucher" placeholderTextColor={colors.muted} style={[styles.input, styles.flex]} />
        <Pressable disabled={disabled || !code.trim()} onPress={() => onAction({ ...voucherAction, label: 'Áp dụng voucher đã nhập', code: code.trim() })} style={[styles.button, (disabled || !code.trim()) && styles.disabled]}><Text style={styles.buttonText}>Áp dụng</Text></Pressable>
      </View>
    </View>}
    {paymentAction && <View style={styles.section}>
      {flow.paymentMethods.map(option => <Choice key={option.value} selected={flow.paymentMethod === option.value} disabled={disabled} title={option.label} note={option.description}
        onPress={() => onAction({ ...paymentAction, paymentMethod: option.value })} />)}
    </View>}
    {quote && !order && <>
      {quote.items.map(item => <Line key={item.productId} label={item.name} note={`${item.quantity} × ${formatVnd(item.price)}`} value={formatVnd(item.subtotal)} />)}
      <Text style={styles.body}>{quote.address.fullName} · {quote.address.phone} · {quote.email}{'\n'}{quote.address.address}{'\n'}{methodLabels[quote.paymentMethod]}</Text>
      <Line label="Tạm tính" value={formatVnd(quote.subtotal)} />
      <Line label={`Voucher ${quote.couponCode ?? '(không dùng)'}`} value={`−${formatVnd(quote.discountAmount)}`} />
      <Line label="Phí giao hàng" value={quote.shippingFee === 0 ? 'Miễn phí' : formatVnd(quote.shippingFee)} />
      <Total label="Tổng thanh toán" value={quote.total} />
      <Text style={styles.muted}>Chưa tạo đơn. Giá và tồn kho được kiểm tra lại khi xác nhận.</Text>
    </>}
    {order && <>
      <Text style={styles.cardTitle}>Đơn #{order.id} · {orderLabels[order.status]}</Text>
      {order.items.map(item => <Line key={item.id} label={item.productName} note={`${item.quantity} × ${formatVnd(item.price)}`} value={formatVnd(item.subtotal)} />)}
      <Text style={styles.body}>{order.fullName} · {order.phone}{'\n'}{order.address}{'\n'}{methodLabels[order.paymentMethod]}</Text>
      <Total label="Tổng thanh toán" value={order.totalAmount} />
      <Text style={styles.muted}>{order.paymentStatus === 'PAID' ? 'Đã xác minh thanh toán' : 'Chưa thanh toán'}</Text>
      {order.paymentStatus === 'UNPAID' && order.status !== 'CANCELLED' && <>
        {paymentUrl && <Pressable accessibilityRole="link" onPress={() => void (Platform.OS === 'web' ? globalThis.open(paymentUrl, '_blank', 'noopener') : Linking.openURL(paymentUrl))}><Text style={styles.link}>Mở thanh toán PayOS / QR ↗</Text></Pressable>}
        {order.paymentMethod === 'CARD' && <View style={styles.row}>
          <TextInput accessibilityLabel="PIN thanh toán mô phỏng" value={pin} onChangeText={value => setPin(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry maxLength={6} editable={!disabled} placeholder="PIN 6 số" placeholderTextColor={colors.muted} style={[styles.input, styles.flex]} />
          <Pressable disabled={disabled} onPress={() => void payCard()} style={[styles.button, styles.primary, disabled && styles.disabled]}><Text style={styles.buttonText}>Thanh toán</Text></Pressable>
        </View>}
        {['QR', 'PAYOS'].includes(order.paymentMethod) && <Text style={styles.muted}>Sau khi thanh toán, bấm Kiểm tra trạng thái. Đóng trang thanh toán không hủy đơn hàng.</Text>}
      </>}
      {!!(flow.paymentError || cardError) && <Text accessibilityRole="alert" style={styles.error}>{flow.paymentError || cardError}</Text>}
    </>}
    <Buttons actions={flow.actions.filter(a => !['checkout_address', 'checkout_payment', 'checkout_voucher', 'checkout_item_update', 'checkout_item_remove'].includes(a.type))} disabled={disabled} onAction={onAction} />
  </View>;
}

function AddressForm({ initial, disabled, submitLabel = 'Lưu địa chỉ', onSubmit, onCancel }: { initial: ChatAddressInput; disabled: boolean; submitLabel?: string; onSubmit: (address: ChatAddressInput) => void; onCancel?: () => void }) {
  const [values, setValues] = useState<ChatAddressInput>(initial);
  const field = (key: 'fullName' | 'phone' | 'address', label: string, maxLength: number) => <TextInput accessibilityLabel={label} placeholder={label} placeholderTextColor={colors.muted} maxLength={maxLength} editable={!disabled}
    keyboardType={key === 'phone' ? 'phone-pad' : 'default'} multiline={key === 'address'} value={values[key] ?? ''} onChangeText={value => setValues(current => ({ ...current, [key]: value }))} style={styles.input} />;
  const ready = !!values.fullName?.trim() && !!values.phone?.trim() && !!values.address?.trim();
  return <View style={styles.section}>
    {field('fullName', 'Họ tên người nhận', 100)}
    {field('phone', 'Số điện thoại', 15)}
    {field('address', 'Địa chỉ đầy đủ', 1000)}
    {onCancel && <Choice selected={!!values.isDefault} disabled={disabled} title="Đặt làm địa chỉ mặc định" onPress={() => setValues(current => ({ ...current, isDefault: !current.isDefault }))} />}
    <View style={styles.actions}>
      <Pressable disabled={disabled || !ready} onPress={() => onSubmit(values)} style={[styles.button, styles.primary, (disabled || !ready) && styles.disabled]}><Text style={styles.buttonText}>{submitLabel}</Text></Pressable>
      {onCancel && <Pressable disabled={disabled} onPress={onCancel} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>Hủy</Text></Pressable>}
    </View>
  </View>;
}

function Choice({ title, note, selected, disabled, onPress }: { title: string; note?: string; selected?: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: !!selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected, disabled && styles.disabled]}>
    <Text style={styles.choiceTitle}>{selected ? '● ' : '○ '}{title}</Text>
    {!!note && <Text style={styles.muted}>{note}</Text>}
  </Pressable>;
}

function Line({ label, note, value }: { label: string; note?: string; value: string }) {
  return <View style={styles.line}><View style={styles.flex}><Text style={styles.body}>{label}</Text>{!!note && <Text style={styles.muted}>{note}</Text>}</View><Text style={styles.value}>{value}</Text></View>;
}

function Total({ label, value }: { label: string; value: number }) {
  return <View style={[styles.line, styles.total]}><Text style={styles.cardTitle}>{label}</Text><Text style={styles.totalValue}>{formatVnd(value)}</Text></View>;
}

function safePaymentUrl(value?: string) {
  try { const url = new URL(value ?? ''); return url.origin === 'https://pay.payos.vn' && !url.username && !url.password && /^\/web\/[a-zA-Z0-9_-]+$/.test(url.pathname) ? url.href : null; } catch { return null; }
}

const styles = StyleSheet.create(withTypography({
  card: { padding: 9, gap: 6, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  cardTitle: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  section: { gap: 6 },
  body: { color: colors.ink, fontSize: 12, lineHeight: 17 },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  link: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  error: { color: colors.danger, fontSize: 11 },
  item: { gap: 5 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  value: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  total: { paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.lineSoft, justifyContent: 'space-between' },
  totalValue: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
  button: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.brand },
  primary: { backgroundColor: colors.brand },
  danger: { backgroundColor: '#FBE8E5' },
  buttonText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  dangerText: { color: colors.danger },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.subtle, backgroundColor: colors.white },
  chipText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  choice: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  choiceSelected: { borderColor: colors.brand, backgroundColor: colors.lineSoft },
  choiceTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 38, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, color: colors.ink, paddingHorizontal: 10, fontSize: 12 },
  disabled: { opacity: 0.45 },
}));
