import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { ApiError, couponApi, formatVnd, imageUrl, orderApi, type OrderInput } from '../api';
import { ChatWidget } from '../components/ChatWidget';
import { PageHeader } from '../components/PageHeader';
import { ProductFooter } from '../components/ProductFooter';
import { checkoutCart, useCheckoutProductId } from '../hooks/useCheckoutProduct';
import { useStore } from '../store';
import { withTypography } from '../typography';
import type { AvailableCoupon, CheckoutQuote, Coupon, PaymentMethod } from '../types';
import { ScrollTopButton, useScrollTop } from '../components/ScrollTopButton';
import { colors } from '../theme';

const methods: Array<{ value: PaymentMethod; title: string; description: string; icon: 'cash-outline' | 'qr-code-outline' | 'card-outline' }> = [
  { value: 'CASH', title: 'Tiền mặt khi nhận hàng', description: 'Kiểm tra sản phẩm và thanh toán cho nhân viên giao hàng.', icon: 'cash-outline' },
  { value: 'QR', title: 'PayOS / QR', description: 'Tạo link thanh toán PayOS để quét mã QR an toàn.', icon: 'qr-code-outline' },
  { value: 'CARD', title: 'Thẻ mô phỏng', description: 'Xác minh bằng PIN 6 số, không thu tiền thật.', icon: 'card-outline' },
];

