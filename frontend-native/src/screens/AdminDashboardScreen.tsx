import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { adminBarHeight, adminDayLabel, compactAdminMoney } from '../adminDashboard.mjs';
import { adminApi, formatVnd } from '../api';
import { AdminLayout } from '../components/admin/AdminLayout';
import { useStore } from '../store';
import { colors } from '../theme';
import { withTypography } from '../typography';
import type { DashboardData, Order } from '../types';

const statusLabels: Record<Order['status'], string> = { PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy' };
const statusColors: Record<Order['status'], { backgroundColor: string; color: string }> = {
  PENDING: { backgroundColor: '#FFF3D6', color: '#986411' },
  CONFIRMED: { backgroundColor: '#E1F4FA', color: '#087FA5' },
  DELIVERED: { backgroundColor: '#E2F3EA', color: '#147348' },
  CANCELLED: { backgroundColor: '#FBE5E5', color: '#B83232' },
};

export default function AdminDashboardScreen() {
  const router = useRouter();
  const width = useWindowDimensions().width;
  const compact = width < 720;
  const medium = width < 1500;
  const stackCharts = width < 1200;
  const { authReady, user, logout } = useStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (user?.role !== 'ADMIN') return;
    setLoading(true);
    setError('');
    try {
      setData(await adminApi.dashboard());
    } catch (failure) {
      setData(null);
      setError(failure instanceof Error ? failure.message : 'Không thể tải dữ liệu Dashboard.');
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) router.replace({ pathname: '/login', params: { redirect: '/admin' } });
    else if (user.role !== 'ADMIN') router.replace('/');
  }, [authReady, router, user]);

  useEffect(() => { void load(); }, [load]);

  if (!authReady || !user || user.role !== 'ADMIN') return <AdminGateState />;

  const signOut = () => { void logout().finally(() => router.replace('/login')); };
  return <AdminLayout user={user} onLogout={signOut}>
    <StatusBar style="light" />
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, compact && styles.contentCompact]}>
      <View style={styles.pageHeading}><View><Text style={styles.eyebrow}>ADMIN OVERVIEW</Text><Text style={[styles.title, compact && styles.titleCompact]}>Dashboard</Text><Text style={styles.subtitle}>Theo dõi hoạt động kinh doanh từ dữ liệu hệ thống hiện tại.</Text></View><Pressable accessibilityRole="button" disabled={loading} onPress={() => void load()} style={[styles.refreshButton, loading && styles.disabled]}>{loading ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="refresh" size={17} color={colors.white} />}<Text style={styles.refreshText}>Làm mới</Text></Pressable></View>
      {loading ? <StatePanel loading title="Đang tải Dashboard" message="Hệ thống đang tổng hợp dữ liệu quản trị." /> : error || !data ? <StatePanel title="Không thể tải Dashboard" message={error || 'Không có dữ liệu trả về.'} action="Thử lại" onPress={() => void load()} /> : <DashboardContent data={data} compact={compact} medium={medium} stackCharts={stackCharts} />}
    </ScrollView>
  </AdminLayout>;
}

function DashboardContent({ data, compact, medium, stackCharts }: { data: DashboardData; compact: boolean; medium: boolean; stackCharts: boolean }) {
  const kpis = [
    ['cash-outline', 'Giá trị đơn hàng', formatVnd(Number(data.revenue) || 0)],
    ['receipt-outline', 'Tổng đơn hàng', String(data.orders)],
    ['time-outline', 'Chờ xử lý', String(data.pendingOrders)],
    ['cube-outline', 'Sản phẩm', String(data.products)],
    ['people-outline', 'Khách hàng', String(data.users)],
  ] as const;
  return <View style={styles.dashboard}>
    <View style={styles.kpiGrid}>{kpis.map(([icon, label, value]) => <View key={label} style={[styles.kpiCard, compact ? styles.kpiCompact : medium ? styles.kpiNarrow : styles.kpiWide]}><View style={styles.kpiIcon}><Ionicons name={icon} size={21} color={colors.accent} /></View><Text style={styles.kpiLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.kpiValue}>{value}</Text></View>)}</View>
    <View style={[styles.chartGrid, stackCharts && styles.chartGridNarrow]}><ChartPanel title="Doanh thu 7 ngày" icon="trending-up-outline" rows={data.chartRevenueByDay} currency /><ChartPanel title="Đơn hàng 7 ngày" icon="bar-chart-outline" rows={data.chartOrdersByDay} /></View>
    <RecentOrders orders={data.recentOrders ?? []} compact={compact} />
  </View>;
}

