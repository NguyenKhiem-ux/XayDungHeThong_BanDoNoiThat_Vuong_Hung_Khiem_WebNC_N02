import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { accountApi, formatVnd, imageUrl } from '../api';
import { ChatWidget } from '../components/ChatWidget';
import { PageHeader } from '../components/PageHeader';
import { ProductFooter } from '../components/ProductFooter';
import { checkoutCart, useCheckoutProductId } from '../hooks/useCheckoutProduct';
import { useStore } from '../store';
import { withTypography } from '../typography';
import type { CheckoutShipping } from '../types';
import { ScrollTopButton, useScrollTop } from '../components/ScrollTopButton';
import { colors } from '../theme';

type FieldKey = keyof CheckoutShipping;
type Errors = Partial<Record<FieldKey, string>>;

const emptyForm: CheckoutShipping = { fullName: '', phone: '', province: '', district: '', address: '', note: '' };

export default function CheckoutInfoScreen() {
  const top = useScrollTop();
  const router = useRouter();
  const compact = useWindowDimensions().width < 820;
  const { authReady, cart: fullCart, cartError, cartLoading, checkoutShipping, refreshCart, setCheckoutShipping, user } = useStore();
  const productId = useCheckoutProductId();
  const cart = useMemo(() => checkoutCart(fullCart, productId), [fullCart, productId]);
  const [form, setForm] = useState<CheckoutShipping>(checkoutShipping ?? emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [addressLoading, setAddressLoading] = useState(false);
  const editedFields = useRef(new Set<FieldKey>());

  useEffect(() => {
    if (!authReady || !user) return;
    if (checkoutShipping) return;
    setForm(current => ({ ...current, fullName: current.fullName || user.fullName, phone: current.phone || user.phone || '' }));
    let active = true;
    setAddressLoading(true);
    void accountApi.addresses().then(addresses => {
      const preferred = addresses.find(address => address.isDefault) ?? addresses[0];
      if (active) setForm(current => ({ ...current, fullName: editedFields.current.has('fullName') ? current.fullName : current.fullName || preferred?.fullName || user.fullName, phone: editedFields.current.has('phone') ? current.phone : current.phone || preferred?.phone || user.phone || '', address: editedFields.current.has('address') ? current.address : current.address || preferred?.address || user.address || '' }));
    }).catch(() => {
      if (active) setForm(current => ({ ...current, address: editedFields.current.has('address') ? current.address : current.address || user.address || '' }));
    }).finally(() => { if (active) setAddressLoading(false); });
    return () => { active = false; };
  }, [authReady, checkoutShipping, user]);

  useEffect(() => {
    if (authReady && user && !cart) void refreshCart().catch(() => {});
  }, [authReady, cart, refreshCart, user]);

  const update = (key: FieldKey, value: string) => {
    editedFields.current.add(key);
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined }));
  };

  const validate = () => {
    const next: Errors = {};
    if (form.fullName.trim().length < 2) next.fullName = 'Vui lòng nhập họ tên người nhận.';
    const phone = form.phone.replace(/[\s().-]/g, '');
    if (!/^(?:0\d{9}|\+84\d{9})$/.test(phone)) next.phone = 'Số điện thoại chưa đúng định dạng.';
    if (form.address.trim().length < 5) next.address = 'Vui lòng nhập địa chỉ chi tiết.';
    return next;
  };

  const continueToPayment = () => {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;
    setCheckoutShipping({ ...form, fullName: form.fullName.trim(), phone: form.phone.trim(), province: form.province.trim(), district: form.district.trim(), address: form.address.trim(), note: form.note.trim() });
    router.push({ pathname: '/checkout/payment', params: productId ? { productId: String(productId) } : {} });
  };

  if (!authReady || (!!user && !cart && !cartError) || (cartLoading && !cart)) return <View style={styles.page}><PageHeader back /><View style={styles.state}><ActivityIndicator size="large" color={colors.ink} /><Text style={styles.stateText}>Đang chuẩn bị thanh toán...</Text></View></View>;
  if (!user) return <View style={styles.page}><PageHeader back /><View style={styles.state}><Ionicons name="person-outline" size={42} color={colors.ink} /><Text style={styles.stateTitle}>Đăng nhập để thanh toán</Text><Text style={styles.stateText}>Thông tin giao hàng được lưu theo tài khoản của bạn.</Text><Pressable style={styles.primaryButton} onPress={() => router.push({ pathname: '/login', params: { redirect: '/checkout/info' } })}><Text style={styles.primaryButtonText}>Đăng nhập</Text></Pressable></View></View>;
  if (cartError && !cart) return <View style={styles.page}><PageHeader back /><View style={styles.state}><Ionicons name="alert-circle-outline" size={42} color={colors.danger} /><Text style={styles.stateTitle}>Chưa thể tải giỏ hàng</Text><Text style={styles.stateText}>{cartError}</Text><Pressable style={styles.primaryButton} onPress={() => void refreshCart().catch(() => {})}><Text style={styles.primaryButtonText}>Thử lại</Text></Pressable></View></View>;
  if (!cart) return <View style={styles.page}><PageHeader back /><View style={styles.state}><ActivityIndicator size="large" color={colors.ink} /><Text style={styles.stateText}>Đang chuẩn bị thanh toán...</Text></View></View>;
  if (!cart.items.length) return <View style={styles.page}><PageHeader back /><View style={styles.state}><Ionicons name="bag-outline" size={46} color={colors.ink} /><Text style={styles.stateTitle}>Giỏ hàng đang trống</Text><Text style={styles.stateText}>Hãy thêm sản phẩm trước khi thanh toán.</Text><Pressable style={styles.primaryButton} onPress={() => router.replace('/products')}><Text style={styles.primaryButtonText}>Tiếp tục mua sắm</Text></Pressable></View></View>;

  return <View style={styles.page}>
    <PageHeader back />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={top.ref} onScroll={top.onScroll} scrollEventThrottle={100} contentContainerStyle={[styles.scroll, compact && styles.scrollCompact]} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.breadcrumb}><Pressable onPress={() => router.replace('/')}><Text style={styles.breadcrumbLink}>Trang chủ</Text></Pressable><Ionicons name="chevron-forward" size={14} color={colors.muted} /><Pressable onPress={() => router.replace('/cart')}><Text style={styles.breadcrumbLink}>Giỏ hàng</Text></Pressable><Ionicons name="chevron-forward" size={14} color={colors.muted} /><Text style={styles.breadcrumbCurrent}>Thanh toán</Text></View>
          <View style={styles.hero}><View style={styles.heroIcon}><Ionicons name="location-outline" size={28} color={colors.ink} /></View><View style={styles.flex}><Text style={styles.eyebrow}>CHECKOUT</Text><Text style={styles.title}>Thông tin giao hàng</Text><Text style={styles.subtitle}>Nhập thông tin người nhận để tiếp tục sang bước chọn phương thức thanh toán.</Text></View></View>
          <Progress />
          <View style={[styles.layout, compact && styles.layoutCompact]}>
            <View style={styles.formCard}><View style={styles.cardHeading}><Ionicons name="person-outline" size={20} color={colors.ink} /><View><Text style={styles.sectionTitle}>Thông tin người nhận</Text><Text style={styles.sectionHint}>Các trường có dấu * là bắt buộc.</Text></View>{addressLoading && <ActivityIndicator size="small" color={colors.ink} />}</View>
              <View style={[styles.fieldRow, compact && styles.fieldRowCompact]}><Field label="Họ và tên người nhận" required value={form.fullName} placeholder="Nguyễn Văn A" error={errors.fullName} onChangeText={value => update('fullName', value)} autoComplete="name" /><Field label="Số điện thoại" required value={form.phone} placeholder="0901 234 567" error={errors.phone} onChangeText={value => update('phone', value)} keyboardType="phone-pad" autoComplete="tel" /></View>
              <View style={[styles.fieldRow, compact && styles.fieldRowCompact]}><Field label="Tỉnh / Thành phố" value={form.province} placeholder="Không bắt buộc nếu địa chỉ đã đầy đủ" error={errors.province} onChangeText={value => update('province', value)} /><Field label="Quận / Huyện" value={form.district} placeholder="Không bắt buộc nếu địa chỉ đã đầy đủ" error={errors.district} onChangeText={value => update('district', value)} /></View>
              <Field label="Địa chỉ giao hàng đầy đủ" required value={form.address} placeholder="Số nhà, đường, phường / xã, quận / huyện, tỉnh / thành" error={errors.address} onChangeText={value => update('address', value)} autoComplete="street-address" />
              <Field label="Ghi chú đơn hàng" value={form.note} placeholder="Không bắt buộc · Gọi trước khi giao" onChangeText={value => update('note', value)} multiline />
              <View style={styles.actions}><Pressable style={styles.backButton} onPress={() => router.replace('/cart')}><Ionicons name="arrow-back" size={17} color={colors.ink} /><Text style={styles.backButtonText}>Quay lại giỏ hàng</Text></Pressable><Pressable style={styles.primaryButton} onPress={continueToPayment}><Text style={styles.primaryButtonText}>Tiếp tục đến thanh toán</Text><Ionicons name="arrow-forward" size={17} color={colors.white} /></Pressable></View>
            </View>
            <OrderSummary compact={compact} cart={cart} />
          </View>
        </View>
        <ProductFooter />
      </ScrollView>
    </KeyboardAvoidingView>
    <ScrollTopButton visible={top.visible} onPress={top.toTop} />
    <ChatWidget compact={compact} />
  </View>;
}

