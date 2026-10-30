export const ADMIN_PRODUCT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const imageMimeByExtension = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export function adminProductImageMime(fileName = '', suppliedMime = '') {
  const normalized = suppliedMime.toLowerCase() === 'image/jpg' ? 'image/jpeg' : suppliedMime.toLowerCase();
  if (Object.values(imageMimeByExtension).includes(normalized)) return normalized;
  const extension = fileName.split(/[?#]/)[0].split('.').pop()?.toLowerCase() || '';
  return imageMimeByExtension[extension] || normalized;
}

export function adminProductImageError({ mimeType, fileSize }) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return 'Ảnh phải có định dạng JPG, PNG hoặc WEBP.';
  if (Number.isFinite(fileSize) && fileSize > ADMIN_PRODUCT_IMAGE_MAX_BYTES) return 'Ảnh không được vượt quá 10 MB.';
  return '';
}

export function adminProductValidationErrors(values) {
  const errors = {};
  if (!String(values.name || '').trim()) errors.name = 'Vui lòng nhập tên sản phẩm.';

  const priceText = String(values.price ?? '').trim();
  const price = Number(priceText);
  if (!priceText || !Number.isFinite(price) || price < 0) errors.price = 'Giá phải là số từ 0 trở lên.';

  const stockText = String(values.stock ?? '').trim();
  const stock = Number(stockText);
  if (!stockText || !Number.isInteger(stock) || stock < 0) errors.stock = 'Tồn kho phải là số nguyên từ 0 trở lên.';
  return errors;
}

export function adminProductPageCount(total, limit) {
  return Math.max(1, Math.ceil(Math.max(0, Number(total) || 0) / Math.max(1, Number(limit) || 1)));
}