function ChartPanel({ title, icon, rows, currency = false }: { title: string; icon: 'trending-up-outline' | 'bar-chart-outline'; rows: Array<{ day: string; value: number }>; currency?: boolean }) {
  const max = useMemo(() => Math.max(0, ...rows.map(row => Number(row.value) || 0)), [rows]);
  return <View style={styles.panel}><View style={styles.panelHeading}><View style={styles.panelIcon}><Ionicons name={icon} size={18} color={colors.accent} /></View><View><Text style={styles.panelTitle}>{title}</Text><Text style={styles.panelSubtitle}>{currency ? 'Giá trị đơn không bị hủy' : 'Số đơn không bị hủy theo ngày'}</Text></View></View>{rows.length ? <View style={styles.chart}>{rows.map(row => <View key={row.day} style={styles.barColumn}><Text numberOfLines={1} style={styles.barValue}>{currency ? compactAdminMoney(row.value) : row.value}</Text><View style={styles.barTrack}><View style={[styles.bar, { height: adminBarHeight(row.value, max) }]} /></View><Text style={styles.barLabel}>{adminDayLabel(row.day)}</Text></View>)}</View> : <View style={styles.chartEmpty}><Ionicons name="analytics-outline" size={27} color={colors.subtle} /><Text style={styles.emptyText}>Chưa có dữ liệu trong 7 ngày gần đây.</Text></View>}</View>;
}

