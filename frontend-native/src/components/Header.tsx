import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps, type ComponentRef, type ReactNode } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { confirmAction, imageUrl, openLegacy } from '../api';
import { useStore } from '../store';
import { withTypography } from '../typography';
import { colors } from '../theme';

// Hover chỉ có trên web: onHoverIn/onHoverOut không bao giờ chạy trên app nên app giữ kiểu chạm như cũ.
const isWeb = Platform.OS === 'web';

// Header theo layout storefront của frontend (UserLayout): dải thông tin, logo hai dòng, menu giữa, nút bên phải.
export function Header({ compact, categories }: { compact: boolean; categories: string[] }) {
  const router = useRouter();
  const { cart, user, logout } = useStore();
  const [keyword, setKeyword] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const search = () => {
    const value = keyword.trim();
    setMenuOpen(false);
    router.push({ pathname: '/products', params: value ? { keyword: value } : {} });
  };

  return (
    <View style={styles.shell}>

      <View style={[styles.nav, compact && styles.navCompact]}>
        <Pressable accessibilityRole="link" accessibilityLabel="Gia dụng Việt - Trang chủ" onPress={() => router.replace('/')} style={styles.brand}>
          <View style={styles.brandMark}><Ionicons name="flash" size={22} color={colors.accentBright} /></View>
          <View><Text style={styles.brandName}>Gia dụng</Text><Text style={styles.brandSub}>Việt</Text></View>
        </Pressable>

        {!compact && <View style={styles.links}><Nav label="Trang chủ" path="/" />{isWeb ? <ProductsMenu categories={categories} /> : <Nav label="Sản phẩm" path="/products" />}<Nav label="Giới thiệu" path="/about" /><Nav label="Liên hệ" path="/contact" /><Nav label="Đơn hàng" path="/orders" /></View>}

        <View style={styles.actions}>
          <IconButton label="Giỏ hàng" role="link" onPress={() => router.push('/cart')} icon={color => <><Ionicons name="bag-handle" size={21} color={color} />{!!cart?.itemCount && <View style={styles.count}><Text style={styles.countText}>{cart.itemCount}</Text></View>}</>} />
          <IconButton label={user ? 'Tài khoản' : 'Đăng nhập'} role="link" onPress={() => user ? router.push('/profile') : router.push('/login')} icon={color => user?.avatarUrl ? <HeaderAvatar uri={user.avatarUrl} /> : <Ionicons name={user ? 'person-circle' : 'person'} size={user ? 24 : 20} color={color} />} />
          {!!user && <IconButton label="Đăng xuất" onPress={() => void confirmAction('Đăng xuất khỏi tài khoản?').then(ok => { if (ok) void logout(); })} icon={color => <Ionicons name="log-out-outline" size={21} color={color} />} />}
          {!compact && <SearchBox collapsible={isWeb} keyword={keyword} onChange={setKeyword} onSubmit={search} />}
          {compact && <IconButton label={menuOpen ? 'Đóng menu' : 'Mở menu'} onPress={() => setMenuOpen(value => !value)} icon={color => <Ionicons name={menuOpen ? 'close' : 'menu'} size={26} color={color} />} />}
        </View>
      </View>

      {compact && <View style={styles.mobileSearchWrap}><SearchBox collapsible={false} keyword={keyword} onChange={setKeyword} onSubmit={search} placeholder="Tìm kiếm sản phẩm..." /></View>}

      {compact && menuOpen && <View style={styles.menu}><Nav label="Trang chủ" path="/" /><Nav label="Tất cả sản phẩm" path="/products" />{categories.map(category => <Nav key={category} label={category} path={`/products?category=${encodeURIComponent(category)}`} />)}<Nav label="Giới thiệu" path="/about" /><Nav label="Liên hệ" path="/contact" /><Nav label="Đơn hàng" path="/orders" /><Nav label="Giỏ hàng" path="/cart" />{!user && <Nav label="Đăng nhập" path="/login" />}{!user && <Nav label="Đăng ký" path="/register" />}</View>}
    </View>
  );
}