function Field({ label, required, value, placeholder, error, onChangeText, keyboardType = 'default', multiline = false, autoComplete }: { label: string; required?: boolean; value: string; placeholder: string; error?: string; onChangeText: (value: string) => void; keyboardType?: 'default' | 'phone-pad'; multiline?: boolean; autoComplete?: 'name' | 'tel' | 'street-address' }) {
  return <View style={styles.field}><Text style={styles.label}>{label}{required && <Text style={styles.required}> *</Text>}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} keyboardType={keyboardType} autoComplete={autoComplete} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={[styles.input, multiline && styles.textarea, error && styles.inputError]} />{error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}</View>;
}

function Progress() {
  return <View style={styles.progress}><View style={styles.progressItem}><View style={[styles.progressCircle, styles.progressActive]}><Text style={styles.progressNumber}>1</Text></View><Text style={styles.progressActiveText}>Thông tin giao hàng</Text></View><View style={styles.progressLine} /><View style={styles.progressItem}><View style={styles.progressCircle}><Text style={styles.progressNumberMuted}>2</Text></View><Text style={styles.progressMutedText}>Thanh toán</Text></View><View style={styles.progressLine} /><View style={styles.progressItem}><View style={styles.progressCircle}><Text style={styles.progressNumberMuted}>3</Text></View><Text style={styles.progressMutedText}>Hoàn tất</Text></View></View>;
}

