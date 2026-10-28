import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { homeApi, openLegacy } from './src/api';
import { brands, categories, lifestyleImage, miniCategories, reviews, slides } from './src/content';
import { ChatWidget } from './src/components/ChatWidget';
import { Header } from './src/components/Header';
import { ProductCard, ProductSkeleton } from './src/components/ProductCard';
import { useStore } from './src/store';
import { withTypography } from './src/typography';
import type { Product, PromotionEvent } from './src/types';

export default function HomeScreen() {
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
      <ScrollView stickyHeaderIndices={[0]} style={styles.scroll} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Header compact={compact} categories={apiCategories.length ? apiCategories : categories.map(item => item[0])} />
        <View>
          <Hero compact={compact} desktop={desktop} />
          <TrustBar compact={compact} />

          <Section>
            <SectionTitle title="Mua theo danh mục" action="Xem tất cả" onPress={() => void openLegacy('/products')} />
            <View style={styles.grid}>{categories.map(([name, sub, image]) => <CategoryCard key={name} name={name} sub={sub} image={image} style={categoryWidth} />)}</View>
          </Section>

          {(loading || promotionError || promotion?.event) && <Section><FlashSale compact={compact} promotion={promotion} loading={loading} error={promotionError} onRetry={load} /></Section>}

          <Section>
            <SectionTitle title="Sản phẩm nổi bật" action="Xem thêm" onPress={() => void openLegacy('/products')} />
            {loading ? <View style={styles.grid}>{Array.from({ length: compact ? 4 : 8 }, (_, index) => <ProductSkeleton key={index} style={productWidth} />)}</View> : featured.length ? <View style={styles.grid}>{featured.map(product => <ProductCard key={product.id} product={product} style={productWidth} />)}</View> : <ErrorState title={featuredError ? 'Chưa thể tải sản phẩm' : 'Chưa có sản phẩm nổi bật'} message={featuredError ? 'Vui lòng kiểm tra kết nối Backend và thử lại.' : 'Khám phá thêm các sản phẩm trong cửa hàng.'} onRetry={load} />}
          </Section>

          <Lifestyle compact={compact} />
          <Brands />
          <Reviews compact={compact} />
          <Newsletter compact={compact} />
          <Footer compact={compact} />
        </View>
      </ScrollView>

      {!!notice && <View accessibilityLiveRegion="polite" style={styles.toast}><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={styles.toastText}>{notice}</Text></View>}
      <ChatWidget compact={compact} />
    </View>
  );
}

