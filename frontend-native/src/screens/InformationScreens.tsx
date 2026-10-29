import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { ApiError, contactApi } from '../api';
import { contactValidationError } from '../contact.mjs';
import { Header } from '../components/Header';
import { ProductFooter } from '../components/ProductFooter';
import { withTypography } from '../typography';

const aboutImage = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85';
const policies = [
  { title: 'Chính sách giao hàng', text: 'Gia dụng Việt giao hàng trên toàn quốc. Phí giao hàng hiện được miễn phí theo thông tin hiển thị tại bước đặt hàng. Thời gian giao dự kiến được nhân viên xác nhận sau khi tiếp nhận đơn.' },
  { title: 'Chính sách đổi trả', text: 'Khách hàng có thể yêu cầu đổi hoặc trả sản phẩm trong vòng 7 ngày kể từ khi nhận hàng nếu sản phẩm bị lỗi hoặc không đúng mô tả. Vui lòng giữ sản phẩm, phụ kiện và liên hệ bộ phận hỗ trợ để được hướng dẫn.' },
  { title: 'Chính sách bảo hành', text: 'Sản phẩm được áp dụng bảo hành theo chính sách của nhà sản xuất. Thời hạn và điều kiện bảo hành cụ thể phụ thuộc từng sản phẩm; vui lòng xem thông tin sản phẩm hoặc liên hệ cửa hàng trước khi gửi bảo hành.' },
  { title: 'Chính sách thanh toán', text: 'Website hỗ trợ thanh toán QR qua PayOS, thanh toán thẻ theo phương thức được cung cấp tại bước thanh toán và thanh toán tiền mặt khi nhận hàng. Đơn thanh toán trực tuyến chỉ được xác nhận sau khi hệ thống nhận được thông báo thanh toán hợp lệ.' },
  { title: 'Bảo vệ thông tin cá nhân', text: 'Thông tin liên hệ và giao nhận được sử dụng để xử lý đơn hàng, hỗ trợ khách hàng và cung cấp thông tin giao dịch. Gia dụng Việt không yêu cầu khách hàng gửi mật khẩu hoặc mã OTP qua điện thoại, email hay tin nhắn.' },
];

export function AboutScreen() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 760;
  return <InformationPage compact={compact}><Hero eyebrow="ABOUT GIA DỤNG VIỆT" title="Cửa hàng gia dụng dành cho gia đình cần sản phẩm tiện ích, bền và dễ sử dụng" text="Gia dụng Việt tập trung vào đồ gia dụng, linh kiện và phụ kiện điện tử chính hãng. Giao diện mua sắm được thiết kế rõ ràng để khách chọn nhanh, so sánh dễ và đặt hàng tự tin." /><View style={[styles.split, compact && styles.stack]}><View style={styles.splitCopy}><Text style={styles.eyebrow}>CAM KẾT</Text><Text style={styles.sectionTitle}>Tư vấn thật, sản phẩm thật, bảo hành minh bạch</Text><Text style={styles.bodyText}>Chúng tôi ưu tiên cấu hình phù hợp nhu cầu hơn là bán món đắt nhất. Mỗi sản phẩm đều có thông tin rõ, tình trạng tồn kho, giá và chính sách hỗ trợ sau mua.</Text><Pressable accessibilityRole="link" onPress={() => router.push('/products')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Xem sản phẩm</Text><Ionicons name="arrow-forward" size={17} color="#fff" /></Pressable></View><Image source={{ uri: aboutImage }} accessibilityLabel="Không gian gia đình hiện đại" resizeMode="cover" style={[styles.aboutImage, compact && styles.aboutImageCompact]} /></View><View style={[styles.commitments, compact && styles.commitmentsCompact]}><View style={styles.commitmentLead}><Text style={styles.commitmentNumber}>100%</Text><Text style={styles.commitmentLabel}>Sản phẩm chính hãng</Text></View>{['Bảo hành 12-24 tháng tùy dòng sản phẩm.', 'Giao hàng nhanh tại TP.HCM và toàn quốc.', 'Hỗ trợ tư vấn cấu hình trước khi mua.'].map(item => <View key={item} style={styles.commitment}><Ionicons name="checkmark-circle" size={21} color="#755036" /><Text style={styles.commitmentText}>{item}</Text></View>)}</View></InformationPage>;
}

type ContactForm = { name: string; email: string; phone: string; message: string };
const emptyContact: ContactForm = { name: '', email: '', phone: '', message: '' };

