import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputProps, useWindowDimensions, View } from 'react-native';
import { adminPromotionPageCount, filterAdminPromotions, promotionLocalTime, promotionPayload, promotionValidationErrors } from '../adminPromotions.mjs';
import { formatVnd, productApi, promotionApi } from '../api';
import { AdminLayout } from '../components/admin/AdminLayout';
import { OrderProductImage } from '../components/OrderProductImage';
import { useStore } from '../store';
import { colors } from '../theme';
import { withTypography } from '../typography';
import type { Product, PromotionEvent, PromotionInput } from '../types';

const EVENT_PAGE_SIZE = 8;
type PromotionPhase = '' | PromotionEvent['phase'];
type PromotionForm = { title: string; description: string; bannerDiscountPercent: string; startsAt: string; endsAt: string };
type PromotionErrors = Partial<Record<keyof PromotionForm | 'items', string>>;

const phaseLabels: Record<PromotionEvent['phase'], string> = { draft: 'Bản nháp', paused: 'Tạm dừng', scheduled: 'Đã lên lịch', active: 'Đang diễn ra', ended: 'Đã kết thúc' };

function initialForm(): PromotionForm {
  const now = new Date();
  return { title: '', description: '', bannerDiscountPercent: '', startsAt: promotionLocalTime(now.toISOString()), endsAt: promotionLocalTime(new Date(now.getTime() + 86400000).toISOString()) };
}

