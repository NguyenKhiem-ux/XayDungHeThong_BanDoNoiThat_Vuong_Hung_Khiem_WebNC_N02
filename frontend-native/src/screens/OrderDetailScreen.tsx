import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { formatVnd, orderApi } from '../api';
import { ChatWidget } from '../components/ChatWidget';
import { Header } from '../components/Header';
import { OrderProductImage } from '../components/OrderProductImage';
import { ProductFooter } from '../components/ProductFooter';
import { useStore } from '../store';
import { withTypography } from '../typography';
import type { Order } from '../types';
import { ScrollTopButton, useScrollTop } from '../components/ScrollTopButton';
import { colors } from '../theme';

const statusLabels: Record<Order['status'], string> = { PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy' };
const paymentLabels: Record<Order['paymentMethod'], string> = { CASH: 'Thanh toán khi nhận hàng', CARD: 'Thẻ mô phỏng', QR: 'PayOS / QR', PAYOS: 'PayOS / QR' };
const statusPalette: Record<Order['status'], { backgroundColor: string; color: string }> = { PENDING: { backgroundColor: colors.lineSoft, color: colors.muted }, CONFIRMED: { backgroundColor: '#E5EEF6', color: '#37627C' }, DELIVERED: { backgroundColor: '#EAF2E8', color: colors.success }, CANCELLED: { backgroundColor: '#FBE8E5', color: colors.danger } };

export default function OrderDetailScreen() {
  const top = useScrollTop();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const compact = useWindowDimensions().width < 780;
  const { authReady, user } = useStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const orderId = useMemo(() => {
    const raw = Array.isArray(params.id) ? params.id[0] : params.id;
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }, [params.id]);

  const load = useCallback(async () => {
    if (!user) return;
    if (!orderId) { setOrder(null); setError('Mã đơn hàng không hợp lệ.'); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      setOrder(await orderApi.detail(orderId));
    } catch (reason) {
      setOrder(null);
      setError(reason instanceof Error ? reason.message : 'Không thể tải chi tiết đơn hàng.');
    } finally {
      setLoading(false);
    }
  }, [orderId, user]);

  useEffect(() => {
    if (authReady && !user) router.replace({ pathname: '/login', params: { redirect: orderId ? `/orders/${orderId}` : '/orders' } });
  }, [authReady, orderId, router, user]);

  useEffect(() => { void load(); }, [load]);

  const canContinuePayment = !!order && order.paymentStatus === 'UNPAID' && order.status !== 'CANCELLED' && (order.paymentMethod === 'QR' || order.paymentMethod === 'PAYOS' || order.paymentMethod === 'CARD');

  return <View style={styles.page}><ScrollView ref={top.ref} onScroll={top.onScroll} scrollEventThrottle={100} stickyHeaderIndices={[0]} style={styles.scroll} contentContainerStyle={styles.content}><Header compact={compact} categories={[]} /><View style={[styles.shell, compact && styles.shellCompact]}><View style={styles.breadcrumb}><Pressable onPress={() => router.replace('/')}><Text style={styles.breadcrumbLink}>Trang chủ</Text></Pressable><Ionicons name="chevron-forward" size={14} color={colors.muted} /><Pressable onPress={() => router.replace('/orders')}><Text style={styles.breadcrumbLink}>Đơn hàng của tôi</Text></Pressable><Ionicons name="chevron-forward" size={14} color={colors.muted} /><Text style={styles.breadcrumbCurrent}>Chi tiết đơn hàng</Text></View>{!authReady || !user || loading ? <State loading title="Đang tải chi tiết đơn hàng..." message="Vui lòng chờ trong giây lát." /> : error || !order ? <State title="Không thể tải đơn hàng" message={error || 'Không tìm thấy đơn hàng.'} action="Thử lại" onPress={() => void load()} /> : <><View style={[styles.hero, compact && styles.heroCompact]}><View><Text style={styles.eyebrow}>ORDER #{order.id}</Text><Text style={styles.title}>Chi tiết đơn hàng</Text><Text style={styles.subtitle}>Đặt ngày {formatDate(order.createdAt)}</Text></View><View style={[styles.status, { backgroundColor: statusPalette[order.status].backgroundColor }]}><Text style={[styles.statusText, { color: statusPalette[order.status].color }]}>{statusLabels[order.status]}</Text></View></View>{order.status === 'CANCELLED' ? <View style={styles.cancelled}><Ionicons name="close-circle-outline" size={20} color={colors.danger} /><View style={styles.flex}><Text style={styles.cancelledTitle}>Đơn hàng đã bị hủy</Text><Text style={styles.cancelledText}>Đơn này không còn hiệu lực và không thể tiếp tục thanh toán.</Text></View></View> : null}<View style={[styles.grid, compact && styles.gridCompact]}><View style={styles.main}><InfoCard order={order} /><ProductsCard order={order} /></View><View style={styles.side}><ShippingCard order={order} /><TotalsCard order={order} /></View></View><View style={[styles.actions, compact && styles.actionsCompact]}><Pressable onPress={() => router.replace('/orders')} style={styles.secondaryButton}><Ionicons name="arrow-back" size={16} color={colors.ink} /><Text style={styles.secondaryText}>Quay lại danh sách</Text></Pressable>{canContinuePayment ? <Pressable onPress={() => router.push({ pathname: '/checkout/invoice', params: { id: String(order.id) } })} style={styles.primaryButton}><Ionicons name={order.paymentMethod === 'CARD' ? 'card-outline' : 'qr-code-outline'} size={17} color={colors.white} /><Text style={styles.primaryText}>Tiếp tục thanh toán</Text></Pressable> : null}</View></>}</View><ProductFooter /></ScrollView><ScrollTopButton visible={top.visible} onPress={top.toTop} /><ChatWidget compact={compact} /></View>;
}

function InfoCard({ order }: { order: Order }) {
  return <View style={styles.card}><Heading icon="receipt-outline" title="Thông tin đơn hàng" /><View style={styles.infoGrid}><Info label="Mã đơn" value={`#${order.id}`} /><Info label="Ngày đặt" value={formatDate(order.createdAt)} /><Info label="Trạng thái đơn" value={statusLabels[order.status]} /><Info label="Trạng thái thanh toán" value={order.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'} /><Info label="Phương thức" value={paymentLabels[order.paymentMethod] ?? order.paymentMethod} /></View></View>;
}

function ShippingCard({ order }: { order: Order }) {
  return <View style={styles.card}><Heading icon="location-outline" title="Thông tin giao hàng" /><Text style={styles.receiver}>{order.fullName || 'Không có tên người nhận'}</Text><Text style={styles.bodyText}>{order.phone || 'Không có số điện thoại'}</Text><Text style={styles.bodyText}>{order.email || 'Không có email'}</Text><Text style={styles.address}>{order.address || 'Không có địa chỉ giao hàng'}</Text>{order.note ? <View style={styles.note}><Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.ink} /><Text style={styles.noteText}>Ghi chú: {order.note}</Text></View> : null}</View>;
}

function ProductsCard({ order }: { order: Order }) {
  const items = order.items ?? [];
  return <View style={styles.card}><Heading icon="cube-outline" title="Sản phẩm đã đặt" />{items.length ? <View>{items.map(item => <View key={item.id} style={styles.product}><OrderProductImage uri={item.productImage} iconSize={27} style={styles.productImage} /><View style={styles.productCopy}><Text numberOfLines={2} style={styles.productName}>{item.productName || 'Sản phẩm'}</Text><Text style={styles.productMeta}>{formatVnd(Number(item.price) || 0)} × {Number(item.quantity) || 0}</Text></View><Text style={styles.productTotal}>{formatVnd(Number(item.subtotal) || 0)}</Text></View>)}</View> : <Text style={styles.emptyText}>Không có dữ liệu sản phẩm trong đơn hàng.</Text>}</View>;
}

function TotalsCard({ order }: { order: Order }) {
  const subtotal = Number(order.subtotalAmount) || Number(order.totalAmount) || 0;
  const discount = Number(order.discountAmount) || 0;
  return <View style={styles.card}><Heading icon="calculator-outline" title="Tổng thanh toán" /><PriceLine label="Tạm tính" value={formatVnd(subtotal)} />{discount > 0 ? <PriceLine label={order.couponCode ? `Mã ${order.couponCode}` : 'Giảm giá'} value={`-${formatVnd(discount)}`} positive /> : null}<PriceLine label="Phí vận chuyển" value={order.shippingFee === undefined ? 'Không có dữ liệu' : order.shippingFee === 0 ? 'Miễn phí' : formatVnd(Number(order.shippingFee))} /><View style={styles.totalLine}><Text style={styles.totalLabel}>Tổng thanh toán</Text><Text style={styles.totalValue}>{formatVnd(Number(order.totalAmount) || 0)}</Text></View></View>;
}

function Heading({ icon, title }: { icon: 'receipt-outline' | 'location-outline' | 'cube-outline' | 'calculator-outline'; title: string }) {
  return <View style={styles.heading}><View style={styles.headingIcon}><Ionicons name={icon} size={18} color={colors.ink} /></View><Text style={styles.headingText}>{title}</Text></View>;
}

function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }
function PriceLine({ label, value, positive = false }: { label: string; value: string; positive?: boolean }) { return <View style={styles.priceLine}><Text style={styles.priceLabel}>{label}</Text><Text style={[styles.priceValue, positive && styles.positive]}>{value}</Text></View>; }

function State({ loading, title, message, action, onPress }: { loading?: boolean; title: string; message: string; action?: string; onPress?: () => void }) {
  return <View style={styles.state}>{loading ? <ActivityIndicator size="large" color={colors.ink} /> : <Ionicons name="alert-circle-outline" size={43} color={colors.ink} />}<Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{message}</Text>{action && onPress ? <Pressable onPress={onPress} style={styles.primaryButton}><Text style={styles.primaryText}>{action}</Text></Pressable> : null}</View>;
}

function formatDate(value?: string) {
  const date = value ? new Date(value) : null;
  return !date || Number.isNaN(date.getTime()) ? 'Không rõ' : date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

const styles = StyleSheet.create(withTypography({
  page: { flex: 1, backgroundColor: colors.bg }, scroll: { flex: 1 }, content: { flexGrow: 1 }, shell: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 18, paddingBottom: 12 }, shellCompact: { paddingHorizontal: 12, paddingTop: 12 }, flex: { flex: 1 }, breadcrumb: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 14 }, breadcrumbLink: { color: colors.ink, fontSize: 12, fontWeight: '800' }, breadcrumbCurrent: { color: colors.muted, fontSize: 12 }, hero: { padding: 20, borderRadius: 17, backgroundColor: colors.line, borderWidth: 1, borderColor: colors.subtle, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 14 }, heroCompact: { alignItems: 'flex-start', flexDirection: 'column' }, eyebrow: { color: colors.ink, fontSize: 12, fontWeight: '900', letterSpacing: 1.1 }, title: { color: colors.ink, fontSize: 27, lineHeight: 34, fontWeight: '900', marginTop: 3 }, subtitle: { color: colors.muted, fontSize: 12, marginTop: 4 }, status: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999 }, statusText: { fontSize: 12, fontWeight: '900' }, cancelled: { marginBottom: 14, padding: 12, borderRadius: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FBE8E5', borderWidth: 1, borderColor: '#EDC6C0' }, cancelledTitle: { color: colors.danger, fontSize: 12, fontWeight: '900' }, cancelledText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 2 }, grid: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 }, gridCompact: { flexDirection: 'column', alignItems: 'stretch' }, main: { flex: 1.5, gap: 14 }, side: { flex: 1, gap: 14 }, card: { padding: 17, borderRadius: 15, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }, heading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line }, headingIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lineSoft }, headingText: { color: colors.ink, fontSize: 15, fontWeight: '900' }, infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, info: { width: '46%', minWidth: 145 }, infoLabel: { color: colors.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 }, infoValue: { color: colors.ink, fontSize: 12, lineHeight: 18, fontWeight: '800', marginTop: 3 }, receiver: { color: colors.ink, fontSize: 14, fontWeight: '900' }, bodyText: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 4 }, address: { color: colors.ink, fontSize: 12, lineHeight: 19, marginTop: 9 }, note: { marginTop: 12, padding: 10, borderRadius: 9, backgroundColor: colors.bg, flexDirection: 'row', alignItems: 'flex-start', gap: 6 }, noteText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 16 }, product: { minHeight: 76, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: colors.lineSoft }, productImage: { width: 60, height: 60, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line }, image: { width: '90%', height: '90%' }, productCopy: { flex: 1, minWidth: 0 }, productName: { color: colors.ink, fontSize: 12, lineHeight: 18, fontWeight: '800' }, productMeta: { color: colors.muted, fontSize: 12, marginTop: 3 }, productTotal: { color: colors.ink, fontSize: 12, fontWeight: '900' }, emptyText: { color: colors.muted, fontSize: 11, textAlign: 'center', paddingVertical: 18 }, priceLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 10 }, priceLabel: { color: colors.muted, fontSize: 11 }, priceValue: { color: colors.ink, fontSize: 11, fontWeight: '800', textAlign: 'right' }, positive: { color: colors.success }, totalLine: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, totalLabel: { color: colors.ink, fontSize: 14, fontWeight: '900' }, totalValue: { color: colors.ink, fontSize: 18, fontWeight: '900' }, actions: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, actionsCompact: { flexDirection: 'column' }, secondaryButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.subtle, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, secondaryText: { color: colors.ink, fontSize: 11, fontWeight: '900' }, primaryButton: { minHeight: 44, paddingHorizontal: 15, borderRadius: 999, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, primaryText: { color: colors.white, fontSize: 11, fontWeight: '900' }, state: { minHeight: 360, padding: 30, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: 8 }, stateTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', textAlign: 'center' }, stateText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 470 },
}));