export default function CheckoutPaymentPlaceholderScreen() {
  const top = useScrollTop();
  const router = useRouter();
  const compact = useWindowDimensions().width < 860;
  const { authReady, cart: fullCart, cartError, cartLoading, checkoutCouponCode, checkoutShipping, refreshCart, setCheckoutCouponCode, setCheckoutPaymentPin, user } = useStore();
  const productId = useCheckoutProductId();
  const cart = useMemo(() => checkoutCart(fullCart, productId), [fullCart, productId]);
  const infoRoute = { pathname: '/checkout/info' as const, params: productId ? { productId: String(productId) } : {} };
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
  const [availableCoupons, setAvailableCoupons] = useState<AvailableCoupon[]>([]);
  const [availableCouponsLoading, setAvailableCouponsLoading] = useState(false);
  const [availableCouponsError, setAvailableCouponsError] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState('');

  const cardAvailable = !!user?.savedCard && !!user.hasTransactionPin;
  const address = checkoutShipping ? [checkoutShipping.address, checkoutShipping.district, checkoutShipping.province].filter(Boolean).join(', ') : '';
  const payload = useMemo<OrderInput | null>(() => checkoutShipping && user ? ({ fullName: checkoutShipping.fullName, email: user.email, phone: checkoutShipping.phone, address, paymentMethod: method, note: checkoutShipping.note || undefined, couponCode: appliedCouponCode || undefined, productId }) : null, [address, appliedCouponCode, checkoutShipping, method, productId, user]);

  useEffect(() => {
    if (method === 'CARD' && !cardAvailable) setMethod('CASH');
  }, [cardAvailable, method]);

  useEffect(() => {
    if (!user || !cart?.items.length) {
      setAvailableCoupons([]);
      return;
    }
    let active = true;
    setAvailableCouponsLoading(true);
    setAvailableCouponsError('');
    void couponApi.available(productId).then(coupons => {
      if (!active) return;
      setAvailableCoupons(coupons);
      if (appliedCouponCode && !coupons.some(item => item.coupon.code === appliedCouponCode)) {
        setCouponInput('');
        setAppliedCouponCode('');
        setCheckoutCouponCode('');
        setQuote(null);
        setCouponError('Voucher đã chọn không còn phù hợp với giỏ hàng và đã được gỡ.');
      }
    }).catch(error => {
      if (!active) return;
      setAvailableCoupons([]);
      setAvailableCouponsError(error instanceof Error ? error.message : 'Không thể tải voucher phù hợp.');
    }).finally(() => { if (active) setAvailableCouponsLoading(false); });
    return () => { active = false; };
  }, [cart, productId, setCheckoutCouponCode, user]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) { router.replace({ pathname: '/login', params: { redirect: '/checkout/payment' } }); return; }
    if (!checkoutShipping) { router.replace(infoRoute); return; }
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
      const result = await couponApi.validate(code, cart.total, productId);
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

  if (!authReady || !user || !checkoutShipping || (cartLoading && !cart)) return <View style={styles.page}><PageHeader back /><View style={styles.state}><ActivityIndicator size="large" color={colors.ink} /><Text style={styles.stateText}>Đang chuẩn bị phương thức thanh toán...</Text></View></View>;
  if (cartError && !cart) return <View style={styles.page}><PageHeader back /><View style={styles.state}><Ionicons name="alert-circle-outline" size={42} color={colors.danger} /><Text style={styles.stateTitle}>Chưa thể tải giỏ hàng</Text><Text style={styles.stateText}>{cartError}</Text><Pressable style={styles.primaryButton} onPress={() => void refreshCart().catch(() => {})}><Text style={styles.primaryText}>Thử lại</Text></Pressable></View></View>;
  if (!cart) return <View style={styles.page}><PageHeader back /><View style={styles.state}><ActivityIndicator size="large" color={colors.ink} /><Text style={styles.stateText}>Đang chuẩn bị phương thức thanh toán...</Text></View></View>;
  if (!cart.items.length && !pendingOrderId) return <View style={styles.page}><PageHeader back /><View style={styles.state}><Ionicons name="bag-outline" size={45} color={colors.ink} /><Text style={styles.stateTitle}>Giỏ hàng đang trống</Text><Text style={styles.stateText}>Không thể tiếp tục thanh toán khi chưa có sản phẩm.</Text><Pressable style={styles.primaryButton} onPress={() => router.replace('/products')}><Text style={styles.primaryText}>Tiếp tục mua sắm</Text></Pressable></View></View>;

  return (
    <View style={styles.page}>
      <PageHeader back />
      <ScrollView ref={top.ref} onScroll={top.onScroll} scrollEventThrottle={100} contentContainerStyle={[styles.scroll, compact && styles.scrollCompact]} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Breadcrumb router={router} />
          <View style={styles.hero}>
            <View style={styles.heroIcon}><Ionicons name="shield-checkmark-outline" size={22} color={colors.white} /></View>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>CHECKOUT</Text>
              <Text style={styles.pageTitle}>Xác nhận đơn hàng</Text>
              <Text style={styles.pageSubtitle}>Kiểm tra thông tin và chọn phương thức thanh toán để hoàn tất đơn hàng.</Text>
            </View>
          </View>
          <Progress />
          <View style={[styles.layout, compact && styles.layoutCompact]}>
            <View style={styles.main}>
              <ShippingCard shipping={checkoutShipping} email={user.email} onEdit={() => router.replace(infoRoute)} />
              <OrderProducts quote={quote} cart={cart} />
              <PaymentCard method={method} cardAvailable={cardAvailable} pendingOrderId={pendingOrderId} busy={busy || couponBusy} pin={pin} quoteLoading={quoteLoading} quoteError={quoteError} orderError={orderError} onMethodChange={next => { setMethod(next); setQuote(null); }} onPinChange={setPin} />
            </View>
            <View style={[styles.side, compact && styles.sideCompact]}>
              <CouponCard value={couponInput} availableCoupons={availableCoupons} availableLoading={availableCouponsLoading} availableError={availableCouponsError} appliedCode={quote?.couponCode === appliedCouponCode ? appliedCouponCode : ''} discountAmount={quote?.discountAmount ?? 0} total={quote?.total} busy={couponBusy || (quoteLoading && !!appliedCouponCode)} disabled={busy || !!pendingOrderId} error={couponError} onChange={updateCouponInput} onApply={() => void applyCoupon()} onChoose={code => { setCouponInput(code); void applyCoupon(code); }} onRemove={removeCoupon} />
              <OrderSummary quote={quote} cart={cart} compact={compact} />
              <View style={styles.sideActions}>
                <Pressable style={[styles.primaryButton, (busy || couponBusy || quoteLoading || (!quote && !pendingOrderId)) && styles.disabled]} disabled={busy || couponBusy || quoteLoading || (!quote && !pendingOrderId)} onPress={() => void placeOrder()}>
                  {busy ? <ActivityIndicator color={colors.white} /> : <><Ionicons name={method === 'CASH' ? 'checkmark-circle-outline' : method === 'CARD' ? 'card-outline' : 'qr-code-outline'} size={18} color={colors.white} /><Text style={styles.primaryText}>{pendingOrderId && method === 'QR' ? 'Mở lại link PayOS' : pendingOrderId && method === 'CARD' ? 'Xác nhận PIN' : method === 'CASH' ? 'Xác nhận đơn hàng' : method === 'CARD' ? 'Thanh toán mô phỏng' : 'Thanh toán PayOS / QR'}</Text></>}
                </Pressable>
                <Pressable style={styles.secondaryButton} disabled={busy} onPress={() => router.replace(infoRoute)}>
                  <Ionicons name="arrow-back" size={17} color={colors.ink} /><Text style={styles.secondaryText}>Sửa thông tin giao hàng</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
        <ProductFooter />
      </ScrollView>
      <ScrollTopButton visible={top.visible} onPress={top.toTop} />
      <ChatWidget compact={compact} />
    </View>
  );
}

