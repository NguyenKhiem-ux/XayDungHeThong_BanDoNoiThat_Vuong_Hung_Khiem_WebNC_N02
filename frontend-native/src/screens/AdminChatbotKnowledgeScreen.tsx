import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { knowledgePageCount, knowledgePayload, knowledgePreview, knowledgeValidationError } from '../adminKnowledge.mjs';
import { confirmAction, knowledgeApi } from '../api';
import { AdminLayout } from '../components/admin/AdminLayout';
import { useStore } from '../store';
import { colors } from '../theme';
import { withTypography } from '../typography';
import { chatIntents, type ChatbotKnowledge, type ChatIntent, type KnowledgeInput, type KnowledgeStatus, type RiskLevel } from '../types';

const PAGE_SIZE = 20;
const emptyForm: KnowledgeInput = { question: '', answer: '', keywords: '' };
const statusLabels: Record<KnowledgeStatus, string> = { pending_review: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' };
const visibleIntents = chatIntents.filter(value => !['small_talk', 'greeting', 'thanks', 'goodbye', 'unknown'].includes(value));

export default function AdminChatbotKnowledgeScreen() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 850;
  const { authReady, user, logout } = useStore();
  const [status, setStatus] = useState<KnowledgeStatus | ''>('pending_review');
  const [risk, setRisk] = useState<RiskLevel | ''>('');
  const [intent, setIntent] = useState<ChatIntent | ''>('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ChatbotKnowledge[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<KnowledgeInput | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (user?.role !== 'ADMIN') return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const result = await knowledgeApi.list({ status, page, risk, intent });
      if (currentRequest !== requestId.current) return;
      setRows(result.items);
      setTotal(result.total);
      if (page > 1 && result.items.length === 0) setPage(page - 1);
    } catch (failure) {
      if (currentRequest === requestId.current) setError(failure instanceof Error ? failure.message : 'Không thể tải kho kiến thức.');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [intent, page, risk, status, user?.role]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) router.replace({ pathname: '/login', params: { redirect: '/admin/chatbot-knowledge' } });
    else if (user.role !== 'ADMIN') router.replace('/');
  }, [authReady, router, user]);

  useEffect(() => { void load(); return () => { requestId.current += 1; }; }, [load]);

  const selected = rows.find(row => row.id === selectedId) ?? null;
  const pageCount = knowledgePageCount(total, PAGE_SIZE) as number;
  const busy = busyKey.length > 0;

  const openEditor = (row?: ChatbotKnowledge) => {
    setEditingId(row?.id ?? null);
    setForm(row ? { question: row.question, answer: row.answer, keywords: row.keywords } : { ...emptyForm });
    setFormError('');
    setError('');
    setNotice('');
  };

  const save = async () => {
    if (!form || busy) return;
    const validationError = knowledgeValidationError(form) as string;
    if (validationError.length > 0) { setFormError(validationError); return; }
    setBusyKey(editingId === null ? 'create' : `edit-${editingId}`);
    setFormError('');
    setError('');
    setNotice('');
    try {
      const payload = knowledgePayload(form) as KnowledgeInput;
      if (editingId === null) await knowledgeApi.create(payload);
      else await knowledgeApi.update(editingId, payload);
      setForm(null);
      setEditingId(null);
      setSelectedId(null);
      setStatus('pending_review');
      setRisk('');
      setIntent('');
      setPage(1);
      setNotice('Đã lưu vào trạng thái chờ duyệt. Hãy kiểm tra trước khi cho phép Chatbot sử dụng.');
      if (status === 'pending_review' && !risk && !intent && page === 1) await load();
    } catch (failure) {
      setFormError(failure instanceof Error ? failure.message : 'Không thể lưu kiến thức.');
    } finally {
      setBusyKey('');
    }
  };

  const moderate = async (row: ChatbotKnowledge, nextStatus: 'approved' | 'rejected') => {
    if (busy) return;
    setBusyKey(`${nextStatus}-${row.id}`);
    setError('');
    setNotice('');
    try {
      if (nextStatus === 'approved') await knowledgeApi.approve(row.id);
      else await knowledgeApi.reject(row.id);
      setSelectedId(null);
      setNotice(nextStatus === 'approved' ? 'Đã duyệt. Chatbot có thể sử dụng câu trả lời này.' : 'Đã từ chối. Chatbot sẽ không sử dụng câu trả lời này.');
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Không thể cập nhật trạng thái kiến thức.');
    } finally {
      setBusyKey('');
    }
  };

  const remove = async (row: ChatbotKnowledge) => {
    if (busy || !await confirmAction('Xóa kiến thức này? Thao tác không thể hoàn tác.')) return;
    setBusyKey(`delete-${row.id}`);
    setError('');
    setNotice('');
    try {
      await knowledgeApi.remove(row.id);
      setSelectedId(null);
      if (editingId === row.id) { setForm(null); setEditingId(null); }
      setNotice('Đã xóa kiến thức.');
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Không thể xóa kiến thức.');
    } finally {
      setBusyKey('');
    }
  };

  if (!authReady || !user || user.role !== 'ADMIN') return <AdminGateState />;
  const signOut = () => { void logout().finally(() => router.replace('/login')); };

  return <AdminLayout user={user} onLogout={signOut}>
    <StatusBar style="light" />
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, compact && styles.contentCompact]} keyboardShouldPersistTaps="handled">
      <View style={[styles.pageHeading, compact && styles.pageHeadingCompact]}><View style={styles.headingCopy}><Text style={styles.eyebrow}>CHATBOT KNOWLEDGE</Text><Text style={[styles.title, compact && styles.titleCompact]}>Kiến thức Chatbot</Text><Text style={styles.subtitle}>Duyệt câu trả lời để Chatbot tái sử dụng mà không gọi AI.</Text></View><View style={[styles.headerActions, compact && styles.headerActionsCompact]}><Pressable accessibilityRole="button" disabled={busy || loading} onPress={() => void load()} style={[styles.secondaryButton, (busy || loading) && styles.disabled]}>{loading ? <ActivityIndicator size="small" color={colors.accent} /> : <Ionicons name="refresh" size={17} color={colors.accent} />}<Text style={styles.secondaryButtonText}>Làm mới</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => openEditor()} style={[styles.primaryButton, busy && styles.disabled]}><Ionicons name="add" size={18} color={colors.white} /><Text style={styles.primaryButtonText}>Tạo FAQ</Text></Pressable></View></View>

      {error.length > 0 ? <FeedbackBanner icon="warning-outline" message={error} /> : null}
      {notice.length > 0 ? <FeedbackBanner icon="checkmark-circle-outline" message={notice} success /> : null}

      {form ? <KnowledgeEditor form={form} setForm={setForm} editingId={editingId} error={formError} busy={busy} onSave={save} onCancel={() => { setForm(null); setEditingId(null); setFormError(''); }} compact={compact} /> : null}

      <View style={styles.filters}>
        <Text style={styles.filterLabel}>Trạng thái</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}><FilterChip label="Tất cả" active={!status} disabled={busy} onPress={() => { setStatus(''); setPage(1); }} /><FilterChip label="Chờ duyệt" active={status === 'pending_review'} disabled={busy} onPress={() => { setStatus('pending_review'); setPage(1); }} /><FilterChip label="Đã duyệt" active={status === 'approved'} disabled={busy} onPress={() => { setStatus('approved'); setPage(1); }} /><FilterChip label="Từ chối" active={status === 'rejected'} disabled={busy} onPress={() => { setStatus('rejected'); setPage(1); }} /></ScrollView>
        <Text style={styles.filterLabel}>Mức rủi ro</Text>
        <View style={styles.chipRow}><FilterChip label="Tất cả" active={!risk} disabled={busy} onPress={() => { setRisk(''); setPage(1); }} />{(['LOW', 'MEDIUM', 'HIGH'] as const).map(value => <FilterChip key={value} label={value} active={risk === value} disabled={busy} onPress={() => { setRisk(value); setPage(1); }} />)}</View>
        <Text style={styles.filterLabel}>Intent</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}><FilterChip label="Tất cả" active={!intent} disabled={busy} onPress={() => { setIntent(''); setPage(1); }} />{visibleIntents.map(value => <FilterChip key={value} label={value} active={intent === value} disabled={busy} onPress={() => { setIntent(value); setPage(1); }} />)}</ScrollView>
      </View>

      {selected ? <KnowledgeDetail row={selected} busyKey={busyKey} compact={compact} onClose={() => setSelectedId(null)} onEdit={() => openEditor(selected)} onApprove={() => void moderate(selected, 'approved')} onReject={() => void moderate(selected, 'rejected')} onRemove={() => void remove(selected)} /> : null}

      <View style={styles.listPanel}><View style={styles.listHeading}><View><Text style={styles.panelEyebrow}>KNOWLEDGE BASE</Text><Text style={styles.panelTitle}>{total} mục kiến thức</Text></View><Text style={styles.resultMeta}>Trang {page}/{pageCount}</Text></View>{loading ? <StatePanel loading title="Đang tải kiến thức" message="Hệ thống đang lấy dữ liệu theo bộ lọc." /> : error.length > 0 && rows.length === 0 ? <StatePanel icon="cloud-offline-outline" title="Không thể tải kiến thức" message={error} action="Thử lại" onPress={() => void load()} /> : rows.length === 0 ? <StatePanel icon="book-outline" title="Chưa có kiến thức" message="Không có bản ghi phù hợp với bộ lọc hiện tại." /> : compact ? <View style={styles.cardList}>{rows.map(row => <KnowledgeCard key={row.id} row={row} busyKey={busyKey} onDetail={() => setSelectedId(row.id)} onEdit={() => openEditor(row)} onApprove={() => void moderate(row, 'approved')} onReject={() => void moderate(row, 'rejected')} onRemove={() => void remove(row)} />)}</View> : <KnowledgeTable rows={rows} busyKey={busyKey} onDetail={row => setSelectedId(row.id)} onEdit={openEditor} onApprove={row => void moderate(row, 'approved')} onReject={row => void moderate(row, 'rejected')} onRemove={row => void remove(row)} />}
        {!loading && error.length === 0 && total > 0 ? <View style={styles.pagination}><Text style={styles.pageMeta}>{total} mục · Trang {page}/{pageCount}</Text><View style={styles.pageActions}><PageButton label="Trước" icon="chevron-back" disabled={busy || page <= 1} onPress={() => setPage(value => Math.max(1, value - 1))} /><PageButton label="Sau" icon="chevron-forward" trailing disabled={busy || page >= pageCount} onPress={() => setPage(value => Math.min(pageCount, value + 1))} /></View></View> : null}
      </View>
    </ScrollView>
  </AdminLayout>;
}