function OrderSummary({ cart, compact }: { cart: NonNullable<ReturnType<typeof useStore>['cart']>; compact: boolean }) {
  return <View style={[styles.summary, compact && styles.summaryCompact]}><Text style={styles.sectionTitle}>Tóm tắt đơn hàng</Text>{cart.items.map(item => <View key={item.productId} style={styles.summaryItem}><View style={styles.summaryThumb}>{item.product.imageUrl ? <Image source={{ uri: imageUrl(item.product.imageUrl) }} resizeMode="contain" style={styles.summaryImage} /> : <Ionicons name="image-outline" size={24} color={colors.muted} />}</View><View style={styles.summaryCopy}><Text numberOfLines={2} style={styles.summaryName}>{item.product.name}</Text><Text style={styles.summaryMeta}>x{item.quantity} · {formatVnd(item.product.price)}</Text></View><Text style={styles.summaryPrice}>{formatVnd(item.subtotal)}</Text></View>)}<View style={styles.summaryRule} /><View style={styles.summaryLine}><Text style={styles.summaryLabel}>Tạm tính</Text><Text style={styles.summaryValue}>{formatVnd(cart.total)}</Text></View>{!!cart.saleSavings && <View style={styles.summaryLine}><Text style={styles.summaryLabel}>Đã giảm chương trình</Text><Text style={styles.discountValue}>-{formatVnd(cart.saleSavings)}</Text></View>}<View style={styles.summaryLine}><Text style={styles.summaryLabel}>Phí vận chuyển</Text><Text style={styles.summaryValue}>Xác nhận ở bước 2</Text></View><View style={[styles.summaryLine, styles.totalLine]}><Text style={styles.totalLabel}>Tổng dự kiến</Text><Text style={styles.totalValue}>{formatVnd(cart.total)}</Text></View></View>;
}