function Hero({ compact, desktop }: { compact: boolean; desktop: boolean }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setCurrent(value => (value + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, [paused]);

  return (
    <View style={[styles.heroShell, !desktop && styles.heroShellStack]}>
      <View style={[styles.hero, !desktop && styles.heroWide, compact && styles.heroCompact]}>
        <Image source={{ uri: slides[current].src }} accessibilityLabel={slides[current].alt} resizeMode="cover" style={styles.heroImage} />
        <View style={styles.heroOverlay} />
        <View style={[styles.heroCopy, compact && styles.heroCopyCompact]}>
          <Text style={styles.eyebrow}>GIA DỤNG VIỆT</Text>
          <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>Thiết bị gia dụng</Text>
          <Text style={styles.heroSubtitle}>Chăm chút từng góc nhà.</Text>
          <Text style={styles.heroDescription}>Nồi cơm điện, máy xay, nồi chiên và thiết bị chăm sóc nhà cửa chính hãng cho cuộc sống mỗi ngày.</Text>
          <View style={styles.heroActions}>
            <PrimaryButton label="Mua ngay" onPress={() => void openLegacy('/products')} />
            <SecondaryButton label="Xem nồi cơm điện" onPress={() => void openLegacy('/products?category=Nồi cơm điện')} />
          </View>
        </View>
        <View style={styles.heroControls}>
          {slides.map((slide, index) => <Pressable key={slide.src} accessibilityRole="button" accessibilityLabel={`Ảnh ${index + 1}`} accessibilityState={{ selected: current === index }} onPress={() => setCurrent(index)} style={[styles.heroDot, current === index && styles.heroDotActive]} />)}
          <Pressable accessibilityRole="button" accessibilityLabel={paused ? 'Tiếp tục trình chiếu' : 'Tạm dừng trình chiếu'} onPress={() => setPaused(value => !value)} style={styles.pause}><Ionicons name={paused ? 'play' : 'pause'} size={13} color="#fff" /></Pressable>
        </View>
      </View>

      <View style={[styles.miniGrid, !desktop && styles.miniGridRow]}>{miniCategories.map(([name, image]) => <Pressable key={name} accessibilityRole="link" onPress={() => void openLegacy(`/products?category=${encodeURIComponent(name)}`)} style={[styles.miniCard, !desktop && styles.miniCardRow]}><Image source={{ uri: image }} resizeMode="cover" style={styles.miniImage} /><View style={styles.miniOverlay} /><Text style={styles.miniText}>{name}</Text><Ionicons name="arrow-forward" size={17} color="#fff" style={styles.miniArrow} /></Pressable>)}</View>
    </View>
  );
}

function TrustBar({ compact }: { compact: boolean }) {
  const items = [
    ['cube-outline', 'Giao trong ngày', 'Nội thành HCM & HN'],
    ['shield-checkmark-outline', 'Bảo hành chính hãng', '12 - 24 tháng'],
    ['refresh-outline', 'Đổi trả miễn phí', 'Trong vòng 7 ngày'],
    ['headset-outline', 'Hỗ trợ 24/7', 'Chat & Gọi trực tiếp'],
    ['card-outline', 'Thanh toán an toàn', 'Thẻ, chuyển khoản, COD'],
  ] as const;
  return <View style={[styles.trustBar, compact && styles.trustBarCompact]}>{items.map(([icon, title, sub]) => <View key={title} style={[styles.trustItem, compact && styles.trustItemCompact]}><View style={styles.trustIcon}><Ionicons name={icon} size={22} color="#755036" /></View><View style={styles.trustCopy}><Text style={styles.trustTitle}>{title}</Text><Text style={styles.trustSub}>{sub}</Text></View></View>)}</View>;
}

function CategoryCard({ name, sub, image, style }: { name: string; sub: string; image: string; style: ViewStyle }) {
  const category = name === 'Robot hút bụi' ? 'Thiết bị gia dụng thông minh' : name;
  return <Pressable accessibilityRole="link" accessibilityLabel={`Xem ${name}`} onPress={() => void openLegacy(`/products?category=${encodeURIComponent(category)}`)} style={[styles.categoryCard, style]}><Image source={{ uri: image }} resizeMode="cover" style={styles.categoryImage} /><View style={styles.categoryCopy}><Text style={styles.categoryName}>{name}</Text><Text numberOfLines={1} style={styles.categorySub}>{sub}</Text></View></Pressable>;
}

function FlashSale({ compact, promotion, loading, error, onRetry }: { compact: boolean; promotion: { event: PromotionEvent | null; serverTime: string; receivedAt: number } | null; loading: boolean; error: boolean; onRetry: () => void }) {
  if (loading) return <View style={[styles.flash, compact && styles.flashCompact]}><View style={[styles.flashIntro, compact && styles.flashIntroCompact]}><ActivityIndicator color="#755036" /><Text style={styles.flashTitle}>Đang tải ưu đãi...</Text></View><ScrollView horizontal contentContainerStyle={styles.flashProducts}>{Array.from({ length: 4 }, (_, index) => <ProductSkeleton key={index} style={styles.dealCard} />)}</ScrollView></View>;
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
  return <View style={[styles.lifestyle, compact && styles.lifestyleCompact]}><Image source={{ uri: lifestyleImage }} accessibilityLabel="Không gian gia đình hiện đại" resizeMode="cover" style={styles.lifestyleImage} /><View style={styles.lifestyleOverlay} /><View style={styles.lifestyleCopy}><Text style={[styles.lifestyleTitle, compact && styles.lifestyleTitleCompact]}>Không gian gia đình{compact ? ' ' : '\n'}gọn gàng, tiện nghi và hiện đại</Text><Text style={styles.lifestyleText}>Chọn nhanh combo nồi cơm điện, máy xay, nồi chiên và thiết bị vệ sinh phù hợp nhu cầu gia đình.</Text><PrimaryButton label="Khám phá thiết bị" onPress={() => void openLegacy('/products?category=Thiết bị gia dụng thông minh')} /></View></View>;
}

function Brands() {
  return <Section><Text style={styles.smallHeading}>Thương hiệu nổi bật</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brands}>{brands.map(brand => <View key={brand} style={styles.brandPill}><Text style={styles.brandName}>{brand}</Text></View>)}</ScrollView></Section>;
}

