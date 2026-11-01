import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { adminOrderPageCount, adminOrderTransitions, filterAdminOrders } from '../adminOrders.mjs';
import { formatVnd, orderApi } from '../api';
import { AdminLayout } from '../components/admin/AdminLayout';
import { OrderProductImage } from '../components/OrderProductImage';
import { useStore } from '../store';
import { colors } from '../theme';
import { withTypography } from '../typography';
import type { Order, PaymentMethod } from '../types';

const PAGE_SIZE = 12;
type PeriodFilter = '' | 'today' | '7d' | '30d';
type StatusFilter = '' | Order['status'];
type MethodFilter = '' | PaymentMethod;

const statusLabels: Record<Order['status'], string> = { PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy' };
const paymentLabels: Record<PaymentMethod, string> = { CASH: 'Tiền mặt', CARD: 'Thẻ', QR: 'QR', PAYOS: 'PayOS' };
const statusOptions: StatusFilter[] = ['', 'PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED'];
const methodOptions: MethodFilter[] = ['', 'CASH', 'CARD', 'QR', 'PAYOS'];
const periodOptions: Array<{ value: PeriodFilter; label: string }> = [{ value: '', label: 'Mọi thời gian' }, { value: 'today', label: 'Hôm nay' }, { value: '7d', label: '7 ngày' }, { value: '30d', label: '30 ngày' }];

export default function AdminOrdersScreen() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 760;
  const { authReady, user, logout } = useStore();
  const loadingRequest = useRef(false);
  const seenOrderIds = useRef<Set<number> | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [method, setMethod] = useState<MethodFilter>('');
  const [period, setPeriod] = useState<PeriodFilter>('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirmChange, setConfirmChange] = useState<{ orderId: number; status: Order['status'] } | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const isAdmin = authReady && user?.role === 'ADMIN';

  const load = useCallback(async (mode: 'initial' | 'manual' | 'silent' = 'manual', signal?: AbortSignal) => {
    if (user?.role !== 'ADMIN' || loadingRequest.current) return;
    loadingRequest.current = true;
    if (mode === 'initial') setLoading(true);
    if (mode === 'manual') setRefreshing(true);
    try {
      const data = await orderApi.adminList(signal);
      if (signal?.aborted) return;
      if (seenOrderIds.current) {
        const newest = data.find(order => !seenOrderIds.current?.has(order.id));
        if (newest) setNotice(`Đơn hàng mới #${newest.id} từ ${newest.fullName} đang chờ xử lý.`);
      }
      seenOrderIds.current = new Set(data.map(order => order.id));
      setOrders(data);
      setLastUpdated(Date.now());
      setError('');
    } catch (failure) {
      if ((failure as Error).name !== 'AbortError') setError(failure instanceof Error ? failure.message : 'Không thể tải danh sách đơn hàng.');
    } finally {
      loadingRequest.current = false;
      if (!signal?.aborted) { setLoading(false); setRefreshing(false); }
    }
  }, [user?.role]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) router.replace({ pathname: '/login', params: { redirect: '/admin/orders' } });
    else if (user.role !== 'ADMIN') router.replace('/');
  }, [authReady, router, user]);

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    void load('initial', controller.signal);
    const interval = setInterval(() => void load('silent', controller.signal), 5000);
    return () => { clearInterval(interval); controller.abort(); };
  }, [isAdmin, load]);

  const filteredOrders = useMemo<Order[]>(() => filterAdminOrders(orders, { keyword, status, paymentMethod: method, period }), [keyword, method, orders, period, status]);
  const pageCount = adminOrderPageCount(filteredOrders.length, PAGE_SIZE);
  const visibleOrders = useMemo<Order[]>(() => filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredOrders, page]);
  const selectedOrder = selectedId === null ? null : orders.find(order => order.id === selectedId) ?? null;
  const confirmationOrder = confirmChange ? orders.find(order => order.id === confirmChange.orderId) ?? null : null;

  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  if (!isAdmin || !user) return <AdminGateState />;

  const signOut = () => { void logout().finally(() => router.replace('/login')); };
  const resetFilters = () => { setKeyword(''); setStatus(''); setMethod(''); setPeriod(''); setPage(1); };
  const requestStatusChange = (order: Order, nextStatus: Order['status']) => setConfirmChange({ orderId: order.id, status: nextStatus });

  const updateStatus = async () => {
    if (!confirmChange || !confirmationOrder || updatingId !== null) return;
    if (!adminOrderTransitions(confirmationOrder.status).includes(confirmChange.status)) {
      setError('Trạng thái đơn hàng đã thay đổi. Danh sách đã được làm mới để tránh ghi đè dữ liệu mới hơn.');
      setConfirmChange(null);
      await load('silent');
      return;
    }
    setUpdatingId(confirmationOrder.id);
    setError('');
    try {
      const updated = await orderApi.adminUpdateStatus(confirmationOrder.id, confirmChange.status);
      setOrders(current => current.map(order => order.id === updated.id ? { ...order, ...updated, items: order.items } : order));
      setNotice(`Đã chuyển đơn #${updated.id} sang “${statusLabels[updated.status]}”.`);
      setConfirmChange(null);
      await load('silent');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Không thể cập nhật trạng thái đơn hàng.');
    } finally {
      setUpdatingId(null);
    }
  };

  return <AdminLayout user={user} onLogout={signOut}>
    <StatusBar style="light" />
    <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={[styles.content, compact && styles.contentCompact]}>
      <View style={[styles.pageHeading, compact && styles.pageHeadingCompact]}><View style={styles.headingCopy}><Text style={styles.eyebrow}>ORDER OPERATIONS</Text><Text style={[styles.title, compact && styles.titleCompact]}>Quản lý đơn hàng</Text><Text style={styles.subtitle}>Theo dõi đơn, thanh toán và xử lý đúng vòng đời nghiệp vụ.</Text></View><View style={[styles.liveBox, compact && styles.liveBoxCompact]}><View style={styles.liveDot} /><View style={styles.liveCopy}><Text style={styles.liveTitle}>Tự động cập nhật mỗi 5 giây</Text><Text style={styles.liveTime}>{lastUpdated ? `Cập nhật lúc ${formatTime(lastUpdated)}` : 'Chưa có dữ liệu cập nhật'}</Text></View></View><Pressable accessibilityRole="button" disabled={refreshing} onPress={() => void load('manual')} style={[styles.refreshButton, refreshing && styles.disabled]}>{refreshing ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="refresh" size={17} color={colors.white} />}<Text style={styles.refreshText}>Làm mới</Text></Pressable></View>

      {notice ? <View style={styles.noticeBanner}><Ionicons name="notifications-outline" size={18} color={colors.accent} /><Text style={styles.noticeText}>{notice}</Text><Pressable accessibilityRole="button" accessibilityLabel="Đóng thông báo" onPress={() => setNotice('')} style={styles.closeNotice}><Ionicons name="close" size={18} color={colors.muted} /></Pressable></View> : null}
      {error && orders.length ? <View style={styles.errorBanner}><Ionicons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load('manual')}><Text style={styles.retryText}>Thử lại</Text></Pressable></View> : null}

      <View style={styles.panel}>
        <View style={[styles.searchRow, compact && styles.searchRowCompact]}><View style={styles.searchBox}><Ionicons name="search" size={18} color={colors.subtle} /><TextInput accessibilityLabel="Tìm đơn hàng" value={keyword} onChangeText={value => { setKeyword(value); setPage(1); }} placeholder="Mã đơn, tên, email hoặc số điện thoại..." placeholderTextColor={colors.subtle} style={styles.searchInput} /></View><Pressable accessibilityRole="button" onPress={resetFilters} style={styles.resetButton}><Ionicons name="refresh-outline" size={17} color={colors.ink} /><Text style={styles.resetText}>Xóa bộ lọc</Text></Pressable></View>
        <FilterGroup label="Trạng thái đơn"><FilterChip label="Tất cả" active={!status} onPress={() => { setStatus(''); setPage(1); }} />{statusOptions.slice(1).map(value => <FilterChip key={value} label={statusLabels[value as Order['status']]} active={status === value} onPress={() => { setStatus(value); setPage(1); }} />)}</FilterGroup>
        <FilterGroup label="Phương thức thanh toán"><FilterChip label="Tất cả" active={!method} onPress={() => { setMethod(''); setPage(1); }} />{methodOptions.slice(1).map(value => <FilterChip key={value} label={paymentLabels[value as PaymentMethod]} active={method === value} onPress={() => { setMethod(value); setPage(1); }} />)}</FilterGroup>
        <FilterGroup label="Ngày đặt">{periodOptions.map(option => <FilterChip key={option.value || 'all'} label={option.label} active={period === option.value} onPress={() => { setPeriod(option.value); setPage(1); }} />)}</FilterGroup>
      </View>

      {confirmationOrder && confirmChange ? <ConfirmStatusPanel order={confirmationOrder} nextStatus={confirmChange.status} busy={updatingId === confirmationOrder.id} compact={compact} onCancel={() => setConfirmChange(null)} onConfirm={() => void updateStatus()} /> : null}
      {selectedOrder ? <OrderDetailPanel order={selectedOrder} compact={compact} busy={updatingId === selectedOrder.id} onClose={() => setSelectedId(null)} onStatusChange={requestStatusChange} /> : null}

      <View style={styles.listPanel}>
        <View style={styles.listHeading}><View><Text style={styles.panelEyebrow}>ORDERS</Text><Text style={styles.panelTitle}>{filteredOrders.length} đơn hàng</Text></View><Text style={styles.resultMeta}>{orders.length === filteredOrders.length ? 'Toàn bộ dữ liệu' : `${orders.length} đơn trong hệ thống`}</Text></View>
        {loading ? <StatePanel loading title="Đang tải đơn hàng" message="Hệ thống đang lấy dữ liệu quản trị." /> : error && !orders.length ? <StatePanel icon="cloud-offline-outline" title="Không thể tải đơn hàng" message={error} action="Thử lại" onPress={() => void load('manual')} /> : !visibleOrders.length ? <StatePanel icon="receipt-outline" title="Không có đơn hàng" message={orders.length ? 'Không có đơn phù hợp với bộ lọc hiện tại.' : 'Chưa có đơn hàng nào trong hệ thống.'} /> : compact ? <View style={styles.cardList}>{visibleOrders.map(order => <OrderCard key={order.id} order={order} busy={updatingId === order.id} onDetail={() => setSelectedId(order.id)} onStatusChange={requestStatusChange} />)}</View> : <OrderTable orders={visibleOrders} busyId={updatingId} onDetail={order => setSelectedId(order.id)} onStatusChange={requestStatusChange} />}
        {!loading && !error && filteredOrders.length > 0 ? <View style={[styles.pagination, compact && styles.paginationCompact]}><Text style={styles.pageMeta}>Trang {page}/{pageCount} · {filteredOrders.length} kết quả</Text><View style={styles.pageActions}><Pressable accessibilityRole="button" disabled={page <= 1} onPress={() => setPage(value => Math.max(1, value - 1))} style={[styles.pageButton, page <= 1 && styles.disabled]}><Ionicons name="chevron-back" size={17} color={colors.ink} /><Text style={styles.pageButtonText}>Trước</Text></Pressable><Pressable accessibilityRole="button" disabled={page >= pageCount} onPress={() => setPage(value => Math.min(pageCount, value + 1))} style={[styles.pageButton, page >= pageCount && styles.disabled]}><Text style={styles.pageButtonText}>Sau</Text><Ionicons name="chevron-forward" size={17} color={colors.ink} /></Pressable></View></View> : null}
      </View>
    </ScrollView>
  </AdminLayout>;
}

