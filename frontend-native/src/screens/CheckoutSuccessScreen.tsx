import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { orderApi, paymentApi } from '../api';
import type { Order } from '../types';
import { ChatWidget } from '../components/ChatWidget';
import { PageHeader } from '../components/PageHeader';
import { ProductFooter } from '../components/ProductFooter';
import { useStore } from '../store';
import { withTypography } from '../typography';

const statusLabels: Record<Order['status'], string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
};

const paymentStatusLabels: Record<Order['paymentStatus'], string> = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
};

export default function CheckoutSuccessScreen() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 760;
  const params = useLocalSearchParams<{ id?: string | string[]; method?: string }>();
  const { setCheckoutShipping } = useStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const orderId = useMemo(() => {
    const value = Array.isArray(params.id) ? params.id[0] : params.id;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }, [params.id]);

  useEffect(() => {
    setCheckoutShipping(null);
  }, [setCheckoutShipping]);

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setError('Thiếu mã đơn hàng để tải trạng thái đơn hàng.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setOrder(await orderApi.detail(orderId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải trạng thái đơn hàng.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const continuePayOS = async () => {
    if (!order) return;
    setBusy(true);
    try {
      const result = await paymentApi.createPayOSPaymentLink(order.id);
      if (typeof result.checkoutUrl === 'string' && result.checkoutUrl) {
        if (typeof globalThis !== 'undefined' && typeof globalThis.location !== 'undefined' && globalThis.location && typeof globalThis.location.assign === 'function') {
          globalThis.location.assign(result.checkoutUrl);
          return;
        }
        await Linking.openURL(result.checkoutUrl);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tạo link thanh toán PayOS.');
    } finally {
      setBusy(false);
    }
  };

  const paymentMethodText = order?.paymentMethod ?? ((params.method as Order['paymentMethod']) || 'CASH');
  const isPaid = order ? order.paymentStatus === 'PAID' : false;
  const isCash = paymentMethodText === 'CASH';
  const isCard = paymentMethodText === 'CARD';
  const isPayOS = paymentMethodText === 'QR' || paymentMethodText === 'PAYOS';
  const isCancelled = order?.status === 'CANCELLED';

  let title = 'Đang kiểm tra đơn hàng';
  let accentText = 'Hệ thống đang tải trạng thái mới nhất.';
  let detailText = 'Vui lòng chờ trong giây lát.';
  let stateColor = '#47724A';
  let stateIcon = 'checkmark-circle-outline';

  if (!order && !loading && error) {
    title = 'Không thể tải trạng thái đơn';
    accentText = 'Hệ thống chưa cập nhật trạng thái đơn hàng.';
    detailText = error;
    stateColor = '#9B382F';
    stateIcon = 'alert-circle-outline';
  } else if (isCancelled) {
    title = 'Đơn hàng đã bị hủy';
    accentText = 'Đơn hàng này không còn hiệu lực.';
    detailText = 'Nếu bạn cần hỗ trợ, vui lòng kiểm tra lại hoặc liên hệ bộ phận hỗ trợ.';
    stateColor = '#9B382F';
    stateIcon = 'close-circle-outline';
  } else if (order && isCash) {
    title = 'Đặt hàng thành công';
    accentText = 'Đơn hàng đang chờ cửa hàng xác nhận và thanh toán khi nhận hàng.';
    detailText = 'Hệ thống sẽ cập nhật trạng thái đơn ngay sau khi đơn được xác nhận.';
  } else if (order && isCard && !isPaid) {
    title = 'Chờ xác minh thanh toán';
    accentText = 'Thanh toán thẻ mô phỏng chưa được xác nhận.';
    detailText = 'Vui lòng kiểm tra lại trạng thái và PIN hoặc xem đơn hàng để thực hiện tiếp.';
    stateColor = '#1D1D1F';
    stateIcon = 'time-outline';
  } else if (order && isPayOS && !isPaid) {
    title = 'Chờ xác nhận thanh toán';
    accentText = 'Đơn hàng đã được tạo, nhưng thanh toán chưa được xác minh từ cổng thanh toán.';
    detailText = 'Bạn có thể kiểm tra lại đơn hàng hoặc tiếp tục thanh toán nếu cần.';
    stateColor = '#1D1D1F';
    stateIcon = 'time-outline';
  } else if (order && isPaid) {
    title = 'Thanh toán thành công';
    accentText = 'Đơn hàng đã được xác nhận và thanh toán thành công.';
    detailText = 'Bạn có thể tiếp tục mua sắm hoặc xem chi tiết đơn hàng.';
  }

  return (
    <View style={styles.page}>
      <PageHeader back />
      <ScrollView contentContainerStyle={[styles.scroll, compact && styles.scrollCompact]}>
        <View style={styles.content}>
          <View style={styles.card}>
            <View style={[styles.icon, { backgroundColor: stateColor }]}>
              <Ionicons name={stateIcon as any} size={38} color="#fff" />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.order}>Mã đơn hàng: #{orderId ?? params.id ?? '—'}</Text>
            <Text style={styles.description}>{accentText}</Text>
            <Text style={styles.description}>{detailText}</Text>

            {order && (
              <View style={styles.orderMeta}>
                <Text style={styles.metaRow}><Text style={styles.metaLabel}>Trạng thái đơn:</Text> {statusLabels[order.status]}</Text>
                <Text style={styles.metaRow}><Text style={styles.metaLabel}>Trạng thái thanh toán:</Text> {paymentStatusLabels[order.paymentStatus]}</Text>
                <Text style={styles.metaRow}><Text style={styles.metaLabel}>Phương thức:</Text> {order.paymentMethod === 'CASH' ? 'Tiền mặt khi nhận hàng' : order.paymentMethod === 'CARD' ? 'Thẻ mô phỏng' : 'PayOS / QR'}</Text>
                <Text style={styles.metaRow}><Text style={styles.metaLabel}>Tổng tiền:</Text> {order.totalAmount.toLocaleString('vi-VN')}₫</Text>
              </View>
            )}

            {loading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#1D1D1F" />
                <Text style={styles.loadingText}>Đang tải trạng thái đơn hàng...</Text>
              </View>
            )}

            {!loading && (
              <View style={[styles.actions, compact && styles.actionsCompact]}>
                {order && (
                  <Pressable style={styles.primaryButton} onPress={() => router.replace({ pathname: '/orders/[id]', params: { id: String(order.id) } })}>
                    <Text style={styles.primaryText}>Xem đơn hàng</Text>
                  </Pressable>
                )}
                {isPayOS && !isPaid && !isCancelled && (
                  <Pressable style={styles.secondaryButton} disabled={busy} onPress={() => void continuePayOS()}>
                    <Text style={styles.secondaryText}>{busy ? 'Đang xử lý...' : 'Tiếp tục thanh toán'}</Text>
                  </Pressable>
                )}
                {isCard && !isPaid && !isCancelled && (
                  <Pressable style={styles.secondaryButton} onPress={() => router.replace({ pathname: '/checkout/invoice', params: { id: String(orderId ?? params.id ?? '') } })}>
                    <Text style={styles.secondaryText}>Kiểm tra trạng thái</Text>
                  </Pressable>
                )}
                <Pressable style={styles.secondaryButton} onPress={() => router.replace('/products')}>
                  <Text style={styles.secondaryText}>Tiếp tục mua sắm</Text>
                </Pressable>
                <Pressable style={styles.ghostButton} onPress={() => router.replace('/')}>
                  <Text style={styles.ghostText}>Về trang chủ</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
        <ProductFooter />
      </ScrollView>
      <ChatWidget compact={compact} />
    </View>
  );
}

