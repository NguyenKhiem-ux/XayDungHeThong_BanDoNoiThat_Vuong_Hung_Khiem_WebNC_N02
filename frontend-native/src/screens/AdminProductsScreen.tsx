import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputProps, useWindowDimensions, View } from 'react-native';
import { adminProductImageError, adminProductImageMime, adminProductPageCount, adminProductValidationErrors } from '../adminProducts.mjs';
import { formatVnd, productApi } from '../api';
import { AdminLayout } from '../components/admin/AdminLayout';
import { OrderProductImage } from '../components/OrderProductImage';
import { useStore } from '../store';
import { colors } from '../theme';
import { withTypography } from '../typography';
import type { Product, ProductPage, ProductSort } from '../types';

const PAGE_SIZE = 12;

type ProductForm = {
  name: string;
  description: string;
  specifications: string;
  origin: string;
  price: string;
  stock: string;
  category: string;
  brand: string;
  imageUrl: string;
  isFeatured: boolean;
};

type ProductFieldErrors = Partial<Record<'name' | 'price' | 'stock', string>>;

const sortOptions: Array<{ value: ProductSort; label: string }> = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'name', label: 'Tên A–Z' },
  { value: 'price-asc', label: 'Giá tăng' },
  { value: 'price-desc', label: 'Giá giảm' },
];

function emptyProductForm(): ProductForm {
  return { name: '', description: '', specifications: '', origin: '', price: '', stock: '', category: '', brand: '', imageUrl: '', isFeatured: false };
}