export function ContactScreen() {
  const compact = useWindowDimensions().width < 760;
  const [form, setForm] = useState(emptyContact);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const setField = (key: keyof ContactForm, value: string) => { setSent(false); setForm(current => ({ ...current, [key]: value })); };

  const submit = async () => {
    if (submitting.current) return;
    const validationError = contactValidationError(form);
    if (validationError) { setError(validationError); return; }
    setError('');
    setSent(false);
    submitting.current = true;
    setBusy(true);
    try {
      const phone = form.phone.trim();
      await contactApi.create({ name: form.name.trim(), email: form.email.trim().toLowerCase(), message: form.message.trim(), ...(phone ? { phone } : {}) });
      setForm(emptyContact);
      setSent(true);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Không thể gửi tin nhắn. Vui lòng thử lại.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return <InformationPage compact={compact}><Hero eyebrow="CONTACT" title="Cần tư vấn đồ gia dụng hoặc thiết bị nhà bếp?" text="Gửi thông tin cho Gia dụng Việt, đội ngũ hỗ trợ sẽ phản hồi và gợi ý sản phẩm gia dụng phù hợp nhu cầu của bạn." /><View style={[styles.contactGrid, compact && styles.stack]}><View style={styles.contactCard}><Text style={styles.sectionTitle}>Thông tin cửa hàng</Text><ContactItem icon="location-outline" text="123 Nguyễn Trãi, Thanh Xuân, Hà Nội" /><ContactItem icon="call-outline" text={'1800 6868\n8:00 - 22:00 mỗi ngày'} /><ContactItem icon="mail-outline" text="support@giadungviet.vn" /><ContactItem icon="car-outline" text="Giao hàng toàn quốc, hỗ trợ kiểm tra hàng khi nhận." /></View><View style={styles.contactCard}><Text style={styles.sectionTitle}>Gửi yêu cầu</Text><Text style={styles.formHint}>Các trường họ tên, email và nội dung là bắt buộc.</Text>{sent && <View accessibilityRole="alert" style={styles.success}><Ionicons name="checkmark-circle-outline" size={19} color="#47724A" /><Text style={styles.successText}>Đã gửi tin nhắn. Cảm ơn bạn!</Text></View>}{!!error && <View accessibilityRole="alert" style={styles.error}><Ionicons name="alert-circle-outline" size={19} color="#9B382F" /><Text style={styles.errorText}>{error}</Text></View>}<ContactField label="Họ và tên" value={form.name} onChangeText={value => setField('name', value)} autoComplete="name" /><ContactField label="Email" value={form.email} onChangeText={value => setField('email', value)} keyboardType="email-address" autoCapitalize="none" autoComplete="email" /><ContactField label="Số điện thoại" value={form.phone} onChangeText={value => setField('phone', value)} keyboardType="phone-pad" autoComplete="tel" /><ContactField label="Nội dung cần hỗ trợ" value={form.message} onChangeText={value => setField('message', value)} multiline placeholder="Bạn cần tư vấn sản phẩm nào?" /><Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void submit()} style={({ pressed }) => [styles.submitButton, busy && styles.disabled, pressed && styles.pressed]}>{busy ? <ActivityIndicator color="#fff" /> : <><Text style={styles.primaryButtonText}>Gửi liên hệ</Text><Ionicons name="send-outline" size={17} color="#fff" /></>}</Pressable></View></View></InformationPage>;
}

export function PoliciesScreen() {
  const router = useRouter();
  const compact = useWindowDimensions().width < 760;
  return <InformationPage compact={compact}><Hero eyebrow="GIA DỤNG VIỆT" title="Chính sách và điều khoản" text="Thông tin về giao hàng, đổi trả, bảo hành, thanh toán và quyền riêng tư khi mua sắm." /><View style={styles.policies}>{policies.map((policy, index) => <View key={policy.title} style={styles.policy}><View style={styles.policyIcon}><Text style={styles.policyNumber}>{String(index + 1).padStart(2, '0')}</Text></View><View style={styles.policyCopy}><Text style={styles.policyTitle}>{policy.title}</Text><Text style={styles.bodyText}>{policy.text}</Text></View></View>)}<View style={styles.support}><Text style={styles.supportText}>Cần hỗ trợ thêm về chính sách mua hàng?</Text><Pressable accessibilityRole="link" onPress={() => router.push('/contact')} style={styles.outlineButton}><Text style={styles.outlineButtonText}>Liên hệ Gia dụng Việt</Text><Ionicons name="arrow-forward" size={16} color="#755036" /></Pressable></View></View></InformationPage>;
}

function InformationPage({ compact, children }: { compact: boolean; children: ReactNode }) {
  return <View style={styles.page}><ScrollView stickyHeaderIndices={[0]} keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={styles.content}><Header compact={compact} categories={[]} /><View style={[styles.shell, compact && styles.shellCompact]}>{children}</View><ProductFooter /></ScrollView></View>;
}

function Hero({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <View style={styles.hero}><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.heroTitle}>{title}</Text><Text style={styles.heroText}>{text}</Text></View>;
}

function ContactItem({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return <View style={styles.contactItem}><View style={styles.contactIcon}><Ionicons name={icon} size={20} color="#755036" /></View><Text style={styles.contactText}>{text}</Text></View>;
}

type ContactFieldProps = { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: 'default' | 'email-address' | 'phone-pad'; autoCapitalize?: 'none' | 'sentences' | 'words'; autoComplete?: 'name' | 'email' | 'tel'; multiline?: boolean; placeholder?: string };
function ContactField({ label, multiline, ...props }: ContactFieldProps) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} accessibilityLabel={label} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} placeholderTextColor="#9B8A7C" style={[styles.input, multiline && styles.textarea]} /></View>;
}

