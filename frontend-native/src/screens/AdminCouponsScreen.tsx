import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputProps, useWindowDimensions, View } from 'react-native';
import { adminCouponPageCount, couponDateInput, couponPayload, couponValidationErrors, filterAdminCoupons } from '../adminCoupons.mjs';
import { adminApi, couponApi, formatVnd } from '../api';
import { AdminLayout } from '../components/admin/AdminLayout';
import { useStore } from '../store';
import { colors } from '../theme';
import { withTypography } from '../typography';
import type { AdminUser, Coupon, CouponDiscountType, CouponInput } from '../types';

const PAGE_SIZE = 12;

type CouponForm = {
  code: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: string;
  minOrderAmount: string;
  maxDiscountAmount: string;
  usageLimit: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  userId: string;
  freeShipping: boolean;
};

type CouponField = 'code' | 'discountValue' | 'minOrderAmount' | 'maxDiscountAmount' | 'usageLimit' | 'startDate' | 'endDate' | 'userId';
type CouponErrors = Partial<Record<CouponField, string>>;
type TypeFilter = '' | CouponDiscountType;
type ActiveFilter = '' | 'active' | 'inactive';

function emptyCouponForm(): CouponForm {
  const now = new Date();
  const end = new Date(now.getTime() + 30 * 86400000);
  return { code: '', description: '', discountType: 'percentage', discountValue: '10', minOrderAmount: '0', maxDiscountAmount: '', usageLimit: '1', startDate: couponDateInput(now), endDate: couponDateInput(end), isActive: true, userId: '', freeShipping: false };
}

