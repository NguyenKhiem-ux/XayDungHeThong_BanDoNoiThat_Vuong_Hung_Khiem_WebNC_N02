import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { ApiError, formatVnd, imageUrl, orderApi, paymentApi } from '../api';
import { ChatWidget } from '../components/ChatWidget';
import { InvoiceBootstrapLayout } from '../components/InvoiceBootstrapLayout';
import { PageHeader } from '../components/PageHeader';
import { ProductFooter } from '../components/ProductFooter';
import { useStore } from '../store';
import { withTypography } from '../typography';
import type { Order, PaymentMethod } from '../types';
import { colors } from '../theme';

const statusLabels: Record<Order['status'], string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
};

function methodLabel(method: PaymentMethod) {
  if (method === 'CASH') return 'CASH · Tiền mặt khi nhận hàng';
  if (method === 'CARD') return 'CARD · Thẻ mô phỏng';
  return 'PayOS / QR';
}

function paymentLabel(order: Order) {
  if (order.paymentStatus === 'PAID') return 'Đã thanh toán';
  if (order.paymentMethod === 'CASH') return 'Thanh toán khi nhận hàng';
  if (order.paymentMethod === 'CARD') return 'Chưa thanh toán · cần xác minh PIN';
  return 'Chưa xác nhận thanh toán';
}

