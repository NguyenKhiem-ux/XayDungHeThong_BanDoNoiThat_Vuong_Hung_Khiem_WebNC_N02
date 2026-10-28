import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { formatVnd, imageUrl } from '../api';
import { useStore } from '../store';
import { withTypography } from '../typography';
import type { Product } from '../types';

interface Props {
  product: Product;
  deal?: boolean;
  style?: ViewStyle;
}

export function ProductCard({ product, deal = false, style }: Props) {
  const router = useRouter();
  const { addToCart, favoriteIds, setNotice, toggleFavorite, user } = useStore();
  const [imageFailed, setImageFailed] = useState(false);
  const soldOut = product.stock <= 0;
  const saved = favoriteIds.includes(product.id);
  const onSale = !!product.discountPercent && (product.originalPrice ?? 0) > product.price;
  const detailRoute = { pathname: '/products/[id]' as const, params: { id: String(product.id) } };
  const loginRoute = { pathname: '/login' as const, params: { redirect: `/products/${product.id}` } };
  const requireAccount = () => {
    if (user) return true;
    setNotice('Vui lòng đăng nhập để tiếp tục.');
    router.push(loginRoute);
    return false;
  };

  return (
    <View style={[styles.card, style]} testID={`product-${product.id}`}>
      <Pressable accessibilityRole="link" accessibilityLabel={`Xem ${product.name}`} onPress={() => router.push(detailRoute)} style={styles.media}>
        {product.imageUrl && !imageFailed ? (
          <Image source={{ uri: imageUrl(product.imageUrl) }} resizeMode="contain" style={styles.image} onError={() => setImageFailed(true)} />
        ) : (
          <View style={styles.fallback}><Ionicons name="home-outline" size={34} color="#CBA779" /></View>
        )}
        <View style={[styles.badge, soldOut ? styles.badgeMuted : deal || product.discountPercent ? styles.badgeSale : styles.badgeFeatured]}>
          <Text style={styles.badgeText}>{soldOut ? 'Hết hàng' : product.discountPercent ? `-${product.discountPercent}%` : product.isFeatured ? 'Nổi bật' : 'Mới'}</Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
        accessibilityState={{ selected: saved }}
        onPress={() => { if (requireAccount()) void toggleFavorite(product.id); }}
        style={({ pressed }) => [styles.favorite, pressed && styles.pressed]}
      >
        <Ionicons name={saved ? 'heart' : 'heart-outline'} size={18} color={saved ? '#9B382F' : '#755036'} />
      </Pressable>

      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.category}>{product.category || 'Gia dụng'}</Text>
        <Pressable accessibilityRole="link" onPress={() => router.push(detailRoute)}>
          <Text numberOfLines={2} style={styles.name}>{product.name}</Text>
        </Pressable>
        <View style={styles.ratingRow}>
          <Text style={styles.stars}>★★★★★</Text>
          <Text style={styles.ratingText}>({product.reviewCount ?? 0})</Text>
        </View>
        <Text style={styles.price}>{formatVnd(product.price)}</Text>
        {onSale ? <Text style={styles.originalPrice}>{formatVnd(product.originalPrice!)}</Text> : <View style={styles.priceSpacer} />}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Thêm ${product.name} vào giỏ`}
          accessibilityState={{ disabled: soldOut }}
          disabled={soldOut}
          onPress={() => { if (requireAccount()) void addToCart(product.id); }}
          style={({ pressed }) => [styles.cartButton, soldOut && styles.disabled, pressed && styles.pressed]}
        >
          <Ionicons name="cart-outline" size={17} color="#FFFCF7" />
          <Text style={styles.cartButtonText}>{soldOut ? 'Hết hàng' : 'Thêm giỏ'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ProductSkeleton({ style }: { style?: ViewStyle }) {
  return <View style={[styles.card, styles.skeletonCard, style]} accessibilityLabel="Đang tải sản phẩm"><View style={[styles.media, styles.skeleton]} /><View style={styles.info}><View style={[styles.skeletonLine, { width: '40%' }]} /><View style={[styles.skeletonLine, { width: '88%' }]} /><View style={[styles.skeletonLine, { width: '65%' }]} /></View></View>;
}

const styles = StyleSheet.create(withTypography({
  card: {
    minWidth: 178,
    backgroundColor: '#FFFCF7',
    borderColor: '#E6D8C7',
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 8px 24px rgba(91, 58, 34, 0.08)',
  },
  media: { height: 178, backgroundColor: '#F8F3EC', alignItems: 'center', justifyContent: 'center' },
  image: { width: '88%', height: '86%' },
  fallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 10, left: 10, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  badgeSale: { backgroundColor: '#D95447' },
  badgeFeatured: { backgroundColor: '#DDA849' },
  badgeMuted: { backgroundColor: '#8D837A' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  favorite: { position: 'absolute', top: 9, right: 9, width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFCF7', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E6D8C7' },
  info: { padding: 13, gap: 5 },
  category: { color: '#9A7A60', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  name: { color: '#30251D', fontSize: 14, lineHeight: 20, fontWeight: '700', minHeight: 40 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stars: { color: '#D99B2B', fontSize: 11, letterSpacing: -1 },
  ratingText: { color: '#887568', fontSize: 11 },
  price: { color: '#755036', fontSize: 16, fontWeight: '900' },
  originalPrice: { color: '#9C9188', fontSize: 11, textDecorationLine: 'line-through' },
  priceSpacer: { height: 14 },
  cartButton: { marginTop: 5, minHeight: 38, borderRadius: 10, backgroundColor: '#755036', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  cartButtonText: { color: '#FFFCF7', fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.72 },
  skeletonCard: { pointerEvents: 'none' },
  skeleton: { backgroundColor: '#EDE3D7' },
  skeletonLine: { height: 13, borderRadius: 8, backgroundColor: '#EDE3D7', marginVertical: 3 },
}));
