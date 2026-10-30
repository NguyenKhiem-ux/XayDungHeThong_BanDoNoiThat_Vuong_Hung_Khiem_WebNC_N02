import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { adminUserInitials, adminUserPageCount, filterAdminUsers } from '../adminUsers.mjs';
import { adminApi } from '../api';
import { AdminLayout } from '../components/admin/AdminLayout';
import { useStore } from '../store';
import { colors } from '../theme';
import { withTypography } from '../typography';
import type { AdminUser } from '../types';

const PAGE_SIZE = 15;
type RoleFilter = '' | AdminUser['role'];

export default function AdminUsersScreen() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 760;
  const { authReady, user, logout } = useStore();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [role, setRole] = useState<RoleFilter>('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const isAdmin = authReady && user?.role === 'ADMIN';

  const load = useCallback(async (signal?: AbortSignal) => {
    if (user?.role !== 'ADMIN') return;
    setLoading(true);
    setError('');
    try {
      setUsers(await adminApi.users(signal));
    } catch (failure) {
      if ((failure as Error).name !== 'AbortError') setError(failure instanceof Error ? failure.message : 'Không thể tải danh sách người dùng.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) router.replace({ pathname: '/login', params: { redirect: '/admin/users' } });
    else if (user.role !== 'ADMIN') router.replace('/');
  }, [authReady, router, user]);

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [isAdmin, load]);

  const filteredUsers = useMemo<AdminUser[]>(() => filterAdminUsers(users, { keyword, role }), [keyword, role, users]);
  const pageCount = adminUserPageCount(filteredUsers.length, PAGE_SIZE);
  const visibleUsers = useMemo(() => filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredUsers, page]);
  const selectedUser = selectedId === null ? null : users.find(item => item.id === selectedId) ?? null;
  const adminCount = useMemo(() => users.filter(item => item.role === 'ADMIN').length, [users]);

  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  if (!isAdmin || !user) return <AdminGateState />;

  const signOut = () => { void logout().finally(() => router.replace('/login')); };
  const resetFilters = () => { setKeyword(''); setRole(''); setPage(1); };

  return <AdminLayout user={user} onLogout={signOut}>
    <StatusBar style="light" />
    <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={[styles.content, compact && styles.contentCompact]}>
      <View style={[styles.pageHeading, compact && styles.pageHeadingCompact]}><View style={styles.headingCopy}><Text style={styles.eyebrow}>USER DIRECTORY</Text><Text style={[styles.title, compact && styles.titleCompact]}>Quản lý người dùng</Text><Text style={styles.subtitle}>Danh sách tài khoản được cung cấp trực tiếp bởi Backend quản trị.</Text></View><Pressable accessibilityRole="button" disabled={loading} onPress={() => void load()} style={[styles.refreshButton, loading && styles.disabled]}>{loading ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="refresh" size={17} color={colors.white} />}<Text style={styles.refreshText}>Làm mới</Text></Pressable></View>

      <View style={styles.summaryRow}><SummaryCard icon="people-outline" label="Tổng tài khoản" value={users.length} /><SummaryCard icon="person-outline" label="Khách hàng" value={Math.max(0, users.length - adminCount)} /><SummaryCard icon="shield-checkmark-outline" label="Quản trị viên" value={adminCount} /></View>

      <View style={styles.filterPanel}><View style={[styles.searchRow, compact && styles.searchRowCompact]}><View style={styles.searchBox}><Ionicons name="search" size={18} color={colors.subtle} /><TextInput accessibilityLabel="Tìm người dùng" value={keyword} onChangeText={value => { setKeyword(value); setPage(1); }} placeholder="Tên, username, email hoặc số điện thoại..." placeholderTextColor={colors.subtle} style={styles.searchInput} /></View><Pressable accessibilityRole="button" onPress={resetFilters} style={styles.resetButton}><Ionicons name="refresh-outline" size={17} color={colors.ink} /><Text style={styles.resetText}>Xóa bộ lọc</Text></Pressable></View><Text style={styles.filterLabel}>Vai trò</Text><View style={styles.chipRow}><FilterChip label="Tất cả" active={!role} onPress={() => { setRole(''); setPage(1); }} /><FilterChip label="Khách hàng" active={role === 'USER'} onPress={() => { setRole('USER'); setPage(1); }} /><FilterChip label="Quản trị viên" active={role === 'ADMIN'} onPress={() => { setRole('ADMIN'); setPage(1); }} /></View></View>

      {selectedUser ? <UserDetailPanel user={selectedUser} compact={compact} onClose={() => setSelectedId(null)} /> : null}

      <View style={styles.listPanel}><View style={styles.listHeading}><View><Text style={styles.panelEyebrow}>ACCOUNTS</Text><Text style={styles.panelTitle}>{filteredUsers.length} người dùng</Text></View><Text style={styles.resultMeta}>{users.length === filteredUsers.length ? 'Toàn bộ dữ liệu' : `${users.length} tài khoản trong hệ thống`}</Text></View>{loading ? <StatePanel loading title="Đang tải người dùng" message="Hệ thống đang lấy danh sách tài khoản." /> : error ? <StatePanel icon="cloud-offline-outline" title="Không thể tải người dùng" message={error} action="Thử lại" onPress={() => void load()} /> : !visibleUsers.length ? <StatePanel icon="people-outline" title="Không có người dùng" message={users.length ? 'Không có tài khoản phù hợp với bộ lọc.' : 'Chưa có tài khoản nào trong hệ thống.'} /> : compact ? <View style={styles.cardList}>{visibleUsers.map(item => <UserCard key={item.id} user={item} onDetail={() => setSelectedId(item.id)} />)}</View> : <UserTable users={visibleUsers} onDetail={item => setSelectedId(item.id)} />}{!loading && !error && filteredUsers.length > 0 ? <View style={[styles.pagination, compact && styles.paginationCompact]}><Text style={styles.pageMeta}>Trang {page}/{pageCount} · {filteredUsers.length} kết quả</Text><View style={styles.pageActions}><Pressable accessibilityRole="button" disabled={page <= 1} onPress={() => setPage(value => Math.max(1, value - 1))} style={[styles.pageButton, page <= 1 && styles.disabled]}><Ionicons name="chevron-back" size={17} color={colors.ink} /><Text style={styles.pageButtonText}>Trước</Text></Pressable><Pressable accessibilityRole="button" disabled={page >= pageCount} onPress={() => setPage(value => Math.min(pageCount, value + 1))} style={[styles.pageButton, page >= pageCount && styles.disabled]}><Text style={styles.pageButtonText}>Sau</Text><Ionicons name="chevron-forward" size={17} color={colors.ink} /></Pressable></View></View> : null}</View>
    </ScrollView>
  </AdminLayout>;
}