export default function AdminCouponsScreen() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 760;
  const { authReady, user, logout } = useStore();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usersError, setUsersError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyCouponForm);
  const [fieldErrors, setFieldErrors] = useState<CouponErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const isAdmin = authReady && user?.role === 'ADMIN';

  const load = useCallback(async (signal?: AbortSignal) => {
    if (user?.role !== 'ADMIN') return;
    setLoading(true);
    setError('');
    setUsersError('');
    const [couponResult, userResult] = await Promise.allSettled([couponApi.adminList(signal), adminApi.users(signal)]);
    if (signal?.aborted) return;
    if (couponResult.status === 'fulfilled') setCoupons(couponResult.value);
    else setError(couponResult.reason instanceof Error ? couponResult.reason.message : 'Không thể tải danh sách mã giảm giá.');
    if (userResult.status === 'fulfilled') setUsers(userResult.value.filter(item => item.role === 'USER'));
    else { setUsers([]); setUsersError('Không thể tải danh sách khách hàng. Bạn vẫn có thể tạo mã dùng chung.'); }
    setLoading(false);
  }, [user?.role]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) router.replace({ pathname: '/login', params: { redirect: '/admin/coupons' } });
    else if (user.role !== 'ADMIN') router.replace('/');
  }, [authReady, router, user]);

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [isAdmin, load]);

  const filteredCoupons = useMemo<Coupon[]>(() => filterAdminCoupons(coupons, { keyword, discountType: typeFilter, active: activeFilter }), [activeFilter, coupons, keyword, typeFilter]);
  const pageCount = adminCouponPageCount(filteredCoupons.length, PAGE_SIZE);
  const visibleCoupons = useMemo(() => filteredCoupons.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredCoupons, page]);
  const userEmails = useMemo(() => new Map(users.map(item => [item.id, item.email])), [users]);

  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  if (!isAdmin || !user) return <AdminGateState />;

  const signOut = () => { void logout().finally(() => router.replace('/login')); };
  const resetForm = () => { setEditingId(null); setForm(emptyCouponForm()); setFieldErrors({}); setFormError(''); };
  const closeForm = () => { resetForm(); setShowForm(false); };
  const openCreate = () => { resetForm(); setMessage(''); setShowForm(true); };
  const openEdit = (coupon: Coupon) => {
    setEditingId(coupon.id);
    setForm({ code: coupon.code, description: coupon.description || '', discountType: coupon.discountType, discountValue: String(coupon.discountValue), minOrderAmount: String(coupon.minOrderAmount), maxDiscountAmount: coupon.maxDiscountAmount === null ? '' : String(coupon.maxDiscountAmount), usageLimit: coupon.usageLimit === null ? '' : String(coupon.usageLimit), startDate: couponDateInput(coupon.startDate), endDate: couponDateInput(coupon.endDate), isActive: coupon.isActive, userId: coupon.userId === null ? '' : String(coupon.userId), freeShipping: coupon.freeShipping });
    setFieldErrors({});
    setFormError('');
    setMessage('');
    setShowForm(true);
  };

  const setFormValue = <Key extends keyof CouponForm>(key: Key, value: CouponForm[Key]) => {
    setForm(current => ({ ...current, [key]: value }));
    setFieldErrors(current => ({ ...current, [key]: undefined, ...(key === 'discountType' ? { discountValue: undefined, maxDiscountAmount: undefined } : {}), ...(key === 'startDate' ? { startDate: undefined, endDate: undefined } : {}) }));
    setFormError('');
  };

  const saveCoupon = async () => {
    if (saving) return;
    const errors = couponValidationErrors(form) as CouponErrors;
    setFieldErrors(errors);
    if (Object.keys(errors).length) { setFormError('Vui lòng kiểm tra lại các trường chưa hợp lệ.'); return; }
    setSaving(true);
    setFormError('');
    setMessage('');
    try {
      const payload = couponPayload(form) as CouponInput;
      if (editingId) await couponApi.update(editingId, payload);
      else await couponApi.create(payload);
      setMessage(editingId ? 'Đã cập nhật mã giảm giá.' : 'Đã tạo mã giảm giá.');
      closeForm();
      setPage(1);
      await load();
    } catch (failure) {
      setFormError(failure instanceof Error ? failure.message : 'Không thể lưu mã giảm giá.');
    } finally {
      setSaving(false);
    }
  };

  const removeCoupon = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setError('');
    setMessage('');
    try {
      await couponApi.remove(deleteTarget.id);
      setMessage(`Đã xóa mã ${deleteTarget.code}.`);
      if (editingId === deleteTarget.id) closeForm();
      setDeleteTarget(null);
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Không thể xóa mã giảm giá.');
    } finally {
      setDeleting(false);
    }
  };

  const resetFilters = () => { setKeyword(''); setTypeFilter(''); setActiveFilter(''); setPage(1); };

  return <AdminLayout user={user} onLogout={signOut}>
    <StatusBar style="light" />
    <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={[styles.content, compact && styles.contentCompact]}>
      <View style={[styles.pageHeading, compact && styles.pageHeadingCompact]}><View style={styles.headingCopy}><Text style={styles.eyebrow}>COUPON MANAGEMENT</Text><Text style={[styles.title, compact && styles.titleCompact]}>Quản lý mã giảm giá</Text><Text style={styles.subtitle}>Tạo và quản lý coupon theo đúng dữ liệu được Backend sử dụng trong Checkout.</Text></View><Pressable accessibilityRole="button" onPress={showForm ? closeForm : openCreate} style={[styles.primaryButton, showForm && styles.secondaryButton]}><Ionicons name={showForm ? 'close' : 'add'} size={18} color={showForm ? colors.ink : colors.white} /><Text style={[styles.primaryButtonText, showForm && styles.secondaryButtonText]}>{showForm ? 'Đóng biểu mẫu' : 'Thêm mã giảm giá'}</Text></Pressable></View>

      {showForm ? <CouponFormPanel compact={compact} form={form} errors={fieldErrors} editing={editingId !== null} users={users} usersError={usersError} busy={saving} error={formError} onChange={setFormValue} onCancel={closeForm} onSave={() => void saveCoupon()} /> : null}
      {message ? <View style={styles.successBanner}><Ionicons name="checkmark-circle-outline" size={18} color={colors.success} /><Text style={styles.successText}>{message}</Text></View> : null}
      {error && coupons.length ? <View style={styles.errorBanner}><Ionicons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()}><Text style={styles.retryText}>Thử lại</Text></Pressable></View> : null}

      <View style={styles.filterPanel}><View style={[styles.searchRow, compact && styles.searchRowCompact]}><View style={styles.searchBox}><Ionicons name="search" size={18} color={colors.subtle} /><TextInput accessibilityLabel="Tìm mã giảm giá" value={keyword} onChangeText={value => { setKeyword(value); setPage(1); }} placeholder="Tìm theo mã hoặc mô tả..." placeholderTextColor={colors.subtle} style={styles.searchInput} /></View><Pressable accessibilityRole="button" disabled={loading} onPress={() => void load()} style={[styles.outlineButton, loading && styles.disabled]}>{loading ? <ActivityIndicator size="small" color={colors.accent} /> : <Ionicons name="refresh" size={17} color={colors.accent} />}<Text style={styles.outlineButtonText}>Làm mới</Text></Pressable><Pressable accessibilityRole="button" onPress={resetFilters} style={styles.resetButton}><Text style={styles.resetText}>Xóa lọc</Text></Pressable></View><FilterGroup label="Loại giảm"><FilterChip label="Tất cả" active={!typeFilter} onPress={() => { setTypeFilter(''); setPage(1); }} /><FilterChip label="Phần trăm" active={typeFilter === 'percentage'} onPress={() => { setTypeFilter('percentage'); setPage(1); }} /><FilterChip label="Số tiền" active={typeFilter === 'fixed'} onPress={() => { setTypeFilter('fixed'); setPage(1); }} /></FilterGroup><FilterGroup label="Trạng thái bật/tắt"><FilterChip label="Tất cả" active={!activeFilter} onPress={() => { setActiveFilter(''); setPage(1); }} /><FilterChip label="Đang bật" active={activeFilter === 'active'} onPress={() => { setActiveFilter('active'); setPage(1); }} /><FilterChip label="Đã tắt" active={activeFilter === 'inactive'} onPress={() => { setActiveFilter('inactive'); setPage(1); }} /></FilterGroup></View>

      {deleteTarget ? <View style={[styles.confirmBox, compact && styles.confirmBoxCompact]}><View style={styles.confirmIcon}><Ionicons name="warning-outline" size={22} color={colors.danger} /></View><View style={styles.confirmCopy}><Text style={styles.confirmTitle}>Xóa mã “{deleteTarget.code}”?</Text><Text style={styles.confirmText}>Mã đã dùng {deleteTarget.usedCount} lượt. Thao tác xóa dữ liệu là không thể hoàn tác.</Text></View><View style={styles.confirmActions}><Pressable accessibilityRole="button" disabled={deleting} onPress={() => setDeleteTarget(null)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Quay lại</Text></Pressable><Pressable accessibilityRole="button" disabled={deleting} onPress={() => void removeCoupon()} style={[styles.deleteButton, deleting && styles.disabled]}>{deleting ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="trash-outline" size={17} color={colors.white} />}<Text style={styles.deleteButtonText}>Xác nhận xóa</Text></Pressable></View></View> : null}

      <View style={styles.listPanel}><View style={styles.listHeading}><View><Text style={styles.panelEyebrow}>COUPONS</Text><Text style={styles.panelTitle}>{filteredCoupons.length} mã giảm giá</Text></View><Text style={styles.resultMeta}>{coupons.length === filteredCoupons.length ? 'Toàn bộ dữ liệu' : `${coupons.length} mã trong hệ thống`}</Text></View>{loading ? <StatePanel loading title="Đang tải mã giảm giá" message="Hệ thống đang lấy dữ liệu coupon." /> : error && !coupons.length ? <StatePanel icon="cloud-offline-outline" title="Không thể tải coupon" message={error} action="Thử lại" onPress={() => void load()} /> : !visibleCoupons.length ? <StatePanel icon="ticket-outline" title="Không có mã giảm giá" message={coupons.length ? 'Không có coupon phù hợp với bộ lọc.' : 'Chưa có mã giảm giá nào trong hệ thống.'} /> : compact ? <View style={styles.cardList}>{visibleCoupons.map(coupon => <CouponCard key={coupon.id} coupon={coupon} recipient={recipientLabel(coupon, userEmails)} onEdit={() => openEdit(coupon)} onDelete={() => setDeleteTarget(coupon)} />)}</View> : <CouponTable coupons={visibleCoupons} userEmails={userEmails} onEdit={openEdit} onDelete={setDeleteTarget} />}{!loading && !error && filteredCoupons.length > 0 ? <View style={[styles.pagination, compact && styles.paginationCompact]}><Text style={styles.pageMeta}>Trang {page}/{pageCount} · {filteredCoupons.length} kết quả</Text><View style={styles.pageActions}><Pressable accessibilityRole="button" disabled={page <= 1} onPress={() => setPage(value => Math.max(1, value - 1))} style={[styles.pageButton, page <= 1 && styles.disabled]}><Ionicons name="chevron-back" size={17} color={colors.ink} /><Text style={styles.pageButtonText}>Trước</Text></Pressable><Pressable accessibilityRole="button" disabled={page >= pageCount} onPress={() => setPage(value => Math.min(pageCount, value + 1))} style={[styles.pageButton, page >= pageCount && styles.disabled]}><Text style={styles.pageButtonText}>Sau</Text><Ionicons name="chevron-forward" size={17} color={colors.ink} /></Pressable></View></View> : null}</View>
    </ScrollView>
  </AdminLayout>;
}

