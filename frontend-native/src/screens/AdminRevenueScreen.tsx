import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { compactAdminMoney } from '../adminDashboard.mjs';
import { normalizeRevenueRows, revenueBarPercent, revenueMonths, revenueShare, revenueTotals, revenueYears } from '../adminRevenue.mjs';
import { adminApi, formatVnd } from '../api';
import { AdminLayout } from '../components/admin/AdminLayout';
import { useStore } from '../store';
import { colors } from '../theme';
import { withTypography } from '../typography';
import type { RevenueRow } from '../types';

type ChartMode = 'trend' | 'share';
type MonthRow = RevenueRow & { month: number };

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const monthLabel = (month: number) => `Tháng ${String(month).padStart(2, '0')}`;

export default function AdminRevenueScreen() {
  const router = useRouter();
  const width = useWindowDimensions().width;
  const compact = width < 720;
  const medium = width < 1100;
  const { authReady, user, logout } = useStore();
  const [rows, setRows] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [chartMode, setChartMode] = useState<ChartMode>('trend');

  const load = useCallback(async () => {
    if (user?.role !== 'ADMIN') return;
    setLoading(true);
    setError('');
    try {
      const nextRows = normalizeRevenueRows(await adminApi.revenue()) as RevenueRow[];
      setRows(nextRows);
      const availableYears = nextRows.map(row => Number(row.period.slice(0, 4)));
      if (availableYears.length) setYear(Math.max(...availableYears));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Không thể tải dữ liệu doanh thu.');
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) router.replace({ pathname: '/login', params: { redirect: '/admin/revenue' } });
    else if (user.role !== 'ADMIN') router.replace('/');
  }, [authReady, router, user]);

  useEffect(() => { void load(); }, [load]);

  const years = useMemo(() => revenueYears(rows, currentYear) as number[], [rows]);
  const months = useMemo(() => revenueMonths(rows, year) as MonthRow[], [rows, year]);
  const totals = useMemo(() => revenueTotals(months) as { orders: number; revenue: number }, [months]);
  const selected = months[month - 1];
  const hasYearData = rows.some(row => row.period.startsWith(`${year}-`));

  if (!authReady || !user || user.role !== 'ADMIN') return <AdminGateState />;

  const signOut = () => { void logout().finally(() => router.replace('/login')); };
  return <AdminLayout user={user} onLogout={signOut}>
    <StatusBar style="light" />
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, compact && styles.contentCompact]}>
      <View style={[styles.pageHeading, compact && styles.pageHeadingCompact]}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>BÁO CÁO KINH DOANH</Text>
          <Text style={[styles.title, compact && styles.titleCompact]}>Doanh thu</Text>
          <Text style={styles.subtitle}>Theo dõi giá trị và số lượng đơn hàng không bị hủy theo từng tháng.</Text>
        </View>
        <Pressable accessibilityRole="button" disabled={loading} onPress={() => void load()} style={[styles.refreshButton, loading && styles.disabled]}>
          {loading ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="refresh" size={17} color={colors.white} />}
          <Text style={styles.refreshText}>Làm mới</Text>
        </Pressable>
      </View>

      <View style={styles.definitionNote}>
        <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
        <Text style={styles.definitionText}>Backend tính tổng giá trị đơn có trạng thái khác CANCELLED. Chỉ số này không đồng nghĩa với số tiền đã thanh toán.</Text>
      </View>

      {error.length > 0 && rows.length > 0 && <View style={styles.errorBanner}><Ionicons name="warning-outline" size={18} color={colors.danger} /><Text style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()}><Text style={styles.errorAction}>Thử lại</Text></Pressable></View>}

      {loading && rows.length === 0 ? <StatePanel loading title="Đang tải báo cáo" message="Hệ thống đang tổng hợp dữ liệu doanh thu theo tháng." />
        : error && rows.length === 0 ? <StatePanel title="Không thể tải báo cáo" message={error} action="Thử lại" onPress={() => void load()} />
          : rows.length === 0 ? <StatePanel empty title="Chưa có dữ liệu doanh thu" message="Backend chưa trả về kỳ thống kê nào." action="Làm mới" onPress={() => void load()} />
            : <View style={styles.report}>
              <RevenueFilters years={years} year={year} month={month} setYear={setYear} setMonth={setMonth} />
              <KpiCards selected={selected} totals={totals} year={year} compact={compact} medium={medium} />
              <RevenueChart months={months} selected={selected} totals={totals} month={month} setMonth={setMonth} mode={chartMode} setMode={setChartMode} compact={compact} hasYearData={hasYearData} />
              <RevenueTable months={months} annualRevenue={totals.revenue} month={month} setMonth={setMonth} compact={compact} year={year} />
            </View>}
    </ScrollView>
  </AdminLayout>;
}

