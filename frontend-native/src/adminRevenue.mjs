const PERIOD = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function normalizeRevenueRows(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const period = String(row?.period ?? '');
    const orders = Number(row?.orders);
    const revenue = Number(row?.revenue);
    return PERIOD.test(period) && Number.isInteger(orders) && orders >= 0 && Number.isFinite(revenue) && revenue >= 0
      ? [{ period, orders, revenue }]
      : [];
  });
}

export function revenueYears(rows, currentYear) {
  return [...new Set([currentYear, ...rows.map((row) => Number(row.period.slice(0, 4)))])].sort((a, b) => b - a);
}

export function revenueMonths(rows, year) {
  const byPeriod = new Map(rows.map((row) => [row.period, row]));
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const period = `${year}-${String(month).padStart(2, '0')}`;
    return { month, period, orders: 0, revenue: 0, ...byPeriod.get(period) };
  });
}

export function revenueTotals(months) {
  return months.reduce((totals, row) => ({
    orders: totals.orders + row.orders,
    revenue: totals.revenue + row.revenue,
  }), { orders: 0, revenue: 0 });
}

export function revenueShare(value, total) {
  return total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
}

export function revenueBarPercent(value, max) {
  return max > 0 ? `${Math.max(2, Math.round((Math.max(0, value) / max) * 100))}%` : '0%';
}
