import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold,
} from '@expo-google-fonts/be-vietnam-pro';

export const fonts = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
  extraBold: 'BeVietnamPro_700Bold',
  black: 'BeVietnamPro_700Bold',
} as const;

export const fontAssets = {
  [fonts.regular]: BeVietnamPro_400Regular,
  [fonts.medium]: BeVietnamPro_500Medium,
  [fonts.semibold]: BeVietnamPro_600SemiBold,
  [fonts.bold]: BeVietnamPro_700Bold,
};

const textKeys = ['color', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'textAlign', 'textTransform', 'textDecorationLine'];

function familyFor(weight: unknown) {
  const value = weight === 'bold' ? 700 : Number(weight) || 400;
  if (value >= 900) return fonts.black;
  if (value >= 800) return fonts.extraBold;
  if (value >= 700) return fonts.bold;
  if (value >= 600) return fonts.semibold;
  if (value >= 500) return fonts.medium;
  return fonts.regular;
}

export function withTypography<T extends Record<string, Record<string, unknown>>>(styles: T): T {
  return Object.fromEntries(Object.entries(styles).map(([name, style]) => {
    if (!textKeys.some(key => key in style)) return [name, style];
    const { fontFamily: _fontFamily, fontWeight, ...rest } = style;
    return [name, { ...rest, fontFamily: familyFor(fontWeight) }];
  })) as T;
}