export default function AdminProductsScreen() {
  const router = useRouter();
  const scrollRef = useRef<{ scrollTo: (options: { y: number; animated: boolean }) => void } | null>(null);
  const compact = useWindowDimensions().width < 760;
  const { authReady, user, logout } = useStore();
  const [result, setResult] = useState<ProductPage>({ items: [], total: 0, page: 1, limit: PAGE_SIZE });
  const [categories, setCategories] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<ProductSort>('newest');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProductForm);
  const [fieldErrors, setFieldErrors] = useState<ProductFieldErrors>({});
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = authReady && user?.role === 'ADMIN';
  const pageCount = useMemo(() => adminProductPageCount(result.total, result.limit), [result.limit, result.total]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) router.replace({ pathname: '/login', params: { redirect: '/admin/products' } });
    else if (user.role !== 'ADMIN') router.replace('/');
  }, [authReady, router, user]);

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    void productApi.categories(controller.signal).then(values => setCategories(values.filter(Boolean))).catch(failure => {
      if ((failure as Error).name !== 'AbortError') setCategories([]);
    });
    return () => controller.abort();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    setLoading(true);
    setListError('');
    void productApi.page({ page, limit: PAGE_SIZE, keyword, category, sort }, controller.signal).then(data => {
      setResult(data);
      const lastPage = adminProductPageCount(data.total, data.limit);
      if (page > lastPage) setPage(lastPage);
    }).catch(failure => {
      if ((failure as Error).name !== 'AbortError') setListError(failure instanceof Error ? failure.message : 'Không thể tải danh sách sản phẩm.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [category, isAdmin, keyword, page, reloadKey, sort]);

  if (!isAdmin || !user) return <AdminGateState />;

  const signOut = () => { void logout().finally(() => router.replace('/login')); };
  const applySearch = () => { setKeyword(keywordInput.trim()); setPage(1); };
  const refresh = () => setReloadKey(value => value + 1);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyProductForm());
    setSelectedImage(null);
    setFieldErrors({});
    setFormError('');
  };

  const openCreate = () => {
    resetForm();
    setMessage('');
    setShowForm(true);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const openEdit = (product: Product) => {
    setEditingId(product.id);
    setForm({
      name: product.name || '',
      description: product.description || '',
      specifications: product.specifications || '',
      origin: product.origin || '',
      price: String(product.originalPrice ?? product.price ?? ''),
      stock: String(product.stock ?? ''),
      category: product.category || '',
      brand: product.brand || '',
      imageUrl: product.imageUrl || '',
      isFeatured: Boolean(product.isFeatured),
    });
    setSelectedImage(null);
    setFieldErrors({});
    setFormError('');
    setMessage('');
    setShowForm(true);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const closeForm = () => { resetForm(); setShowForm(false); };

  const setFormValue = <Key extends keyof ProductForm>(key: Key, value: ProductForm[Key]) => {
    setForm(current => ({ ...current, [key]: value }));
    if (key === 'name' || key === 'price' || key === 'stock') setFieldErrors(current => ({ ...current, [key]: undefined }));
    setFormError('');
  };

  const pickImage = async () => {
    setFormError('');
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) { setFormError('Vui lòng cấp quyền truy cập thư viện ảnh để chọn ảnh sản phẩm.'); return; }
      }
      const selection = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      if (selection.canceled || !selection.assets[0]) return;
      const asset = selection.assets[0];
      const mimeType = adminProductImageMime(asset.fileName || asset.uri, asset.mimeType || asset.file?.type);
      const imageError = adminProductImageError({ mimeType, fileSize: asset.fileSize ?? asset.file?.size });
      if (imageError) { setFormError(imageError); return; }
      setSelectedImage(asset);
    } catch (failure) {
      setFormError(failure instanceof Error ? failure.message : 'Không thể mở thư viện ảnh. Vui lòng thử lại.');
    }
  };

  const buildFormData = () => {
    const data = new FormData();
    const values: Record<Exclude<keyof ProductForm, 'isFeatured'>, string> = {
      name: form.name.trim(),
      description: form.description.trim(),
      specifications: form.specifications.trim(),
      origin: form.origin.trim(),
      price: form.price.trim(),
      stock: form.stock.trim(),
      category: form.category.trim(),
      brand: form.brand.trim(),
      imageUrl: form.imageUrl.trim(),
    };
    Object.entries(values).forEach(([key, value]) => data.append(key, value));
    data.append('isFeatured', String(form.isFeatured));
    if (selectedImage) {
      const mimeType = adminProductImageMime(selectedImage.fileName || selectedImage.uri, selectedImage.mimeType || selectedImage.file?.type);
      if (Platform.OS === 'web' && selectedImage.file) data.append('image', selectedImage.file, selectedImage.fileName || selectedImage.file.name);
      else data.append('image', { uri: selectedImage.uri, name: selectedImage.fileName || `product.${mimeType.split('/')[1] || 'jpg'}`, type: mimeType } as unknown as Blob);
    }
    return data;
  };

  const saveProduct = async () => {
    if (saving) return;
    const errors = adminProductValidationErrors(form) as ProductFieldErrors;
    setFieldErrors(errors);
    if (Object.keys(errors).length) { setFormError('Vui lòng kiểm tra các trường bắt buộc.'); return; }
    setSaving(true);
    setFormError('');
    setMessage('');
    try {
      const data = buildFormData();
      if (editingId) await productApi.update(editingId, data);
      else await productApi.create(data);
      setMessage(editingId ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm.');
      const wasEditing = editingId !== null;
      closeForm();
      if (!wasEditing && page !== 1) setPage(1);
      else refresh();
    } catch (failure) {
      setFormError(failure instanceof Error ? failure.message : 'Không thể lưu sản phẩm. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setListError('');
    setMessage('');
    try {
      await productApi.remove(deleteTarget.id);
      if (editingId === deleteTarget.id) closeForm();
      setMessage(`Đã xóa “${deleteTarget.name}”.`);
      setDeleteTarget(null);
      if (result.items.length === 1 && page > 1) setPage(value => value - 1);
      else refresh();
    } catch (failure) {
      setListError(failure instanceof Error ? failure.message : 'Không thể xóa sản phẩm. Vui lòng thử lại.');
    } finally {
      setDeleting(false);
    }
  };

  return <AdminLayout user={user} onLogout={signOut}>
    <StatusBar style="light" />
    <ScrollView ref={instance => { scrollRef.current = instance; }} keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={[styles.content, compact && styles.contentCompact]}>
      <View style={[styles.pageHeading, compact && styles.pageHeadingCompact]}>
        <View style={styles.headingCopy}><Text style={styles.eyebrow}>PRODUCT CATALOG</Text><Text style={[styles.title, compact && styles.titleCompact]}>Quản lý sản phẩm</Text><Text style={styles.subtitle}>Dữ liệu sản phẩm, giá và tồn kho được lấy trực tiếp từ hệ thống.</Text></View>
        <Pressable accessibilityRole="button" onPress={showForm ? closeForm : openCreate} style={[styles.primaryButton, showForm && styles.secondaryButton]}><Ionicons name={showForm ? 'close' : 'add'} size={18} color={showForm ? colors.ink : colors.white} /><Text style={[styles.primaryButtonText, showForm && styles.secondaryButtonText]}>{showForm ? 'Đóng biểu mẫu' : 'Thêm sản phẩm'}</Text></Pressable>
      </View>

      {showForm && <ProductFormPanel compact={compact} form={form} errors={fieldErrors} editing={editingId !== null} selectedImage={selectedImage} categories={categories} busy={saving} error={formError} onChange={setFormValue} onPickImage={() => void pickImage()} onClearPickedImage={() => setSelectedImage(null)} onCancel={closeForm} onSave={() => void saveProduct()} />}

      {message ? <View style={styles.successBanner}><Ionicons name="checkmark-circle" size={18} color={colors.success} /><Text style={styles.successText}>{message}</Text></View> : null}

      <View style={styles.panel}>
        <View style={[styles.toolbar, compact && styles.toolbarCompact]}>
          <View style={styles.searchBox}><Ionicons name="search" size={18} color={colors.subtle} /><TextInput accessibilityLabel="Tìm sản phẩm" value={keywordInput} onChangeText={setKeywordInput} onSubmitEditing={applySearch} returnKeyType="search" placeholder="Tìm theo tên, thương hiệu..." placeholderTextColor={colors.subtle} style={styles.searchInput} /><Pressable accessibilityRole="button" accessibilityLabel="Tìm kiếm" onPress={applySearch} style={styles.searchButton}><Text style={styles.searchButtonText}>Tìm</Text></Pressable></View>
          <Pressable accessibilityRole="button" disabled={loading} onPress={refresh} style={[styles.refreshButton, loading && styles.disabled]}>{loading ? <ActivityIndicator size="small" color={colors.accent} /> : <Ionicons name="refresh" size={18} color={colors.accent} />}<Text style={styles.refreshText}>Làm mới</Text></Pressable>
        </View>

        <Text style={styles.filterLabel}>Danh mục</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <FilterChip label="Tất cả" active={!category} onPress={() => { setCategory(''); setPage(1); }} />
          {categories.map(value => <FilterChip key={value} label={value} active={category === value} onPress={() => { setCategory(value); setPage(1); }} />)}
        </ScrollView>
        <Text style={styles.filterLabel}>Sắp xếp</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {sortOptions.map(option => <FilterChip key={option.value} label={option.label} active={sort === option.value} onPress={() => { setSort(option.value); setPage(1); }} />)}
        </ScrollView>

        {deleteTarget && <View style={[styles.confirmBox, compact && styles.confirmBoxCompact]}><View style={styles.confirmCopy}><Text style={styles.confirmTitle}>Xóa sản phẩm “{deleteTarget.name}”?</Text><Text style={styles.confirmText}>Thao tác này xóa dữ liệu thật và không thể hoàn tác.</Text></View><View style={styles.confirmActions}><Pressable accessibilityRole="button" disabled={deleting} onPress={() => setDeleteTarget(null)} style={styles.cancelButton}><Text style={styles.cancelButtonText}>Hủy</Text></Pressable><Pressable accessibilityRole="button" disabled={deleting} onPress={() => void removeProduct()} style={[styles.deleteConfirmButton, deleting && styles.disabled]}>{deleting ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="trash-outline" size={16} color={colors.white} />}<Text style={styles.deleteConfirmText}>Xác nhận xóa</Text></Pressable></View></View>}

        {listError ? <StatePanel icon="alert-circle-outline" title="Không thể tải dữ liệu" message={listError} action="Thử lại" onPress={refresh} /> : loading ? <StatePanel loading title="Đang tải sản phẩm" message="Hệ thống đang lấy danh sách sản phẩm." /> : !result.items.length ? <StatePanel icon="cube-outline" title="Không có sản phẩm" message={keyword || category ? 'Không tìm thấy sản phẩm phù hợp với bộ lọc.' : 'Chưa có sản phẩm nào trong hệ thống.'} /> : compact ? <View style={styles.cardList}>{result.items.map(product => <ProductCard key={product.id} product={product} onEdit={() => openEdit(product)} onDelete={() => setDeleteTarget(product)} />)}</View> : <ProductTable products={result.items} onEdit={openEdit} onDelete={setDeleteTarget} />}

        {!listError && !loading && <View style={[styles.pagination, compact && styles.paginationCompact]}><Text style={styles.resultCount}>{result.total} sản phẩm · Trang {page}/{pageCount}</Text><View style={styles.pageActions}><Pressable accessibilityRole="button" disabled={page <= 1} onPress={() => setPage(value => Math.max(1, value - 1))} style={[styles.pageButton, page <= 1 && styles.disabled]}><Ionicons name="chevron-back" size={17} color={colors.ink} /><Text style={styles.pageButtonText}>Trước</Text></Pressable><Pressable accessibilityRole="button" disabled={page >= pageCount} onPress={() => setPage(value => Math.min(pageCount, value + 1))} style={[styles.pageButton, page >= pageCount && styles.disabled]}><Text style={styles.pageButtonText}>Sau</Text><Ionicons name="chevron-forward" size={17} color={colors.ink} /></Pressable></View></View>}
      </View>
    </ScrollView>
  </AdminLayout>;
}

function ProductFormPanel({ compact, form, errors, editing, selectedImage, categories, busy, error, onChange, onPickImage, onClearPickedImage, onCancel, onSave }: {
  compact: boolean;
  form: ProductForm;
  errors: ProductFieldErrors;
  editing: boolean;
  selectedImage: ImagePicker.ImagePickerAsset | null;
  categories: string[];
  busy: boolean;
  error: string;
  onChange: <Key extends keyof ProductForm>(key: Key, value: ProductForm[Key]) => void;
  onPickImage: () => void;
  onClearPickedImage: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return <View style={styles.formPanel}>
    <View style={styles.formHeading}><View><Text style={styles.panelEyebrow}>{editing ? 'EDIT PRODUCT' : 'NEW PRODUCT'}</Text><Text style={styles.panelTitle}>{editing ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm'}</Text></View><View style={styles.formHeadingIcon}><Ionicons name={editing ? 'create-outline' : 'cube-outline'} size={20} color={colors.accent} /></View></View>
    <View style={styles.formGrid}>
      <FormField compact={compact} required label="Tên sản phẩm" value={form.name} error={errors.name} onChangeText={value => onChange('name', value)} />
      <FormField compact={compact} label="Thương hiệu" value={form.brand} onChangeText={value => onChange('brand', value)} />
      <FormField compact={compact} required label="Giá gốc" value={form.price} error={errors.price} keyboardType="decimal-pad" onChangeText={value => onChange('price', value)} />
      <FormField compact={compact} required label="Tồn kho" value={form.stock} error={errors.stock} keyboardType="number-pad" onChangeText={value => onChange('stock', value)} />
      <FormField compact={compact} label="Danh mục" value={form.category} onChangeText={value => onChange('category', value)} />
      <FormField compact={compact} label="Xuất xứ" value={form.origin} onChangeText={value => onChange('origin', value)} />
    </View>
    {categories.length ? <View><Text style={styles.inputHint}>Chọn nhanh danh mục hiện có</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{categories.map(value => <FilterChip key={value} label={value} active={form.category === value} onPress={() => onChange('category', value)} />)}</ScrollView></View> : null}
    <FormField label="Mô tả" value={form.description} multiline onChangeText={value => onChange('description', value)} />
    <FormField label="Thông số kỹ thuật" value={form.specifications} multiline onChangeText={value => onChange('specifications', value)} />
    <FormField label="URL ảnh hiện tại" value={form.imageUrl} autoCapitalize="none" onChangeText={value => onChange('imageUrl', value)} />
    <View style={[styles.imageEditor, compact && styles.imageEditorCompact]}><OrderProductImage uri={selectedImage?.uri || form.imageUrl} iconSize={30} style={styles.imagePreview} /><View style={styles.imageControls}><Text style={styles.imageTitle}>Ảnh sản phẩm</Text><Text style={styles.inputHint}>{selectedImage ? selectedImage.fileName || 'Ảnh mới đã chọn' : editing ? 'Không chọn ảnh mới sẽ giữ nguyên ảnh hiện tại.' : 'JPG, PNG hoặc WEBP; tối đa 10 MB.'}</Text><View style={styles.inlineActions}><Pressable accessibilityRole="button" disabled={busy} onPress={onPickImage} style={styles.outlineButton}><Ionicons name="image-outline" size={17} color={colors.accent} /><Text style={styles.outlineButtonText}>{selectedImage ? 'Chọn ảnh khác' : 'Chọn ảnh'}</Text></Pressable>{selectedImage && <Pressable accessibilityRole="button" disabled={busy} onPress={onClearPickedImage} style={styles.linkButton}><Text style={styles.linkButtonText}>Bỏ ảnh đã chọn</Text></Pressable>}</View></View></View>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.isFeatured }} disabled={busy} onPress={() => onChange('isFeatured', !form.isFeatured)} style={styles.checkboxRow}><Ionicons name={form.isFeatured ? 'checkbox' : 'square-outline'} size={22} color={form.isFeatured ? colors.accent : colors.subtle} /><Text style={styles.checkboxLabel}>Đánh dấu là sản phẩm nổi bật</Text></Pressable>
    {error ? <View style={styles.errorBanner}><Ionicons name="alert-circle" size={17} color={colors.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}
    <View style={styles.formActions}><Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={styles.cancelButton}><Text style={styles.cancelButtonText}>Hủy</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={onSave} style={[styles.primaryButton, busy && styles.disabled]}>{busy ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="save-outline" size={17} color={colors.white} />}<Text style={styles.primaryButtonText}>{busy ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm sản phẩm'}</Text></Pressable></View>
  </View>;
}

function FormField({ label, required = false, error, compact = true, multiline = false, style, ...props }: TextInputProps & { label: string; required?: boolean; error?: string; compact?: boolean }) {
  return <View style={[styles.field, !compact && styles.fieldHalf, style]}><Text style={styles.inputLabel}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text><TextInput placeholderTextColor={colors.subtle} multiline={multiline} style={[styles.input, multiline && styles.textarea, error && styles.inputError]} {...props} />{error ? <Text style={styles.fieldError}>{error}</Text> : null}</View>;
}

function ProductTable({ products, onEdit, onDelete }: { products: Product[]; onEdit: (product: Product) => void; onDelete: (product: Product) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScroll}><View style={styles.table}><View style={[styles.tableRow, styles.tableHead]}><Text style={[styles.tableHeadText, styles.imageColumn]}>Ảnh</Text><Text style={[styles.tableHeadText, styles.codeColumn]}>Mã</Text><Text style={[styles.tableHeadText, styles.nameColumn]}>Sản phẩm</Text><Text style={[styles.tableHeadText, styles.categoryColumn]}>Danh mục</Text><Text style={[styles.tableHeadText, styles.priceColumn]}>Giá</Text><Text style={[styles.tableHeadText, styles.stockColumn]}>Tồn kho</Text><Text style={[styles.tableHeadText, styles.statusColumn]}>Trạng thái</Text><Text style={[styles.tableHeadText, styles.actionColumn]}>Thao tác</Text></View>{products.map(product => <View key={product.id} style={styles.tableRow}><View style={styles.imageColumn}><OrderProductImage uri={product.imageUrl} style={styles.tableImage} /></View><Text style={[styles.cellText, styles.codeColumn]}>#{product.id}</Text><View style={styles.nameColumn}><Text numberOfLines={2} style={styles.productName}>{product.name}</Text><Text numberOfLines={1} style={styles.productBrand}>{product.brand || 'Chưa có thương hiệu'}</Text></View><Text numberOfLines={2} style={[styles.cellText, styles.categoryColumn]}>{product.category || 'Chưa phân loại'}</Text><Text numberOfLines={1} style={[styles.priceText, styles.priceColumn]}>{formatVnd(Number(product.price) || 0)}</Text><Text style={[styles.cellText, styles.stockColumn]}>{product.stock}</Text><View style={styles.statusColumn}><StatusBadge product={product} /></View><View style={[styles.actionColumn, styles.rowActions]}><Pressable accessibilityRole="button" accessibilityLabel={`Sửa ${product.name}`} onPress={() => onEdit(product)} style={styles.iconButton}><Ionicons name="create-outline" size={18} color={colors.accent} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Xóa ${product.name}`} onPress={() => onDelete(product)} style={[styles.iconButton, styles.deleteIconButton]}><Ionicons name="trash-outline" size={18} color={colors.danger} /></Pressable></View></View>)}</View></ScrollView>;
}

function ProductCard({ product, onEdit, onDelete }: { product: Product; onEdit: () => void; onDelete: () => void }) {
  return <View style={styles.productCard}><View style={styles.cardTop}><OrderProductImage uri={product.imageUrl} style={styles.cardImage} /><View style={styles.cardCopy}><Text style={styles.productCode}>#{product.id}</Text><Text numberOfLines={2} style={styles.cardName}>{product.name}</Text><Text numberOfLines={1} style={styles.productBrand}>{product.brand || 'Chưa có thương hiệu'}</Text></View><StatusBadge product={product} /></View><View style={styles.cardFacts}><View style={styles.fact}><Text style={styles.factLabel}>Danh mục</Text><Text numberOfLines={1} style={styles.factValue}>{product.category || 'Chưa phân loại'}</Text></View><View style={styles.fact}><Text style={styles.factLabel}>Giá</Text><Text numberOfLines={1} style={styles.factPrice}>{formatVnd(Number(product.price) || 0)}</Text></View><View style={styles.fact}><Text style={styles.factLabel}>Tồn kho</Text><Text style={styles.factValue}>{product.stock}</Text></View></View><View style={styles.cardActions}><Pressable accessibilityRole="button" onPress={onEdit} style={styles.editButton}><Ionicons name="create-outline" size={17} color={colors.accent} /><Text style={styles.editButtonText}>Chỉnh sửa</Text></Pressable><Pressable accessibilityRole="button" onPress={onDelete} style={styles.cardDeleteButton}><Ionicons name="trash-outline" size={17} color={colors.danger} /><Text style={styles.cardDeleteText}>Xóa</Text></Pressable></View></View>;
}

function StatusBadge({ product }: { product: Product }) {
  const outOfStock = Number(product.stock) <= 0;
  return <View style={styles.badgeStack}><View style={[styles.badge, outOfStock ? styles.badgeDanger : styles.badgeSuccess]}><Text style={[styles.badgeText, outOfStock ? styles.badgeDangerText : styles.badgeSuccessText]}>{outOfStock ? 'Hết hàng' : 'Còn hàng'}</Text></View>{product.isFeatured && <View style={[styles.badge, styles.badgeFeatured]}><Text style={styles.badgeFeaturedText}>Nổi bật</Text></View>}</View>;
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function StatePanel({ loading = false, icon = 'cube-outline', title, message, action, onPress }: { loading?: boolean; icon?: React.ComponentProps<typeof Ionicons>['name']; title: string; message: string; action?: string; onPress?: () => void }) {
  return <View style={styles.statePanel}>{loading ? <ActivityIndicator size="large" color={colors.accent} /> : <Ionicons name={icon} size={32} color={colors.subtle} />}<Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{message}</Text>{action && onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={styles.outlineButton}><Text style={styles.outlineButtonText}>{action}</Text></Pressable> : null}</View>;
}

function AdminGateState() {
  return <View style={styles.gate}><ActivityIndicator size="large" color={colors.accent} /><Text style={styles.gateText}>Đang xác minh quyền quản trị...</Text></View>;
}

const styles = StyleSheet.create(withTypography({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 28, gap: 18, maxWidth: 1680, width: '100%', alignSelf: 'center' },
  contentCompact: { padding: 14, gap: 14 },
  pageHeading: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  pageHeadingCompact: { alignItems: 'stretch', flexDirection: 'column' },
  headingCopy: { flex: 1 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: 5 },
  titleCompact: { fontSize: 24 },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 6, lineHeight: 19 },
  primaryButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryButtonText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  secondaryButton: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  secondaryButtonText: { color: colors.ink },
  formPanel: { padding: 20, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, gap: 14 },
  formHeading: { flexDirection: 'row', alignItems: 'center' },
  panelEyebrow: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  panelTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', marginTop: 3 },
  formHeadingIcon: { marginLeft: 'auto', width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E1F4FA' },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field: { width: '100%', gap: 5 },
  fieldHalf: { width: '48.8%' },
  inputLabel: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  required: { color: colors.danger },
  input: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 7, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, color: colors.ink, fontSize: 12 },
  textarea: { minHeight: 86, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  fieldError: { color: colors.danger, fontSize: 10 },
  inputHint: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  imageEditor: { padding: 12, borderRadius: 9, borderWidth: 1, borderColor: colors.lineSoft, backgroundColor: colors.bg, flexDirection: 'row', alignItems: 'center', gap: 14 },
  imageEditorCompact: { alignItems: 'stretch', flexDirection: 'column' },
  imagePreview: { width: 90, height: 90, borderRadius: 8, backgroundColor: colors.white },
  imageControls: { flex: 1, gap: 5 },
  imageTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9, marginTop: 5 },
  outlineButton: { minHeight: 38, paddingHorizontal: 13, borderRadius: 7, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  outlineButtonText: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  linkButton: { minHeight: 38, paddingHorizontal: 8, justifyContent: 'center' },
  linkButtonText: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  checkboxRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkboxLabel: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9 },
  cancelButton: { minHeight: 42, paddingHorizontal: 15, borderRadius: 7, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  errorBanner: { padding: 11, borderRadius: 7, backgroundColor: '#FBE5E5', flexDirection: 'row', alignItems: 'center', gap: 7 },
  errorText: { flex: 1, color: colors.danger, fontSize: 11, lineHeight: 17 },
  successBanner: { padding: 12, borderRadius: 8, backgroundColor: '#E2F3EA', borderWidth: 1, borderColor: '#C6E8D6', flexDirection: 'row', alignItems: 'center', gap: 7 },
  successText: { color: colors.success, fontSize: 11, fontWeight: '700' },
  panel: { padding: 18, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, gap: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toolbarCompact: { alignItems: 'stretch', flexDirection: 'column' },
  searchBox: { flex: 1, minHeight: 44, paddingLeft: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white },
  searchInput: { flex: 1, minWidth: 0, paddingHorizontal: 9, color: colors.ink, fontSize: 12 },
  searchButton: { alignSelf: 'stretch', paddingHorizontal: 15, borderTopRightRadius: 7, borderBottomRightRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.headerRaised },
  searchButtonText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  refreshButton: { minHeight: 44, paddingHorizontal: 13, borderRadius: 8, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  refreshText: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  filterLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginTop: 2, textTransform: 'uppercase' },
  chipRow: { gap: 7, paddingVertical: 2 },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  chipActive: { borderColor: colors.accent, backgroundColor: '#E1F4FA' },
  chipText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  chipTextActive: { color: colors.accent },
  confirmBox: { padding: 13, borderRadius: 8, borderWidth: 1, borderColor: '#F0CACA', backgroundColor: '#FFF7F7', flexDirection: 'row', alignItems: 'center', gap: 12 },
  confirmBoxCompact: { alignItems: 'stretch', flexDirection: 'column' },
  confirmCopy: { flex: 1 },
  confirmTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  confirmText: { color: colors.muted, fontSize: 10, marginTop: 3 },
  confirmActions: { flexDirection: 'row', gap: 8 },
  deleteConfirmButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 7, backgroundColor: colors.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  deleteConfirmText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  statePanel: { minHeight: 250, padding: 25, alignItems: 'center', justifyContent: 'center', gap: 9 },
  stateTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  stateText: { maxWidth: 440, color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  tableScroll: { minWidth: 1100 },
  table: { minWidth: 1100, flex: 1 },
  tableRow: { minHeight: 76, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center' },
  tableHead: { minHeight: 46, borderRadius: 7, borderBottomWidth: 0, backgroundColor: colors.bg },
  tableHeadText: { paddingHorizontal: 7, color: colors.muted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  cellText: { paddingHorizontal: 7, color: colors.ink, fontSize: 11 },
  imageColumn: { width: 72 },
  codeColumn: { width: 72 },
  nameColumn: { width: 230, paddingHorizontal: 7 },
  categoryColumn: { width: 130 },
  priceColumn: { width: 130 },
  stockColumn: { width: 80 },
  statusColumn: { width: 130 },
  actionColumn: { width: 105 },
  tableImage: { width: 52, height: 52, borderRadius: 7, backgroundColor: colors.white },
  productName: { color: colors.ink, fontSize: 11, fontWeight: '800', lineHeight: 16 },
  productBrand: { color: colors.muted, fontSize: 9, marginTop: 4 },
  priceText: { paddingHorizontal: 7, color: colors.ink, fontSize: 11, fontWeight: '800' },
  rowActions: { flexDirection: 'row', gap: 6 },
  iconButton: { width: 38, height: 38, borderRadius: 7, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: '#F1FAFC', alignItems: 'center', justifyContent: 'center' },
  deleteIconButton: { borderColor: '#F0CACA', backgroundColor: '#FFF7F7' },
  badgeStack: { alignItems: 'flex-start', gap: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 9, fontWeight: '800' },
  badgeSuccess: { backgroundColor: '#E2F3EA' },
  badgeSuccessText: { color: colors.success },
  badgeDanger: { backgroundColor: '#FBE5E5' },
  badgeDangerText: { color: colors.danger },
  badgeFeatured: { backgroundColor: '#E1F4FA' },
  badgeFeaturedText: { color: colors.accent, fontSize: 9, fontWeight: '800' },
  cardList: { gap: 10 },
  productCard: { padding: 13, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardImage: { width: 68, height: 68, borderRadius: 8 },
  cardCopy: { flex: 1, minWidth: 0 },
  productCode: { color: colors.accent, fontSize: 9, fontWeight: '800' },
  cardName: { color: colors.ink, fontSize: 13, fontWeight: '800', lineHeight: 18, marginTop: 3 },
  cardFacts: { padding: 10, borderRadius: 7, backgroundColor: colors.bg, flexDirection: 'row', gap: 8 },
  fact: { flex: 1, minWidth: 0 },
  factLabel: { color: colors.muted, fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },
  factValue: { color: colors.ink, fontSize: 10, fontWeight: '700', marginTop: 3 },
  factPrice: { color: colors.ink, fontSize: 10, fontWeight: '800', marginTop: 3 },
  cardActions: { flexDirection: 'row', gap: 8 },
  editButton: { flex: 1, minHeight: 40, borderRadius: 7, borderWidth: 1, borderColor: '#B9E2EE', backgroundColor: '#F1FAFC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  editButtonText: { color: colors.accent, fontSize: 10, fontWeight: '800' },
  cardDeleteButton: { flex: 1, minHeight: 40, borderRadius: 7, borderWidth: 1, borderColor: '#F0CACA', backgroundColor: '#FFF7F7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  cardDeleteText: { color: colors.danger, fontSize: 10, fontWeight: '800' },
  pagination: { paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.lineSoft, flexDirection: 'row', alignItems: 'center' },
  paginationCompact: { alignItems: 'stretch', flexDirection: 'column', gap: 10 },
  resultCount: { flex: 1, color: colors.muted, fontSize: 10 },
  pageActions: { flexDirection: 'row', gap: 7 },
  pageButton: { minHeight: 38, paddingHorizontal: 11, borderRadius: 7, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  pageButtonText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 11, backgroundColor: colors.bg },
  gateText: { color: colors.muted, fontSize: 12 },
}));