function RecentOrders({ orders, compact }: { orders: Order[]; compact: boolean }) {
  return <View style={styles.panel}><View style={styles.panelHeading}><View style={styles.panelIcon}><Ionicons name="receipt-outline" size={18} color={colors.accent} /></View><View><Text style={styles.panelTitle}>Đơn hàng gần đây</Text><Text style={styles.panelSubtitle}>Tối đa 8 đơn mới nhất từ hệ thống</Text></View></View>{orders.length ? <View style={styles.orderList}>{orders.map(order => <View key={order.id} style={[styles.orderRow, compact && styles.orderRowCompact]}><View style={styles.orderMain}><Text style={styles.orderId}>#{order.id}</Text><Text numberOfLines={1} style={styles.customer}>{order.fullName || order.email || 'Khách hàng'}</Text></View><Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text><Text style={styles.orderTotal}>{formatVnd(Number(order.totalAmount) || 0)}</Text><View style={[styles.status, statusColors[order.status]]}><Text style={[styles.statusText, { color: statusColors[order.status].color }]}>{statusLabels[order.status]}</Text></View></View>)}</View> : <View style={styles.chartEmpty}><Ionicons name="receipt-outline" size={27} color={colors.subtle} /><Text style={styles.emptyText}>Chưa có đơn hàng nào.</Text></View>}</View>;
}

function StatePanel({ loading, title, message, action, onPress }: { loading?: boolean; title: string; message: string; action?: string; onPress?: () => void }) {
  return <View style={styles.state}>{loading ? <ActivityIndicator size="large" color={colors.accent} /> : <Ionicons name="cloud-offline-outline" size={35} color={colors.accent} />}<Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{message}</Text>{action && onPress && <Pressable accessibilityRole="button" onPress={onPress} style={styles.retryButton}><Text style={styles.retryText}>{action}</Text></Pressable>}</View>;
}

function AdminGateState() {
  return <View style={styles.gate}><StatusBar style="light" /><View style={styles.gateMark}><Ionicons name="shield-checkmark-outline" size={30} color={colors.header} /></View><ActivityIndicator color={colors.accentBright} /><Text style={styles.gateText}>Đang xác minh quyền quản trị…</Text></View>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Không rõ' : date.toLocaleDateString('vi-VN');
}

const styles = StyleSheet.create(withTypography({
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 1440, alignSelf: 'center', padding: 24, paddingBottom: 42 },
  contentCompact: { padding: 14, paddingBottom: 28 },
  pageHeading: { marginBottom: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 34, lineHeight: 42, fontWeight: '800', letterSpacing: -1 },
  titleCompact: { fontSize: 27, lineHeight: 34 },
  subtitle: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 3 },
  refreshButton: { minHeight: 40, paddingHorizontal: 13, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.accent },
  refreshText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  disabled: { opacity: .58 },
  dashboard: { gap: 18 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: { minHeight: 128, padding: 16, borderRadius: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, boxShadow: '0 12px 32px rgba(28,43,52,.08)' },
  kpiWide: { width: '19%' },
  kpiNarrow: { width: '31.8%' },
  kpiCompact: { width: '47.8%' },
  kpiIcon: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF3F7' },
  kpiLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: .7, textTransform: 'uppercase', marginTop: 12 },
  kpiValue: { color: colors.ink, fontSize: 20, lineHeight: 27, fontWeight: '800', marginTop: 4 },
  chartGrid: { flexDirection: 'row', alignItems: 'stretch', gap: 18 },
  chartGridNarrow: { flexDirection: 'column' },
  panel: { flex: 1, minWidth: 0, padding: 18, borderRadius: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, boxShadow: '0 12px 32px rgba(28,43,52,.08)' },
  panelHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  panelIcon: { width: 35, height: 35, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF3F7' },
  panelTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  panelSubtitle: { color: colors.muted, fontSize: 9, marginTop: 2 },
  chart: { height: 165, flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  barColumn: { flex: 1, height: 165, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end' },
  barValue: { color: colors.muted, fontSize: 8, marginBottom: 4, maxWidth: '100%' },
  barTrack: { height: 116, width: '64%', minWidth: 12, maxWidth: 36, justifyContent: 'flex-end', borderRadius: 5, overflow: 'hidden', backgroundColor: colors.lineSoft },
  bar: { width: '100%', borderRadius: 5, backgroundColor: colors.accent },
  barLabel: { color: colors.subtle, fontSize: 8, marginTop: 6 },
  chartEmpty: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { color: colors.muted, fontSize: 10, textAlign: 'center' },
  orderList: { borderTopWidth: 1, borderTopColor: colors.line },
  orderRow: { minHeight: 62, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  orderRowCompact: { flexWrap: 'wrap', gap: 8 },
  orderMain: { flex: 1, minWidth: 180 },
  orderId: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  customer: { color: colors.ink, fontSize: 10, fontWeight: '700', marginTop: 3 },
  orderDate: { width: 88, color: colors.muted, fontSize: 9 },
  orderTotal: { width: 120, color: colors.ink, fontSize: 10, fontWeight: '800', textAlign: 'right' },
  status: { minWidth: 92, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, alignItems: 'center' },
  statusText: { fontSize: 8, fontWeight: '800' },
  state: { minHeight: 360, padding: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  stateTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  stateText: { color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'center', maxWidth: 480 },
  retryButton: { marginTop: 7, minHeight: 38, paddingHorizontal: 14, borderRadius: 8, justifyContent: 'center', backgroundColor: colors.accent },
  retryText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.header },
  gateMark: { width: 58, height: 58, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentBright },
  gateText: { color: colors.onDark, fontSize: 11, fontWeight: '700' },
}));
