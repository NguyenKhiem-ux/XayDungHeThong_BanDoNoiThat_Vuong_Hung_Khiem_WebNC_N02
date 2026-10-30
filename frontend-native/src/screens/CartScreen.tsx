import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { formatVnd, imageUrl } from '../api';
import { ChatWidget } from '../components/ChatWidget';
import { PageHeader } from '../components/PageHeader';
import { ProductFooter } from '../components/ProductFooter';
import { useStore } from '../store';
import { withTypography } from '../typography';
import { ScrollTopButton, useScrollTop } from '../components/ScrollTopButton';
import { colors } from '../theme';

export default function CartScreen() {
  const top = useScrollTop();
  const router = useRouter();
  const compact = useWindowDimensions().width < 760;
  const { authReady, cart, cartError, cartLoading, notice, refreshCart, removeFromCart, updateCart, user } = useStore();
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (authReady && user) void refreshCart().catch(() => {});
  }, [authReady, refreshCart, user]);

  const changeQuantity = async (productId: number, quantity: number) => {
    const item = cart?.items.find(entry => entry.productId === productId);
    if (!item) return;
    const next = Math.max(1, Math.min(item.product.stock, Math.round(quantity)));
    if (next === item.quantity || busyId !== null) return;
    setBusyId(productId);
    try { await updateCart(productId, next); } finally { setBusyId(null); }
  };

  const removeItem = async (productId: number) => {
    if (busyId !== null) return;
    setBusyId(productId);
    try { await removeFromCart(productId); } finally { setBusyId(null); }
  };

  const title = user ? 'Giỏ hàng của bạn' : 'Giỏ hàng';
  // A null cart means it has not been hydrated yet, not that it is empty.
  const showLoading = !authReady || (!!user && !cart && !cartError) || (cartLoading && !cart);

  return (
    <View style={styles.page}>
      <PageHeader back />
      <ScrollView ref={top.ref} onScroll={top.onScroll} scrollEventThrottle={100} contentContainerStyle={[styles.scroll, compact && styles.scrollCompact]}>
        <View style={styles.content}>
          <View style={styles.hero}><Ionicons name="bag-handle-outline" size={compact ? 34 : 42} color={colors.ink} /><View><Text style={styles.eyebrow}>SHOPPING CART</Text><Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text><Text style={styles.subtitle}>Kiểm tra sản phẩm, cập nhật số lượng và chuẩn bị thanh toán.</Text></View></View>

          {showLoading ? <View style={styles.state}><ActivityIndicator size="large" color={colors.ink} /><Text style={styles.stateText}>Đang tải giỏ hàng...</Text></View> : !user ? <View style={styles.state}><Ionicons name="person-outline" size={42} color={colors.ink} /><Text style={styles.stateTitle}>Đăng nhập để xem giỏ hàng</Text><Text style={styles.stateText}>Giỏ hàng được đồng bộ theo tài khoản của bạn.</Text><View style={styles.stateActions}><Pressable style={styles.primaryButton} onPress={() => router.push({ pathname: '/login', params: { redirect: '/cart' } })}><Text style={styles.primaryButtonText}>Đăng nhập</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => router.push('/products')}><Text style={styles.secondaryButtonText}>Tiếp tục mua sắm</Text></Pressable></View></View> : cartError && !cart ? <View style={styles.state}><Ionicons name="alert-circle-outline" size={42} color={colors.danger} /><Text style={styles.stateTitle}>Chưa thể tải giỏ hàng</Text><Text style={styles.stateText}>{cartError}</Text><Pressable style={styles.primaryButton} onPress={() => void refreshCart().catch(() => {})}><Text style={styles.primaryButtonText}>Thử lại</Text></Pressable></View> : !cart ? <View style={styles.state}><ActivityIndicator size="large" color={colors.ink} /><Text style={styles.stateText}>Đang tải giỏ hàng...</Text></View> : !cart.items.length ? <View style={styles.state}><Ionicons name="bag-outline" size={46} color={colors.ink} /><Text style={styles.stateTitle}>Giỏ hàng đang trống</Text><Text style={styles.stateText}>Chọn một vài sản phẩm gia dụng yêu thích rồi quay lại đây nhé.</Text><Pressable style={styles.primaryButton} onPress={() => router.push('/products')}><Text style={styles.primaryButtonText}>Mua sắm ngay</Text></Pressable></View> : <View style={[styles.layout, compact && styles.layoutCompact]}>
            <View style={styles.itemsCard}>
              <View style={styles.itemsHeader}><Text style={styles.sectionTitle}>Sản phẩm ({cart.itemCount})</Text><Text style={styles.itemsTotal}>{formatVnd(cart.total)}</Text></View>
              {cart.items.map(item => <View key={item.productId} style={[styles.item, compact && styles.itemCompact]}>
                <Pressable accessibilityRole="link" accessibilityLabel={`Xem ${item.product.name}`} onPress={() => router.push({ pathname: '/products/[id]', params: { id: String(item.productId) } })} style={styles.thumb}>{item.product.imageUrl ? <Image source={{ uri: imageUrl(item.product.imageUrl) }} resizeMode="contain" style={styles.image} /> : <Ionicons name="image-outline" size={32} color={colors.muted} />}</Pressable>
                <View style={styles.itemInfo}><Pressable onPress={() => router.push({ pathname: '/products/[id]', params: { id: String(item.productId) } })}><Text numberOfLines={2} style={styles.itemName}>{item.product.name}</Text></Pressable><Text style={styles.category}>{item.product.category || 'Gia dụng'}</Text><Text style={styles.stock}>{item.product.stock > 0 ? `Còn ${item.product.stock} sản phẩm` : 'Hết hàng'}</Text><Text style={styles.unitPrice}>{formatVnd(item.product.price)}</Text>{item.product.stock > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`Mua riêng ${item.product.name}`} disabled={busyId !== null} onPress={() => router.push({ pathname: '/checkout/info', params: { productId: String(item.productId) } })} style={styles.buyOne}><Ionicons name="flash-outline" size={14} color={colors.ink} /><Text style={styles.buyOneText}>Mua riêng</Text></Pressable>}</View>
                <View style={[styles.controls, compact && styles.controlsCompact]}><View style={styles.quantity}><Pressable accessibilityLabel="Giảm số lượng" disabled={busyId === item.productId || item.quantity <= 1} onPress={() => void changeQuantity(item.productId, item.quantity - 1)} style={styles.quantityButton}><Ionicons name="remove" size={17} color={colors.ink} /></Pressable><Text style={styles.quantityValue}>{item.quantity}</Text><Pressable accessibilityLabel="Tăng số lượng" disabled={busyId === item.productId || item.quantity >= item.product.stock} onPress={() => void changeQuantity(item.productId, item.quantity + 1)} style={styles.quantityButton}><Ionicons name="add" size={17} color={colors.ink} /></Pressable></View><Text style={styles.subtotal}>{formatVnd(item.subtotal)}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Xóa ${item.product.name}`} disabled={busyId === item.productId} onPress={() => void removeItem(item.productId)} style={styles.remove}><Ionicons name="trash-outline" size={19} color={colors.danger} /></Pressable></View>
              </View>)}
              <Pressable onPress={() => router.push('/products')} style={styles.continue}><Ionicons name="arrow-back" size={18} color={colors.ink} /><Text style={styles.continueText}>Tiếp tục mua sắm</Text></Pressable>
            </View>
            <View style={styles.summary}><Text style={styles.sectionTitle}>Tóm tắt đơn hàng</Text><View style={styles.summaryLine}><Text style={styles.summaryLabel}>Số lượng</Text><Text style={styles.summaryValue}>{cart.itemCount}</Text></View><View style={styles.summaryLine}><Text style={styles.summaryLabel}>Tạm tính</Text><Text style={styles.summaryValue}>{formatVnd(cart.total)}</Text></View>{!!cart.saleSavings && <View style={styles.summaryLine}><Text style={styles.summaryLabel}>Đã giảm chương trình</Text><Text style={styles.discountValue}>-{formatVnd(cart.saleSavings)}</Text></View>}<View style={styles.summaryLine}><Text style={styles.summaryLabel}>Phí vận chuyển</Text><Text style={styles.summaryValue}>Xác nhận ở bước 2</Text></View><View style={[styles.summaryLine, styles.totalLine]}><Text style={styles.totalLabel}>Tổng dự kiến</Text><Text style={styles.totalValue}>{formatVnd(cart.total)}</Text></View><Pressable accessibilityRole="button" onPress={() => router.push('/checkout/info')} style={styles.checkout}><Ionicons name="card-outline" size={19} color={colors.white} /><Text style={styles.checkoutText}>Tiến hành thanh toán</Text></Pressable><View style={styles.trust}><Trust icon="car-outline" title="Giao hàng nhanh" text="Dự kiến 2 - 5 ngày" /><Trust icon="shield-checkmark-outline" title="Thanh toán an toàn" text="Bảo mật thông tin khách hàng" /><Trust icon="headset-outline" title="Hỗ trợ 24/7" text="Luôn sẵn sàng hỗ trợ bạn" /></View></View>
          </View>}
        </View>
        <ProductFooter />
      </ScrollView>
      <ScrollTopButton visible={top.visible} onPress={top.toTop} />
      <ChatWidget compact={compact} />
      {!!notice && <View accessibilityLiveRegion="polite" style={styles.toast}><Ionicons name="information-circle-outline" size={18} color={colors.white} /><Text style={styles.toastText}>{notice}</Text></View>}
    </View>
  );
}

function Trust({ icon, title, text }: { icon: 'car-outline' | 'shield-checkmark-outline' | 'headset-outline'; title: string; text: string }) {
  return <View style={styles.trustItem}><Ionicons name={icon} size={22} color={colors.ink} /><View><Text style={styles.trustTitle}>{title}</Text><Text style={styles.trustText}>{text}</Text></View></View>;
}

const styles = StyleSheet.create(withTypography({
  page: { flex: 1, backgroundColor: colors.bg }, scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20 }, scrollCompact: { paddingHorizontal: 12, paddingTop: 14 }, content: { width: '100%', maxWidth: 1240, alignSelf: 'center', paddingBottom: 40 }, hero: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, paddingHorizontal: 4 }, eyebrow: { color: colors.ink, fontSize: 12, letterSpacing: 1.8, fontWeight: '800' }, title: { color: colors.ink, fontSize: 34, lineHeight: 41, fontWeight: '900', marginTop: 2 }, titleCompact: { fontSize: 27, lineHeight: 34 }, subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 3 }, layout: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 }, layoutCompact: { flexDirection: 'column' }, itemsCard: { flex: 1, minWidth: 0, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white }, itemsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: colors.line }, sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' }, itemsTotal: { color: colors.ink, fontSize: 17, fontWeight: '900' }, item: { minHeight: 145, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: colors.line }, itemCompact: { flexWrap: 'wrap', alignItems: 'flex-start' }, thumb: { width: 112, height: 112, borderRadius: 12, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, image: { width: '92%', height: '92%' }, itemInfo: { flex: 1, minWidth: 150 }, itemName: { color: colors.ink, fontSize: 15, lineHeight: 21, fontWeight: '800' }, category: { color: colors.muted, fontSize: 11, marginTop: 5 }, stock: { color: colors.success, fontSize: 11, marginTop: 5, fontWeight: '700' }, unitPrice: { color: colors.ink, fontSize: 15, fontWeight: '900', marginTop: 8 }, controls: { minWidth: 145, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }, controlsCompact: { width: '100%', paddingLeft: 0, justifyContent: 'space-between' }, quantity: { height: 38, flexDirection: 'row', alignItems: 'center', borderRadius: 9, borderWidth: 1, borderColor: colors.subtle, backgroundColor: colors.white, overflow: 'hidden' }, quantityButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }, quantityValue: { minWidth: 30, textAlign: 'center', color: colors.ink, fontSize: 13, fontWeight: '800' }, subtotal: { minWidth: 90, color: colors.ink, fontSize: 14, textAlign: 'right', fontWeight: '900' }, remove: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }, buyOne: { alignSelf: 'flex-start', marginTop: 8, minHeight: 32, paddingHorizontal: 11, borderRadius: 8, borderWidth: 1, borderColor: colors.subtle, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 5 }, buyOneText: { color: colors.ink, fontSize: 12, fontWeight: '800' }, continue: { alignSelf: 'flex-start', marginTop: 16, minHeight: 42, paddingHorizontal: 13, borderRadius: 9, borderWidth: 1, borderColor: colors.subtle, flexDirection: 'row', alignItems: 'center', gap: 8 }, continueText: { color: colors.ink, fontSize: 12, fontWeight: '800' }, summary: { width: 320, padding: 20, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white }, summaryLine: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, summaryLabel: { color: colors.muted, fontSize: 13 }, summaryValue: { color: colors.ink, fontSize: 14, fontWeight: '800' }, discountValue: { color: colors.success, fontSize: 14, fontWeight: '800' }, totalLine: { paddingTop: 17, borderTopWidth: 1, borderTopColor: colors.line }, totalLabel: { color: colors.ink, fontSize: 17, fontWeight: '900' }, totalValue: { color: colors.ink, fontSize: 21, fontWeight: '900' }, checkout: { marginTop: 20, minHeight: 49, borderRadius: 10, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, checkoutText: { color: colors.white, fontSize: 13, fontWeight: '800' }, trust: { marginTop: 20, padding: 12, borderRadius: 11, backgroundColor: colors.bg, gap: 15 }, trustItem: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: colors.line }, trustTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' }, trustText: { color: colors.muted, fontSize: 12, marginTop: 2 }, state: { minHeight: 340, padding: 24, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, gap: 10 }, stateTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', textAlign: 'center' }, stateText: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 460 }, stateActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 5 }, primaryButton: { minHeight: 43, paddingHorizontal: 19, borderRadius: 999, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }, primaryButtonText: { color: colors.white, fontSize: 12, fontWeight: '800' }, secondaryButton: { minHeight: 43, paddingHorizontal: 19, borderRadius: 999, borderWidth: 1, borderColor: colors.subtle, alignItems: 'center', justifyContent: 'center' }, secondaryButtonText: { color: colors.ink, fontSize: 12, fontWeight: '800' }, toast: { position: 'absolute', top: 90, alignSelf: 'center', maxWidth: '90%', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 10, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 120 }, toastText: { color: colors.white, fontSize: 12, fontWeight: '700' },
}));
