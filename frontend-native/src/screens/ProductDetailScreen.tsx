import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type ImageStyle } from 'react-native';
import { formatVnd, imageUrl, productApi } from '../api';
import { PageHeader } from '../components/PageHeader';
import { useStore } from '../store';
import type { Product } from '../types';

export default function ProductDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const { width } = useWindowDimensions();
  const compact = width < 820;
  const mobileWidth = Math.max(280, width - 40);
  const { addToCart, favoriteIds, notice, setNotice, toggleFavorite, user } = useStore();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const productId = Number(rawId);
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [cartBusy, setCartBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setImageFailed(false);
    try {
      if (!Number.isInteger(productId) || productId <= 0) throw new Error('Sản phẩm không hợp lệ.');
      const nextProduct = await productApi.detail(productId);
      setProduct(nextProduct);
      setQuantity(1);
    } catch (failure) {
      setProduct(null);
      setError(failure instanceof Error ? failure.message : 'Không thể tải thông tin sản phẩm.');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { void load(); }, [load]);

  const requireAccount = () => {
    if (user) return true;
    setNotice('Vui lòng đăng nhập để tiếp tục.');
    router.push({ pathname: '/login', params: { redirect: `/products/${productId}` } });
    return false;
  };

  const add = async () => {
    if (!product || product.stock <= 0 || cartBusy || !requireAccount()) return;
    setCartBusy(true);
    await addToCart(product.id, quantity);
    setCartBusy(false);
  };

  const changeQuantity = (value: number) => {
    if (!product) return;
    setQuantity(Math.max(1, Math.min(product.stock, Number.isFinite(value) ? value : 1)));
  };

  const soldOut = !!product && product.stock <= 0;
  const saved = !!product && favoriteIds.includes(product.id);
  const onSale = !!product?.discountPercent && (product.originalPrice ?? 0) > product.price;

  return (
    <View style={styles.page}>
      <PageHeader back />
      <ScrollView contentContainerStyle={[styles.scroll, compact && styles.scrollCompact]}>
        {loading ? <View style={styles.state}><ActivityIndicator size="large" color="#755036" /><Text style={styles.stateText}>Đang tải sản phẩm...</Text></View> : error || !product ? <View accessibilityRole="alert" style={styles.state}><Ionicons name="alert-circle-outline" size={38} color="#9B382F" /><Text style={styles.errorTitle}>Chưa thể mở sản phẩm</Text><Text style={styles.stateText}>{error || 'Không tìm thấy sản phẩm.'}</Text><View style={styles.stateActions}><SecondaryButton label="Về trang chủ" onPress={() => router.replace('/')} /><PrimaryButton label="Thử lại" onPress={() => void load()} /></View></View> : <View style={[styles.content, compact && { width: mobileWidth, alignSelf: 'center' }]}>
          <View style={styles.breadcrumb}><Pressable onPress={() => router.replace('/')}><Text style={styles.breadcrumbLink}>Trang chủ</Text></Pressable><Ionicons name="chevron-forward" size={14} color="#A08E80" /><Text numberOfLines={1} style={styles.breadcrumbCurrent}>{product.name}</Text></View>

          <View style={[styles.detail, compact && styles.detailCompact]}>
            <View style={[styles.mediaColumn, compact && styles.fullWidth, compact && { width: mobileWidth }]}>
              <View style={styles.media}>
                {product.imageUrl && !imageFailed ? <Image source={{ uri: imageUrl(product.imageUrl) }} accessibilityLabel={product.name} resizeMode="contain" style={styles.image as ImageStyle} onError={() => setImageFailed(true)} /> : <Text style={styles.noImage}>Không thể hiển thị ảnh sản phẩm.</Text>}
                {product.isFeatured && <View style={styles.featured}><Text style={styles.featuredText}>Nổi bật</Text></View>}
              </View>
              <View style={styles.miniTrust}>{([['cube-outline', 'Kiểm hàng'], ['construct-outline', 'Tư vấn sử dụng'], ['headset-outline', 'Tư vấn nhanh']] as const).map(([icon, label]) => <View key={label} style={styles.miniTrustItem}><Ionicons name={icon} size={17} color="#755036" /><Text numberOfLines={1} style={styles.miniTrustText}>{label}</Text></View>)}</View>
            </View>

            <View style={[styles.info, compact && styles.fullWidth, compact && { width: mobileWidth }]}>
              <View style={styles.headingRow}><View style={styles.headingCopy}><Text style={styles.category}>{product.category || 'Gia dụng'}</Text><Text style={[styles.title, compact && styles.titleCompact]}>{product.name}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'} accessibilityState={{ selected: saved }} onPress={() => { if (requireAccount()) void toggleFavorite(product.id); }} style={({ pressed }) => [styles.favorite, pressed && styles.pressed]}><Ionicons name={saved ? 'heart' : 'heart-outline'} size={23} color={saved ? '#9B382F' : '#755036'} /></Pressable></View>
              <View style={styles.rating}><Text style={styles.stars}>★★★★★</Text><Text style={styles.ratingText}>{product.averageRating?.toFixed(1) || '0.0'} · {product.reviewCount ?? 0} đánh giá</Text></View>
              {!!product.brand && <Text style={styles.brand}>Thương hiệu: <Text style={styles.brandStrong}>{product.brand}</Text></Text>}

              <View style={styles.priceStock}>
                <View><Text style={styles.price}>{formatVnd(product.price)}</Text>{onSale && <View style={styles.saleRow}><Text style={styles.originalPrice}>{formatVnd(product.originalPrice!)}</Text><View style={styles.saleBadge}><Text style={styles.saleBadgeText}>-{product.discountPercent}%</Text></View></View>}</View>
                <View style={[styles.stock, soldOut ? styles.stockOut : styles.stockIn]}><Ionicons name={soldOut ? 'close-circle' : 'checkmark-circle'} size={17} color={soldOut ? '#9B382F' : '#47724A'} /><Text style={[styles.stockText, soldOut ? styles.stockTextOut : styles.stockTextIn]}>{soldOut ? 'Hết hàng' : `Còn ${product.stock} sản phẩm`}</Text></View>
              </View>

              {!!product.discountPercent && !!product.promotionTitle && <Text style={styles.promotion}>{product.promotionTitle}{product.saleEndsAt ? ` · Đến ${new Date(product.saleEndsAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : ''}. Giá được kiểm tra lại khi xác nhận đơn.</Text>}
              {!!product.description && <Text style={styles.description}>{product.description}</Text>}

              {!soldOut && <View style={styles.buyBox}>
                <View style={styles.quantityRow}><Text style={styles.quantityLabel}>Số lượng</Text><View style={styles.quantityControl}><Pressable accessibilityRole="button" accessibilityLabel="Giảm số lượng" onPress={() => changeQuantity(quantity - 1)} style={styles.quantityButton}><Ionicons name="remove" size={18} color="#755036" /></Pressable><TextInput accessibilityLabel="Số lượng" keyboardType="number-pad" value={String(quantity)} onChangeText={value => changeQuantity(Number(value))} style={styles.quantityInput} /><Pressable accessibilityRole="button" accessibilityLabel="Tăng số lượng" onPress={() => changeQuantity(quantity + 1)} style={styles.quantityButton}><Ionicons name="add" size={18} color="#755036" /></Pressable></View></View>
                <Pressable accessibilityRole="button" disabled={cartBusy} onPress={() => void add()} style={({ pressed }) => [styles.addButton, cartBusy && styles.disabled, pressed && styles.pressed]}>{cartBusy ? <ActivityIndicator color="#fff" /> : <><Ionicons name="cart-outline" size={20} color="#fff" /><Text style={styles.addButtonText}>Thêm vào giỏ hàng</Text></>}</Pressable>
              </View>}

              <View style={styles.trustGrid}>{([['shield-checkmark-outline', 'Bảo hành 12-24 tháng'], ['car-outline', 'Giao nhanh toàn quốc'], ['refresh-outline', 'Đổi trả 7 ngày'], ['ribbon-outline', 'Chính hãng 100%']] as const).map(([icon, label]) => <View key={label} style={styles.trustItem}><Ionicons name={icon} size={19} color="#A56E2D" /><Text style={styles.trustText}>{label}</Text></View>)}</View>
            </View>
          </View>

          {!!product.specifications && <View style={styles.specCard}><Text style={styles.category}>THÔNG SỐ KỸ THUẬT</Text><Text style={styles.specTitle}>Chi tiết sản phẩm</Text><Text style={styles.specText}>{product.specifications}</Text></View>}
        </View>}
      </ScrollView>
      {!!notice && <View accessibilityLiveRegion="polite" style={styles.toast}><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={styles.toastText}>{notice}</Text></View>}
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>;
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6EFE6' },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 22 },
  scrollCompact: { paddingHorizontal: 12, paddingVertical: 16 },
  content: { maxWidth: 1200, alignSelf: 'stretch' },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 17 },
  breadcrumbLink: { color: '#755036', fontSize: 12, fontWeight: '800' },
  breadcrumbCurrent: { flex: 1, color: '#8B7A6C', fontSize: 12 },
  detail: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  detailCompact: { flexDirection: 'column' },
  mediaColumn: { width: '48%', gap: 12 },
  fullWidth: { maxWidth: '100%', alignSelf: 'stretch' },
  media: { width: '100%', aspectRatio: 1.12, minHeight: 340, borderRadius: 22, overflow: 'hidden', position: 'relative', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E1CFBA', boxShadow: '0 16px 45px rgba(72, 45, 28, .10)' },
  image: { width: '90%', height: '90%' },
  noImage: { color: '#8F7B6C', fontSize: 13 },
  featured: { position: 'absolute', top: 15, left: 15, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: '#DDA849' },
  featuredText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  miniTrust: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  miniTrustItem: { flex: 1, minWidth: 0, minHeight: 45, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E6D8C7' },
  miniTrustText: { color: '#5B4637', fontSize: 11, fontWeight: '700' },
  info: { width: '52%', padding: 30, borderRadius: 22, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E1CFBA', boxShadow: '0 16px 45px rgba(72, 45, 28, .10)' },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headingCopy: { flex: 1 },
  category: { color: '#9A6C4D', fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: '#30251D', fontFamily: 'serif', fontSize: 34, lineHeight: 41, fontWeight: '900', marginTop: 8 },
  titleCompact: { fontSize: 27, lineHeight: 34 },
  favorite: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6EFE6', borderWidth: 1, borderColor: '#DCC9B4' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  stars: { color: '#D99B2B', fontSize: 14, letterSpacing: -1 },
  ratingText: { color: '#887568', fontSize: 12 },
  brand: { color: '#77685D', fontSize: 12, marginTop: 11 },
  brandStrong: { color: '#493629', fontWeight: '900' },
  priceStock: { marginTop: 24, paddingVertical: 19, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E9DED1', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  price: { color: '#755036', fontSize: 29, fontWeight: '900' },
  saleRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 8 },
  originalPrice: { color: '#9C9188', fontSize: 12, textDecorationLine: 'line-through' },
  saleBadge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: '#FBE8E5' },
  saleBadgeText: { color: '#B74439', fontSize: 10, fontWeight: '900' },
  stock: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  stockIn: { backgroundColor: '#EAF3EA' },
  stockOut: { backgroundColor: '#FBE8E5' },
  stockText: { fontSize: 11, fontWeight: '800' },
  stockTextIn: { color: '#47724A' },
  stockTextOut: { color: '#9B382F' },
  promotion: { marginTop: 15, color: '#8C5D21', fontSize: 11, lineHeight: 17, fontWeight: '700', backgroundColor: '#FBF0DA', borderRadius: 10, padding: 10 },
  description: { color: '#5F5147', fontSize: 14, lineHeight: 23, marginTop: 18 },
  buyBox: { marginTop: 23, borderRadius: 15, padding: 15, backgroundColor: '#F6EFE6', borderWidth: 1, borderColor: '#E1CFBA', gap: 14 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  quantityLabel: { color: '#493629', fontSize: 12, fontWeight: '800' },
  quantityControl: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#D6BFA5', backgroundColor: '#fff' },
  quantityButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  quantityInput: { width: 48, height: 40, paddingHorizontal: 3, textAlign: 'center', color: '#30251D', fontWeight: '900', borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#E1CFBA' },
  addButton: { minHeight: 50, borderRadius: 12, backgroundColor: '#755036', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  trustGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 21 },
  trustItem: { width: '48%', minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 7 },
  trustText: { flex: 1, color: '#625247', fontSize: 11, fontWeight: '700' },
  specCard: { marginTop: 24, borderRadius: 18, padding: 24, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E1CFBA' },
  specTitle: { color: '#30251D', fontFamily: 'serif', fontSize: 23, fontWeight: '900', marginTop: 6, marginBottom: 12 },
  specText: { color: '#5F5147', fontSize: 13, lineHeight: 22 },
  state: { width: '100%', maxWidth: 520, minHeight: 420, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorTitle: { color: '#30251D', fontSize: 20, fontWeight: '900' },
  stateText: { color: '#77685D', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  stateActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  primaryButton: { minHeight: 43, paddingHorizontal: 17, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#755036' },
  primaryButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  secondaryButton: { minHeight: 43, paddingHorizontal: 17, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#CBA779' },
  secondaryButtonText: { color: '#755036', fontSize: 12, fontWeight: '900' },
  toast: { position: 'absolute', bottom: 24, alignSelf: 'center', maxWidth: '88%', paddingHorizontal: 16, minHeight: 44, borderRadius: 12, backgroundColor: '#755036', flexDirection: 'row', alignItems: 'center', gap: 8, boxShadow: '0 10px 30px rgba(48, 37, 29, .22)' },
  toastText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.56 },
  pressed: { opacity: 0.74 },
});
