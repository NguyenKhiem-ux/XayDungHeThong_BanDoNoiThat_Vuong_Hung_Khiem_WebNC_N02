import { Ionicons } from '@expo/vector-icons';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { ApiError } from '../api';
import { PageHeader } from '../components/PageHeader';
import { useStore } from '../store';
import { withTypography } from '../typography';

type Mode = 'login' | 'register';

const emptyRegister = { fullName: '', username: '', email: '', phone: '', password: '', confirmPassword: '' };

export function AuthScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string | string[] }>();
  const { width } = useWindowDimensions();
  const compact = width < 780;
  const mobileWidth = Math.max(280, width - 44);
  const { authReady, login, register, user } = useStore();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [form, setForm] = useState(emptyRegister);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rawRedirect = Array.isArray(params.redirect) ? params.redirect[0] : params.redirect;
  const destination = rawRedirect?.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';
  const goAfterAuth = () => router.replace(destination as Href);

  const submit = async () => {
    if (busy) return;
    setError('');
    if (mode === 'login' && (!loginId.trim() || !password)) {
      setError('Vui lòng nhập tên đăng nhập hoặc email và mật khẩu.');
      return;
    }
    if (mode === 'register') {
      if (!form.fullName.trim() || !form.username.trim() || !form.email.trim() || !form.password) {
        setError('Vui lòng điền đầy đủ các trường bắt buộc.');
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError('Mật khẩu xác nhận không khớp.');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'login') await login(loginId.trim(), password);
      else await register({
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      });
      goAfterAuth();
    } catch (failure) {
      if (failure instanceof ApiError) {
        if (failure.status >= 500) setError('Máy chủ đang gặp sự cố. Vui lòng thử lại sau.');
        else if (mode === 'login') setError('Đăng nhập thất bại. Vui lòng kiểm tra tài khoản và mật khẩu.');
        else setError(failure.message || 'Đăng ký thất bại. Vui lòng thử lại.');
      } else {
        setError('Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.');
      }
    } finally {
      setBusy(false);
    }
  };

  const setRegisterValue = (key: keyof typeof emptyRegister, value: string) => setForm(current => ({ ...current, [key]: value }));

  return (
    <View style={styles.page}>
      <PageHeader back />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, compact && styles.scrollCompact]} keyboardShouldPersistTaps="handled">
          <View style={[styles.shell, compact && styles.shellCompact, compact && { width: mobileWidth }]}>
            <View style={[styles.story, compact && styles.storyCompact, compact && { width: mobileWidth }]}>
              <View style={styles.storyIcon}><Ionicons name={mode === 'login' ? 'key-outline' : 'person-add-outline'} size={29} color="#FFFCF7" /></View>
              <Text style={styles.eyebrow}>GIA DỤNG VIỆT</Text>
              <Text style={[styles.storyTitle, compact && styles.storyTitleCompact]}>{mode === 'login' ? 'Trở lại không gian sống tiện nghi.' : 'Mua sắm dễ dàng hơn mỗi ngày.'}</Text>
              <Text style={styles.storyText}>Đăng nhập để đồng bộ giỏ hàng, sản phẩm yêu thích và theo dõi đơn hàng trên mọi thiết bị.</Text>
              <View style={styles.benefits}>
                {['JWT được lưu an toàn theo nền tảng', 'Giỏ hàng cập nhật ngay sau đăng nhập', 'Sản phẩm chính hãng, hỗ trợ tận tâm'].map(item => <View key={item} style={styles.benefit}><Ionicons name="checkmark-circle" size={18} color="#E8D5BA" /><Text style={styles.benefitText}>{item}</Text></View>)}
              </View>
            </View>

            <View style={[styles.formCard, compact && styles.formCardCompact, compact && { width: mobileWidth }]}>
              {!authReady ? <View style={styles.loading}><ActivityIndicator color="#755036" /><Text style={styles.loadingText}>Đang kiểm tra phiên đăng nhập...</Text></View> : user ? <View style={styles.signedIn}>
                <View style={styles.signedIcon}><Ionicons name="checkmark" size={28} color="#fff" /></View>
                <Text style={styles.formTitle}>Bạn đã đăng nhập</Text>
                <Text style={styles.formSubtitle}>Xin chào {user.fullName}. Tài khoản đã sẵn sàng để mua sắm.</Text>
                <PrimaryButton label="Tiếp tục mua sắm" busy={false} onPress={goAfterAuth} />
              </View> : <>
                <Text style={styles.formTitle}>{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</Text>
                <Text style={styles.formSubtitle}>{mode === 'login' ? 'Chào mừng bạn quay lại Gia dụng Việt.' : 'Tạo tài khoản để mua sắm và theo dõi đơn hàng.'}</Text>
                {!!error && <View accessibilityRole="alert" style={styles.error}><Ionicons name="alert-circle-outline" size={19} color="#9B382F" /><Text style={styles.errorText}>{error}</Text></View>}

                {mode === 'login' ? <>
                  <Field label="Tên đăng nhập hoặc email" value={loginId} onChangeText={setLoginId} placeholder="username hoặc your@email.com" autoCapitalize="none" autoComplete="username" />
                  <PasswordField label="Mật khẩu" value={password} onChangeText={setPassword} show={showPassword} onToggle={() => setShowPassword(value => !value)} autoComplete="current-password" onSubmit={submit} />
                </> : <>
                  <Field label="Họ tên" value={form.fullName} onChangeText={value => setRegisterValue('fullName', value)} autoComplete="name" />
                  <Field label="Tên đăng nhập" value={form.username} onChangeText={value => setRegisterValue('username', value)} placeholder="ví dụ: giadungviet" autoCapitalize="none" autoComplete="username-new" />
                  <Field label="Email" value={form.email} onChangeText={value => setRegisterValue('email', value)} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
                  <Field label="Số điện thoại (không bắt buộc)" value={form.phone} onChangeText={value => setRegisterValue('phone', value)} keyboardType="phone-pad" autoComplete="tel" />
                  <PasswordField label="Mật khẩu" value={form.password} onChangeText={value => setRegisterValue('password', value)} show={showPassword} onToggle={() => setShowPassword(value => !value)} autoComplete="new-password" />
                  <PasswordField label="Nhập lại mật khẩu" value={form.confirmPassword} onChangeText={value => setRegisterValue('confirmPassword', value)} show={showConfirm} onToggle={() => setShowConfirm(value => !value)} autoComplete="new-password" onSubmit={submit} />
                </>}

                <PrimaryButton label={mode === 'login' ? 'Đăng nhập' : 'Đăng ký'} busy={busy} onPress={submit} />
                <View style={styles.switchRow}><Text style={styles.switchText}>{mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}</Text><Pressable accessibilityRole="link" onPress={() => router.replace(mode === 'login' ? '/register' : '/login')}><Text style={styles.switchLink}>{mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}</Text></Pressable></View>
              </>}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  autoComplete?: 'name' | 'username' | 'username-new' | 'email' | 'tel';
}

