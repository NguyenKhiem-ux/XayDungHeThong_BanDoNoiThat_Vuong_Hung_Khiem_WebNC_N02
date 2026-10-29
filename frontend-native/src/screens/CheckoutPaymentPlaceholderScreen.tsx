import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { ApiError, couponApi, formatVnd, imageUrl, orderApi, type OrderInput } from '../api';
import { ChatWidget } from '../components/ChatWidget';
import { PageHeader } from '../components/PageHeader';
import { ProductFooter } from '../components/ProductFooter';
import { useStore } from '../store';
import { withTypography } from '../typography';
import type { CheckoutQuote, Coupon, PaymentMethod } from '../types';

const methods: Array<{ value: PaymentMethod; title: string; description: string; icon: 'cash-outline' | 'qr-code-outline' | 'card-outline' }> = [
  { value: 'CASH', title: 'Tiền mặt khi nhận hàng', description: 'Kiểm tra sản phẩm và thanh toán cho nhân viên giao hàng.', icon: 'cash-outline' },
  { value: 'QR', title: 'PayOS / QR', description: 'Tạo link thanh toán PayOS để quét mã QR an toàn.', icon: 'qr-code-outline' },
  { value: 'CARD', title: 'Thẻ mô phỏng', description: 'Xác minh bằng PIN 6 số, không thu tiền thật.', icon: 'card-outline' },
];