const styles = StyleSheet.create(withTypography({
  page: { flex: 1, backgroundColor: '#F5F5F7' },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 28 },
  scrollCompact: { paddingHorizontal: 12, paddingTop: 16 },
  content: { width: '100%', maxWidth: 850, alignSelf: 'center' },
  card: { padding: 38, borderRadius: 20, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D2D2D7' },
  icon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 18, color: '#1D1D1F', fontSize: 28, lineHeight: 35, fontWeight: '900', textAlign: 'center' },
  order: { marginTop: 8, color: '#1D1D1F', fontSize: 16, fontWeight: '900' },
  description: { maxWidth: 560, marginTop: 9, color: '#6E6E73', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  orderMeta: { width: '100%', marginTop: 18, padding: 14, borderRadius: 12, backgroundColor: '#F5F5F7', borderWidth: 1, borderColor: '#D2D2D7' },
  metaRow: { color: '#1D1D1F', fontSize: 12, lineHeight: 22 },
  metaLabel: { fontWeight: '800' },
  loadingRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { color: '#6E6E73', fontSize: 12 },
  actions: { marginTop: 24, flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 10 },
  actionsCompact: { flexDirection: 'column' },
  primaryButton: { minHeight: 45, paddingHorizontal: 20, borderRadius: 999, backgroundColor: '#1D1D1F', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  secondaryButton: { minHeight: 45, paddingHorizontal: 20, borderRadius: 999, borderWidth: 1, borderColor: '#A1A1A6', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#1D1D1F', fontSize: 12, fontWeight: '800' },
  ghostButton: { minHeight: 45, paddingHorizontal: 20, borderRadius: 9, borderWidth: 1, borderColor: '#A1A1A6', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  ghostText: { color: '#1D1D1F', fontSize: 12, fontWeight: '800' },
}));
