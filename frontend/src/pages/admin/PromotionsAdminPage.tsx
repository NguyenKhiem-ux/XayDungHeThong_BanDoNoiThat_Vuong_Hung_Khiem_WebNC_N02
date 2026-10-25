import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, ChevronRight, Eye, Pause, Plus, RotateCw, Save, Search, Trash2, Zap } from 'lucide-react';
import { formatVnd, imageUrl } from '../../api/client';
import { productApi, promotionApi } from '../../api/services';
import type { Product, PromotionEvent, PromotionInput } from '../../api/types';
import { FlashSaleView } from '../../components/FlashSale';

const localTime = (value: string) => new Date(Date.parse(value) + 7 * 3600_000).toISOString().slice(0, 16);
const isoTime = (value: string) => new Date(`${value}:00+07:00`).toISOString();
const initial = () => ({ title: '', description: '', bannerDiscountPercent: '', startsAt: localTime(new Date().toISOString()), endsAt: localTime(new Date(Date.now() + 86400_000).toISOString()) });
const phaseLabel: Record<PromotionEvent['phase'], string> = { draft: 'Bản nháp', paused: 'Tạm dừng', scheduled: 'Đã lên lịch', active: 'Đang diễn ra', ended: 'Đã kết thúc' };
const message = (error: unknown) => {
  const value = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(value) ? value.join(' · ') : value || 'Chưa thể kết nối. Vui lòng thử lại.';
};