function CouponFormPanel({ compact, form, errors, editing, users, usersError, busy, error, onChange, onCancel, onSave }: { compact: boolean; form: CouponForm; errors: CouponErrors; editing: boolean; users: AdminUser[]; usersError: string; busy: boolean; error: string; onChange: <Key extends keyof CouponForm>(key: Key, value: CouponForm[Key]) => void; onCancel: () => void; onSave: () => void }) {
  return <View style={styles.formPanel}><View style={styles.formHeading}><View><Text style={styles.panelEyebrow}>{editing ? 'EDIT COUPON' : 'NEW COUPON'}</Text><Text style={styles.formTitle}>{editing ? 'Chỉnh sửa mã giảm giá' : 'Tạo mã giảm giá'}</Text></View><View style={styles.formIcon}><Ionicons name={editing ? 'create-outline' : 'ticket-outline'} size={21} color={colors.accent} /></View></View><View style={styles.formGrid}><FormField compact={compact} required label="Mã coupon" value={form.code} error={errors.code} autoCapitalize="characters" maxLength={50} onChangeText={value => onChange('code', value)} /><View style={[styles.field, !compact && styles.fieldHalf]}><Text style={styles.inputLabel}>Loại giảm <Text style={styles.required}>*</Text></Text><View style={styles.segmentRow}><FilterChip label="Phần trăm" active={form.discountType === 'percentage'} onPress={() => onChange('discountType', 'percentage')} /><FilterChip label="Số tiền" active={form.discountType === 'fixed'} onPress={() => onChange('discountType', 'fixed')} /></View></View><FormField compact={compact} required label={form.discountType === 'percentage' ? 'Giá trị giảm (%)' : 'Giá trị giảm (đ)'} value={form.discountValue} error={errors.discountValue} keyboardType="decimal-pad" onChangeText={value => onChange('discountValue', value)} /><FormField compact={compact} required label="Đơn hàng tối thiểu (đ)" value={form.minOrderAmount} error={errors.minOrderAmount} keyboardType="decimal-pad" onChangeText={value => onChange('minOrderAmount', value)} /><FormField compact={compact} label="Giảm tối đa (đ)" value={form.maxDiscountAmount} error={errors.maxDiscountAmount} keyboardType="decimal-pad" placeholder="Không giới hạn" onChangeText={value => onChange('maxDiscountAmount', value)} /><FormField compact={compact} label="Giới hạn lượt dùng" value={form.usageLimit} error={errors.usageLimit} keyboardType="number-pad" placeholder="Không giới hạn" onChangeText={value => onChange('usageLimit', value)} /><FormField compact={compact} required label="Ngày bắt đầu" value={form.startDate} error={errors.startDate} maxLength={10} placeholder="YYYY-MM-DD" onChangeText={value => onChange('startDate', value)} /><FormField compact={compact} required label="Ngày hết hạn" value={form.endDate} error={errors.endDate} maxLength={10} placeholder="YYYY-MM-DD" onChangeText={value => onChange('endDate', value)} /></View><FormField label="Mô tả" value={form.description} multiline onChangeText={value => onChange('description', value)} /><View style={styles.recipientBox}><Text style={styles.inputLabel}>Tài khoản nhận coupon</Text><Text style={styles.inputHint}>Chọn “Dùng chung” hoặc một khách hàng cụ thể.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recipientRow}><FilterChip label="Dùng chung" active={!form.userId} onPress={() => onChange('userId', '')} />{users.map(item => <FilterChip key={item.id} label={`${item.fullName} · ${item.email}`} active={form.userId === String(item.id)} onPress={() => onChange('userId', String(item.id))} />)}</ScrollView>{errors.userId ? <Text style={styles.fieldError}>{errors.userId}</Text> : null}{usersError ? <Text style={styles.usersError}>{usersError}</Text> : null}</View><View style={styles.toggleRow}><Toggle checked={form.isActive} label="Bật mã giảm giá" onPress={() => onChange('isActive', !form.isActive)} /><Toggle checked={form.freeShipping} label="Miễn phí vận chuyển" onPress={() => onChange('freeShipping', !form.freeShipping)} /></View>{error ? <View style={styles.formError}><Ionicons name="alert-circle-outline" size={17} color={colors.danger} /><Text style={styles.formErrorText}>{error}</Text></View> : null}<View style={styles.formActions}><Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Hủy</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={onSave} style={[styles.primaryButton, busy && styles.disabled]}>{busy ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="save-outline" size={17} color={colors.white} />}<Text style={styles.primaryButtonText}>{busy ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo mã'}</Text></Pressable></View></View>;
}