function KnowledgeEditor({ form, setForm, editingId, error, busy, onSave, onCancel, compact }: { form: KnowledgeInput; setForm: (value: KnowledgeInput) => void; editingId: number | null; error: string; busy: boolean; onSave: () => void; onCancel: () => void; compact: boolean }) {
  return <View style={styles.editor}><View style={styles.editorHeading}><View><Text style={styles.panelEyebrow}>{editingId === null ? 'NEW FAQ' : `EDIT #${editingId}`}</Text><Text style={styles.panelTitle}>{editingId === null ? 'Tạo FAQ thủ công' : 'Chỉnh sửa kiến thức'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Đóng biểu mẫu" disabled={busy} onPress={onCancel} style={styles.closeButton}><Ionicons name="close" size={20} color={colors.ink} /></Pressable></View><FormField label="Câu hỏi" value={form.question} onChangeText={value => setForm({ ...form, question: value })} maxLength={1000} multiline lines={3} disabled={busy} /><FormField label="Câu trả lời" value={form.answer} onChangeText={value => setForm({ ...form, answer: value })} maxLength={8000} multiline lines={compact ? 8 : 7} disabled={busy} /><FormField label="Từ khóa bổ sung (tùy chọn)" value={form.keywords} onChangeText={value => setForm({ ...form, keywords: value })} maxLength={1000} multiline lines={2} disabled={busy} />{error.length > 0 ? <View style={styles.formError}><Ionicons name="warning-outline" size={16} color={colors.danger} /><Text style={styles.formErrorText}>{error}</Text></View> : null}<View style={styles.editorNote}><Ionicons name="information-circle-outline" size={17} color={colors.accent} /><Text style={styles.editorNoteText}>Nội dung mới hoặc vừa sửa luôn quay về chờ duyệt. Hãy kiểm tra dữ liệu sản phẩm trước khi Approve.</Text></View><View style={styles.editorActions}><Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={[styles.secondaryButton, busy && styles.disabled]}><Text style={styles.secondaryButtonText}>Hủy</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => void onSave()} style={[styles.primaryButton, busy && styles.disabled]}>{busy ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="save-outline" size={17} color={colors.white} />}<Text style={styles.primaryButtonText}>Lưu Pending</Text></Pressable></View></View>;
}

function FormField({ label, value, onChangeText, maxLength, multiline, lines, disabled }: { label: string; value: string; onChangeText: (value: string) => void; maxLength: number; multiline?: boolean; lines: number; disabled: boolean }) {
  return <View style={styles.field}><View style={styles.fieldHeading}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.counter}>{value.length}/{maxLength}</Text></View><TextInput value={value} onChangeText={onChangeText} editable={!disabled} multiline={multiline} maxLength={maxLength} numberOfLines={lines} textAlignVertical="top" style={[styles.input, multiline && { minHeight: lines * 24 }]} /></View>;
}

