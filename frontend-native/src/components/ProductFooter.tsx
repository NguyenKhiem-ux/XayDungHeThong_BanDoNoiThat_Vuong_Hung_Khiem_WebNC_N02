import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { openLegacy } from '../api';
import { withTypography } from '../typography';

const columns = [
  ['Danh mục', [['Nồi cơm điện', '/products?category=Nồi cơm điện'], ['Máy hút bụi', '/products?category=Máy hút bụi'], ['Đồ dùng nhà bếp', '/products?category=Đồ dùng nhà bếp'], ['Quạt điện', '/products?category=Quạt điện']]],
  ['Hỗ trợ', [['Về chúng tôi', '/about'], ['Liên hệ', '/contact'], ['Chính sách giao hàng', '/policies'], ['Chính sách đổi trả', '/policies']]],
] as const;

export function ProductFooter() {
  const router = useRouter();
  const open = (path: string) => path.startsWith('/products') || ['/about', '/contact', '/policies'].includes(path) ? router.push(path as Href) : void openLegacy(path);
  return <View style={styles.footer}><View style={styles.grid}><View style={styles.brand}><View style={styles.brandRow}><View style={styles.mark}><Ionicons name="home-outline" size={22} color="#FFFFFF" /></View><Text style={styles.brandName}>Gia dụng Việt</Text></View><Text style={styles.note}>Shop thương mại điện tử chuyên đồ gia dụng, thiết bị nhà bếp và thiết bị chăm sóc nhà cửa chính hãng.</Text></View>{columns.map(([title, links]) => <View key={title} style={styles.column}><Text style={styles.title}>{title}</Text>{links.map(([label, path]) => <Pressable key={label} onPress={() => open(path)}><Text style={styles.link}>{label}</Text></Pressable>)}</View>)}<View style={styles.column}><Text style={styles.title}>Liên hệ</Text>{['123 Nguyễn Trãi, Thanh Xuân, Hà Nội', '1800 6868', 'support@giadungviet.vn', '8:00 - 22:00 mỗi ngày'].map(item => <Text key={item} style={styles.link}>{item}</Text>)}</View></View><Text style={styles.copy}>© 2023 Gia dụng Việt. All rights reserved.</Text></View>;
}

const styles = StyleSheet.create(withTypography({
  // Footer tối theo kiểu reactnative.dev: nền #20232A, tiêu đề cột chữ hoa xám, link trắng.
  footer: { marginTop: 40, marginHorizontal: -12, marginBottom: -16, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 28, backgroundColor: '#20232A' },
  grid: { width: '100%', maxWidth: 1200, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 32 }, brand: { flexGrow: 1, minWidth: 220, maxWidth: 390 }, brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, mark: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }, brandName: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' }, note: { marginTop: 10, color: '#A1A1A6', fontSize: 14, lineHeight: 22 }, column: { minWidth: 160, gap: 6 }, title: { color: '#A1A1A6', fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }, link: { color: '#FFFFFF', fontSize: 14, lineHeight: 24 }, copy: { width: '100%', maxWidth: 1200, alignSelf: 'center', color: '#A1A1A6', fontSize: 12, textAlign: 'center', marginTop: 32, paddingTop: 18, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.12)' },
}));
