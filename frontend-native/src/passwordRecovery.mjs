/** @param {string} value */
export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** @param {string} value */
export function normalizeOtp(value) {
  return value.replace(/\D/g, '').slice(0, 6);
}

/** @param {string} expiresAt @param {number} [now] */
export function secondsUntil(expiresAt, now = Date.now()) {
  const expiry = new Date(expiresAt).getTime();
  return Number.isFinite(expiry) ? Math.max(0, Math.ceil((expiry - now) / 1000)) : 0;
}

/** @param {string} password @param {string} confirmation */
export function newPasswordError(password, confirmation) {
  if (password.length < 6) return 'Mật khẩu mới phải có ít nhất 6 ký tự.';
  if (password !== confirmation) return 'Mật khẩu nhập lại không khớp.';
  return '';
}