function IconButton({ label, role = 'button', onPress, icon }: { label: string; role?: 'button' | 'link'; onPress: () => void; icon: (color: string) => ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return <Pressable accessibilityRole={role} accessibilityLabel={label} onPress={onPress} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} style={({ pressed }) => [styles.iconButton, (hovered || pressed) && styles.iconButtonHover]}>{icon(hovered ? '#54C8E7' : colors.onDark)}</Pressable>;
}

// Web: thu gọn còn nút kính lúp, mở rộng khi rê chuột hoặc focus như nav-search bên frontend. App: luôn mở.
function SearchBox({ collapsible, keyword, onChange, onSubmit, placeholder = 'Tìm sản phẩm...' }: { collapsible: boolean; keyword: string; onChange: (value: string) => void; onSubmit: () => void; placeholder?: string }) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const expanded = !collapsible || hovered || focused;
  const press = () => expanded ? onSubmit() : input.current?.focus();
  // View + pointer event thay vì Pressable: Pressable của react-native-web tự tắt hover của cha khi chuột vào Pressable con (nút kính lúp).
  return <View onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} style={[styles.search, collapsible && styles.searchCollapsible, collapsible && expanded && styles.searchExpanded]}>
    <Pressable accessibilityRole="button" accessibilityLabel={expanded ? 'Tìm kiếm' : 'Mở tìm kiếm'} onPress={press} style={styles.searchButton}><Ionicons name="search" size={18} color={colors.brand} /></Pressable>
    <TextInput ref={input} accessibilityLabel="Tìm kiếm sản phẩm" returnKeyType="search" onSubmitEditing={onSubmit} value={keyword} onChangeText={onChange} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onKeyPress={e => { if (e.nativeEvent.key === 'Escape') input.current?.blur(); }} placeholder={placeholder} placeholderTextColor={colors.muted} style={styles.searchInput} />
  </View>;
}

// Chỉ dùng trên web: rê chuột vào "Sản phẩm" mở danh sách danh mục như nav-category-dropdown bên frontend.
function ProductsMenu({ categories }: { categories: string[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return <View onPointerEnter={() => setOpen(true)} onPointerLeave={() => setOpen(false)} style={styles.productsMenu}>
    <Nav label="Sản phẩm" path="/products" trailing={<Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={11} color={colors.onDark} />} />
    {open && <View style={styles.dropdownWrap}><View style={styles.dropdown}>
      <View style={styles.dropdownHeading}><Text style={styles.dropdownKicker}>Khám phá</Text><Text style={styles.dropdownHint}>Chọn danh mục sản phẩm</Text></View>
      <DropdownItem icon="layers" label="Tất cả sản phẩm" path="/products" />
      {categories.map(category => <DropdownItem key={category} icon="pricetag" label={category} path={`/products?category=${encodeURIComponent(category)}`} />)}
    </View></View>}
  </View>;
}

function DropdownItem({ icon, label, path }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; path: string }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  return <Pressable accessibilityRole="menuitem" onPress={() => router.push(path as Href)} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} style={[styles.dropdownItem, hovered && styles.dropdownItemHover]}>
    <Ionicons name={icon} size={14} color={colors.brand} />
    <Text numberOfLines={1} style={[styles.dropdownText, hovered && styles.dropdownTextHover]}>{label}</Text>
    <Ionicons name="arrow-forward" size={11} color={colors.brand} style={{ marginLeft: 'auto', opacity: hovered ? 1 : 0 }} />
  </Pressable>;
}

