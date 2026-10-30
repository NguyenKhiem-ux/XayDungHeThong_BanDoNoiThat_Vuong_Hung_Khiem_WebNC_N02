import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { chatApi, formatVnd, openLegacy } from '../api';
import { useStore } from '../store';
import { withTypography } from '../typography';
import { Buttons, ChatAccountCards, ChatCartCard, ChatCheckoutCards, ChatCheckoutReview, ChatChips } from './ChatCards';
import type { ChatAction, ChatResponse } from '../types';
import { colors } from '../theme';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  response?: ChatResponse;
}

const initial: Message = {
  id: 1,
  role: 'assistant',
  text: 'Xin chào! Tôi có thể giúp bạn tìm sản phẩm, quản lý giỏ hàng, tra cứu đơn hàng, địa chỉ và voucher.',
};

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function ChatWidget({ compact }: { compact: boolean }) {
  const router = useRouter();
  const { cart, syncChat } = useStore();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<Message[]>([initial]);
  const sequence = useRef(1);
  const sessionId = useRef(makeId());

  const request = async (message: string, action?: ChatAction) => {
    const value = message.trim();
    if (!value || loading) return;
    const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
    if (/\b(password|mat khau|otp|pin|token|jwt|authorization|bearer|api key|secret|cvv|cvc)\b/.test(normalized) || /\b(?:\d{4}[ -]){3}\d{4}\b|\b\d{13,19}\b/.test(value)) {
      setInput('');
      setMessages(current => [...current, { id: ++sequence.current, role: 'assistant', text: 'Đừng gửi mật khẩu, OTP, PIN, token hoặc thông tin thẻ vào chatbot. Hãy dùng trang tài khoản/thanh toán.' }]);
      return;
    }
    setMessages(current => [...current, { id: ++sequence.current, role: 'user', text: value }]);
    setInput('');
    setError('');
    setLoading(true);
    try {
      const response = await chatApi.send(value, sessionId.current, action);
      syncChat(response);
      setMessages(current => [...current, { id: ++sequence.current, role: 'assistant', text: response.message, response }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Chatbot đang bận. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const act = (action: ChatAction) => void request(action.label, action);
  const latestAssistant = messages.filter(message => message.role === 'assistant').at(-1)?.id;
  const reset = () => {
    sessionId.current = makeId();
    setMessages([initial]);
    setInput('');
    setError('');
  };

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      {open && <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.panel, compact && styles.panelCompact, expanded && styles.panelExpanded]}>
        <View style={styles.header}>
          <View style={styles.avatar}><Ionicons name="sparkles" size={18} color={colors.white} /></View>
          <View style={styles.heading}><Text style={styles.title}>Trợ lý gia dụng</Text><Text style={styles.subtitle}>Mua sắm và quản lý đơn hàng</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cuộc trò chuyện mới" disabled={loading} onPress={reset} style={styles.headerButton}><Ionicons name="refresh" size={18} color={colors.white} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={expanded ? 'Thu nhỏ khung chat' : 'Mở toàn màn hình'} onPress={() => setExpanded(value => !value)} style={styles.headerButton}><Ionicons name={expanded ? 'contract-outline' : 'expand-outline'} size={18} color={colors.white} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng chatbot" onPress={() => { setOpen(false); setExpanded(false); }} style={styles.headerButton}><Ionicons name="close" size={21} color={colors.white} /></Pressable>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled">
          {messages.map(message => {
            const response = message.response;
            const latest = message.id === latestAssistant;
            const disabled = loading || !latest;
            const actions = response?.actions ?? [];
            const continueCheckout = () => response?.checkoutUrl === '/checkout/info' ? router.push('/checkout/info') : void openLegacy(response!.checkoutUrl!);
            // Giỏ của tin nhắn mới nhất lấy theo store để luôn khớp số lượng hiện tại.
            const visibleCart = !response?.checkoutFlow && response?.cart && (latest ? cart ?? response.cart : response.cart);
            return <View key={message.id} style={[styles.message, message.role === 'user' ? styles.userMessage : styles.assistantMessage, !!response && styles.wideMessage]}>
              <Text style={[styles.messageText, message.role === 'user' && styles.userMessageText]}>{message.text}</Text>
              {!!response?.products?.length && <View style={styles.results}>{response.products.map(product => <View key={product.id} style={styles.result}>
                <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/products/[id]', params: { id: String(product.id) } })}><Text numberOfLines={2} style={styles.resultName}>{product.name}</Text><Text style={styles.resultPrice}>{formatVnd(product.price)}</Text></Pressable>
                <Buttons actions={actions.filter(action => action.productId === product.id)} disabled={disabled} onAction={act} />
              </View>)}</View>}
              {latest && <ChatChips chips={response?.chips} disabled={loading} onPick={chip => void request(chip)} />}
              {visibleCart && <ChatCartCard cart={visibleCart} actions={actions} disabled={disabled} onAction={act} onOpenCart={() => router.push('/cart')} />}
              {response?.checkout && <ChatCheckoutReview response={response} disabled={disabled} onAction={act} onContinue={continueCheckout} />}
              {response?.error?.code === 'LOGIN_REQUIRED' && <Pressable onPress={() => router.push('/login')}><Text style={styles.inlineLink}>Đăng nhập →</Text></Pressable>}
              {response?.checkoutUrl && !response.checkout && <Pressable onPress={continueCheckout}><Text style={styles.inlineLink}>Tiếp tục đến checkout →</Text></Pressable>}
              {response?.checkoutFlow && <ChatCheckoutCards flow={response.checkoutFlow} disabled={disabled} onAction={act} />}
              {response && !response.checkoutFlow && <ChatAccountCards response={response} disabled={disabled} onAction={act} />}
            </View>;
          })}
          {loading && <View style={[styles.message, styles.assistantMessage, styles.loading]}><ActivityIndicator size="small" color={colors.ink} /><Text style={styles.messageText}>Đang xử lý yêu cầu...</Text></View>}
        </ScrollView>

        {!!error && <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View>}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shortcutBar} contentContainerStyle={styles.shortcuts}>
          {([['cart_view', 'Giỏ hàng', 'cart-outline'], ['orders_list', 'Đơn hàng', 'receipt-outline'], ['favorites_list', 'Yêu thích', 'heart-outline'], ['addresses_list', 'Địa chỉ', 'location-outline'], ['coupons_list', 'Voucher', 'ticket-outline']] as const).map(([type, label, icon]) => <Pressable key={type} disabled={loading} onPress={() => act({ type, label })} style={styles.shortcut}><Ionicons name={icon} size={14} color={colors.ink} /><Text style={styles.shortcutText}>{label}{type === 'cart_view' && cart?.itemCount ? ` (${cart.itemCount})` : ''}</Text></Pressable>)}
        </ScrollView>

        <View style={styles.form}>
          <TextInput accessibilityLabel="Tin nhắn cho chatbot" value={input} onChangeText={setInput} onSubmitEditing={() => void request(input)} blurOnSubmit={false} editable={!loading} maxLength={1000} placeholder="Nhập yêu cầu của bạn..." placeholderTextColor={colors.muted} style={styles.input} />
          <Pressable accessibilityRole="button" accessibilityLabel="Gửi tin nhắn" disabled={loading || !input.trim()} onPress={() => void request(input)} style={[styles.send, (loading || !input.trim()) && styles.disabled]}><Ionicons name="send" size={18} color={colors.white} /></Pressable>
        </View>
      </KeyboardAvoidingView>}

      {!expanded && <Pressable accessibilityRole="button" accessibilityLabel={open ? 'Đóng chatbot' : 'Mở chatbot'} accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
        <Ionicons name={open ? 'close' : 'chatbubble-ellipses'} size={24} color={colors.white} />
      </Pressable>}
    </View>
  );
}

