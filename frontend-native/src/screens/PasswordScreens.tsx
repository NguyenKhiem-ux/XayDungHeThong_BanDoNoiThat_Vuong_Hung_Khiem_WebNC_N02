import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { ApiError, authApi } from '../api';
import { PageHeader } from '../components/PageHeader';
import { isValidEmail, newPasswordError, normalizeOtp, secondsUntil } from '../passwordRecovery.mjs';
import { useStore } from '../store';
import { withTypography } from '../typography';

function requestMessage(failure: unknown, fallback: string) {
  if (failure instanceof ApiError) return failure.message || fallback;
  return failure instanceof Error ? failure.message : fallback;
}

export function ChangePasswordScreen() {
  const router = useRouter();
  const { authReady, setNotice, user } = useStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  useEffect(() => {
    if (authReady && !user) router.replace({ pathname: '/login', params: { redirect: '/change-password' } });
  }, [authReady, router, user]);

  const submit = async () => {
    if (submitting.current) return;
    if (!currentPassword) { setError('Vui lòng nhập mật khẩu hiện tại.'); return; }
    const validationError = newPasswordError(newPassword, confirmPassword);
    if (validationError) { setError(validationError); return; }
    setError('');
    submitting.current = true;
    setBusy(true);
    try {
      await authApi.changePassword(currentPassword, newPassword, confirmPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice('Đổi mật khẩu thành công.');
      router.replace('/profile');
    } catch (failure) {
      setError(requestMessage(failure, 'Không thể đổi mật khẩu. Vui lòng thử lại.'));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  if (!authReady || !user) return <PasswordPage icon="key-outline" title="Đổi mật khẩu" subtitle="Đang kiểm tra phiên đăng nhập..."><Loading /></PasswordPage>;

  return <PasswordPage icon="key-outline" title="Đổi mật khẩu" subtitle="Mật khẩu mới cần có ít nhất 6 ký tự.">
    <Feedback error={error} />
    <PasswordInput label="Mật khẩu hiện tại" value={currentPassword} onChangeText={setCurrentPassword} autoComplete="current-password" />
    <PasswordInput label="Mật khẩu mới" value={newPassword} onChangeText={setNewPassword} autoComplete="new-password" />
    <PasswordInput label="Nhập lại mật khẩu mới" value={confirmPassword} onChangeText={setConfirmPassword} autoComplete="new-password" onSubmit={submit} />
    <SubmitButton label="Đổi mật khẩu" busy={busy} onPress={submit} />
    <TextLink label="Quay lại hồ sơ" onPress={() => router.replace('/profile')} />
  </PasswordPage>;
}

export function ForgotPasswordScreen() {
  const router = useRouter();
  const { passwordReset, setPasswordReset } = useStore();
  const [email, setEmail] = useState(passwordReset?.email || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  useEffect(() => {
    if (passwordReset?.otp) setPasswordReset({ ...passwordReset, otp: '' });
  }, [passwordReset, setPasswordReset]);

  const submit = async () => {
    if (submitting.current) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) { setError('Vui lòng nhập địa chỉ email hợp lệ.'); return; }
    setError('');
    submitting.current = true;
    setBusy(true);
    try {
      const response = await authApi.forgotPassword(normalizedEmail);
      setPasswordReset({ email: normalizedEmail, expiresAt: response.expiresAt, otp: '' });
      router.push('/verify-otp');
    } catch (failure) {
      setError(requestMessage(failure, 'Không thể gửi mã OTP. Vui lòng thử lại.'));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return <PasswordPage icon="mail-outline" title="Quên mật khẩu" subtitle="Nhập email đã đăng ký để nhận mã OTP.">
    <Feedback error={error} />
    <View style={styles.field}><Text style={styles.label}>Email</Text><TextInput accessibilityLabel="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" onSubmitEditing={() => void submit()} returnKeyType="send" placeholder="your@email.com" placeholderTextColor="#6E6E73" style={styles.input} /></View>
    <SubmitButton label="Gửi mã OTP" busy={busy} onPress={submit} />
    <TextLink label="Quay lại đăng nhập" onPress={() => router.replace('/login')} />
  </PasswordPage>;
}

export function VerifyOtpScreen() {
  const router = useRouter();
  const { passwordReset, setPasswordReset } = useStore();
  const [otp, setOtp] = useState('');
  const [remaining, setRemaining] = useState(() => secondsUntil(passwordReset?.expiresAt || ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  useEffect(() => {
    if (!passwordReset?.email || !passwordReset.expiresAt) router.replace('/forgot-password');
  }, [passwordReset, router]);

  useEffect(() => {
    if (!passwordReset?.expiresAt) return;
    const update = () => setRemaining(secondsUntil(passwordReset.expiresAt));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [passwordReset?.expiresAt]);

  if (!passwordReset?.email || !passwordReset.expiresAt) return <PasswordPage icon="shield-checkmark-outline" title="Xác thực OTP" subtitle="Đang chuẩn bị xác thực..."><Loading /></PasswordPage>;

  const expired = remaining <= 0;
  const timerText = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  const submit = async () => {
    if (submitting.current) return;
    if (expired) { setError('Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.'); return; }
    if (!/^\d{6}$/.test(otp)) { setError('OTP phải gồm đúng 6 chữ số.'); return; }
    setError('');
    submitting.current = true;
    setBusy(true);
    try {
      await authApi.verifyResetOtp(passwordReset.email, otp);
      setPasswordReset({ ...passwordReset, otp });
      router.push('/reset-password');
    } catch (failure) {
      setError(requestMessage(failure, 'Mã OTP không hợp lệ hoặc đã hết hạn.'));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return <PasswordPage icon="shield-checkmark-outline" title="Xác thực OTP" subtitle={`Mã xác thực đã được gửi tới ${passwordReset.email}.`}>
    <View accessibilityLiveRegion="polite" style={[styles.timer, expired && styles.timerExpired]}><Ionicons name="time-outline" size={18} color={expired ? '#9B382F' : '#1D1D1F'} /><Text style={[styles.timerText, expired && styles.timerExpiredText]}>{expired ? 'Mã OTP đã hết hạn' : `Mã hết hạn sau ${timerText}`}</Text></View>
    <Feedback error={error} />
    <View style={styles.field}><Text style={styles.label}>Mã OTP</Text><TextInput accessibilityLabel="Mã OTP" value={otp} onChangeText={value => setOtp(normalizeOtp(value))} keyboardType="number-pad" inputMode="numeric" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} onSubmitEditing={() => void submit()} returnKeyType="done" placeholder="000000" placeholderTextColor="#6E6E73" style={[styles.input, styles.otpInput]} /></View>
    <SubmitButton label="Xác nhận OTP" busy={busy} disabled={expired || otp.length !== 6} onPress={submit} />
    <TextLink label="Yêu cầu mã OTP mới" onPress={() => router.replace('/forgot-password')} />
  </PasswordPage>;
}

export function ResetPasswordScreen() {
  const router = useRouter();
  const { passwordReset, setPasswordReset } = useStore();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  useEffect(() => {
    if (!passwordReset?.email) router.replace('/forgot-password');
    else if (!passwordReset.otp) router.replace('/verify-otp');
  }, [passwordReset, router]);

  if (!passwordReset?.email || !passwordReset.otp) return <PasswordPage icon="lock-closed-outline" title="Đặt mật khẩu mới" subtitle="Đang kiểm tra yêu cầu..."><Loading /></PasswordPage>;

  const submit = async () => {
    if (submitting.current) return;
    const validationError = newPasswordError(password, confirmation);
    if (validationError) { setError(validationError); return; }
    setError('');
    submitting.current = true;
    setBusy(true);
    try {
      await authApi.resetPassword(passwordReset.email, passwordReset.otp, password);
      setPassword('');
      setConfirmation('');
      setPasswordReset(null);
      router.replace({ pathname: '/login', params: { message: 'Đổi mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.' } });
    } catch (failure) {
      setError(requestMessage(failure, 'Không thể đổi mật khẩu. Vui lòng thực hiện lại yêu cầu.'));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return <PasswordPage icon="lock-closed-outline" title="Đặt mật khẩu mới" subtitle="Mật khẩu mới cần có ít nhất 6 ký tự.">
    <Feedback error={error} />
    <PasswordInput label="Mật khẩu mới" value={password} onChangeText={setPassword} autoComplete="new-password" />
    <PasswordInput label="Nhập lại mật khẩu" value={confirmation} onChangeText={setConfirmation} autoComplete="new-password" onSubmit={submit} />
    <SubmitButton label="Đặt lại mật khẩu" busy={busy} onPress={submit} />
  </PasswordPage>;
}

function PasswordPage({ icon, title, subtitle, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; children: ReactNode }) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  return <View style={styles.page}><PageHeader back /><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, compact && styles.scrollCompact]}><View style={[styles.shell, compact && styles.shellCompact]}><View style={[styles.story, compact && styles.storyCompact]}><View style={styles.storyIcon}><Ionicons name={icon} size={30} color="#FFFFFF" /></View><Text style={styles.eyebrow}>BẢO MẬT TÀI KHOẢN</Text><Text style={[styles.storyTitle, compact && styles.storyTitleCompact]}>An tâm mua sắm cùng Gia dụng Việt.</Text><Text style={styles.storyText}>Thông tin xác thực chỉ được dùng trong phiên thao tác hiện tại và gửi trực tiếp đến hệ thống bảo mật.</Text></View><View style={[styles.card, compact && styles.cardCompact]}><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text>{children}</View></View></ScrollView></KeyboardAvoidingView></View>;
}

function PasswordInput({ label, value, onChangeText, autoComplete, onSubmit }: { label: string; value: string; onChangeText: (value: string) => void; autoComplete: 'current-password' | 'new-password'; onSubmit?: () => void }) {
  const [show, setShow] = useState(false);
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.passwordWrap}><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} secureTextEntry={!show} autoCapitalize="none" autoComplete={autoComplete} onSubmitEditing={onSubmit ? () => void onSubmit() : undefined} returnKeyType={onSubmit ? 'done' : 'next'} placeholder="••••••" placeholderTextColor="#6E6E73" style={[styles.input, styles.passwordInput]} /><Pressable accessibilityRole="button" accessibilityLabel={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onPress={() => setShow(current => !current)} style={styles.eye}><Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color="#1D1D1F" /></Pressable></View></View>;
}

function Feedback({ error }: { error: string }) {
  return error ? <View accessibilityRole="alert" style={styles.error}><Ionicons name="alert-circle-outline" size={19} color="#9B382F" /><Text style={styles.errorText}>{error}</Text></View> : null;
}

function SubmitButton({ label, busy, disabled = false, onPress }: { label: string; busy: boolean; disabled?: boolean; onPress: () => void }) {
  const blocked = busy || disabled;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: blocked }} disabled={blocked} onPress={() => void onPress()} style={({ pressed }) => [styles.submit, blocked && styles.disabled, pressed && styles.pressed]}>{busy ? <ActivityIndicator color="#fff" /> : <><Text style={styles.submitText}>{label}</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>}</Pressable>;
}

function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="link" onPress={onPress} style={styles.link}><Ionicons name="arrow-back" size={15} color="#1D1D1F" /><Text style={styles.linkText}>{label}</Text></Pressable>;
}

function Loading() {
  return <View style={styles.loading}><ActivityIndicator color="#1D1D1F" /><Text style={styles.loadingText}>Vui lòng chờ...</Text></View>;
}

const styles = StyleSheet.create(withTypography({
  page: { flex: 1, backgroundColor: '#F5F5F7' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  scrollCompact: { paddingHorizontal: 14, paddingVertical: 18 },
  shell: { width: '100%', maxWidth: 980, minHeight: 560, alignSelf: 'center', flexDirection: 'row', overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: '#D2D2D7', backgroundColor: '#FFFFFF' },
  shellCompact: { minHeight: 0, flexDirection: 'column' },
  story: { width: '42%', padding: 44, justifyContent: 'center', backgroundColor: '#1D1D1F' },
  storyCompact: { width: '100%', padding: 27 },
  storyIcon: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 24, backgroundColor: '#1D1D1F' },
  eyebrow: { color: '#6E6E73', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  storyTitle: { color: '#FFFFFF', fontSize: 31, lineHeight: 39, fontWeight: '900', marginTop: 12 },
  storyTitleCompact: { fontSize: 25, lineHeight: 32 },
  storyText: { color: '#E8E8ED', fontSize: 13, lineHeight: 21, marginTop: 16 },
  card: { flex: 1, padding: 46, justifyContent: 'center' },
  cardCompact: { padding: 25 },
  title: { color: '#1D1D1F', fontSize: 29, fontWeight: '900' },
  subtitle: { color: '#6E6E73', fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 24 },
  field: { gap: 7, marginBottom: 15 },
  label: { color: '#1D1D1F', fontSize: 12, fontWeight: '800' },
  input: { width: '100%', minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#D2D2D7', backgroundColor: '#fff', color: '#1D1D1F', fontSize: 14, paddingHorizontal: 14 },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 48 },
  eye: { position: 'absolute', right: 5, width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  otpInput: { textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: '800' },
  timer: { marginBottom: 17, padding: 12, borderRadius: 11, borderWidth: 1, borderColor: '#D2D2D7', backgroundColor: '#E8E8ED', flexDirection: 'row', alignItems: 'center', gap: 8 },
  timerExpired: { borderColor: '#E8B9B4', backgroundColor: '#FBE8E5' },
  timerText: { color: '#1D1D1F', fontSize: 12, fontWeight: '700' },
  timerExpiredText: { color: '#9B382F' },
  error: { marginBottom: 17, padding: 12, borderRadius: 11, borderWidth: 1, borderColor: '#E8B9B4', backgroundColor: '#FBE8E5', flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, color: '#8C3028', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  submit: { minHeight: 50, borderRadius: 999, backgroundColor: '#1D1D1F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 4 },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  link: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8, marginTop: 15 },
  linkText: { color: '#1D1D1F', fontSize: 12, fontWeight: '900' },
  loading: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 11 },
  loadingText: { color: '#6E6E73', fontSize: 12 },
  disabled: { opacity: .55 },
  pressed: { opacity: .76 },
}));