function KnowledgeDetail({ row, busyKey, compact, onClose, onEdit, onApprove, onReject, onRemove }: { row: ChatbotKnowledge; busyKey: string; compact: boolean; onClose: () => void; onEdit: () => void; onApprove: () => void; onReject: () => void; onRemove: () => void }) {
  const busy = busyKey.length > 0;
  return <View style={styles.detailPanel}><View style={[styles.detailHeading, compact && styles.detailHeadingCompact]}><View style={styles.detailIcon}><Ionicons name="book-outline" size={21} color={colors.accent} /></View><View style={styles.detailCopy}><Text style={styles.panelEyebrow}>KNOWLEDGE #{row.id}</Text><Text selectable style={styles.detailQuestion}>{row.question}</Text></View><StatusBadge status={row.status} /><Pressable accessibilityRole="button" accessibilityLabel="Đóng chi tiết" onPress={onClose} style={styles.closeButton}><Ionicons name="close" size={20} color={colors.ink} /></Pressable></View><View style={styles.detailMeta}><MetaItem label="Intent" value={row.intent} /><MetaItem label="Rủi ro" value={row.riskLevel} /><MetaItem label="Nguồn" value={row.source} /><MetaItem label="Lượt dùng" value={String(row.usageCount)} /></View><View style={styles.answerBox}><Text style={styles.answerLabel}>CÂU TRẢ LỜI</Text><Text selectable style={styles.answerText}>{row.answer}</Text></View>{row.keywords ? <View style={styles.keywordBox}><Text style={styles.answerLabel}>TỪ KHÓA</Text><Text selectable style={styles.keywordText}>{row.keywords}</Text></View> : null}{row.contextHash ? <View style={styles.contextNote}><Ionicons name="cube-outline" size={17} color={colors.accent} /><Text style={styles.contextText}>Có dữ liệu sản phẩm; Backend chỉ duyệt khi context hiện tại còn khớp.</Text></View> : null}<Text style={styles.reviewMeta}>Tạo: {formatDateTime(row.createdAt)}{row.reviewedAt ? ` · Duyệt: ${formatDateTime(row.reviewedAt)} · ${row.reviewedBy === null ? 'Tự duyệt' : `Admin #${row.reviewedBy}`}` : ''}</Text><View style={styles.detailActions}>{row.status !== 'approved' ? <ActionButton label="Approve" icon="checkmark" loading={busyKey === `approved-${row.id}`} disabled={busy} onPress={onApprove} /> : null}{row.status !== 'rejected' ? <ActionButton label="Reject" icon="close" loading={busyKey === `rejected-${row.id}`} disabled={busy} onPress={onReject} /> : null}<ActionButton label="Edit" icon="create-outline" disabled={busy} onPress={onEdit} /><ActionButton label="Delete" icon="trash-outline" danger loading={busyKey === `delete-${row.id}`} disabled={busy} onPress={onRemove} /></View></View>;
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return <View style={styles.metaItem}><Text style={styles.metaLabel}>{label}</Text><Text style={styles.metaValue}>{value}</Text></View>;
}

