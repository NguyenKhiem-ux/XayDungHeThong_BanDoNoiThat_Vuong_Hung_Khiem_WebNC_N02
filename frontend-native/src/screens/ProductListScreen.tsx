import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { ChatWidget } from '../components/ChatWidget';
import { Header } from '../components/Header';
import { ProductCard, ProductSkeleton } from '../components/ProductCard';
import { ProductFooter } from '../components/ProductFooter';
import { PRICE_RANGES, useProductList, type ProductSort } from '../hooks/useProductList';
import { useStore } from '../store';
import { withTypography } from '../typography';
import { ScrollTopButton, useScrollTop } from '../components/ScrollTopButton';
import { colors } from '../theme';

const sortOptions: Array<[ProductSort, string]> = [['', 'Mặc định'], ['price-asc', 'Giá tăng'], ['price-desc', 'Giá giảm'], ['name', 'Tên A–Z']];

export default function ProductListScreen() {
  const top = useScrollTop();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const twoColumns = width >= 400;
  const cardWidth = twoColumns ? '48.5%' : '100%';
  const { category, categories, clearFilters, error, keyword, loading, priceRange, products, retry, setCategory, setKeyword, setPriceRange, setSort, sort } = useProductList();
  const { notice } = useStore();
  const [search, setSearch] = useState(keyword);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => setSearch(keyword), [keyword]);
  const title = keyword ? `Kết quả cho “${keyword}”` : category || 'Tất cả sản phẩm';

  return <View style={styles.page}>
    <ScrollView ref={top.ref} onScroll={top.onScroll} scrollEventThrottle={100} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Header compact={compact} categories={categories} />
      <View style={styles.hero}>
        <Pressable accessibilityRole="link" onPress={() => router.replace('/')} style={styles.breadcrumb}><Ionicons name="home-outline" size={14} color={colors.ink} /><Text style={styles.breadcrumbText}>Trang chủ  ›  Sản phẩm</Text></Pressable>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Lựa chọn thiết bị gia dụng chất lượng, tiện nghi cho không gian sống hiện đại.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={16} color={colors.ink} /><Text style={styles.backText}>Quay lại</Text></Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.searchRow}><TextInput accessibilityLabel="Tìm trong danh sách sản phẩm" returnKeyType="search" value={search} onChangeText={setSearch} onSubmitEditing={() => setKeyword(search)} placeholder="Tìm sản phẩm, thương hiệu..." placeholderTextColor={colors.muted} style={styles.searchInput} /><Pressable accessibilityRole="button" accessibilityLabel="Tìm kiếm" onPress={() => setKeyword(search)} style={styles.searchButton}><Ionicons name="search" size={18} color={colors.white} /></Pressable></View>

        <Pressable accessibilityRole="button" accessibilityState={{ expanded: filtersOpen }} onPress={() => setFiltersOpen(value => !value)} style={styles.filterToggle}><Ionicons name="options-outline" size={17} color={colors.ink} /><Text style={styles.filterToggleText}>Danh mục</Text><Ionicons name={filtersOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.ink} /></Pressable>
        {filtersOpen && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Chip active={!category} label="Tất cả" onPress={() => setCategory('')} />{categories.map(item => <Chip key={item} active={category === item} label={item} onPress={() => setCategory(item)} />)}</ScrollView>}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sorts}>{sortOptions.map(([value, label]) => <Chip key={label} active={sort === value} label={label} onPress={() => setSort(value)} />)}</ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Chip active={!priceRange} label="Mọi mức giá" onPress={() => setPriceRange('')} />{PRICE_RANGES.map((range, index) => <Chip key={range.label} active={priceRange === String(index)} label={range.label} onPress={() => setPriceRange(String(index))} />)}</ScrollView>
        <Text accessibilityRole="summary" style={styles.count}>{loading ? 'Đang tải sản phẩm…' : error ? 'Chưa thể tải sản phẩm' : `Tìm thấy ${products.length} sản phẩm`}</Text>

        {error ? <View style={styles.state}><Ionicons name="alert-circle-outline" size={34} color={colors.danger} /><Text style={styles.stateTitle}>Chưa thể tải sản phẩm</Text><Text style={styles.stateText}>{error}</Text><Pressable onPress={retry} style={styles.retry}><Text style={styles.retryText}>Thử lại</Text></Pressable></View>
          : loading ? <View style={styles.grid}>{Array.from({ length: 6 }, (_, index) => <ProductSkeleton key={index} style={{ minWidth: 0, width: cardWidth }} />)}</View>
            : products.length ? <View style={styles.grid}>{products.map(product => <ProductCard key={product.id} product={product} style={{ minWidth: 0, width: cardWidth }} />)}</View>
              : <View style={styles.state}><Ionicons name="search-outline" size={34} color={colors.ink} /><Text style={styles.stateTitle}>Không tìm thấy sản phẩm</Text><Text style={styles.stateText}>Hãy thử từ khóa hoặc danh mục khác.</Text><Pressable onPress={() => { setSearch(''); clearFilters(); }} style={styles.retry}><Text style={styles.retryText}>Xem tất cả</Text></Pressable></View>}
        {loading && <ActivityIndicator color={colors.ink} style={styles.loader} />}
        <ProductFooter />
      </View>
    </ScrollView>
    <ScrollTopButton visible={top.visible} onPress={top.toTop} />
    <ChatWidget compact={compact} />
    {!!notice && <View style={styles.toast}><Text style={styles.toastText}>✓ {notice}</Text></View>}
  </View>;
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create(withTypography({
  page: { flex: 1, backgroundColor: colors.bg },
  scroll: { minHeight: '100%' },
  hero: { paddingHorizontal: 16, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.lineSoft },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6 }, breadcrumbText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  title: { marginTop: 18, color: colors.ink, fontSize: 30, lineHeight: 36, fontWeight: '900' },
  subtitle: { marginTop: 8, maxWidth: 620, color: colors.muted, fontSize: 12, lineHeight: 18 },
  back: { alignSelf: 'flex-start', marginTop: 13, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 6 }, backText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  content: { width: '100%', maxWidth: 1200, alignSelf: 'center', padding: 12 },
  searchRow: { height: 44, borderRadius: 11, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, flexDirection: 'row', overflow: 'hidden' },
  searchInput: { flex: 1, paddingHorizontal: 13, color: colors.ink, fontSize: 12 }, searchButton: { width: 48, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  filterToggle: { marginTop: 10, minHeight: 42, paddingHorizontal: 13, borderRadius: 11, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 8 }, filterToggleText: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '900' },
  chips: { paddingTop: 9, paddingBottom: 2, gap: 7 }, sorts: { paddingVertical: 10, gap: 7 }, chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }, chipActive: { borderColor: colors.brand, backgroundColor: colors.brand }, chipText: { color: colors.ink, fontSize: 11, fontWeight: '800' }, chipTextActive: { color: colors.white },
  count: { marginBottom: 9, color: colors.muted, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  state: { minHeight: 320, padding: 22, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', gap: 8 }, stateTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' }, stateText: { color: colors.muted, fontSize: 12, textAlign: 'center' }, retry: { marginTop: 5, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.brand }, retryText: { color: colors.white, fontSize: 11, fontWeight: '900' }, loader: { marginTop: 12 },
  toast: { position: 'absolute', left: 22, right: 22, bottom: 24, padding: 12, borderRadius: 11, backgroundColor: colors.brand, alignItems: 'center' }, toastText: { color: colors.white, fontSize: 12, fontWeight: '800' },
}));