function Breadcrumb({ router }: { router: ReturnType<typeof useRouter> }) {
  return <View style={styles.breadcrumb}><Pressable onPress={() => router.replace('/')}><Text style={styles.breadcrumbLink}>Trang chủ</Text></Pressable><Ionicons name="chevron-forward" size={14} color={colors.muted} /><Pressable onPress={() => router.replace('/cart')}><Text style={styles.breadcrumbLink}>Giỏ hàng</Text></Pressable><Ionicons name="chevron-forward" size={14} color={colors.muted} /><Text style={styles.breadcrumbCurrent}>Thanh toán</Text></View>;
}

function Progress() {
  return <View style={styles.progress}><View style={styles.progressItem}><View style={styles.done}><Ionicons name="checkmark" size={15} color={colors.white} /></View><Text style={styles.doneText}>Thông tin giao hàng</Text></View><View style={styles.line} /><View style={styles.progressItem}><View style={styles.active}><Text style={styles.number}>2</Text></View><Text style={styles.activeText}>Phương thức thanh toán</Text></View><View style={styles.line} /><View style={styles.progressItem}><View style={[styles.active, { backgroundColor: colors.bg }]}><Text style={[styles.number, { color: colors.muted }]}>3</Text></View><Text style={[styles.activeText, { color: colors.muted }]}>Hoàn tất</Text></View></View>;
}

function ShippingCard({ shipping, email, onEdit }: { shipping: NonNullable<ReturnType<typeof useStore>['checkoutShipping']>; email: string; onEdit: () => void }) {
  return <View style={styles.card}><View style={styles.cardHeading}><View style={styles.headingIcon}><Ionicons name="location-outline" size={19} color={colors.ink} /></View><View style={styles.headingCopy}><Text style={styles.sectionTitle}>Thông tin giao hàng</Text><Text style={styles.sectionHint}>Thông tin đã xác nhận ở bước 1</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Sửa thông tin giao hàng" onPress={onEdit} style={styles.edit}><Ionicons name="create-outline" size={15} color={colors.ink} /><Text style={styles.editText}>Sửa</Text></Pressable></View><View style={styles.shippingGrid}><View style={styles.shippingField}><Text style={styles.fieldLabel}>Người nhận</Text><Text style={styles.recipientName}>{shipping.fullName}</Text></View><View style={styles.shippingField}><Text style={styles.fieldLabel}>Điện thoại</Text><Text style={styles.recipientText}>{shipping.phone}</Text></View><View style={styles.shippingField}><Text style={styles.fieldLabel}>Email</Text><Text style={styles.recipientText}>{email}</Text></View><View style={styles.shippingField}><Text style={styles.fieldLabel}>Địa chỉ giao hàng</Text><Text style={styles.recipientText}>{[shipping.address, shipping.district, shipping.province].filter(Boolean).join(', ')}</Text></View></View>{shipping.note ? <View style={styles.noteBox}><Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.ink} /><Text style={styles.note}>Ghi chú: {shipping.note}</Text></View> : null}</View>;
}

