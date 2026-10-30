// shortcut: Backend chưa có transition/version guard, đồng bộ map này khi Backend bổ sung quy tắc chính thức.
export const ADMIN_ORDER_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function adminOrderTransitions(status) {
  return ADMIN_ORDER_TRANSITIONS[status] || [];
}

function searchable(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').trim();
}

function periodStart(period, now) {
  if (!period) return 0;
  const current = new Date(now);
  const days = period === 'today' ? 0 : period === '7d' ? 6 : period === '30d' ? 29 : 0;
  return new Date(current.getFullYear(), current.getMonth(), current.getDate() - days).getTime();
}

export function filterAdminOrders(orders, filters, now = Date.now()) {
  const term = searchable(filters.keyword).replace(/^#/, '');
  const start = periodStart(filters.period, now);
  return orders.filter((order) => {
    const haystack = searchable([order.id, order.fullName, order.email, order.phone].join(' '));
    if (term && !haystack.includes(term)) return false;
    if (filters.status && order.status !== filters.status) return false;
    if (filters.paymentMethod && order.paymentMethod !== filters.paymentMethod) return false;
    const createdAt = new Date(order.createdAt).getTime();
    if (start && (!Number.isFinite(createdAt) || createdAt < start)) return false;
    return true;
  });
}

export function adminOrderPageCount(total, limit) {
  return Math.max(1, Math.ceil(Math.max(0, Number(total) || 0) / Math.max(1, Number(limit) || 1)));
}