function Field({ label, ...props }: FieldProps) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} accessibilityLabel={label} editable style={styles.input} placeholderTextColor="#9B8A7C" returnKeyType="next" /></View>;
}

function PasswordField({ label, value, onChangeText, show, onToggle, autoComplete, onSubmit }: { label: string; value: string; onChangeText: (value: string) => void; show: boolean; onToggle: () => void; autoComplete: 'current-password' | 'new-password'; onSubmit?: () => void }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.passwordWrap}><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} secureTextEntry={!show} autoCapitalize="none" autoComplete={autoComplete} onSubmitEditing={onSubmit} returnKeyType={onSubmit ? 'done' : 'next'} style={[styles.input, styles.passwordInput]} placeholder="••••••" placeholderTextColor="#9B8A7C" /><Pressable accessibilityRole="button" accessibilityLabel={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onPress={onToggle} style={styles.eye}><Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color="#755036" /></Pressable></View></View>;
}

function PrimaryButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onPress} style={({ pressed }) => [styles.submit, busy && styles.disabled, pressed && styles.pressed]}>{busy ? <ActivityIndicator color="#fff" /> : <><Text style={styles.submitText}>{label}</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>}</Pressable>;
}

const styles = StyleSheet.create(withTypography({
  page: { flex: 1, backgroundColor: '#F6EFE6' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  scrollCompact: { paddingHorizontal: 14, paddingVertical: 18 },
  shell: { width: '100%', maxWidth: 1040, alignSelf: 'center', minHeight: 590, flexDirection: 'row', borderRadius: 24, overflow: 'hidden', backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E1CFBA', boxShadow: '0 24px 70px rgba(72, 45, 28, .15)' },
  shellCompact: { maxWidth: '100%', alignSelf: 'stretch', flexDirection: 'column', minHeight: 0 },
  story: { width: '43%', padding: 48, justifyContent: 'center', backgroundColor: '#755036' },
  storyCompact: { maxWidth: '100%', alignSelf: 'stretch', padding: 28 },
  storyIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#A56E2D', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  eyebrow: { color: '#E8D5BA', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  storyTitle: { color: '#FFFCF7', fontSize: 34, lineHeight: 41, fontWeight: '900', marginTop: 12 },
  storyTitleCompact: { fontSize: 27, lineHeight: 33, flexShrink: 1 },
  storyText: { color: '#F0E4D7', fontSize: 14, lineHeight: 22, marginTop: 16 },
  benefits: { marginTop: 28, gap: 12 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  benefitText: { flex: 1, color: '#FFFCF7', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  formCard: { flex: 1, padding: 48, justifyContent: 'center' },
  formCardCompact: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', maxWidth: '100%', alignSelf: 'stretch', padding: 25 },
  formTitle: { color: '#30251D', fontSize: 31, fontWeight: '900' },
  formSubtitle: { color: '#77685D', fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 24 },
  field: { gap: 7, marginBottom: 15 },
  label: { color: '#493629', fontSize: 12, fontWeight: '800' },
  input: { width: '100%', minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#DCC9B4', backgroundColor: '#fff', color: '#30251D', fontSize: 14, paddingHorizontal: 14 },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 48 },
  eye: { position: 'absolute', right: 5, width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  error: { marginBottom: 17, padding: 12, borderRadius: 11, borderWidth: 1, borderColor: '#E8B9B4', backgroundColor: '#FBE8E5', flexDirection: 'row', gap: 8, alignItems: 'center' },
  errorText: { flex: 1, color: '#8C3028', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  submit: { minHeight: 50, borderRadius: 12, backgroundColor: '#755036', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 4 },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  switchRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 21 },
  switchText: { color: '#77685D', fontSize: 12 },
  switchLink: { color: '#755036', fontSize: 12, fontWeight: '900' },
  loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 13 },
  loadingText: { color: '#77685D', fontSize: 13 },
  signedIn: { alignItems: 'center', gap: 13 },
  signedIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#537B55', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.58 },
  pressed: { opacity: 0.78 },
}));