export function PromotionsAdminPage() {
  const [events, setEvents] = useState<PromotionEvent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(initial);
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [editing, setEditing] = useState<PromotionEvent | null>(null);
  const [keyword, setKeyword] = useState('');
  const [bulk, setBulk] = useState(20);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(true);
  const [clock, setClock] = useState({ serverTime: new Date().toISOString(), receivedAt: performance.now() });

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [eventResponse, productResponse] = await Promise.all([promotionApi.list(), productApi.list()]);
      setEvents(eventResponse.data.events); setProducts(productResponse.data);
      setClock({ serverTime: eventResponse.data.serverTime, receivedAt: performance.now() });
    } catch (error) { setError(message(error)); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const selectedProducts = useMemo(() => products.filter(product => selected[product.id] !== undefined).map(product => {
    const discountPercent = selected[product.id], originalPrice = product.originalPrice ?? product.price;
    const price = Number.isInteger(discountPercent) && discountPercent >= 1 && discountPercent <= 99
      ? Number((BigInt(originalPrice) * BigInt(100 - discountPercent) + 50n) / 100n) : originalPrice;
    return { ...product, originalPrice, price, savings: originalPrice - price, discountPercent };
  }), [products, selected]);
  const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi-VN');
  const found = products.filter(product => `${product.name} ${product.brand ?? ''} ${product.category ?? ''}`.toLocaleLowerCase('vi-VN').includes(normalizedKeyword));

  const reset = () => { setEditing(null); setForm(initial()); setSelected({}); setKeyword(''); setError(''); setNotice(''); };
  const edit = (event: PromotionEvent) => {
    setEditing(event); setForm({ title: event.title, description: event.description, bannerDiscountPercent: event.bannerDiscountPercent == null ? '' : String(event.bannerDiscountPercent), startsAt: localTime(event.startsAt), endsAt: localTime(event.endsAt) });
    setSelected(Object.fromEntries(event.products.map(product => [product.id, product.discountPercent ?? 0])));
    setError(''); setNotice(''); document.getElementById('promotion-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const toggleProduct = (product: Product) => setSelected(current => {
    const next = { ...current };
    if (next[product.id] !== undefined) delete next[product.id]; else if (Object.keys(next).length < 200) next[product.id] = bulk;
    return next;
  });
  const save = async (status: PromotionInput['status']) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const data: PromotionInput = { ...form, startsAt: isoTime(form.startsAt), endsAt: isoTime(form.endsAt), status,
        bannerDiscountPercent: form.bannerDiscountPercent === '' ? null : Number(form.bannerDiscountPercent),
        items: Object.entries(selected).map(([productId, discountPercent]) => ({ productId: Number(productId), discountPercent })) };
      if (data.startsAt >= data.endsAt) throw new Error('Ngày kết thúc phải sau ngày bắt đầu.');
      const { data: event } = editing ? await promotionApi.update(editing.id, data) : await promotionApi.create(data);
      setEditing(event); await load();
      setNotice(status === 'draft' ? 'Đã lưu bản nháp. Khách hàng chưa nhìn thấy sự kiện.' : status === 'paused' ? 'Đã tạm dừng ưu đãi.' : 'Đã lưu và công bố lịch ưu đãi. Hệ thống tự bắt đầu, kết thúc theo thời gian đã chọn.');
    } catch (error) { setError(error instanceof RangeError ? 'Vui lòng nhập đầy đủ ngày giờ hợp lệ.' : error instanceof Error && !('response' in error) ? error.message : message(error)); }
    finally { setBusy(false); }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') as PromotionInput['status'] | null;
    void save(action ?? 'draft');
  };
  let previewEvent: PromotionEvent | null = null;
  try {
    previewEvent = { id: editing?.id ?? 0, ...form, startsAt: isoTime(form.startsAt), endsAt: isoTime(form.endsAt), status: 'draft', phase: 'draft',
      bannerDiscountPercent: form.bannerDiscountPercent === '' ? null : Number(form.bannerDiscountPercent),
      maxDiscountPercent: selectedProducts.filter(product => product.stock > 0).reduce((max, product) => Math.max(max, product.discountPercent), 0),
      products: selectedProducts.filter(product => product.stock > 0).sort((a, b) => b.discountPercent - a.discountPercent || b.savings - a.savings) };
  } catch { /* Incomplete datetime input has no preview until valid. */ }

  return <div className="admin-page-shell promotion-admin">
    <div className="admin-page-header"><div><div className="eyebrow">GIA DỤNG VIỆT · MARKETING</div><h1>Sự kiện ưu đãi</h1><p>Chọn sản phẩm tốt, đặt mức giảm rõ ràng và chủ động lịch bán hàng.</p></div><button type="button" className="promotion-button secondary" onClick={reset} disabled={busy}><Plus size={17} /> Tạo sự kiện</button></div>
    {notice && <div className="promotion-notice" role="status"><Check size={18} />{notice}</div>}
    {error && <div className="promotion-error" role="alert"><span>{error}</span>{!products.length && <button type="button" onClick={() => void load()}><RotateCw size={15} /> Thử lại</button>}</div>}

    <div className="promotion-workspace" id="promotion-editor">
      <form className="promotion-editor" onSubmit={submit}>
        <div className="promotion-panel-title"><span className="promotion-step">01</span><div><h2>{editing ? 'Chỉnh sửa sự kiện' : 'Thông tin sự kiện'}</h2><p>Nội dung hiển thị trực tiếp trên trang chủ.</p></div>{editing && <span className={`promotion-status ${editing.phase}`}>{phaseLabel[editing.phase]}</span>}</div>
        <div className="promotion-fields">
          <label>Tên sự kiện <span aria-hidden="true">*</span><input required maxLength={120} placeholder="Ví dụ: Đại tiệc gia dụng cuối tuần" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
          <label>Mức “Giảm đến” trên banner (%)<input type="number" min={1} max={99} step={1} placeholder="Tự động theo sản phẩm nếu để trống" value={form.bannerDiscountPercent} onChange={event => setForm({ ...form, bannerDiscountPercent: event.target.value })} /><small>Không vượt mức giảm lớn nhất của sản phẩm tham gia. Banner tự điều chỉnh khi hàng ưu đãi hết kho.</small></label>
          <label>Mô tả ngắn<textarea rows={2} maxLength={300} placeholder="Một lời giới thiệu ngắn, rõ lợi ích cho người mua" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /><small>{form.description.length}/300 ký tự</small></label>
          <div className="promotion-time-fields"><label>Bắt đầu<input type="datetime-local" required value={form.startsAt} onChange={event => setForm({ ...form, startsAt: event.target.value })} /></label><label>Kết thúc<input type="datetime-local" required value={form.endsAt} onChange={event => setForm({ ...form, endsAt: event.target.value })} /></label></div>
          <p className="promotion-help">Giờ Việt Nam (UTC+7). Chỉ một sự kiện được chạy tại một thời điểm.</p>
        </div>

        <div className="promotion-panel-title"><span className="promotion-step">02</span><div><h2>Sản phẩm tham gia</h2><p>Tối đa 200 sản phẩm. Giá gốc được giữ nguyên.</p></div><span className="promotion-count">{selectedProducts.length} đã chọn</span></div>
        <div className="promotion-search"><Search size={18} /><input type="search" aria-label="Tìm sản phẩm tham gia" placeholder="Tìm theo tên, thương hiệu, danh mục..." value={keyword} onChange={event => setKeyword(event.target.value)} /></div>
        <div className="promotion-catalog" aria-busy={loading}>
          {loading ? <div className="promotion-catalog-loading" role="status">Đang tải danh mục sản phẩm…</div> : found.length ? found.map(product => <label key={product.id} className={`promotion-catalog-row${selected[product.id] !== undefined ? ' selected' : ''}`}>
            <input type="checkbox" checked={selected[product.id] !== undefined} onChange={() => toggleProduct(product)} disabled={busy || selectedProducts.length >= 200 && selected[product.id] === undefined} />
            <div className="promotion-thumb">{product.imageUrl ? <img src={imageUrl(product.imageUrl)} alt="" loading="lazy" /> : <Zap size={20} />}</div>
            <span className="promotion-catalog-name"><strong>{product.name}</strong><small>{product.category || 'Gia dụng'} · Còn {product.stock}</small></span><b>{formatVnd(product.originalPrice ?? product.price)}</b>
          </label>) : <div className="promotion-catalog-loading">Không tìm thấy sản phẩm phù hợp.</div>}
        </div>
        <div className="promotion-bulk"><label htmlFor="bulk-discount">Giảm hàng loạt</label><div className="promotion-percent"><input id="bulk-discount" type="number" min={1} max={99} step={1} value={bulk || ''} onChange={event => setBulk(Number(event.target.value))} /><span>%</span></div><button type="button" disabled={!selectedProducts.length || bulk < 1 || bulk > 99 || !Number.isInteger(bulk)} onClick={() => setSelected(Object.fromEntries(Object.keys(selected).map(id => [id, bulk])))}>Áp dụng cho {selectedProducts.length} sản phẩm</button></div>
        {!!selectedProducts.length && <div className="promotion-price-table-wrap"><table className="promotion-price-table"><caption className="sr-only">Mức giảm và giá dự kiến từng sản phẩm</caption><thead><tr><th>Sản phẩm</th><th>Giá gốc</th><th>Giảm</th><th>Giá ưu đãi</th><th><span className="sr-only">Bỏ chọn</span></th></tr></thead><tbody>{selectedProducts.map(product => <tr key={product.id}><td><strong>{product.name}</strong>{product.stock <= 0 && <small className="promotion-stock-warning">Hết hàng · Ẩn khỏi ưu đãi công khai</small>}</td><td>{formatVnd(product.originalPrice)}</td><td><div className="promotion-percent"><input aria-label={`Phần trăm giảm ${product.name}`} type="number" min={1} max={99} step={1} required value={selected[product.id] || ''} onChange={event => setSelected({ ...selected, [product.id]: Number(event.target.value) })} /><span>%</span></div></td><td className="promotion-new-price">{formatVnd(product.price)}<small>Tiết kiệm {formatVnd(product.savings)}</small></td><td><button type="button" aria-label={`Bỏ chọn ${product.name}`} onClick={() => toggleProduct(product)}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>}
        <div className="promotion-save-bar"><p><Check size={15} aria-hidden="true" /> Giá cuối cùng được backend kiểm tra lại khi khách xác nhận đơn.</p><div><button className="promotion-button secondary" type="submit" value="draft" disabled={busy || loading}><Save size={16} /> Lưu nháp</button>{editing?.status === 'published' && <button className="promotion-button secondary" type="submit" value="paused" disabled={busy}><Pause size={16} /> Tạm dừng</button>}<button className="promotion-button" type="submit" value="published" disabled={busy || loading || !selectedProducts.length}><Zap size={16} />{busy ? 'Đang lưu…' : editing?.status === 'paused' ? 'Công bố lại' : 'Công bố / lên lịch'}</button></div></div>
      </form>

      <aside className="promotion-sidebar"><div className="promotion-panel-title"><span className="promotion-step">03</span><div><h2>Lịch sự kiện</h2><p>Theo dõi các đợt ưu đãi của cửa hàng.</p></div></div>
        {loading ? <p className="promotion-help">Đang tải sự kiện…</p> : events.length ? <div className="promotion-event-list">{events.map(event => <button type="button" key={event.id} disabled={busy} className={`promotion-event-item${editing?.id === event.id ? ' current' : ''}`} onClick={() => edit(event)}><span className={`promotion-status ${event.phase}`}>{phaseLabel[event.phase]}</span><strong>{event.title}</strong><small>{new Date(event.startsAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })}<br />đến {new Date(event.endsAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })}</small><span>{event.products.length} sản phẩm <ChevronRight size={15} /></span></button>)}</div> : <div className="promotion-sidebar-empty"><Zap size={28} /><strong>Chưa có sự kiện</strong><p>Tạo đợt ưu đãi đầu tiên và xem trước bên dưới.</p></div>}
        <div className="promotion-policy"><strong>Rõ giá, đúng thời điểm</strong><p>Giảm 1–99%, làm tròn đến đồng. Giá trên bản xem trước là dự kiến theo giá gốc hiện tại.</p><p>Hàng hết kho không xuất hiện trong khu ưu đãi. Mã giảm giá chỉ tính trên phần hàng thường trong giỏ.</p></div>
      </aside>
    </div>
    <div className="promotion-preview-heading"><div><span className="eyebrow">GÓC NHÌN KHÁCH HÀNG</span><h2>Xem trước trên trang chủ</h2><p>Hình ảnh và sản phẩm thật. Các nút mua được vô hiệu hóa trong bản xem trước.</p></div><button type="button" className="promotion-button secondary" aria-expanded={preview} onClick={() => setPreview(!preview)}><Eye size={17} /> {preview ? 'Ẩn xem trước' : 'Hiện xem trước'}</button></div>
    {preview && (previewEvent ? <FlashSaleView event={previewEvent} clock={clock} preview /> : <p className="promotion-help">Nhập đầy đủ ngày giờ để xem trước sự kiện.</p>)}
  </div>;
}

