import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { adminMessagePreview, adminMessagesPageCount, filterAdminMessages } from '../adminMessages.mjs';
import { confirmAction, contactApi } from '../api';
import { AdminLayout } from '../components/admin/AdminLayout';
import { useStore } from '../store';
import { colors } from '../theme';
import { withTypography } from '../typography';
import type { ContactMessage } from '../types';

type ReadFilter = '' | 'unread' | 'read';
const PAGE_SIZE = 8;

export default function AdminMessagesScreen() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 820;
  const { authReady, user, logout } = useStore();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [keyword, setKeyword] = useState('');
  const [readFilter, setReadFilter] = useState<ReadFilter>('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busyKey, setBusyKey] = useState('');

  const load = useCallback(async (showLoading = true) => {
    if (user?.role !== 'ADMIN') return;
    if (showLoading) setLoading(true);
    setError('');
    try {
      setMessages(await contactApi.adminList());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Không thể tải danh sách tin nhắn.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) router.replace({ pathname: '/login', params: { redirect: '/admin/messages' } });
    else if (user.role !== 'ADMIN') router.replace('/');
  }, [authReady, router, user]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => filterAdminMessages(messages, keyword, readFilter) as ContactMessage[], [keyword, messages, readFilter]);
  const pageCount = adminMessagesPageCount(filtered.length, PAGE_SIZE) as number;
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = messages.find(message => message.id === selectedId) ?? null;
  const unreadCount = messages.filter(message => !message.isRead).length;

  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const markRead = async (message: ContactMessage) => {
    if (message.isRead || busyKey) return;
    setBusyKey(`read-${message.id}`);
    setActionError('');
    setNotice('');
    try {
      await contactApi.markRead(message.id);
      setNotice('Đã đánh dấu tin nhắn là đã đọc.');
      await load(false);
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : 'Không thể đánh dấu đã đọc.');
    } finally {
      setBusyKey('');
    }
  };

  const remove = async (message: ContactMessage) => {
    if (busyKey || !await confirmAction('Xóa tin nhắn này? Thao tác không thể hoàn tác.')) return;
    setBusyKey(`delete-${message.id}`);
    setActionError('');
    setNotice('');
    try {
      await contactApi.remove(message.id);
      if (selectedId === message.id) setSelectedId(null);
      setNotice('Đã xóa tin nhắn.');
      await load(false);
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : 'Không thể xóa tin nhắn.');
    } finally {
      setBusyKey('');
    }
  };

  if (!authReady || !user || user.role !== 'ADMIN') return <AdminGateState />;
  const signOut = () => { void logout().finally(() => router.replace('/login')); };

  return <AdminLayout user={user} onLogout={signOut}>
    <StatusBar style="light" />
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, compact && styles.contentCompact]}>
      <View style={[styles.pageHeading, compact && styles.pageHeadingCompact]}>
        <View style={styles.headingCopy}><Text style={styles.eyebrow}>CONTACT INBOX</Text><Text style={[styles.title, compact && styles.titleCompact]}>Tin nhắn</Text><Text style={styles.subtitle}>Quản lý nội dung khách hàng gửi từ trang Liên hệ.</Text></View>
        <Pressable accessibilityRole="button" disabled={loading} onPress={() => void load()} style={[styles.refreshButton, loading && styles.disabled]}>{loading ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="refresh" size={17} color={colors.white} />}<Text style={styles.refreshText}>Làm mới</Text></Pressable>
      </View>

      <View style={styles.summaryRow}><SummaryCard icon="mail-outline" label="Tổng tin nhắn" value={messages.length} /><SummaryCard icon="mail-unread-outline" label="Chưa đọc" value={unreadCount} emphasized /><SummaryCard icon="mail-open-outline" label="Đã đọc" value={messages.length - unreadCount} /></View>

      <View style={styles.filterPanel}>
        <View style={[styles.searchRow, compact && styles.searchRowCompact]}><View style={styles.searchBox}><Ionicons name="search" size={18} color={colors.subtle} /><TextInput accessibilityLabel="Tìm tin nhắn" value={keyword} onChangeText={value => { setKeyword(value); setPage(1); }} placeholder="Tên, email, điện thoại hoặc nội dung..." placeholderTextColor={colors.subtle} style={styles.searchInput} /></View><Pressable accessibilityRole="button" onPress={() => { setKeyword(''); setReadFilter(''); setPage(1); }} style={styles.resetButton}><Ionicons name="refresh-outline" size={17} color={colors.ink} /><Text style={styles.resetText}>Xóa bộ lọc</Text></Pressable></View>
        <Text style={styles.filterLabel}>Trạng thái đọc</Text>
        <View style={styles.chipRow}><FilterChip label="Tất cả" active={!readFilter} onPress={() => { setReadFilter(''); setPage(1); }} /><FilterChip label="Chưa đọc" active={readFilter === 'unread'} onPress={() => { setReadFilter('unread'); setPage(1); }} /><FilterChip label="Đã đọc" active={readFilter === 'read'} onPress={() => { setReadFilter('read'); setPage(1); }} /></View>
      </View>

      {notice.length > 0 ? <FeedbackBanner icon="checkmark-circle-outline" message={notice} success /> : null}
      {actionError.length > 0 ? <FeedbackBanner icon="warning-outline" message={actionError} /> : null}

      {compact && selected ? <MessageDetail message={selected} busyKey={busyKey} onClose={() => setSelectedId(null)} onRead={markRead} onRemove={remove} /> : null}

      <View style={[styles.workspace, compact && styles.workspaceCompact]}>
        <View style={styles.listPanel}>
          <View style={styles.listHeading}><View><Text style={styles.panelEyebrow}>INBOX</Text><Text style={styles.panelTitle}>{filtered.length} tin nhắn</Text></View><Text style={styles.resultMeta}>{readFilter || keyword.trim() ? `${messages.length} tin trong hệ thống` : 'Toàn bộ dữ liệu'}</Text></View>
          {loading ? <StatePanel loading title="Đang tải tin nhắn" message="Hệ thống đang lấy danh sách liên hệ." />
            : error.length > 0 ? <StatePanel icon="cloud-offline-outline" title="Không thể tải tin nhắn" message={error} action="Thử lại" onPress={() => void load()} />
              : visible.length === 0 ? <StatePanel icon="mail-outline" title="Không có tin nhắn" message={messages.length ? 'Không có tin nhắn phù hợp với bộ lọc.' : 'Chưa có khách hàng gửi liên hệ.'} />
                : compact ? <View style={styles.cardList}>{visible.map(message => <MessageCard key={message.id} message={message} busyKey={busyKey} onDetail={() => setSelectedId(message.id)} onRead={markRead} onRemove={remove} />)}</View>
                  : <MessageTable messages={visible} busyKey={busyKey} onDetail={message => setSelectedId(message.id)} onRead={markRead} onRemove={remove} />}
          {!loading && error.length === 0 && filtered.length > 0 ? <View style={styles.pagination}><Text style={styles.pageMeta}>Trang {page}/{pageCount} · {filtered.length} kết quả</Text><View style={styles.pageActions}><PageButton label="Trước" icon="chevron-back" disabled={page <= 1} onPress={() => setPage(value => Math.max(1, value - 1))} /><PageButton label="Sau" icon="chevron-forward" trailing disabled={page >= pageCount} onPress={() => setPage(value => Math.min(pageCount, value + 1))} /></View></View> : null}
        </View>
        {!compact ? selected ? <MessageDetail message={selected} busyKey={busyKey} onClose={() => setSelectedId(null)} onRead={markRead} onRemove={remove} /> : <View style={styles.detailPlaceholder}><Ionicons name="mail-open-outline" size={36} color={colors.subtle} /><Text style={styles.placeholderTitle}>Chọn một tin nhắn</Text><Text style={styles.placeholderText}>Nội dung đầy đủ và thông tin liên hệ sẽ hiển thị tại đây.</Text></View> : null}
      </View>
    </ScrollView>
  </AdminLayout>;
}