function CouponCard({ value, availableCoupons, availableLoading, availableError, appliedCode, discountAmount, total, busy, disabled, error, onChange, onApply, onChoose, onRemove }: { value: string; availableCoupons: AvailableCoupon[]; availableLoading: boolean; availableError: string; appliedCode: string; discountAmount: number; total?: number; busy: boolean; disabled: boolean; error: string; onChange: (value: string) => void; onApply: () => void; onChoose: (code: string) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  return <View style={styles.card}><View style={styles.cardHeading}><View style={styles.headingIcon}><Ionicons name="ticket-outline" size={19} color={colors.ink} /></View><View style={styles.headingCopy}><Text style={styles.sectionTitle}>Mã giảm giá</Text><Text style={styles.sectionHint}>Giảm giá và tổng tiền được xác nhận trực tiếp từ Backend</Text></View></View><View style={styles.couponRow}><TextInput accessibilityLabel="Mã giảm giá" value={value} editable={!disabled && !busy} autoCapitalize="characters" autoCorrect={false} maxLength={80} returnKeyType="done" onSubmitEditing={onApply} onChangeText={onChange} placeholder="Nhập mã giảm giá" placeholderTextColor={colors.muted} style={styles.couponInput} /><Pressable accessibilityRole="button" disabled={disabled || busy || !value.trim()} onPress={onApply} style={[styles.couponApply, (disabled || busy || !value.trim()) && styles.disabled]}>{busy ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.couponApplyText}>Áp dụng</Text>}</Pressable></View><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} disabled={disabled} onPress={() => setOpen(current => !current)} style={styles.couponPickerToggle}><Ionicons name="ticket-outline" size={17} color={colors.ink} /><Text style={styles.couponPickerToggleText}>{open ? 'Đóng danh sách voucher' : 'Chọn voucher phù hợp'}</Text><Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} /></Pressable>{open ? <View style={styles.couponChoices}>{availableLoading ? <View style={styles.couponLoading}><ActivityIndicator size="small" color={colors.ink} /><Text style={styles.couponChoiceDescription}>Đang kiểm tra voucher phù hợp...</Text></View> : availableError ? <Text accessibilityRole="alert" style={styles.couponListError}>{availableError}</Text> : availableCoupons.length === 0 ? <Text style={styles.couponEmpty}>Hiện không có voucher phù hợp với đơn hàng của bạn.</Text> : availableCoupons.map(item => { const coupon = item.coupon; const selected = coupon.code === appliedCode; return <Pressable key={coupon.id} accessibilityRole="button" accessibilityState={{ selected }} disabled={disabled || busy} onPress={() => { setOpen(false); onChoose(coupon.code); }} style={[styles.couponChoice, selected && styles.couponChoiceSelected]}><View style={styles.couponChoiceTop}><Text style={styles.couponChoiceCode}>{coupon.code}</Text>{selected ? <Text style={styles.couponSelectedBadge}>Đang dùng</Text> : null}</View><Text style={styles.couponChoiceValue}>{couponOffer(coupon)} · Giảm thực tế {formatVnd(item.discountAmount)}</Text><Text style={styles.couponChoiceDescription}>{coupon.description || 'Áp dụng cho đơn hàng đủ điều kiện.'}</Text><Text style={styles.couponChoiceExpiry}>Hạn dùng: {new Date(coupon.endDate).toLocaleDateString('vi-VN')}</Text></Pressable>; })}</View> : null}{error ? <View style={styles.alert}><Ionicons name="alert-circle-outline" size={17} color={colors.danger} /><Text accessibilityRole="alert" style={styles.error}>{error}</Text></View> : null}{appliedCode ? <View style={styles.couponSuccess}><Ionicons name="checkmark-circle" size={19} color={colors.success} /><View style={styles.flex}><Text style={styles.couponSuccessTitle}>Đã áp dụng {appliedCode}</Text><Text style={styles.couponSuccessText}>Giảm {formatVnd(discountAmount)}{total === undefined ? '' : ` · Tổng còn ${formatVnd(total)}`}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Gỡ mã giảm giá" disabled={disabled || busy} onPress={onRemove} style={styles.couponRemove}><Text style={styles.couponRemoveText}>Gỡ</Text></Pressable></View> : null}</View>;
}

function couponOffer(coupon: Coupon) {
  if (coupon.discountType === 'fixed') return `Giảm ${formatVnd(Number(coupon.discountValue))}`;
  const cap = coupon.maxDiscountAmount === null ? '' : `, tối đa ${formatVnd(Number(coupon.maxDiscountAmount))}`;
  return `Giảm ${Number(coupon.discountValue)}%${cap}`;
}

type CheckoutItem = CheckoutQuote['items'][number];

function getCheckoutItems(quote: CheckoutQuote | null, cart: NonNullable<ReturnType<typeof useStore>['cart']>): CheckoutItem[] {
  return quote?.items ?? cart.items.map(item => ({ productId: item.productId, name: item.product.name, imageUrl: item.product.imageUrl, price: item.product.price, quantity: item.quantity, subtotal: item.subtotal }));
}