export default function AdminPromotionsScreen() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 760;
  const { authReady, user, logout } = useStore();
  const [events, setEvents] = useState<PromotionEvent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PromotionEvent | null>(null);
  const [form, setForm] = useState<PromotionForm>(initialForm);
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [productKeyword, setProductKeyword] = useState('');
  const [bulkDiscount, setBulkDiscount] = useState('20');
  const [fieldErrors, setFieldErrors] = useState<PromotionErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [eventKeyword, setEventKeyword] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<PromotionPhase>('');
  const [page, setPage] = useState(1);
  const isAdmin = authReady && user?.role === 'ADMIN';

  const load = useCallback(async (signal?: AbortSignal) => {
    if (user?.role !== 'ADMIN') return;
    setLoading(true);
    setError('');
    try {
      const [promotionResult, productResult] = await Promise.all([promotionApi.list(signal), productApi.list(undefined, undefined, signal)]);
      setEvents(promotionResult.events);
      setProducts(productResult);
    } catch (failure) {
      if ((failure as Error).name !== 'AbortError') setError(failure instanceof Error ? failure.message : 'Không thể tải dữ liệu khuyến mãi.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) router.replace({ pathname: '/login', params: { redirect: '/admin/promotions' } });
    else if (user.role !== 'ADMIN') router.replace('/');
  }, [authReady, router, user]);

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [isAdmin, load]);

  const selectedProducts = useMemo(() => products.filter(product => selected[product.id] !== undefined), [products, selected]);
  const normalizedProductKeyword = normalizeSearch(productKeyword);
  const foundProducts = useMemo(() => products.filter(product => normalizeSearch(`${product.name} ${product.brand || ''} ${product.category || ''}`).includes(normalizedProductKeyword)), [normalizedProductKeyword, products]);
  const filteredEvents = useMemo<PromotionEvent[]>(() => filterAdminPromotions(events, { keyword: eventKeyword, phase: phaseFilter }), [eventKeyword, events, phaseFilter]);
  const pageCount = adminPromotionPageCount(filteredEvents.length, EVENT_PAGE_SIZE);
  const visibleEvents = useMemo(() => filteredEvents.slice((page - 1) * EVENT_PAGE_SIZE, page * EVENT_PAGE_SIZE), [filteredEvents, page]);

  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  if (!isAdmin || !user) return <AdminGateState />;

  const signOut = () => { void logout().finally(() => router.replace('/login')); };
  const resetForm = () => { setEditing(null); setForm(initialForm()); setSelected({}); setProductKeyword(''); setBulkDiscount('20'); setFieldErrors({}); setFormError(''); };
  const closeForm = () => { resetForm(); setShowForm(false); };
  const openCreate = () => { resetForm(); setMessage(''); setShowForm(true); };
  const openEdit = (event: PromotionEvent) => {
    setEditing(event);
    setForm({ title: event.title, description: event.description, bannerDiscountPercent: event.bannerDiscountPercent == null ? '' : String(event.bannerDiscountPercent), startsAt: promotionLocalTime(event.startsAt), endsAt: promotionLocalTime(event.endsAt) });
    setSelected(Object.fromEntries(event.products.map(product => [product.id, Number(product.discountPercent) || 0])));
    setProductKeyword('');
    setFieldErrors({});
    setFormError('');
    setMessage('');
    setShowForm(true);
  };

  const setFormValue = <Key extends keyof PromotionForm>(key: Key, value: PromotionForm[Key]) => {
    setForm(current => ({ ...current, [key]: value }));
    setFieldErrors(current => ({ ...current, [key]: undefined, ...(key === 'startsAt' ? { endsAt: undefined } : {}) }));
    setFormError('');
  };

  const toggleProduct = (product: Product) => {
    if (saving) return;
    setSelected(current => {
      const next = { ...current };
      if (next[product.id] !== undefined) delete next[product.id];
      else if (Object.keys(next).length < 200) next[product.id] = validDiscount(bulkDiscount) ? Number(bulkDiscount) : 20;
      else setFormError('Mỗi sự kiện chỉ được chọn tối đa 200 sản phẩm.');
      return next;
    });
    setFieldErrors(current => ({ ...current, items: undefined }));
  };

  const setProductDiscount = (productId: number, value: string) => {
    setSelected(current => ({ ...current, [productId]: Number(value) }));
    setFieldErrors(current => ({ ...current, items: undefined }));
  };

  const applyBulk = () => {
    if (!validDiscount(bulkDiscount)) { setFormError('Mức giảm hàng loạt phải là số nguyên từ 1 đến 99%.'); return; }
    setSelected(current => Object.fromEntries(Object.keys(current).map(id => [id, Number(bulkDiscount)])));
    setFieldErrors(current => ({ ...current, items: undefined }));
    setFormError('');
  };

  const savePromotion = async (status: PromotionInput['status']) => {
    if (saving) return;
    const items = Object.entries(selected).map(([productId, discountPercent]) => ({ productId: Number(productId), discountPercent }));
    const errors = promotionValidationErrors(form, items, status) as PromotionErrors;
    setFieldErrors(errors);
    if (Object.keys(errors).length) { setFormError('Vui lòng kiểm tra thông tin sự kiện và sản phẩm tham gia.'); return; }
    setSaving(true);
    setFormError('');
    setMessage('');
    try {
      const payload = promotionPayload(form, items, status) as PromotionInput;
      if (editing) await promotionApi.update(editing.id, payload);
      else await promotionApi.create(payload);
      setMessage(status === 'draft' ? 'Đã lưu bản nháp.' : status === 'paused' ? 'Đã tạm dừng chương trình.' : 'Đã công bố hoặc lên lịch chương trình khuyến mãi.');
      closeForm();
      setPage(1);
      await load();
    } catch (failure) {
      setFormError(failure instanceof Error ? failure.message : 'Không thể lưu chương trình khuyến mãi.');
    } finally {
      setSaving(false);
    }
  };

  const resetFilters = () => { setEventKeyword(''); setPhaseFilter(''); setPage(1); };

  return <AdminLayout user={user} onLogout={signOut}>
    <StatusBar style="light" />
    <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={[styles.content, compact && styles.contentCompact]}>
      <View style={[styles.pageHeading, compact && styles.pageHeadingCompact]}><View style={styles.headingCopy}><Text style={styles.eyebrow}>PROMOTION EVENTS</Text><Text style={[styles.title, compact && styles.titleCompact]}>Quản lý khuyến mãi</Text><Text style={styles.subtitle}>Lập lịch ưu đãi sản phẩm; giá bán cuối cùng do Backend tính và xác nhận.</Text></View><Pressable accessibilityRole="button" onPress={showForm ? closeForm : openCreate} style={[styles.primaryButton, showForm && styles.secondaryButton]}><Ionicons name={showForm ? 'close' : 'add'} size={18} color={showForm ? colors.ink : colors.white} /><Text style={[styles.primaryButtonText, showForm && styles.secondaryButtonText]}>{showForm ? 'Đóng biểu mẫu' : 'Tạo chương trình'}</Text></Pressable></View>
      {message ? <View style={styles.successBanner}><Ionicons name="checkmark-circle-outline" size={18} color={colors.success} /><Text style={styles.successText}>{message}</Text></View> : null}
      {error && events.length ? <View style={styles.errorBanner}><Ionicons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()}><Text style={styles.retryText}>Thử lại</Text></Pressable></View> : null}

      {showForm ? <View style={styles.formPanel}><View style={styles.formHeading}><View><Text style={styles.panelEyebrow}>{editing ? `EDIT EVENT #${editing.id}` : 'NEW EVENT'}</Text><Text style={styles.formTitle}>{editing ? 'Chỉnh sửa chương trình' : 'Tạo chương trình khuyến mãi'}</Text></View>{editing ? <PhaseBadge phase={editing.phase} /> : <View style={styles.formIcon}><Ionicons name="flash-outline" size={21} color={colors.accent} /></View>}</View><View style={styles.formGrid}><FormField compact={compact} required label="Tên chương trình" value={form.title} error={fieldErrors.title} maxLength={120} onChangeText={value => setFormValue('title', value)} /><FormField compact={compact} label="Giảm đến trên banner (%)" value={form.bannerDiscountPercent} error={fieldErrors.bannerDiscountPercent} keyboardType="number-pad" placeholder="Tự động theo sản phẩm" onChangeText={value => setFormValue('bannerDiscountPercent', value)} /><FormField compact={compact} required label="Bắt đầu — giờ Việt Nam" value={form.startsAt} error={fieldErrors.startsAt} maxLength={16} placeholder="YYYY-MM-DDTHH:mm" onChangeText={value => setFormValue('startsAt', value)} /><FormField compact={compact} required label="Kết thúc — giờ Việt Nam" value={form.endsAt} error={fieldErrors.endsAt} maxLength={16} placeholder="YYYY-MM-DDTHH:mm" onChangeText={value => setFormValue('endsAt', value)} /></View><FormField label="Mô tả" value={form.description} error={fieldErrors.description} maxLength={300} multiline onChangeText={value => setFormValue('description', value)} />

        <View style={styles.productSection}><View style={styles.sectionHeading}><View><Text style={styles.sectionStep}>SẢN PHẨM THAM GIA</Text><Text style={styles.sectionTitle}>{selectedProducts.length}/200 sản phẩm đã chọn</Text></View><View style={styles.bulkBox}><TextInput accessibilityLabel="Mức giảm hàng loạt" value={bulkDiscount} onChangeText={setBulkDiscount} keyboardType="number-pad" maxLength={2} style={styles.bulkInput} /><Text style={styles.percentText}>%</Text><Pressable accessibilityRole="button" disabled={!selectedProducts.length || saving} onPress={applyBulk} style={[styles.bulkButton, (!selectedProducts.length || saving) && styles.disabled]}><Text style={styles.bulkButtonText}>Áp dụng</Text></Pressable></View></View><View style={styles.productSearch}><Ionicons name="search" size={18} color={colors.subtle} /><TextInput accessibilityLabel="Tìm sản phẩm tham gia" value={productKeyword} onChangeText={setProductKeyword} placeholder="Tên, thương hiệu hoặc danh mục..." placeholderTextColor={colors.subtle} style={styles.productSearchInput} /></View><View style={styles.catalog}>{loading ? <ActivityIndicator color={colors.accent} /> : foundProducts.length ? foundProducts.map(product => <ProductChoice key={product.id} product={product} checked={selected[product.id] !== undefined} disabled={saving || (selectedProducts.length >= 200 && selected[product.id] === undefined)} onPress={() => toggleProduct(product)} />) : <Text style={styles.catalogEmpty}>Không tìm thấy sản phẩm phù hợp.</Text>}</View>{fieldErrors.items ? <Text style={styles.fieldError}>{fieldErrors.items}</Text> : null}

          {selectedProducts.length ? <View style={styles.selectedList}><Text style={styles.selectedTitle}>Mức giảm từng sản phẩm</Text>{selectedProducts.map(product => <View key={product.id} style={[styles.selectedRow, compact && styles.selectedRowCompact]}><OrderProductImage uri={product.imageUrl} style={styles.selectedImage} /><View style={styles.selectedCopy}><Text numberOfLines={2} style={styles.selectedName}>{product.name}</Text><Text style={styles.selectedMeta}>{formatVnd(Number(product.originalPrice ?? product.price) || 0)} · Tồn {product.stock}</Text></View><View style={styles.discountInputBox}><TextInput accessibilityLabel={`Phần trăm giảm ${product.name}`} value={Number.isFinite(selected[product.id]) ? String(selected[product.id]) : ''} onChangeText={value => setProductDiscount(product.id, value)} keyboardType="number-pad" maxLength={2} style={styles.discountInput} /><Text style={styles.percentText}>%</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Bỏ chọn ${product.name}`} disabled={saving} onPress={() => toggleProduct(product)} style={styles.removeProduct}><Ionicons name="close" size={18} color={colors.danger} /></Pressable></View>)}</View> : null}
        </View>

        {formError ? <View style={styles.formError}><Ionicons name="alert-circle-outline" size={17} color={colors.danger} /><Text style={styles.formErrorText}>{formError}</Text></View> : null}<View style={[styles.formActions, compact && styles.formActionsCompact]}><Pressable accessibilityRole="button" disabled={saving || loading} onPress={() => void savePromotion('draft')} style={[styles.secondaryButton, (saving || loading) && styles.disabled]}><Ionicons name="save-outline" size={17} color={colors.ink} /><Text style={styles.secondaryButtonText}>Lưu nháp</Text></Pressable>{editing?.status === 'published' ? <Pressable accessibilityRole="button" disabled={saving} onPress={() => void savePromotion('paused')} style={[styles.pauseButton, saving && styles.disabled]}><Ionicons name="pause-outline" size={17} color="#986411" /><Text style={styles.pauseText}>Tạm dừng</Text></Pressable> : null}<Pressable accessibilityRole="button" disabled={saving || loading} onPress={() => void savePromotion('published')} style={[styles.primaryButton, (saving || loading) && styles.disabled]}>{saving ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="flash-outline" size={17} color={colors.white} />}<Text style={styles.primaryButtonText}>{editing?.status === 'paused' ? 'Công bố lại' : 'Công bố / lên lịch'}</Text></Pressable></View></View> : null}

      <View style={styles.filterPanel}><View style={[styles.searchRow, compact && styles.searchRowCompact]}><View style={styles.searchBox}><Ionicons name="search" size={18} color={colors.subtle} /><TextInput accessibilityLabel="Tìm chương trình" value={eventKeyword} onChangeText={value => { setEventKeyword(value); setPage(1); }} placeholder="Tìm tên hoặc mô tả chương trình..." placeholderTextColor={colors.subtle} style={styles.searchInput} /></View><Pressable accessibilityRole="button" disabled={loading} onPress={() => void load()} style={[styles.outlineButton, loading && styles.disabled]}>{loading ? <ActivityIndicator size="small" color={colors.accent} /> : <Ionicons name="refresh" size={17} color={colors.accent} />}<Text style={styles.outlineButtonText}>Làm mới</Text></Pressable><Pressable accessibilityRole="button" onPress={resetFilters} style={styles.resetButton}><Text style={styles.resetText}>Xóa lọc</Text></Pressable></View><Text style={styles.filterLabel}>Giai đoạn</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}><FilterChip label="Tất cả" active={!phaseFilter} onPress={() => { setPhaseFilter(''); setPage(1); }} />{(['draft', 'paused', 'scheduled', 'active', 'ended'] as const).map(phase => <FilterChip key={phase} label={phaseLabels[phase]} active={phaseFilter === phase} onPress={() => { setPhaseFilter(phase); setPage(1); }} />)}</ScrollView></View>

      <View style={styles.listPanel}><View style={styles.listHeading}><View><Text style={styles.panelEyebrow}>EVENT SCHEDULE</Text><Text style={styles.panelTitle}>{filteredEvents.length} chương trình</Text></View><Text style={styles.resultMeta}>{events.length === filteredEvents.length ? 'Toàn bộ dữ liệu' : `${events.length} chương trình trong hệ thống`}</Text></View>{loading ? <StatePanel loading title="Đang tải chương trình" message="Hệ thống đang lấy lịch khuyến mãi và sản phẩm." /> : error && !events.length ? <StatePanel icon="cloud-offline-outline" title="Không thể tải khuyến mãi" message={error} action="Thử lại" onPress={() => void load()} /> : !visibleEvents.length ? <StatePanel icon="flash-outline" title="Không có chương trình" message={events.length ? 'Không có sự kiện phù hợp với bộ lọc.' : 'Chưa có chương trình khuyến mãi nào.'} /> : compact ? <View style={styles.cardList}>{visibleEvents.map(event => <PromotionCard key={event.id} event={event} onEdit={() => openEdit(event)} />)}</View> : <PromotionTable events={visibleEvents} onEdit={openEdit} />}{!loading && !error && filteredEvents.length ? <View style={[styles.pagination, compact && styles.paginationCompact]}><Text style={styles.pageMeta}>Trang {page}/{pageCount} · {filteredEvents.length} kết quả</Text><View style={styles.pageActions}><Pressable accessibilityRole="button" disabled={page <= 1} onPress={() => setPage(value => Math.max(1, value - 1))} style={[styles.pageButton, page <= 1 && styles.disabled]}><Ionicons name="chevron-back" size={17} color={colors.ink} /><Text style={styles.pageButtonText}>Trước</Text></Pressable><Pressable accessibilityRole="button" disabled={page >= pageCount} onPress={() => setPage(value => Math.min(pageCount, value + 1))} style={[styles.pageButton, page >= pageCount && styles.disabled]}><Text style={styles.pageButtonText}>Sau</Text><Ionicons name="chevron-forward" size={17} color={colors.ink} /></Pressable></View></View> : null}</View>
    </ScrollView>
  </AdminLayout>;
}

function FormField({ label, required = false, error, compact = true, multiline = false, style, ...props }: TextInputProps & { label: string; required?: boolean; error?: string; compact?: boolean }) {
  return <View style={[styles.field, !compact && styles.fieldHalf, style]}><Text style={styles.inputLabel}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text><TextInput placeholderTextColor={colors.subtle} multiline={multiline} style={[styles.input, multiline && styles.textarea, error && styles.inputError]} {...props} />{error ? <Text style={styles.fieldError}>{error}</Text> : null}</View>;
}

function ProductChoice({ product, checked, disabled, onPress }: { product: Product; checked: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress} style={[styles.productChoice, checked && styles.productChoiceSelected, disabled && styles.disabled]}><Ionicons name={checked ? 'checkbox' : 'square-outline'} size={21} color={checked ? colors.accent : colors.subtle} /><OrderProductImage uri={product.imageUrl} style={styles.productImage} /><View style={styles.productCopy}><Text numberOfLines={2} style={styles.productName}>{product.name}</Text><Text numberOfLines={1} style={styles.productMeta}>{product.category || 'Chưa phân loại'} · Tồn {product.stock}</Text></View><Text style={styles.productPrice}>{formatVnd(Number(product.originalPrice ?? product.price) || 0)}</Text></Pressable>;
}

function PromotionTable({ events, onEdit }: { events: PromotionEvent[]; onEdit: (event: PromotionEvent) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScroll}><View style={styles.table}><View style={[styles.tableRow, styles.tableHead]}><Text style={[styles.tableHeadText, styles.eventColumn]}>Chương trình</Text><Text style={[styles.tableHeadText, styles.phaseColumn]}>Giai đoạn</Text><Text style={[styles.tableHeadText, styles.discountColumn]}>Mức giảm</Text><Text style={[styles.tableHeadText, styles.countColumn]}>Sản phẩm</Text><Text style={[styles.tableHeadText, styles.periodColumn]}>Thời gian</Text><Text style={[styles.tableHeadText, styles.actionColumn]}>Thao tác</Text></View>{events.map(event => <View key={event.id} style={styles.tableRow}><View style={styles.eventColumn}><Text numberOfLines={2} style={styles.eventTitle}>{event.title}</Text><Text numberOfLines={2} style={styles.cellMuted}>{event.description || 'Không có mô tả'}</Text></View><View style={styles.phaseColumn}><PhaseBadge phase={event.phase} /><Text style={styles.cellMuted}>{event.status}</Text></View><Text style={[styles.discountText, styles.discountColumn]}>Đến {event.displayDiscountPercent ?? event.maxDiscountPercent}%</Text><Text style={[styles.cellText, styles.countColumn]}>{event.products.length}</Text><View style={styles.periodColumn}><Text style={styles.cellText}>{formatDateTime(event.startsAt)}</Text><Text style={styles.cellMuted}>đến {formatDateTime(event.endsAt)}</Text></View><View style={styles.actionColumn}><Pressable accessibilityRole="button" onPress={() => onEdit(event)} style={styles.editButton}><Ionicons name="create-outline" size={17} color={colors.accent} /><Text style={styles.editText}>Chỉnh sửa</Text></Pressable></View></View>)}</View></ScrollView>;
}

function PromotionCard({ event, onEdit }: { event: PromotionEvent; onEdit: () => void }) {
  return <View style={styles.eventCard}><View style={styles.cardTop}><View style={styles.eventIcon}><Ionicons name="flash-outline" size={22} color={colors.accent} /></View><View style={styles.cardCopy}><Text numberOfLines={2} style={styles.cardTitle}>{event.title}</Text><Text numberOfLines={2} style={styles.cardDescription}>{event.description || 'Không có mô tả'}</Text></View><PhaseBadge phase={event.phase} /></View><View style={styles.cardFacts}><Fact label="Mức giảm" value={`Đến ${event.displayDiscountPercent ?? event.maxDiscountPercent}%`} /><Fact label="Sản phẩm" value={String(event.products.length)} /><Fact label="Bắt đầu" value={formatDateTime(event.startsAt)} /></View><Pressable accessibilityRole="button" onPress={onEdit} style={styles.cardEditButton}><Ionicons name="create-outline" size={17} color={colors.accent} /><Text style={styles.editText}>Chỉnh sửa chương trình</Text></Pressable></View>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text numberOfLines={2} style={styles.factValue}>{value}</Text></View>;
}

function PhaseBadge({ phase }: { phase: PromotionEvent['phase'] }) {
  const palette = phase === 'active' ? { backgroundColor: '#E2F3EA', color: colors.success } : phase === 'scheduled' ? { backgroundColor: '#FFF3D6', color: '#986411' } : phase === 'ended' ? { backgroundColor: '#FBE5E5', color: colors.danger } : phase === 'paused' ? { backgroundColor: '#F7EBDD', color: '#986411' } : { backgroundColor: colors.bg, color: colors.muted };
  return <View style={[styles.phaseBadge, { backgroundColor: palette.backgroundColor }]}><Text style={[styles.phaseText, { color: palette.color }]}>{phaseLabels[phase]}</Text></View>;
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function StatePanel({ loading = false, icon = 'flash-outline', title, message, action, onPress }: { loading?: boolean; icon?: ComponentProps<typeof Ionicons>['name']; title: string; message: string; action?: string; onPress?: () => void }) {
  return <View style={styles.statePanel}>{loading ? <ActivityIndicator size="large" color={colors.accent} /> : <Ionicons name={icon} size={32} color={colors.subtle} />}<Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{message}</Text>{action && onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={styles.outlineButton}><Text style={styles.outlineButtonText}>{action}</Text></Pressable> : null}</View>;
}

function AdminGateState() {
  return <View style={styles.gate}><ActivityIndicator size="large" color={colors.accent} /><Text style={styles.gateText}>Đang xác minh quyền quản trị...</Text></View>;
}

function validDiscount(value: string) {
  const amount = Number(value);
  return Number.isInteger(amount) && amount >= 1 && amount <= 99;
}

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').trim();
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Không rõ' : date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' });
}

const styles = StyleSheet.create(withTypography({
  scroll: { flex: 1, backgroundColor: colors.bg }, content: { padding: 28, gap: 18, maxWidth: 1680, width: '100%', alignSelf: 'center' }, contentCompact: { padding: 14, gap: 14 }, pageHeading: { flexDirection: 'row', alignItems: 'center', gap: 15 }, pageHeadingCompact: { alignItems: 'stretch', flexDirection: 'column' }, headingCopy: { flex: 1 }, eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: 5 }, titleCompact: { fontSize: 24 }, subtitle: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 5 },
  primaryButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, primaryButtonText: { color: colors.white, fontSize: 11, fontWeight: '800' }, secondaryButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, secondaryButtonText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  successBanner: { padding: 12, borderRadius: 8, backgroundColor: '#E2F3EA', borderWidth: 1, borderColor: '#C6E8D6', flexDirection: 'row', alignItems: 'center', gap: 7 }, successText: { color: colors.success, fontSize: 11, fontWeight: '700' }, errorBanner: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#F0CACA', backgroundColor: '#FFF7F7', flexDirection: 'row', alignItems: 'center', gap: 7 }, errorText: { flex: 1, color: colors.danger, fontSize: 10 }, retryText: { color: colors.danger, fontSize: 9, fontWeight: '800' },
  formPanel: { padding: 19, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 14 }, formHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 }, panelEyebrow: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 }, formTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', marginTop: 3 }, formIcon: { marginLeft: 'auto', width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E1F4FA' }, formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, field: { width: '100%', gap: 5 }, fieldHalf: { width: '48.8%' }, inputLabel: { color: colors.ink, fontSize: 10, fontWeight: '800' }, required: { color: colors.danger }, input: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 7, borderWidth: 1, borderColor: colors.line, color: colors.ink, fontSize: 12 }, textarea: { minHeight: 80, textAlignVertical: 'top' }, inputError: { borderColor: colors.danger }, fieldError: { color: colors.danger, fontSize: 9 },
  productSection: { padding: 14, borderRadius: 9, borderWidth: 1, borderColor: colors.line, gap: 10 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, sectionStep: { color: colors.accent, fontSize: 8, fontWeight: '800', letterSpacing: 1 }, sectionTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 2 }, bulkBox: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5 }, bulkInput: { width: 48, minHeight: 38, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: colors.line, color: colors.ink, textAlign: 'center', fontSize: 11 }, percentText: { color: colors.muted, fontSize: 11, fontWeight: '800' }, bulkButton: { minHeight: 38, paddingHorizontal: 10, borderRadius: 6, backgroundColor: colors.headerRaised, alignItems: 'center', justifyContent: 'center' }, bulkButtonText: { color: colors.white, fontSize: 9, fontWeight: '800' }, productSearch: { minHeight: 42, paddingHorizontal: 11, borderRadius: 7, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center' }, productSearchInput: { flex: 1, paddingHorizontal: 8, color: colors.ink, fontSize: 11 }, catalog: { borderWidth: 1, borderColor: colors.lineSoft, borderRadius: 7, overflow: 'hidden' }, catalogEmpty: { color: colors.muted, fontSize: 10, textAlign: 'center', padding: 18 }, productChoice: { minHeight: 64, padding: 9, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center', gap: 8 }, productChoiceSelected: { backgroundColor: '#F1FAFC' }, productImage: { width: 46, height: 46, borderRadius: 7 }, productCopy: { flex: 1, minWidth: 0 }, productName: { color: colors.ink, fontSize: 10, fontWeight: '800', lineHeight: 15 }, productMeta: { color: colors.muted, fontSize: 9, marginTop: 3 }, productPrice: { color: colors.ink, fontSize: 10, fontWeight: '800' }, selectedList: { gap: 6 }, selectedTitle: { color: colors.ink, fontSize: 11, fontWeight: '800', marginTop: 4 }, selectedRow: { minHeight: 64, padding: 8, borderRadius: 7, backgroundColor: colors.bg, flexDirection: 'row', alignItems: 'center', gap: 8 }, selectedRowCompact: { flexWrap: 'wrap' }, selectedImage: { width: 45, height: 45, borderRadius: 7 }, selectedCopy: { flex: 1, minWidth: 130 }, selectedName: { color: colors.ink, fontSize: 10, fontWeight: '800' }, selectedMeta: { color: colors.muted, fontSize: 9, marginTop: 3 }, discountInputBox: { flexDirection: 'row', alignItems: 'center', gap: 4 }, discountInput: { width: 48, minHeight: 38, borderRadius: 6, borderWidth: 1, borderColor: colors.line, color: colors.ink, textAlign: 'center', fontSize: 11 }, removeProduct: { width: 38, height: 38, borderRadius: 7, borderWidth: 1, borderColor: '#F0CACA', backgroundColor: '#FFF7F7', alignItems: 'center', justifyContent: 'center' }, formError: { padding: 11, borderRadius: 7, backgroundColor: '#FBE5E5', flexDirection: 'row', alignItems: 'center', gap: 7 }, formErrorText: { flex: 1, color: colors.danger, fontSize: 10 }, formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }, formActionsCompact: { flexDirection: 'column' }, pauseButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 7, borderWidth: 1, borderColor: '#E7CEAA', backgroundColor: '#FFF8EC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, pauseText: { color: '#986411', fontSize: 10, fontWeight: '800' },
  filterPanel: { padding: 17, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 10 }, searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, searchRowCompact: { alignItems: 'stretch', flexDirection: 'column' }, searchBox: { flex: 1, minHeight: 44, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center' }, searchInput: { flex: 1, minWidth: 0, paddingHorizontal: 9, color: colors.ink, fontSize: 12 }, outlineButton: { minHeight: 42, paddingHorizontal: 13, borderRadius: 7, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, outlineButtonText: { color: colors.accent, fontSize: 10, fontWeight: '800' }, resetButton: { minHeight: 42, paddingHorizontal: 13, borderRadius: 7, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, resetText: { color: colors.ink, fontSize: 10, fontWeight: '800' }, filterLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }, chipRow: { gap: 7, paddingVertical: 2 }, chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, chipActive: { borderColor: colors.accent, backgroundColor: '#E1F4FA' }, chipText: { color: colors.muted, fontSize: 9, fontWeight: '700' }, chipTextActive: { color: colors.accent },
  listPanel: { padding: 18, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 12 }, listHeading: { flexDirection: 'row', alignItems: 'center' }, panelTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 2 }, resultMeta: { marginLeft: 'auto', color: colors.muted, fontSize: 10 }, statePanel: { minHeight: 260, padding: 25, alignItems: 'center', justifyContent: 'center', gap: 9 }, stateTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', textAlign: 'center' }, stateText: { maxWidth: 440, color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  tableScroll: { minWidth: 1100 }, table: { minWidth: 1100, flex: 1 }, tableRow: { minHeight: 82, paddingHorizontal: 9, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center' }, tableHead: { minHeight: 46, borderRadius: 7, borderBottomWidth: 0, backgroundColor: colors.bg }, tableHeadText: { paddingHorizontal: 7, color: colors.muted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }, eventColumn: { width: 270, paddingHorizontal: 7 }, phaseColumn: { width: 135, paddingHorizontal: 7 }, discountColumn: { width: 120, paddingHorizontal: 7 }, countColumn: { width: 90, paddingHorizontal: 7 }, periodColumn: { width: 230, paddingHorizontal: 7 }, actionColumn: { width: 130, paddingHorizontal: 7 }, eventTitle: { color: colors.ink, fontSize: 11, fontWeight: '800' }, cellText: { color: colors.ink, fontSize: 10 }, cellMuted: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 }, discountText: { color: colors.accent, fontSize: 11, fontWeight: '800' }, phaseBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 }, phaseText: { fontSize: 9, fontWeight: '800' }, editButton: { minHeight: 36, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: '#F1FAFC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, editText: { color: colors.accent, fontSize: 9, fontWeight: '800' },
  cardList: { gap: 10 }, eventCard: { padding: 13, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 10 }, cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, eventIcon: { width: 44, height: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E1F4FA' }, cardCopy: { flex: 1, minWidth: 0 }, cardTitle: { color: colors.ink, fontSize: 12, fontWeight: '800', lineHeight: 17 }, cardDescription: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 }, cardFacts: { padding: 10, borderRadius: 7, backgroundColor: colors.bg, flexDirection: 'row', gap: 7 }, fact: { flex: 1, minWidth: 0 }, factLabel: { color: colors.muted, fontSize: 8, fontWeight: '700', textTransform: 'uppercase' }, factValue: { color: colors.ink, fontSize: 9, fontWeight: '800', marginTop: 3 }, cardEditButton: { minHeight: 39, borderRadius: 7, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: '#F1FAFC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  pagination: { paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center' }, paginationCompact: { alignItems: 'stretch', flexDirection: 'column', gap: 9 }, pageMeta: { flex: 1, color: colors.muted, fontSize: 10 }, pageActions: { flexDirection: 'row', gap: 7 }, pageButton: { minHeight: 38, paddingHorizontal: 11, borderRadius: 7, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }, pageButtonText: { color: colors.ink, fontSize: 10, fontWeight: '800' }, disabled: { opacity: 0.45 }, gate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 11, backgroundColor: colors.bg }, gateText: { color: colors.muted, fontSize: 12 },
}));