function ConfirmStatusPanel({ order, nextStatus, busy, compact, onCancel, onConfirm }: { order: Order; nextStatus: Order['status']; busy: boolean; compact: boolean; onCancel: () => void; onConfirm: () => void }) {
  const cashPaid = nextStatus === 'DELIVERED' && order.paymentMethod === 'CASH' && order.paymentStatus === 'UNPAID';
  return <View style={[styles.confirmBox, compact && styles.confirmBoxCompact]}><View style={styles.confirmIcon}><Ionicons name={nextStatus === 'CANCELLED' ? 'warning-outline' : 'swap-horizontal-outline'} size={22} color={nextStatus === 'CANCELLED' ? colors.danger : colors.accent} /></View><View style={styles.confirmCopy}><Text style={styles.confirmTitle}>Chuyển đơn #{order.id} sang “{statusLabels[nextStatus]}”?</Text><Text style={styles.confirmText}>{nextStatus === 'CANCELLED' ? 'Đơn bị hủy là trạng thái cuối và không thể tiếp tục xử lý trên giao diện quản trị.' : cashPaid ? 'Backend sẽ đồng thời ghi nhận đơn tiền mặt này đã thanh toán khi giao thành công.' : 'Trạng thái chỉ được cập nhật sau khi Backend xác nhận.'}</Text></View><View style={styles.confirmActions}><Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={styles.secondaryButton}><Text style={styles.secondaryText}>Quay lại</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={onConfirm} style={[styles.confirmButton, nextStatus === 'CANCELLED' && styles.dangerButton, busy && styles.disabled]}>{busy ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="checkmark" size={17} color={colors.white} />}<Text style={styles.confirmButtonText}>Xác nhận</Text></Pressable></View></View>;
}