function RevenueFilters({ years, year, month, setYear, setMonth }: { years: number[]; year: number; month: number; setYear: (value: number) => void; setMonth: (value: number) => void }) {
  return <View style={styles.filters}>
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>Năm báo cáo</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {years.map(item => <FilterChip key={item} label={String(item)} active={item === year} onPress={() => setYear(item)} />)}
      </ScrollView>
    </View>
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>Tháng đang xem</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {Array.from({ length: 12 }, (_, index) => index + 1).map(item => <FilterChip key={item} label={String(item).padStart(2, '0')} active={item === month} onPress={() => setMonth(item)} />)}
      </ScrollView>
    </View>
  </View>;
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function KpiCards({ selected, totals, year, compact, medium }: { selected: MonthRow; totals: { orders: number; revenue: number }; year: number; compact: boolean; medium: boolean }) {
  const cards = [
    { icon: 'cash-outline' as const, label: `Giá trị ${monthLabel(selected.month).toLowerCase()}`, value: formatVnd(selected.revenue), note: String(year), primary: true },
    { icon: 'receipt-outline' as const, label: 'Đơn không bị hủy trong tháng', value: selected.orders.toLocaleString('vi-VN'), note: `${monthLabel(selected.month)} · ${year}` },
    { icon: 'analytics-outline' as const, label: 'Giá trị đơn cả năm', value: formatVnd(totals.revenue), note: `${totals.orders.toLocaleString('vi-VN')} đơn không bị hủy` },
  ];
  return <View style={styles.kpiGrid}>{cards.map(card => <View key={card.label} style={[styles.kpiCard, compact ? styles.kpiCompact : medium ? styles.kpiMedium : styles.kpiWide, card.primary && styles.kpiPrimary]}><View style={[styles.kpiIcon, card.primary && styles.kpiIconPrimary]}><Ionicons name={card.icon} size={21} color={card.primary ? colors.white : colors.accent} /></View><Text style={[styles.kpiLabel, card.primary && styles.kpiOnPrimary]}>{card.label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.kpiValue, card.primary && styles.kpiOnPrimary]}>{card.value}</Text><Text style={[styles.kpiNote, card.primary && styles.kpiNotePrimary]}>{card.note}</Text></View>)}</View>;
}

function RevenueChart({ months, selected, totals, month, setMonth, mode, setMode, compact, hasYearData }: { months: MonthRow[]; selected: MonthRow; totals: { orders: number; revenue: number }; month: number; setMonth: (value: number) => void; mode: ChartMode; setMode: (value: ChartMode) => void; compact: boolean; hasYearData: boolean }) {
  const max = Math.max(0, ...months.map(row => row.revenue));
  const share = revenueShare(selected.revenue, totals.revenue) as number;
  return <View style={styles.panel}>
    <View style={[styles.panelHeading, compact && styles.panelHeadingCompact]}>
      <View><Text style={styles.panelTitle}>Biểu đồ doanh thu</Text><Text style={styles.panelSubtitle}>{monthLabel(month)} đang được chọn · đơn vị VND</Text></View>
      <View style={styles.modeSwitch}>
        <ModeButton label="Theo tháng" icon="bar-chart-outline" active={mode === 'trend'} onPress={() => setMode('trend')} />
        <ModeButton label="Tỷ trọng" icon="pie-chart-outline" active={mode === 'share'} onPress={() => setMode('share')} />
      </View>
    </View>
    {!hasYearData ? <ChartEmpty /> : mode === 'trend' ? compact
      ? <View style={styles.mobileChart}>{months.map(row => <Pressable key={row.period} accessibilityRole="button" accessibilityLabel={`${monthLabel(row.month)}: ${formatVnd(row.revenue)}`} onPress={() => setMonth(row.month)} style={[styles.mobileBarRow, row.month === month && styles.selectedRow]}><Text style={[styles.mobileMonth, row.month === month && styles.selectedText]}>{String(row.month).padStart(2, '0')}</Text><View style={styles.mobileBarTrack}><View style={[styles.mobileBar, row.month === month && styles.selectedBar, { width: revenueBarPercent(row.revenue, max) }]} /></View><Text numberOfLines={1} style={styles.mobileBarValue}>{compactAdminMoney(row.revenue)}</Text></Pressable>)}</View>
      : <View style={styles.chart}>{months.map(row => <Pressable key={row.period} accessibilityRole="button" accessibilityLabel={`${monthLabel(row.month)}: ${formatVnd(row.revenue)}`} onPress={() => setMonth(row.month)} style={styles.barColumn}><Text numberOfLines={1} style={styles.barValue}>{compactAdminMoney(row.revenue)}</Text><View style={styles.barTrack}><View style={[styles.bar, row.month === month && styles.selectedBar, { height: revenueBarPercent(row.revenue, max) }]} /></View><Text style={[styles.barLabel, row.month === month && styles.selectedText]}>{String(row.month).padStart(2, '0')}</Text></Pressable>)}</View>
      : <View style={[styles.shareLayout, compact && styles.shareLayoutCompact]}><View style={styles.shareFigure}><Text style={styles.sharePercent}>{share.toLocaleString('vi-VN', { style: 'percent', maximumFractionDigits: 1 })}</Text><Text style={styles.shareCaption}>doanh thu năm</Text><View style={styles.shareTrack}><View style={[styles.shareFill, { width: `${Math.round(share * 100)}%` }]} /></View></View><View style={styles.shareLegend}><Text style={styles.shareTitle}>Tỷ trọng {monthLabel(month).toLowerCase()}</Text><Text style={styles.shareDescription}>So sánh giá trị tháng đang chọn với các tháng còn lại trong năm.</Text><LegendRow color={colors.accent} label={monthLabel(month)} value={formatVnd(selected.revenue)} /><LegendRow color="#BBD9E3" label="Các tháng còn lại" value={formatVnd(Math.max(0, totals.revenue - selected.revenue))} /></View></View>}
  </View>;
}

