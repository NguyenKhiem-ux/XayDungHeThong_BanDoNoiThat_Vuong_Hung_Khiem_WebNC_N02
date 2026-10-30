import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { confirmAction, imageUrl, openLegacy } from '../api';
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
      <View style={[styles.nav, compact && styles.navCompact]}>
        <Pressable accessibilityRole="link" accessibilityLabel="Gia dụng Việt - Trang chủ" onPress={() => router.replace('/')} style={styles.brand}>
          <Ionicons name="home-outline" size={24} color="#FFFFFF" />
          <Text style={styles.brandText}>Gia dụng Việt</Text>
        </Pressable>

        {!compact && <View style={styles.search}><TextInput accessibilityLabel="Tìm kiếm sản phẩm" returnKeyType="search" onSubmitEditing={search} value={keyword} onChangeText={setKeyword} placeholder="Tìm sản phẩm, thương hiệu, danh mục..." placeholderTextColor="#A1A1A6" style={styles.searchInput} /><Pressable accessibilityRole="button" accessibilityLabel="Tìm kiếm" onPress={search} style={styles.searchButton}><Ionicons name="search" size={18} color="#A1A1A6" /></Pressable></View>}

        {!compact && <View style={styles.links}><Nav label="Trang chủ" path="/" /><Nav label="Sản phẩm" path="/products" /><Nav label="Giới thiệu" path="/about" /><Nav label="Liên hệ" path="/contact" /><Nav label="Đơn hàng" path="/orders" /></View>}

        <View style={styles.actions}>
          <Pressable accessibilityRole="link" accessibilityLabel={user ? 'Tài khoản' : 'Đăng nhập'} onPress={() => user ? router.push('/profile') : router.push('/login')} style={styles.actionButton}>{user?.avatarUrl ? <HeaderAvatar uri={user.avatarUrl} /> : <Ionicons name="person-outline" size={22} color="#F5F5F7" />}{!compact && <Text numberOfLines={1} style={styles.actionLabel}>{user?.fullName || 'Đăng nhập'}</Text>}</Pressable>
          {!!user && <Pressable accessibilityRole="button" accessibilityLabel="Đăng xuất" onPress={() => void confirmAction('Đăng xuất khỏi tài khoản?').then(ok => { if (ok) void logout(); })} style={styles.iconButton}><Ionicons name="log-out-outline" size={22} color="#F5F5F7" /></Pressable>}
          <Pressable accessibilityRole="link" accessibilityLabel="Giỏ hàng" onPress={() => router.push('/cart')} style={styles.iconButton}><Ionicons name="bag-handle-outline" size={23} color="#F5F5F7" />{!!cart?.itemCount && <View style={styles.count}><Text style={styles.countText}>{cart.itemCount}</Text></View>}</Pressable>
          {compact && <Pressable accessibilityRole="button" accessibilityLabel={menuOpen ? 'Đóng menu' : 'Mở menu'} onPress={() => setMenuOpen(value => !value)} style={styles.iconButton}><Ionicons name={menuOpen ? 'close' : 'menu'} size={26} color="#F5F5F7" /></Pressable>}
        </View>
      </View>

      {compact && <View style={styles.mobileSearch}><TextInput accessibilityLabel="Tìm kiếm sản phẩm" returnKeyType="search" onSubmitEditing={search} value={keyword} onChangeText={setKeyword} placeholder="Tìm sản phẩm cho nhà bạn..." placeholderTextColor="#A1A1A6" style={styles.searchInput} /><Pressable accessibilityRole="button" accessibilityLabel="Tìm kiếm" onPress={search} style={styles.searchButton}><Ionicons name="search" size={18} color="#A1A1A6" /></Pressable></View>}

      {compact && menuOpen && <View style={styles.menu}><Nav label="Tất cả sản phẩm" path="/products" />{categories.map(category => <Nav key={category} label={category} path={`/products?category=${encodeURIComponent(category)}`} />)}<Nav label="Giới thiệu" path="/about" /><Nav label="Đơn hàng" path="/orders" /><Nav label="Liên hệ" path="/contact" />{!user && <Pressable onPress={() => router.push('/register')} style={styles.navLink}><Text style={styles.navLinkText}>Đăng ký</Text></Pressable>}</View>}
    </View>
  );
}

function HeaderAvatar({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return failed
    ? <Ionicons name="person-outline" size={22} color="#F5F5F7" />
    : <Image accessibilityLabel="Ảnh đại diện tài khoản" source={{ uri: imageUrl(uri) }} onError={() => setFailed(true)} style={styles.accountAvatar} />;
}

function Nav({ label, path }: { label: string; path: string }) {
  const router = useRouter();
  const open = () => path === '/' || path.startsWith('/products') || path.startsWith('/orders') || ['/about', '/contact', '/policies'].includes(path) ? router.push(path as Href) : void openLegacy(path);
  return <Pressable accessibilityRole="link" onPress={open} style={({ pressed }) => [styles.navLink, pressed && styles.pressed]}><Text style={styles.navLinkText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create(withTypography({
  shell: { width: '100%', backgroundColor: '#000000', borderBottomColor: '#38383A', borderBottomWidth: 1, zIndex: 20 },
  nav: { width: '100%', maxWidth: 1240, alignSelf: 'center', minHeight: 64, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 20 },
  navCompact: { minHeight: 56, paddingHorizontal: 14 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  search: { flex: 1, minWidth: 220, maxWidth: 420, height: 38, borderRadius: 19, backgroundColor: '#1C1C1E', flexDirection: 'row-reverse', alignItems: 'center', overflow: 'hidden' },
  mobileSearch: { marginHorizontal: 14, marginBottom: 12, height: 40, borderRadius: 20, backgroundColor: '#1C1C1E', flexDirection: 'row-reverse', alignItems: 'center', overflow: 'hidden' },
  searchInput: { flex: 1, height: '100%', paddingRight: 14, color: '#F5F5F7', fontSize: 15 },
  searchButton: { width: 40, height: '100%', alignItems: 'center', justifyContent: 'center' },
  links: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  navLink: { paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8 },
  navLinkText: { color: '#F5F5F7', fontSize: 15, fontWeight: '600' },
  actions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionButton: { minHeight: 44, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  accountAvatar: { width: 29, height: 29, borderRadius: 15, backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#38383A' },
  actionLabel: { color: '#F5F5F7', fontSize: 14, fontWeight: '600', maxWidth: 120 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  count: { position: 'absolute', top: 3, right: 1, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#000000', fontSize: 12, fontWeight: '900' },
  menu: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: '#38383A', flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  pressed: { opacity: 0.65 },
}));
