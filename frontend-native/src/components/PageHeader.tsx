import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useStore } from '../store';
import { withTypography } from '../typography';

export function PageHeader({ back = false }: { back?: boolean }) {
  const router = useRouter();
  const compact = useWindowDimensions().width < 520;
  const { cart, user, logout } = useStore();
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/');

  return (
    <View style={styles.shell}>
      <View style={styles.inner}>
        {back && <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={goBack} style={styles.iconButton}><Ionicons name="arrow-back" size={23} color="#30251D" /></Pressable>}
        <Pressable accessibilityRole="link" accessibilityLabel="Gia dụng Việt - Trang chủ" onPress={() => router.replace('/')} style={styles.brand}>
          <View style={styles.mark}><Ionicons name="home-outline" size={22} color="#FFFCF7" /></View>
          <Text style={styles.brandText}>Gia dụng <Text style={styles.accent}>Việt</Text></Text>
        </Pressable>
        <View style={styles.actions}>
          {user ? <>{!compact && <Text numberOfLines={1} style={styles.userName}>{user.fullName}</Text>}<Pressable accessibilityRole="button" accessibilityLabel="Đăng xuất" onPress={() => void logout()} style={styles.iconButton}><Ionicons name="log-out-outline" size={21} color="#755036" /></Pressable></> : <Pressable accessibilityRole="link" accessibilityLabel="Đăng nhập" onPress={() => router.push('/login')} style={styles.login}><Ionicons name="person-outline" size={19} color="#755036" />{!compact && <Text style={styles.loginText}>Đăng nhập</Text>}</Pressable>}
          <Pressable accessibilityRole="link" accessibilityLabel="Giỏ hàng" onPress={() => router.push('/cart')} style={styles.iconButton}><Ionicons name="bag-handle-outline" size={22} color="#30251D" />{!!cart?.itemCount && <View style={styles.count}><Text style={styles.countText}>{cart.itemCount}</Text></View>}</Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create(withTypography({
  shell: { width: '100%', backgroundColor: '#FFFCF7', borderBottomWidth: 1, borderBottomColor: '#E6D8C7' },
  inner: { width: '100%', maxWidth: 1240, minHeight: 72, alignSelf: 'center', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#A56E2D', alignItems: 'center', justifyContent: 'center' },
  brandText: { color: '#30251D', fontSize: 17, fontWeight: '900' },
  accent: { color: '#755036' },
  actions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5 },
  userName: { maxWidth: 120, color: '#5B4637', fontSize: 12, fontWeight: '700' },
  iconButton: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  login: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9 },
  loginText: { color: '#755036', fontSize: 12, fontWeight: '800' },
  count: { position: 'absolute', top: 1, right: 0, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#A56E2D', alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#fff', fontSize: 10, fontWeight: '900' },
}));