function ModeButton({ label, icon, active, onPress }: { label: string; icon: 'bar-chart-outline' | 'pie-chart-outline'; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}><Ionicons name={icon} size={15} color={active ? colors.white : colors.muted} /><Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text></Pressable>;
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendLabel}>{label}</Text><Text style={styles.legendValue}>{value}</Text></View>;
}

function ChartEmpty() {
  return <View style={styles.chartEmpty}><Ionicons name="analytics-outline" size={30} color={colors.subtle} /><Text style={styles.emptyTitle}>Chưa có dữ liệu trong năm này</Text><Text style={styles.emptyText}>Chọn năm khác hoặc làm mới khi có đơn hàng mới.</Text></View>;
}

function RevenueTable({ months, annualRevenue, month, setMonth, compact, year }: { months: MonthRow[]; annualRevenue: number; month: number; setMonth: (value: number) => void; compact: boolean; year: number }) {
  return <View style={styles.panel}>
    <View style={styles.panelHeading}><View><Text style={styles.panelTitle}>Chi tiết theo tháng</Text><Text style={styles.panelSubtitle}>12 tháng trong năm {year}</Text></View></View>
    {compact ? <View style={styles.monthCards}>{months.map(row => <Pressable key={row.period} accessibilityRole="button" onPress={() => setMonth(row.month)} style={[styles.monthCard, row.month === month && styles.monthCardSelected]}><View style={styles.monthCardTop}><Text style={[styles.monthCardTitle, row.month === month && styles.selectedText]}>{monthLabel(row.month)}</Text>{row.month === month && <Text style={styles.viewingBadge}>ĐANG XEM</Text>}</View><View style={styles.monthMetrics}><Metric label="Số đơn" value={row.orders.toLocaleString('vi-VN')} /><Metric label="Giá trị" value={formatVnd(row.revenue)} /><Metric label="Tỷ trọng" value={annualRevenue ? (row.revenue / annualRevenue).toLocaleString('vi-VN', { style: 'percent', maximumFractionDigits: 1 }) : '0%'} /></View></Pressable>)}</View>
      : <View style={styles.table}><View style={[styles.tableRow, styles.tableHeader]}><Text style={[styles.tableCell, styles.periodCell, styles.headerText]}>THÁNG</Text><Text style={[styles.tableCell, styles.ordersCell, styles.headerText]}>SỐ ĐƠN</Text><Text style={[styles.tableCell, styles.amountCell, styles.headerText]}>GIÁ TRỊ ĐƠN</Text><Text style={[styles.tableCell, styles.shareCell, styles.headerText]}>TỶ TRỌNG NĂM</Text></View>{months.map(row => <Pressable key={row.period} accessibilityRole="button" onPress={() => setMonth(row.month)} style={[styles.tableRow, row.month === month && styles.selectedRow]}><View style={[styles.tableCell, styles.periodCell]}><Text style={[styles.cellStrong, row.month === month && styles.selectedText]}>{monthLabel(row.month)}</Text>{row.month === month && <Text style={styles.viewingText}>Đang xem</Text>}</View><Text style={[styles.tableCell, styles.ordersCell, styles.cellText]}>{row.orders.toLocaleString('vi-VN')}</Text><Text style={[styles.tableCell, styles.amountCell, styles.cellStrong]}>{formatVnd(row.revenue)}</Text><Text style={[styles.tableCell, styles.shareCell, styles.cellText]}>{annualRevenue ? (row.revenue / annualRevenue).toLocaleString('vi-VN', { style: 'percent', maximumFractionDigits: 1 }) : '0%'}</Text></Pressable>)}</View>}
  </View>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>{value}</Text></View>;
}