function OrderProducts({ quote, cart }: { quote: CheckoutQuote | null; cart: NonNullable<ReturnType<typeof useStore>['cart']> }) {
  const items = getCheckoutItems(quote, cart);
  return <View style={styles.card}><View style={styles.cardHeading}><View style={styles.headingIcon}><Ionicons name="bag-handle-outline" size={19} color={colors.ink} /></View><View style={styles.headingCopy}><Text style={styles.sectionTitle}>Sản phẩm trong đơn hàng</Text><Text style={styles.sectionHint}>{items.length} sản phẩm · Kiểm tra lại số lượng và thành tiền</Text></View></View>{items.map(item => <View key={item.productId} style={styles.productRow}><View style={styles.productThumb}>{item.imageUrl ? <Image source={{ uri: imageUrl(item.imageUrl) }} resizeMode="contain" style={styles.image} /> : <Ionicons name="image-outline" size={24} color={colors.muted} />}</View><View style={styles.productCopy}><Text numberOfLines={2} style={styles.itemName}>{item.name}</Text><Text style={styles.itemMeta}>{formatVnd(item.price)} · Số lượng {item.quantity}</Text></View><Text style={styles.itemPrice}>{formatVnd(item.subtotal)}</Text></View>)}</View>;
}

function PaymentCard({ method, cardAvailable, pendingOrderId, busy, pin, quoteLoading, quoteError, orderError, onMethodChange, onPinChange }: { method: PaymentMethod; cardAvailable: boolean; pendingOrderId: number | null; busy: boolean; pin: string; quoteLoading: boolean; quoteError: string; orderError: string; onMethodChange: (method: PaymentMethod) => void; onPinChange: (pin: string) => void }) {
  const selected = methods.find(item => item.value === method) ?? methods[0];
  return <View style={styles.card}><View style={styles.cardHeading}><View style={styles.headingIcon}><Ionicons name="card-outline" size={19} color={colors.ink} /></View><View style={styles.headingCopy}><Text style={styles.sectionTitle}>Phương thức thanh toán</Text><Text style={styles.sectionHint}>Chọn một phương thức được hỗ trợ để tiếp tục</Text></View></View><View style={styles.selectedMethod}><View style={styles.selectedIcon}><Ionicons name={selected.icon} size={22} color={colors.ink} /></View><View style={styles.flex}><Text style={styles.selectedLabel}>Đang chọn</Text><Text style={styles.selectedTitle}>{selected.title}</Text><Text style={styles.methodDescription}>{selected.description}</Text></View></View><View style={styles.methods}>{methods.map(item => { const disabled = (item.value === 'CARD' && !cardAvailable) || !!pendingOrderId || busy; const active = method === item.value; return <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: active, disabled }} disabled={disabled} onPress={() => onMethodChange(item.value)} style={[styles.method, active && styles.methodSelected, disabled && styles.methodDisabled]}><View style={[styles.radio, active && styles.radioSelected]}>{active && <View style={styles.radioDot} />}</View><View style={styles.methodIcon}><Ionicons name={item.icon} size={21} color={disabled ? colors.subtle : colors.ink} /></View><View style={styles.flex}><Text style={styles.methodTitle}>{item.title}</Text><Text style={styles.methodDescription}>{item.description}</Text>{item.value === 'CARD' && !cardAvailable && <Text style={styles.methodWarning}>Cần thẻ mô phỏng và PIN trong hồ sơ.</Text>}</View></Pressable>; })}</View>{method === 'CARD' && cardAvailable && <View style={styles.pinBox}><Text style={styles.label}>PIN thanh toán mô phỏng</Text><Text style={styles.pinHint}>Nhập PIN 6 số đã tạo trong hồ sơ. Không gửi PIN qua chatbot.</Text><TextInput value={pin} onChangeText={value => onPinChange(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="••••••" placeholderTextColor={colors.muted} style={styles.input} /></View>}{quoteLoading ? <View style={styles.inlineStatus}><ActivityIndicator size="small" color={colors.ink} /><Text style={styles.statusText}>Đang kiểm tra giá và tồn kho...</Text></View> : null}{quoteError ? <View style={styles.alert}><Ionicons name="alert-circle-outline" size={17} color={colors.danger} /><Text accessibilityRole="alert" style={styles.error}>{quoteError}</Text></View> : null}{orderError ? <View style={styles.alert}><Ionicons name="warning-outline" size={17} color={colors.danger} /><Text accessibilityRole="alert" style={styles.error}>{orderError}</Text></View> : null}</View>;
}

function OrderSummary({ quote, cart, compact }: { quote: CheckoutQuote | null; cart: NonNullable<ReturnType<typeof useStore>['cart']>; compact?: boolean }) {
  const items = getCheckoutItems(quote, cart);
  const subtotal = quote?.subtotal ?? cart.total;
  const discount = quote?.discountAmount ?? 0;
  const shipping = quote?.shippingFee;
  const total = quote?.total ?? cart.total;
  return <View style={[styles.summary, compact && styles.summaryCompact]}><View style={styles.summaryHeading}><View style={styles.headingIcon}><Ionicons name="receipt-outline" size={19} color={colors.ink} /></View><View style={styles.headingCopy}><Text style={styles.sectionTitle}>Tóm tắt đơn hàng</Text><Text style={styles.sectionHint}>Chi phí dự kiến theo báo giá hiện tại</Text></View></View><View style={styles.summaryTotals}><Line label="Tạm tính" value={formatVnd(subtotal)} /><Line label={quote?.couponCode ? `Mã ${quote.couponCode}` : 'Giảm giá'} value={discount ? `-${formatVnd(discount)}` : 'Không áp dụng'} positive={!!discount} /><Line label="Phí vận chuyển" value={shipping === undefined ? 'Đang xác nhận' : shipping === 0 ? 'Miễn phí' : formatVnd(shipping)} /></View><View style={[styles.totalLine, styles.summaryLine]}><Text style={styles.totalLabel}>Tổng thanh toán</Text><Text style={styles.totalValue}>{formatVnd(total)}</Text></View><View style={styles.summaryTrust}><Ionicons name="lock-closed-outline" size={15} color={colors.success} /><Text style={styles.trustText}>Thanh toán an toàn, thông tin được bảo mật.</Text></View></View>;
}

function Line({ label, value, positive = false }: { label: string; value: string; positive?: boolean }) {
  return <View style={styles.summaryLine}><Text style={styles.summaryLabel}>{label}</Text><Text style={[styles.summaryValue, positive && styles.discount]}>{value}</Text></View>;
}

const baseStyles = StyleSheet.create(withTypography({
  page: { flex: 1, backgroundColor: colors.bg }, scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 18 }, scrollCompact: { paddingHorizontal: 12, paddingTop: 12 }, content: { width: '100%', maxWidth: 1240, alignSelf: 'center' }, flex: { flex: 1 }, breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }, breadcrumbLink: { color: colors.ink, fontSize: 12, fontWeight: '800' }, breadcrumbCurrent: { color: colors.muted, fontSize: 12 }, progress: { marginBottom: 16, padding: 13, borderRadius: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }, progressItem: { flexDirection: 'row', alignItems: 'center', gap: 8 }, done: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success }, active: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand }, number: { color: colors.white, fontSize: 12, fontWeight: '900' }, doneText: { color: colors.success, fontSize: 12, fontWeight: '900' }, activeText: { color: colors.ink, fontSize: 12, fontWeight: '900' }, line: { flex: 1, height: 1, marginHorizontal: 12, backgroundColor: colors.subtle }, layout: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 }, layoutCompact: { flexDirection: 'column' }, main: { flex: 1, minWidth: 0, gap: 16 }, card: { padding: 20, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }, cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 13, marginBottom: 13, borderBottomWidth: 1, borderBottomColor: colors.line }, sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' }, sectionHint: { color: colors.muted, fontSize: 11, marginTop: 3 }, edit: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 }, editText: { color: colors.ink, fontSize: 12, fontWeight: '800' }, recipientName: { color: colors.ink, fontSize: 14, fontWeight: '900' }, recipientText: { color: colors.muted, fontSize: 12, lineHeight: 19 }, note: { marginTop: 8, color: colors.muted, fontSize: 11, fontStyle: 'italic' }, methods: { gap: 9, marginTop: 16 }, method: { padding: 13, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white }, methodSelected: { borderColor: colors.brand, backgroundColor: colors.bg }, methodDisabled: { opacity: 0.55 }, radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.subtle, alignItems: 'center', justifyContent: 'center' }, radioSelected: { borderColor: colors.brand }, radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand }, methodIcon: { width: 39, height: 39, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.line }, methodTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' }, methodDescription: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 2 }, methodWarning: { color: colors.danger, fontSize: 12, marginTop: 3 }, pinBox: { marginTop: 14, padding: 13, borderRadius: 11, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line }, label: { color: colors.ink, fontSize: 12, fontWeight: '800' }, pinHint: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 4, marginBottom: 8 }, input: { minHeight: 44, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: colors.subtle, backgroundColor: colors.white, color: colors.ink, fontSize: 15, letterSpacing: 4 }, inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15 }, statusText: { color: colors.muted, fontSize: 11 }, error: { marginTop: 13, color: colors.danger, fontSize: 12, lineHeight: 18 }, actions: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }, primaryButton: { minHeight: 45, paddingHorizontal: 17, borderRadius: 999, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, primaryText: { color: colors.white, fontSize: 12, fontWeight: '800' }, secondaryButton: { minHeight: 45, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: colors.subtle, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, secondaryText: { color: colors.ink, fontSize: 12, fontWeight: '800' }, disabled: { opacity: 0.5 }, summary: { width: 360, padding: 20, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }, summaryItem: { minHeight: 64, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: colors.lineSoft }, thumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, image: { width: '90%', height: '90%' }, summaryCopy: { flex: 1, minWidth: 0 }, itemName: { color: colors.ink, fontSize: 11, lineHeight: 16, fontWeight: '800' }, itemMeta: { color: colors.muted, fontSize: 12, marginTop: 2 }, itemPrice: { color: colors.ink, fontSize: 11, fontWeight: '900' }, rule: { height: 1, marginVertical: 11, backgroundColor: colors.line }, summaryLine: { marginTop: 11, flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, summaryLabel: { color: colors.muted, fontSize: 12 }, summaryValue: { color: colors.ink, fontSize: 12, fontWeight: '800', textAlign: 'right' }, discount: { color: colors.success }, totalLine: { paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line }, totalLabel: { color: colors.ink, fontSize: 16, fontWeight: '900' }, totalValue: { color: colors.ink, fontSize: 20, fontWeight: '900' }, state: { flex: 1, minHeight: 420, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 10 }, stateTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', textAlign: 'center' }, stateText: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 440 },
}));

