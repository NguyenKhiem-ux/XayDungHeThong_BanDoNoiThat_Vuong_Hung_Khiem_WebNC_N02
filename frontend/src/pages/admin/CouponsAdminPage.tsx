import { FormEvent, useEffect, useState } from 'react';
import { couponApi, orderApi } from '../../api/services';
import { formatVnd } from '../../api/client';
import type { Coupon, User } from '../../api/types';

const date = (value: Date) => value.toISOString().slice(0, 10);
const empty = () => ({ code: '', description: '', discountType: 'percentage' as const, discountValue: '10', minOrderAmount: '0', maxDiscountAmount: '', usageLimit: '1', startDate: date(new Date()), endDate: date(new Date(Date.now() + 30 * 86400000)), isActive: true, freeShipping: false, userId: '' });
type CouponForm = Omit<ReturnType<typeof empty>, 'discountType'> & { discountType: 'percentage' | 'fixed' };

export function CouponsAdminPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState<CouponForm>(empty());
  const [busy, setBusy] = useState(false);
  const load = async () => { const [c, u] = await Promise.all([couponApi.adminList(), orderApi.users()]); setCoupons(c.data); setUsers(u.data); };
  useEffect(() => { void load().catch(() => {}); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      await couponApi.create({ ...form, discountValue: Number(form.discountValue), minOrderAmount: Number(form.minOrderAmount), maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null, usageLimit: form.usageLimit ? Number(form.usageLimit) : null, userId: form.userId ? Number(form.userId) : null, startDate: new Date(`${form.startDate}T00:00:00`).toISOString(), endDate: new Date(`${form.endDate}T23:59:59`).toISOString() });
      setForm(empty()); await load();
    } finally { setBusy(false); }
  };
  const remove = async (coupon: Coupon) => { await couponApi.remove(coupon.id); await load(); };
  const field = (label: string, key: keyof typeof form, type = 'text') => <label className="admin-field">{label}<input className="admin-input" type={type} value={form[key] as string} onChange={event => setForm(current => ({ ...current, [key]: type === 'checkbox' ? event.target.checked : event.target.value }))} /></label>;
  return <div className="admin-page-shell">
    <div className="admin-page-header"><div><div className="eyebrow">PROMOTIONS</div><h1>Thẻ giảm giá</h1><p>Tạo mã khuyến mãi và gán cho tài khoản cụ thể.</p></div></div>
    <form className="admin-panel" onSubmit={submit}><h2>Tạo thẻ giảm giá</h2><div className="admin-form-grid">
      {field('Mã thẻ', 'code')} {field('Giá trị giảm', 'discountValue', 'number')} {field('Đơn tối thiểu', 'minOrderAmount', 'number')} {field('Giảm tối đa (đ)', 'maxDiscountAmount', 'number')} {field('Số lượt dùng', 'usageLimit', 'number')} {field('Bắt đầu', 'startDate', 'date')} {field('Hết hạn', 'endDate', 'date')}
      <label className="admin-field">Loại giảm<select className="admin-input" value={form.discountType} onChange={event => setForm(current => ({ ...current, discountType: event.target.value as 'percentage' | 'fixed' }))}><option value="percentage">Phần trăm</option><option value="fixed">Số tiền</option></select></label>
      <label className="admin-field">Tài khoản<select className="admin-input" value={form.userId} onChange={event => setForm(current => ({ ...current, userId: event.target.value }))}><option value="">Mã dùng chung</option>{users.filter(user => user.role === 'USER').map(user => <option key={user.id} value={user.id}>{user.fullName} · {user.email}</option>)}</select></label>
      <label className="admin-field full">Mô tả<input className="admin-input" value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></label>
      <label className="admin-field admin-checkbox"><input type="checkbox" checked={form.freeShipping} onChange={event => setForm(current => ({ ...current, freeShipping: event.target.checked }))} /> Miễn phí vận chuyển</label>
      <div className="full admin-actions"><button className="admin-mini-btn" disabled={busy}>Tạo thẻ</button></div>
    </div></form>
    <div className="admin-panel" style={{ marginTop: '1rem' }}><h2>Danh sách thẻ ({coupons.length})</h2><table className="admin-table"><thead><tr><th>Mã</th><th>Ưu đãi</th><th>Người nhận</th><th>Hạn dùng</th><th>Trạng thái</th><th></th></tr></thead><tbody>{coupons.map(coupon => <tr key={coupon.id}><td><b>{coupon.code}</b></td><td>{coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : formatVnd(Number(coupon.discountValue))}{coupon.freeShipping ? ' + Free ship' : ''}</td><td>{users.find(user => user.id === coupon.userId)?.email || (coupon.userId ? `User #${coupon.userId}` : 'Dùng chung')}</td><td>{new Date(coupon.endDate).toLocaleDateString('vi-VN')}</td><td>{coupon.isActive ? 'Đang bật' : 'Đã tắt'} · {coupon.usedCount}/{coupon.usageLimit ?? '∞'}</td><td><button className="admin-mini-btn danger" onClick={() => void remove(coupon)}>Xóa</button></td></tr>)}</tbody></table></div>
  </div>;
}
