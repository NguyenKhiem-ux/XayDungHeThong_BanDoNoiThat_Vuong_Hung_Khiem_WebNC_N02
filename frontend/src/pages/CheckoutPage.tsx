// file là trang checkout của giao diện người dùng.
import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { formatVnd } from '../api/client';
import { couponApi, orderApi, paymentApi } from '../api/services';
import type { Cart, ChatCheckoutQuote, Coupon, PaymentMethod } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

type CheckoutForm = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  district: string;
  province: string;
  paymentMethod: PaymentMethod;
  note: string;
};

export function CheckoutPage() {
  const { cart, refresh, loading: cartLoading } = useCart();
  const { user } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [form, setForm] = useState<CheckoutForm>(() => {
    const initial: CheckoutForm = {
      fullName: user?.fullName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      address: '',
      district: '',
      province: '',
      paymentMethod: 'QR',
      note: '',
    };
    try {
      const saved = JSON.parse(sessionStorage.getItem('giadung_checkout') || 'null');
      if (saved && typeof saved === 'object') {
        for (const key of Object.keys(initial) as Array<keyof CheckoutForm>) {
          if (key !== 'paymentMethod' && typeof saved[key] === 'string') initial[key] = saved[key];
        }
        initial.paymentMethod = saved.paymentMethod === 'CASH' || saved.paymentMethod === 'CARD' ? saved.paymentMethod : 'QR';
      }
    } catch {}
    return initial;
  });
  const [step, setStep] = useState(loc.pathname.endsWith('/payment') ? 2 : loc.pathname.endsWith('/invoice') ? 3 : 1);
  useEffect(() => { setStep(loc.pathname.endsWith('/payment') ? 2 : loc.pathname.endsWith('/invoice') ? 3 : 1); }, [loc.pathname]);
  const [busy, setBusy] = useState(false);
  const [cardPin, setCardPin] = useState('');
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState(() => sessionStorage.getItem('giadung_checkout_coupon') || '');
  const [appliedCoupon, setAppliedCoupon] = useState<{ coupon: Coupon; discountAmount: number; finalAmount: number } | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [couponBusy, setCouponBusy] = useState(() => Boolean(sessionStorage.getItem('giadung_checkout_coupon_applied')));
  const [couponError, setCouponError] = useState('');
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [quote, setQuote] = useState<ChatCheckoutQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteRetry, setQuoteRetry] = useState(0);
  const [priceChanged, setPriceChanged] = useState(false);
  const deliveryAddress = [form.address.trim(), form.district.trim(), form.province.trim()].filter(Boolean).join(', ');

  useEffect(() => { void refresh().catch(() => setOrderError('Chưa thể cập nhật giỏ hàng. Vui lòng tải lại trang.')); }, [user?.id]);

  useEffect(() => {
    if (step !== 3 || pendingOrderId) return;
    let active = true;
    setQuote(null); setQuoteLoading(true); setPriceChanged(false); setOrderError('');
    orderApi.preview({ fullName: form.fullName, email: form.email, phone: form.phone, address: deliveryAddress,
      paymentMethod: form.paymentMethod, note: form.note, couponCode: appliedCoupon?.coupon.code })
      .then(({ data }) => { if (active) setQuote(data); })
      .catch(error => { if (active) setOrderError((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Chưa thể kiểm tra giá. Vui lòng thử lại.'); })
      .finally(() => { if (active) setQuoteLoading(false); });
    return () => { active = false; };
  }, [step, form.fullName, form.email, form.phone, deliveryAddress, form.paymentMethod, form.note, appliedCoupon?.coupon.code, quoteRetry, pendingOrderId]);

  useEffect(() => { couponApi.list().then((response) => setAvailableCoupons(response.data)).catch(() => setAvailableCoupons([])); }, []);
  useEffect(() => { sessionStorage.removeItem('giadung_checkout_card_demo'); }, []);

  useEffect(() => {
    sessionStorage.setItem('giadung_checkout', JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    const saved = loc.state?.chatCheckout;
    if (saved?.userId !== user?.id || !saved?.address) return;
    const { fullName, phone, address } = saved.address;
    if ([fullName, phone, address].every(value => typeof value === 'string')) {
      setForm(current => ({ ...current, fullName, phone, address, email: user?.email ?? current.email, district: '', province: '' }));
    }
  }, [loc.state, user?.id]);

  useEffect(() => {
    if (!cartLoading && cart && !cart.items.length && !busy && !pendingOrderId) nav('/cart');
  }, [cartLoading, cart, nav, busy, pendingOrderId]);

  const update = (key: keyof CheckoutForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const go = (nextStep: number) => {
    setStep(nextStep);
    nav(nextStep === 1 ? '/checkout/info' : nextStep === 2 ? '/checkout/payment' : '/checkout/invoice');
  };

  const nextInfo = (event: FormEvent) => {
    event.preventDefault();
    go(2);
  };

  const applyCoupon = async (requestedCode = couponCode) => {
    const code = requestedCode.trim().toUpperCase();
    if (!code || !cart) {
      setCouponError('Vui lòng nhập hoặc chọn mã giảm giá.');
      return;
    }
    setCouponBusy(true);
    setCouponError('');
    try {
      const { data } = await couponApi.validate(code, cart.total);
      setAppliedCoupon({ coupon: data.coupon, discountAmount: data.discountAmount, finalAmount: data.finalAmount });
      setCouponCode(data.coupon.code);
      sessionStorage.setItem('giadung_checkout_coupon', data.coupon.code);
      sessionStorage.setItem('giadung_checkout_coupon_applied', data.coupon.code);
      setVoucherOpen(false);
    } catch (error) {
      setAppliedCoupon(null);
      sessionStorage.removeItem('giadung_checkout_coupon_applied');
      setCouponError((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Không thể áp dụng mã giảm giá.');
    } finally {
      setCouponBusy(false);
    }
  };

  const chooseCoupon = (code: string) => {
    setCouponCode(code);
    void applyCoupon(code);
  };

  const removeCoupon = () => {
    setCouponCode('');
    setAppliedCoupon(null);
    setCouponError('');
    sessionStorage.removeItem('giadung_checkout_coupon');
    sessionStorage.removeItem('giadung_checkout_coupon_applied');
  };

  const updateCouponCode = (code: string) => {
    setCouponCode(code);
    setAppliedCoupon(null);
    setCouponError('');
    sessionStorage.setItem('giadung_checkout_coupon', code);
    sessionStorage.removeItem('giadung_checkout_coupon_applied');
  };

  useEffect(() => {
    const savedCode = sessionStorage.getItem('giadung_checkout_coupon_applied');
    if (!savedCode || !cart) return;
    let active = true;
    setCouponBusy(true);
    couponApi.validate(savedCode, cart.total).then(({ data }) => {
      if (!active) return;
      setAppliedCoupon({ coupon: data.coupon, discountAmount: data.discountAmount, finalAmount: data.finalAmount });
      setCouponCode(data.coupon.code);
    }).catch(() => {
      if (!active) return;
      sessionStorage.removeItem('giadung_checkout_coupon_applied');
      setAppliedCoupon(null);
    }).finally(() => {
      if (active) setCouponBusy(false);
    });
    return () => { active = false; };
  }, [cart?.total]);

  if (!cart?.items?.length) return pendingOrderId ? <section className="section"><div className="empty-state" role="status"><h1>Đơn #{pendingOrderId} đã được tạo</h1><p>{orderError || 'Đang chuẩn bị bước thanh toán tiếp theo…'}</p><Link className="btn btn-primary" to={`/orders/${pendingOrderId}`}>Xem đơn và tiếp tục thanh toán</Link></div></section> : null;

  const nextPay = (event: FormEvent) => {
    event.preventDefault();
    go(3);
  };

  const confirm = async (event: FormEvent) => {
    event.preventDefault();
    if (!quote || quoteLoading || pendingOrderId) return;
    setBusy(true);
    setOrderError('');
    try {
      const { data: order } = await orderApi.create({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        address: deliveryAddress,
        paymentMethod: form.paymentMethod,
        note: form.note,
        couponCode: appliedCoupon?.coupon.code,
        quoteId: quote.id,
        quoteHash: quote.hash,
      });
      setPendingOrderId(order.id);

      if (form.paymentMethod === 'QR' || form.paymentMethod === 'PAYOS') {
        await refresh();
        sessionStorage.removeItem('giadung_checkout');
        sessionStorage.removeItem('giadung_checkout_coupon');
        sessionStorage.removeItem('giadung_checkout_coupon_applied');
        const { data } = await paymentApi.createPayOSPaymentLink(order.id);
        window.location.href = data.checkoutUrl;
        return;
      }

      if (form.paymentMethod === 'CARD') {
        await paymentApi.confirmCardPayment(order.id, cardPin);
        await refresh();
      } else {
        await refresh();
      }
      sessionStorage.removeItem('giadung_checkout');
      sessionStorage.removeItem('giadung_checkout_coupon');
      sessionStorage.removeItem('giadung_checkout_coupon_applied');

      nav(`/checkout/success/${order.id}`, { replace: true });
    } catch (error) {
      const detail = (error as { response?: { data?: { message?: string; quote?: ChatCheckoutQuote } } }).response?.data;
      if (detail?.quote) { setQuote(detail.quote); setPriceChanged(true); void refresh().catch(() => {}); }
      else if (!pendingOrderId && (error as { response?: { status?: number } }).response?.status === 409) setQuote(null);
      setOrderError(detail?.message || 'Chưa thể tạo đơn hàng. Vui lòng kiểm tra lại thông tin và thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return <>
    {step === 1 && <>
      <section className="page-hero compact">
        <span className="eyebrow dark">Checkout</span>
        <h1>Thông tin giao hàng</h1>
        <p>Nhập đầy đủ thông tin. Dấu sao chuyển xanh khi trường hợp lệ.</p>
      </section>
      <section className="checkout-wrap">
        <form className="checkout-card" onSubmit={nextInfo}>
          <div className="checkout-steps">
            <Step active={step >= 1} icon="fa-location-dot" text="Thông tin" />
            <Step active={step >= 2} icon="fa-wallet" text="Thanh toán" />
            <Step active={step >= 3} icon="fa-file-invoice" text="Xác nhận" />
          </div>
          <div className="checkout-section-intro">
            <h2 className="checkout-title"><i className="fa-solid fa-user" /> Thông tin người mua</h2>
            <p>Để tiếp tục đặt hàng, vui lòng nhập thông tin người nhận bên dưới.</p>
          </div>
          <div className="form-grid checkout-info-grid">
            <Field label="Họ và tên người nhận" hint="Tên người nhận hàng" autoComplete="name" value={form.fullName} set={(value) => update('fullName', value)} required />
            <Field label="Số điện thoại" hint="Ví dụ: 0901 234 567" autoComplete="tel" value={form.phone} set={(value) => update('phone', value)} type="tel" required />
            <Field label="Email nhận xác nhận đơn" hint="Bạn sẽ nhận thông tin đơn hàng qua email này" autoComplete="email" value={form.email} set={(value) => update('email', value)} type="email" required full />
            <Field label="Địa chỉ" hint="Số nhà, tên đường, phường/xã" autoComplete="street-address" value={form.address} set={(value) => update('address', value)} required full />
            <Field label="Quận / Huyện" autoComplete="address-level2" value={form.district} set={(value) => update('district', value)} required />
            <Field label="Tỉnh / Thành phố" autoComplete="address-level1" value={form.province} set={(value) => update('province', value)} required />
            <Field label="Ghi chú cho người giao hàng" hint="Không bắt buộc · Ví dụ: gọi trước khi giao" value={form.note} set={(value) => update('note', value)} textarea full />
          </div>
          {orderError && <div className="checkout-order-error" role="alert">{orderError}</div>}
          <label className="checkout-terms"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} required /><span>Tôi đã đọc và đồng ý với các điều kiện giao dịch chung của website.</span></label>
          <div className="actions">
            <button className="btn btn-primary">Tiếp tục thanh toán <i className="fa-solid fa-arrow-right" /></button>
          </div>
        </form>
        <Summary cart={cart} couponCode={couponCode} setCouponCode={updateCouponCode} appliedCoupon={appliedCoupon} availableCoupons={availableCoupons} couponBusy={couponBusy} couponError={couponError} voucherOpen={voucherOpen} setVoucherOpen={setVoucherOpen} onApplyCoupon={() => applyCoupon()} onChooseCoupon={chooseCoupon} onRemoveCoupon={removeCoupon} />
      </section>
    </>}

    {step === 2 && <>
      <section className="page-hero compact">
        <span className="eyebrow dark">Payment</span>
        <h1>Chọn phương thức thanh toán</h1>
        <p>Chọn phương thức phù hợp. Thanh toán thẻ hiện đang chạy ở chế độ mô phỏng phát triển.</p>
      </section>
      <section className="payment-shell">
        <form className="payment-panel" onSubmit={nextPay}>
          <div className="payment-head">
            <h2 className="payment-title"><i className="fa-solid fa-wallet" /> Phương thức thanh toán</h2>
            <span className="payment-pill"><i className="fa-solid fa-shield-halved" /> Bảo mật SSL</span>
          </div>
          <div className="payment-methods">
            {([
              ['QR', 'Mã QR', 'Quét mã để thanh toán online', 'fa-qrcode'],
              ['CASH', 'Tiền mặt', 'Thanh toán khi nhận hàng', 'fa-money-bill-wave'],
              ['CARD', 'Thẻ nội địa / quốc tế', 'Mô phỏng giao diện thanh toán thẻ', 'fa-credit-card'],
            ] as const).map(([value, name, sub, icon]) => (
              <label className="payment-method" key={value}>
                <input type="radio" checked={form.paymentMethod === value} onChange={() => update('paymentMethod', value)} />
                <span className="payment-method-card">
                  <span className="method-icon"><i className={`fa-solid ${icon}`} /></span>
                  <span className="method-name">{name}</span>
                  <span className="method-sub">{sub}</span>
                </span>
              </label>
            ))}
          </div>
          {(form.paymentMethod === 'QR' || form.paymentMethod === 'PAYOS') && <div className="method-detail active">
            <div className="cash-box">
              <i className="fa-solid fa-shield-halved" />
              <div>
                <h3>Thanh toán PayOS</h3>
                <p>Chọn “Xem hóa đơn xác nhận”, sau đó xác nhận đơn hàng để mở trang PayOS và quét mã QR thanh toán.</p>
              </div>
            </div>
          </div>}
          {form.paymentMethod === 'CASH' && <div className="method-detail active">
            <div className="cash-box">
              <i className="fa-solid fa-truck-fast" />
              <div>
                <h3>Thanh toán tiền mặt khi nhận hàng</h3>
                <p>Bạn kiểm tra sản phẩm, hóa đơn và thanh toán trực tiếp cho nhân viên giao hàng.</p>
              </div>
            </div>
          </div>}
          {form.paymentMethod === 'CARD' && <div className="method-detail active">
            <div className="card-demo-notice"><i className="fa-solid fa-shield-halved" /><div><strong>Thẻ thanh toán đã lưu · chế độ mô phỏng</strong><span>Không kết nối ngân hàng và không thu tiền thật. PIN bên dưới là PIN riêng của website, không phải PIN thẻ ngân hàng.</span></div></div>
            {user?.savedCard ? <div className="card-demo-preview"><div><span>{user.savedCard.holder}</span><b>{user.savedCard.type === 'DOMESTIC' ? 'NỘI ĐỊA' : 'QUỐC TẾ'}</b></div><strong>••••　••••　••••　{user.savedCard.last4}</strong><small>{user.savedCard.provider} · HẾT HẠN {String(user.savedCard.expMonth).padStart(2, '0')}/{user.savedCard.expYear} · MÔ PHỎNG</small></div> : <div className="cash-box"><i className="fa-solid fa-credit-card" /><div><h3>Chưa có thẻ được lưu</h3><p>Thêm thông tin thẻ mô phỏng và tạo PIN 6 số trong <a href="/profile">Hồ sơ cá nhân</a> trước khi tiếp tục.</p></div></div>}
          </div>}
          <button className="btn btn-primary btn-wide" style={{ marginTop: 24 }} disabled={form.paymentMethod === 'CARD' && (!user?.savedCard || !user?.hasTransactionPin)}>
            <i className="fa-solid fa-file-invoice" /> {form.paymentMethod === 'CARD' ? 'Tiếp tục xem đơn mô phỏng' : 'Xem hóa đơn xác nhận'}
          </button>
          <button type="button" className="btn btn-ghost btn-wide" style={{ marginTop: 10 }} onClick={() => go(1)}>
            Quay lại
          </button>
        </form>
        <Summary cart={cart} payment customer={{ ...form, address: deliveryAddress }} couponCode={couponCode} setCouponCode={updateCouponCode} appliedCoupon={appliedCoupon} availableCoupons={availableCoupons} couponBusy={couponBusy} couponError={couponError} voucherOpen={voucherOpen} setVoucherOpen={setVoucherOpen} onApplyCoupon={() => applyCoupon()} onChooseCoupon={chooseCoupon} onRemoveCoupon={removeCoupon} />
      </section>
    </>}

    {step === 3 && <div className="invoice-container">
      <div className="invoice-header">
        <span className="eyebrow dark">HUNG VUONG GIA DỤNG · ĐƠN HÀNG</span>
        <h1><i className="fa-solid fa-file-invoice" /> Hóa Đơn Xác Nhận</h1>
        <p>Kiểm tra đầy đủ thông tin giao hàng, sản phẩm và thanh toán trước khi đặt hàng.</p>
      </div>
      <form className="invoice-box" onSubmit={confirm}>
        <div className="invoice-brand-row"><div><strong>HUNG VUONG GIA DỤNG</strong><span>Hóa đơn tạm tính · Mã đơn sẽ được tạo sau khi xác nhận</span></div><span className="invoice-status"><i className="fa-solid fa-circle-check" /> Chờ xác nhận</span></div>
        <div className="invoice-section">
          <div className="invoice-section-title">Thông tin giao hàng</div>
          <div className="invoice-info">
            <Info label="Họ và tên" value={form.fullName} />
            <Info label="Email" value={form.email} />
            <Info label="Số điện thoại" value={form.phone} />
            <Info label="Địa chỉ giao hàng" value={deliveryAddress} />
            <Info label="Ghi chú giao hàng" value={form.note || 'Không có'} />
            {quote?.couponCode && <Info label="Mã giảm giá" value={`${quote.couponCode} · giảm ${formatVnd(quote.discountAmount)}`} />}
          </div>
        </div>
        <div className="invoice-section">
          <div className="invoice-section-title">Sản phẩm</div>
          <table className="invoice-items-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th style={{ textAlign: 'right' }}>Đơn giá</th>
                <th style={{ textAlign: 'center' }}>Số lượng</th>
                <th style={{ textAlign: 'right' }}>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {(quote?.items ?? cart.items.map(item => ({ productId: item.productId, name: item.product.name, price: item.product.price, quantity: item.quantity, subtotal: item.subtotal }))).map((item) => (
                <tr key={item.productId}>
                  <td><strong>{item.name}</strong></td>
                  <td style={{ textAlign: 'right' }}>{formatVnd(item.price)}</td>
                  <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatVnd(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="invoice-total">
          <div className="invoice-total-box">
            <div className="invoice-total-line"><span>Tạm tính ({quote?.items.reduce((sum, item) => sum + item.quantity, 0) ?? cart.itemCount} sản phẩm)</span><strong>{formatVnd(quote?.subtotal ?? cart.total)}</strong></div>
            <div className="invoice-total-line"><span>Phí giao hàng</span><strong>Miễn phí</strong></div>
            {!!quote?.discountAmount && <div className="invoice-total-line invoice-discount-line"><span>Voucher {quote.couponCode}</span><strong>−{formatVnd(quote.discountAmount)}</strong></div>}
            <div className="invoice-total-label">Tổng thanh toán</div>
            <div className="invoice-total-amount">{quoteLoading ? 'Đang kiểm tra giá…' : formatVnd(quote?.total ?? appliedCoupon?.finalAmount ?? cart.total)}</div>
            <div className="payment-method-box">
              <div style={{ fontSize: '.9rem', color: 'var(--muted)' }}>Phương thức thanh toán</div>
              <div style={{ fontWeight: 600, marginTop: '.5rem' }}>{form.paymentMethod === 'CARD' && user?.savedCard ? `${user.savedCard.type === 'DOMESTIC' ? 'Thẻ nội địa' : 'Thẻ quốc tế'} · ${user.savedCard.provider} · ${user.savedCard.holder} · •••• ${user.savedCard.last4}` : paymentLabel(form.paymentMethod)}</div>
              {form.paymentMethod === 'CARD' && <small className="invoice-demo-note">Thanh toán mô phỏng · Không kết nối ngân hàng · Không thu tiền thật</small>}
            </div>
          </div>
        </div>
        {form.paymentMethod === 'CARD' && <div className="invoice-section card-pin-section"><label htmlFor="checkout-card-pin">PIN thanh toán 6 số</label><p>Nhập PIN bạn đã tạo trong hồ sơ để xác minh và xác nhận đơn mô phỏng.</p><input id="checkout-card-pin" type="password" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={cardPin} onChange={event => setCardPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" /></div>}
        <p className="invoice-disclaimer">Hóa đơn này là thông tin xác nhận đơn hàng, không thay thế hóa đơn VAT.</p>
        {orderError && <div className="checkout-order-error" role="alert">{orderError}</div>}
        {pendingOrderId && orderError && <p className="invoice-demo-note">Đơn #{pendingOrderId} đã được tạo nhưng chưa thanh toán. Bạn có thể nhập lại PIN trong <a href={`/orders/${pendingOrderId}`}>chi tiết đơn hàng</a>.</p>}
        <div className="actions">
          <button type="button" className="btn-back invoice-print-button" onClick={() => window.print()}><i className="fa-solid fa-print" /> In hóa đơn</button>
          {!quote && !quoteLoading && <button type="button" className="btn-back" onClick={() => setQuoteRetry(value => value + 1)}>Kiểm tra lại giá</button>}
          <button className="btn-confirm" disabled={busy || quoteLoading || !quote || !!pendingOrderId}><i className="fa-solid fa-check" /> {busy ? 'Đang xác nhận...' : priceChanged ? 'Xác nhận lại với giá mới' : form.paymentMethod === 'CARD' ? 'Xác minh PIN và thanh toán mô phỏng' : 'Xác nhận đơn hàng'}</button>
          <button type="button" className="btn-back" onClick={() => go(2)}><i className="fa-solid fa-arrow-left" /> Quay lại</button>
        </div>
      </form>
    </div>}
  </>;
}

function Step({ active, icon, text }: { active: boolean; icon: string; text: string }) {
  return <div className={`checkout-step ${active ? 'active' : ''}`}><i className={`fa-solid ${icon}`} /><span>{text}</span></div>;
}

function Field({ label, hint, autoComplete, value, set, type = 'text', textarea = false, required = false, full = false }: { label: string; hint?: string; autoComplete?: string; value: string; set: (value: string) => void; type?: string; textarea?: boolean; required?: boolean; full?: boolean }) {
  return <div className={`field ${full ? 'full' : ''}`}>
    <label>{label} {required && <span className="required">*</span>}</label>
    {textarea
      ? <textarea className="form-input" value={value} onChange={(event) => set(event.target.value)} required={required} autoComplete={autoComplete} />
      : <input className="form-input" type={type} value={value} onChange={(event) => set(event.target.value)} required={required} autoComplete={autoComplete} />}
    {hint && <small className="field-hint">{hint}</small>}
  </div>;
}

function paymentLabel(method: PaymentMethod) {
  return method === 'CASH' ? 'Tiền mặt khi nhận hàng' : method === 'CARD' ? 'Thẻ tín dụng/ghi nợ' : 'Thanh toán trực tuyến qua PayOS (QR)';
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="invoice-item"><div className="invoice-item-label">{label}</div><div className="invoice-item-value">{value}</div></div>;
}

function Summary({ cart, payment = false, customer, couponCode, setCouponCode, appliedCoupon, availableCoupons, couponBusy, couponError, voucherOpen, setVoucherOpen, onApplyCoupon, onChooseCoupon, onRemoveCoupon }: {
  cart: Cart;
  payment?: boolean;
  customer?: CheckoutForm;
  couponCode: string;
  setCouponCode: (value: string) => void;
  appliedCoupon: { coupon: Coupon; discountAmount: number; finalAmount: number } | null;
  availableCoupons: Coupon[];
  couponBusy: boolean;
  couponError: string;
  voucherOpen: boolean;
  setVoucherOpen: (open: boolean) => void;
  onApplyCoupon: () => void;
  onChooseCoupon: (code: string) => void;
  onRemoveCoupon: () => void;
}) {
  const now = Date.now();
  const eligibleCoupons = availableCoupons.filter((coupon) => coupon.isActive && new Date(coupon.startDate).getTime() <= now && new Date(coupon.endDate).getTime() >= now && (coupon.usageLimit === null || coupon.usedCount < coupon.usageLimit));
  const couponDescription = (coupon: Coupon) => `${coupon.description ? `${coupon.description} · ` : ''}${coupon.discountType === 'percentage' ? `Giảm ${coupon.discountValue}%` : `Giảm ${formatVnd(Number(coupon.discountValue))}`} · Đơn tối thiểu ${formatVnd(Number(coupon.minOrderAmount))}`;
  return <aside className="summary-panel">
    <h2 className="summary-title"><i className="fa-solid fa-receipt" /> Tổng tiền đơn hàng</h2>
    <div className="voucher-panel">
      {!!cart.saleSavings && <p className="voucher-sale-policy">Bạn đã tiết kiệm {formatVnd(cart.saleSavings)} từ sự kiện. Voucher chỉ áp dụng cho phần hàng thường: {formatVnd(cart.couponEligibleTotal ?? 0)}.</p>}
      <div className="voucher-entry">
        <input aria-label="Mã voucher" placeholder="Nhập mã voucher" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} />
        <button type="button" className="voucher-choose" onClick={() => setVoucherOpen(!voucherOpen)}><i className="fa-solid fa-ticket" /> Chọn mã</button>
      </div>
      <button type="button" className="voucher-apply" onClick={onApplyCoupon} disabled={couponBusy || !couponCode.trim()}>{couponBusy ? 'Đang kiểm tra…' : 'Áp dụng mã'}</button>
      {couponError && <small className="voucher-error" role="alert">{couponError}</small>}
      {appliedCoupon && <div className="voucher-applied"><i className="fa-solid fa-circle-check" /> Đã áp dụng <strong>{appliedCoupon.coupon.code}</strong><button type="button" aria-label="Gỡ mã giảm giá" onClick={onRemoveCoupon}>Gỡ</button></div>}
      {voucherOpen && <div className="voucher-picker" role="dialog" aria-label="Chọn mã giảm giá">
        <div className="voucher-picker-head"><strong>Mã giảm giá khả dụng</strong><button type="button" aria-label="Đóng danh sách mã" onClick={() => setVoucherOpen(false)}>×</button></div>
        {eligibleCoupons.length ? eligibleCoupons.map((coupon) => {
          const meetsMinimum = (cart.couponEligibleTotal ?? cart.total) > 0 && (cart.couponEligibleTotal ?? cart.total) >= Number(coupon.minOrderAmount);
          return <button type="button" className="voucher-option" key={coupon.id} disabled={!meetsMinimum} onClick={() => onChooseCoupon(coupon.code)}><span><strong>{coupon.code}</strong><small>{couponDescription(coupon)}</small>{!meetsMinimum && <small className="voucher-option-hint">{cart.couponEligibleTotal === 0 ? 'Mã chỉ áp dụng cho hàng không sale.' : `Cần thêm ${formatVnd(Number(coupon.minOrderAmount) - (cart.couponEligibleTotal ?? cart.total))} hàng không sale để sử dụng`}</small>}</span><i className="fa-solid fa-chevron-right" /></button>;
        }) : <p className="voucher-empty">Hiện chưa có mã giảm giá khả dụng.</p>}
      </div>}
    </div>
    <div className="summary-row"><span>Tạm tính ({cart.itemCount} sản phẩm)</span><strong>{formatVnd(cart.total)}</strong></div>
    <div className="summary-row"><span>Giao hàng</span><strong>Miễn phí</strong></div>
    <div className="summary-row"><span>Giảm giá voucher</span><strong className="summary-discount">−{formatVnd(appliedCoupon?.discountAmount ?? 0)}</strong></div>
    <div className="summary-row summary-total"><span>Thành tiền</span><strong>{formatVnd(appliedCoupon?.finalAmount ?? cart.total)}</strong></div>
    {payment && customer && <div className="customer-box"><strong>Người nhận</strong><br />{customer.fullName}<br />{customer.phone}<br />{customer.address}</div>}
    <div className="secure-note"><i className="fa-solid fa-lock" /> Thông tin được mã hóa khi xử lý thanh toán</div>
  </aside>;
}