const styles = {
  ...baseStyles,
  ...StyleSheet.create(withTypography({
    page: { flex: 1, backgroundColor: colors.bg },
    scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 28 },
    scrollCompact: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 20 },
    content: { width: '100%', maxWidth: 1240, alignSelf: 'center', paddingBottom: 40 },
    hero: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18, padding: 18, borderRadius: 18, backgroundColor: colors.line, borderWidth: 1, borderColor: colors.subtle },
    heroIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
    heroCopy: { flex: 1, minWidth: 0 },
    eyebrow: { color: colors.ink, fontSize: 12, fontWeight: '900', letterSpacing: 1.3 },
    pageTitle: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 2 },
    pageSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 3 },
    breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    breadcrumbLink: { color: colors.ink, fontSize: 12, fontWeight: '800' },
    breadcrumbCurrent: { color: colors.muted, fontSize: 12 },
    progress: { marginBottom: 16, padding: 13, borderRadius: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
    progressItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    done: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success },
    active: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
    number: { color: colors.white, fontSize: 12, fontWeight: '900' },
    doneText: { color: colors.success, fontSize: 12, fontWeight: '900' },
    activeText: { color: colors.ink, fontSize: 12, fontWeight: '900' },
    line: { flex: 1, height: 1, marginHorizontal: 12, backgroundColor: colors.subtle },
    layout: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 },
    layoutCompact: { flexDirection: 'column' },
    main: { flex: 1, minWidth: 0, gap: 16 },
    card: { padding: 20, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, shadowColor: colors.ink, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
    cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 14, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
    headingIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lineSoft },
    headingCopy: { flex: 1, minWidth: 0 },
    sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
    sectionHint: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 2 },
    edit: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, padding: 7 },
    editText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
    shippingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    shippingField: { flex: 1, minWidth: 190 },
    fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
    recipientName: { color: colors.ink, fontSize: 14, fontWeight: '900' },
    recipientText: { color: colors.muted, fontSize: 12, lineHeight: 19 },
    noteBox: { marginTop: 14, padding: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.bg },
    note: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17, fontStyle: 'italic' },
    couponRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    couponInput: { flex: 1, minHeight: 44, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: colors.subtle, backgroundColor: colors.white, color: colors.ink, fontSize: 13, fontWeight: '800' },
    couponApply: { minWidth: 92, minHeight: 44, paddingHorizontal: 14, borderRadius: 9, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
    couponApplyText: { color: colors.white, fontSize: 11, fontWeight: '900' },
    couponPickerToggle: { minHeight: 42, marginTop: 10, paddingHorizontal: 11, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg, flexDirection: 'row', alignItems: 'center', gap: 7 },
    couponPickerToggleText: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '800' },
    couponChoices: { marginTop: 10, gap: 8 },
    couponLoading: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    couponChoice: { width: '100%', padding: 11, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
    couponChoiceSelected: { borderColor: colors.success, backgroundColor: '#F1F7EF' },
    couponChoiceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    couponChoiceCode: { color: colors.ink, fontSize: 12, fontWeight: '900' },
    couponSelectedBadge: { color: colors.success, fontSize: 11, fontWeight: '900' },
    couponChoiceValue: { color: colors.ink, fontSize: 11, fontWeight: '800', marginTop: 4 },
    couponChoiceDescription: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
    couponChoiceExpiry: { color: colors.muted, fontSize: 11, marginTop: 4 },
    couponEmpty: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingVertical: 12 },
    couponListError: { color: colors.danger, fontSize: 12, lineHeight: 18, paddingVertical: 8 },
    couponSuccess: { marginTop: 13, padding: 11, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EAF3E8', borderWidth: 1, borderColor: '#C6DCC2' },
    couponSuccessTitle: { color: colors.success, fontSize: 12, fontWeight: '900' },
    couponSuccessText: { color: colors.muted, fontSize: 12, marginTop: 2 },
    couponRemove: { paddingHorizontal: 8, paddingVertical: 6 },
    couponRemoveText: { color: colors.danger, fontSize: 11, fontWeight: '900' },
    productRow: { minHeight: 76, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
    productThumb: { width: 64, height: 64, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.lineSoft },
    productCopy: { flex: 1, minWidth: 0 },
    itemName: { color: colors.ink, fontSize: 12, lineHeight: 18, fontWeight: '800' },
    itemMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
    itemPrice: { color: colors.ink, fontSize: 12, fontWeight: '900', textAlign: 'right' },
    image: { width: '90%', height: '90%' },
    selectedMethod: { padding: 13, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.subtle },
    selectedIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.line },
    flex: { flex: 1, minWidth: 0 },
    selectedLabel: { color: colors.ink, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
    selectedTitle: { color: colors.ink, fontSize: 14, fontWeight: '900', marginTop: 2 },
    methods: { gap: 9, marginTop: 14 },
    method: { padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
    methodSelected: { borderColor: colors.brand, backgroundColor: colors.bg },
    methodDisabled: { opacity: 0.55 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.subtle, alignItems: 'center', justifyContent: 'center' },
    radioSelected: { borderColor: colors.brand },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
    methodIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.line },
    methodTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
    methodDescription: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 2 },
    methodWarning: { color: colors.danger, fontSize: 12, lineHeight: 15, marginTop: 3 },
    pinBox: { marginTop: 14, padding: 13, borderRadius: 11, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line },
    label: { color: colors.ink, fontSize: 12, fontWeight: '800' },
    pinHint: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 4, marginBottom: 8 },
    input: { minHeight: 44, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: colors.subtle, backgroundColor: colors.white, color: colors.ink, fontSize: 15, letterSpacing: 4 },
    inlineStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15 },
    statusText: { color: colors.muted, fontSize: 11 },
    alert: { marginTop: 13, padding: 10, borderRadius: 9, flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: '#FBEAE7' },
    error: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 18 },
    actions: { marginTop: 2, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
    primaryButton: { minHeight: 48, flexGrow: 1, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    primaryText: { color: colors.white, fontSize: 12, fontWeight: '800' },
    secondaryButton: { minHeight: 48, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.subtle, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
    secondaryText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
    disabled: { opacity: 0.5 },
    side: { width: 360, gap: 16 },
    sideCompact: { width: '100%' },
    sideActions: { gap: 10 },
    summary: { width: '100%', padding: 20, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.subtle, shadowColor: colors.ink, shadowOpacity: 0.08, shadowRadius: 15, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
    summaryCompact: { width: '100%' },
    summaryHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 14, marginBottom: 3, borderBottomWidth: 1, borderBottomColor: colors.line },
    summaryTotals: { marginTop: 5 },
    summaryLine: { marginTop: 11, flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    summaryLabel: { color: colors.muted, fontSize: 12 },
    summaryValue: { color: colors.ink, fontSize: 12, fontWeight: '800', textAlign: 'right' },
    discount: { color: colors.success },
    totalLine: { paddingTop: 15, marginTop: 16, borderTopWidth: 1, borderTopColor: colors.line },
    totalLabel: { color: colors.ink, fontSize: 16, fontWeight: '900' },
    totalValue: { color: colors.ink, fontSize: 21, fontWeight: '900' },
    summaryTrust: { marginTop: 18, paddingTop: 13, borderTopWidth: 1, borderTopColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center', gap: 7 },
    trustText: { flex: 1, color: colors.success, fontSize: 12, lineHeight: 15 },
    state: { flex: 1, minHeight: 420, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 10 },
    stateTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', textAlign: 'center' },
    stateText: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 440 },
  }))
};