export default function CheckoutInvoiceScreen() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 760;
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const { authReady, checkoutPaymentPin, setCheckoutPaymentPin, setCheckoutShipping, user } = useStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [pin, setPin] = useState(checkoutPaymentPin);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const orderId = useMemo(() => {
    const value = Array.isArray(params.id) ? params.id[0] : params.id;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }, [params.id]);

  const loadOrder = async () => {
    if (!orderId) {
      setError('Thiếu mã đơn hàng để tải hóa đơn.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setOrder(await orderApi.detail(orderId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải hóa đơn đơn hàng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      router.replace({ pathname: '/login', params: { redirect: `/checkout/invoice?id=${orderId ?? ''}` } });
      return;
    }
    void loadOrder();
  }, [authReady, orderId, user]);

  const printInvoice = () => {
    if (Platform.OS === 'web') {
      window.print();
      return;
    }
    Alert.alert('In hóa đơn', 'Chức năng in hóa đơn hiện hỗ trợ trên Expo Web.');
  };

  const confirmOrder = async () => {
    if (!order || busy) return;
    setBusy(true);
    setError('');
    setActionMessage('');
    try {
      if (order.paymentMethod === 'CASH') {
        setCheckoutShipping(null);
        setCheckoutPaymentPin('');
        // Đơn COD đã được tạo ở bước thanh toán, ở đây chỉ chuyển sang xem đơn.
        router.replace({ pathname: '/orders/[id]', params: { id: String(order.id) } });
        return;
      }
      if (order.paymentMethod === 'CARD') {
        if (!/^\d{6}$/.test(pin)) throw new Error('Vui lòng nhập PIN mô phỏng gồm 6 chữ số.');
        const result = await paymentApi.confirmCardPayment(order.id, pin);
        if (!result.success) throw new Error('Thanh toán thẻ mô phỏng chưa được xác nhận.');
        setOrder(await orderApi.detail(order.id));
        setCheckoutPaymentPin('');
        setCheckoutShipping(null);
        setActionMessage('Thanh toán thẻ mô phỏng đã được xác minh theo phản hồi từ hệ thống.');
        return;
      }
      const result = await paymentApi.createPayOSPaymentLink(order.id);
      if (Platform.OS === 'web') globalThis.location.assign(result.checkoutUrl);
      else await Linking.openURL(result.checkoutUrl);
    } catch (reason) {
      setError(reason instanceof ApiError || reason instanceof Error ? reason.message : 'Không thể xác nhận đơn hàng.');
    } finally {
      setBusy(false);
    }
  };

  if (!authReady || loading) return <InvoiceState title="Đang tải hóa đơn..." loading />;
  if (error && !order) return <InvoiceState title="Không thể tải hóa đơn" message={error} onRetry={() => void loadOrder()} />;
  if (!order) return <InvoiceState title="Không tìm thấy đơn hàng" message="Mã đơn hàng không hợp lệ hoặc bạn không có quyền xem đơn này." />;

  return (
    <View style={styles.page}>
      <PageHeader />
      <ScrollView contentContainerStyle={[styles.scroll, compact && styles.scrollCompact]}>
        <InvoiceBootstrapLayout>
        <View style={styles.content}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>GIA DỤNG VIỆT · ĐƠN HÀNG</Text>
            <Text style={styles.heroTitle}><Ionicons name="receipt-outline" size={25} color={colors.ink} /> Hóa đơn xác nhận</Text>
            <Text style={styles.heroSubtitle}>Kiểm tra thông tin giao hàng, sản phẩm và thanh toán trước khi hoàn tất đơn.</Text>
          </View>

          <View style={styles.invoiceCard}>
            <View style={[styles.invoiceBrand, compact && styles.invoiceBrandCompact]}>
              <View style={styles.brandCopy}>
                <Text style={styles.brandName}>GIA DỤNG VIỆT</Text>
                <Text style={styles.brandNote}>Hóa đơn tạm tính · Đơn #{order.id}</Text>
              </View>
              <View style={[styles.statusBadge, order.status === 'CANCELLED' && styles.statusCancelled]}>
                <Ionicons name={order.status === 'CANCELLED' ? 'close-circle-outline' : 'checkmark-circle-outline'} size={16} color={order.status === 'CANCELLED' ? colors.danger : colors.success} />
                <Text style={[styles.statusText, order.status === 'CANCELLED' && styles.statusTextCancelled]}>{statusLabels[order.status]}</Text>
              </View>
            </View>

            <InvoiceSection title="Thông tin giao hàng" icon="location-outline">
              <View style={[styles.infoGrid, compact && styles.infoGridCompact]}>
                <Info label="Họ và tên" value={order.fullName} />
                <Info label="Email" value={order.email} />
                <Info label="Số điện thoại" value={order.phone} />
                <Info label="Địa chỉ giao hàng" value={order.address} wide />
                <Info label="Ghi chú giao hàng" value={order.note || 'Không có'} wide />
              </View>
            </InvoiceSection>

            <InvoiceSection title="Sản phẩm" icon="bag-handle-outline">
              <View style={styles.productTable}>
                <View style={[styles.productHeader, compact && styles.productHeaderCompact]}>
                  <Text style={[styles.tableHeader, styles.productNameColumn]}>Sản phẩm</Text>
                  {!compact && <Text style={[styles.tableHeader, styles.priceColumn]}>Đơn giá</Text>}
                  <Text style={[styles.tableHeader, styles.quantityColumn]}>SL</Text>
                  <Text style={[styles.tableHeader, styles.amountColumn]}>Thành tiền</Text>
                </View>
                {order.items.map(item => (
                  <View key={item.id} style={[styles.productRow, compact && styles.productRowCompact]}>
                    <View style={[styles.productNameColumn, styles.productIdentity]}>
                      <View style={styles.productImageBox}>
                        {item.productImage ? <Image source={{ uri: imageUrl(item.productImage) }} resizeMode="contain" style={styles.productImage} /> : <Ionicons name="image-outline" size={22} color={colors.muted} />}
                      </View>
                      <View style={styles.productNameCopy}>
                        <Text numberOfLines={2} style={styles.productName}>{item.productName}</Text>
                        {compact && <Text style={styles.mobileUnitPrice}>{formatVnd(item.price)} / sản phẩm</Text>}
                      </View>
                    </View>
                    {!compact && <Text style={[styles.productCell, styles.priceColumn]}>{formatVnd(item.price)}</Text>}
                    <Text style={[styles.productCell, styles.quantityColumn]}>{item.quantity}</Text>
                    <Text style={[styles.productAmount, styles.amountColumn]}>{formatVnd(item.subtotal)}</Text>
                  </View>
                ))}
              </View>
            </InvoiceSection>

            <View style={[styles.summaryArea, compact && styles.summaryAreaCompact]}>
              <View style={styles.summaryBox}>
                <SummaryLine label="Tạm tính" value={formatVnd(order.subtotalAmount)} />
                {order.discountAmount > 0 && <SummaryLine label={order.couponCode ? `Giảm giá · ${order.couponCode}` : 'Giảm giá'} value={`−${formatVnd(order.discountAmount)}`} accent />}
                <SummaryLine label="Phí giao hàng" value="Miễn phí" accent />
                <View style={styles.totalRule} />
                <View style={styles.totalLine}><Text style={styles.totalLabel}>Tổng thanh toán</Text><Text style={styles.totalValue}>{formatVnd(order.totalAmount)}</Text></View>
                <View style={styles.paymentBox}>
                  <Text style={styles.paymentLabel}>Phương thức thanh toán</Text>
                  <Text style={styles.paymentValue}>{methodLabel(order.paymentMethod)}</Text>
                  <Text style={styles.paymentState}>{paymentLabel(order)}</Text>
                </View>
              </View>
            </View>

            {order.paymentMethod === 'CARD' && order.paymentStatus !== 'PAID' && <View style={styles.pinSection}>
              <Text style={styles.pinTitle}>Xác minh thẻ mô phỏng</Text>
              <Text style={styles.pinHint}>Nhập PIN 6 số đã tạo trong hồ sơ. Đây không phải PIN ngân hàng.</Text>
              <TextInput value={pin} onChangeText={value => { setPin(value.replace(/\D/g, '').slice(0, 6)); setCheckoutPaymentPin(value.replace(/\D/g, '').slice(0, 6)); }} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="••••••" placeholderTextColor={colors.muted} style={styles.pinInput} />
            </View>}

            <Text style={styles.disclaimer}>Hóa đơn này là thông tin xác nhận đơn hàng, không thay thế hóa đơn VAT và không tự khẳng định đã thanh toán khi backend chưa trả trạng thái PAID.</Text>
            {!!actionMessage && <View style={styles.successNotice}><Ionicons name="checkmark-circle-outline" size={18} color={colors.success} /><Text style={styles.successNoticeText}>{actionMessage}</Text></View>}
            {!!error && <View style={styles.errorNotice}><Ionicons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.errorText}>{error}</Text></View>}

            <View style={[styles.actions, compact && styles.actionsCompact]}>
              <Pressable style={styles.outlineButton} onPress={printInvoice}><Ionicons name="print-outline" size={17} color={colors.ink} /><Text style={styles.outlineText}>In hóa đơn</Text></Pressable>
              <Pressable style={[styles.primaryButton, busy && styles.disabled]} disabled={busy || order.status === 'CANCELLED' || (order.paymentMethod !== 'CASH' && order.paymentStatus === 'PAID')} onPress={() => void confirmOrder()}>
                {busy ? <ActivityIndicator color={colors.white} /> : <Ionicons name={order.paymentMethod === 'QR' || order.paymentMethod === 'PAYOS' ? 'qr-code-outline' : order.paymentMethod === 'CARD' ? 'card-outline' : 'checkmark-circle-outline'} size={17} color={colors.white} />}
                <Text style={styles.primaryText}>{busy ? 'Đang xử lý...' : order.paymentMethod === 'CASH' ? 'Xem đơn hàng' : order.paymentStatus === 'PAID' ? 'Đã thanh toán' : order.paymentMethod === 'CARD' ? 'Xác minh PIN và thanh toán' : 'Mở thanh toán PayOS / QR'}</Text>
              </Pressable>
              <Pressable style={styles.outlineButton} onPress={() => router.replace('/orders')}><Ionicons name="arrow-back" size={17} color={colors.ink} /><Text style={styles.outlineText}>Đơn hàng của tôi</Text></Pressable>
            </View>
          </View>
        </View>
        </InvoiceBootstrapLayout>
        <ProductFooter />
      </ScrollView>
      <ChatWidget compact={compact} />
    </View>
  );
}