function KnowledgeTable({ rows, busyKey, onDetail, onEdit, onApprove, onReject, onRemove }: { rows: ChatbotKnowledge[]; busyKey: string; onDetail: (row: ChatbotKnowledge) => void; onEdit: (row: ChatbotKnowledge) => void; onApprove: (row: ChatbotKnowledge) => void; onReject: (row: ChatbotKnowledge) => void; onRemove: (row: ChatbotKnowledge) => void }) {
  const busy = busyKey.length > 0;
  return <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScroll}><View style={styles.table}><View style={[styles.tableRow, styles.tableHead]}><Text style={[styles.headText, styles.qaColumn]}>CÂU HỎI / TRẢ LỜI</Text><Text style={[styles.headText, styles.classColumn]}>PHÂN LOẠI</Text><Text style={[styles.headText, styles.statusColumn]}>TRẠNG THÁI</Text><Text style={[styles.headText, styles.usageColumn]}>LƯỢT DÙNG</Text><Text style={[styles.headText, styles.dateColumn]}>NGÀY TẠO</Text><Text style={[styles.headText, styles.actionColumn]}>THAO TÁC</Text></View>{rows.map(row => <View key={row.id} style={styles.tableRow}><View style={styles.qaColumn}><Text numberOfLines={2} style={styles.questionText}>{row.question}</Text><Text numberOfLines={3} style={styles.answerPreview}>{knowledgePreview(row.answer)}</Text>{row.contextHash ? <Text style={styles.contextFlag}>Có context sản phẩm</Text> : null}</View><View style={styles.classColumn}><Text style={styles.intentText}>{row.intent}</Text><RiskBadge risk={row.riskLevel} /><Text style={styles.sourceText}>Nguồn: {row.source}</Text></View><View style={styles.statusColumn}><StatusBadge status={row.status} /></View><Text style={[styles.cellText, styles.usageColumn]}>{row.usageCount.toLocaleString('vi-VN')}</Text><Text style={[styles.cellMuted, styles.dateColumn]}>{formatDateTime(row.createdAt)}</Text><View style={styles.actionColumn}><IconButton label="Xem chi tiết" icon="eye-outline" disabled={false} onPress={() => onDetail(row)} />{row.status !== 'approved' ? <IconButton label="Approve" icon="checkmark" loading={busyKey === `approved-${row.id}`} disabled={busy} onPress={() => onApprove(row)} /> : null}{row.status !== 'rejected' ? <IconButton label="Reject" icon="close" loading={busyKey === `rejected-${row.id}`} disabled={busy} onPress={() => onReject(row)} /> : null}<IconButton label="Chỉnh sửa" icon="create-outline" disabled={busy} onPress={() => onEdit(row)} /><IconButton label="Xóa" icon="trash-outline" danger loading={busyKey === `delete-${row.id}`} disabled={busy} onPress={() => onRemove(row)} /></View></View>)}</View></ScrollView>;
}