const styles = StyleSheet.create(withTypography({
  page: { flex: 1, backgroundColor: colors.bg }, flex: { flex: 1 }, scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 18 }, scrollCompact: { paddingHorizontal: 12, paddingTop: 12 }, content: { width: '100%', maxWidth: 1240, alignSelf: 'center', paddingBottom: 40 }, breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 13 }, breadcrumbLink: { color: colors.ink, fontSize: 12, fontWeight: '800' }, breadcrumbCurrent: { color: colors.muted, fontSize: 12 }, hero: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14 }, heroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.line }, eyebrow: { color: colors.ink, fontSize: 12, letterSpacing: 1.8, fontWeight: '800' }, title: { color: colors.ink, fontSize: 32, lineHeight: 39, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 2 }, progress: { marginBottom: 16, padding: 13, borderRadius: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }, progressItem: { flexDirection: 'row', alignItems: 'center', gap: 8 }, progressCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }, progressActive: { backgroundColor: colors.brand }, progressNumber: { color: colors.white, fontSize: 12, fontWeight: '900' }, progressNumberMuted: { color: colors.muted, fontSize: 12, fontWeight: '900' }, progressActiveText: { color: colors.ink, fontSize: 12, fontWeight: '900' }, progressMutedText: { color: colors.muted, fontSize: 12, fontWeight: '700' }, progressLine: { flex: 1, height: 1, marginHorizontal: 12, backgroundColor: colors.line }, layout: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 }, layoutCompact: { flexDirection: 'column' }, formCard: { flex: 1, minWidth: 0, padding: 22, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }, cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 17, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.line }, sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' }, sectionHint: { color: colors.muted, fontSize: 11, marginTop: 2 }, fieldRow: { flexDirection: 'row', gap: 14 }, fieldRowCompact: { flexDirection: 'column', gap: 0 }, field: { flex: 1, minWidth: 0, marginBottom: 15 }, label: { color: colors.ink, fontSize: 12, fontWeight: '800', marginBottom: 7 }, required: { color: colors.danger }, input: { width: '100%', minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.subtle, backgroundColor: colors.white, color: colors.ink, fontSize: 13 }, textarea: { minHeight: 88, paddingTop: 12 }, inputError: { borderColor: '#B74439', backgroundColor: '#FFF8F6' }, error: { color: colors.danger, fontSize: 11, marginTop: 5 }, actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 6 }, backButton: { minHeight: 44, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.subtle, flexDirection: 'row', alignItems: 'center', gap: 7 }, backButtonText: { color: colors.ink, fontSize: 12, fontWeight: '800' }, primaryButton: { minHeight: 44, paddingHorizontal: 17, borderRadius: 999, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, primaryButtonText: { color: colors.white, fontSize: 12, fontWeight: '800' }, summary: { width: 350, padding: 20, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }, summaryCompact: { width: '100%' }, summaryItem: { minHeight: 64, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: colors.lineSoft }, summaryThumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, summaryImage: { width: '90%', height: '90%' }, summaryCopy: { flex: 1, minWidth: 0 }, summaryName: { color: colors.ink, fontSize: 11, lineHeight: 16, fontWeight: '800' }, summaryMeta: { color: colors.muted, fontSize: 12, marginTop: 2 }, summaryPrice: { color: colors.ink, fontSize: 11, fontWeight: '900' }, summaryRule: { height: 1, marginVertical: 11, backgroundColor: colors.line }, summaryLine: { marginTop: 11, flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, summaryLabel: { color: colors.muted, fontSize: 12 }, summaryValue: { color: colors.ink, fontSize: 12, fontWeight: '800', textAlign: 'right' }, discountValue: { color: colors.success, fontSize: 12, fontWeight: '800', textAlign: 'right' }, totalLine: { marginTop: 15, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line }, totalLabel: { color: colors.ink, fontSize: 16, fontWeight: '900' }, totalValue: { color: colors.ink, fontSize: 20, fontWeight: '900' }, state: { flex: 1, minHeight: 400, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 10 }, stateTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', textAlign: 'center' }, stateText: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 440 },
}));
