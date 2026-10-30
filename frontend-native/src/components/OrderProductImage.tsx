import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { imageUrl } from '../api';
import { colors } from '../theme';

export function OrderProductImage({ uri, style, iconSize = 22 }: { uri?: string | null; style?: StyleProp<ViewStyle>; iconSize?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);

  return <View style={[styles.frame, style]}>{uri && !failed
    ? <Image accessibilityLabel="Ảnh sản phẩm" source={{ uri: imageUrl(uri) }} resizeMode="contain" onError={() => setFailed(true)} style={styles.image} />
    : <Ionicons name="cube-outline" size={iconSize} color={colors.muted} />}</View>;
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line },
  image: { width: '90%', height: '90%' },
});
