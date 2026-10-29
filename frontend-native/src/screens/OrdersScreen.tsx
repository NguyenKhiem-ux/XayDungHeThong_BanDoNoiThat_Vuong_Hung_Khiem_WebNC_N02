import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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

const statusLabels: Record<Order['status'], string> = { PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy' };
const paymentLabels: Record<Order['paymentMethod'], string> = { CASH: 'Thanh toán khi nhận hàng', CARD: 'Thẻ mô phỏng', QR: 'PayOS / QR', PAYOS: 'PayOS / QR' };
const statusPalette: Record<Order['status'], { backgroundColor: string; color: string }> = { PENDING: { backgroundColor: '#FFF1D8', color: '#8A5421' }, CONFIRMED: { backgroundColor: '#E5EEF6', color: '#37627C' }, DELIVERED: { backgroundColor: '#EAF2E8', color: '#47724A' }, CANCELLED: { backgroundColor: '#FBE8E5', color: '#9B382F' } };

export default function OrdersScreen() {
  const top = useScrollTop();
  const router = useRouter();
  const compact = useWindowDimensions().width < 760;
  const { authReady, user } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      setOrders(await orderApi.list());
    } catch (reason) {
      setOrders([]);
      setError(reason instanceof Error ? reason.message : 'Không thể tải danh sách đơn hàng.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authReady && !user) router.replace({ pathname: '/login', params: { redirect: '/orders' } });
  }, [authReady, router, user]);

  useEffect(() => { void load(); }, [load]);

  return <View style={styles.page}><ScrollView ref={top.ref} onScroll={top.onScroll} scrollEventThrottle={100} stickyHeaderIndices={[0]} style={styles.scroll} contentContainerStyle={styles.content}><Header compact={compact} categories={[]} /><View style={[styles.shell, compact && styles.shellCompact]}><View style={styles.breadcrumb}><Pressable onPress={() => router.replace('/')}><Text style={styles.breadcrumbLink}>Trang chủ</Text></Pressable><Ionicons name="chevron-forward" size={14} color="#A08E80" /><Pressable onPress={() => router.push('/profile')}><Text style={styles.breadcrumbLink}>Tài khoản</Text></Pressable><Ionicons name="chevron-forward" size={14} color="#A08E80" /><Text style={styles.breadcrumbCurrent}>Đơn hàng của tôi</Text></View><View style={[styles.hero, compact && styles.heroCompact]}><View><Text style={styles.eyebrow}>TÀI KHOẢN</Text><Text style={styles.title}>Đơn hàng của tôi</Text><Text style={styles.subtitle}>Theo dõi đơn hàng, trạng thái xử lý và thanh toán của bạn.</Text></View><Pressable onPress={() => router.push('/products')} style={styles.shopButton}><Ionicons name="bag-handle-outline" size={17} color="#755036" /><Text style={styles.shopButtonText}>Tiếp tục mua sắm</Text></Pressable></View>{!authReady || !user || loading ? <State icon="receipt-outline" loading title="Đang tải đơn hàng..." message="Vui lòng chờ trong giây lát." /> : error ? <State icon="cloud-offline-outline" title="Không thể tải đơn hàng" message={error} action="Thử lại" onPress={() => void load()} /> : orders.length ? <View style={styles.list}>{orders.map(order => <OrderCard key={order.id} order={order} compact={compact} onPress={() => router.push({ pathname: '/orders/[id]', params: { id: String(order.id) } })} />)}</View> : <State icon="receipt-outline" title="Chưa có đơn hàng nào" message="Đơn hàng sau khi đặt sẽ xuất hiện tại đây." action="Mua sắm ngay" onPress={() => router.push('/products')} />}</View><ProductFooter /></ScrollView><ScrollTopButton visible={top.visible} onPress={top.toTop} /><ChatWidget compact={compact} /></View>;
}