const styles = StyleSheet.create(withTypography({
  layer: { position: 'absolute', inset: 0, zIndex: 100 },
  panel: { position: 'absolute', right: 24, bottom: 86, width: 390, maxHeight: 590, minHeight: 480, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, boxShadow: '0 20px 60px rgba(0, 0, 0, .24)' },
  panelCompact: { left: 10, right: 10, bottom: 76, width: 'auto', maxHeight: '75%' },
  panelExpanded: { top: 0, left: 0, right: 0, bottom: 0, width: 'auto', maxHeight: '100%', minHeight: 0, borderRadius: 0, borderWidth: 0 },
  flex: { flex: 1 },
  shortcutBar: { flexGrow: 0, flexShrink: 0 },
  header: { minHeight: 62, backgroundColor: colors.brand, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1 },
  title: { color: colors.white, fontSize: 15, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  headerButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  messages: { padding: 12, gap: 9, flexGrow: 1 },
  message: { maxWidth: '88%', borderRadius: 13, padding: 10, gap: 7 },
  assistantMessage: { alignSelf: 'flex-start', backgroundColor: colors.lineSoft },
  userMessage: { alignSelf: 'flex-end', backgroundColor: colors.brand },
  messageText: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  userMessageText: { color: colors.white },
  loading: { flexDirection: 'row', alignItems: 'center' },
  results: { gap: 6 },
  result: { padding: 8, borderRadius: 9, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  resultName: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  resultPrice: { color: colors.ink, fontSize: 12, fontWeight: '900', marginTop: 3 },
  wideMessage: { maxWidth: '96%' },
  inlineLink: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  error: { marginHorizontal: 12, padding: 8, borderRadius: 8, backgroundColor: '#FBE8E5' },
  errorText: { color: colors.danger, fontSize: 11 },
  shortcuts: { paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
  shortcut: { alignSelf: 'center', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 4 },
  shortcutText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  form: { minHeight: 62, padding: 10, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, color: colors.ink, paddingHorizontal: 12, fontSize: 13 },
  send: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  toggle: { position: 'absolute', right: 24, bottom: 22, width: 54, height: 54, borderRadius: 27, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(0, 0, 0, .25)' },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.96 }] },
}));
