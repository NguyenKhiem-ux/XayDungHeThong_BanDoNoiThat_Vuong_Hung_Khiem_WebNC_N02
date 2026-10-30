// file nút "lên đầu trang": hiện khi người dùng đã cuộn xuống xa, bấm để cuộn mượt về đầu trang.
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState, type ComponentRef, type UIEvent } from 'react';
import { Pressable, ScrollView, StyleSheet, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

const THRESHOLD = 600;

// Gắn ref và onScroll vào ScrollView chính của màn hình.
export function useScrollTop() {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const [visible, setVisible] = useState(false);
  return {
    ref,
    visible,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => setVisible(event.nativeEvent.contentOffset.y > THRESHOLD),
    toTop: () => ref.current?.scrollTo({ y: 0, animated: true }),
  };
}

// Bản cho các màn .web.tsx cuộn bằng thẻ div.
export function useWebScrollTop() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  return {
    ref,
    visible,
    onScroll: (event: UIEvent<HTMLDivElement>) => setVisible(event.currentTarget.scrollTop > THRESHOLD),
    toTop: () => ref.current?.scrollTo({ top: 0, behavior: 'smooth' }),
  };
}

export function ScrollTopButton({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  if (!visible) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel="Lên đầu trang" onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
    <Ionicons name="arrow-up" size={22} color="#1D1D1F" />
  </Pressable>;
}

const styles = StyleSheet.create({
  // Nằm ngay trên nút mở chatbot (right 24, bottom 22, cao 54).
  button: { position: 'absolute', right: 31, bottom: 90, zIndex: 90, width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#A1A1A6', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(0, 0, 0, .18)' },
  pressed: { transform: [{ scale: 0.94 }] },
});
