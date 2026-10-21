import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { paymentApi } from '../api/services';

// PIN lives only in this form and the dedicated payment request, never in chat state.
export function DemoCardPaymentForm({ orderId, disabled = false, onPaid }: { orderId: number; disabled?: boolean; onPaid: () => void | Promise<void> }) {
  const [pin, setPin] = useState('');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(true);
  const busy = useRef(false);
  const fieldId = useId();
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (disabled || busy.current || !/^\d{6}$/.test(pin)) return;
    busy.current = true; setPaying(true); setError('');
    try {
      await paymentApi.confirmCardPayment(orderId, pin);
      if (active.current) await onPaid();
    } catch (failure) {
      if (active.current) setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || 'Chưa thể xác minh thanh toán. Vui lòng kiểm tra lại trạng thái.');
    } finally {
      busy.current = false;
      if (active.current) { setPin(''); setPaying(false); }
    }
  };
  return <form className="order-card-retry chat-secure-payment" onSubmit={submit}>
    <p>Thẻ mô phỏng — không thu tiền thật. Nhập PIN 6 số đã tạo trong hồ sơ vào biểu mẫu thanh toán này.</p>
    <label htmlFor={fieldId}>PIN thanh toán</label>
    <input id={fieldId} type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" minLength={6} maxLength={6} required
      value={pin} disabled={disabled || paying} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" />
    <button type="submit" className="btn btn-primary" disabled={disabled || paying || pin.length !== 6}>{paying ? 'Đang xác minh…' : 'Thanh toán thẻ mô phỏng'}</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}
