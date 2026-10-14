// file là trang quản trị dashboard dành cho khu vực admin.
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Boxes, CalendarDays, Clock3, DollarSign, PieChart, Receipt, TrendingUp, Users } from 'lucide-react';
import { formatVnd } from '../../api/client';
import { orderApi } from '../../api/services';
import type { DashboardData, Order } from '../../api/types';

type ChartType = 'bar' | 'line' | 'doughnut';
type ChartKind = 'revenue' | 'orders';

const REVENUE_COLORS = ['#4e73df','#6a8ff5','#85abff','#3259c4','#2048b3','#90acff','#b8c9ff'];
const ORDER_COLORS = ['#1bbf8f','#34d9a8','#52edc0','#0ea877','#0b8c64','#67f2cb','#9ff8e0'];

function lastSevenDays() {
  const result: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    result.push(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}

function ChartPanel({ kind, labels, values }: { kind: ChartKind; labels: string[]; values: number[] }) {
  const [type, setType] = useState<ChartType>('bar');
  const colors = kind === 'revenue' ? REVENUE_COLORS : ORDER_COLORS;
  const isCurrency = kind === 'revenue';
  const max = Math.max(1, ...values);
  const title = kind === 'revenue' ? 'Doanh thu theo ngày' : 'Lượt mua theo ngày';

  const points = values.map((value, i) => {
    const x = 50 + i * 100;
    const y = 210 - (value / max) * 170;
    return `${x},${y}`;
  }).join(' ');

  const yLabels = isCurrency
    ? [max, max * .75, max * .5, max * .25, 0]
    : [max, max * .75, max * .5, max * .25, 0];

  const formatAxis = (v: number) => isCurrency ? `₫${Math.round(v).toLocaleString('vi-VN')}` : String(Math.round(v));
  const formatValue = (v: number) => isCurrency ? formatVnd(v) : String(Math.round(v));

  return <div className="dashboard-section">
    <div className="chart-header">
      <div>
        <div className="section-title">
          {kind === 'revenue' ? <BarChart3 size={16} /> : <CalendarDays size={16} />}
          {title}
        </div>
        {kind === 'revenue' && <div className="chart-note">Tổng giá trị đơn theo ngày đặt, gồm đơn chưa thanh toán; bỏ đơn đã hủy.</div>}
      </div>
      <div className="chart-type-btns">
        <button className={`chart-type-btn ${type === 'bar' ? 'active' : ''}`} onClick={() => setType('bar')}><BarChart3 size={14}/> Cột</button>
        <button className={`chart-type-btn ${type === 'line' ? 'active' : ''}`} onClick={() => setType('line')}><TrendingUp size={14}/> Đường</button>
        <button className={`chart-type-btn ${type === 'doughnut' ? 'active' : ''}`} onClick={() => setType('doughnut')}><PieChart size={14}/> Tròn</button>
      </div>
    </div>
    <div className="chart-legend">
      {labels.map((label, i) => <span className="chart-legend-item" key={label}><span className="legend-dot" style={{ background: colors[i % colors.length] }} />{label}</span>)}
    </div>
    <div className="chart-wrap">
      {type === 'doughnut' ? <DoughnutChart values={values} colors={colors} /> : <svg className="chart-svg" viewBox="0 0 750 250" preserveAspectRatio="none" role="img" aria-label={title}>
        {[40, 82.5, 125, 167.5, 210].map((y, i) => <g key={y}><line className="chart-grid-line" x1="50" y1={y} x2="730" y2={y}/><text className="chart-axis-label" x="42" y={y + 4} textAnchor="end">{formatAxis(yLabels[i])}</text></g>)}
        <line className="chart-axis" x1="50" y1="210" x2="730" y2="210" />
        {type === 'bar' && values.map((value, i) => {
          const x = 50 + i * 100 - 24;
          const h = Math.max(0, (value / max) * 170);
          return <rect key={i} className={kind === 'revenue' ? 'chart-bar-revenue' : 'chart-bar-orders'} x={x} y={210 - h} width="48" height={h} rx="5" />;
        })}
        {type === 'line' && <>
          <polyline className={kind === 'revenue' ? 'chart-line-revenue' : 'chart-line-orders'} points={points}/>
          {values.map((value, i) => { const [x,y] = [50 + i * 100, 210 - (value / max) * 170]; return <circle key={i} className={kind === 'revenue' ? 'chart-point-revenue' : 'chart-point-orders'} cx={x} cy={y} r="4"/>; })}
        </>}
        {labels.map((label, i) => <text key={label} className="chart-axis-label" x={50 + i * 100} y="232" textAnchor="middle">{label}</text>)}
      </svg>}
    </div>
    {type !== 'doughnut' && <div className="chart-values">{values.map((v, i) => <span key={i}>{labels[i]}: {formatValue(v)}</span>)}</div>}
  </div>;
}

function DoughnutChart({ values, colors }: { values: number[]; colors: string[] }) {
  const total = values.reduce((a,b) => a+b, 0);
  const radius = 82;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <div className="doughnut-wrap">
    <svg viewBox="0 0 220 220" className="doughnut-svg">
      <circle cx="110" cy="110" r={radius} fill="none" stroke="#eef2f7" strokeWidth="28" />
      {total > 0 && values.map((v, i) => {
        const length = circumference * (v / total);
        const dash = `${length} ${circumference - length}`;
        const el = <circle key={i} cx="110" cy="110" r={radius} fill="none" stroke={colors[i % colors.length]} strokeWidth="28" strokeDasharray={dash} strokeDashoffset={-offset} transform="rotate(-90 110 110)" />;
        offset += length;
        return el;
      })}
      <text x="110" y="105" textAnchor="middle" className="doughnut-total">{total.toLocaleString('vi-VN')}</text>
      <text x="110" y="126" textAnchor="middle" className="doughnut-label">Tổng</text>
    </svg>
  </div>;
}

export function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { orderApi.dashboard().then(r => setData(r.data)).catch(() => setError(true)); }, []);

  const labels = useMemo(() => lastSevenDays(), []);
  if (error) return <div className="admin-empty">Không tải được dữ liệu dashboard. Vui lòng kiểm tra backend rồi tải lại trang.</div>;
  if (!data) return <div className="admin-empty">Đang tải dashboard...</div>;

  // Chuẩn hóa ngày từ API về dạng dd/MM. Chấp nhận "2026-09-13", "2026-09-13T00:00:00.000Z"
  // và cả chuỗi ngày kiểu JS (nếu backend lỡ trả về Date.toString()).
  const pad = (n: number) => String(n).padStart(2, '0');
  const toLabel = (day: string) => {
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
    if (iso) return `${iso[3]}/${iso[2]}`;
    const d = new Date(day);
    return Number.isNaN(d.getTime()) ? day : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  };
  const revenueByDay = new Map((data.chartRevenueByDay ?? []).map(x => [toLabel(x.day), x.value]));
  const ordersByDay = new Map((data.chartOrdersByDay ?? []).map(x => [toLabel(x.day), x.value]));
  const revenues = labels.map(l => revenueByDay.get(l) ?? 0);
  const orders = labels.map(l => ordersByDay.get(l) ?? 0);

  return <div className="admin-page-shell">
    <div className="admin-page-header"><div><div className="eyebrow">TODAY OVERVIEW</div><h1>Dashboard</h1></div></div>
    <div className="admin-grid">
      <div className="admin-stat-card"><DollarSign/><div><span>Giá trị đơn hàng</span><strong>{formatVnd(data.revenue)}</strong></div></div>
      <div className="admin-stat-card"><Receipt/><div><span>Tổng đơn hàng</span><strong>{data.orders}</strong></div></div>
      <div className="admin-stat-card"><Clock3/><div><span>Chờ xử lý</span><strong>{data.pendingOrders}</strong></div></div>
      <div className="admin-stat-card"><Boxes/><div><span>Sản phẩm</span><strong>{data.products}</strong></div></div>
      <div className="admin-stat-card"><Users/><div><span>Người dùng</span><strong>{data.users}</strong></div></div>
    </div>
    <div className="dashboard-grid">
      <ChartPanel kind="revenue" labels={labels} values={revenues}/>
      <ChartPanel kind="orders" labels={labels} values={orders}/>
    </div>
    <div className="dashboard-section">
      <div className="section-title"><Receipt size={16}/> Đơn hàng gần đây</div>
      {data.recentOrders.length ? <div className="table-wrap"><table className="admin-table"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Số tiền</th><th>Trạng thái</th><th>Ngày đặt</th></tr></thead><tbody>{data.recentOrders.map((o: Order) => <tr key={o.id}><td>#{o.id}</td><td>{o.fullName}</td><td className="order-amount">{formatVnd(o.totalAmount)}</td><td><span className={`status-badge status-${o.status}`}>{o.status}</span></td><td>{new Date(o.createdAt).toLocaleString('vi-VN')}</td></tr>)}</tbody></table></div> : <div className="admin-empty">Chưa có đơn hàng nào</div>}
    </div>
  </div>;
}