function KnowledgeCard({ row, busyKey, onDetail, onEdit, onApprove, onReject, onRemove }: { row: ChatbotKnowledge; busyKey: string; onDetail: () => void; onEdit: () => void; onApprove: () => void; onReject: () => void; onRemove: () => void }) {
  const busy = busyKey.length > 0;
  return <View style={styles.card}><View style={styles.cardTop}><Text style={styles.cardId}>#{row.id}</Text><StatusBadge status={row.status} /></View><Text numberOfLines={3} style={styles.cardQuestion}>{row.question}</Text><Text numberOfLines={4} style={styles.cardAnswer}>{row.answer}</Text><View style={styles.cardMeta}><RiskBadge risk={row.riskLevel} /><Text style={styles.cardIntent}>{row.intent}</Text><Text style={styles.cardUses}>{row.usageCount} lượt dùng</Text></View><View style={styles.cardActions}><ActionButton label="Chi tiết" icon="eye-outline" disabled={false} onPress={onDetail} />{row.status !== 'approved' ? <ActionButton label="Approve" icon="checkmark" loading={busyKey === `approved-${row.id}`} disabled={busy} onPress={onApprove} /> : null}{row.status !== 'rejected' ? <ActionButton label="Reject" icon="close" loading={busyKey === `rejected-${row.id}`} disabled={busy} onPress={onReject} /> : null}<ActionButton label="Edit" icon="create-outline" disabled={busy} onPress={onEdit} /><ActionButton label="Delete" icon="trash-outline" danger loading={busyKey === `delete-${row.id}`} disabled={busy} onPress={onRemove} /></View></View>;
}