function Reviews({ compact }: { compact: boolean }) {
  return <Section><Text style={styles.smallHeading}>Đánh giá từ khách hàng</Text><View style={[styles.reviewRow, compact && styles.reviewColumn]}><View style={[styles.scoreCard, compact && styles.reviewFull]}><Text style={styles.scoreStar}>★</Text><View><Text style={styles.score}>4.9/5</Text><Text style={styles.reviewMeta}>Đánh giá trung bình từ khách hàng</Text></View></View>{reviews.map(([name, text]) => <View key={text} style={[styles.reviewCard, compact && styles.reviewFull]}><View style={styles.reviewAvatar}><Text style={styles.reviewInitial}>K</Text></View><View style={styles.reviewCopy}><Text style={styles.reviewText}>“{text}”</Text><Text style={styles.reviewName}>{name}</Text></View></View>)}</View></Section>;
}

function Newsletter({ compact }: { compact: boolean }) {
  return <View style={[styles.newsletter, compact && styles.newsletterCompact]}><View><Text style={styles.newsletterTitle}>Nhận ưu đãi độc quyền qua email</Text><Text style={styles.newsletterText}>Đăng ký để không bỏ lỡ flash sale, sản phẩm mới và mã giảm giá riêng cho thành viên.</Text></View><View style={[styles.newsletterForm, compact && styles.newsletterFormCompact]}><TextInput accessibilityLabel="Email nhận ưu đãi" keyboardType="email-address" autoCapitalize="none" placeholder="Email của bạn" placeholderTextColor="#9B8A7C" style={styles.emailInput} /><Pressable accessibilityRole="button" onPress={() => Keyboard.dismiss()} style={styles.subscribe}><Text style={styles.subscribeText}>Đăng ký</Text></Pressable></View></View>;
}

function Footer({ compact }: { compact: boolean }) {
  return <View style={styles.footer}><View style={[styles.footerGrid, compact && styles.footerGridCompact]}><View style={styles.footerBrand}><View style={styles.footerBrandRow}><View style={styles.footerMark}><Ionicons name="home-outline" size={21} color="#755036" /></View><Text style={styles.footerBrandName}>Gia dụng Việt</Text></View><Text style={styles.footerNote}>Shop thương mại điện tử chuyên đồ gia dụng, thiết bị nhà bếp và thiết bị chăm sóc nhà cửa chính hãng.</Text></View><FooterColumn title="Danh mục" items={['Nồi cơm điện', 'Máy hút bụi', 'Máy xay sinh tố', 'Đồ dùng nhà bếp', 'Quạt điện']} paths={['/products?category=Nồi cơm điện', '/products?category=Máy hút bụi', '/products?category=Máy xay sinh tố', '/products?category=Đồ dùng nhà bếp', '/products?category=Quạt điện']} /><FooterColumn title="Hỗ trợ" items={['Về chúng tôi', 'Liên hệ', 'Chính sách giao hàng', 'Chính sách đổi trả', 'Chính sách bảo hành & thanh toán']} paths={['/about', '/contact', '/policies', '/policies', '/policies']} /><FooterColumn title="Liên hệ" items={['123 Nguyễn Trãi, Thanh Xuân, Hà Nội', '1800 6868', 'support@giadungviet.vn', '8:00 - 22:00 mỗi ngày']} paths={['/contact', '/contact', '/contact', '/contact']} /></View><View style={styles.copyright}><Text style={styles.copyrightText}>© 2023 Gia dụng Việt. All rights reserved.</Text></View></View>;
}