function InvoiceState({ title, message, loading = false, onRetry }: { title: string; message?: string; loading?: boolean; onRetry?: () => void }) {
  return <View style={styles.page}><PageHeader back /><View style={styles.state}>{loading ? <ActivityIndicator size="large" color={colors.ink} /> : <Ionicons name="document-text-outline" size={44} color={colors.ink} />}<Text style={styles.stateTitle}>{title}</Text>{message && <Text style={styles.stateText}>{message}</Text>}{onRetry && <Pressable style={styles.primaryButton} onPress={onRetry}><Text style={styles.primaryText}>Thử lại</Text></Pressable>}</View></View>;
}

function InvoiceSection({ title, icon, children }: { title: string; icon: 'location-outline' | 'bag-handle-outline'; children: ReactNode }) {
  return <View style={styles.section}><View style={styles.sectionHeading}><View style={styles.sectionIcon}><Ionicons name={icon} size={18} color={colors.ink} /></View><Text style={styles.sectionTitle}>{title}</Text></View>{children}</View>;
}

function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <View style={[styles.infoItem, wide && styles.infoItemWide]}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function SummaryLine({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <View style={styles.summaryLine}><Text style={styles.summaryLabel}>{label}</Text><Text style={[styles.summaryValue, accent && styles.summaryAccent]}>{value}</Text></View>;
}

const styles = StyleSheet.create(withTypography({
  page: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 30 },
  scrollCompact: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 22 },
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center' },
  hero: { marginBottom: 16, padding: 22, borderRadius: 18, backgroundColor: colors.line, borderWidth: 1, borderColor: colors.subtle },
  eyebrow: { color: colors.ink, fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  heroTitle: { marginTop: 5, color: colors.ink, fontSize: 28, lineHeight: 35, fontWeight: '900' },
  heroSubtitle: { marginTop: 5, color: colors.muted, fontSize: 12, lineHeight: 19 },
  invoiceCard: { padding: 22, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, shadowColor: colors.ink, shadowOpacity: 0.06, shadowRadius: 15, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  invoiceBrand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.line },
  invoiceBrandCompact: { alignItems: 'flex-start', flexDirection: 'column' },
  brandCopy: { flex: 1 },
  brandName: { color: colors.ink, fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  brandNote: { marginTop: 4, color: colors.muted, fontSize: 11 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 20, backgroundColor: '#EAF4EA' },
  statusCancelled: { backgroundColor: '#FBEAE7' },
  statusText: { color: colors.success, fontSize: 11, fontWeight: '900' },
  statusTextCancelled: { color: colors.danger },
  section: { marginTop: 20, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.line },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 13 },
  sectionIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lineSoft },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  infoGridCompact: { flexDirection: 'column', gap: 10 },
  infoItem: { flexGrow: 1, flexBasis: '46%', minWidth: 220, padding: 12, borderRadius: 10, backgroundColor: colors.bg },
  infoItemWide: { flexBasis: '100%' },
  infoLabel: { color: colors.muted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  infoValue: { marginTop: 4, color: colors.ink, fontSize: 13, lineHeight: 19 },
  productTable: { borderWidth: 1, borderColor: colors.line, borderRadius: 11, overflow: 'hidden' },
  productHeader: { minHeight: 38, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.lineSoft },
  productHeaderCompact: { paddingHorizontal: 9 },
  tableHeader: { color: colors.ink, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  productRow: { minHeight: 76, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.lineSoft },
  productRowCompact: { paddingHorizontal: 9 },
  productNameColumn: { flex: 1, minWidth: 0 },
  priceColumn: { width: 125, textAlign: 'right' },
  quantityColumn: { width: 55, textAlign: 'center' },
  amountColumn: { width: 135, textAlign: 'right' },
  productIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  productImageBox: { width: 53, height: 53, borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.bg },
  productImage: { width: '92%', height: '92%' },
  productNameCopy: { flex: 1, minWidth: 0 },
  productName: { color: colors.ink, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  mobileUnitPrice: { marginTop: 3, color: colors.muted, fontSize: 12 },
  productCell: { color: colors.muted, fontSize: 12 },
  productAmount: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  summaryArea: { marginTop: 20, alignItems: 'flex-end' },
  summaryAreaCompact: { alignItems: 'stretch' },
  summaryBox: { width: 410, maxWidth: '100%', padding: 17, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line },
  summaryLine: { marginTop: 9, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { color: colors.muted, fontSize: 12 },
  summaryValue: { color: colors.ink, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  summaryAccent: { color: colors.success },
  totalRule: { height: 1, marginTop: 15, backgroundColor: colors.line },
  totalLine: { marginTop: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  totalLabel: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  totalValue: { color: colors.ink, fontSize: 23, fontWeight: '900' },
  paymentBox: { marginTop: 16, paddingTop: 13, borderTopWidth: 1, borderTopColor: colors.line },
  paymentLabel: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  paymentValue: { marginTop: 4, color: colors.ink, fontSize: 12, fontWeight: '900' },
  paymentState: { marginTop: 3, color: colors.success, fontSize: 11 },
  pinSection: { marginTop: 18, padding: 14, borderRadius: 11, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line },
  pinTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  pinHint: { marginTop: 4, color: colors.muted, fontSize: 11, lineHeight: 17 },
  pinInput: { marginTop: 10, minHeight: 44, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: colors.subtle, backgroundColor: colors.white, color: colors.ink, fontSize: 16, letterSpacing: 4 },
  disclaimer: { marginTop: 18, color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  successNotice: { marginTop: 14, padding: 11, borderRadius: 9, flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: '#EAF4EA' },
  successNoticeText: { flex: 1, color: colors.success, fontSize: 12, lineHeight: 18 },
  errorNotice: { marginTop: 14, padding: 11, borderRadius: 9, flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: '#FBEAE7' },
  errorText: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 18 },
  actions: { marginTop: 22, flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 9 },
  actionsCompact: { flexDirection: 'column' },
  outlineButton: { minHeight: 45, paddingHorizontal: 15, borderRadius: 999, borderWidth: 1, borderColor: colors.subtle, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  outlineText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  primaryButton: { minHeight: 45, paddingHorizontal: 17, borderRadius: 999, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  state: { flex: 1, minHeight: 520, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  stateText: { maxWidth: 480, color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
}));
