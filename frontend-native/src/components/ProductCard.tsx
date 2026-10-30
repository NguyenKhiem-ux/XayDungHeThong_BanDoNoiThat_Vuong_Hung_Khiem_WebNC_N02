import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { formatVnd, imageUrl, ratingStars } from '../api';
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
          <View style={styles.fallback}><Ionicons name="home-outline" size={34} color="#6E6E73" /></View>
        )}
        <View style={[styles.badge, soldOut ? styles.badgeMuted : deal || product.discountPercent ? styles.badgeSale : styles.badgeFeatured]}>
          <Text style={[styles.badgeText, !soldOut && !deal && !product.discountPercent && styles.badgeTextDark]}>{soldOut ? 'Hết hàng' : product.discountPercent ? `-${product.discountPercent}%` : product.isFeatured ? 'Nổi bật' : 'Mới'}</Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
        accessibilityState={{ selected: saved }}
        onPress={() => { if (requireAccount()) void toggleFavorite(product.id); }}
        style={({ pressed }) => [styles.favorite, pressed && styles.pressed]}
      >
        <Ionicons name={saved ? 'heart' : 'heart-outline'} size={18} color={saved ? '#9B382F' : '#1D1D1F'} />
      </Pressable>

      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.category}>{product.category || 'Gia dụng'}</Text>
        <Pressable accessibilityRole="link" onPress={() => router.push(detailRoute)}>
          <Text numberOfLines={2} style={styles.name}>{product.name}</Text>
        </Pressable>
        <View style={styles.ratingRow}>
          <Text accessibilityLabel={`${product.averageRating ?? 0} trên 5 sao`} style={styles.stars}>{ratingStars(product.averageRating)}</Text>
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
          <Ionicons name="cart-outline" size={17} color="#FFFFFF" />
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
  // "Kệ trắng": sản phẩm đặt trên khối xám nhạt, thẻ không viền không bóng, giá là chữ đậm nhất.
  card: { minWidth: 178, position: 'relative' },
  media: { aspectRatio: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: '#F5F5F7', alignItems: 'center', justifyContent: 'center' },
  image: { width: '80%', height: '80%' },
  fallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 12, left: 12, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeSale: { backgroundColor: '#1D1D1F' },
  badgeFeatured: { backgroundColor: '#FFFFFF' },
  badgeMuted: { backgroundColor: '#6E6E73' },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  badgeTextDark: { color: '#1D1D1F' },
  favorite: { position: 'absolute', top: 10, right: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  info: { paddingTop: 12, paddingHorizontal: 2, gap: 4 },
  category: { color: '#6E6E73', fontSize: 13 },
  name: { color: '#1D1D1F', fontSize: 16, lineHeight: 22, fontWeight: '600', minHeight: 44 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stars: { color: '#D99B2B', fontSize: 13, letterSpacing: -1 },
  ratingText: { color: '#6E6E73', fontSize: 13 },
  price: { color: '#1D1D1F', fontSize: 20, fontWeight: '900' },
  originalPrice: { color: '#6E6E73', fontSize: 13, textDecorationLine: 'line-through' },
  priceSpacer: { height: 18 },
  cartButton: { marginTop: 8, minHeight: 44, borderRadius: 999, backgroundColor: '#1D1D1F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  cartButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.72 },
  skeletonCard: { pointerEvents: 'none' },
  skeleton: { backgroundColor: '#E8E8ED' },
  skeletonLine: { height: 13, borderRadius: 8, backgroundColor: '#E8E8ED', marginVertical: 3 },
}));
