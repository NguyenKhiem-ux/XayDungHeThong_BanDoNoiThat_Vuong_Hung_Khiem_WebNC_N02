import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { accountApi, formatVnd, imageUrl } from '../api';
import { ChatWidget } from '../components/ChatWidget';
import { Header } from '../components/Header';
import { OrderProductImage } from '../components/OrderProductImage';
import { ProductCard } from '../components/ProductCard';
import { ProductFooter } from '../components/ProductFooter';
import { avatarMimeType, avatarValidationError, profileBackendField, profileValidationErrors } from '../profileValidation.mjs';
import { useStore } from '../store';
import { withTypography } from '../typography';
import type { Coupon, Order, UserAddress } from '../types';

type ProfileForm = { fullName: string; email: string; phone: string; birthDate: string; gender: NonNullable<ReturnType<typeof profileGender>>; address: string };
type ProfileFieldErrors = Partial<Record<'fullName' | 'email' | 'phone' | 'birthDate', string>>;
type CardForm = { holder: string; type: 'DOMESTIC' | 'INTERNATIONAL'; provider: string; cardNumber: string; expMonth: string; expYear: string; pin: string; confirmPin: string };

const statusLabels: Record<Order['status'], string> = { PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy' };
const menu = [
  ['profile', 'Hồ sơ cá nhân', 'person-circle-outline'], ['orders', 'Đơn hàng của tôi', 'receipt-outline'], ['coupons', 'Mã giảm giá', 'ticket-outline'],
  ['favorites', 'Sản phẩm yêu thích', 'heart-outline'], ['addresses', 'Địa chỉ giao hàng', 'location-outline'], ['payment', 'Thẻ / thanh toán', 'card-outline'],
] as const;

function profileGender(value?: string | null): 'male' | 'female' | 'other' { return value === 'female' || value === 'other' ? value : 'male'; }

export default function ProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const { authReady, user, logout, notice, refreshUser, setNotice, favorites, favoritesError, favoritesLoading, refreshFavorites } = useStore();
  const scrollRef = useRef<{ scrollTo: (options: { y: number; animated: boolean }) => void } | null>(null);
  const positions = useRef<Record<string, number>>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [sectionErrors, setSectionErrors] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [cardBusy, setCardBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [cardError, setCardError] = useState('');
  const [showAllFavorites, setShowAllFavorites] = useState(false);
  const [showAllCoupons, setShowAllCoupons] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState<ProfileForm>({ fullName: '', email: '', phone: '', birthDate: '', gender: 'male', address: '' });
  const [card, setCard] = useState<CardForm>({ holder: '', type: 'DOMESTIC', provider: 'NAPAS', cardNumber: '', expMonth: '', expYear: '', pin: '', confirmPin: '' });

  const defaultAddress = useMemo(() => addresses.find(item => item.isDefault) || addresses[0], [addresses]);
  const activeCoupons = useMemo(() => coupons.filter(item => item.isActive && new Date(item.endDate).getTime() >= Date.now()), [coupons]);

  useEffect(() => {
    if (authReady && !user) router.replace('/login');
  }, [authReady, router, user]);

  useEffect(() => {
    if (!user) return;
    if (!editing) setForm({ fullName: user.fullName || user.username || '', email: user.email, phone: user.phone || '', birthDate: user.birthDate?.slice(0, 10) || '', gender: profileGender(user.gender), address: user.address || '' });
    const saved = user.savedCard;
    setCard(current => ({ ...current, holder: saved?.holder || user.fullName, type: saved?.type || 'DOMESTIC', provider: saved?.provider || 'NAPAS', expMonth: saved ? String(saved.expMonth) : '', expYear: saved ? String(saved.expYear) : '' }));
  }, [editing, user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    setDataError('');
    void Promise.allSettled([accountApi.orders(), accountApi.addresses(), accountApi.coupons()]).then(results => {
      if (!active) return;
      const [orderResult, addressResult, couponResult] = results;
      setSectionErrors({ orders: orderResult.status === 'rejected', addresses: addressResult.status === 'rejected', coupons: couponResult.status === 'rejected' });
      if (orderResult.status === 'fulfilled') setOrders(orderResult.value);
      else setOrders([]);
      if (addressResult.status === 'fulfilled') setAddresses(addressResult.value);
      else setAddresses([]);
      if (couponResult.status === 'fulfilled') setCoupons(couponResult.value);
      else setCoupons([]);
      if (results.every(result => result.status === 'rejected')) setDataError('Không thể tải dữ liệu tài khoản. Vui lòng thử lại.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [reloadKey, user]);

  const scrollTo = (key: string) => scrollRef.current?.scrollTo({ y: Math.max(0, (positions.current[key] || 0) - 18), animated: true });
  const setPosition = (key: string) => (event: LayoutChangeEvent) => { positions.current[key] = event.nativeEvent.layout.y; };
  const retryProfileData = () => setReloadKey(value => value + 1);

  const changeProfileField = <Key extends keyof ProfileForm>(key: Key, value: ProfileForm[Key]) => {
    const next = { ...form, [key]: value };
    setForm(next);
    if (key === 'fullName' || key === 'email' || key === 'phone' || key === 'birthDate') {
      const nextErrors = profileValidationErrors(next) as ProfileFieldErrors;
      const field = key as keyof ProfileFieldErrors;
      setFieldErrors(current => ({ ...current, [field]: nextErrors[field] }));
    }
  };

  const pickAvatar = async () => {
    if (avatarBusy) return;
    setAvatarBusy(true);
    setAvatarError('');
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) { setAvatarError('Vui lòng cấp quyền truy cập thư viện ảnh để thay ảnh đại diện.'); return; }
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const mimeType = avatarMimeType(asset.fileName || asset.uri, asset.mimeType || asset.file?.type);
      const validationError = avatarValidationError({ mimeType, fileSize: asset.fileSize ?? asset.file?.size });
      if (validationError) { setAvatarError(validationError); return; }

      setAvatarPreview(asset.uri);
      const data = new FormData();
      if (Platform.OS === 'web' && asset.file) data.append('avatar', asset.file, asset.fileName || asset.file.name);
      else data.append('avatar', { uri: asset.uri, name: asset.fileName || `avatar.${mimeType.split('/')[1] || 'jpg'}`, type: mimeType } as unknown as Blob);
      await accountApi.updateAvatar(data);
      await refreshUser();
      setAvatarPreview('');
      setNotice('Đã cập nhật ảnh đại diện.');
    } catch (failure) {
      setAvatarPreview('');
      setAvatarError(failure instanceof Error ? failure.message : 'Không thể cập nhật ảnh đại diện. Vui lòng thử lại.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const saveProfile = async () => {
    const fullName = form.fullName.trim();
    const phone = form.phone.trim();
    const address = form.address.trim();
    const validationErrors = profileValidationErrors({ ...form, fullName, phone, birthDate: form.birthDate.trim() }) as ProfileFieldErrors;
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length) { setError(''); return; }
    setError(''); setSaving(true);
    try {
      await accountApi.updateProfile({ fullName, phone: phone || null, birthDate: form.birthDate.trim() || null, gender: form.gender, address: address || null });
      if (address !== (defaultAddress?.address || '')) {
        if (defaultAddress && address) await accountApi.updateAddress(defaultAddress.id, { fullName, phone, address, isDefault: true });
        else if (!defaultAddress && address) await accountApi.createAddress({ fullName, phone, address, isDefault: true });
        else if (defaultAddress) await accountApi.removeAddress(defaultAddress.id);
        setAddresses(await accountApi.addresses());
      }
      await refreshUser();
      setEditing(false); setNotice('Đã lưu hồ sơ thành công.');
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Không thể lưu hồ sơ. Vui lòng thử lại.';
      const field = profileBackendField(message) as keyof ProfileFieldErrors | null;
      if (field) setFieldErrors(current => ({ ...current, [field]: message }));
      else setError(message);
    } finally { setSaving(false); }
  };

  const saveCard = async () => {
    if (!/^[0-9]{16,19}$/.test(card.cardNumber)) { setCardError('Số thẻ mô phỏng cần gồm 16–19 chữ số.'); return; }
    if (!card.holder.trim() || !card.expMonth || !card.expYear) { setCardError('Vui lòng điền đủ thông tin thẻ.'); return; }
    if (!/^\d{6}$/.test(card.pin) && !user?.hasTransactionPin) { setCardError('PIN mô phỏng cần gồm 6 chữ số.'); return; }
    if (card.pin && card.pin !== card.confirmPin) { setCardError('PIN xác nhận chưa khớp.'); return; }
    setCardError(''); setCardBusy(true);
    try {
      await accountApi.updateCardProfile({ holder: card.holder.trim(), type: card.type, provider: card.provider.trim(), last4: card.cardNumber.slice(-4), expMonth: Number(card.expMonth), expYear: Number(card.expYear), ...(card.pin ? { pin: card.pin } : {}) });
      await refreshUser();
      setCard(current => ({ ...current, cardNumber: '', pin: '', confirmPin: '' }));
      setNotice('Đã lưu thông tin thẻ mô phỏng.');
    } catch (failure) {
      setCardError(failure instanceof Error ? failure.message : 'Không thể lưu thông tin thẻ.');
    } finally { setCardBusy(false); }
  };

  if (!authReady || !user) return <View style={styles.page}><Header compact={compact} categories={[]} /><View style={styles.loadingPage}><ActivityIndicator color="#1D1D1F" /><Text style={styles.muted}>Đang kiểm tra phiên đăng nhập…</Text></View></View>;

  return <View style={styles.page}>
    <ScrollView ref={instance => { scrollRef.current = instance; }} stickyHeaderIndices={[0]} style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Header compact={compact} categories={[]} />
      <View style={styles.shell}>
        <View style={[styles.intro, compact && styles.introCompact]}>
          <Avatar uri={avatarPreview || user.avatarUrl} size={compact ? 76 : 86} />
          <View style={styles.introCopy}><Text style={styles.introName}>{user.fullName || user.username || 'Khách hàng'}</Text><Text style={styles.introEmail}>{user.email}</Text><View style={styles.memberBadge}><Ionicons name="sparkles-outline" size={13} color="#1D1D1F" /><Text style={styles.memberText}>Khách hàng thân thiết</Text></View></View>
          <Pressable accessibilityRole="button" onPress={() => { scrollTo('profile'); setEditing(true); }} style={styles.outlineButton}><Ionicons name="create-outline" size={16} color="#1D1D1F" /><Text style={styles.outlineText}>Chỉnh sửa</Text></Pressable>
        </View>

        <View style={[styles.body, compact && styles.bodyCompact]}>
          <View style={[styles.menuCard, compact && styles.menuGrid]}><Text style={styles.menuTitle}>Tài khoản của tôi</Text>{menu.map(([key, label, icon]) => <Pressable key={key} accessibilityRole="button" onPress={() => key === 'orders' ? router.push('/orders') : scrollTo(key)} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}><Ionicons name={icon} size={19} color="#1D1D1F" /><Text style={styles.menuLabel}>{label}</Text></Pressable>)}<Pressable accessibilityRole="link" onPress={() => router.push('/change-password')} style={styles.menuItem}><Ionicons name="lock-closed-outline" size={19} color="#1D1D1F" /><Text style={styles.menuLabel}>Đổi mật khẩu</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void logout()} style={styles.menuItem}><Ionicons name="log-out-outline" size={19} color="#1D1D1F" /><Text style={styles.menuLabel}>Đăng xuất</Text></Pressable></View>

          <View style={styles.main}>
            <View onLayout={setPosition('profile')} style={styles.card}><CardHeading title="Hồ sơ cá nhân" subtitle="Cập nhật thông tin cá nhân để trải nghiệm dịch vụ tốt hơn." action={editing ? 'Lưu thay đổi' : 'Chỉnh sửa'} busy={saving} onPress={editing ? () => void saveProfile() : () => setEditing(true)} /><View style={[styles.formGrid, compact && styles.formGridCompact]}>
              <View style={styles.profilePhoto}><Avatar uri={avatarPreview || user.avatarUrl} size={78} /><Pressable accessibilityRole="button" disabled={avatarBusy} onPress={() => void pickAvatar()} style={[styles.avatarButton, avatarBusy && styles.disabled]}>{avatarBusy ? <ActivityIndicator size="small" color="#1D1D1F" /> : <Ionicons name="image-outline" size={14} color="#1D1D1F" />}<Text style={styles.avatarButtonText}>{avatarBusy ? 'Đang tải…' : 'Thay ảnh đại diện'}</Text></Pressable></View>
              <Field label="Họ và tên" value={form.fullName} editable={editing} error={fieldErrors.fullName} onChange={value => changeProfileField('fullName', value)} />
              <Field label="Email" value={form.email} editable={false} error={fieldErrors.email} onChange={() => undefined} />
              <Field label="Số điện thoại" value={form.phone} editable={editing} error={fieldErrors.phone} keyboardType="phone-pad" onChange={value => changeProfileField('phone', value)} />
              <Field label="Ngày sinh" value={form.birthDate} editable={editing} error={fieldErrors.birthDate} placeholder="YYYY-MM-DD" onChange={value => changeProfileField('birthDate', value)} />
              <View style={styles.field}><Text style={styles.label}>Giới tính</Text><View style={styles.genderRow}>{[['male', 'Nam'], ['female', 'Nữ'], ['other', 'Khác']].map(([value, label]) => <Pressable key={value} disabled={!editing} onPress={() => setForm(current => ({ ...current, gender: value as ProfileForm['gender'] }))} style={styles.genderOption}><View style={[styles.radio, form.gender === value && styles.radioSelected]} /><Text style={styles.fieldValue}>{label}</Text></Pressable>)}</View></View>
              <Field label="Địa chỉ mặc định" value={form.address} editable={editing} multiline onChange={value => setForm(current => ({ ...current, address: value }))} />
            </View>{!!avatarError && <InlineError message={avatarError} />}{!!error && <InlineError message={error} />}
            </View>

            <View onLayout={setPosition('payment')} style={styles.card}><CardHeading title="Thông tin thanh toán" subtitle="Thanh toán mô phỏng cho các đơn hàng tiếp theo." action={cardBusy ? 'Đang lưu…' : 'Lưu thông tin'} busy={cardBusy} onPress={() => void saveCard()} /><View style={styles.notice}><Ionicons name="information-circle-outline" size={19} color="#1D1D1F" /><View style={styles.flex}><Text style={styles.noticeTitle}>Đây là thẻ thanh toán mô phỏng</Text><Text style={styles.noticeText}>Chỉ dùng dữ liệu mô phỏng. Hệ thống chỉ lưu 4 số cuối và không lưu số thẻ đầy đủ, CVV hoặc PIN ngân hàng.</Text></View></View><View style={[styles.formGrid, compact && styles.formGridCompact]}><Field label="Tên chủ thẻ" value={card.holder} onChange={value => setCard(current => ({ ...current, holder: value }))} /><Field label="Loại thẻ" value={card.type === 'DOMESTIC' ? 'Thẻ nội địa' : 'Thẻ quốc tế'} onChange={value => setCard(current => ({ ...current, type: value.toLowerCase().includes('quốc') ? 'INTERNATIONAL' : 'DOMESTIC', provider: value.toLowerCase().includes('quốc') ? 'VISA' : 'NAPAS' }))} /><Field label="Ngân hàng / tổ chức thẻ" value={card.provider} onChange={value => setCard(current => ({ ...current, provider: value }))} /><Field label="Số thẻ (mô phỏng)" value={card.cardNumber} keyboardType="number-pad" secureTextEntry onChange={value => setCard(current => ({ ...current, cardNumber: value.replace(/\D/g, '').slice(0, 19) }))} placeholder="16–19 chữ số" /><Field label="Tháng hết hạn" value={card.expMonth} keyboardType="number-pad" onChange={value => setCard(current => ({ ...current, expMonth: value.replace(/\D/g, '').slice(0, 2) }))} placeholder="MM" /><Field label="Năm hết hạn" value={card.expYear} keyboardType="number-pad" onChange={value => setCard(current => ({ ...current, expYear: value.replace(/\D/g, '').slice(0, 4) }))} placeholder="YYYY" /><Field label={user.hasTransactionPin ? 'PIN mô phỏng (để trống nếu giữ PIN cũ)' : 'PIN mô phỏng 6 số'} value={card.pin} keyboardType="number-pad" secureTextEntry onChange={value => setCard(current => ({ ...current, pin: value.replace(/\D/g, '').slice(0, 6) }))} placeholder="••••••" />{!!card.pin && <Field label="Nhập lại PIN" value={card.confirmPin} keyboardType="number-pad" secureTextEntry onChange={value => setCard(current => ({ ...current, confirmPin: value.replace(/\D/g, '').slice(0, 6) }))} placeholder="••••••" />}</View>{user.savedCard && <View style={styles.savedCard}><Ionicons name="checkmark-circle-outline" size={18} color="#537B55" /><Text style={styles.savedText}>Đã lưu {user.savedCard.type === 'DOMESTIC' ? 'thẻ nội địa' : 'thẻ quốc tế'} {user.savedCard.provider} ·•••• {user.savedCard.last4}</Text></View>}{!!cardError && <InlineError message={cardError} />}</View>

            <View style={[styles.stats, compact && styles.statsCompact]}>{[['cube-outline', orders.length, 'Tổng đơn hàng', 'orders'], ['heart-outline', favorites.length, 'Sản phẩm yêu thích', 'favorites'], ['ticket-outline', activeCoupons.length, 'Mã giảm giá', 'coupons'], ['location-outline', addresses.length, 'Địa chỉ giao hàng', 'addresses']].map(([icon, count, label, key]) => <Pressable key={label} onPress={() => scrollTo(String(key))} style={styles.stat}><View style={styles.statIcon}><Ionicons name={icon as never} size={21} color="#1D1D1F" /></View><View><Text style={styles.statCount}>{String(key) === 'favorites' ? favoritesLoading || !!favoritesError ? '—' : count : loading || sectionErrors[String(key)] ? '—' : count}</Text><Text style={styles.statLabel}>{label}</Text></View></Pressable>)}</View>

            {!!dataError && <StateBlock icon="cloud-offline-outline" title="Chưa thể tải dữ liệu" message={dataError} action="Thử lại" onPress={retryProfileData} />}
            <View onLayout={setPosition('favorites')} style={styles.card}><SectionHeading title="Sản phẩm yêu thích" action={favorites.length > 4 ? showAllFavorites ? 'Thu gọn' : 'Xem tất cả' : undefined} onPress={() => setShowAllFavorites(value => !value)} />{favoritesLoading ? <LoadingRow /> : favoritesError ? <StateBlock icon="cloud-offline-outline" title="Không thể tải sản phẩm yêu thích" message={favoritesError} action="Thử lại" onPress={() => void refreshFavorites()} /> : favorites.length ? <View style={styles.productGrid}>{favorites.slice(0, showAllFavorites ? undefined : 4).map(item => item.product ? <ProductCard key={item.id} product={item.product} style={compact ? styles.productMobile : styles.productDesktop} /> : null)}</View> : <StateBlock icon="heart-outline" title="Chưa có sản phẩm yêu thích" message="Hãy thêm sản phẩm bạn yêu thích để dễ dàng tìm lại." />}</View>

            <View onLayout={setPosition('coupons')} style={styles.card}><SectionHeading title="Mã giảm giá của tôi" action={activeCoupons.length > 4 ? showAllCoupons ? 'Thu gọn' : 'Xem tất cả' : undefined} onPress={() => setShowAllCoupons(value => !value)} />{loading ? <LoadingRow /> : sectionErrors.coupons ? <StateBlock icon="cloud-offline-outline" title="Không thể tải mã giảm giá" message="Vui lòng thử lại sau." action="Thử lại" onPress={retryProfileData} /> : activeCoupons.length ? <View style={styles.couponList}>{activeCoupons.slice(0, showAllCoupons ? undefined : 4).map(coupon => <View key={coupon.id} style={styles.coupon}><View style={styles.couponIcon}><Ionicons name="ticket-outline" size={20} color="#1D1D1F" /></View><View style={styles.flex}><Text style={styles.couponCode}>{coupon.code}</Text><Text style={styles.couponText}>{coupon.description || `${coupon.discountType === 'percentage' ? `Giảm ${coupon.discountValue}%` : `Giảm ${formatVnd(Number(coupon.discountValue))}`} · Đơn tối thiểu ${formatVnd(Number(coupon.minOrderAmount))}`}</Text><Text style={styles.couponExpiry}>{coupon.freeShipping ? 'Miễn phí vận chuyển · ' : ''}Hết hạn {new Date(coupon.endDate).toLocaleDateString('vi-VN')}</Text></View><Text style={styles.couponValue}>{coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : formatVnd(Number(coupon.discountValue))}</Text></View>)}</View> : <StateBlock icon="ticket-outline" title="Chưa có mã giảm giá" message="Mã giảm giá khả dụng sẽ xuất hiện tại đây." />}</View>

            <View onLayout={setPosition('addresses')} style={styles.card}><SectionHeading title="Địa chỉ giao hàng" action={addresses.length ? `${addresses.length} địa chỉ` : undefined} />{loading ? <LoadingRow /> : sectionErrors.addresses ? <StateBlock icon="cloud-offline-outline" title="Không thể tải địa chỉ" message="Vui lòng thử lại sau." action="Thử lại" onPress={retryProfileData} /> : addresses.length ? <View style={styles.addressList}>{addresses.map(address => <View key={address.id} style={styles.address}><View style={styles.flex}><Text style={styles.addressName}>{address.fullName} · {address.phone}</Text><Text style={styles.addressText}>{address.address}</Text></View>{address.isDefault && <Text style={styles.defaultBadge}>Mặc định</Text>}</View>)}</View> : form.address ? <View style={styles.address}><View style={styles.flex}><Text style={styles.addressName}>Địa chỉ mặc định</Text><Text style={styles.addressText}>{form.address}</Text></View><Text style={styles.defaultBadge}>Mặc định</Text></View> : <StateBlock icon="location-outline" title="Chưa có địa chỉ giao hàng" message="Thêm địa chỉ trong hồ sơ để thanh toán nhanh hơn." />}</View>

            <View onLayout={setPosition('orders')} style={styles.card}>
              <SectionHeading title="Đơn hàng gần đây" action={orders.length ? 'Xem tất cả' : undefined} onPress={() => router.push('/orders')} />
              {loading ? <LoadingRow /> : sectionErrors.orders ? <StateBlock icon="cloud-offline-outline" title="Không thể tải đơn hàng" message="Vui lòng thử lại sau." action="Thử lại" onPress={retryProfileData} /> : orders.length ? <View style={styles.orderList}>{orders.slice(0, 4).map(order => <Pressable key={order.id} onPress={() => router.push({ pathname: '/orders/[id]', params: { id: String(order.id) } })} style={styles.order}>
                <View style={styles.orderTop}><Text style={styles.orderId}>#{order.id}</Text><Text style={[styles.status, styles[`status${order.status}` as keyof typeof styles]]}>{statusLabels[order.status]}</Text></View>
                <View style={styles.orderMeta}><Text style={styles.muted}>{new Date(order.createdAt).toLocaleDateString('vi-VN')}</Text><Text style={styles.orderTotal}>{formatVnd(order.totalAmount)}</Text></View>
                <View style={styles.orderPreview}><View style={styles.orderThumbs}>{order.items.slice(0, 3).map(item => <OrderProductImage key={item.id} uri={item.productImage} style={styles.orderThumb} />)}{order.items.length > 3 && <View style={styles.orderThumbMore}><Text style={styles.orderThumbMoreText}>+{order.items.length - 3}</Text></View>}</View><View style={styles.orderProductCopy}>{order.items.slice(0, 2).map(item => <Text key={item.id} numberOfLines={1} style={styles.orderProducts}>{item.productName || 'Sản phẩm'} · SL {Number(item.quantity) || 0} · {formatVnd(Number(item.price) || 0)}</Text>)}</View></View>
                <Text style={styles.detailLink}>Xem chi tiết <Ionicons name="arrow-forward" size={14} color="#1D1D1F" /></Text>
              </Pressable>)}</View> : <StateBlock icon="receipt-outline" title="Chưa có đơn hàng nào" message="Đơn hàng của bạn sẽ xuất hiện tại đây." />}
            </View>
          </View>
        </View>
        <ProductFooter />
      </View>
    </ScrollView>
    {!!notice && <View accessibilityLiveRegion="polite" style={styles.toast}><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={styles.toastText}>{notice}</Text></View>}
    <ChatWidget compact={compact} />
  </View>;
}

function Avatar({ uri, size }: { uri?: string | null; size: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  if (uri && !failed) return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}><Image source={{ uri: imageUrl(uri) }} accessibilityLabel="Ảnh đại diện" onError={() => setFailed(true)} style={{ width: '100%', height: '100%' }} /></View>;
  return <View style={[styles.avatar, styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}><Ionicons name="leaf-outline" size={size * .43} color="#1D1D1F" /></View>;
}

function CardHeading({ title, subtitle, action, busy, onPress }: { title: string; subtitle: string; action: string; busy: boolean; onPress: () => void }) {
  return <View style={styles.cardHeading}><View style={styles.flex}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSubtitle}>{subtitle}</Text></View><Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={[styles.outlineButton, busy && styles.disabled]}>{busy ? <ActivityIndicator size="small" color="#1D1D1F" /> : <Ionicons name={action.startsWith('Lưu') ? 'save-outline' : 'create-outline'} size={16} color="#1D1D1F" />}<Text style={styles.outlineText}>{action}</Text></Pressable></View>;
}

function SectionHeading({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text>{action && (onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={styles.textLink}><Text style={styles.textLinkText}>{action}</Text><Ionicons name={action === 'Thu gọn' ? 'chevron-up' : 'arrow-forward'} size={14} color="#1D1D1F" /></Pressable> : <Text style={styles.muted}>{action}</Text>)}</View>;
}

function Field({ label, value, onChange, editable = true, error, placeholder, keyboardType, multiline, secureTextEntry }: { label: string; value: string; onChange: (value: string) => void; editable?: boolean; error?: string; placeholder?: string; keyboardType?: 'default' | 'number-pad' | 'phone-pad'; multiline?: boolean; secureTextEntry?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} accessibilityHint={error} value={value} onChangeText={onChange} editable={editable} placeholder={placeholder} placeholderTextColor="#A1A1A6" keyboardType={keyboardType} multiline={multiline} secureTextEntry={secureTextEntry} style={[styles.input, !editable && styles.inputDisabled, !!error && styles.inputError, multiline && styles.textarea]} />{!!error && <Text accessibilityRole="alert" style={styles.fieldError}>{error}</Text>}</View>;
}

function LoadingRow() { return <View style={styles.loadingRow}><ActivityIndicator color="#1D1D1F" /><Text style={styles.muted}>Đang tải dữ liệu…</Text></View>; }
function InlineError({ message }: { message: string }) { return <View accessibilityRole="alert" style={styles.inlineError}><Ionicons name="alert-circle-outline" size={17} color="#9B382F" /><Text style={styles.errorText}>{message}</Text></View>; }
function StateBlock({ icon, title, message, action, onPress }: { icon: 'cloud-offline-outline' | 'heart-outline' | 'ticket-outline' | 'location-outline' | 'receipt-outline'; title: string; message: string; action?: string; onPress?: () => void }) { return <View style={styles.state}><Ionicons name={icon} size={28} color="#1D1D1F" /><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{message}</Text>{action && onPress && <Pressable onPress={onPress} style={styles.primaryButton}><Text style={styles.primaryText}>{action}</Text></Pressable>}</View>; }

const styles = StyleSheet.create(withTypography({
  page: { flex: 1, backgroundColor: '#F5F5F7' }, scroll: { flex: 1 }, content: { flexGrow: 1 }, loadingPage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }, shell: { width: '100%', maxWidth: 1320, alignSelf: 'center', padding: 18 },
  intro: { padding: 20, minHeight: 130, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D2D2D7', flexDirection: 'row', alignItems: 'center', gap: 16 }, introCompact: { flexWrap: 'wrap', padding: 16 }, introCopy: { flex: 1, minWidth: 180 }, introName: { color: '#1D1D1F', fontSize: 20, fontWeight: '900' }, introEmail: { color: '#6E6E73', fontSize: 12, marginTop: 3 }, memberBadge: { alignSelf: 'flex-start', marginTop: 9, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#E8E8ED', flexDirection: 'row', alignItems: 'center', gap: 5 }, memberText: { color: '#1D1D1F', fontSize: 12, fontWeight: '800' }, avatar: { overflow: 'hidden', backgroundColor: '#E8E8ED' }, avatarFallback: { alignItems: 'center', justifyContent: 'center' }, outlineButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#A1A1A6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, outlineText: { color: '#1D1D1F', fontSize: 11, fontWeight: '900' }, body: { marginTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 14 }, bodyCompact: { flexDirection: 'column' }, menuCard: { width: 208, padding: 12, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D2D2D7' }, menuGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 5, padding: 10 }, menuTitle: { color: '#1D1D1F', fontSize: 14, fontWeight: '900', paddingHorizontal: 8, paddingBottom: 8, width: '100%' }, menuItem: { minHeight: 42, paddingHorizontal: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 9 }, menuGridItem: {}, menuLabel: { color: '#1D1D1F', fontSize: 11, fontWeight: '700', flexShrink: 1 }, main: { flex: 1, gap: 12 }, card: { padding: 14, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D2D2D7' }, cardHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 }, flex: { flex: 1 }, sectionTitle: { color: '#1D1D1F', fontSize: 18, fontWeight: '900' }, sectionSubtitle: { color: '#6E6E73', fontSize: 11, lineHeight: 17, marginTop: 3 }, formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 }, formGridCompact: { flexDirection: 'column' }, profilePhoto: { width: 125, alignItems: 'center', gap: 7 }, photoCaption: { color: '#6E6E73', fontSize: 12, textAlign: 'center' }, avatarButton: { minHeight: 32, paddingHorizontal: 9, borderRadius: 8, borderWidth: 1, borderColor: '#A1A1A6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, avatarButtonText: { color: '#1D1D1F', fontSize: 12, fontWeight: '800' }, field: { flex: 1, minWidth: 205, gap: 6 }, label: { color: '#1D1D1F', fontSize: 11, fontWeight: '800' }, input: { minHeight: 42, borderRadius: 9, borderWidth: 1, borderColor: '#D2D2D7', backgroundColor: '#fff', paddingHorizontal: 11, color: '#1D1D1F', fontSize: 12 }, inputDisabled: { backgroundColor: '#E8E8ED', color: '#6E6E73' }, inputError: { borderColor: '#C45B4E' }, fieldError: { color: '#9B382F', fontSize: 12, lineHeight: 15 }, textarea: { minHeight: 70, textAlignVertical: 'top', paddingTop: 10 }, fieldValue: { color: '#1D1D1F', fontSize: 12 }, genderRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 15 }, genderOption: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8 }, radio: { width: 15, height: 15, borderRadius: 8, borderWidth: 1, borderColor: '#A1A1A6' }, radioSelected: { borderWidth: 4, borderColor: '#1D1D1F' }, inlineError: { marginTop: 12, padding: 10, borderRadius: 8, backgroundColor: '#FBE8E5', flexDirection: 'row', alignItems: 'center', gap: 7 }, errorText: { flex: 1, color: '#9B382F', fontSize: 11, lineHeight: 17 }, notice: { padding: 11, borderRadius: 9, backgroundColor: '#E8E8ED', borderWidth: 1, borderColor: '#D2D2D7', flexDirection: 'row', gap: 8, marginBottom: 13 }, noticeTitle: { color: '#6E6E73', fontSize: 11, fontWeight: '900' }, noticeText: { color: '#1D1D1F', fontSize: 12, lineHeight: 15, marginTop: 2 }, savedCard: { marginTop: 11, flexDirection: 'row', alignItems: 'center', gap: 7 }, savedText: { color: '#537B55', fontSize: 11, fontWeight: '700' }, stats: { flexDirection: 'row', gap: 10 }, statsCompact: { flexWrap: 'wrap' }, stat: { flex: 1, minWidth: 135, padding: 12, borderRadius: 11, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D2D2D7', flexDirection: 'row', alignItems: 'center', gap: 9 }, statIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E8E8ED', alignItems: 'center', justifyContent: 'center' }, statCount: { color: '#1D1D1F', fontSize: 17, fontWeight: '900' }, statLabel: { color: '#6E6E73', fontSize: 12, marginTop: 2 }, sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, textLink: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 5 }, textLinkText: { color: '#1D1D1F', fontSize: 11, fontWeight: '800' }, productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, productDesktop: { width: '31.8%' }, productMobile: { width: '100%' }, couponList: { gap: 8 }, coupon: { padding: 11, borderRadius: 9, borderWidth: 1, borderColor: '#D2D2D7', flexDirection: 'row', alignItems: 'center', gap: 10 }, couponIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E8E8ED', alignItems: 'center', justifyContent: 'center' }, couponCode: { color: '#1D1D1F', fontSize: 12, fontWeight: '900' }, couponText: { color: '#6E6E73', fontSize: 11, marginTop: 3 }, couponExpiry: { color: '#6E6E73', fontSize: 12, marginTop: 3 }, couponValue: { color: '#1D1D1F', fontSize: 13, fontWeight: '900' }, addressList: { gap: 8 }, address: { padding: 12, borderRadius: 9, borderWidth: 1, borderColor: '#D2D2D7', flexDirection: 'row', gap: 10 }, addressName: { color: '#1D1D1F', fontSize: 12, fontWeight: '800' }, addressText: { color: '#6E6E73', fontSize: 11, lineHeight: 17, marginTop: 4 }, defaultBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: '#EAF2E8', color: '#537B55', fontSize: 12, fontWeight: '800' }, orderList: { gap: 8 }, order: { padding: 12, borderRadius: 9, borderWidth: 1, borderColor: '#D2D2D7' }, orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, orderId: { color: '#1D1D1F', fontSize: 12, fontWeight: '900' }, status: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, fontSize: 12, fontWeight: '800' }, statusPENDING: { backgroundColor: '#E8E8ED', color: '#6E6E73' }, statusCONFIRMED: { backgroundColor: '#E5EEF6', color: '#37627C' }, statusDELIVERED: { backgroundColor: '#EAF2E8', color: '#537B55' }, statusCANCELLED: { backgroundColor: '#FBE8E5', color: '#9B382F' }, orderMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 }, muted: { color: '#6E6E73', fontSize: 11 }, orderTotal: { color: '#1D1D1F', fontSize: 12, fontWeight: '900' }, orderPreview: { marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 10 }, orderThumbs: { flexDirection: 'row' }, orderThumb: { width: 42, height: 42, marginRight: -6, borderRadius: 8 }, orderThumbMore: { width: 42, height: 42, marginRight: -6, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D2D2D7', borderWidth: 1, borderColor: '#A1A1A6' }, orderThumbMoreText: { color: '#1D1D1F', fontSize: 12, fontWeight: '900' }, orderProductCopy: { flex: 1, minWidth: 0 }, orderProducts: { color: '#6E6E73', fontSize: 12, lineHeight: 16 }, detailLink: { alignSelf: 'flex-end', color: '#1D1D1F', fontSize: 11, fontWeight: '800', marginTop: 8 }, state: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 18 }, stateTitle: { color: '#1D1D1F', fontSize: 13, fontWeight: '900' }, stateText: { color: '#6E6E73', fontSize: 11, textAlign: 'center', lineHeight: 17 }, primaryButton: { marginTop: 7, minHeight: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#1D1D1F', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontSize: 11, fontWeight: '900' }, loadingRow: { minHeight: 100, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }, toast: { position: 'absolute', top: 90, alignSelf: 'center', maxWidth: '90%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1D1D1F', flexDirection: 'row', alignItems: 'center', gap: 7, zIndex: 120 }, toastText: { color: '#fff', fontSize: 11, fontWeight: '700' }, disabled: { opacity: .55 }, pressed: { opacity: .72 },
}));