function SummaryCard({ icon, label, value }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; value: number }) {
  return <View style={styles.summaryCard}><View style={styles.summaryIcon}><Ionicons name={icon} size={20} color={colors.accent} /></View><View><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View></View>;
}

function UserDetailPanel({ user, compact, onClose }: { user: AdminUser; compact: boolean; onClose: () => void }) {
  return <View style={styles.detailPanel}><View style={[styles.detailHeading, compact && styles.detailHeadingCompact]}><UserAvatar user={user} large /><View style={styles.detailHeadingCopy}><Text style={styles.panelEyebrow}>USER #{user.id}</Text><Text style={styles.detailName}>{user.fullName}</Text><Text style={styles.detailUsername}>{user.username ? `@${user.username}` : 'Chưa có username'}</Text></View><RoleBadge role={user.role} /><Pressable accessibilityRole="button" accessibilityLabel="Đóng chi tiết" onPress={onClose} style={styles.closeButton}><Ionicons name="close" size={20} color={colors.ink} /></Pressable></View><View style={styles.detailGrid}><DetailItem icon="mail-outline" label="Email" value={user.email} /><DetailItem icon="call-outline" label="Số điện thoại" value={user.phone || 'Chưa cập nhật'} /><DetailItem icon="calendar-outline" label="Ngày tạo tài khoản" value={formatDateTime(user.createdAt)} /><DetailItem icon="shield-checkmark-outline" label="Vai trò" value={user.role === 'ADMIN' ? 'Quản trị viên' : 'Khách hàng'} /></View><View style={styles.readOnlyNote}><Ionicons name="information-circle-outline" size={18} color={colors.accent} /><Text style={styles.readOnlyText}>Backend hiện chỉ hỗ trợ xem danh sách. Không có thao tác đổi quyền, khóa hoặc xóa tài khoản.</Text></View></View>;
}

