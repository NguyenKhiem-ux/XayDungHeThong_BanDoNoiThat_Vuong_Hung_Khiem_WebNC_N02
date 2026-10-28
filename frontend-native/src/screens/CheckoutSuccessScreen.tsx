import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ChatWidget } from '../components/ChatWidget';
import { PageHeader } from '../components/PageHeader';
import { ProductFooter } from '../components/ProductFooter';
import { useStore } from '../store';
import { withTypography } from '../typography';

export default function CheckoutSuccessScreen() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 760;
  const params = useLocalSearchParams<{ id?: string; method?: string }>();
  const { setCheckoutShipping } = useStore();
  useEffect(() => { setCheckoutShipping(null); }, [setCheckoutShipping]);
  const methodText = params.method === 'CARD' ? 'Thanh toán thẻ mô phỏng đã được xác minh.' : 'Đơn hàng đã được ghi nhận và đang chờ xử lý.';
  return <View style={styles.page}><PageHeader back /><ScrollView contentContainerStyle={[styles.scroll, compact && styles.scrollCompact]}><View style={styles.content}><View style={styles.card}><View style={styles.icon}><Ionicons name="checkmark" size={38} color="#fff" /></View><Text style={styles.title}>Đặt hàng thành công</Text><Text style={styles.order}>Mã đơn hàng: #{params.id}</Text><Text style={styles.description}>{methodText}</Text><Text style={styles.description}>Bạn có thể theo dõi trạng thái đơn hàng trong tài khoản của mình.</Text><View style={[styles.actions, compact && styles.actionsCompact]}><Pressable style={styles.primaryButton} onPress={() => router.replace('/')}><Text style={styles.primaryText}>Về trang chủ</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => router.replace('/products')}><Text style={styles.secondaryText}>Tiếp tục mua sắm</Text></Pressable></View></View></View><ProductFooter /></ScrollView><ChatWidget compact={compact} /></View>;
}

const styles = StyleSheet.create(withTypography({
  page: { flex: 1, backgroundColor: '#F6EFE6' }, scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 28 }, scrollCompact: { paddingHorizontal: 12, paddingTop: 16 }, content: { width: '100%', maxWidth: 850, alignSelf: 'center' }, card: { padding: 38, borderRadius: 20, alignItems: 'center', backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E1CFBA' }, icon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#47724A' }, title: { marginTop: 18, color: '#30251D', fontSize: 28, lineHeight: 35, fontWeight: '900', textAlign: 'center' }, order: { marginTop: 8, color: '#755036', fontSize: 16, fontWeight: '900' }, description: { maxWidth: 560, marginTop: 9, color: '#756456', fontSize: 13, lineHeight: 20, textAlign: 'center' }, actions: { marginTop: 24, flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 10 }, actionsCompact: { flexDirection: 'column' }, primaryButton: { minHeight: 45, paddingHorizontal: 20, borderRadius: 9, backgroundColor: '#755036', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontSize: 12, fontWeight: '800' }, secondaryButton: { minHeight: 45, paddingHorizontal: 20, borderRadius: 9, borderWidth: 1, borderColor: '#D6BFA5', alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: '#755036', fontSize: 12, fontWeight: '800' },
}));