export default function CheckoutPaymentPlaceholderScreen() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 860;
  const { authReady, cart, cartError, cartLoading, checkoutCouponCode, checkoutShipping, refreshCart, setCheckoutCouponCode, setCheckoutPaymentPin, user } = useStore();
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [pin, setPin] = useState('');
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [orderError, setOrderError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [couponInput, setCouponInput] = useState(checkoutCouponCode);
  const [appliedCouponCode, setAppliedCouponCode] = useState(checkoutCouponCode);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState('');

  const cardAvailable = !!user?.savedCard && !!user.hasTransactionPin;
  const address = checkoutShipping ? [checkoutShipping.address, checkoutShipping.district, checkoutShipping.province].filter(Boolean).join(', ') : '';
  const payload = useMemo<OrderInput | null>(() => checkoutShipping && user ? ({ fullName: checkoutShipping.fullName, email: user.email, phone: checkoutShipping.phone, address, paymentMethod: method, note: checkoutShipping.note || undefined, couponCode: appliedCouponCode || undefined }) : null, [address, appliedCouponCode, checkoutShipping, method, user]);

  useEffect(() => {
    if (method === 'CARD' && !cardAvailable) setMethod('CASH');
  }, [cardAvailable, method]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void couponApi.list().then(coupons => { if (active) setAvailableCoupons(coupons); }).catch(() => { if (active) setAvailableCoupons([]); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) { router.replace({ pathname: '/login', params: { redirect: '/checkout/payment' } }); return; }
    if (!checkoutShipping) { router.replace('/checkout/info'); return; }
    if (!cart) void refreshCart().catch(() => {});
  }, [authReady, cart, checkoutShipping, refreshCart, router, user]);

  useEffect(() => {
    if (!payload || !cart?.items.length || pendingOrderId) return;
    let active = true;
    setQuoteLoading(true);
    setQuoteError('');
    setOrderError('');
    void orderApi.preview(payload).then(next => {
      if (!active) return;
      if (payload.couponCode && next.couponCode !== payload.couponCode) {
        setQuote(null);
        setAppliedCouponCode('');
        setCheckoutCouponCode('');
        setCouponError('Báo giá không xác nhận mã giảm giá đã chọn. Vui lòng áp dụng lại.');
        return;
      }
      setQuote(next);
    }).catch(error => {
      if (!active) return;
      const message = error instanceof Error ? error.message : 'Không thể kiểm tra báo giá.';
      setQuote(null);
      if (payload.couponCode) {
        setAppliedCouponCode('');
        setCheckoutCouponCode('');
        setCouponError(message);
      } else {
        setQuoteError(message);
      }
    }).finally(() => { if (active) setQuoteLoading(false); });
    return () => { active = false; };
  }, [cart, payload, pendingOrderId, setCheckoutCouponCode]);

  const updateCouponInput = (value: string) => {
    const next = value.toUpperCase();
    setCouponInput(next);
    setCouponError('');
    if (appliedCouponCode && next.trim() !== appliedCouponCode) {
      setAppliedCouponCode('');
      setCheckoutCouponCode('');
      setQuote(null);
    }
  };

  const removeCoupon = () => {
    setCouponInput('');
    setAppliedCouponCode('');
    setCheckoutCouponCode('');
    setCouponError('');
    setQuote(null);
  };

  const applyCoupon = async (requestedCode = couponInput) => {
    const code = requestedCode.trim().toUpperCase();
    if (!code || !cart) { setCouponError('Vui lòng nhập hoặc chọn mã giảm giá.'); return; }
    if (couponBusy || busy || pendingOrderId) return;
    setCouponBusy(true);
    setCouponError('');
    try {
      const result = await couponApi.validate(code, cart.total);
      if (!result.valid || !result.coupon.code) throw new Error('Mã giảm giá không hợp lệ.');
      const confirmedCode = result.coupon.code.trim().toUpperCase();
      setCouponInput(confirmedCode);
      setAppliedCouponCode(confirmedCode);
      setCheckoutCouponCode(confirmedCode);
      setQuote(null);
    } catch (error) {
      setAppliedCouponCode('');
      setCheckoutCouponCode('');
      setQuote(null);
      setCouponError(error instanceof Error ? error.message : 'Không thể áp dụng mã giảm giá.');
    } finally {
      setCouponBusy(false);
    }
  };

  const placeOrder = async () => {
    if (busy || couponBusy || quoteLoading || !payload || (!cart?.items.length && !pendingOrderId)) return;
    if (method === 'CARD' && !/^\d{6}$/.test(pin)) { setOrderError('Vui lòng nhập PIN mô phỏng gồm 6 chữ số.'); return; }
    if (!quote && !pendingOrderId) { setOrderError('Báo giá chưa sẵn sàng. Vui lòng thử lại.'); return; }
    if (!pendingOrderId && quote!.couponCode !== (payload.couponCode ?? null)) { setOrderError('Mã giảm giá và báo giá chưa đồng bộ. Vui lòng áp dụng lại mã.'); return; }
    setBusy(true);
    setOrderError('');
    let orderCreated = !!pendingOrderId;
    try {
      let orderId = pendingOrderId;
      if (!orderId) {
        const order = await orderApi.create({ ...payload, quoteId: quote!.id, quoteHash: quote!.hash });
        orderId = order.id;
        orderCreated = true;
        setPendingOrderId(order.id);
        setCheckoutCouponCode('');
        setCheckoutPaymentPin(method === 'CARD' ? pin : '');
        await refreshCart().catch(() => {});
      }
      router.replace({ pathname: '/checkout/invoice', params: { id: String(orderId) } });
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : 'Không thể hoàn tất đặt hàng.');
      if (!orderCreated && error instanceof ApiError && error.status === 409 && quote && payload) {
        try {
          setQuote(await orderApi.preview({ ...payload, quoteId: quote.id }));
          setQuoteError('');
          setOrderError('Báo giá đã thay đổi. Vui lòng kiểm tra lại tổng tiền trước khi xác nhận.');
        } catch (previewError) {
          setQuote(null);
          setQuoteError(previewError instanceof Error ? previewError.message : 'Không thể cập nhật báo giá.');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  if (!authReady || !user || !checkoutShipping || (cartLoading && !cart)) return <View style={styles.page}><PageHeader back /><View style={styles.state}><ActivityIndicator size="large" color="#755036" /><Text style={styles.stateText}>Đang chuẩn bị phương thức thanh toán...</Text></View></View>;
  if (cartError && !cart) return <View style={styles.page}><PageHeader back /><View style={styles.state}><Ionicons name="alert-circle-outline" size={42} color="#9B382F" /><Text style={styles.stateTitle}>Chưa thể tải giỏ hàng</Text><Text style={styles.stateText}>{cartError}</Text><Pressable style={styles.primaryButton} onPress={() => void refreshCart().catch(() => {})}><Text style={styles.primaryText}>Thử lại</Text></Pressable></View></View>;
  if (!cart) return <View style={styles.page}><PageHeader back /><View style={styles.state}><ActivityIndicator size="large" color="#755036" /><Text style={styles.stateText}>Đang chuẩn bị phương thức thanh toán...</Text></View></View>;
  if (!cart.items.length && !pendingOrderId) return <View style={styles.page}><PageHeader back /><View style={styles.state}><Ionicons name="bag-outline" size={45} color="#A56E2D" /><Text style={styles.stateTitle}>Giỏ hàng đang trống</Text><Text style={styles.stateText}>Không thể tiếp tục thanh toán khi chưa có sản phẩm.</Text><Pressable style={styles.primaryButton} onPress={() => router.replace('/products')}><Text style={styles.primaryText}>Tiếp tục mua sắm</Text></Pressable></View></View>;

  return (
    <View style={styles.page}>
      <PageHeader back />
      <ScrollView contentContainerStyle={[styles.scroll, compact && styles.scrollCompact]} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Breadcrumb router={router} />
          <View style={styles.hero}>
            <View style={styles.heroIcon}><Ionicons name="shield-checkmark-outline" size={22} color="#FFFCF7" /></View>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>CHECKOUT</Text>
              <Text style={styles.pageTitle}>Xác nhận đơn hàng</Text>
              <Text style={styles.pageSubtitle}>Kiểm tra thông tin và chọn phương thức thanh toán để hoàn tất đơn hàng.</Text>
            </View>
          </View>
          <Progress />
          <View style={[styles.layout, compact && styles.layoutCompact]}>
            <View style={styles.main}>
              <ShippingCard shipping={checkoutShipping} email={user.email} onEdit={() => router.replace('/checkout/info')} />
              <OrderProducts quote={quote} cart={cart} />
              <CouponCard value={couponInput} availableCoupons={availableCoupons} appliedCode={quote?.couponCode === appliedCouponCode ? appliedCouponCode : ''} discountAmount={quote?.discountAmount ?? 0} total={quote?.total} busy={couponBusy || (quoteLoading && !!appliedCouponCode)} disabled={busy || !!pendingOrderId} error={couponError} onChange={updateCouponInput} onApply={() => void applyCoupon()} onChoose={code => { setCouponInput(code); void applyCoupon(code); }} onRemove={removeCoupon} />
              <PaymentCard method={method} cardAvailable={cardAvailable} pendingOrderId={pendingOrderId} busy={busy || couponBusy} pin={pin} quoteLoading={quoteLoading} quoteError={quoteError} orderError={orderError} onMethodChange={next => { setMethod(next); setQuote(null); }} onPinChange={setPin} />
              <View style={styles.actions}>
                <Pressable style={styles.secondaryButton} disabled={busy} onPress={() => router.replace('/checkout/info')}>
                  <Ionicons name="arrow-back" size={17} color="#755036" /><Text style={styles.secondaryText}>Sửa thông tin giao hàng</Text>
                </Pressable>
                <Pressable style={[styles.primaryButton, (busy || couponBusy || quoteLoading || (!quote && !pendingOrderId)) && styles.disabled]} disabled={busy || couponBusy || quoteLoading || (!quote && !pendingOrderId)} onPress={() => void placeOrder()}>
                  {busy ? <ActivityIndicator color="#fff" /> : <><Ionicons name={method === 'CASH' ? 'checkmark-circle-outline' : method === 'CARD' ? 'card-outline' : 'qr-code-outline'} size={18} color="#fff" /><Text style={styles.primaryText}>{pendingOrderId && method === 'QR' ? 'Mở lại link PayOS' : pendingOrderId && method === 'CARD' ? 'Xác nhận PIN' : method === 'CASH' ? 'Xác nhận đơn hàng' : method === 'CARD' ? 'Thanh toán mô phỏng' : 'Thanh toán PayOS / QR'}</Text></>}
                </Pressable>
              </View>
            </View>
            <OrderSummary quote={quote} cart={cart} compact={compact} />
          </View>
        </View>
        <ProductFooter />
      </ScrollView>
      <ChatWidget compact={compact} />
    </View>
  );
}

function Breadcrumb({ router }: { router: ReturnType<typeof useRouter> }) {
  return <View style={styles.breadcrumb}><Pressable onPress={() => router.replace('/')}><Text style={styles.breadcrumbLink}>Trang chủ</Text></Pressable><Ionicons name="chevron-forward" size={14} color="#A08E80" /><Pressable onPress={() => router.replace('/cart')}><Text style={styles.breadcrumbLink}>Giỏ hàng</Text></Pressable><Ionicons name="chevron-forward" size={14} color="#A08E80" /><Text style={styles.breadcrumbCurrent}>Thanh toán</Text></View>;
}

function Progress() {
  return <View style={styles.progress}><View style={styles.progressItem}><View style={styles.done}><Ionicons name="checkmark" size={15} color="#fff" /></View><Text style={styles.doneText}>Thông tin giao hàng</Text></View><View style={styles.line} /><View style={styles.progressItem}><View style={styles.active}><Text style={styles.number}>2</Text></View><Text style={styles.activeText}>Phương thức thanh toán</Text></View><View style={styles.line} /><View style={styles.progressItem}><View style={[styles.active, { backgroundColor: '#F6EFE6' }]}><Text style={[styles.number, { color: '#9B8A7C' }]}>3</Text></View><Text style={[styles.activeText, { color: '#9B8A7C' }]}>Hoàn tất</Text></View></View>;
}

function ShippingCard({ shipping, email, onEdit }: { shipping: NonNullable<ReturnType<typeof useStore>['checkoutShipping']>; email: string; onEdit: () => void }) {
  return <View style={styles.card}><View style={styles.cardHeading}><View style={styles.headingIcon}><Ionicons name="location-outline" size={19} color="#755036" /></View><View style={styles.headingCopy}><Text style={styles.sectionTitle}>Thông tin giao hàng</Text><Text style={styles.sectionHint}>Thông tin đã xác nhận ở bước 1</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Sửa thông tin giao hàng" onPress={onEdit} style={styles.edit}><Ionicons name="create-outline" size={15} color="#755036" /><Text style={styles.editText}>Sửa</Text></Pressable></View><View style={styles.shippingGrid}><View style={styles.shippingField}><Text style={styles.fieldLabel}>Người nhận</Text><Text style={styles.recipientName}>{shipping.fullName}</Text></View><View style={styles.shippingField}><Text style={styles.fieldLabel}>Điện thoại</Text><Text style={styles.recipientText}>{shipping.phone}</Text></View><View style={styles.shippingField}><Text style={styles.fieldLabel}>Email</Text><Text style={styles.recipientText}>{email}</Text></View><View style={styles.shippingField}><Text style={styles.fieldLabel}>Địa chỉ giao hàng</Text><Text style={styles.recipientText}>{[shipping.address, shipping.district, shipping.province].filter(Boolean).join(', ')}</Text></View></View>{shipping.note ? <View style={styles.noteBox}><Ionicons name="chatbubble-ellipses-outline" size={15} color="#A56E2D" /><Text style={styles.note}>Ghi chú: {shipping.note}</Text></View> : null}</View>;
}

function CouponCard({ value, availableCoupons, appliedCode, discountAmount, total, busy, disabled, error, onChange, onApply, onChoose, onRemove }: { value: string; availableCoupons: Coupon[]; appliedCode: string; discountAmount: number; total?: number; busy: boolean; disabled: boolean; error: string; onChange: (value: string) => void; onApply: () => void; onChoose: (code: string) => void; onRemove: () => void }) {
  const choices = availableCoupons.filter(coupon => coupon.isActive).slice(0, 4);
  return <View style={styles.card}><View style={styles.cardHeading}><View style={styles.headingIcon}><Ionicons name="ticket-outline" size={19} color="#755036" /></View><View style={styles.headingCopy}><Text style={styles.sectionTitle}>Mã giảm giá</Text><Text style={styles.sectionHint}>Giảm giá và tổng tiền được xác nhận trực tiếp từ Backend</Text></View></View><View style={styles.couponRow}><TextInput accessibilityLabel="Mã giảm giá" value={value} editable={!disabled && !busy} autoCapitalize="characters" autoCorrect={false} maxLength={80} returnKeyType="done" onSubmitEditing={onApply} onChangeText={onChange} placeholder="Nhập mã giảm giá" placeholderTextColor="#A08E80" style={styles.couponInput} /><Pressable accessibilityRole="button" disabled={disabled || busy || !value.trim()} onPress={onApply} style={[styles.couponApply, (disabled || busy || !value.trim()) && styles.disabled]}>{busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.couponApplyText}>Áp dụng</Text>}</Pressable></View>{choices.length ? <View style={styles.couponChoices}><Text style={styles.couponChoiceLabel}>Mã có thể chọn</Text><View style={styles.couponChoiceRow}>{choices.map(coupon => <Pressable key={coupon.id} disabled={disabled || busy} onPress={() => onChoose(coupon.code)} style={styles.couponChoice}><Text style={styles.couponChoiceCode}>{coupon.code}</Text><Text numberOfLines={1} style={styles.couponChoiceDescription}>{coupon.description || 'Kiểm tra điều kiện áp dụng'}</Text></Pressable>)}</View></View> : null}{error ? <View style={styles.alert}><Ionicons name="alert-circle-outline" size={17} color="#9B382F" /><Text accessibilityRole="alert" style={styles.error}>{error}</Text></View> : null}{appliedCode ? <View style={styles.couponSuccess}><Ionicons name="checkmark-circle" size={19} color="#47724A" /><View style={styles.flex}><Text style={styles.couponSuccessTitle}>Đã áp dụng {appliedCode}</Text><Text style={styles.couponSuccessText}>Giảm {formatVnd(discountAmount)}{total === undefined ? '' : ` · Tổng còn ${formatVnd(total)}`}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Gỡ mã giảm giá" disabled={disabled || busy} onPress={onRemove} style={styles.couponRemove}><Text style={styles.couponRemoveText}>Gỡ</Text></Pressable></View> : null}</View>;
}

type CheckoutItem = CheckoutQuote['items'][number];

function getCheckoutItems(quote: CheckoutQuote | null, cart: NonNullable<ReturnType<typeof useStore>['cart']>): CheckoutItem[] {
  return quote?.items ?? cart.items.map(item => ({ productId: item.productId, name: item.product.name, imageUrl: item.product.imageUrl, price: item.product.price, quantity: item.quantity, subtotal: item.subtotal }));
}

function OrderProducts({ quote, cart }: { quote: CheckoutQuote | null; cart: NonNullable<ReturnType<typeof useStore>['cart']> }) {
  const items = getCheckoutItems(quote, cart);
  return <View style={styles.card}><View style={styles.cardHeading}><View style={styles.headingIcon}><Ionicons name="bag-handle-outline" size={19} color="#755036" /></View><View style={styles.headingCopy}><Text style={styles.sectionTitle}>Sản phẩm trong đơn hàng</Text><Text style={styles.sectionHint}>{items.length} sản phẩm · Kiểm tra lại số lượng và thành tiền</Text></View></View>{items.map(item => <View key={item.productId} style={styles.productRow}><View style={styles.productThumb}>{item.imageUrl ? <Image source={{ uri: imageUrl(item.imageUrl) }} resizeMode="contain" style={styles.image} /> : <Ionicons name="image-outline" size={24} color="#CBA779" />}</View><View style={styles.productCopy}><Text numberOfLines={2} style={styles.itemName}>{item.name}</Text><Text style={styles.itemMeta}>{formatVnd(item.price)} · Số lượng {item.quantity}</Text></View><Text style={styles.itemPrice}>{formatVnd(item.subtotal)}</Text></View>)}</View>;
}

function PaymentCard({ method, cardAvailable, pendingOrderId, busy, pin, quoteLoading, quoteError, orderError, onMethodChange, onPinChange }: { method: PaymentMethod; cardAvailable: boolean; pendingOrderId: number | null; busy: boolean; pin: string; quoteLoading: boolean; quoteError: string; orderError: string; onMethodChange: (method: PaymentMethod) => void; onPinChange: (pin: string) => void }) {
  const selected = methods.find(item => item.value === method) ?? methods[0];
  return <View style={styles.card}><View style={styles.cardHeading}><View style={styles.headingIcon}><Ionicons name="card-outline" size={19} color="#755036" /></View><View style={styles.headingCopy}><Text style={styles.sectionTitle}>Phương thức thanh toán</Text><Text style={styles.sectionHint}>Chọn một phương thức được hỗ trợ để tiếp tục</Text></View></View><View style={styles.selectedMethod}><View style={styles.selectedIcon}><Ionicons name={selected.icon} size={22} color="#755036" /></View><View style={styles.flex}><Text style={styles.selectedLabel}>Đang chọn</Text><Text style={styles.selectedTitle}>{selected.title}</Text><Text style={styles.methodDescription}>{selected.description}</Text></View></View><View style={styles.methods}>{methods.map(item => { const disabled = (item.value === 'CARD' && !cardAvailable) || !!pendingOrderId || busy; const active = method === item.value; return <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: active, disabled }} disabled={disabled} onPress={() => onMethodChange(item.value)} style={[styles.method, active && styles.methodSelected, disabled && styles.methodDisabled]}><View style={[styles.radio, active && styles.radioSelected]}>{active && <View style={styles.radioDot} />}</View><View style={styles.methodIcon}><Ionicons name={item.icon} size={21} color={disabled ? '#B4A79D' : '#755036'} /></View><View style={styles.flex}><Text style={styles.methodTitle}>{item.title}</Text><Text style={styles.methodDescription}>{item.description}</Text>{item.value === 'CARD' && !cardAvailable && <Text style={styles.methodWarning}>Cần thẻ mô phỏng và PIN trong hồ sơ.</Text>}</View></Pressable>; })}</View>{method === 'CARD' && cardAvailable && <View style={styles.pinBox}><Text style={styles.label}>PIN thanh toán mô phỏng</Text><Text style={styles.pinHint}>Nhập PIN 6 số đã tạo trong hồ sơ. Không gửi PIN qua chatbot.</Text><TextInput value={pin} onChangeText={value => onPinChange(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="••••••" placeholderTextColor="#A08E80" style={styles.input} /></View>}{quoteLoading ? <View style={styles.inlineStatus}><ActivityIndicator size="small" color="#755036" /><Text style={styles.statusText}>Đang kiểm tra giá và tồn kho...</Text></View> : null}{quoteError ? <View style={styles.alert}><Ionicons name="alert-circle-outline" size={17} color="#9B382F" /><Text accessibilityRole="alert" style={styles.error}>{quoteError}</Text></View> : null}{orderError ? <View style={styles.alert}><Ionicons name="warning-outline" size={17} color="#9B382F" /><Text accessibilityRole="alert" style={styles.error}>{orderError}</Text></View> : null}</View>;
}

function OrderSummary({ quote, cart, compact }: { quote: CheckoutQuote | null; cart: NonNullable<ReturnType<typeof useStore>['cart']>; compact?: boolean }) {
  const items = getCheckoutItems(quote, cart);
  const subtotal = quote?.subtotal ?? cart.total;
  const discount = quote?.discountAmount ?? 0;
  const shipping = quote?.shippingFee;
  const total = quote?.total ?? cart.total;
  return <View style={[styles.summary, compact && styles.summaryCompact]}><View style={styles.summaryHeading}><View style={styles.headingIcon}><Ionicons name="receipt-outline" size={19} color="#755036" /></View><View style={styles.headingCopy}><Text style={styles.sectionTitle}>Tóm tắt đơn hàng</Text><Text style={styles.sectionHint}>Chi phí dự kiến theo báo giá hiện tại</Text></View></View><View style={styles.summaryTotals}><Line label="Tạm tính" value={formatVnd(subtotal)} /><Line label={quote?.couponCode ? `Mã ${quote.couponCode}` : 'Giảm giá'} value={discount ? `-${formatVnd(discount)}` : 'Không áp dụng'} positive={!!discount} /><Line label="Phí vận chuyển" value={shipping === undefined ? 'Đang xác nhận' : shipping === 0 ? 'Miễn phí' : formatVnd(shipping)} /></View><View style={[styles.totalLine, styles.summaryLine]}><Text style={styles.totalLabel}>Tổng thanh toán</Text><Text style={styles.totalValue}>{formatVnd(total)}</Text></View><View style={styles.summaryTrust}><Ionicons name="lock-closed-outline" size={15} color="#47724A" /><Text style={styles.trustText}>Thanh toán an toàn, thông tin được bảo mật.</Text></View></View>;
}

function Line({ label, value, positive = false }: { label: string; value: string; positive?: boolean }) {
  return <View style={styles.summaryLine}><Text style={styles.summaryLabel}>{label}</Text><Text style={[styles.summaryValue, positive && styles.discount]}>{value}</Text></View>;
}

const baseStyles = StyleSheet.create(withTypography({
  page: { flex: 1, backgroundColor: '#F6EFE6' }, scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 18 }, scrollCompact: { paddingHorizontal: 12, paddingTop: 12 }, content: { width: '100%', maxWidth: 1240, alignSelf: 'center' }, flex: { flex: 1 }, breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }, breadcrumbLink: { color: '#755036', fontSize: 12, fontWeight: '800' }, breadcrumbCurrent: { color: '#8B7A6C', fontSize: 12 }, progress: { marginBottom: 16, padding: 13, borderRadius: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E6D8C7' }, progressItem: { flexDirection: 'row', alignItems: 'center', gap: 8 }, done: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#47724A' }, active: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#755036' }, number: { color: '#fff', fontSize: 12, fontWeight: '900' }, doneText: { color: '#47724A', fontSize: 12, fontWeight: '900' }, activeText: { color: '#755036', fontSize: 12, fontWeight: '900' }, line: { flex: 1, height: 1, marginHorizontal: 12, backgroundColor: '#CBA779' }, layout: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 }, layoutCompact: { flexDirection: 'column' }, main: { flex: 1, minWidth: 0, gap: 16 }, card: { padding: 20, borderRadius: 18, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E1CFBA' }, cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 13, marginBottom: 13, borderBottomWidth: 1, borderBottomColor: '#E6D8C7' }, sectionTitle: { color: '#493629', fontSize: 18, fontWeight: '900' }, sectionHint: { color: '#8B7A6C', fontSize: 11, marginTop: 3 }, edit: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 }, editText: { color: '#755036', fontSize: 12, fontWeight: '800' }, recipientName: { color: '#30251D', fontSize: 14, fontWeight: '900' }, recipientText: { color: '#756456', fontSize: 12, lineHeight: 19 }, note: { marginTop: 8, color: '#8B7A6C', fontSize: 11, fontStyle: 'italic' }, methods: { gap: 9, marginTop: 16 }, method: { padding: 13, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#E6D8C7', backgroundColor: '#FFFCF7' }, methodSelected: { borderColor: '#755036', backgroundColor: '#FBF3E8' }, methodDisabled: { opacity: 0.55 }, radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#B9A99D', alignItems: 'center', justifyContent: 'center' }, radioSelected: { borderColor: '#755036' }, radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#755036' }, methodIcon: { width: 39, height: 39, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8D5BA' }, methodTitle: { color: '#493629', fontSize: 13, fontWeight: '900' }, methodDescription: { color: '#756456', fontSize: 11, lineHeight: 17, marginTop: 2 }, methodWarning: { color: '#9B382F', fontSize: 10, marginTop: 3 }, pinBox: { marginTop: 14, padding: 13, borderRadius: 11, backgroundColor: '#F6EFE6', borderWidth: 1, borderColor: '#E6D8C7' }, label: { color: '#493629', fontSize: 12, fontWeight: '800' }, pinHint: { color: '#756456', fontSize: 11, lineHeight: 17, marginTop: 4, marginBottom: 8 }, input: { minHeight: 44, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: '#D6BFA5', backgroundColor: '#fff', color: '#30251D', fontSize: 15, letterSpacing: 4 }, inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15 }, statusText: { color: '#756456', fontSize: 11 }, error: { marginTop: 13, color: '#9B382F', fontSize: 12, lineHeight: 18 }, actions: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }, primaryButton: { minHeight: 45, paddingHorizontal: 17, borderRadius: 9, backgroundColor: '#755036', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, primaryText: { color: '#fff', fontSize: 12, fontWeight: '800' }, secondaryButton: { minHeight: 45, paddingHorizontal: 13, borderRadius: 9, borderWidth: 1, borderColor: '#D6BFA5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, secondaryText: { color: '#755036', fontSize: 12, fontWeight: '800' }, disabled: { opacity: 0.5 }, summary: { width: 360, padding: 20, borderRadius: 18, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E1CFBA' }, summaryItem: { minHeight: 64, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: '#F0E7DD' }, thumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#F8F3EC', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, image: { width: '90%', height: '90%' }, summaryCopy: { flex: 1, minWidth: 0 }, itemName: { color: '#493629', fontSize: 11, lineHeight: 16, fontWeight: '800' }, itemMeta: { color: '#8B7A6C', fontSize: 10, marginTop: 2 }, itemPrice: { color: '#755036', fontSize: 11, fontWeight: '900' }, rule: { height: 1, marginVertical: 11, backgroundColor: '#E6D8C7' }, summaryLine: { marginTop: 11, flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, summaryLabel: { color: '#756456', fontSize: 12 }, summaryValue: { color: '#493629', fontSize: 12, fontWeight: '800', textAlign: 'right' }, discount: { color: '#47724A' }, totalLine: { paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E6D8C7' }, totalLabel: { color: '#493629', fontSize: 16, fontWeight: '900' }, totalValue: { color: '#755036', fontSize: 20, fontWeight: '900' }, state: { flex: 1, minHeight: 420, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 10 }, stateTitle: { color: '#493629', fontSize: 19, fontWeight: '900', textAlign: 'center' }, stateText: { color: '#7D6B5D', fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 440 },
}));

const styles = {
  ...baseStyles,
  ...StyleSheet.create(withTypography({
    page: { flex: 1, backgroundColor: '#F6EFE6' },
    scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 28 },
    scrollCompact: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 20 },
    content: { width: '100%', maxWidth: 1240, alignSelf: 'center' },
    hero: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18, padding: 18, borderRadius: 18, backgroundColor: '#E8D5BA', borderWidth: 1, borderColor: '#CBA779' },
    heroIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#755036' },
    heroCopy: { flex: 1, minWidth: 0 },
    eyebrow: { color: '#8A5B2C', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
    pageTitle: { color: '#30251D', fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 2 },
    pageSubtitle: { color: '#6D594A', fontSize: 12, lineHeight: 19, marginTop: 3 },
    breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    breadcrumbLink: { color: '#755036', fontSize: 12, fontWeight: '800' },
    breadcrumbCurrent: { color: '#8B7A6C', fontSize: 12 },
    progress: { marginBottom: 16, padding: 13, borderRadius: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E6D8C7' },
    progressItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    done: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#47724A' },
    active: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#755036' },
    number: { color: '#fff', fontSize: 12, fontWeight: '900' },
    doneText: { color: '#47724A', fontSize: 12, fontWeight: '900' },
    activeText: { color: '#755036', fontSize: 12, fontWeight: '900' },
    line: { flex: 1, height: 1, marginHorizontal: 12, backgroundColor: '#CBA779' },
    layout: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 },
    layoutCompact: { flexDirection: 'column' },
    main: { flex: 1, minWidth: 0, gap: 16 },
    card: { padding: 20, borderRadius: 16, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E6D8C7', shadowColor: '#755036', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
    cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 14, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#E6D8C7' },
    headingIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4E8D8' },
    headingCopy: { flex: 1, minWidth: 0 },
    sectionTitle: { color: '#493629', fontSize: 17, fontWeight: '900' },
    sectionHint: { color: '#8B7A6C', fontSize: 11, lineHeight: 17, marginTop: 2 },
    edit: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, padding: 7 },
    editText: { color: '#755036', fontSize: 12, fontWeight: '800' },
    shippingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    shippingField: { flex: 1, minWidth: 190 },
    fieldLabel: { color: '#9A887A', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
    recipientName: { color: '#30251D', fontSize: 14, fontWeight: '900' },
    recipientText: { color: '#625247', fontSize: 12, lineHeight: 19 },
    noteBox: { marginTop: 14, padding: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FBF3E8' },
    note: { flex: 1, color: '#7D6B5D', fontSize: 11, lineHeight: 17, fontStyle: 'italic' },
    couponRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    couponInput: { flex: 1, minHeight: 44, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: '#D6BFA5', backgroundColor: '#fff', color: '#30251D', fontSize: 13, fontWeight: '800' },
    couponApply: { minWidth: 92, minHeight: 44, paddingHorizontal: 14, borderRadius: 9, backgroundColor: '#755036', alignItems: 'center', justifyContent: 'center' },
    couponApplyText: { color: '#fff', fontSize: 11, fontWeight: '900' },
    couponChoices: { marginTop: 13, gap: 7 },
    couponChoiceLabel: { color: '#8B7A6C', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
    couponChoiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    couponChoice: { minWidth: 130, flexGrow: 1, padding: 9, borderRadius: 9, borderWidth: 1, borderColor: '#E6D8C7', backgroundColor: '#FBF3E8' },
    couponChoiceCode: { color: '#755036', fontSize: 11, fontWeight: '900' },
    couponChoiceDescription: { color: '#8B7A6C', fontSize: 9, marginTop: 2 },
    couponSuccess: { marginTop: 13, padding: 11, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EAF3E8', borderWidth: 1, borderColor: '#C6DCC2' },
    couponSuccessTitle: { color: '#47724A', fontSize: 12, fontWeight: '900' },
    couponSuccessText: { color: '#5C765E', fontSize: 10, marginTop: 2 },
    couponRemove: { paddingHorizontal: 8, paddingVertical: 6 },
    couponRemoveText: { color: '#9B382F', fontSize: 11, fontWeight: '900' },
    productRow: { minHeight: 76, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#F0E7DD' },
    productThumb: { width: 64, height: 64, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#F8F3EC', borderWidth: 1, borderColor: '#F0E7DD' },
    productCopy: { flex: 1, minWidth: 0 },
    itemName: { color: '#493629', fontSize: 12, lineHeight: 18, fontWeight: '800' },
    itemMeta: { color: '#8B7A6C', fontSize: 10, marginTop: 3 },
    itemPrice: { color: '#755036', fontSize: 12, fontWeight: '900', textAlign: 'right' },
    image: { width: '90%', height: '90%' },
    selectedMethod: { padding: 13, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#FBF3E8', borderWidth: 1, borderColor: '#CBA779' },
    selectedIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8D5BA' },
    flex: { flex: 1, minWidth: 0 },
    selectedLabel: { color: '#A56E2D', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
    selectedTitle: { color: '#493629', fontSize: 14, fontWeight: '900', marginTop: 2 },
    methods: { gap: 9, marginTop: 14 },
    method: { padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#E6D8C7', backgroundColor: '#FFFCF7' },
    methodSelected: { borderColor: '#755036', backgroundColor: '#FBF3E8' },
    methodDisabled: { opacity: 0.55 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#B9A99D', alignItems: 'center', justifyContent: 'center' },
    radioSelected: { borderColor: '#755036' },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#755036' },
    methodIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8D5BA' },
    methodTitle: { color: '#493629', fontSize: 13, fontWeight: '900' },
    methodDescription: { color: '#756456', fontSize: 11, lineHeight: 17, marginTop: 2 },
    methodWarning: { color: '#9B382F', fontSize: 10, lineHeight: 15, marginTop: 3 },
    pinBox: { marginTop: 14, padding: 13, borderRadius: 11, backgroundColor: '#F6EFE6', borderWidth: 1, borderColor: '#E6D8C7' },
    label: { color: '#493629', fontSize: 12, fontWeight: '800' },
    pinHint: { color: '#756456', fontSize: 11, lineHeight: 17, marginTop: 4, marginBottom: 8 },
    input: { minHeight: 44, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: '#D6BFA5', backgroundColor: '#fff', color: '#30251D', fontSize: 15, letterSpacing: 4 },
    inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15 },
    statusText: { color: '#756456', fontSize: 11 },
    alert: { marginTop: 13, padding: 10, borderRadius: 9, flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: '#FBEAE7' },
    error: { flex: 1, color: '#9B382F', fontSize: 12, lineHeight: 18 },
    actions: { marginTop: 2, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
    primaryButton: { minHeight: 48, flexGrow: 1, paddingHorizontal: 18, borderRadius: 10, backgroundColor: '#755036', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    primaryText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    secondaryButton: { minHeight: 48, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#D6BFA5', backgroundColor: '#FFFCF7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
    secondaryText: { color: '#755036', fontSize: 12, fontWeight: '800' },
    disabled: { opacity: 0.5 },
    summary: { width: 360, padding: 20, borderRadius: 16, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#CBA779', shadowColor: '#755036', shadowOpacity: 0.08, shadowRadius: 15, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
    summaryCompact: { width: '100%' },
    summaryHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 14, marginBottom: 3, borderBottomWidth: 1, borderBottomColor: '#E6D8C7' },
    summaryTotals: { marginTop: 5 },
    summaryLine: { marginTop: 11, flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    summaryLabel: { color: '#756456', fontSize: 12 },
    summaryValue: { color: '#493629', fontSize: 12, fontWeight: '800', textAlign: 'right' },
    discount: { color: '#47724A' },
    totalLine: { paddingTop: 15, marginTop: 16, borderTopWidth: 1, borderTopColor: '#E6D8C7' },
    totalLabel: { color: '#493629', fontSize: 16, fontWeight: '900' },
    totalValue: { color: '#755036', fontSize: 21, fontWeight: '900' },
    summaryTrust: { marginTop: 18, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#F0E7DD', flexDirection: 'row', alignItems: 'center', gap: 7 },
    trustText: { flex: 1, color: '#47724A', fontSize: 10, lineHeight: 15 },
    state: { flex: 1, minHeight: 420, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 10 },
    stateTitle: { color: '#493629', fontSize: 19, fontWeight: '900', textAlign: 'center' },
    stateText: { color: '#7D6B5D', fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 440 },
  }))
};
