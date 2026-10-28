import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { openLegacy } from '../api';
import { useStore } from '../store';
import { withTypography } from '../typography';

export function Header({ compact, categories }: { compact: boolean; categories: string[] }) {
  const router = useRouter();
  const { cart, user, logout } = useStore();
  const [keyword, setKeyword] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const search = () => {
    const value = keyword.trim();
    router.push({ pathname: '/products', params: value ? { keyword: value } : {} });
  };

  return (
    <View style={styles.shell}>
      {!compact && <View style={styles.topStrip}><Text style={styles.topText}>🚚 Miễn phí giao hàng từ 500K</Text><Text style={styles.topText}>✓ Bảo hành chính hãng</Text><Text style={styles.topText}>Hotline: 1800 6868</Text><Text style={styles.topRight}>Theo dõi đơn hàng  ·  Trợ giúp</Text></View>}
      <View style={[styles.nav, compact && styles.navCompact]}>
        <Pressable accessibilityRole="link" accessibilityLabel="Gia dụng Việt - Trang chủ" onPress={() => router.replace('/')} style={styles.brand}>
          <View style={styles.brandMark}><Ionicons name="home-outline" size={24} color="#FFFCF7" /></View>
          <Text style={styles.brandText}>Gia dụng{compact ? ' ' : '\n'}<Text style={styles.brandAccent}>Việt</Text></Text>
        </Pressable>

        {!compact && <View style={styles.search}><TextInput accessibilityLabel="Tìm kiếm sản phẩm" returnKeyType="search" onSubmitEditing={search} value={keyword} onChangeText={setKeyword} placeholder="Tìm sản phẩm, thương hiệu, danh mục..." placeholderTextColor="#9B8A7C" style={styles.searchInput} /><Pressable accessibilityRole="button" accessibilityLabel="Tìm kiếm" onPress={search} style={styles.searchButton}><Ionicons name="search" size={18} color="#fff" /></Pressable></View>}

        {!compact && <View style={styles.links}><Nav label="Trang chủ" path="/" /><Nav label="Sản phẩm" path="/products" /><Nav label="Giới thiệu" path="/about" /><Nav label="Liên hệ" path="/contact" /><Nav label="Đơn hàng" path="/orders" /></View>}

        <View style={styles.actions}>
          <Pressable accessibilityRole="link" accessibilityLabel={user ? 'Tài khoản' : 'Đăng nhập'} onPress={() => user ? void openLegacy('/profile') : router.push('/login')} style={styles.actionButton}><Ionicons name="person-outline" size={22} color="#30251D" />{!compact && <Text numberOfLines={1} style={styles.actionLabel}>{user?.fullName || 'Đăng nhập'}</Text>}</Pressable>
          {!!user && <Pressable accessibilityRole="button" accessibilityLabel="Đăng xuất" onPress={() => void logout()} style={styles.iconButton}><Ionicons name="log-out-outline" size={22} color="#755036" /></Pressable>}
          <Pressable accessibilityRole="link" accessibilityLabel="Giỏ hàng" onPress={() => router.push('/cart')} style={styles.iconButton}><Ionicons name="bag-handle-outline" size={23} color="#30251D" />{!!cart?.itemCount && <View style={styles.count}><Text style={styles.countText}>{cart.itemCount}</Text></View>}</Pressable>
          {compact && <Pressable accessibilityRole="button" accessibilityLabel={menuOpen ? 'Đóng menu' : 'Mở menu'} onPress={() => setMenuOpen(value => !value)} style={styles.iconButton}><Ionicons name={menuOpen ? 'close' : 'menu'} size={26} color="#30251D" /></Pressable>}
        </View>
      </View>

      {compact && <View style={styles.mobileSearch}><TextInput accessibilityLabel="Tìm kiếm sản phẩm" returnKeyType="search" onSubmitEditing={search} value={keyword} onChangeText={setKeyword} placeholder="Tìm sản phẩm cho nhà bạn..." placeholderTextColor="#9B8A7C" style={styles.searchInput} /><Pressable accessibilityRole="button" accessibilityLabel="Tìm kiếm" onPress={search} style={styles.searchButton}><Ionicons name="search" size={18} color="#fff" /></Pressable></View>}

      {compact && menuOpen && <View style={styles.menu}><Nav label="Tất cả sản phẩm" path="/products" />{categories.map(category => <Nav key={category} label={category} path={`/products?category=${encodeURIComponent(category)}`} />)}<Nav label="Đơn hàng" path="/orders" /><Nav label="Liên hệ" path="/contact" />{!user && <Pressable onPress={() => router.push('/register')} style={styles.navLink}><Text style={styles.navLinkText}>Đăng ký</Text></Pressable>}</View>}
    </View>
  );
}

function Nav({ label, path }: { label: string; path: string }) {
  const router = useRouter();
  const open = () => path.startsWith('/products') ? router.push(path as Href) : void openLegacy(path);
  return <Pressable accessibilityRole="link" onPress={open} style={({ pressed }) => [styles.navLink, pressed && styles.pressed]}><Text style={styles.navLinkText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create(withTypography({
  shell: { width: '100%', backgroundColor: '#FFFCF7', borderBottomColor: '#E6D8C7', borderBottomWidth: 1, zIndex: 20 },
  topStrip: { minHeight: 32, backgroundColor: '#E8D5BA', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, gap: 28 },
  topText: { fontSize: 11, color: '#493629', fontWeight: '600' },
  topRight: { marginLeft: 'auto', fontSize: 11, color: '#493629', fontWeight: '600' },
  nav: { width: '100%', maxWidth: 1360, alignSelf: 'center', minHeight: 76, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 18 },
  navCompact: { minHeight: 66, paddingHorizontal: 14 },
  brand: { flexDirection: 'row', alignItems: 'center', minWidth: 138, gap: 8 },
  brandMark: { width: 42, height: 42, borderRadius: 9, backgroundColor: '#A56E2D', alignItems: 'center', justifyContent: 'center' },
  brandText: { color: '#30251D', fontSize: 17, lineHeight: 18, fontWeight: '900' },
  brandAccent: { color: '#755036' },
  search: { flex: 1, minWidth: 250, maxWidth: 470, height: 42, borderRadius: 12, borderColor: '#DDCDBB', borderWidth: 1, backgroundColor: '#fff', flexDirection: 'row', overflow: 'hidden' },
  mobileSearch: { marginHorizontal: 14, marginBottom: 12, height: 42, borderRadius: 12, borderColor: '#DDCDBB', borderWidth: 1, backgroundColor: '#fff', flexDirection: 'row', overflow: 'hidden' },
  searchInput: { flex: 1, paddingHorizontal: 14, color: '#30251D', fontSize: 13 },
  searchButton: { width: 50, backgroundColor: '#755036', alignItems: 'center', justifyContent: 'center' },
  links: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  navLink: { paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8 },
  navLinkText: { color: '#30251D', fontSize: 13, fontWeight: '700' },
  actions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionButton: { minHeight: 42, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  actionLabel: { color: '#30251D', fontSize: 12, fontWeight: '700', maxWidth: 100 },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  count: { position: 'absolute', top: 1, right: 0, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#A56E2D', alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  menu: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: '#E6D8C7', flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  pressed: { opacity: 0.65 },
}));
