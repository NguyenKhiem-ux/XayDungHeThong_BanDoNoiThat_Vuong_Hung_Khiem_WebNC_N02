import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { homeApi, openLegacy } from './src/api';
import { brands, categories, lifestyleImage, miniCategories, reviews, slides } from './src/content';
import { ChatWidget } from './src/components/ChatWidget';
import { Header } from './src/components/Header';
import { ProductFooter } from './src/components/ProductFooter';
import { ProductCard, ProductSkeleton } from './src/components/ProductCard';
import { useStore } from './src/store';
import { withTypography } from './src/typography';
import { colors } from './src/theme';
import type { Product, PromotionEvent } from './src/types';
import { ScrollTopButton, useScrollTop } from './src/components/ScrollTopButton';

const openHomeLink = (path: string) => path.startsWith('/products') || ['/about', '/contact', '/policies'].includes(path) ? router.push(path as Href) : void openLegacy(path);

export default function HomeScreen() {
  const top = useScrollTop();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const desktop = width >= 1020;
  const { notice } = useStore();
  const [featured, setFeatured] = useState<Product[]>([]);
  const [promotion, setPromotion] = useState<{ event: PromotionEvent | null; serverTime: string; receivedAt: number } | null>(null);
  const [apiCategories, setApiCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState(false);
  const [promotionError, setPromotionError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [productsResult, promotionResult, categoriesResult] = await Promise.allSettled([homeApi.featured(), homeApi.promotion(), homeApi.categories()]);
    if (productsResult.status === 'fulfilled') {
      setFeatured(productsResult.value);
      setFeaturedError(false);
    } else {
      setFeatured([]);
      setFeaturedError(true);
    }
    if (promotionResult.status === 'fulfilled') {
      setPromotion({ ...promotionResult.value, receivedAt: Date.now() });
      setPromotionError(false);
    } else {
      setPromotion(null);
      setPromotionError(true);
    }
    if (categoriesResult.status === 'fulfilled') setApiCategories(categoriesResult.value);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const productWidth = useMemo<ViewStyle>(() => ({ width: desktop ? '23.7%' : compact ? '48.2%' : '31.8%' }), [compact, desktop]);
  const categoryWidth = useMemo<ViewStyle>(() => ({ width: desktop ? '15.5%' : compact ? '48.2%' : '31.8%' }), [compact, desktop]);

  return (
    <View style={styles.app}>
      <StatusBar style="dark" />
      <ScrollView ref={top.ref} onScroll={top.onScroll} scrollEventThrottle={100} stickyHeaderIndices={[0]} style={styles.scroll} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Header compact={compact} categories={apiCategories.length ? apiCategories : categories.map(item => item[0])} />
        <View>
          <Hero compact={compact} />
          <TrustBar compact={compact} />

          <Section>
            <SectionTitle title="Mua theo danh mục" action="Xem tất cả" onPress={() => openHomeLink('/products')} />
            <View style={styles.grid}>{categories.map(([name, sub, image]) => <CategoryCard key={name} name={name} sub={sub} image={image} style={categoryWidth} />)}</View>
          </Section>

          {(loading || promotionError || promotion?.event) && <Section><FlashSale compact={compact} promotion={promotion} loading={loading} error={promotionError} onRetry={load} /></Section>}

          <Section>
            <SectionTitle title="Sản phẩm nổi bật" action="Xem thêm" onPress={() => openHomeLink('/products')} />
            {loading ? <View style={styles.grid}>{Array.from({ length: compact ? 4 : 8 }, (_, index) => <ProductSkeleton key={index} style={productWidth} />)}</View> : featured.length ? <View style={styles.grid}>{featured.map(product => <ProductCard key={product.id} product={product} style={productWidth} />)}</View> : <ErrorState title={featuredError ? 'Chưa thể tải sản phẩm' : 'Chưa có sản phẩm nổi bật'} message={featuredError ? 'Vui lòng kiểm tra kết nối Backend và thử lại.' : 'Khám phá thêm các sản phẩm trong cửa hàng.'} onRetry={load} />}
          </Section>

          <Lifestyle compact={compact} />
          <Brands />
          <Reviews compact={compact} />
          <Newsletter compact={compact} />
          {/* ProductFooter kéo tràn -12/-16 theo padding của các màn khác; trang chủ không có padding nên bù lại. */}
          <View style={styles.footerSlot}><ProductFooter /></View>
        </View>
      </ScrollView>

      {!!notice && <View accessibilityLiveRegion="polite" style={styles.toast}><Ionicons name="checkmark-circle" size={18} color={colors.white} /><Text style={styles.toastText}>{notice}</Text></View>}
      <ScrollTopButton visible={top.visible} onPress={top.toTop} />
      <ChatWidget compact={compact} />
    </View>
  );
}

function Hero({ compact }: { compact: boolean }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setCurrent(value => (value + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, [paused]);

  // Banner theo hero-showcase của frontend: ảnh tràn ngang, chữ ở giữa, chấm + tạm dừng bên trái, chỉ số bên phải, thanh tiến trình ở đáy.
  return (
    <View>
      <View style={[styles.hero, compact && styles.heroCompact]}>
        {/* Xếp chồng mọi ảnh và đổi opacity để bản web mờ dần như frontend; app đổi ảnh tức thì. */}
        {slides.map((slide, index) => <Image key={slide.src} source={{ uri: slide.src }} accessibilityLabel={slide.alt} accessibilityElementsHidden={index !== current} resizeMode="cover" style={[styles.heroImage, { opacity: index === current ? 1 : 0 }]} />)}
        <View style={styles.heroOverlay} />
        <View style={[styles.heroCopy, compact && styles.heroCopyCompact]}>
          <Text style={styles.eyebrow}>Gia dụng Việt</Text>
          <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>Thiết bị gia dụng</Text>
          <Text style={[styles.heroSubtitle, compact && styles.heroSubtitleCompact]}>Chăm chút từng góc nhà.</Text>
          <Text style={styles.heroDescription}>Nồi cơm điện, máy xay, nồi chiên và thiết bị chăm sóc nhà cửa chính hãng cho cuộc sống mỗi ngày.</Text>
          <View style={styles.heroActions}>
            <HeroButton primary icon="bag-handle" label="Mua ngay" onPress={() => openHomeLink('/products')} />
            <HeroButton icon="restaurant" label="Xem nồi cơm điện" onPress={() => openHomeLink('/products?category=Nồi cơm điện')} />
          </View>
        </View>
        <View style={[styles.heroControls, compact && styles.heroControlsCompact]}>
          {slides.map((slide, index) => <Pressable key={slide.src} accessibilityRole="button" accessibilityLabel={`Ảnh ${index + 1}`} accessibilityState={{ selected: current === index }} onPress={() => setCurrent(index)} style={styles.heroDot}><View style={[styles.heroDotMark, current === index && styles.heroDotActive]} /></Pressable>)}
          <HoverPressable accessibilityLabel={paused ? 'Tiếp tục trình chiếu' : 'Tạm dừng trình chiếu'} onPress={() => setPaused(value => !value)} style={styles.pause} hoverStyle={styles.pauseHover}><Ionicons name={paused ? 'play' : 'pause'} size={16} color={colors.white} /></HoverPressable>
        </View>
        {!compact && <View style={styles.heroStat}><Text style={styles.heroStatValue}>98%</Text><Text style={styles.heroStatLabel}>khách hàng hài lòng</Text></View>}
        <View style={styles.heroProgress}><View style={[styles.heroProgressBar, { width: `${((current + 1) / slides.length) * 100}%` }]} /></View>
      </View>

      <View style={[styles.miniGrid, compact && styles.miniGridCompact]}>{miniCategories.map(([name, image]) => <HoverPressable key={name} accessibilityRole="link" accessibilityLabel={name} onPress={() => openHomeLink(`/products?category=${encodeURIComponent(name)}`)} style={[styles.miniCard, compact && styles.miniCardCompact]} hoverStyle={styles.miniCardHover}><Image source={{ uri: image }} resizeMode="contain" style={[styles.miniImage, compact && styles.miniImageCompact]} /><Text style={styles.miniText}>{name}</Text>{!compact && <Ionicons name="arrow-forward" size={18} color={colors.brand} style={styles.miniArrow} />}</HoverPressable>)}</View>
    </View>
  );
}

// Hover chỉ chạy trên web (onHoverIn không bao giờ được gọi trên app).
function HoverPressable({ style, hoverStyle, accessibilityRole = 'button', ...props }: Omit<ComponentProps<typeof Pressable>, 'style'> & { style: StyleProp<ViewStyle>; hoverStyle: StyleProp<ViewStyle> }) {
  const [hovered, setHovered] = useState(false);
  return <Pressable {...props} accessibilityRole={accessibilityRole} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} style={({ pressed }) => [style, (hovered || pressed) && hoverStyle]} />;
}

function HeroButton({ primary, icon, label, onPress }: { primary?: boolean; icon: ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return <HoverPressable accessibilityRole="link" onPress={onPress} style={[styles.heroButton, primary ? styles.heroButtonPrimary : styles.heroButtonLight]} hoverStyle={primary ? styles.heroButtonPrimaryHover : styles.heroButtonLightHover}><Ionicons name={icon} size={16} color={colors.white} /><Text style={styles.heroButtonText}>{label}</Text></HoverPressable>;
}

function TrustBar({ compact }: { compact: boolean }) {
  const items = [
    ['car-outline', 'Giao trong ngày', 'Nội thành HCM & HN'],
    ['shield-checkmark-outline', 'Bảo hành chính hãng', '12 - 24 tháng'],
    ['refresh-outline', 'Đổi trả miễn phí', 'Trong vòng 7 ngày'],
    ['headset-outline', 'Hỗ trợ 24/7', 'Chat & Gọi trực tiếp'],
    ['card-outline', 'Thanh toán an toàn', 'Thẻ, chuyển khoản, COD'],
  ] as const;
  return <View style={[styles.trustBar, compact && styles.trustBarCompact]}>{items.map(([icon, title, sub]) => <View key={title} style={[styles.trustItem, compact && styles.trustItemCompact]}><View style={styles.trustIcon}><Ionicons name={icon} size={22} color={colors.brand} /></View><View style={styles.trustCopy}><Text style={styles.trustTitle}>{title}</Text><Text style={styles.trustSub}>{sub}</Text></View></View>)}</View>;
}

function CategoryCard({ name, sub, image, style }: { name: string; sub: string; image: string; style: ViewStyle }) {
  const category = name === 'Robot hút bụi' ? 'Thiết bị gia dụng thông minh' : name;
  return <Pressable accessibilityRole="link" accessibilityLabel={`Xem ${name}`} onPress={() => openHomeLink(`/products?category=${encodeURIComponent(category)}`)} style={[styles.categoryCard, style]}><Image source={{ uri: image }} resizeMode="cover" style={styles.categoryImage} /><View style={styles.categoryCopy}><Text style={styles.categoryName}>{name}</Text><Text numberOfLines={1} style={styles.categorySub}>{sub}</Text></View></Pressable>;
}

function FlashSale({ compact, promotion, loading, error, onRetry }: { compact: boolean; promotion: { event: PromotionEvent | null; serverTime: string; receivedAt: number } | null; loading: boolean; error: boolean; onRetry: () => void }) {
  if (loading) return <View style={[styles.flash, compact && styles.flashCompact]}><View style={[styles.flashIntro, compact && styles.flashIntroCompact]}><ActivityIndicator color={colors.ink} /><Text style={styles.flashTitle}>Đang tải ưu đãi...</Text></View><ScrollView horizontal contentContainerStyle={styles.flashProducts}>{Array.from({ length: 4 }, (_, index) => <ProductSkeleton key={index} style={styles.dealCard} />)}</ScrollView></View>;
  if (error) return <ErrorState title="Chưa thể tải ưu đãi" message="Giá và thời gian Flash Sale luôn được lấy trực tiếp từ API." onRetry={onRetry} />;
  if (!promotion?.event) return null;
  return <View style={[styles.flash, compact && styles.flashCompact]}>
    <View style={[styles.flashIntro, compact && styles.flashIntroCompact]}><Text style={styles.flashKicker}>FLASH SALE</Text><Text style={styles.flashTitle}>{promotion.event.title}</Text><Text style={styles.flashDescription}>{promotion.event.description}</Text><Countdown endsAt={promotion.event.endsAt} serverTime={promotion.serverTime} receivedAt={promotion.receivedAt} /><PrimaryButton label="Xem tất cả" onPress={() => void openLegacy('/offers')} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.flashProducts}>{promotion.event.products.map(product => <ProductCard key={product.id} product={product} deal style={styles.dealCard} />)}</ScrollView>
  </View>;
}

function Countdown({ endsAt, serverTime, receivedAt }: { endsAt: string; serverTime: string; receivedAt: number }) {
  const remaining = useCallback(() => Math.max(0, Math.ceil((Date.parse(endsAt) - Date.parse(serverTime) - (Date.now() - receivedAt)) / 1000)), [endsAt, receivedAt, serverTime]);
  const [seconds, setSeconds] = useState(remaining);
  useEffect(() => { setSeconds(remaining()); const timer = setInterval(() => setSeconds(remaining()), 1000); return () => clearInterval(timer); }, [remaining]);
  const units = [[Math.floor(seconds / 86400), 'Ngày'], [Math.floor(seconds % 86400 / 3600), 'Giờ'], [Math.floor(seconds % 3600 / 60), 'Phút'], [seconds % 60, 'Giây']] as const;
  return <View accessibilityRole="timer" accessibilityLabel={`${units.map(([value, label]) => `${value} ${label}`).join(' ')}`} style={styles.countdown}>{units.map(([value, label]) => <View key={label} style={styles.timeUnit}><Text style={styles.timeValue}>{String(value).padStart(2, '0')}</Text><Text style={styles.timeLabel}>{label}</Text></View>)}</View>;
}

function Lifestyle({ compact }: { compact: boolean }) {
  return <View style={[styles.lifestyle, compact && styles.lifestyleCompact]}><Image source={{ uri: lifestyleImage }} accessibilityLabel="Không gian gia đình hiện đại" resizeMode="cover" style={styles.lifestyleImage} /><View style={styles.lifestyleOverlay} /><View style={styles.lifestyleCopy}><Text style={[styles.lifestyleTitle, compact && styles.lifestyleTitleCompact]}>Không gian gia đình{compact ? ' ' : '\n'}gọn gàng, tiện nghi và hiện đại</Text><Text style={styles.lifestyleText}>Chọn nhanh combo nồi cơm điện, máy xay, nồi chiên và thiết bị vệ sinh phù hợp nhu cầu gia đình.</Text><PrimaryButton label="Khám phá thiết bị" onPress={() => openHomeLink('/products?category=Thiết bị gia dụng thông minh')} /></View></View>;
}

function Brands() {
  return <Section><Text style={styles.smallHeading}>Thương hiệu nổi bật</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brands}>{brands.map(brand => <View key={brand} style={styles.brandPill}><Text style={styles.brandName}>{brand}</Text></View>)}</ScrollView></Section>;
}

function Reviews({ compact }: { compact: boolean }) {
  return <Section><Text style={styles.smallHeading}>Đánh giá từ khách hàng</Text><View style={[styles.reviewRow, compact && styles.reviewColumn]}><View style={[styles.scoreCard, compact && styles.reviewFull]}><Text style={styles.scoreStar}>★</Text><View><Text style={styles.score}>4.9/5</Text><Text style={styles.reviewMeta}>Đánh giá trung bình từ khách hàng</Text></View></View>{reviews.map(([name, text]) => <View key={text} style={[styles.reviewCard, compact && styles.reviewFull]}><View style={styles.reviewAvatar}><Text style={styles.reviewInitial}>K</Text></View><View style={styles.reviewCopy}><Text style={styles.reviewText}>“{text}”</Text><Text style={styles.reviewName}>{name}</Text></View></View>)}</View></Section>;
}

function Newsletter({ compact }: { compact: boolean }) {
  return <View style={[styles.newsletter, compact && styles.newsletterCompact]}><View><Text style={styles.newsletterTitle}>Nhận ưu đãi độc quyền qua email</Text><Text style={styles.newsletterText}>Đăng ký để không bỏ lỡ flash sale, sản phẩm mới và mã giảm giá riêng cho thành viên.</Text></View><View style={[styles.newsletterForm, compact && styles.newsletterFormCompact]}><TextInput accessibilityLabel="Email nhận ưu đãi" keyboardType="email-address" autoCapitalize="none" placeholder="Email của bạn" placeholderTextColor={colors.muted} style={styles.emailInput} /><Pressable accessibilityRole="button" onPress={() => Keyboard.dismiss()} style={styles.subscribe}><Text style={styles.subscribeText}>Đăng ký</Text></Pressable></View></View>;
}

function Section({ children }: { children: ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

function SectionTitle({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  return <View style={styles.sectionTitle}><Text style={styles.sectionHeading}>{title}</Text><Pressable accessibilityRole="link" onPress={onPress} style={styles.textLink}><Text style={styles.textLinkLabel}>{action}</Text><Ionicons name="arrow-forward" size={15} color={colors.ink} /></Pressable></View>;
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{label}</Text><Ionicons name="arrow-forward" size={15} color={colors.white} /></Pressable>;
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Text style={styles.secondaryButtonText}>{label}</Text></Pressable>;
}

function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return <View accessibilityRole="alert" style={styles.errorState}><Ionicons name="cloud-offline-outline" size={30} color={colors.ink} /><Text style={styles.errorTitle}>{title}</Text><Text style={styles.errorMessage}>{message}</Text><SecondaryButton label="Thử lại" onPress={onRetry} /></View>;
}

const styles = StyleSheet.create(withTypography({
  app: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  page: { minHeight: '100%', backgroundColor: colors.bg },
  section: { width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: 22, paddingVertical: 24 },
  sectionTitle: { marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeading: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  smallHeading: { color: colors.ink, fontSize: 15, fontWeight: '900', marginBottom: 11 },
  textLink: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 6 },
  textLinkLabel: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  hero: { width: '100%', minHeight: 460, overflow: 'hidden', position: 'relative', justifyContent: 'center', alignItems: 'center', backgroundColor: '#303F36' },
  heroCompact: { minHeight: 420 },
  heroImage: { position: 'absolute', inset: 0, width: '100%', height: '100%', transitionProperty: 'opacity', transitionDuration: '600ms' },
  heroOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(17, 22, 26, 0.55)' },
  heroCopy: { width: '100%', maxWidth: 760, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 76, alignItems: 'center' },
  heroCopyCompact: { paddingTop: 40, paddingBottom: 70 },
  eyebrow: { color: colors.accent, fontSize: 14, lineHeight: 20, fontWeight: '600', marginBottom: 10 },
  heroTitle: { maxWidth: 700, color: colors.white, fontSize: 58, lineHeight: 67, fontWeight: '700', textAlign: 'center' },
  heroTitleCompact: { fontSize: 38, lineHeight: 44 },
  heroSubtitle: { color: colors.white, fontSize: 28, lineHeight: 36, fontWeight: '500', marginTop: 8, marginBottom: 18, textAlign: 'center' },
  heroSubtitleCompact: { fontSize: 22, lineHeight: 29 },
  heroDescription: { maxWidth: 580, color: '#F0F3F0', fontSize: 15, lineHeight: 25, marginBottom: 24, textAlign: 'center' },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  heroButton: { minHeight: 44, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroButtonPrimary: { backgroundColor: colors.accent },
  heroButtonPrimaryHover: { backgroundColor: '#087397' },
  heroButtonLight: { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.65)', backgroundColor: 'rgba(17, 22, 26, 0.22)' },
  heroButtonLightHover: { backgroundColor: 'rgba(17, 22, 26, 0.55)' },
  heroButtonText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  heroStat: { position: 'absolute', bottom: 30, right: 40, paddingLeft: 18, borderLeftWidth: 2, borderLeftColor: colors.accent },
  heroStatValue: { color: colors.white, fontSize: 30, lineHeight: 36, fontWeight: '800', textAlign: 'center' },
  heroStatLabel: { color: colors.white, fontSize: 12 },
  heroProgress: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: 'rgba(255, 255, 255, 0.18)' },
  heroProgressBar: { height: '100%', backgroundColor: colors.accent, transitionProperty: 'width', transitionDuration: '5000ms', transitionTimingFunction: 'linear' },
  primaryButton: { minHeight: 42, alignSelf: 'flex-start', paddingHorizontal: 17, borderRadius: 999, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryButtonText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  secondaryButton: { minHeight: 42, alignSelf: 'flex-start', paddingHorizontal: 17, borderRadius: 999, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.subtle, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  // Căn chấm điều hướng theo mép trái nội dung 1240px như frontend.
  heroControls: { position: 'absolute', bottom: 12, left: 0, right: 0, width: '100%', maxWidth: 1240, alignSelf: 'center', paddingHorizontal: 34, flexDirection: 'row', alignItems: 'center', gap: 2 },
  heroControlsCompact: { paddingHorizontal: 10 },
  heroDot: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  heroDotMark: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255, 255, 255, 0.55)' },
  heroDotActive: { width: 18, backgroundColor: colors.accent },
  pause: { width: 36, height: 36, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  pauseHover: { backgroundColor: 'rgba(255, 255, 255, 0.15)' },
  miniGrid: { width: '100%', maxWidth: 1240, alignSelf: 'center', paddingHorizontal: 20, marginTop: 24, flexDirection: 'row', gap: 16 },
  miniGridCompact: { flexWrap: 'wrap', gap: 10 },
  miniCard: { flex: 1, minHeight: 88, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 14 },
  miniCardCompact: { flexBasis: '45%', padding: 10, gap: 8 },
  miniCardHover: { borderColor: colors.brand },
  miniImage: { width: 62, height: 62 },
  miniImageCompact: { width: 44, height: 52 },
  miniText: { flexShrink: 1, color: colors.ink, fontSize: 14, fontWeight: '600' },
  miniArrow: { marginLeft: 'auto' },
  trustBar: { width: '100%', maxWidth: 1240, alignSelf: 'center', paddingHorizontal: 20, marginTop: 24, paddingVertical: 16, flexDirection: 'row', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  trustBarCompact: { flexWrap: 'wrap' },
  trustItem: { flex: 1, minWidth: 170, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  trustItemCompact: { width: '45%', minWidth: 145 },
  trustIcon: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center' },
  trustCopy: { flex: 1 },
  trustTitle: { color: colors.ink, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  trustSub: { color: colors.muted, fontSize: 11, marginTop: 1 },
  categoryCard: { minWidth: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  categoryImage: { width: '100%', height: 118, backgroundColor: colors.lineSoft },
  categoryCopy: { padding: 10, alignItems: 'center' },
  categoryName: { color: colors.ink, fontSize: 12, fontWeight: '900', textAlign: 'center' },
  categorySub: { color: colors.muted, fontSize: 12, marginTop: 3, textAlign: 'center' },
  flash: { minHeight: 330, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.lineSoft, flexDirection: 'row', borderWidth: 1, borderColor: colors.line },
  flashCompact: { flexDirection: 'column' },
  flashIntro: { width: 270, padding: 24, justifyContent: 'center', alignItems: 'flex-start', gap: 8, backgroundColor: colors.line },
  flashIntroCompact: { width: '100%' },
  flashKicker: { color: colors.ink, fontSize: 26, fontWeight: '900' },
  flashTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  flashDescription: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  flashProducts: { padding: 14, gap: 10, alignItems: 'stretch' },
  dealCard: { width: 220 },
  countdown: { marginVertical: 6, flexDirection: 'row', gap: 5 },
  timeUnit: { minWidth: 46, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.white, alignItems: 'center' },
  timeValue: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  timeLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  errorState: { minHeight: 220, padding: 24, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: 9 },
  errorTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  errorMessage: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  lifestyle: { width: '100%', maxWidth: 1360, alignSelf: 'center', minHeight: 300, marginVertical: 16, borderRadius: 18, overflow: 'hidden', justifyContent: 'center' },
  lifestyleCompact: { borderRadius: 0, minHeight: 350 },
  lifestyleImage: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  lifestyleOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0,.4)' },
  lifestyleCopy: { width: '92%', maxWidth: 530, marginLeft: '5%', gap: 10 },
  lifestyleTitle: { color: colors.white, fontSize: 32, lineHeight: 38, fontWeight: '900' },
  lifestyleTitleCompact: { fontSize: 27, lineHeight: 33 },
  lifestyleText: { color: colors.bg, fontSize: 13, lineHeight: 20, maxWidth: 450 },
  brands: { gap: 9 },
  brandPill: { minWidth: 130, height: 48, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  brandName: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  reviewRow: { flexDirection: 'row', gap: 10 },
  reviewColumn: { flexWrap: 'wrap' },
  reviewFull: { width: '100%' },
  scoreCard: { width: 220, minHeight: 90, padding: 15, borderRadius: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreStar: { color: '#D79B31', fontSize: 28 },
  score: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  reviewMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  reviewCard: { flex: 1, minWidth: 220, minHeight: 90, padding: 14, borderRadius: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', gap: 10 },
  reviewAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  reviewInitial: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  reviewCopy: { flex: 1 },
  reviewText: { color: colors.ink, fontSize: 11, lineHeight: 16 },
  reviewName: { color: colors.ink, fontSize: 12, fontWeight: '900', marginTop: 7 },
  newsletter: { width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: 22, paddingVertical: 20, backgroundColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24 },
  newsletterCompact: { paddingHorizontal: 20, flexDirection: 'column', alignItems: 'stretch' },
  newsletterTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  newsletterText: { color: colors.muted, fontSize: 12, marginTop: 4 },
  newsletterForm: { width: '42%', minWidth: 350, flexDirection: 'row', gap: 7 },
  newsletterFormCompact: { width: '100%', minWidth: 0 },
  emailInput: { flex: 1, minHeight: 42, paddingHorizontal: 13, borderRadius: 9, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.subtle, color: colors.ink },
  subscribe: { minWidth: 110, borderRadius: 9, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  subscribeText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  footerSlot: { marginHorizontal: 12, marginBottom: 16 },
  toast: { position: 'absolute', top: 96, alignSelf: 'center', maxWidth: '90%', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 10, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 120 },
  toastText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.76 },
}));