function SummaryCard({ icon, label, value, emphasized = false }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; value: number; emphasized?: boolean }) {
  return <View style={[styles.summaryCard, emphasized && styles.summaryCardEmphasized]}><View style={[styles.summaryIcon, emphasized && styles.summaryIconEmphasized]}><Ionicons name={icon} size={20} color={emphasized ? colors.white : colors.accent} /></View><View><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View></View>;
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function FeedbackBanner({ icon, message, success = false }: { icon: ComponentProps<typeof Ionicons>['name']; message: string; success?: boolean }) {
  return <View style={[styles.feedback, success && styles.feedbackSuccess]}><Ionicons name={icon} size={18} color={success ? colors.success : colors.danger} /><Text style={[styles.feedbackText, success && styles.feedbackTextSuccess]}>{message}</Text></View>;
}

function MessageDetail({ message, busyKey, onClose, onRead, onRemove }: { message: ContactMessage; busyKey: string; onClose: () => void; onRead: (message: ContactMessage) => void; onRemove: (message: ContactMessage) => void }) {
  const reading = busyKey === `read-${message.id}`;
  const deleting = busyKey === `delete-${message.id}`;
  return <View style={styles.detailPanel}>
    <View style={styles.detailHeading}><View style={styles.senderAvatar}><Text style={styles.senderInitial}>{message.name.trim().slice(0, 1).toUpperCase() || '?'}</Text></View><View style={styles.detailHeadingCopy}><Text style={styles.panelEyebrow}>MESSAGE #{message.id}</Text><Text style={styles.detailName}>{message.name}</Text><ReadBadge isRead={message.isRead} /></View><Pressable accessibilityRole="button" accessibilityLabel="Đóng chi tiết" onPress={onClose} style={styles.closeButton}><Ionicons name="close" size={20} color={colors.ink} /></Pressable></View>
    <View style={styles.contactGrid}><DetailItem icon="mail-outline" label="Email" value={message.email} /><DetailItem icon="call-outline" label="Số điện thoại" value={message.phone || 'Không cung cấp'} /><DetailItem icon="calendar-outline" label="Thời gian gửi" value={formatDateTime(message.createdAt)} /></View>
    <View style={styles.messageBox}><Text style={styles.messageLabel}>NỘI DUNG</Text><Text selectable style={styles.messageBody}>{message.message}</Text></View>
    <View style={styles.detailNote}><Ionicons name="information-circle-outline" size={17} color={colors.accent} /><Text style={styles.detailNoteText}>Backend chỉ hỗ trợ đánh dấu đã đọc và xóa. Không có chức năng phản hồi hoặc trạng thái đã xử lý.</Text></View>
    <View style={styles.detailActions}>{!message.isRead ? <ActionButton label="Đánh dấu đã đọc" icon="checkmark" loading={reading} disabled={Boolean(busyKey)} onPress={() => void onRead(message)} /> : null}<ActionButton label="Xóa tin nhắn" icon="trash-outline" danger loading={deleting} disabled={Boolean(busyKey)} onPress={() => void onRemove(message)} /></View>
  </View>;
}

function DetailItem({ icon, label, value }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return <View style={styles.detailItem}><Ionicons name={icon} size={17} color={colors.accent} /><View style={styles.detailItemCopy}><Text style={styles.detailLabel}>{label}</Text><Text selectable style={styles.detailValue}>{value}</Text></View></View>;
}

function MessageTable({ messages, busyKey, onDetail, onRead, onRemove }: { messages: ContactMessage[]; busyKey: string; onDetail: (message: ContactMessage) => void; onRead: (message: ContactMessage) => void; onRemove: (message: ContactMessage) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScroll}><View style={styles.table}><View style={[styles.tableRow, styles.tableHead]}><Text style={[styles.tableHeadText, styles.senderColumn]}>NGƯỜI GỬI</Text><Text style={[styles.tableHeadText, styles.contactColumn]}>LIÊN HỆ</Text><Text style={[styles.tableHeadText, styles.contentColumn]}>NỘI DUNG</Text><Text style={[styles.tableHeadText, styles.dateColumn]}>THỜI GIAN</Text><Text style={[styles.tableHeadText, styles.statusColumn]}>TRẠNG THÁI</Text><Text style={[styles.tableHeadText, styles.actionColumn]}>THAO TÁC</Text></View>{messages.map(message => <View key={message.id} style={[styles.tableRow, !message.isRead && styles.unreadRow]}><View style={styles.senderColumn}><Text numberOfLines={1} style={styles.senderName}>{message.name}</Text><Text style={styles.messageId}>#{message.id}</Text></View><View style={styles.contactColumn}><Text selectable numberOfLines={1} style={styles.cellText}>{message.email}</Text><Text selectable numberOfLines={1} style={styles.cellMuted}>{message.phone || '—'}</Text></View><Text numberOfLines={2} style={[styles.cellText, styles.contentColumn]}>{adminMessagePreview(message.message)}</Text><Text numberOfLines={2} style={[styles.cellMuted, styles.dateColumn]}>{formatDateTime(message.createdAt)}</Text><View style={styles.statusColumn}><ReadBadge isRead={message.isRead} /></View><View style={styles.actionColumn}><Pressable accessibilityRole="button" onPress={() => onDetail(message)} style={styles.iconButton}><Ionicons name="eye-outline" size={16} color={colors.accent} /></Pressable>{!message.isRead ? <Pressable accessibilityRole="button" accessibilityLabel="Đánh dấu đã đọc" disabled={Boolean(busyKey)} onPress={() => void onRead(message)} style={styles.iconButton}>{busyKey === `read-${message.id}` ? <ActivityIndicator size="small" color={colors.accent} /> : <Ionicons name="checkmark" size={16} color={colors.accent} />}</Pressable> : null}<Pressable accessibilityRole="button" accessibilityLabel="Xóa tin nhắn" disabled={Boolean(busyKey)} onPress={() => void onRemove(message)} style={[styles.iconButton, styles.deleteIconButton]}>{busyKey === `delete-${message.id}` ? <ActivityIndicator size="small" color={colors.danger} /> : <Ionicons name="trash-outline" size={16} color={colors.danger} />}</Pressable></View></View>)}</View></ScrollView>;
}

function MessageCard({ message, busyKey, onDetail, onRead, onRemove }: { message: ContactMessage; busyKey: string; onDetail: () => void; onRead: (message: ContactMessage) => void; onRemove: (message: ContactMessage) => void }) {
  return <View style={[styles.messageCard, !message.isRead && styles.unreadCard]}><View style={styles.cardTop}><View style={styles.senderAvatar}><Text style={styles.senderInitial}>{message.name.trim().slice(0, 1).toUpperCase() || '?'}</Text></View><View style={styles.cardCopy}><Text style={styles.cardName}>{message.name}</Text><Text selectable style={styles.cardEmail}>{message.email}</Text></View><ReadBadge isRead={message.isRead} /></View><Text numberOfLines={3} style={styles.cardMessage}>{message.message}</Text><View style={styles.cardMeta}><Text style={styles.cardDate}>{formatDateTime(message.createdAt)}</Text><Text selectable style={styles.cardPhone}>{message.phone || 'Không có SĐT'}</Text></View><View style={styles.cardActions}><ActionButton label="Chi tiết" icon="eye-outline" onPress={onDetail} />{!message.isRead ? <ActionButton label="Đã đọc" icon="checkmark" loading={busyKey === `read-${message.id}`} disabled={Boolean(busyKey)} onPress={() => void onRead(message)} /> : null}<ActionButton label="Xóa" icon="trash-outline" danger loading={busyKey === `delete-${message.id}`} disabled={Boolean(busyKey)} onPress={() => void onRemove(message)} /></View></View>;
}

function ReadBadge({ isRead }: { isRead: boolean }) {
  return <View style={[styles.readBadge, !isRead && styles.unreadBadge]}><Ionicons name={isRead ? 'mail-open-outline' : 'mail-unread-outline'} size={13} color={isRead ? colors.muted : colors.accent} /><Text style={[styles.readBadgeText, !isRead && styles.unreadBadgeText]}>{isRead ? 'Đã đọc' : 'Chưa đọc'}</Text></View>;
}

function ActionButton({ label, icon, danger = false, loading = false, disabled = false, onPress }: { label: string; icon: ComponentProps<typeof Ionicons>['name']; danger?: boolean; loading?: boolean; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.actionButton, danger && styles.dangerButton, disabled && styles.disabled]}>{loading ? <ActivityIndicator size="small" color={danger ? colors.danger : colors.accent} /> : <Ionicons name={icon} size={16} color={danger ? colors.danger : colors.accent} />}<Text style={[styles.actionButtonText, danger && styles.dangerButtonText]}>{label}</Text></Pressable>;
}

function PageButton({ label, icon, trailing = false, disabled, onPress }: { label: string; icon: 'chevron-back' | 'chevron-forward'; trailing?: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.pageButton, disabled && styles.disabled]}>{!trailing ? <Ionicons name={icon} size={16} color={colors.ink} /> : null}<Text style={styles.pageButtonText}>{label}</Text>{trailing ? <Ionicons name={icon} size={16} color={colors.ink} /> : null}</Pressable>;
}

function StatePanel({ loading = false, icon = 'mail-outline', title, message, action, onPress }: { loading?: boolean; icon?: ComponentProps<typeof Ionicons>['name']; title: string; message: string; action?: string; onPress?: () => void }) {
  return <View style={styles.statePanel}>{loading ? <ActivityIndicator size="large" color={colors.accent} /> : <Ionicons name={icon} size={32} color={colors.subtle} />}<Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{message}</Text>{action && onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={styles.retryButton}><Text style={styles.retryText}>{action}</Text></Pressable> : null}</View>;
}

function AdminGateState() {
  return <View style={styles.gate}><StatusBar style="light" /><ActivityIndicator size="large" color={colors.accentBright} /><Text style={styles.gateText}>Đang xác minh quyền quản trị...</Text></View>;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Không rõ' : date.toLocaleString('vi-VN');
}

const styles = StyleSheet.create(withTypography({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { width: '100%', maxWidth: 1680, alignSelf: 'center', padding: 28, paddingBottom: 42, gap: 16 },
  contentCompact: { padding: 14, paddingBottom: 28, gap: 13 },
  pageHeading: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  pageHeadingCompact: { alignItems: 'stretch', flexDirection: 'column' },
  headingCopy: { flex: 1 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: 5 },
  titleCompact: { fontSize: 24 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 5 },
  refreshButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  refreshText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  disabled: { opacity: .52 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { minWidth: 180, flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 11 },
  summaryCardEmphasized: { borderColor: '#9ED3E2' },
  summaryIcon: { width: 42, height: 42, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E1F4FA' },
  summaryIconEmphasized: { backgroundColor: colors.accent },
  summaryLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  summaryValue: { color: colors.ink, fontSize: 19, fontWeight: '800', marginTop: 2 },
  filterPanel: { padding: 17, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchRowCompact: { alignItems: 'stretch', flexDirection: 'column' },
  searchBox: { flex: 1, minHeight: 44, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, minWidth: 0, paddingHorizontal: 9, color: colors.ink, fontSize: 12 },
  resetButton: { minHeight: 44, paddingHorizontal: 13, borderRadius: 8, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  resetText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  filterLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: .8, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  chipActive: { borderColor: colors.accent, backgroundColor: '#E1F4FA' },
  chipText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  chipTextActive: { color: colors.accent },
  feedback: { padding: 11, borderRadius: 8, borderWidth: 1, borderColor: '#F0CACA', backgroundColor: '#FFF7F7', flexDirection: 'row', alignItems: 'center', gap: 8 },
  feedbackSuccess: { borderColor: '#B9DFC9', backgroundColor: '#F1FAF5' },
  feedbackText: { flex: 1, color: colors.danger, fontSize: 10 },
  feedbackTextSuccess: { color: colors.success },
  workspace: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  workspaceCompact: { flexDirection: 'column' },
  listPanel: { flex: 1.5, minWidth: 0, padding: 18, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 12 },
  listHeading: { flexDirection: 'row', alignItems: 'center' },
  panelEyebrow: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  panelTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 2 },
  resultMeta: { marginLeft: 'auto', color: colors.muted, fontSize: 10 },
  detailPanel: { flex: 1, minWidth: 300, width: '100%', padding: 18, borderRadius: 12, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: colors.white, gap: 15 },
  detailPlaceholder: { flex: 1, minWidth: 300, minHeight: 330, padding: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', gap: 8 },
  placeholderTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  placeholderText: { maxWidth: 280, color: colors.muted, fontSize: 10, lineHeight: 17, textAlign: 'center' },
  detailHeading: { paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailHeadingCopy: { flex: 1, minWidth: 0, gap: 4 },
  senderAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.headerRaised, alignItems: 'center', justifyContent: 'center' },
  senderInitial: { color: colors.accentBright, fontSize: 14, fontWeight: '800' },
  detailName: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  closeButton: { width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  contactGrid: { gap: 8 },
  detailItem: { minHeight: 48, padding: 10, borderRadius: 8, backgroundColor: colors.bg, flexDirection: 'row', alignItems: 'center', gap: 9 },
  detailItemCopy: { flex: 1, minWidth: 0 },
  detailLabel: { color: colors.muted, fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },
  detailValue: { color: colors.ink, fontSize: 10, fontWeight: '700', marginTop: 3 },
  messageBox: { padding: 13, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  messageLabel: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: .7 },
  messageBody: { color: colors.ink, fontSize: 11, lineHeight: 19, marginTop: 8 },
  detailNote: { padding: 10, borderRadius: 8, backgroundColor: '#F1FAFC', flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  detailNoteText: { flex: 1, color: colors.accent, fontSize: 9, lineHeight: 15 },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: { minHeight: 38, paddingHorizontal: 11, borderRadius: 7, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: '#F1FAFC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionButtonText: { color: colors.accent, fontSize: 9, fontWeight: '800' },
  dangerButton: { borderColor: '#F0CACA', backgroundColor: '#FFF7F7' },
  dangerButtonText: { color: colors.danger },
  readBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: colors.bg, flexDirection: 'row', alignItems: 'center', gap: 4 },
  unreadBadge: { backgroundColor: '#E1F4FA' },
  readBadgeText: { color: colors.muted, fontSize: 8, fontWeight: '800' },
  unreadBadgeText: { color: colors.accent },
  tableScroll: { minWidth: 1120 },
  table: { minWidth: 1120, flex: 1 },
  tableRow: { minHeight: 82, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center' },
  tableHead: { minHeight: 46, borderRadius: 7, borderBottomWidth: 0, backgroundColor: colors.bg },
  unreadRow: { backgroundColor: '#F4FBFD' },
  tableHeadText: { paddingHorizontal: 7, color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: .4 },
  senderColumn: { width: 175, paddingHorizontal: 7 },
  contactColumn: { width: 220, paddingHorizontal: 7 },
  contentColumn: { width: 300, paddingHorizontal: 7 },
  dateColumn: { width: 150, paddingHorizontal: 7 },
  statusColumn: { width: 105, paddingHorizontal: 7 },
  actionColumn: { width: 155, paddingHorizontal: 7, flexDirection: 'row', gap: 5 },
  senderName: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  messageId: { color: colors.accent, fontSize: 8, fontWeight: '800', marginTop: 3 },
  cellText: { color: colors.ink, fontSize: 10, lineHeight: 16 },
  cellMuted: { color: colors.muted, fontSize: 9, lineHeight: 15 },
  iconButton: { width: 34, height: 34, borderRadius: 7, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: '#F1FAFC', alignItems: 'center', justifyContent: 'center' },
  deleteIconButton: { borderColor: '#F0CACA', backgroundColor: '#FFF7F7' },
  cardList: { gap: 10 },
  messageCard: { padding: 13, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 10 },
  unreadCard: { borderColor: '#9ED3E2', backgroundColor: '#F8FCFD' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  cardCopy: { flex: 1, minWidth: 0 },
  cardName: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  cardEmail: { color: colors.muted, fontSize: 9, marginTop: 3 },
  cardMessage: { color: colors.ink, fontSize: 10, lineHeight: 17 },
  cardMeta: { paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.lineSoft, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cardDate: { flex: 1, color: colors.muted, fontSize: 8 },
  cardPhone: { color: colors.muted, fontSize: 8 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  pagination: { paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pageMeta: { color: colors.muted, fontSize: 9 },
  pageActions: { flexDirection: 'row', gap: 7 },
  pageButton: { minHeight: 36, paddingHorizontal: 10, borderRadius: 7, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageButtonText: { color: colors.ink, fontSize: 9, fontWeight: '800' },
  statePanel: { minHeight: 260, padding: 25, alignItems: 'center', justifyContent: 'center', gap: 9 },
  stateTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  stateText: { maxWidth: 440, color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  retryButton: { minHeight: 38, marginTop: 3, paddingHorizontal: 13, borderRadius: 7, borderWidth: 1, borderColor: colors.accent, justifyContent: 'center' },
  retryText: { color: colors.accent, fontSize: 10, fontWeight: '800' },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.header },
  gateText: { color: colors.onDark, fontSize: 11, fontWeight: '700' },
}));