function StatePanel({ loading, empty, title, message, action, onPress }: { loading?: boolean; empty?: boolean; title: string; message: string; action?: string; onPress?: () => void }) {
  return <View style={styles.state}>{loading ? <ActivityIndicator size="large" color={colors.accent} /> : <Ionicons name={empty ? 'analytics-outline' : 'cloud-offline-outline'} size={36} color={colors.accent} />}<Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{message}</Text>{action && onPress && <Pressable accessibilityRole="button" onPress={onPress} style={styles.retryButton}><Text style={styles.retryText}>{action}</Text></Pressable>}</View>;
}

function AdminGateState() {
  return <View style={styles.gate}><StatusBar style="light" /><View style={styles.gateMark}><Ionicons name="shield-checkmark-outline" size={30} color={colors.header} /></View><ActivityIndicator color={colors.accentBright} /><Text style={styles.gateText}>Đang xác minh quyền quản trị…</Text></View>;
}

const styles = StyleSheet.create(withTypography({
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 1440, alignSelf: 'center', padding: 24, paddingBottom: 42 },
  contentCompact: { padding: 14, paddingBottom: 28 },
  pageHeading: { marginBottom: 15, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 },
  pageHeadingCompact: { alignItems: 'stretch', flexDirection: 'column' },
  headingCopy: { flex: 1 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 34, lineHeight: 42, fontWeight: '800', letterSpacing: -1 },
  titleCompact: { fontSize: 27, lineHeight: 34 },
  subtitle: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 3 },
  refreshButton: { minHeight: 40, paddingHorizontal: 13, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.accent },
  refreshText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  disabled: { opacity: .58 },
  definitionNote: { marginBottom: 15, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#BFE0EA', backgroundColor: '#EAF6F9', flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  definitionText: { flex: 1, color: '#315A68', fontSize: 10, lineHeight: 17 },
  errorBanner: { marginBottom: 14, padding: 11, borderRadius: 8, borderWidth: 1, borderColor: '#F0BEBE', backgroundColor: '#FFF4F4', flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, color: colors.danger, fontSize: 10 },
  errorAction: { color: colors.danger, fontSize: 10, fontWeight: '800' },
  report: { gap: 16 },
  filters: { padding: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 12 },
  filterGroup: { gap: 7 },
  filterLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: .6, textTransform: 'uppercase' },
  chips: { gap: 6 },
  chip: { minWidth: 40, minHeight: 34, paddingHorizontal: 11, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  chipText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: { minHeight: 142, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, boxShadow: '0 12px 32px rgba(28,43,52,.08)' },
  kpiPrimary: { borderColor: colors.accent, backgroundColor: colors.accent },
  kpiWide: { width: '32.4%' },
  kpiMedium: { width: '48.8%' },
  kpiCompact: { width: '100%' },
  kpiIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF3F7' },
  kpiIconPrimary: { backgroundColor: 'rgba(255,255,255,.18)' },
  kpiLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: .5, textTransform: 'uppercase', marginTop: 11 },
  kpiValue: { color: colors.ink, fontSize: 22, lineHeight: 29, fontWeight: '800', marginTop: 3 },
  kpiNote: { color: colors.subtle, fontSize: 9, marginTop: 3 },
  kpiOnPrimary: { color: colors.white },
  kpiNotePrimary: { color: 'rgba(255,255,255,.75)' },
  panel: { minWidth: 0, padding: 18, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, boxShadow: '0 12px 32px rgba(28,43,52,.08)' },
  panelHeading: { marginBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  panelHeadingCompact: { alignItems: 'stretch', flexDirection: 'column' },
  panelTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  panelSubtitle: { color: colors.muted, fontSize: 9, marginTop: 3 },
  modeSwitch: { padding: 4, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg, flexDirection: 'row', gap: 4 },
  modeButton: { minHeight: 34, paddingHorizontal: 10, borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  modeButtonActive: { backgroundColor: colors.accent },
  modeText: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  modeTextActive: { color: colors.white },
  chart: { height: 246, flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  barColumn: { flex: 1, height: 240, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end' },
  barValue: { width: '100%', color: colors.muted, fontSize: 8, textAlign: 'center', marginBottom: 5 },
  barTrack: { height: 176, width: '58%', minWidth: 14, maxWidth: 48, justifyContent: 'flex-end', borderRadius: 6, overflow: 'hidden', backgroundColor: colors.lineSoft },
  bar: { width: '100%', borderRadius: 6, backgroundColor: '#BBD9E3' },
  selectedBar: { backgroundColor: colors.accent },
  barLabel: { color: colors.subtle, fontSize: 9, marginTop: 7 },
  selectedText: { color: colors.accent, fontWeight: '800' },
  mobileChart: { gap: 5 },
  mobileBarRow: { minHeight: 34, paddingHorizontal: 6, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  mobileMonth: { width: 22, color: colors.muted, fontSize: 9, fontWeight: '700' },
  mobileBarTrack: { flex: 1, height: 13, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.lineSoft },
  mobileBar: { height: '100%', borderRadius: 5, backgroundColor: '#BBD9E3' },
  mobileBarValue: { width: 54, color: colors.muted, fontSize: 8, textAlign: 'right' },
  selectedRow: { backgroundColor: '#EDF7FA' },
  shareLayout: { minHeight: 250, maxWidth: 850, width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 34 },
  shareLayoutCompact: { minHeight: 0, flexDirection: 'column', alignItems: 'stretch', gap: 22 },
  shareFigure: { flex: 1, minWidth: 220, padding: 24, borderRadius: 8, alignItems: 'center', backgroundColor: colors.bg },
  sharePercent: { color: colors.accent, fontSize: 42, lineHeight: 52, fontWeight: '800' },
  shareCaption: { color: colors.muted, fontSize: 10, marginTop: 2 },
  shareTrack: { width: '100%', height: 12, marginTop: 20, borderRadius: 6, overflow: 'hidden', backgroundColor: '#BBD9E3' },
  shareFill: { height: '100%', borderRadius: 6, backgroundColor: colors.accent },
  shareLegend: { flex: 1.2, minWidth: 0 },
  shareTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  shareDescription: { color: colors.muted, fontSize: 10, lineHeight: 17, marginTop: 5, marginBottom: 15 },
  legendRow: { minHeight: 44, borderTopWidth: 1, borderTopColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { flex: 1, color: colors.muted, fontSize: 10 },
  legendValue: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  chartEmpty: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 7 },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: colors.muted, fontSize: 10, lineHeight: 17, textAlign: 'center' },
  table: { borderWidth: 1, borderColor: colors.lineSoft, borderRadius: 8, overflow: 'hidden' },
  tableRow: { minHeight: 52, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center' },
  tableHeader: { minHeight: 42, backgroundColor: colors.bg },
  tableCell: { paddingHorizontal: 7 },
  periodCell: { width: '28%' },
  ordersCell: { width: '18%', textAlign: 'right' },
  amountCell: { width: '31%', textAlign: 'right' },
  shareCell: { width: '23%', textAlign: 'right' },
  headerText: { color: colors.subtle, fontSize: 8, fontWeight: '800', letterSpacing: .5 },
  cellText: { color: colors.muted, fontSize: 10 },
  cellStrong: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  viewingText: { color: colors.accent, fontSize: 7, fontWeight: '800', marginTop: 2 },
  monthCards: { gap: 8 },
  monthCard: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  monthCardSelected: { borderColor: '#9DCDDC', backgroundColor: '#EDF7FA' },
  monthCardTop: { marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  monthCardTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  viewingBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999, color: colors.accent, backgroundColor: '#D8EEF4', fontSize: 7, fontWeight: '800' },
  monthMetrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minWidth: 0 },
  metricLabel: { color: colors.subtle, fontSize: 8 },
  metricValue: { color: colors.ink, fontSize: 10, fontWeight: '800', marginTop: 3 },
  state: { minHeight: 360, padding: 30, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.white },
  stateTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  stateText: { maxWidth: 480, color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  retryButton: { minHeight: 38, marginTop: 7, paddingHorizontal: 14, borderRadius: 8, justifyContent: 'center', backgroundColor: colors.accent },
  retryText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.header },
  gateMark: { width: 58, height: 58, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentBright },
  gateText: { color: colors.onDark, fontSize: 11, fontWeight: '700' },
}));