function HeaderAvatar({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return failed
    ? <Ionicons name="person-circle" size={24} color={colors.onDark} />
    : <Image accessibilityLabel="Ảnh đại diện tài khoản" source={{ uri: imageUrl(uri) }} onError={() => setFailed(true)} style={styles.accountAvatar} />;
}

function Nav({ label, path, trailing }: { label: string; path: string; trailing?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const active = path === '/' ? pathname === '/' : !path.includes('?') && pathname.startsWith(path);
  const open = () => path === '/' || ['/products', '/orders', '/cart', '/login', '/register'].some(prefix => path.startsWith(prefix)) || ['/about', '/contact', '/policies'].includes(path) ? router.push(path as Href) : void openLegacy(path);
  return <Pressable accessibilityRole="link" accessibilityState={{ selected: active }} onPress={open} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} style={({ pressed }) => [styles.navLink, (active || hovered || pressed) && styles.navLinkActive]}><Text style={[styles.navLinkText, (active || hovered) && styles.navLinkTextActive]}>{label}</Text>{trailing}</Pressable>;
}

const styles = StyleSheet.create(withTypography({
  shell: { width: '100%', backgroundColor: colors.header, borderBottomColor: colors.headerLine, borderBottomWidth: 1, zIndex: 20 },
  nav: { width: '100%', maxWidth: 1240, alignSelf: 'center', minHeight: 76, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 24, zIndex: 2 },
  navCompact: { minHeight: 64, paddingHorizontal: 14, gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  brandName: { color: '#F7F9FA', fontSize: 20, fontWeight: '800', lineHeight: 23 },
  brandSub: { color: colors.accentBright, fontSize: 12, fontWeight: '600', lineHeight: 14, marginTop: 3 },
  links: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  navLink: { paddingHorizontal: 9, paddingVertical: 10, borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 5 },
  navLinkActive: { backgroundColor: 'rgba(44, 185, 223, 0.16)' },
  navLinkText: { color: colors.onDark, fontSize: 13, fontWeight: '600' },
  navLinkTextActive: { color: colors.white },
  productsMenu: { position: 'relative' },
  // paddingTop nối khoảng trống giữa nút và hộp để rê chuột xuống không làm đóng menu.
  dropdownWrap: { position: 'absolute', top: '100%', left: '50%', transform: [{ translateX: -150 }], paddingTop: 10, zIndex: 60 },
  dropdown: { width: 300, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(15, 79, 63, 0.12)', backgroundColor: 'rgba(255, 255, 255, 0.98)', boxShadow: '0 20px 50px rgba(17, 27, 23, 0.16)' },
  dropdownHeading: { gap: 3, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  dropdownKicker: { color: colors.brand, fontSize: 11, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase' },
  dropdownHint: { color: colors.muted, fontSize: 12 },
  dropdownItem: { marginTop: 3, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dropdownItemHover: { paddingLeft: 16, backgroundColor: 'rgba(8, 127, 165, 0.09)' },
  dropdownText: { flexShrink: 1, color: colors.ink, fontSize: 13 },
  dropdownTextHover: { color: colors.brand },
  actions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconButton: { width: 44, height: 44, borderRadius: 6, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  iconButtonHover: { backgroundColor: 'rgba(255, 255, 255, 0.09)' },
  accountAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.headerRaised, borderWidth: 1, borderColor: colors.headerLine },
  count: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#11201B', fontSize: 11, fontWeight: '800' },
  search: { width: 230, height: 44, marginLeft: 4, borderRadius: 6, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  searchCollapsible: { width: 42, height: 38, borderRadius: 999, transitionProperty: 'width', transitionDuration: '320ms' },
  searchExpanded: { width: 238, boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)' },
  mobileSearchWrap: { paddingHorizontal: 14, paddingBottom: 12 },
  searchInput: { flex: 1, minWidth: 0, height: '100%', paddingRight: 12, color: colors.ink, fontSize: 14 },
  searchButton: { width: 40, height: '100%', alignItems: 'center', justifyContent: 'center' },
  menu: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: colors.headerLine, gap: 2 },
}));
