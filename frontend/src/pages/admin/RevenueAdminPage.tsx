import { useEffect, useMemo, useState } from 'react';
import { orderApi } from '../../api/services';
import { formatVnd } from '../../api/client';

type RevenueRow = { period: string; orders: number; revenue: number };
type ChartMode = 'line' | 'pie';

const monthName = (month: number) => `Tháng ${String(month).padStart(2, '0')}`;

function compactVnd(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} tr`;
  if (value >= 1_000) return `${(value / 1_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}k`;
  return `${value.toLocaleString('vi-VN')} đ`;
}

export function RevenueAdminPage() {
  const [rows, setRows] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chartMode, setChartMode] = useState<ChartMode>('line');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    orderApi.revenue()
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        setRows(list);
        const availableYears = list.map((row) => Number(row.period.slice(0, 4))).filter(Number.isFinite);
        if (availableYears.length) setYear(Math.max(...availableYears));
      })
      .catch(() => setError('Không thể tải dữ liệu doanh thu. Vui lòng thử tải lại trang.'))
      .finally(() => setLoading(false));
  }, []);

  const years = useMemo(() => {
    const values = new Set([new Date().getFullYear(), year, ...rows.map((row) => Number(row.period.slice(0, 4))).filter(Number.isFinite)]);
    return [...values].sort((a, b) => b - a);
  }, [rows, year]);

  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    const period = `${year}-${String(number).padStart(2, '0')}`;
    const result = rows.find((row) => row.period === period);
    return { month: number, period, orders: result?.orders ?? 0, revenue: result?.revenue ?? 0 };
  }), [rows, year]);

  const selected = months[month - 1];
  const annualRevenue = months.reduce((sum, item) => sum + item.revenue, 0);
  const annualOrders = months.reduce((sum, item) => sum + item.orders, 0);

  const lineGeometry = useMemo(() => {
    const left = 78; const right = 890; const top = 30; const bottom = 282;
    const max = Math.max(1, ...months.map((item) => item.revenue));
    const points = months.map((item, index) => ({
      x: left + (right - left) * index / 11,
      y: bottom - item.revenue / max * (bottom - top),
      ...item,
    }));
    return { left, right, top, bottom, points, max };
  }, [months]);

  const circumference = 2 * Math.PI * 82;
  const selectedShare = annualRevenue ? selected.revenue / annualRevenue : 0;
  const selectedLength = circumference * selectedShare;
  const restLength = circumference - selectedLength;

  return (
    <section className="admin-page revenue-page">
      <header className="admin-page-header revenue-header">
        <div>
          <span className="revenue-eyebrow">BÁO CÁO KINH DOANH</span>
          <h1>Doanh thu</h1>
          <p>Theo dõi doanh thu và số đơn hàng theo từng tháng.</p>
        </div>
        <div className="revenue-filters" aria-label="Bộ lọc doanh thu">
          <label>
            <span>Năm</span>
            <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Tháng</span>
            <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => (
                <option key={item} value={item}>{monthName(item)}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {error && <div className="revenue-error" role="alert">{error}</div>}

      <div className="revenue-stats">
        <article className="revenue-stat revenue-stat-primary">
          <span>Doanh thu {monthName(month).toLowerCase()}</span>
          <strong>{loading ? '…' : formatVnd(selected.revenue)}</strong>
          <small>{year}</small>
        </article>
        <article className="revenue-stat">
          <span>Đơn hàng trong tháng</span>
          <strong>{loading ? '…' : selected.orders.toLocaleString('vi-VN')}</strong>
          <small>{monthName(month)} · {year}</small>
        </article>
        <article className="revenue-stat">
          <span>Tổng doanh thu năm</span>
          <strong>{loading ? '…' : formatVnd(annualRevenue)}</strong>
          <small>{annualOrders.toLocaleString('vi-VN')} đơn hàng</small>
        </article>
      </div>

      <section className="revenue-card" aria-labelledby="revenue-chart-heading">
        <div className="revenue-card-heading">
          <div>
            <h2 id="revenue-chart-heading">Biểu đồ doanh thu</h2>
            <p>{monthName(month)} đang được chọn · năm {year}</p>
          </div>
          <div className="revenue-chart-switch" role="group" aria-label="Chọn kiểu biểu đồ">
            <button type="button" className={chartMode === 'line' ? 'active' : ''} onClick={() => setChartMode('line')} aria-pressed={chartMode === 'line'}>
              <span aria-hidden="true">⌁</span> Biểu đồ đường
            </button>
            <button type="button" className={chartMode === 'pie' ? 'active' : ''} onClick={() => setChartMode('pie')} aria-pressed={chartMode === 'pie'}>
              <span aria-hidden="true">◔</span> Biểu đồ tròn
            </button>
          </div>
        </div>

        {chartMode === 'line' ? (
          <div className="revenue-line-wrap">
            <svg className="revenue-line-chart" viewBox="0 0 920 340" role="img" aria-label={`Biểu đồ đường doanh thu năm ${year}`}>
              {[0, 1, 2, 3].map((tick) => {
                const y = lineGeometry.top + (lineGeometry.bottom - lineGeometry.top) * tick / 3;
                const value = lineGeometry.max * (1 - tick / 3);
                return <g key={tick}>
                  <line x1={lineGeometry.left} x2={lineGeometry.right} y1={y} y2={y} className="revenue-grid-line" />
                  <text x={lineGeometry.left - 12} y={y + 4} textAnchor="end" className="revenue-axis-label">{compactVnd(value)}</text>
                </g>;
              })}
              {lineGeometry.points[month - 1] && <line x1={lineGeometry.points[month - 1].x} x2={lineGeometry.points[month - 1].x} y1={lineGeometry.top} y2={lineGeometry.bottom} className="revenue-selected-guide" />}
              <polyline points={lineGeometry.points.map((point) => `${point.x},${point.y}`).join(' ')} className="revenue-line" />
              {lineGeometry.points.map((point) => <g key={point.period}>
                <circle cx={point.x} cy={point.y} r={point.month === month ? 7 : 4} className={point.month === month ? 'revenue-point selected' : 'revenue-point'}>
                  <title>{monthName(point.month)}: {formatVnd(point.revenue)} · {point.orders} đơn</title>
                </circle>
                <text x={point.x} y="316" textAnchor="middle" className={point.month === month ? 'revenue-axis-label selected' : 'revenue-axis-label'}>{String(point.month).padStart(2, '0')}</text>
              </g>)}
            </svg>
            <div className="revenue-chart-note">Doanh thu theo tháng (đồng) <span>·</span> Chọn tháng ở phía trên để làm nổi bật dữ liệu</div>
          </div>
        ) : (
          <div className="revenue-pie-layout">
            <div className="revenue-donut-wrap">
              <svg viewBox="0 0 240 240" className="revenue-donut" role="img" aria-label={`Tỷ trọng doanh thu ${monthName(month)} trong năm ${year}`}>
                <circle cx="120" cy="120" r="82" className="revenue-donut-track" />
                {annualRevenue > 0 && restLength > 0.01 && <circle cx="120" cy="120" r="82" className="revenue-donut-rest" strokeDasharray={`${restLength} ${circumference - restLength}`} strokeDashoffset={-selectedLength} />}
                {annualRevenue > 0 && selectedLength > 0.01 && <circle cx="120" cy="120" r="82" className="revenue-donut-selected" strokeDasharray={`${selectedLength} ${circumference - selectedLength}`} />}
                <text x="120" y="113" textAnchor="middle" className="revenue-donut-value">{selectedShare.toLocaleString('vi-VN', { style: 'percent', maximumFractionDigits: 1 })}</text>
                <text x="120" y="137" textAnchor="middle" className="revenue-donut-label">{monthName(month)}</text>
              </svg>
            </div>
            <div className="revenue-pie-legend">
              <h3>Tỷ trọng doanh thu năm {year}</h3>
              <p>So sánh doanh thu tháng đang chọn với phần còn lại của năm.</p>
              <div className="revenue-legend-row"><i className="selected" /><span>{monthName(month)}</span><strong>{formatVnd(selected.revenue)}</strong></div>
              <div className="revenue-legend-row"><i /><span>Các tháng còn lại</span><strong>{formatVnd(Math.max(0, annualRevenue - selected.revenue))}</strong></div>
              {annualRevenue === 0 && <small>Chưa có doanh thu trong năm được chọn.</small>}
            </div>
          </div>
        )}
      </section>

      <section className="revenue-card revenue-table-card">
        <div className="revenue-card-heading revenue-table-heading">
          <div><h2>Chi tiết theo tháng</h2><p>12 tháng trong năm {year}</p></div>
        </div>
        <div className="revenue-table-scroll">
          <table className="admin-table revenue-table">
            <thead><tr><th>Tháng</th><th>Số đơn hàng</th><th>Doanh thu</th><th>Tỷ trọng năm</th></tr></thead>
            <tbody>{months.map((item) => <tr key={item.period} className={item.month === month ? 'selected' : ''} onClick={() => setMonth(item.month)}>
              <td><button type="button" className="revenue-month-link" onClick={() => setMonth(item.month)}>{monthName(item.month)}{item.month === month && <span>Đang xem</span>}</button></td>
              <td>{item.orders.toLocaleString('vi-VN')}</td>
              <td className="revenue-table-amount">{formatVnd(item.revenue)}</td>
              <td>{annualRevenue ? (item.revenue / annualRevenue).toLocaleString('vi-VN', { style: 'percent', maximumFractionDigits: 1 }) : '0%'}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

export default RevenueAdminPage;
