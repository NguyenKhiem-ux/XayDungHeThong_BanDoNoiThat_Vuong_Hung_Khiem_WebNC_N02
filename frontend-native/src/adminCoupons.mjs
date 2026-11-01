function searchable(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').trim();
}

function validDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function couponValidationErrors(form) {
  const errors = {};
  const code = String(form.code || '').trim();
  if (!code) errors.code = 'Vui lòng nhập mã giảm giá.';
  else if (code.length > 50) errors.code = 'Mã giảm giá không được vượt quá 50 ký tự.';

  const discountText = String(form.discountValue ?? '').trim();
  const discount = Number(discountText);
  if (!discountText || !Number.isFinite(discount) || discount <= 0) errors.discountValue = 'Giá trị giảm phải lớn hơn 0.';
  else if (form.discountType === 'percentage' && discount > 100) errors.discountValue = 'Mức giảm phần trăm không được vượt quá 100%.';

  const minimumText = String(form.minOrderAmount ?? '').trim();
  const minimum = Number(minimumText);
  if (!minimumText || !Number.isFinite(minimum) || minimum < 0) errors.minOrderAmount = 'Đơn tối thiểu phải là số từ 0 trở lên.';

  const maximumText = String(form.maxDiscountAmount ?? '').trim();
  const maximum = Number(maximumText);
  if (maximumText && (!Number.isFinite(maximum) || maximum <= 0)) errors.maxDiscountAmount = 'Giảm tối đa phải lớn hơn 0 hoặc để trống.';

  const usageText = String(form.usageLimit ?? '').trim();
  const usage = Number(usageText);
  if (usageText && (!Number.isSafeInteger(usage) || usage < 1)) errors.usageLimit = 'Số lượt dùng phải là số nguyên từ 1 trở lên hoặc để trống.';

  if (!validDateInput(String(form.startDate || ''))) errors.startDate = 'Ngày bắt đầu phải có dạng YYYY-MM-DD.';
  if (!validDateInput(String(form.endDate || ''))) errors.endDate = 'Ngày hết hạn phải có dạng YYYY-MM-DD.';
  if (!errors.startDate && !errors.endDate && form.endDate < form.startDate) errors.endDate = 'Ngày hết hạn không được trước ngày bắt đầu.';

  const userText = String(form.userId ?? '').trim();
  const userId = Number(userText);
  if (userText && (!Number.isSafeInteger(userId) || userId < 1)) errors.userId = 'Tài khoản nhận coupon không hợp lệ.';
  return errors;
}

export function couponPayload(form) {
  return {
    code: String(form.code).trim().toUpperCase(),
    description: String(form.description || '').trim() || null,
    discountType: form.discountType,
    discountValue: Number(form.discountValue),
    minOrderAmount: Number(form.minOrderAmount),
    maxDiscountAmount: String(form.maxDiscountAmount || '').trim() ? Number(form.maxDiscountAmount) : null,
    usageLimit: String(form.usageLimit || '').trim() ? Number(form.usageLimit) : null,
    startDate: new Date(`${form.startDate}T00:00:00`).toISOString(),
    endDate: new Date(`${form.endDate}T23:59:59`).toISOString(),
    isActive: Boolean(form.isActive),
    userId: String(form.userId || '').trim() ? Number(form.userId) : null,
    freeShipping: Boolean(form.freeShipping),
  };
}

export function couponDateInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function filterAdminCoupons(coupons, { keyword = '', discountType = '', active = '' } = {}) {
  const term = searchable(keyword);
  return coupons.filter((coupon) => {
    const haystack = searchable(`${coupon.code} ${coupon.description || ''}`);
    return (!term || haystack.includes(term)) && (!discountType || coupon.discountType === discountType) && (!active || coupon.isActive === (active === 'active'));
  });
}

export function adminCouponPageCount(total, limit) {
  return Math.max(1, Math.ceil(Math.max(0, Number(total) || 0) / Math.max(1, Number(limit) || 1)));
}
