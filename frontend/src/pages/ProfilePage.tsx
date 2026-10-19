import { FormEvent, useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { Link } from 'react-router-dom';
import { ChevronDown, Save } from 'lucide-react';
import { formatVnd, imageUrl } from '../api/client';
import { addressApi, authApi, couponApi, favoriteApi, orderApi } from '../api/services';
import type { Coupon, Favorite, Gender, Order, UserAddress } from '../api/types';
import { ProductCard } from '../components/ProductCard';
import { useAuth } from '../context/AuthContext';

type ProfileForm = {
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  gender: Gender;
  address: string;
};
type CouponCard = Pick<Coupon, 'code' | 'description' | 'discountType' | 'discountValue' | 'minOrderAmount'> & {
  id: number | string;
  endDate?: string;
  demo?: boolean;
};

const statusLabels: Record<Order['status'], string> = {
  PENDING: 'Chờ xử lý',
  CONFIRMED: 'Đã xác nhận',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
};

const emptyForm: ProfileForm = {
  fullName: '',
  email: '',
  phone: '',
  birthDate: '',
  gender: 'male',
  address: '',
};

const demoCoupons: CouponCard[] = [
  { id: 'demo-1', code: 'GIADUNG10', description: 'Giảm cho đơn từ 500.000đ', discountType: 'percentage', discountValue: 10, minOrderAmount: 500000, demo: true },
  { id: 'demo-2', code: 'FREESHIP', description: 'Miễn phí giao hàng nội thành', discountType: 'fixed', discountValue: 30000, minOrderAmount: 300000, demo: true },
];

function couponValue(coupon: CouponCard) {
  const value = Number(coupon.discountValue);
  return coupon.discountType === 'percentage' ? `${value}%` : formatVnd(value);
}

function toast(message: string) {
  window.dispatchEvent(new CustomEvent('toast', { detail: message }));
}

function apiError(error: unknown, fallback: string) {
  if (!isAxiosError(error)) return fallback;
  const message = error.response?.data?.message;
  return Array.isArray(message) ? message.join(', ') : typeof message === 'string' ? message : fallback;
}

export function ProfilePage() {
  const { user, logout, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState<ProfileForm>(emptyForm);

  const defaultAddress = useMemo(() => addresses.find(a => a.isDefault) || addresses[0], [addresses]);
  const activeCoupons = useMemo(() => coupons
    .filter(c => c.isActive && new Date(c.endDate).getTime() >= Date.now())
    .slice(0, 3), [coupons]);
  const couponCards: CouponCard[] = activeCoupons.length ? activeCoupons : demoCoupons;

  useEffect(() => {
    if (!user || editing) return;
    setForm({
      fullName: user.fullName || user.username || '',
      email: user.email,
      phone: user.phone || '',
      birthDate: user.birthDate || '',
      gender: user.gender || 'male',
      address: defaultAddress?.address || '',
    });
  }, [user, defaultAddress?.address, editing]);

  useEffect(() => {
    let live = true;
    orderApi.list().then(r => live && setOrders(r.data)).catch(() => live && setOrders([]));
    favoriteApi.list().then(r => live && setFavorites(r.data)).catch(() => live && setFavorites([]));
    addressApi.list().then(r => live && setAddresses(r.data)).catch(() => live && setAddresses([]));
    couponApi.list().then(r => live && setCoupons(r.data)).catch(() => live && setCoupons([]));
    return () => { live = false; };
  }, []);

  if (!user) return null;

  const recentOrders = orders.slice(0, 4);
  const displayName = form.fullName || user.fullName || user.username || 'Khách hàng';
  const orderItems = orders.reduce((total, order) => total + order.items.reduce((sum, item) => sum + item.quantity, 0), 0);

  const update = (key: keyof ProfileForm, value: string) => {
    setEditing(true);
    setForm(current => ({ ...current, [key]: value }));
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const fullName = form.fullName.trim();
    const phone = form.phone.trim();
    const address = form.address.trim();
    if (!fullName) return toast('Họ và tên không được để trống');
    if (address !== (defaultAddress?.address || '') && (!address || !phone)) {
      return toast(!address ? 'Địa chỉ không được để trống' : 'Cần số điện thoại để lưu địa chỉ');
    }

    setSaving(true);
    try {
      await authApi.updateProfile({
        fullName,
        phone: phone || null,
        birthDate: form.birthDate || null,
        gender: form.gender,
      });
      await refresh();
    } catch (error) {
      toast(apiError(error, 'Không thể lưu hồ sơ. Vui lòng thử lại.'));
      setSaving(false);
      return;
    }

    try {
      if (address !== (defaultAddress?.address || '')) {
        const response = defaultAddress
          ? await addressApi.update(defaultAddress.id, { address, isDefault: true })
          : await addressApi.create({ fullName, phone, address, isDefault: true });
        setAddresses(current => defaultAddress
          ? current.map(item => item.id === response.data.id ? response.data : { ...item, isDefault: false })
          : [response.data, ...current]);
      }
      setEditing(false);
      toast('Đã lưu hồ sơ thành công');
    } catch (error) {
      toast(`Hồ sơ đã lưu nhưng địa chỉ chưa được cập nhật: ${apiError(error, 'Vui lòng thử lại.')}`);
    } finally {
      setSaving(false);
    }
  };

  return <section className="profile-shell">
    <aside className="profile-sidebar">
      <div className="profile-avatar-card">
        <img src="https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=320&q=80" alt="" />
        <strong>{displayName}</strong>
        <span>{user.email}</span>
      </div>
      <button type="button" className="profile-menu-toggle" aria-expanded={menuOpen} aria-controls="profile-navigation" onClick={() => setMenuOpen(value => !value)}>
        Menu tài khoản <ChevronDown size={18} aria-hidden="true" />
      </button>
      <nav id="profile-navigation" aria-label="Tài khoản cá nhân" className={`profile-menu ${menuOpen ? 'is-open' : ''}`}>
        <a href="#profile-info" className="active"><i className="fa-solid fa-id-card" /> Hồ sơ cá nhân</a>
        <Link to="/orders"><i className="fa-solid fa-receipt" /> Đơn hàng của tôi</Link>
        <a href="#profile-addresses"><i className="fa-solid fa-location-dot" /> Địa chỉ giao hàng</a>
        <a href="#profile-coupons"><i className="fa-solid fa-ticket" /> Mã giảm giá</a>
        <a href="#profile-favorites"><i className="fa-solid fa-heart" /> Sản phẩm yêu thích</a>
        <Link to="/change-password"><i className="fa-solid fa-lock" /> Đổi mật khẩu</Link>
        <button type="button" onClick={logout}><i className="fa-solid fa-right-from-bracket" /> Đăng xuất</button>
      </nav>
    </aside>

    <div className="profile-main">
      <form className="profile-panel profile-info-panel" id="profile-info" onSubmit={save}>
        <div className="profile-panel-head">
          <div>
            <h1>Hồ sơ cá nhân</h1>
            <p>Quản lý thông tin tài khoản và cập nhật địa chỉ nhận hàng.</p>
          </div>
          {!editing ? (
            <button type="button" className="profile-mini-btn" onClick={() => setEditing(true)}>
              <i className="fa-solid fa-pen" /> Chỉnh sửa
            </button>
          ) : (
            <button type="submit" className="profile-mini-btn primary" disabled={saving}>
              <i className="fa-solid fa-floppy-disk" /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          )}
        </div>

        <div className="profile-form-grid">
          <div className="profile-photo">
            <img src="https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=360&q=80" alt="" />
            <span>Ảnh đại diện</span>
          </div>
          <label>Họ và tên
            <input autoComplete="name" value={form.fullName} onChange={e => update('fullName', e.target.value)} disabled={saving} />
          </label>
          <label>Email (không thể thay đổi)
            <input value={form.email} readOnly />
          </label>
          <label>Số điện thoại
            <input type="tel" autoComplete="tel" value={form.phone} onChange={e => update('phone', e.target.value)} disabled={saving} />
          </label>
          <label>Ngày sinh
            <input type="date" value={form.birthDate} onChange={e => update('birthDate', e.target.value)} disabled={saving} />
          </label>
          <fieldset className="profile-gender">
            <legend>Giới tính</legend>
            {[
              ['male', 'Nam'],
              ['female', 'Nữ'],
              ['other', 'Khác'],
            ].map(([value, label]) => <label key={value}>
              <input type="radio" name="gender" value={value} checked={form.gender === value} disabled={saving} onChange={e => update('gender', e.target.value)} />
              {label}
            </label>)}
          </fieldset>
          <label>Địa chỉ mặc định
            <textarea rows={2} autoComplete="street-address" value={form.address} onChange={e => update('address', e.target.value)} disabled={saving} />
          </label>
        </div>
        {editing && <button type="submit" className="profile-mobile-save profile-mini-btn primary" disabled={saving}><Save size={18} aria-hidden="true" /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>}
      </form>

      <div className="profile-stats">
        <div><i className="fa-solid fa-box-open" /><strong>{orders.length}</strong><span>Đơn hàng</span></div>
        <div><i className="fa-solid fa-heart" /><strong>{favorites.length}</strong><span>Yêu thích</span></div>
        <div><i className="fa-solid fa-ticket" /><strong>{couponCards.length}</strong><span>Mã giảm giá</span></div>
        <div><i className="fa-solid fa-location-dot" /><strong>{addresses.length}</strong><span>Địa chỉ</span></div>
      </div>

      <div className="profile-content-grid">
        <section className="profile-panel profile-products" id="profile-favorites">
          <div className="profile-section-head">
            <h2>Sản phẩm yêu thích</h2>
            <Link to="/products">Xem tất cả <i className="fa-solid fa-angle-right" /></Link>
          </div>
          {favorites.length ? (
            <div className="product-grid profile-favorites-grid">
              {favorites.slice(0, 4).map((favorite, index) => <ProductCard key={favorite.id} product={favorite.product} home index={index} />)}
            </div>
          ) : (
            <div className="profile-empty"><i className="fa-solid fa-heart" /> Chưa có sản phẩm yêu thích.</div>
          )}
        </section>

        <section className="profile-panel profile-coupons" id="profile-coupons">
          <div className="profile-section-head">
            <h2>Mã giảm giá của tôi</h2>
            <Link to="/products">Dùng ngay <i className="fa-solid fa-angle-right" /></Link>
          </div>
          <div className="profile-coupon-list">
            {couponCards.map(coupon => <article className={`profile-coupon ${coupon.demo ? 'demo' : ''}`} key={coupon.id}>
              <div className="coupon-icon"><i className="fa-solid fa-ticket" /></div>
              <div>
                <strong>{coupon.code}</strong>
                <span>{coupon.description || `Giảm ${couponValue(coupon)} cho đơn từ ${formatVnd(Number(coupon.minOrderAmount))}`}</span>
                {coupon.endDate && <small>Hết hạn {new Date(coupon.endDate).toLocaleDateString('vi-VN')}</small>}
              </div>
              <b>{couponValue(coupon)}</b>
            </article>)}
          </div>
        </section>
      </div>

      <section className="profile-panel" id="profile-addresses">
        <div className="profile-section-head">
          <h2>Địa chỉ giao hàng</h2>
          <span>{addresses.length} địa chỉ</span>
        </div>
        {addresses.length ? <div className="profile-address-list">
          {addresses.map(address => <article className="profile-address" key={address.id}>
            <div>
              <strong>{address.fullName}</strong>
              <span>{address.phone}</span>
              <p>{address.address}</p>
            </div>
            {address.isDefault && <em>Mặc định</em>}
          </article>)}
        </div> : <div className="profile-empty"><i className="fa-solid fa-location-dot" /> Chưa có địa chỉ giao hàng.</div>}
      </section>

      <section className="profile-panel profile-orders">
        <div className="profile-section-head">
          <h2>Đơn hàng gần đây</h2>
          <Link to="/orders">Xem tất cả <i className="fa-solid fa-angle-right" /></Link>
        </div>
        {recentOrders.length ? <div className="profile-table-wrap">
          <table role="table" aria-label="Đơn hàng gần đây">
            <thead role="rowgroup"><tr role="row"><th scope="col">Mã đơn</th><th scope="col">Ngày đặt</th><th scope="col">Sản phẩm</th><th scope="col">Tổng tiền</th><th scope="col">Trạng thái</th><th scope="col">Chi tiết</th></tr></thead>
            <tbody role="rowgroup">{recentOrders.map(order => <tr key={order.id} role="row">
              <td role="cell" data-label="Mã đơn">#{order.id}</td>
              <td role="cell" data-label="Ngày đặt">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</td>
              <td role="cell" data-label="Sản phẩm"><div className="profile-order-products">
                {order.items.slice(0, 3).map(item => item.productImage
                  ? <img key={item.id} src={imageUrl(item.productImage)} alt={item.productName} />
                  : <span key={item.id}><i className="fa-solid fa-box" /></span>)}
                <small>{order.items.length} sản phẩm</small>
              </div></td>
              <td role="cell" data-label="Tổng tiền">{formatVnd(order.totalAmount)}</td>
              <td role="cell" data-label="Trạng thái"><span className={`status-badge status-${order.status.toLowerCase()}`}>{statusLabels[order.status]}</span></td>
              <td role="cell"><Link to={`/orders/${order.id}`} aria-label={`Xem đơn hàng #${order.id}`}>Xem <i className="fa-solid fa-angle-right" /></Link></td>
            </tr>)}</tbody>
          </table>
        </div> : <div className="profile-empty"><i className="fa-solid fa-receipt" /> Chưa có đơn hàng nào.</div>}
        {!!orderItems && <p className="profile-order-foot">Bạn đã đặt {orderItems} sản phẩm trong {orders.length} đơn hàng.</p>}
      </section>
    </div>
  </section>;
}