function FooterColumn({ title, items, paths }: { title: string; items: string[]; paths: string[] }) {
  return <View style={styles.footerColumn}><Text style={styles.footerTitle}>{title}</Text>{items.map((item, index) => <Pressable key={item} accessibilityRole="link" onPress={() => void openLegacy(paths[index])}><Text style={styles.footerLink}>{item}</Text></Pressable>)}</View>;
}

function Section({ children }: { children: ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

function SectionTitle({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  return <View style={styles.sectionTitle}><Text style={styles.sectionHeading}>{title}</Text><Pressable accessibilityRole="link" onPress={onPress} style={styles.textLink}><Text style={styles.textLinkLabel}>{action}</Text><Ionicons name="arrow-forward" size={15} color="#755036" /></Pressable></View>;
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{label}</Text><Ionicons name="arrow-forward" size={15} color="#fff" /></Pressable>;
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Text style={styles.secondaryButtonText}>{label}</Text></Pressable>;
}

function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return <View accessibilityRole="alert" style={styles.errorState}><Ionicons name="cloud-offline-outline" size={30} color="#9A6C4D" /><Text style={styles.errorTitle}>{title}</Text><Text style={styles.errorMessage}>{message}</Text><SecondaryButton label="Thử lại" onPress={onRetry} /></View>;
}

const styles = StyleSheet.create(withTypography({
  app: { flex: 1, backgroundColor: '#F6EFE6' },
  scroll: { flex: 1 },
  page: { minHeight: '100%', backgroundColor: '#F6EFE6' },
  section: { width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: 22, paddingVertical: 24 },
  sectionTitle: { marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeading: { color: '#30251D', fontSize: 22, fontWeight: '900' },
  smallHeading: { color: '#30251D', fontSize: 15, fontWeight: '900', marginBottom: 11 },
  textLink: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 6 },
  textLinkLabel: { color: '#755036', fontSize: 12, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  heroShell: { width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 14, flexDirection: 'row', gap: 12 },
  heroShellStack: { flexDirection: 'column' },
  hero: { flex: 1, minHeight: 500, borderRadius: 18, overflow: 'hidden', position: 'relative', backgroundColor: '#CBA779' },
  heroWide: { width: '100%' },
  heroCompact: { minHeight: 480 },
  heroImage: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  heroOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(45, 29, 17, .35)' },
  heroCopy: { width: '58%', maxWidth: 590, paddingHorizontal: 48, paddingVertical: 68, gap: 13 },
  heroCopyCompact: { width: '100%', paddingHorizontal: 24, paddingVertical: 52 },
  eyebrow: { color: '#F7E8D3', fontSize: 11, lineHeight: 16, letterSpacing: 1.2, fontWeight: '800' },
  heroTitle: { color: '#fff', fontSize: 44, lineHeight: 51, fontWeight: '900', textShadowColor: 'rgba(30, 18, 10, .35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  heroTitleCompact: { fontSize: 34, lineHeight: 41 },
  heroSubtitle: { color: '#FFF2E2', fontSize: 23, lineHeight: 28, fontWeight: '800' },
  heroDescription: { color: '#FFF8EF', fontSize: 15, lineHeight: 23, maxWidth: 430 },
  heroActions: { marginTop: 7, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  primaryButton: { minHeight: 42, alignSelf: 'flex-start', paddingHorizontal: 17, borderRadius: 10, backgroundColor: '#755036', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  secondaryButton: { minHeight: 42, alignSelf: 'flex-start', paddingHorizontal: 17, borderRadius: 10, backgroundColor: '#FFF9F1', borderWidth: 1, borderColor: '#CBA779', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#60422E', fontSize: 12, fontWeight: '900' },
  heroControls: { position: 'absolute', left: 0, right: 0, bottom: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  heroDot: { width: 9, height: 5, borderRadius: 4, backgroundColor: 'rgba(255,255,255,.65)' },
  heroDotActive: { width: 28, backgroundColor: '#E2A64B' },
  pause: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(48,37,29,.7)', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  miniGrid: { width: 278, gap: 12 },
  miniGridRow: { width: '100%', flexDirection: 'row', flexWrap: 'wrap' },
  miniCard: { flex: 1, minHeight: 115, borderRadius: 16, overflow: 'hidden', position: 'relative', justifyContent: 'flex-end', padding: 16 },
  miniCardRow: { minWidth: 155, width: '48%', flexBasis: '48%' },
  miniImage: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  miniOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(48,37,29,.36)' },
  miniText: { color: '#fff', fontSize: 15, lineHeight: 19, fontWeight: '900', maxWidth: '72%' },
  miniArrow: { position: 'absolute', right: 14, bottom: 14 },
  trustBar: { width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: 22, paddingVertical: 14, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E6D8C7' },
  trustBarCompact: { flexWrap: 'wrap' },
  trustItem: { flex: 1, minWidth: 170, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10, borderRightWidth: 1, borderRightColor: '#E6D8C7' },
  trustItemCompact: { width: '50%', minWidth: 145, borderRightWidth: 0 },
  trustIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1E1C8', alignItems: 'center', justifyContent: 'center' },
  trustCopy: { flex: 1 },
  trustTitle: { color: '#30251D', fontSize: 12, fontWeight: '900' },
  trustSub: { color: '#8B7767', fontSize: 10, marginTop: 3 },
  categoryCard: { minWidth: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E6D8C7' },
  categoryImage: { width: '100%', height: 118, backgroundColor: '#EFE6DC' },
  categoryCopy: { padding: 10, alignItems: 'center' },
  categoryName: { color: '#30251D', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  categorySub: { color: '#8C7868', fontSize: 10, marginTop: 3, textAlign: 'center' },
  flash: { minHeight: 330, borderRadius: 18, overflow: 'hidden', backgroundColor: '#F7DFB6', flexDirection: 'row', borderWidth: 1, borderColor: '#ECD1A4' },
  flashCompact: { flexDirection: 'column' },
  flashIntro: { width: 270, padding: 24, justifyContent: 'center', alignItems: 'flex-start', gap: 8, backgroundColor: '#F6D9A4' },
  flashIntroCompact: { width: '100%' },
  flashKicker: { color: '#7C4E20', fontSize: 26, fontWeight: '900' },
  flashTitle: { color: '#30251D', fontSize: 19, fontWeight: '900' },
  flashDescription: { color: '#604B3A', fontSize: 12, lineHeight: 18 },
  flashProducts: { padding: 14, gap: 10, alignItems: 'stretch' },
  dealCard: { width: 220 },
  countdown: { marginVertical: 6, flexDirection: 'row', gap: 5 },
  timeUnit: { minWidth: 46, paddingVertical: 7, borderRadius: 8, backgroundColor: '#FFFCF7', alignItems: 'center' },
  timeValue: { color: '#30251D', fontSize: 18, fontWeight: '900' },
  timeLabel: { color: '#7D6B5D', fontSize: 8, marginTop: 2 },
  errorState: { minHeight: 220, padding: 24, borderRadius: 16, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E6D8C7', alignItems: 'center', justifyContent: 'center', gap: 9 },
  errorTitle: { color: '#30251D', fontSize: 17, fontWeight: '900' },
  errorMessage: { color: '#7D6B5D', fontSize: 12, textAlign: 'center' },
  lifestyle: { width: '100%', maxWidth: 1360, alignSelf: 'center', minHeight: 300, marginVertical: 16, borderRadius: 18, overflow: 'hidden', justifyContent: 'center' },
  lifestyleCompact: { borderRadius: 0, minHeight: 350 },
  lifestyleImage: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  lifestyleOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(70,43,24,.4)' },
  lifestyleCopy: { width: '92%', maxWidth: 530, marginLeft: '5%', gap: 10 },
  lifestyleTitle: { color: '#fff', fontSize: 32, lineHeight: 38, fontWeight: '900' },
  lifestyleTitleCompact: { fontSize: 27, lineHeight: 33 },
  lifestyleText: { color: '#FFF8EF', fontSize: 13, lineHeight: 20, maxWidth: 450 },
  brands: { gap: 9 },
  brandPill: { minWidth: 130, height: 48, paddingHorizontal: 18, borderRadius: 10, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E6D8C7', alignItems: 'center', justifyContent: 'center' },
  brandName: { color: '#755036', fontSize: 14, fontWeight: '900' },
  reviewRow: { flexDirection: 'row', gap: 10 },
  reviewColumn: { flexWrap: 'wrap' },
  reviewFull: { width: '100%' },
  scoreCard: { width: 220, minHeight: 90, padding: 15, borderRadius: 13, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E6D8C7', flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreStar: { color: '#D79B31', fontSize: 28 },
  score: { color: '#30251D', fontSize: 19, fontWeight: '900' },
  reviewMeta: { color: '#8C7868', fontSize: 9, marginTop: 3 },
  reviewCard: { flex: 1, minWidth: 220, minHeight: 90, padding: 14, borderRadius: 13, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#E6D8C7', flexDirection: 'row', gap: 10 },
  reviewAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E8D5BA', alignItems: 'center', justifyContent: 'center' },
  reviewInitial: { color: '#755036', fontSize: 13, fontWeight: '900' },
  reviewCopy: { flex: 1 },
  reviewText: { color: '#4E3C30', fontSize: 11, lineHeight: 16 },
  reviewName: { color: '#755036', fontSize: 10, fontWeight: '900', marginTop: 7 },
  newsletter: { width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: 22, paddingVertical: 20, backgroundColor: '#E8D5BA', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24 },
  newsletterCompact: { paddingHorizontal: 20, flexDirection: 'column', alignItems: 'stretch' },
  newsletterTitle: { color: '#4D3423', fontSize: 17, fontWeight: '900' },
  newsletterText: { color: '#745E4C', fontSize: 10, marginTop: 4 },
  newsletterForm: { width: '42%', minWidth: 350, flexDirection: 'row', gap: 7 },
  newsletterFormCompact: { width: '100%', minWidth: 0 },
  emailInput: { flex: 1, minHeight: 42, paddingHorizontal: 13, borderRadius: 9, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#D5BEA3', color: '#30251D' },
  subscribe: { minWidth: 110, borderRadius: 9, backgroundColor: '#755036', alignItems: 'center', justifyContent: 'center' },
  subscribeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  footer: { backgroundColor: '#FFFCF7', borderTopWidth: 1, borderTopColor: '#E6D8C7' },
  footerGrid: { width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: 22, paddingVertical: 28, flexDirection: 'row', gap: 42 },
  footerGridCompact: { flexWrap: 'wrap', gap: 24 },
  footerBrand: { flex: 1.5, minWidth: 230 },
  footerBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerMark: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#E8D5BA', alignItems: 'center', justifyContent: 'center' },
  footerBrandName: { color: '#30251D', fontSize: 16, fontWeight: '900' },
  footerNote: { color: '#7D6B5D', fontSize: 10, lineHeight: 16, marginTop: 9, maxWidth: 280 },
  footerColumn: { flex: 1, minWidth: 150, gap: 7 },
  footerTitle: { color: '#30251D', fontSize: 12, fontWeight: '900', marginBottom: 2 },
  footerLink: { color: '#6F5D50', fontSize: 10, lineHeight: 16 },
  copyright: { borderTopWidth: 1, borderTopColor: '#E6D8C7', padding: 12, alignItems: 'center' },
  copyrightText: { color: '#8C7868', fontSize: 9 },
  toast: { position: 'absolute', top: 96, alignSelf: 'center', maxWidth: '90%', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 10, backgroundColor: '#755036', flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 120, boxShadow: '0 10px 30px rgba(48,37,29,.22)' },
  toastText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.76 },
}));