const styles = StyleSheet.create(withTypography({
  page: { flex: 1, backgroundColor: '#F6EFE6' },
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
  shell: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 18, paddingBottom: 12, gap: 18 },
  shellCompact: { paddingHorizontal: 12, paddingTop: 12 },
  hero: { padding: 28, borderRadius: 18, backgroundColor: '#E8D5BA', borderWidth: 1, borderColor: '#CBA779' },
  eyebrow: { color: '#755036', fontSize: 10, fontWeight: '900', letterSpacing: 1.25 },
  heroTitle: { maxWidth: 850, color: '#30251D', fontSize: 30, lineHeight: 38, fontWeight: '900', marginTop: 6 },
  heroText: { maxWidth: 820, color: '#675346', fontSize: 13, lineHeight: 21, marginTop: 9 },
  split: { flexDirection: 'row', borderRadius: 17, overflow: 'hidden', backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E6D8C7' },
  stack: { flexDirection: 'column' },
  splitCopy: { flex: 1, padding: 28, justifyContent: 'center', alignItems: 'flex-start' },
  sectionTitle: { color: '#30251D', fontSize: 21, lineHeight: 28, fontWeight: '900', marginBottom: 10 },
  bodyText: { color: '#655347', fontSize: 13, lineHeight: 21 },
  aboutImage: { width: '46%', minHeight: 330 },
  aboutImageCompact: { width: '100%', minHeight: 230 },
  primaryButton: { minHeight: 44, marginTop: 18, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#755036', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  commitments: { padding: 20, borderRadius: 16, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E6D8C7', flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  commitmentsCompact: { flexDirection: 'column' },
  commitmentLead: { minWidth: 180, padding: 15, borderRadius: 12, backgroundColor: '#755036', justifyContent: 'center' },
  commitmentNumber: { color: '#fff', fontSize: 29, fontWeight: '900' },
  commitmentLabel: { color: '#F0E4D7', fontSize: 11, marginTop: 2 },
  commitment: { flex: 1, minWidth: 170, padding: 15, borderRadius: 12, backgroundColor: '#F8EEDF', flexDirection: 'row', alignItems: 'center', gap: 9 },
  commitmentText: { flex: 1, color: '#5F4B3E', fontSize: 11, lineHeight: 17, fontWeight: '700' },
  contactGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  contactCard: { flex: 1, width: '100%', padding: 22, borderRadius: 16, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E6D8C7' },
  contactItem: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#EFE4D7' },
  contactIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: '#F3E4D0', alignItems: 'center', justifyContent: 'center' },
  contactText: { flex: 1, color: '#5B493D', fontSize: 12, lineHeight: 19 },
  formHint: { color: '#806E60', fontSize: 11, marginTop: -4, marginBottom: 15 },
  field: { gap: 6, marginBottom: 13 },
  label: { color: '#493629', fontSize: 11, fontWeight: '800' },
  input: { width: '100%', minHeight: 46, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: '#DCC9B4', backgroundColor: '#fff', color: '#30251D', fontSize: 13 },
  textarea: { minHeight: 112, paddingTop: 12 },
  submitButton: { minHeight: 47, borderRadius: 10, backgroundColor: '#755036', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  success: { marginBottom: 14, padding: 11, borderRadius: 10, backgroundColor: '#EAF2E8', borderWidth: 1, borderColor: '#BFD7BF', flexDirection: 'row', alignItems: 'center', gap: 8 },
  successText: { flex: 1, color: '#47724A', fontSize: 11, fontWeight: '700' },
  error: { marginBottom: 14, padding: 11, borderRadius: 10, backgroundColor: '#FBE8E5', borderWidth: 1, borderColor: '#E8B9B4', flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, color: '#9B382F', fontSize: 11, lineHeight: 17, fontWeight: '700' },
  policies: { gap: 11 },
  policy: { padding: 19, borderRadius: 15, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E6D8C7', flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  policyIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#E8D5BA', alignItems: 'center', justifyContent: 'center' },
  policyNumber: { color: '#755036', fontSize: 12, fontWeight: '900' },
  policyCopy: { flex: 1 },
  policyTitle: { color: '#30251D', fontSize: 16, fontWeight: '900', marginBottom: 5 },
  support: { marginTop: 5, padding: 18, borderRadius: 15, backgroundColor: '#E8D5BA', borderWidth: 1, borderColor: '#CBA779', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  supportText: { color: '#493629', fontSize: 13, fontWeight: '800' },
  outlineButton: { minHeight: 41, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#CBA779', flexDirection: 'row', alignItems: 'center', gap: 7 },
  outlineButtonText: { color: '#755036', fontSize: 11, fontWeight: '900' },
  disabled: { opacity: .55 },
  pressed: { opacity: .76 },
}));