function DetailItem({ icon, label, value }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return <View style={styles.detailItem}><View style={styles.detailIcon}><Ionicons name={icon} size={17} color={colors.accent} /></View><View style={styles.detailItemCopy}><Text style={styles.detailLabel}>{label}</Text><Text selectable style={styles.detailValue}>{value}</Text></View></View>;
}

function UserTable({ users, onDetail }: { users: AdminUser[]; onDetail: (user: AdminUser) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScroll}><View style={styles.table}><View style={[styles.tableRow, styles.tableHead]}><Text style={[styles.tableHeadText, styles.idColumn]}>ID</Text><Text style={[styles.tableHeadText, styles.nameColumn]}>Người dùng</Text><Text style={[styles.tableHeadText, styles.usernameColumn]}>Username</Text><Text style={[styles.tableHeadText, styles.emailColumn]}>Email</Text><Text style={[styles.tableHeadText, styles.phoneColumn]}>Điện thoại</Text><Text style={[styles.tableHeadText, styles.roleColumn]}>Vai trò</Text><Text style={[styles.tableHeadText, styles.dateColumn]}>Ngày tạo</Text><Text style={[styles.tableHeadText, styles.actionColumn]}>Thao tác</Text></View>{users.map(user => <View key={user.id} style={styles.tableRow}><Text style={[styles.idText, styles.idColumn]}>#{user.id}</Text><View style={[styles.nameColumn, styles.userCell]}><UserAvatar user={user} /><View style={styles.userCellCopy}><Text numberOfLines={1} style={styles.userName}>{user.fullName}</Text><Text numberOfLines={1} style={styles.userMeta}>{user.email}</Text></View></View><Text numberOfLines={1} style={[styles.cellText, styles.usernameColumn]}>{user.username || '—'}</Text><Text numberOfLines={1} style={[styles.cellText, styles.emailColumn]}>{user.email}</Text><Text numberOfLines={1} style={[styles.cellText, styles.phoneColumn]}>{user.phone || '—'}</Text><View style={styles.roleColumn}><RoleBadge role={user.role} /></View><Text numberOfLines={2} style={[styles.cellText, styles.dateColumn]}>{formatDateTime(user.createdAt)}</Text><View style={styles.actionColumn}><Pressable accessibilityRole="button" onPress={() => onDetail(user)} style={styles.detailButton}><Ionicons name="eye-outline" size={16} color={colors.accent} /><Text style={styles.detailButtonText}>Chi tiết</Text></Pressable></View></View>)}</View></ScrollView>;
}

function UserCard({ user, onDetail }: { user: AdminUser; onDetail: () => void }) {
  return <View style={styles.userCard}><View style={styles.cardTop}><UserAvatar user={user} large /><View style={styles.cardCopy}><Text style={styles.cardId}>#{user.id}</Text><Text numberOfLines={1} style={styles.cardName}>{user.fullName}</Text><Text numberOfLines={1} style={styles.cardUsername}>{user.username ? `@${user.username}` : 'Chưa có username'}</Text></View><RoleBadge role={user.role} /></View><View style={styles.cardInfo}><View style={styles.cardInfoLine}><Ionicons name="mail-outline" size={15} color={colors.muted} /><Text numberOfLines={1} style={styles.cardInfoText}>{user.email}</Text></View><View style={styles.cardInfoLine}><Ionicons name="call-outline" size={15} color={colors.muted} /><Text style={styles.cardInfoText}>{user.phone || 'Chưa cập nhật'}</Text></View><View style={styles.cardInfoLine}><Ionicons name="calendar-outline" size={15} color={colors.muted} /><Text style={styles.cardInfoText}>{formatDateTime(user.createdAt)}</Text></View></View><Pressable accessibilityRole="button" onPress={onDetail} style={styles.mobileDetailButton}><Ionicons name="eye-outline" size={17} color={colors.accent} /><Text style={styles.detailButtonText}>Xem chi tiết</Text></Pressable></View>;
}

function UserAvatar({ user, large = false }: { user: AdminUser; large?: boolean }) {
  return <View style={[styles.avatar, large && styles.avatarLarge]}><Text style={[styles.avatarText, large && styles.avatarTextLarge]}>{adminUserInitials(user.fullName, user.username, user.email)}</Text></View>;
}

function RoleBadge({ role }: { role: AdminUser['role'] }) {
  return <View style={[styles.roleBadge, role === 'ADMIN' && styles.adminBadge]}><Ionicons name={role === 'ADMIN' ? 'shield-checkmark-outline' : 'person-outline'} size={13} color={role === 'ADMIN' ? colors.accent : colors.muted} /><Text style={[styles.roleText, role === 'ADMIN' && styles.adminRoleText]}>{role === 'ADMIN' ? 'ADMIN' : 'USER'}</Text></View>;
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function StatePanel({ loading = false, icon = 'people-outline', title, message, action, onPress }: { loading?: boolean; icon?: ComponentProps<typeof Ionicons>['name']; title: string; message: string; action?: string; onPress?: () => void }) {
  return <View style={styles.statePanel}>{loading ? <ActivityIndicator size="large" color={colors.accent} /> : <Ionicons name={icon} size={32} color={colors.subtle} />}<Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{message}</Text>{action && onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={styles.retryButton}><Text style={styles.retryButtonText}>{action}</Text></Pressable> : null}</View>;
}

function AdminGateState() {
  return <View style={styles.gate}><ActivityIndicator size="large" color={colors.accent} /><Text style={styles.gateText}>Đang xác minh quyền quản trị...</Text></View>;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Không rõ' : date.toLocaleString('vi-VN');
}

const styles = StyleSheet.create(withTypography({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 28, gap: 18, maxWidth: 1680, width: '100%', alignSelf: 'center' },
  contentCompact: { padding: 14, gap: 14 },
  pageHeading: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  pageHeadingCompact: { alignItems: 'stretch', flexDirection: 'column' },
  headingCopy: { flex: 1 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: 5 },
  titleCompact: { fontSize: 24 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 5 },
  refreshButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  refreshText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { minWidth: 180, flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 11 },
  summaryIcon: { width: 42, height: 42, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E1F4FA' },
  summaryLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  summaryValue: { color: colors.ink, fontSize: 19, fontWeight: '800', marginTop: 2 },
  filterPanel: { padding: 17, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchRowCompact: { alignItems: 'stretch', flexDirection: 'column' },
  searchBox: { flex: 1, minHeight: 44, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, minWidth: 0, paddingHorizontal: 9, color: colors.ink, fontSize: 12 },
  resetButton: { minHeight: 44, paddingHorizontal: 13, borderRadius: 8, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  resetText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  filterLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  chipActive: { borderColor: colors.accent, backgroundColor: '#E1F4FA' },
  chipText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  chipTextActive: { color: colors.accent },
  detailPanel: { padding: 18, borderRadius: 12, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: colors.white, gap: 15 },
  detailHeading: { paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center', gap: 11 },
  detailHeadingCompact: { alignItems: 'flex-start', flexWrap: 'wrap' },
  detailHeadingCopy: { flex: 1, minWidth: 0 },
  panelEyebrow: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  detailName: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 2 },
  detailUsername: { color: colors.muted, fontSize: 10, marginTop: 3 },
  closeButton: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailItem: { minWidth: 230, flex: 1, padding: 11, borderRadius: 8, backgroundColor: colors.bg, flexDirection: 'row', alignItems: 'center', gap: 9 },
  detailIcon: { width: 34, height: 34, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  detailItemCopy: { flex: 1, minWidth: 0 },
  detailLabel: { color: colors.muted, fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },
  detailValue: { color: colors.ink, fontSize: 10, fontWeight: '800', marginTop: 3 },
  readOnlyNote: { padding: 11, borderRadius: 8, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: '#F1FAFC', flexDirection: 'row', alignItems: 'center', gap: 7 },
  readOnlyText: { flex: 1, color: colors.accent, fontSize: 10, lineHeight: 16 },
  listPanel: { padding: 18, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 12 },
  listHeading: { flexDirection: 'row', alignItems: 'center' },
  panelTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 2 },
  resultMeta: { marginLeft: 'auto', color: colors.muted, fontSize: 10 },
  statePanel: { minHeight: 260, padding: 25, alignItems: 'center', justifyContent: 'center', gap: 9 },
  stateTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  stateText: { maxWidth: 440, color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  retryButton: { minHeight: 38, marginTop: 3, paddingHorizontal: 13, borderRadius: 7, borderWidth: 1, borderColor: colors.accent, justifyContent: 'center' },
  retryButtonText: { color: colors.accent, fontSize: 10, fontWeight: '800' },
  tableScroll: { minWidth: 1180 },
  table: { minWidth: 1180, flex: 1 },
  tableRow: { minHeight: 76, paddingHorizontal: 9, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center' },
  tableHead: { minHeight: 46, borderRadius: 7, borderBottomWidth: 0, backgroundColor: colors.bg },
  tableHeadText: { paddingHorizontal: 7, color: colors.muted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  idColumn: { width: 65, paddingHorizontal: 7 },
  nameColumn: { width: 220, paddingHorizontal: 7 },
  usernameColumn: { width: 130, paddingHorizontal: 7 },
  emailColumn: { width: 210, paddingHorizontal: 7 },
  phoneColumn: { width: 130, paddingHorizontal: 7 },
  roleColumn: { width: 125, paddingHorizontal: 7 },
  dateColumn: { width: 155, paddingHorizontal: 7 },
  actionColumn: { width: 120, paddingHorizontal: 7 },
  idText: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  userCell: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  userCellCopy: { flex: 1, minWidth: 0 },
  userName: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  userMeta: { color: colors.muted, fontSize: 9, marginTop: 3 },
  cellText: { color: colors.ink, fontSize: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.headerRaised, alignItems: 'center', justifyContent: 'center' },
  avatarLarge: { width: 52, height: 52, borderRadius: 26 },
  avatarText: { color: colors.accentBright, fontSize: 10, fontWeight: '800' },
  avatarTextLarge: { fontSize: 13 },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: colors.bg, flexDirection: 'row', alignItems: 'center', gap: 4 },
  adminBadge: { backgroundColor: '#E1F4FA' },
  roleText: { color: colors.muted, fontSize: 8, fontWeight: '800' },
  adminRoleText: { color: colors.accent },
  detailButton: { minHeight: 34, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: '#F1FAFC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  detailButtonText: { color: colors.accent, fontSize: 9, fontWeight: '800' },
  cardList: { gap: 10 },
  userCard: { padding: 13, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 11 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardCopy: { flex: 1, minWidth: 0 },
  cardId: { color: colors.accent, fontSize: 9, fontWeight: '800' },
  cardName: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 3 },
  cardUsername: { color: colors.muted, fontSize: 9, marginTop: 3 },
  cardInfo: { padding: 10, borderRadius: 7, backgroundColor: colors.bg, gap: 7 },
  cardInfoLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cardInfoText: { flex: 1, color: colors.ink, fontSize: 10 },
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
