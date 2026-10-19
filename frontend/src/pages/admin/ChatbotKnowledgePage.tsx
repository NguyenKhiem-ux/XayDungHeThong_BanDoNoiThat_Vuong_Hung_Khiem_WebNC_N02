import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Check, Edit3, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { knowledgeApi, type KnowledgeInput } from '../../api/knowledge';
import { chatIntents, type ChatbotKnowledge, type ChatIntent, type KnowledgeStatus, type RiskLevel } from '../../api/types';
import '../../styles/chatbot-knowledge.css';

const labels: Record<KnowledgeStatus | '', string> = { '': 'Tất cả', pending_review: 'Pending · Chờ duyệt', approved: 'Approved · Đã duyệt', rejected: 'Rejected · Từ chối' };
const empty: KnowledgeInput = { question: '', answer: '', keywords: '' };

export function ChatbotKnowledgePage() {
  const [status, setStatus] = useState<KnowledgeStatus | ''>('pending_review');
  const [risk, setRisk] = useState<RiskLevel | ''>('');
  const [intent, setIntent] = useState<ChatIntent | ''>('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ChatbotKnowledge[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<KnowledgeInput | null>(null);
  const request = useRef(0);
  const questionInput = useRef<HTMLTextAreaElement>(null);

  function showError(value: unknown) {
    const message = axios.isAxiosError(value) ? value.response?.data?.message : undefined;
    setError(typeof message === 'string' ? message : Array.isArray(message) ? message.join('. ') : 'Không thể xử lý yêu cầu. Vui lòng thử lại.');
  }

  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setError('');
    try {
      const list = await knowledgeApi.list(status, page, risk, intent);
      if (id !== request.current) return;
      setRows(list.data.items);
      setTotal(list.data.total);
      if (page > 1 && !list.data.items.length) setPage(page - 1);
    } catch (value) { if (id === request.current) showError(value); }
    finally { if (id === request.current) setLoading(false); }
  }, [status, page, risk, intent]);

  useEffect(() => { void load(); return () => { request.current++; }; }, [load, revision]);
  useEffect(() => { if (form) questionInput.current?.focus(); }, [editing, !!form]);

  async function act(work: () => Promise<unknown>, success: string) {
    setBusy(true); setError(''); setNotice('');
    try { await work(); setNotice(success); setRevision(value => value + 1); }
    catch (value) { showError(value); }
    finally { setBusy(false); }
  }

  function edit(row?: ChatbotKnowledge) {
    setEditing(row?.id ?? null);
    setForm(row ? { question: row.question, answer: row.answer, keywords: row.keywords } : { ...empty });
    setError(''); setNotice('');
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form || busy) return;
    await act(async () => {
      const data = { question: form.question.trim(), answer: form.answer.trim(), keywords: form.keywords.trim() };
      if (editing !== null) await knowledgeApi.update(editing, data);
      else await knowledgeApi.create(data);
      setForm(null); setEditing(null); setStatus('pending_review'); setRisk(''); setIntent(''); setPage(1);
    }, 'Đã lưu vào Pending. Hãy kiểm tra nội dung và bấm Approve để cho phép chatbot sử dụng.');
  }

  return <div className="admin-page-shell knowledge-page">
    <div className="admin-page-header">
      <div><div className="eyebrow">CHATBOT</div><h1>Chatbot Knowledge</h1><p>Duyệt câu trả lời để chatbot tái sử dụng mà không gọi AI.</p></div>
      <div className="admin-actions">
        <button className="admin-mini-btn" disabled={busy || loading} onClick={() => void load()}><RefreshCw size={15} /> Làm mới</button>
        <button className="admin-mini-btn" disabled={busy} onClick={() => edit()}><Plus size={15} /> Tạo FAQ</button>
      </div>
    </div>
    {error && <p className="knowledge-error" role="alert">{error}</p>}
    {notice && <p className="knowledge-notice" role="status">{notice}</p>}
    {form && <form className="admin-panel knowledge-editor" onSubmit={save}>
      <h2>{editing === null ? 'Tạo FAQ thủ công' : `Sửa kiến thức #${editing}`}</h2>
      <div className="admin-field"><label htmlFor="knowledge-question">Câu hỏi</label><textarea ref={questionInput} id="knowledge-question" className="admin-textarea" rows={2} required maxLength={1000} value={form.question} disabled={busy} onChange={e => setForm({ ...form, question: e.target.value })} /></div>
      <div className="admin-field"><label htmlFor="knowledge-answer">Câu trả lời</label><textarea id="knowledge-answer" className="admin-textarea" rows={7} required maxLength={8000} value={form.answer} disabled={busy} onChange={e => setForm({ ...form, answer: e.target.value })} /></div>
      <div className="admin-field"><label htmlFor="knowledge-keywords">Từ khóa bổ sung (tùy chọn)</label><input id="knowledge-keywords" className="admin-input" maxLength={1000} value={form.keywords} disabled={busy} onChange={e => setForm({ ...form, keywords: e.target.value })} /></div>
      <p className="knowledge-note">Nội dung sau khi sửa cần duyệt lại. Với câu trả lời về sản phẩm, hãy kiểm tra tên, giá và tồn kho hiện tại trước khi lưu và duyệt.</p>
      <div className="admin-actions"><button className="admin-mini-btn" type="submit" disabled={busy || !form.question.trim() || !form.answer.trim()}>{busy ? 'Đang lưu…' : 'Lưu Pending'}</button><button className="admin-mini-btn" type="button" disabled={busy} onClick={() => setForm(null)}>Hủy</button></div>
    </form>}
    <div className="knowledge-tabs" aria-label="Lọc trạng thái">
      {(Object.keys(labels) as Array<KnowledgeStatus | ''>).map(value => <button className="admin-mini-btn" aria-pressed={status === value} disabled={busy} key={value} onClick={() => { setStatus(value); setPage(1); }}>{labels[value]}</button>)}
    </div>
    <div className="knowledge-filters">
      <label>Rủi ro<select className="admin-input" disabled={busy} value={risk} onChange={e => { setRisk(e.target.value as RiskLevel | ''); setPage(1); }}><option value="">Tất cả mức rủi ro</option>{['LOW', 'MEDIUM', 'HIGH'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Intent<select className="admin-input" disabled={busy} value={intent} onChange={e => { setIntent(e.target.value as ChatIntent | ''); setPage(1); }}><option value="">Tất cả ý định</option>{chatIntents.filter(value => !['small_talk', 'greeting', 'thanks', 'goodbye', 'unknown'].includes(value)).map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <div className="admin-panel" aria-busy={loading}>
      {loading ? <p role="status">Đang tải kiến thức…</p> : <div className="table-wrap"><table className="admin-table knowledge-table">
        <thead><tr><th>Câu hỏi / Câu trả lời</th><th>Phân loại / Nguồn</th><th>Trạng thái</th><th>Lượt dùng</th><th>Ngày tạo / Duyệt</th><th>Thao tác</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td><strong>{row.question}</strong><p className="knowledge-answer">{row.answer}</p>{row.contextHash && <small className="knowledge-note">Có dữ liệu sản phẩm; chỉ tái sử dụng khi dữ liệu còn khớp.</small>}</td>
          <td><div>{row.intent}</div><span className={`admin-status ${row.riskLevel === 'HIGH' ? 'bad' : ''}`}>{row.riskLevel}</span><div className="knowledge-note">Confidence: {row.source === 'gemini' ? `${row.confidenceScore}/100` : '—'}<br />Nguồn: {row.source}</div></td>
          <td><span className={`admin-status ${row.status === 'rejected' ? 'bad' : ''}`}>{labels[row.status]}</span></td>
          <td>{row.usageCount}</td><td>{new Date(row.createdAt).toLocaleString('vi-VN')}{row.reviewedAt && <p className="knowledge-note">{row.reviewedBy === null ? 'Tự duyệt' : `Admin #${row.reviewedBy}`}<br />{new Date(row.reviewedAt).toLocaleString('vi-VN')}</p>}</td>
          <td><div className="admin-actions">
            {row.status !== 'approved' && <button className="admin-mini-btn" disabled={busy} onClick={() => void act(() => knowledgeApi.approve(row.id), 'Đã duyệt. Chatbot có thể dùng câu trả lời này.')}><Check size={14} /> Approve</button>}
            {row.status !== 'rejected' && <button className="admin-mini-btn" disabled={busy} onClick={() => void act(() => knowledgeApi.reject(row.id), 'Đã từ chối. Chatbot sẽ không sử dụng câu trả lời này.')}><X size={14} /> Reject</button>}
            <button className="admin-mini-btn" disabled={busy} onClick={() => edit(row)}><Edit3 size={14} /> Edit</button>
            <button className="admin-mini-btn danger" disabled={busy} onClick={() => { if (confirm('Xóa kiến thức này?')) void act(() => knowledgeApi.remove(row.id), 'Đã xóa kiến thức.'); }}><Trash2 size={14} /> Delete</button>
          </div></td>
        </tr>)}</tbody>
      </table>{!rows.length && <p className="admin-empty">Chưa có kiến thức ở trạng thái này.</p>}</div>}
    </div>
    <div className="knowledge-pagination"><span>{total} mục · Trang {page} / {Math.max(1, Math.ceil(total / 20))}</span><div className="admin-actions"><button className="admin-mini-btn" disabled={busy || loading || page === 1} onClick={() => setPage(page - 1)}>Trước</button><button className="admin-mini-btn" disabled={busy || loading || page * 20 >= total} onClick={() => setPage(page + 1)}>Sau</button></div></div>
  </div>;
}