function StatusBadge({ status }: { status: KnowledgeStatus }) {
  const tone = status === 'approved' ? styles.approvedBadge : status === 'rejected' ? styles.rejectedBadge : styles.pendingBadge;
  const textTone = status === 'approved' ? styles.approvedText : status === 'rejected' ? styles.rejectedText : styles.pendingText;
  return <View style={[styles.badge, tone]}><Text style={[styles.badgeText, textTone]}>{statusLabels[status]}</Text></View>;
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <View style={[styles.riskBadge, risk === 'HIGH' && styles.highRisk]}><Text style={[styles.riskText, risk === 'HIGH' && styles.highRiskText]}>{risk}</Text></View>;
}

function FilterChip({ label, active, disabled, onPress }: { label: string; active: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} disabled={disabled} onPress={onPress} style={[styles.chip, active && styles.chipActive, disabled && styles.disabled]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function ActionButton({ label, icon, danger = false, loading = false, disabled, onPress }: { label: string; icon: ComponentProps<typeof Ionicons>['name']; danger?: boolean; loading?: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.actionButton, danger && styles.dangerButton, disabled && styles.disabled]}>{loading ? <ActivityIndicator size="small" color={danger ? colors.danger : colors.accent} /> : <Ionicons name={icon} size={15} color={danger ? colors.danger : colors.accent} />}<Text style={[styles.actionText, danger && styles.dangerText]}>{label}</Text></Pressable>;
}

function IconButton({ label, icon, danger = false, loading = false, disabled, onPress }: { label: string; icon: ComponentProps<typeof Ionicons>['name']; danger?: boolean; loading?: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.iconButton, danger && styles.dangerIcon, disabled && styles.disabled]}>{loading ? <ActivityIndicator size="small" color={danger ? colors.danger : colors.accent} /> : <Ionicons name={icon} size={15} color={danger ? colors.danger : colors.accent} />}</Pressable>;
}

function FeedbackBanner({ icon, message, success = false }: { icon: ComponentProps<typeof Ionicons>['name']; message: string; success?: boolean }) {
  return <View style={[styles.feedback, success && styles.feedbackSuccess]}><Ionicons name={icon} size={18} color={success ? colors.success : colors.danger} /><Text style={[styles.feedbackText, success && styles.feedbackSuccessText]}>{message}</Text></View>;
}

function PageButton({ label, icon, trailing = false, disabled, onPress }: { label: string; icon: 'chevron-back' | 'chevron-forward'; trailing?: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.pageButton, disabled && styles.disabled]}>{!trailing ? <Ionicons name={icon} size={16} color={colors.ink} /> : null}<Text style={styles.pageButtonText}>{label}</Text>{trailing ? <Ionicons name={icon} size={16} color={colors.ink} /> : null}</Pressable>;
}

function StatePanel({ loading = false, icon = 'book-outline', title, message, action, onPress }: { loading?: boolean; icon?: ComponentProps<typeof Ionicons>['name']; title: string; message: string; action?: string; onPress?: () => void }) {
  return <View style={styles.state}>{loading ? <ActivityIndicator size="large" color={colors.accent} /> : <Ionicons name={icon} size={32} color={colors.subtle} />}<Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{message}</Text>{action && onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={styles.retryButton}><Text style={styles.retryText}>{action}</Text></Pressable> : null}</View>;
}

function AdminGateState() {
  return <View style={styles.gate}><StatusBar style="light" /><ActivityIndicator size="large" color={colors.accentBright} /><Text style={styles.gateText}>Đang xác minh quyền quản trị...</Text></View>;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Không rõ' : date.toLocaleString('vi-VN');
}