function FormField({ label, required = false, error, compact = true, multiline = false, style, ...props }: TextInputProps & { label: string; required?: boolean; error?: string; compact?: boolean }) {
  return <View style={[styles.field, !compact && styles.fieldHalf, style]}><Text style={styles.inputLabel}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text><TextInput placeholderTextColor={colors.subtle} multiline={multiline} style={[styles.input, multiline && styles.textarea, error && styles.inputError]} {...props} />{error ? <Text style={styles.fieldError}>{error}</Text> : null}</View>;
}

function Toggle({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={styles.toggle}><Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? colors.accent : colors.subtle} /><Text style={styles.toggleText}>{label}</Text></Pressable>;
}

function CouponTable({ coupons, userEmails, onEdit, onDelete }: { coupons: Coupon[]; userEmails: Map<number, string>; onEdit: (coupon: Coupon) => void; onDelete: (coupon: Coupon) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScroll}><View style={styles.table}><View style={[styles.tableRow, styles.tableHead]}><Text style={[styles.tableHeadText, styles.codeColumn]}>Mã</Text><Text style={[styles.tableHeadText, styles.offerColumn]}>Ưu đãi</Text><Text style={[styles.tableHeadText, styles.conditionColumn]}>Điều kiện</Text><Text style={[styles.tableHeadText, styles.recipientColumn]}>Người nhận</Text><Text style={[styles.tableHeadText, styles.usageColumn]}>Lượt dùng</Text><Text style={[styles.tableHeadText, styles.periodColumn]}>Thời hạn</Text><Text style={[styles.tableHeadText, styles.statusColumn]}>Trạng thái</Text><Text style={[styles.tableHeadText, styles.actionColumn]}>Thao tác</Text></View>{coupons.map(coupon => <View key={coupon.id} style={styles.tableRow}><View style={styles.codeColumn}><Text style={styles.codeText}>{coupon.code}</Text><Text numberOfLines={2} style={styles.cellMuted}>{coupon.description || 'Không có mô tả'}</Text></View><View style={styles.offerColumn}><Text style={styles.offerText}>{couponOffer(coupon)}</Text>{coupon.freeShipping ? <Text style={styles.freeShip}>Miễn phí vận chuyển</Text> : null}</View><View style={styles.conditionColumn}><Text style={styles.cellText}>Đơn từ {formatVnd(Number(coupon.minOrderAmount) || 0)}</Text>{coupon.maxDiscountAmount !== null ? <Text style={styles.cellMuted}>Tối đa {formatVnd(Number(coupon.maxDiscountAmount) || 0)}</Text> : null}</View><Text numberOfLines={2} style={[styles.cellText, styles.recipientColumn]}>{recipientLabel(coupon, userEmails)}</Text><Text style={[styles.cellText, styles.usageColumn]}>{coupon.usedCount}/{coupon.usageLimit ?? '∞'}</Text><View style={styles.periodColumn}><Text style={styles.cellText}>{formatDate(coupon.startDate)}</Text><Text style={styles.cellMuted}>đến {formatDate(coupon.endDate)}</Text></View><View style={styles.statusColumn}><ActiveBadge active={coupon.isActive} /></View><View style={[styles.actionColumn, styles.rowActions]}><Pressable accessibilityRole="button" accessibilityLabel={`Sửa ${coupon.code}`} onPress={() => onEdit(coupon)} style={styles.editButton}><Ionicons name="create-outline" size={17} color={colors.accent} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Xóa ${coupon.code}`} onPress={() => onDelete(coupon)} style={styles.removeButton}><Ionicons name="trash-outline" size={17} color={colors.danger} /></Pressable></View></View>)}</View></ScrollView>;
}

function CouponCard({ coupon, recipient, onEdit, onDelete }: { coupon: Coupon; recipient: string; onEdit: () => void; onDelete: () => void }) {
  return <View style={styles.couponCard}><View style={styles.cardTop}><View style={styles.ticketIcon}><Ionicons name="ticket-outline" size={22} color={colors.accent} /></View><View style={styles.cardCopy}><Text style={styles.cardCode}>{coupon.code}</Text><Text numberOfLines={2} style={styles.cardDescription}>{coupon.description || 'Không có mô tả'}</Text></View><ActiveBadge active={coupon.isActive} /></View><View style={styles.cardOffer}><Text style={styles.cardOfferValue}>{couponOffer(coupon)}</Text>{coupon.freeShipping ? <Text style={styles.freeShip}>+ Miễn phí vận chuyển</Text> : null}</View><View style={styles.cardFacts}><Fact label="Đơn tối thiểu" value={formatVnd(Number(coupon.minOrderAmount) || 0)} /><Fact label="Lượt dùng" value={`${coupon.usedCount}/${coupon.usageLimit ?? '∞'}`} /><Fact label="Hết hạn" value={formatDate(coupon.endDate)} /></View><Text numberOfLines={2} style={styles.recipientText}>Người nhận: {recipient}</Text><View style={styles.cardActions}><Pressable accessibilityRole="button" onPress={onEdit} style={styles.cardEditButton}><Ionicons name="create-outline" size={17} color={colors.accent} /><Text style={styles.cardEditText}>Chỉnh sửa</Text></Pressable><Pressable accessibilityRole="button" onPress={onDelete} style={styles.cardRemoveButton}><Ionicons name="trash-outline" size={17} color={colors.danger} /><Text style={styles.cardRemoveText}>Xóa</Text></Pressable></View></View>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text numberOfLines={1} style={styles.factValue}>{value}</Text></View>;
}

function ActiveBadge({ active }: { active: boolean }) {
  return <View style={[styles.activeBadge, !active && styles.inactiveBadge]}><Text style={[styles.activeText, !active && styles.inactiveText]}>{active ? 'Đang bật' : 'Đã tắt'}</Text></View>;
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.filterGroup}><Text style={styles.filterLabel}>{label}</Text><View style={styles.chipRow}>{children}</View></View>;
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text numberOfLines={1} style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function StatePanel({ loading = false, icon = 'ticket-outline', title, message, action, onPress }: { loading?: boolean; icon?: ComponentProps<typeof Ionicons>['name']; title: string; message: string; action?: string; onPress?: () => void }) {
  return <View style={styles.statePanel}>{loading ? <ActivityIndicator size="large" color={colors.accent} /> : <Ionicons name={icon} size={32} color={colors.subtle} />}<Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{message}</Text>{action && onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={styles.outlineButton}><Text style={styles.outlineButtonText}>{action}</Text></Pressable> : null}</View>;
}

function AdminGateState() {
  return <View style={styles.gate}><ActivityIndicator size="large" color={colors.accent} /><Text style={styles.gateText}>Đang xác minh quyền quản trị...</Text></View>;
}

function recipientLabel(coupon: Coupon, userEmails: Map<number, string>) {
  return coupon.userId === null ? 'Dùng chung' : userEmails.get(coupon.userId) || `User #${coupon.userId}`;
}

function couponOffer(coupon: Coupon) {
  return coupon.discountType === 'percentage' ? `${Number(coupon.discountValue)}%` : formatVnd(Number(coupon.discountValue) || 0);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Không rõ' : date.toLocaleDateString('vi-VN');
}

const styles = StyleSheet.create(withTypography({
  scroll: { flex: 1, backgroundColor: colors.bg }, content: { padding: 28, gap: 18, maxWidth: 1680, width: '100%', alignSelf: 'center' }, contentCompact: { padding: 14, gap: 14 },
  pageHeading: { flexDirection: 'row', alignItems: 'center', gap: 15 }, pageHeadingCompact: { alignItems: 'stretch', flexDirection: 'column' }, headingCopy: { flex: 1 }, eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: 5 }, titleCompact: { fontSize: 24 }, subtitle: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 5 },
  primaryButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, primaryButtonText: { color: colors.white, fontSize: 11, fontWeight: '800' }, secondaryButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }, secondaryButtonText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  formPanel: { padding: 19, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 14 }, formHeading: { flexDirection: 'row', alignItems: 'center' }, panelEyebrow: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 }, formTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', marginTop: 3 }, formIcon: { marginLeft: 'auto', width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E1F4FA' },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, field: { width: '100%', gap: 5 }, fieldHalf: { width: '48.8%' }, inputLabel: { color: colors.ink, fontSize: 10, fontWeight: '800' }, required: { color: colors.danger }, input: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 7, borderWidth: 1, borderColor: colors.line, color: colors.ink, fontSize: 12 }, textarea: { minHeight: 82, textAlignVertical: 'top' }, inputError: { borderColor: colors.danger }, fieldError: { color: colors.danger, fontSize: 9 }, inputHint: { color: colors.muted, fontSize: 9, marginTop: 3 }, segmentRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7 },
  recipientBox: { padding: 12, borderRadius: 8, backgroundColor: colors.bg, gap: 5 }, recipientRow: { gap: 7, paddingVertical: 3 }, usersError: { color: '#986411', fontSize: 9 }, toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, toggle: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7 }, toggleText: { color: colors.ink, fontSize: 11, fontWeight: '700' }, formError: { padding: 11, borderRadius: 7, backgroundColor: '#FBE5E5', flexDirection: 'row', alignItems: 'center', gap: 7 }, formErrorText: { flex: 1, color: colors.danger, fontSize: 10 }, formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  successBanner: { padding: 12, borderRadius: 8, backgroundColor: '#E2F3EA', borderWidth: 1, borderColor: '#C6E8D6', flexDirection: 'row', alignItems: 'center', gap: 7 }, successText: { color: colors.success, fontSize: 11, fontWeight: '700' }, errorBanner: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#F0CACA', backgroundColor: '#FFF7F7', flexDirection: 'row', alignItems: 'center', gap: 7 }, errorText: { flex: 1, color: colors.danger, fontSize: 10 }, retryText: { color: colors.danger, fontSize: 9, fontWeight: '800' },
  filterPanel: { padding: 17, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 10 }, searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, searchRowCompact: { alignItems: 'stretch', flexDirection: 'column' }, searchBox: { flex: 1, minHeight: 44, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center' }, searchInput: { flex: 1, minWidth: 0, paddingHorizontal: 9, color: colors.ink, fontSize: 12 }, outlineButton: { minHeight: 42, paddingHorizontal: 13, borderRadius: 7, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, outlineButtonText: { color: colors.accent, fontSize: 10, fontWeight: '800' }, resetButton: { minHeight: 42, paddingHorizontal: 13, borderRadius: 7, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, resetText: { color: colors.ink, fontSize: 10, fontWeight: '800' }, filterGroup: { gap: 5 }, filterLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }, chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { maxWidth: 260, minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }, chipActive: { borderColor: colors.accent, backgroundColor: '#E1F4FA' }, chipText: { color: colors.muted, fontSize: 9, fontWeight: '700' }, chipTextActive: { color: colors.accent },
  confirmBox: { padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#F0CACA', backgroundColor: '#FFF7F7', flexDirection: 'row', alignItems: 'center', gap: 12 }, confirmBoxCompact: { alignItems: 'stretch', flexDirection: 'column' }, confirmIcon: { width: 42, height: 42, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }, confirmCopy: { flex: 1 }, confirmTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' }, confirmText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 3 }, confirmActions: { flexDirection: 'row', gap: 8 }, deleteButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 7, backgroundColor: colors.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, deleteButtonText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  listPanel: { padding: 18, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 12 }, listHeading: { flexDirection: 'row', alignItems: 'center' }, panelTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 2 }, resultMeta: { marginLeft: 'auto', color: colors.muted, fontSize: 10 }, statePanel: { minHeight: 260, padding: 25, alignItems: 'center', justifyContent: 'center', gap: 9 }, stateTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', textAlign: 'center' }, stateText: { maxWidth: 440, color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  tableScroll: { minWidth: 1260 }, table: { minWidth: 1260, flex: 1 }, tableRow: { minHeight: 86, paddingHorizontal: 9, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center' }, tableHead: { minHeight: 46, borderRadius: 7, borderBottomWidth: 0, backgroundColor: colors.bg }, tableHeadText: { paddingHorizontal: 7, color: colors.muted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }, codeColumn: { width: 155, paddingHorizontal: 7 }, offerColumn: { width: 155, paddingHorizontal: 7 }, conditionColumn: { width: 175, paddingHorizontal: 7 }, recipientColumn: { width: 190, paddingHorizontal: 7 }, usageColumn: { width: 90, paddingHorizontal: 7 }, periodColumn: { width: 150, paddingHorizontal: 7 }, statusColumn: { width: 105, paddingHorizontal: 7 }, actionColumn: { width: 110, paddingHorizontal: 7 }, codeText: { color: colors.accent, fontSize: 11, fontWeight: '800' }, cellText: { color: colors.ink, fontSize: 10 }, cellMuted: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 }, offerText: { color: colors.ink, fontSize: 12, fontWeight: '800' }, freeShip: { color: colors.success, fontSize: 9, fontWeight: '700', marginTop: 3 }, rowActions: { flexDirection: 'row', gap: 6 }, editButton: { width: 38, height: 38, borderRadius: 7, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: '#F1FAFC', alignItems: 'center', justifyContent: 'center' }, removeButton: { width: 38, height: 38, borderRadius: 7, borderWidth: 1, borderColor: '#F0CACA', backgroundColor: '#FFF7F7', alignItems: 'center', justifyContent: 'center' }, activeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: '#E2F3EA' }, inactiveBadge: { backgroundColor: '#FBE5E5' }, activeText: { color: colors.success, fontSize: 9, fontWeight: '800' }, inactiveText: { color: colors.danger },
  cardList: { gap: 10 }, couponCard: { padding: 13, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 10 }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, ticketIcon: { width: 44, height: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E1F4FA' }, cardCopy: { flex: 1, minWidth: 0 }, cardCode: { color: colors.accent, fontSize: 14, fontWeight: '800' }, cardDescription: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 }, cardOffer: { padding: 10, borderRadius: 7, backgroundColor: colors.bg }, cardOfferValue: { color: colors.ink, fontSize: 18, fontWeight: '800' }, cardFacts: { flexDirection: 'row', gap: 7 }, fact: { flex: 1, minWidth: 0 }, factLabel: { color: colors.muted, fontSize: 8, fontWeight: '700', textTransform: 'uppercase' }, factValue: { color: colors.ink, fontSize: 9, fontWeight: '800', marginTop: 3 }, recipientText: { color: colors.muted, fontSize: 9 }, cardActions: { flexDirection: 'row', gap: 8 }, cardEditButton: { flex: 1, minHeight: 39, borderRadius: 7, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: '#F1FAFC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, cardEditText: { color: colors.accent, fontSize: 9, fontWeight: '800' }, cardRemoveButton: { flex: 1, minHeight: 39, borderRadius: 7, borderWidth: 1, borderColor: '#F0CACA', backgroundColor: '#FFF7F7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, cardRemoveText: { color: colors.danger, fontSize: 9, fontWeight: '800' },
  pagination: { paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center' }, paginationCompact: { alignItems: 'stretch', flexDirection: 'column', gap: 9 }, pageMeta: { flex: 1, color: colors.muted, fontSize: 10 }, pageActions: { flexDirection: 'row', gap: 7 }, pageButton: { minHeight: 38, paddingHorizontal: 11, borderRadius: 7, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }, pageButtonText: { color: colors.ink, fontSize: 10, fontWeight: '800' }, disabled: { opacity: 0.45 }, gate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 11, backgroundColor: colors.bg }, gateText: { color: colors.muted, fontSize: 12 },
}));
