import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { openLegacy } from '../api';
import { withTypography } from '../typography';
import { colors } from '../theme';

const columns = [
  ['Danh mục', [['Nồi cơm điện', '/products?category=Nồi cơm điện'], ['Máy hút bụi', '/products?category=Máy hút bụi'], ['Máy xay sinh tố', '/products?category=Máy xay sinh tố'], ['Đồ dùng nhà bếp', '/products?category=Đồ dùng nhà bếp'], ['Quạt điện', '/products?category=Quạt điện']]],
  ['Hỗ trợ', [['Về chúng tôi', '/about'], ['Liên hệ', '/contact'], ['Chính sách giao hàng', '/policies'], ['Chính sách đổi trả', '/policies'], ['Chính sách bảo hành & thanh toán', '/policies']]],
] as const;
const contacts = [['location', '123 Nguyễn Trãi, Thanh Xuân, Hà Nội'], ['call', '1800 6868'], ['mail', 'support@giadungviet.vn'], ['time', '8:00 - 22:00 mỗi ngày']] as const;
const socials = [['logo-facebook', 'Facebook'], ['logo-youtube', 'YouTube'], ['logo-instagram', 'Instagram'], ['logo-tiktok', 'TikTok']] as const;

// Footer theo site-footer của frontend: cột thương hiệu + mạng xã hội, ba cột link, dòng bản quyền hai bên.
export function ProductFooter() {
  const router = useRouter();
  const open = (path: string) => path.startsWith('/products') || ['/about', '/contact', '/policies'].includes(path) ? router.push(path as Href) : void openLegacy(path);
  return <View style={styles.footer}>
    <View style={styles.grid}>
      <View style={styles.brand}>
        <View style={styles.brandRow}><Ionicons name="flash" size={22} color={colors.accentBright} /><View><Text style={styles.brandName}>Gia dụng</Text><Text style={styles.brandSub}>Việt</Text></View></View>
        <Text style={styles.text}>Shop thương mại điện tử chuyên đồ gia dụng, thiết bị nhà bếp và thiết bị chăm sóc nhà cửa chính hãng.</Text>
        {/* Bên frontend các icon mạng xã hội cũng chưa có link thật. */}
        <View style={styles.socials}>{socials.map(([icon, label]) => <View key={label} accessibilityLabel={label} style={styles.social}><Ionicons name={icon} size={16} color={colors.white} /></View>)}</View>
      </View>
      {columns.map(([title, links]) => <View key={title} style={styles.column}><Text style={styles.title}>{title}</Text>{links.map(([label, path]) => <FooterLink key={label} label={label} onPress={() => open(path)} />)}</View>)}
      <View style={styles.column}><Text style={styles.title}>Liên hệ</Text>{contacts.map(([icon, item]) => <View key={item} style={styles.contactRow}><Ionicons name={icon} size={14} color={colors.onDarkMuted} /><Text style={styles.text}>{item}</Text></View>)}</View>
    </View>
    <View style={styles.bottom}><Text style={styles.bottomText}>© 2023 Gia dụng Việt. All rights reserved.</Text><Text style={styles.bottomText}>Thẻ, chuyển khoản & thanh toán khi nhận hàng</Text></View>
  </View>;
}

// Hover đổi màu chỉ chạy trên web; app không có con trỏ nên onHoverIn không bao giờ được gọi.
function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  return <Pressable accessibilityRole="link" onPress={onPress} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}><Text style={[styles.link, hovered && styles.linkHover]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create(withTypography({
  footer: { marginTop: 40, marginHorizontal: -12, marginBottom: -16, paddingHorizontal: 24, backgroundColor: colors.header },
  grid: { width: '100%', maxWidth: 1240, alignSelf: 'center', paddingTop: 54, paddingBottom: 36, flexDirection: 'row', flexWrap: 'wrap', gap: 40 },
  brand: { flexGrow: 1.5, flexBasis: 240, maxWidth: 420 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandName: { color: colors.white, fontSize: 20, fontWeight: '800', lineHeight: 23 },
  brandSub: { color: '#43C1E2', fontSize: 12, fontWeight: '600', lineHeight: 14, marginTop: 3 },
  socials: { marginTop: 18, flexDirection: 'row', gap: 10 },
  social: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255, 255, 255, 0.08)', alignItems: 'center', justifyContent: 'center' },
  column: { flexGrow: 1, flexBasis: 150 },
  title: { marginBottom: 14, color: colors.white, fontSize: 15, fontWeight: '700' },
  link: { marginVertical: 6, color: colors.onDarkMuted, fontSize: 13, lineHeight: 20 },
  linkHover: { color: colors.accentBright },
  text: { marginVertical: 6, color: colors.onDarkMuted, fontSize: 13, lineHeight: 22, flexShrink: 1 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bottom: { width: '100%', maxWidth: 1240, alignSelf: 'center', minHeight: 58, paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.12)', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  bottomText: { color: '#C7D1CB', fontSize: 12 },
}));
