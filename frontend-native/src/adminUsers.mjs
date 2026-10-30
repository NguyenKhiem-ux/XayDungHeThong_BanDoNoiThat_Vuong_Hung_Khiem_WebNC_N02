function searchable(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').trim();
}

export function filterAdminUsers(users, { keyword = '', role = '' } = {}) {
  const term = searchable(keyword);
  return users.filter((user) => {
    const haystack = searchable([user.id, user.fullName, user.username, user.email, user.phone].join(' '));
    return (!term || haystack.includes(term)) && (!role || user.role === role);
  });
}

export function adminUserPageCount(total, limit) {
  return Math.max(1, Math.ceil(Math.max(0, Number(total) || 0) / Math.max(1, Number(limit) || 1)));
}

export function adminUserInitials(fullName, username, email) {
  const source = String(fullName || username || email || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : source.slice(0, 2)).toUpperCase();
}
