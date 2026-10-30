import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme';
import { withTypography } from '../../typography';
import type { User } from '../../types';

const adminItems = [
  ['Dashboard', 'grid-outline', '/admin'],
  ['Products', 'cube-outline', '/admin/products'],
  ['Orders', 'receipt-outline', '/admin/orders'],
  ['Users', 'people-outline', '/admin/users'],
  ['Coupons', 'ticket-outline', '/admin/coupons'],
  ['Promotions', 'flash-outline', '/admin/promotions'],
  ['Revenue', 'bar-chart-outline', '/admin/revenue'],
  ['Messages', 'mail-outline', '/admin/messages'],
  ['Kiến thức Chatbot', 'book-outline', '/admin/chatbot-knowledge'],
] as const;

export function AdminLayout({ user, onLogout, children }: { user: User; onLogout: () => void; children: ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const compact = useWindowDimensions().width < 900;
  const [drawerOpen, setDrawerOpen] = useState(false);

  return <View style={styles.page}>
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.headerInner}>
        {compact && <Pressable accessibilityRole="button" accessibilityLabel="Mở menu quản trị" onPress={() => setDrawerOpen(true)} style={styles.headerButton}><Ionicons name="menu" size={23} color={colors.white} /></Pressable>}
        <Pressable accessibilityRole="link" accessibilityLabel="Dashboard quản trị" onPress={() => router.replace('/admin')} style={styles.brand}><View style={styles.brandMark}><Ionicons name="home-outline" size={21} color={colors.header} /></View><View><Text style={styles.brandName}>Gia dụng Việt</Text><Text style={styles.brandLabel}>QUẢN TRỊ</Text></View></Pressable>
        <View style={styles.headerSpacer} />
        {!compact && <View style={styles.adminIdentity}><View style={styles.adminAvatar}><Text style={styles.adminInitial}>{(user.fullName || user.username || 'A').slice(0, 1).toUpperCase()}</Text></View><View><Text numberOfLines={1} style={styles.adminName}>{user.fullName || user.username || 'Admin'}</Text><Text numberOfLines={1} style={styles.adminEmail}>{user.email}</Text></View></View>}
        <Pressable accessibilityRole="link" accessibilityLabel="Về trang chủ" onPress={() => router.replace('/')} style={styles.headerButton}><Ionicons name="storefront-outline" size={20} color={colors.onDark} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Đăng xuất" onPress={onLogout} style={styles.headerButton}><Ionicons name="log-out-outline" size={20} color={colors.accentBright} /></Pressable>
      </View>
    </View>

    <View style={styles.body}>
      {!compact && <AdminSidebar />}
      <View style={styles.content}>{children}</View>
    </View>

    {compact && drawerOpen && <View style={styles.drawerLayer}><Pressable accessibilityRole="button" accessibilityLabel="Đóng menu quản trị" onPress={() => setDrawerOpen(false)} style={styles.scrim} /><View style={[styles.drawer, { paddingTop: insets.top + 14 }]}><View style={styles.drawerHeading}><Text style={styles.drawerTitle}>Quản trị</Text><Pressable accessibilityRole="button" accessibilityLabel="Đóng menu" onPress={() => setDrawerOpen(false)} style={styles.headerButton}><Ionicons name="close" size={23} color={colors.white} /></Pressable></View><AdminSidebar fill onSelect={() => setDrawerOpen(false)} /></View></View>}
  </View>;
}

function AdminSidebar({ onSelect, fill = false }: { onSelect?: () => void; fill?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  return <View style={[styles.sidebar, fill && styles.sidebarFill]}><Text style={styles.sidebarEyebrow}>ADMIN WORKSPACE</Text><View style={styles.navList}>{adminItems.map(([label, icon, path]) => {
    const active = path === '/admin' ? pathname === path : Boolean(path && pathname.startsWith(path));
    return <Pressable key={label} accessibilityRole={path ? 'link' : undefined} accessibilityState={{ disabled: !path, selected: active }} disabled={!path} onPress={() => { if (path) router.replace(path); onSelect?.(); }} style={[styles.navItem, active && styles.navItemActive, !path && styles.navItemDisabled]}><Ionicons name={icon} size={19} color={active ? colors.accentBright : colors.onDarkMuted} /><Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>{!path && <Text style={styles.soon}>SẮP CÓ</Text>}</Pressable>;
  })}</View><View style={styles.sidebarNote}><Ionicons name="shield-checkmark-outline" size={18} color={colors.accentBright} /><Text style={styles.sidebarNoteText}>Phiên quản trị được xác minh bằng JWT và quyền ADMIN.</Text></View></View>;
}

const styles = StyleSheet.create(withTypography({
  page: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.header, borderBottomWidth: 1, borderBottomColor: colors.headerLine, zIndex: 20 },
  headerInner: { minHeight: 70, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 9 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentBright },
  brandName: { color: colors.white, fontSize: 15, fontWeight: '800' },
  brandLabel: { color: colors.accentBright, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginTop: 1 },
  headerSpacer: { flex: 1 },
  headerButton: { width: 42, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.headerRaised, borderWidth: 1, borderColor: colors.headerLine },
  adminIdentity: { maxWidth: 260, paddingRight: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  adminAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  adminInitial: { color: colors.white, fontSize: 13, fontWeight: '800' },
  adminName: { color: colors.onDark, fontSize: 11, fontWeight: '800', maxWidth: 180 },
  adminEmail: { color: colors.onDarkMuted, fontSize: 9, marginTop: 2, maxWidth: 180 },
  body: { flex: 1, flexDirection: 'row', minHeight: 0 },
  content: { flex: 1, minWidth: 0 },
  sidebar: { width: 258, padding: 16, backgroundColor: colors.header, borderRightWidth: 1, borderRightColor: colors.headerLine },
  sidebarFill: { flex: 1, width: '100%' },
  sidebarEyebrow: { color: colors.onDarkMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.4, margin: 8 },
  navList: { gap: 5 },
  navItem: { minHeight: 46, paddingHorizontal: 11, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  navItemActive: { backgroundColor: colors.headerRaised, borderLeftWidth: 3, borderLeftColor: colors.accentBright },
  navItemDisabled: { opacity: .7 },
  navText: { flex: 1, color: colors.onDark, fontSize: 11, fontWeight: '700' },
  navTextActive: { color: colors.accentBright },
  soon: { color: colors.onDarkMuted, fontSize: 7, fontWeight: '800', letterSpacing: .5 },
  sidebarNote: { marginTop: 'auto', padding: 12, borderRadius: 8, backgroundColor: colors.headerRaised, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  sidebarNoteText: { flex: 1, color: colors.onDarkMuted, fontSize: 9, lineHeight: 15 },
  drawerLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, flexDirection: 'row' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,.52)' },
  drawer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 286, maxWidth: '86%', backgroundColor: colors.header },
  drawerHeading: { paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  drawerTitle: { color: colors.white, fontSize: 18, fontWeight: '800' },
}));
