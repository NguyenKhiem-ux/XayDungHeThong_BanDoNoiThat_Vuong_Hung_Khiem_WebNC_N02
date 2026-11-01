function searchable(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').trim();
}

function validLocalDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value));
  if (!match) return false;
  const [, year, month, day, hour, minute] = match.map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= days && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function promotionIsoTime(value) {
  return new Date(`${value}:00+07:00`).toISOString();
}

export function promotionLocalTime(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time + 7 * 3600_000).toISOString().slice(0, 16) : '';
}

export function promotionValidationErrors(form, items, status, now = Date.now()) {
  const errors = {};
  const title = String(form.title || '').trim();
  if (!title) errors.title = 'Vui lòng nhập tên sự kiện.';
  else if (title.length > 120) errors.title = 'Tên sự kiện không được vượt quá 120 ký tự.';
  if (String(form.description || '').length > 300) errors.description = 'Mô tả không được vượt quá 300 ký tự.';

  const bannerText = String(form.bannerDiscountPercent ?? '').trim();
  const banner = Number(bannerText);
  if (bannerText && (!Number.isInteger(banner) || banner < 1 || banner > 99)) errors.bannerDiscountPercent = 'Mức giảm banner phải là số nguyên từ 1 đến 99.';

  if (!validLocalDateTime(form.startsAt)) errors.startsAt = 'Thời gian bắt đầu phải có dạng YYYY-MM-DDTHH:mm.';
  if (!validLocalDateTime(form.endsAt)) errors.endsAt = 'Thời gian kết thúc phải có dạng YYYY-MM-DDTHH:mm.';
  let startsAt = NaN, endsAt = NaN;
  if (!errors.startsAt) startsAt = Date.parse(promotionIsoTime(form.startsAt));
  if (!errors.endsAt) endsAt = Date.parse(promotionIsoTime(form.endsAt));
  if (!errors.startsAt && !errors.endsAt && startsAt >= endsAt) errors.endsAt = 'Thời gian kết thúc phải sau thời gian bắt đầu.';

  if (items.length > 200) errors.items = 'Mỗi sự kiện chỉ được chọn tối đa 200 sản phẩm.';
  if (new Set(items.map(item => item.productId)).size !== items.length) errors.items = 'Danh sách sản phẩm không được trùng lặp.';
  if (items.some(item => !Number.isSafeInteger(item.productId) || item.productId < 1 || !Number.isInteger(item.discountPercent) || item.discountPercent < 1 || item.discountPercent > 99)) errors.items = 'Mỗi sản phẩm phải có mức giảm nguyên từ 1 đến 99%.';
  if (status === 'published' && !items.length) errors.items = 'Sự kiện công bố phải có ít nhất một sản phẩm.';
  if (status === 'published' && Number.isFinite(endsAt) && endsAt <= now) errors.endsAt = 'Sự kiện công bố phải kết thúc trong tương lai.';
  const maxDiscount = items.reduce((max, item) => Math.max(max, item.discountPercent), 0);
  if (status === 'published' && bannerText && banner > maxDiscount) errors.bannerDiscountPercent = 'Mức giảm banner không được vượt mức giảm lớn nhất của sản phẩm.';
  return errors;
}

export function promotionPayload(form, items, status) {
  return { title: String(form.title).trim(), description: String(form.description || '').trim(), bannerDiscountPercent: String(form.bannerDiscountPercent || '').trim() ? Number(form.bannerDiscountPercent) : null, status, startsAt: promotionIsoTime(form.startsAt), endsAt: promotionIsoTime(form.endsAt), items };
}

export function filterAdminPromotions(events, { keyword = '', phase = '' } = {}) {
  const term = searchable(keyword);
  return events.filter(event => (!term || searchable(`${event.title} ${event.description}`).includes(term)) && (!phase || event.phase === phase));
}

export function adminPromotionPageCount(total, limit) {
  return Math.max(1, Math.ceil(Math.max(0, Number(total) || 0) / Math.max(1, Number(limit) || 1)));
}
