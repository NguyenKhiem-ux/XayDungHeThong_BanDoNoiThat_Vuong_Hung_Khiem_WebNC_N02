export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidBirthDate(value, today = localDateString()) {
  if (!value) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    && value <= today;
}

export function profileValidationErrors(values, today) {
  const errors = {};
  const fullName = values.fullName?.trim() || '';
  const email = values.email?.trim() || '';
  const phone = values.phone?.trim() || '';
  const birthDate = values.birthDate?.trim() || '';

  if (!fullName) errors.fullName = 'Họ và tên không được để trống.';
  else if (fullName.length > 100) errors.fullName = 'Họ và tên không được quá 100 ký tự.';
  if (!email) errors.email = 'Email không được để trống.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email không đúng định dạng.';
  if (phone.length > 15) errors.phone = 'Số điện thoại không được quá 15 ký tự.';
  if (birthDate && !isValidBirthDate(birthDate, today)) errors.birthDate = 'Ngày sinh phải là ngày hợp lệ theo định dạng YYYY-MM-DD và không ở tương lai.';
  return errors;
}

export function profileBackendField(message) {
  const normalized = String(message || '').toLowerCase();
  if (normalized.includes('fullname') || normalized.includes('full name') || normalized.includes('họ và tên')) return 'fullName';
  if (normalized.includes('birthdate') || normalized.includes('birth date') || normalized.includes('ngày sinh')) return 'birthDate';
  if (normalized.includes('phone') || normalized.includes('số điện thoại')) return 'phone';
  if (normalized.includes('email')) return 'email';
  return null;
}

export function avatarMimeType(fileName, suppliedType) {
  if (suppliedType?.toLowerCase().startsWith('image/')) return suppliedType.toLowerCase();
  const cleanName = String(fileName || '').split(/[?#]/)[0].toLowerCase();
  const extension = cleanName.slice(cleanName.lastIndexOf('.') + 1);
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif' })[extension] || '';
}

export function avatarValidationError({ mimeType, fileSize }) {
  if (!mimeType?.startsWith('image/')) return 'Vui lòng chọn đúng định dạng tệp hình ảnh.';
  if (Number.isFinite(fileSize) && fileSize > MAX_AVATAR_BYTES) return 'Ảnh đại diện không được vượt quá 5 MB.';
  return '';
}
