export function adminDayLabel(value) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (iso) return `${iso[3]}/${iso[2]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '—');
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function adminBarHeight(value, maxValue, height = 112) {
  const safeValue = Math.max(0, Number(value) || 0);
  const safeMax = Math.max(0, Number(maxValue) || 0);
  return safeMax ? Math.max(4, Math.round((safeValue / safeMax) * height)) : 4;
}

export function compactAdminMoney(value) {
  const amount = Number(value) || 0;
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}tỷ`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}tr`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return String(amount);
}