function OrderDetailPanel({ order, compact, busy, onClose, onStatusChange }: { order: Order; compact: boolean; busy: boolean; onClose: () => void; onStatusChange: (order: Order, status: Order['status']) => void }) {
  return <View style={styles.detailPanel}><View style={styles.detailHeading}><View><Text style={styles.panelEyebrow}>ORDER #{order.id}</Text><Text style={styles.detailTitle}>Chi tiết đơn hàng</Text><Text style={styles.detailDate}>{formatDateTime(order.createdAt)}</Text></View><View style={styles.detailHeadingRight}><OrderStatusBadge status={order.status} /><Pressable accessibilityRole="button" accessibilityLabel="Đóng chi tiết" onPress={onClose} style={styles.iconButton}><Ionicons name="close" size={20} color={colors.ink} /></Pressable></View></View><View style={[styles.detailGrid, compact && styles.detailGridCompact]}><View style={styles.detailMain}><Section title="Sản phẩm" icon="cube-outline">{order.items.length ? order.items.map(item => <View key={item.id} style={styles.detailProduct}><OrderProductImage uri={item.productImage} style={styles.detailImage} /><View style={styles.detailProductCopy}><Text numberOfLines={2} style={styles.detailProductName}>{item.productName || 'Sản phẩm'}</Text><Text style={styles.detailProductMeta}>{formatVnd(Number(item.price) || 0)} × {item.quantity}</Text></View><Text style={styles.detailSubtotal}>{formatVnd(Number(item.subtotal) || 0)}</Text></View>) : <Text style={styles.emptyInline}>Không có dữ liệu sản phẩm.</Text>}</Section><Section title="Thông tin giao hàng" icon="location-outline"><Text style={styles.receiver}>{order.fullName}</Text><Text style={styles.infoText}>{order.email}</Text><Text style={styles.infoText}>{order.phone}</Text><Text style={styles.addressText}>{order.address}</Text>{order.note ? <View style={styles.noteBox}><Ionicons name="document-text-outline" size={16} color={colors.muted} /><Text style={styles.noteText}>{order.note}</Text></View> : null}</Section></View><View style={styles.detailSide}><Section title="Thanh toán" icon="card-outline"><InfoLine label="Phương thức" value={paymentLabels[order.paymentMethod]} /><InfoLine label="Trạng thái" value={order.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'} positive={order.paymentStatus === 'PAID'} /><InfoLine label="Tạm tính" value={formatVnd(Number(order.subtotalAmount) || 0)} /><InfoLine label={order.couponCode ? `Giảm giá (${order.couponCode})` : 'Giảm giá'} value={`−${formatVnd(Number(order.discountAmount) || 0)}`} positive={Number(order.discountAmount) > 0} />{typeof order.shippingFee === 'number' ? <InfoLine label="Phí vận chuyển" value={formatVnd(order.shippingFee)} /> : null}<View style={styles.totalLine}><Text style={styles.totalLabel}>Tổng cộng</Text><Text style={styles.totalValue}>{formatVnd(Number(order.totalAmount) || 0)}</Text></View></Section><Section title="Xử lý đơn" icon="git-branch-outline"><OrderStatusBadge status={order.status} /><Text style={styles.transitionHint}>{adminOrderTransitions(order.status).length ? 'Chọn bước xử lý tiếp theo. Mọi thay đổi đều cần xác nhận.' : 'Đơn đang ở trạng thái cuối, không còn thao tác chuyển tiếp.'}</Text><StatusActions order={order} busy={busy} onStatusChange={onStatusChange} /></Section></View></View></View>;
}