function OrderCard({ order, compact, onPress }: { order: Order; compact: boolean; onPress: () => void }) {
  const items = order.items ?? [];
  return <View style={styles.card}>
    <View style={[styles.cardTop, compact && styles.cardTopCompact]}><View><Text style={styles.orderLabel}>Mã đơn hàng</Text><Text style={styles.orderId}>#{order.id}</Text></View><View><Text style={styles.orderLabel}>Ngày đặt</Text><Text style={styles.orderValue}>{formatDate(order.createdAt)}</Text></View><View><Text style={styles.orderLabel}>Tổng tiền</Text><Text style={styles.orderTotal}>{formatVnd(Number(order.totalAmount) || 0)}</Text></View><View style={[styles.status, { backgroundColor: statusPalette[order.status].backgroundColor }]}><Text style={[styles.statusText, { color: statusPalette[order.status].color }]}>{statusLabels[order.status]}</Text></View></View>
    <View style={[styles.cardBody, compact && styles.cardBodyCompact]}><View style={styles.products}><View style={styles.thumbs}>{items.slice(0, 3).map(item => <OrderProductImage key={item.id} uri={item.productImage} style={styles.thumb} />)}{items.length > 3 && <View style={styles.thumbMore}><Text style={styles.thumbMoreText}>+{items.length - 3}</Text></View>}</View><View style={styles.productCopy}><Text numberOfLines={2} style={styles.productNames}>{items.length ? items.map(item => item.productName || 'Sản phẩm').join(' · ') : 'Không có dữ liệu sản phẩm'}</Text><Text numberOfLines={2} style={styles.productMeta}>{items.length ? items.slice(0, 2).map(item => `${Number(item.quantity) || 0} × ${formatVnd(Number(item.price) || 0)}`).join(' · ') : '0 sản phẩm'}</Text></View></View><View style={styles.payment}><Text style={styles.orderLabel}>Thanh toán</Text><Text style={styles.paymentMethod}>{paymentLabels[order.paymentMethod] ?? order.paymentMethod}</Text><Text style={[styles.paymentStatus, order.paymentStatus === 'PAID' ? styles.paid : styles.unpaid]}>{order.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</Text></View><Pressable accessibilityRole="link" onPress={onPress} style={styles.detailButton}><Text style={styles.detailButtonText}>Xem chi tiết</Text><Ionicons name="arrow-forward" size={16} color="#fff" /></Pressable></View>
  </View>;
}

function State({ icon, loading, title, message, action, onPress }: { icon: 'receipt-outline' | 'cloud-offline-outline'; loading?: boolean; title: string; message: string; action?: string; onPress?: () => void }) {
  return <View style={styles.state}>{loading ? <ActivityIndicator size="large" color="#755036" /> : <Ionicons name={icon} size={43} color="#A56E2D" />}<Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{message}</Text>{action && onPress ? <Pressable onPress={onPress} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{action}</Text></Pressable> : null}</View>;
}

function formatDate(value?: string) {
  const date = value ? new Date(value) : null;
  return !date || Number.isNaN(date.getTime()) ? 'Không rõ' : date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

const styles = StyleSheet.create(withTypography({
  page: { flex: 1, backgroundColor: '#F6EFE6' }, scroll: { flex: 1 }, content: { flexGrow: 1 }, shell: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 18, paddingBottom: 12 }, shellCompact: { paddingHorizontal: 12, paddingTop: 12 }, breadcrumb: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 14 }, breadcrumbLink: { color: '#755036', fontSize: 12, fontWeight: '800' }, breadcrumbCurrent: { color: '#8B7A6C', fontSize: 12 }, hero: { padding: 20, borderRadius: 17, backgroundColor: '#E8D5BA', borderWidth: 1, borderColor: '#CBA779', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 16 }, heroCompact: { alignItems: 'flex-start', flexDirection: 'column' }, eyebrow: { color: '#A56E2D', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#30251D', fontSize: 27, lineHeight: 34, fontWeight: '900', marginTop: 3 }, subtitle: { color: '#6D594A', fontSize: 12, lineHeight: 19, marginTop: 3 }, shopButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#CBA779', flexDirection: 'row', alignItems: 'center', gap: 7 }, shopButtonText: { color: '#755036', fontSize: 11, fontWeight: '900' }, list: { gap: 12 }, card: { borderRadius: 15, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E6D8C7', overflow: 'hidden' }, cardTop: { padding: 15, backgroundColor: '#FBF3E8', borderBottomWidth: 1, borderBottomColor: '#E6D8C7', flexDirection: 'row', alignItems: 'center', gap: 28 }, cardTopCompact: { flexWrap: 'wrap', gap: 15 }, orderLabel: { color: '#9A887A', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.45 }, orderId: { color: '#755036', fontSize: 15, fontWeight: '900', marginTop: 3 }, orderValue: { color: '#493629', fontSize: 12, fontWeight: '700', marginTop: 3 }, orderTotal: { color: '#30251D', fontSize: 14, fontWeight: '900', marginTop: 3 }, status: { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }, statusText: { fontSize: 10, fontWeight: '900' }, cardBody: { padding: 15, flexDirection: 'row', alignItems: 'center', gap: 18 }, cardBodyCompact: { flexDirection: 'column', alignItems: 'stretch' }, products: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11 }, thumbs: { flexDirection: 'row' }, thumb: { width: 46, height: 46, marginRight: -7, borderRadius: 9 }, thumbMore: { width: 46, height: 46, marginRight: -7, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8D5BA', borderWidth: 1, borderColor: '#CBA779' }, thumbMoreText: { color: '#755036', fontSize: 10, fontWeight: '900' }, productCopy: { flex: 1, minWidth: 0 }, productNames: { color: '#493629', fontSize: 12, lineHeight: 18, fontWeight: '800' }, productMeta: { color: '#8B7A6C', fontSize: 10, lineHeight: 15, marginTop: 4 }, payment: { minWidth: 150 }, paymentMethod: { color: '#493629', fontSize: 11, fontWeight: '800', marginTop: 4 }, paymentStatus: { fontSize: 10, fontWeight: '800', marginTop: 4 }, paid: { color: '#47724A' }, unpaid: { color: '#A56E2D' }, detailButton: { minHeight: 40, paddingHorizontal: 13, borderRadius: 9, backgroundColor: '#755036', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, detailButtonText: { color: '#fff', fontSize: 11, fontWeight: '900' }, state: { minHeight: 330, padding: 30, borderRadius: 16, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E6D8C7', alignItems: 'center', justifyContent: 'center', gap: 8 }, stateTitle: { color: '#30251D', fontSize: 17, fontWeight: '900', textAlign: 'center' }, stateText: { color: '#7D6B5D', fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 460 }, primaryButton: { minHeight: 40, marginTop: 6, paddingHorizontal: 15, borderRadius: 9, backgroundColor: '#755036', alignItems: 'center', justifyContent: 'center' }, primaryButtonText: { color: '#fff', fontSize: 11, fontWeight: '900' },
}));
