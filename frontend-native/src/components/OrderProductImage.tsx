import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { imageUrl } from '../api';

export function OrderProductImage({ uri, style, iconSize = 22 }: { uri?: string | null; style?: StyleProp<ViewStyle>; iconSize?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);

  return <View style={[styles.frame, style]}>{uri && !failed
    ? <Image accessibilityLabel="Ảnh sản phẩm" source={{ uri: imageUrl(uri) }} resizeMode="contain" onError={() => setFailed(true)} style={styles.image} />
    : <Ionicons name="cube-outline" size={iconSize} color="#6E6E73" />}</View>;
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#F5F5F7', borderWidth: 1, borderColor: '#D2D2D7' },
  image: { width: '90%', height: '90%' },
});