function Section({ title, icon, children }: { title: string; icon: React.ComponentProps<typeof Ionicons>['name']; children: React.ReactNode }) {
  return <View style={styles.section}><View style={styles.sectionHeading}><View style={styles.sectionIcon}><Ionicons name={icon} size={17} color={colors.accent} /></View><Text style={styles.sectionTitle}>{title}</Text></View>{children}</View>;
}

function InfoLine({ label, value, positive = false }: { label: string; value: string; positive?: boolean }) {
  return <View style={styles.infoLine}><Text style={styles.infoLabel}>{label}</Text><Text style={[styles.infoValue, positive && styles.positive]}>{value}</Text></View>;
}

function OrderTable({ orders, busyId, onDetail, onStatusChange }: { orders: Order[]; busyId: number | null; onDetail: (order: Order) => void; onStatusChange: (order: Order, status: Order['status']) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScroll}><View style={styles.table}><View style={[styles.tableRow, styles.tableHead]}><Text style={[styles.tableHeadText, styles.orderColumn]}>Đơn</Text><Text style={[styles.tableHeadText, styles.customerColumn]}>Khách hàng</Text><Text style={[styles.tableHeadText, styles.productColumn]}>Sản phẩm</Text><Text style={[styles.tableHeadText, styles.moneyColumn]}>Tổng tiền</Text><Text style={[styles.tableHeadText, styles.paymentColumn]}>Thanh toán</Text><Text style={[styles.tableHeadText, styles.statusColumn]}>Trạng thái</Text><Text style={[styles.tableHeadText, styles.actionColumn]}>Thao tác</Text></View>{orders.map(order => <View key={order.id} style={styles.tableRow}><View style={styles.orderColumn}><Text style={styles.orderId}>#{order.id}</Text><Text style={styles.cellMuted}>{formatDateTime(order.createdAt)}</Text></View><View style={styles.customerColumn}><Text numberOfLines={1} style={styles.cellStrong}>{order.fullName}</Text><Text numberOfLines={1} style={styles.cellMuted}>{order.phone}</Text></View><View style={[styles.productColumn, styles.productSummary]}><OrderProductImage uri={order.items[0]?.productImage} style={styles.tableImage} /><View style={styles.productSummaryCopy}><Text numberOfLines={2} style={styles.cellStrong}>{order.items[0]?.productName || 'Không có dữ liệu'}</Text><Text style={styles.cellMuted}>{order.items.length} sản phẩm</Text></View></View><Text numberOfLines={1} style={[styles.moneyText, styles.moneyColumn]}>{formatVnd(Number(order.totalAmount) || 0)}</Text><View style={styles.paymentColumn}><Text style={styles.cellStrong}>{paymentLabels[order.paymentMethod]}</Text><PaymentBadge status={order.paymentStatus} /></View><View style={styles.statusColumn}><OrderStatusBadge status={order.status} /></View><View style={styles.actionColumn}><Pressable accessibilityRole="button" onPress={() => onDetail(order)} style={styles.detailButton}><Ionicons name="eye-outline" size={16} color={colors.accent} /><Text style={styles.detailButtonText}>Chi tiết</Text></Pressable><StatusActions order={order} busy={busyId === order.id} onStatusChange={onStatusChange} compact /></View></View>)}</View></ScrollView>;
}

function OrderCard({ order, busy, onDetail, onStatusChange }: { order: Order; busy: boolean; onDetail: () => void; onStatusChange: (order: Order, status: Order['status']) => void }) {
  return <View style={styles.orderCard}><View style={styles.cardTop}><OrderProductImage uri={order.items[0]?.productImage} style={styles.cardImage} /><View style={styles.cardCopy}><Text style={styles.orderId}>#{order.id}</Text><Text numberOfLines={1} style={styles.cardCustomer}>{order.fullName}</Text><Text style={styles.cellMuted}>{formatDateTime(order.createdAt)}</Text></View><OrderStatusBadge status={order.status} /></View><View style={styles.cardFacts}><View style={styles.fact}><Text style={styles.factLabel}>Sản phẩm</Text><Text numberOfLines={1} style={styles.factValue}>{order.items.length} sản phẩm</Text></View><View style={styles.fact}><Text style={styles.factLabel}>Thanh toán</Text><Text style={styles.factValue}>{paymentLabels[order.paymentMethod]}</Text><PaymentBadge status={order.paymentStatus} /></View><View style={styles.fact}><Text style={styles.factLabel}>Tổng tiền</Text><Text numberOfLines={1} style={styles.factMoney}>{formatVnd(Number(order.totalAmount) || 0)}</Text></View></View><Pressable accessibilityRole="button" onPress={onDetail} style={styles.mobileDetailButton}><Ionicons name="eye-outline" size={17} color={colors.accent} /><Text style={styles.detailButtonText}>Xem chi tiết</Text></Pressable><StatusActions order={order} busy={busy} onStatusChange={onStatusChange} /></View>;
}

function StatusActions({ order, busy, onStatusChange, compact = false }: { order: Order; busy: boolean; onStatusChange: (order: Order, status: Order['status']) => void; compact?: boolean }) {
  const transitions = adminOrderTransitions(order.status) as Order['status'][];
  if (!transitions.length) return null;
  return <View style={[styles.statusActions, compact && styles.statusActionsCompact]}>{transitions.map(nextStatus => <Pressable key={nextStatus} accessibilityRole="button" disabled={busy} onPress={() => onStatusChange(order, nextStatus)} style={[styles.statusAction, nextStatus === 'CANCELLED' && styles.cancelAction, busy && styles.disabled]}><Text style={[styles.statusActionText, nextStatus === 'CANCELLED' && styles.cancelActionText]}>{nextStatus === 'CONFIRMED' ? 'Xác nhận' : nextStatus === 'DELIVERED' ? 'Đã giao' : 'Hủy đơn'}</Text></Pressable>)}</View>;
}

function OrderStatusBadge({ status }: { status: Order['status'] }) {
  return <View style={[styles.statusBadge, styles[`status${status}`]]}><Text style={[styles.statusBadgeText, styles[`statusText${status}`]]}>{statusLabels[status]}</Text></View>;
}

function PaymentBadge({ status }: { status: Order['paymentStatus'] }) {
  return <Text style={[styles.paymentStatus, status === 'PAID' ? styles.paid : styles.unpaid]}>{status === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</Text>;
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.filterGroup}><Text style={styles.filterLabel}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{children}</ScrollView></View>;
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function StatePanel({ loading = false, icon = 'receipt-outline', title, message, action, onPress }: { loading?: boolean; icon?: React.ComponentProps<typeof Ionicons>['name']; title: string; message: string; action?: string; onPress?: () => void }) {
  return <View style={styles.statePanel}>{loading ? <ActivityIndicator size="large" color={colors.accent} /> : <Ionicons name={icon} size={32} color={colors.subtle} />}<Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{message}</Text>{action && onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={styles.retryButton}><Text style={styles.retryButtonText}>{action}</Text></Pressable> : null}</View>;
}

function AdminGateState() {
  return <View style={styles.gate}><ActivityIndicator size="large" color={colors.accent} /><Text style={styles.gateText}>Đang xác minh quyền quản trị...</Text></View>;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Không rõ' : date.toLocaleString('vi-VN');
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString('vi-VN');
}

const styles = StyleSheet.create(withTypography({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 28, gap: 18, maxWidth: 1680, width: '100%', alignSelf: 'center' },
  contentCompact: { padding: 14, gap: 14 },
  pageHeading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pageHeadingCompact: { alignItems: 'stretch', flexDirection: 'column' },
  headingCopy: { flex: 1 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: 5 },
  titleCompact: { fontSize: 24 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 5 },
  liveBox: { minHeight: 44, paddingHorizontal: 13, borderRadius: 8, borderWidth: 1, borderColor: '#C6E8D6', backgroundColor: '#F1FAF5', flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveBoxCompact: { alignSelf: 'stretch' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveCopy: { gap: 1 },
  liveTitle: { color: colors.success, fontSize: 10, fontWeight: '800' },
  liveTime: { color: colors.muted, fontSize: 8 },
  refreshButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  refreshText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  noticeBanner: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: '#F1FAFC', flexDirection: 'row', alignItems: 'center', gap: 8 },
  noticeText: { flex: 1, color: colors.accent, fontSize: 11, fontWeight: '700' },
  closeNotice: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  errorBanner: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#F0CACA', backgroundColor: '#FFF7F7', flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, color: colors.danger, fontSize: 11 },
  retryText: { color: colors.danger, fontSize: 10, fontWeight: '800' },
  panel: { padding: 17, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 11 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchRowCompact: { alignItems: 'stretch', flexDirection: 'column' },
  searchBox: { flex: 1, minHeight: 44, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white },
  searchInput: { flex: 1, minWidth: 0, paddingHorizontal: 9, color: colors.ink, fontSize: 12 },
  resetButton: { minHeight: 44, paddingHorizontal: 13, borderRadius: 8, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  resetText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  filterGroup: { gap: 5 },
  filterLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  chipRow: { gap: 7, paddingVertical: 2 },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  chipActive: { borderColor: colors.accent, backgroundColor: '#E1F4FA' },
  chipText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  chipTextActive: { color: colors.accent },
  confirmBox: { padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 12 },
  confirmBoxCompact: { alignItems: 'stretch', flexDirection: 'column' },
  confirmIcon: { width: 42, height: 42, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  confirmCopy: { flex: 1 },
  confirmTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  confirmText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 4 },
  confirmActions: { flexDirection: 'row', gap: 8 },
  secondaryButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  confirmButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 7, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dangerButton: { backgroundColor: colors.danger },
  confirmButtonText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  detailPanel: { padding: 18, borderRadius: 12, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: colors.white, gap: 14 },
  detailHeading: { paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center' },
  panelEyebrow: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  detailTitle: { color: colors.ink, fontSize: 20, fontWeight: '800', marginTop: 3 },
  detailDate: { color: colors.muted, fontSize: 10, marginTop: 4 },
  detailHeadingRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 9 },
  iconButton: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  detailGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  detailGridCompact: { alignItems: 'stretch', flexDirection: 'column' },
  detailMain: { flex: 1.45, gap: 13 },
  detailSide: { flex: 1, gap: 13 },
  section: { padding: 14, borderRadius: 9, borderWidth: 1, borderColor: colors.line, gap: 8 },
  sectionHeading: { paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionIcon: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E1F4FA' },
  sectionTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  detailProduct: { minHeight: 68, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center', gap: 9 },
  detailImage: { width: 55, height: 55, borderRadius: 7 },
  detailProductCopy: { flex: 1, minWidth: 0 },
  detailProductName: { color: colors.ink, fontSize: 11, fontWeight: '800', lineHeight: 16 },
  detailProductMeta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  detailSubtotal: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  emptyInline: { color: colors.muted, fontSize: 10, paddingVertical: 12, textAlign: 'center' },
  receiver: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  infoText: { color: colors.muted, fontSize: 10, marginTop: 2 },
  addressText: { color: colors.ink, fontSize: 11, lineHeight: 17, marginTop: 6 },
  noteBox: { marginTop: 5, padding: 9, borderRadius: 7, backgroundColor: colors.bg, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  noteText: { flex: 1, color: colors.muted, fontSize: 10, lineHeight: 16 },
  infoLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 3 },
  infoLabel: { flex: 1, color: colors.muted, fontSize: 10 },
  infoValue: { color: colors.ink, fontSize: 10, fontWeight: '800', textAlign: 'right' },
  positive: { color: colors.success },
  totalLine: { marginTop: 7, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  totalLabel: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  totalValue: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  transitionHint: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  listPanel: { padding: 18, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 12 },
  listHeading: { flexDirection: 'row', alignItems: 'center' },
  panelTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 2 },
  resultMeta: { marginLeft: 'auto', color: colors.muted, fontSize: 10 },
  statePanel: { minHeight: 260, padding: 25, alignItems: 'center', justifyContent: 'center', gap: 9 },
  stateTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  stateText: { maxWidth: 440, color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  retryButton: { minHeight: 38, marginTop: 3, paddingHorizontal: 13, borderRadius: 7, borderWidth: 1, borderColor: colors.accent, justifyContent: 'center' },
  retryButtonText: { color: colors.accent, fontSize: 10, fontWeight: '800' },
  tableScroll: { minWidth: 1220 },
  table: { minWidth: 1220, flex: 1 },
  tableRow: { minHeight: 92, paddingHorizontal: 9, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center' },
  tableHead: { minHeight: 46, borderRadius: 7, borderBottomWidth: 0, backgroundColor: colors.bg },
  tableHeadText: { paddingHorizontal: 7, color: colors.muted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  orderColumn: { width: 145, paddingHorizontal: 7 },
  customerColumn: { width: 170, paddingHorizontal: 7 },
  productColumn: { width: 235, paddingHorizontal: 7 },
  moneyColumn: { width: 125, paddingHorizontal: 7 },
  paymentColumn: { width: 135, paddingHorizontal: 7 },
  statusColumn: { width: 125, paddingHorizontal: 7 },
  actionColumn: { width: 250, paddingHorizontal: 7, gap: 5 },
  orderId: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  cellStrong: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  cellMuted: { color: colors.muted, fontSize: 9, marginTop: 3 },
  productSummary: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tableImage: { width: 49, height: 49, borderRadius: 7 },
  productSummaryCopy: { flex: 1, minWidth: 0 },
  moneyText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  detailButton: { alignSelf: 'flex-start', minHeight: 32, paddingHorizontal: 9, borderRadius: 6, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: '#F1FAFC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  detailButtonText: { color: colors.accent, fontSize: 9, fontWeight: '800' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  statusBadgeText: { fontSize: 9, fontWeight: '800' },
  statusPENDING: { backgroundColor: '#FFF3D6' }, statusTextPENDING: { color: '#986411' },
  statusCONFIRMED: { backgroundColor: '#E1F4FA' }, statusTextCONFIRMED: { color: colors.accent },
  statusDELIVERED: { backgroundColor: '#E2F3EA' }, statusTextDELIVERED: { color: colors.success },
  statusCANCELLED: { backgroundColor: '#FBE5E5' }, statusTextCANCELLED: { color: colors.danger },
  paymentStatus: { fontSize: 9, fontWeight: '700', marginTop: 4 },
  paid: { color: colors.success },
  unpaid: { color: '#986411' },
  statusActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusActionsCompact: { gap: 4 },
  statusAction: { minHeight: 32, paddingHorizontal: 9, borderRadius: 6, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: '#F1FAFC', alignItems: 'center', justifyContent: 'center' },
  statusActionText: { color: colors.accent, fontSize: 9, fontWeight: '800' },
  cancelAction: { borderColor: '#F0CACA', backgroundColor: '#FFF7F7' },
  cancelActionText: { color: colors.danger },
  cardList: { gap: 10 },
  orderCard: { padding: 13, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 11 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardImage: { width: 62, height: 62, borderRadius: 8 },
  cardCopy: { flex: 1, minWidth: 0 },
  cardCustomer: { color: colors.ink, fontSize: 12, fontWeight: '800', marginTop: 3 },
  cardFacts: { padding: 10, borderRadius: 7, backgroundColor: colors.bg, flexDirection: 'row', gap: 7 },
  fact: { flex: 1, minWidth: 0 },
  factLabel: { color: colors.muted, fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },
  factValue: { color: colors.ink, fontSize: 9, fontWeight: '700', marginTop: 3 },
  factMoney: { color: colors.ink, fontSize: 10, fontWeight: '800', marginTop: 3 },
  mobileDetailButton: { minHeight: 39, borderRadius: 7, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: '#F1FAFC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  pagination: { paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center' },
  paginationCompact: { alignItems: 'stretch', flexDirection: 'column', gap: 9 },
  pageMeta: { flex: 1, color: colors.muted, fontSize: 10 },
  pageActions: { flexDirection: 'row', gap: 7 },
  pageButton: { minHeight: 38, paddingHorizontal: 11, borderRadius: 7, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  pageButtonText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 11, backgroundColor: colors.bg },
  gateText: { color: colors.muted, fontSize: 12 },
}));