const styles = StyleSheet.create(withTypography({
  scroll: { flex: 1, backgroundColor: colors.bg }, content: { width: '100%', maxWidth: 1680, alignSelf: 'center', padding: 28, paddingBottom: 42, gap: 16 }, contentCompact: { padding: 14, paddingBottom: 28, gap: 13 },
  pageHeading: { flexDirection: 'row', alignItems: 'center', gap: 15 }, pageHeadingCompact: { alignItems: 'stretch', flexDirection: 'column' }, headingCopy: { flex: 1 }, eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: 5 }, titleCompact: { fontSize: 24 }, subtitle: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 5 },
  headerActions: { flexDirection: 'row', gap: 8 }, headerActionsCompact: { alignItems: 'stretch' }, primaryButton: { minHeight: 42, paddingHorizontal: 13, borderRadius: 8, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, primaryButtonText: { color: colors.white, fontSize: 10, fontWeight: '800' }, secondaryButton: { minHeight: 42, paddingHorizontal: 13, borderRadius: 8, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: '#F1FAFC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, secondaryButtonText: { color: colors.accent, fontSize: 10, fontWeight: '800' }, disabled: { opacity: .5 },
  feedback: { padding: 11, borderRadius: 8, borderWidth: 1, borderColor: '#F0CACA', backgroundColor: '#FFF7F7', flexDirection: 'row', alignItems: 'center', gap: 8 }, feedbackSuccess: { borderColor: '#B9DFC9', backgroundColor: '#F1FAF5' }, feedbackText: { flex: 1, color: colors.danger, fontSize: 10 }, feedbackSuccessText: { color: colors.success },
  editor: { padding: 18, borderRadius: 12, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: colors.white, gap: 14 }, editorHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, closeButton: { width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, field: { gap: 6 }, fieldHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, fieldLabel: { color: colors.ink, fontSize: 10, fontWeight: '800' }, counter: { color: colors.subtle, fontSize: 8 }, input: { width: '100%', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, color: colors.ink, fontSize: 11, lineHeight: 18 }, formError: { padding: 10, borderRadius: 8, backgroundColor: '#FFF7F7', flexDirection: 'row', gap: 7 }, formErrorText: { flex: 1, color: colors.danger, fontSize: 10 }, editorNote: { padding: 10, borderRadius: 8, backgroundColor: '#F1FAFC', flexDirection: 'row', alignItems: 'flex-start', gap: 7 }, editorNoteText: { flex: 1, color: colors.accent, fontSize: 9, lineHeight: 15 }, editorActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  filters: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 9 }, filterLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: .8, textTransform: 'uppercase', marginTop: 2 }, chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { minHeight: 34, paddingHorizontal: 11, borderRadius: 17, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, chipActive: { borderColor: colors.accent, backgroundColor: '#E1F4FA' }, chipText: { color: colors.muted, fontSize: 9, fontWeight: '700' }, chipTextActive: { color: colors.accent },
  detailPanel: { padding: 18, borderRadius: 12, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: colors.white, gap: 14 }, detailHeading: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center', gap: 10 }, detailHeadingCompact: { alignItems: 'flex-start', flexWrap: 'wrap' }, detailIcon: { width: 42, height: 42, borderRadius: 9, backgroundColor: '#E1F4FA', alignItems: 'center', justifyContent: 'center' }, detailCopy: { flex: 1, minWidth: 180 }, panelEyebrow: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 }, detailQuestion: { color: colors.ink, fontSize: 16, lineHeight: 23, fontWeight: '800', marginTop: 3 }, detailMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, metaItem: { minWidth: 120, flex: 1, padding: 10, borderRadius: 8, backgroundColor: colors.bg }, metaLabel: { color: colors.muted, fontSize: 8, textTransform: 'uppercase' }, metaValue: { color: colors.ink, fontSize: 10, fontWeight: '800', marginTop: 3 }, answerBox: { padding: 13, borderRadius: 8, borderWidth: 1, borderColor: colors.line }, answerLabel: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: .7 }, answerText: { color: colors.ink, fontSize: 11, lineHeight: 19, marginTop: 8 }, keywordBox: { padding: 11, borderRadius: 8, backgroundColor: colors.bg }, keywordText: { color: colors.ink, fontSize: 10, lineHeight: 17, marginTop: 5 }, contextNote: { padding: 10, borderRadius: 8, backgroundColor: '#F1FAFC', flexDirection: 'row', gap: 7 }, contextText: { flex: 1, color: colors.accent, fontSize: 9, lineHeight: 15 }, reviewMeta: { color: colors.muted, fontSize: 9, lineHeight: 15 }, detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  listPanel: { padding: 18, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 12 }, listHeading: { flexDirection: 'row', alignItems: 'center' }, panelTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 2 }, resultMeta: { marginLeft: 'auto', color: colors.muted, fontSize: 10 },
  tableScroll: { minWidth: 1260 }, table: { minWidth: 1260, flex: 1 }, tableRow: { minHeight: 112, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12 }, tableHead: { minHeight: 44, paddingVertical: 0, borderRadius: 7, borderBottomWidth: 0, backgroundColor: colors.bg, alignItems: 'center' }, headText: { paddingHorizontal: 7, color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: .4 }, qaColumn: { width: 440, paddingHorizontal: 7 }, classColumn: { width: 180, paddingHorizontal: 7 }, statusColumn: { width: 120, paddingHorizontal: 7 }, usageColumn: { width: 90, paddingHorizontal: 7 }, dateColumn: { width: 145, paddingHorizontal: 7 }, actionColumn: { width: 260, paddingHorizontal: 7, flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, questionText: { color: colors.ink, fontSize: 11, lineHeight: 17, fontWeight: '800' }, answerPreview: { color: colors.muted, fontSize: 9, lineHeight: 15, marginTop: 5 }, contextFlag: { color: colors.accent, fontSize: 8, fontWeight: '700', marginTop: 5 }, intentText: { color: colors.ink, fontSize: 9, fontWeight: '800', marginBottom: 6 }, sourceText: { color: colors.muted, fontSize: 8, marginTop: 6 }, cellText: { color: colors.ink, fontSize: 10 }, cellMuted: { color: colors.muted, fontSize: 9, lineHeight: 15 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 }, badgeText: { fontSize: 8, fontWeight: '800' }, pendingBadge: { backgroundColor: '#FFF3D6' }, pendingText: { color: '#986411' }, approvedBadge: { backgroundColor: '#E2F3EA' }, approvedText: { color: colors.success }, rejectedBadge: { backgroundColor: '#FBE5E5' }, rejectedText: { color: colors.danger }, riskBadge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.bg }, riskText: { color: colors.muted, fontSize: 8, fontWeight: '800' }, highRisk: { backgroundColor: '#FBE5E5' }, highRiskText: { color: colors.danger },
  actionButton: { minHeight: 36, paddingHorizontal: 9, borderRadius: 7, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: '#F1FAFC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }, actionText: { color: colors.accent, fontSize: 9, fontWeight: '800' }, dangerButton: { borderColor: '#F0CACA', backgroundColor: '#FFF7F7' }, dangerText: { color: colors.danger }, iconButton: { width: 34, height: 34, borderRadius: 7, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: '#F1FAFC', alignItems: 'center', justifyContent: 'center' }, dangerIcon: { borderColor: '#F0CACA', backgroundColor: '#FFF7F7' },
  cardList: { gap: 10 }, card: { padding: 13, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 9 }, cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, cardId: { color: colors.accent, fontSize: 9, fontWeight: '800' }, cardQuestion: { color: colors.ink, fontSize: 12, lineHeight: 18, fontWeight: '800' }, cardAnswer: { color: colors.muted, fontSize: 10, lineHeight: 17 }, cardMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 }, cardIntent: { color: colors.ink, fontSize: 8, fontWeight: '700' }, cardUses: { color: colors.muted, fontSize: 8 }, cardActions: { paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.lineSoft, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pagination: { paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, pageMeta: { color: colors.muted, fontSize: 9 }, pageActions: { flexDirection: 'row', gap: 7 }, pageButton: { minHeight: 36, paddingHorizontal: 10, borderRadius: 7, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 4 }, pageButtonText: { color: colors.ink, fontSize: 9, fontWeight: '800' },
  state: { minHeight: 260, padding: 25, alignItems: 'center', justifyContent: 'center', gap: 9 }, stateTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', textAlign: 'center' }, stateText: { maxWidth: 440, color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'center' }, retryButton: { minHeight: 38, marginTop: 3, paddingHorizontal: 13, borderRadius: 7, borderWidth: 1, borderColor: colors.accent, justifyContent: 'center' }, retryText: { color: colors.accent, fontSize: 10, fontWeight: '800' }, gate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.header }, gateText: { color: colors.onDark, fontSize: 11, fontWeight: '700' },
}));
