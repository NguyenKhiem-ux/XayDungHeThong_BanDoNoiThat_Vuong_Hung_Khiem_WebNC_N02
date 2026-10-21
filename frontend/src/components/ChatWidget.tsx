import { FormEvent, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ArrowDown, Bot, Heart, LoaderCircle, MapPin, Maximize2, MessageCircle, Minimize2, Package, RotateCcw, Send, ShoppingCart, Square, Ticket, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { chatApi } from '../api/services';
import { createTextQueue } from '../api/chat-stream';
import { formatVnd } from '../api/client';
import { ProductCard } from './ProductCard';
import { ChatAccountCards } from './ChatAccountCards';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import type { CartItem, ChatAction, ChatRequestOptions, ChatResponse } from '../api/types';
import '../styles/chat-widget.css';

type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  response?: ChatResponse;
};

const initialMessage: ChatMessage = {
  id: 1,
  role: 'assistant',
  text: 'Xin chào! Tôi có thể giúp bạn tìm sản phẩm, quản lý giỏ hàng, tra cứu đơn hàng, địa chỉ và voucher. Bạn cần hỗ trợ gì hôm nay?',
};

export function ChatWidget() {
  const { user } = useAuth();
  return <ShoppingChat key={user?.id ?? 'guest'} />;
}

function ShoppingChat() {
  const { sync, cart } = useCart();
  const { user, syncFavorites } = useAuth();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const stickToBottom = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const sessionId = useRef(crypto.randomUUID());
  const busy = useRef(false);
  const active = useRef(true);
  const messageSequence = useRef(1);
  const inFlight = useRef<AbortController | null>(null);
  const [retry, setRetry] = useState<{ message: string; options: ChatRequestOptions } | null>(null);
  const latestAssistant = messages.filter(message => message.role === 'assistant').at(-1)?.id;

  useEffect(() => { active.current = true; return () => { active.current = false; inFlight.current?.abort(); }; }, []);

  useEffect(() => {
    if (!open) return;
    const messages = messagesRef.current;
    if (messages && stickToBottom.current) messages.scrollTop = messages.scrollHeight;
  }, [messages, loading, open, expanded]);

  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 140)}px`;
  }, [input, open, expanded]);

  useEffect(() => {
    if (!open || !expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keepFocusInside = () => {
      if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.querySelector<HTMLButtonElement>('.chat-expand')?.focus({ preventScroll: true });
    };
    keepFocusInside();
    document.addEventListener('focusin', keepFocusInside);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('focusin', keepFocusInside); };
  }, [open, expanded]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.matchMedia('(min-width: 561px)').matches
      ? window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 180)
      : undefined;
    return () => {
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (expanded && event.key === 'Tab' && !panelRef.current?.contains(document.activeElement)) {
        event.preventDefault(); panelRef.current?.querySelector<HTMLButtonElement>('.chat-expand')?.focus(); return;
      }
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      if (expanded) setExpanded(false);
      else { setOpen(false); window.requestAnimationFrame(() => toggleRef.current?.focus({ preventScroll: true })); }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, expanded]);

  const closeChat = () => { setOpen(false); setExpanded(false); window.requestAnimationFrame(() => toggleRef.current?.focus({ preventScroll: true })); };

  const request = async (message: string, options: ChatRequestOptions = { requestId: crypto.randomUUID() }, replay = false) => {
    if (!message || busy.current) return;
    const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
    if (/\b(password|mat khau|otp|pin|token|jwt|authorization|bearer|api key|secret|credential|so the|cvv|cvc)\b/.test(normalized) || /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b|\b(?:\d{4}[ -]){3}\d{4}\b|\b\d{13,19}\b|\bAIza[A-Za-z0-9_-]{30,}|\bsk-[A-Za-z0-9_-]{20,}/.test(message)) {
      setInput(''); setRetry(null);
      const id = ++messageSequence.current;
      setMessages(current => [...current, { id, role: 'assistant', text: 'Đừng gửi mật khẩu, OTP, PIN, token hoặc thông tin thẻ vào chatbot. Hãy dùng trang tài khoản/thanh toán.' }]);
      return;
    }
    busy.current = true;
    stickToBottom.current = true;
    setShowScrollDown(false);
    if (!replay) {
      const id = ++messageSequence.current;
      setMessages((current) => [...current, { id, role: 'user', text: message }]);
    }
    setInput('');
    setError('');
    setRetry(null);
    setLoading(true);
    const controller = new AbortController();
    inFlight.current = controller;
    const assistantId = ++messageSequence.current;
    const isCurrent = () => active.current && inFlight.current === controller && !controller.signal.aborted;
    let received = '';
    let partial = '';
    const updateReply = (text: string, response?: ChatResponse) => {
      if (!isCurrent()) return;
      setMessages(current => {
        const reply: ChatMessage = { id: assistantId, role: 'assistant', text, response };
        return current.some(item => item.id === assistantId) ? current.map(item => item.id === assistantId ? reply : item) : [...current, reply];
      });
    };
    const textQueue = createTextQueue(text => {
      partial += text;
      updateReply(partial);
    }, controller.signal);

    try {
      const data = await chatApi.stream(message, sessionId.current, options, text => {
        if (!isCurrent()) return;
        received += text;
        textQueue.push(text);
      }, controller.signal);
      if (!isCurrent()) return;
      if (data.cart) sync(data.cart);
      if (data.favorites) syncFavorites(data.favorites.map(item => item.productId));
      if (data.addresses) window.dispatchEvent(new CustomEvent('addresses-changed'));
      // A final moderation/review message replaces the draft immediately; normal answers drain first.
      if (data.source === 'gemini' && received.trim() === data.message) await textQueue.finish();
      else textQueue.cancel();
      updateReply(data.message, data);
    } catch (requestError) {
      if (!isCurrent()) return;
      const serverMessage = axios.isAxiosError(requestError) && requestError.response?.data?.message;
      setError(typeof serverMessage === 'string' ? serverMessage : Array.isArray(serverMessage) ? serverMessage.join('. ') : requestError instanceof Error ? requestError.message : 'Chatbot đang bận. Bạn vui lòng thử lại sau.');
      if (requestError instanceof TypeError || axios.isAxiosError(requestError) && !requestError.response) setRetry({ message, options });
    } finally {
      textQueue.cancel();
      if (inFlight.current !== controller) return;
      busy.current = false;
      inFlight.current = null;
      if (!active.current) return;
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    }
  };

  const act = (action: ChatAction) => {
    const { type, label, ...params } = action;
    void request(label, { ...params, action: type, requestId: crypto.randomUUID() });
  };
  const send = (event: FormEvent) => { event.preventDefault(); void request(input.trim()); };

  return (
    <div className={`chat-widget ${open ? 'is-open' : ''} ${open && expanded ? 'is-expanded' : ''}`}>
      {open && (
        <section className="chat-panel" id="shopping-chat" ref={panelRef} role="dialog" aria-modal={expanded || undefined} aria-labelledby="chat-title" onKeyDown={event => {
          if (!expanded || event.key !== 'Tab') return;
          const controls = [...panelRef.current!.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(element => element.getClientRects().length > 0);
          const first = controls[0];
          const last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}>
          <header className="chat-header">
            <div className="chat-avatar"><Bot size={20} /></div>
            <div className="chat-heading">
              <strong id="chat-title">Trợ lý gia dụng</strong>
              <span>Mua sắm và quản lý đơn hàng</span>
            </div>
            <div className="chat-header-actions">
            <button type="button" className="chat-icon-button chat-reset" disabled={loading} title="Cuộc trò chuyện mới" aria-label="Bắt đầu cuộc trò chuyện mới" onClick={() => {
              stickToBottom.current = true; setShowScrollDown(false);
              sessionId.current = crypto.randomUUID(); setMessages([initialMessage]); setInput(''); setError(''); setRetry(null);
            }}><RotateCcw size={17} /></button>
            <button type="button" className="chat-icon-button chat-expand" title={expanded ? 'Thu nhỏ (Esc)' : 'Mở toàn màn hình'} aria-label={expanded ? 'Thu nhỏ chatbot' : 'Mở chatbot toàn màn hình'} aria-pressed={expanded} onClick={() => setExpanded(current => !current)}>
              {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button type="button" className="chat-icon-button chat-close" onClick={closeChat} title="Đóng chatbot" aria-label="Đóng chatbot">
              <X size={19} />
            </button>
            </div>
          </header>

          <div className="chat-body">
          <div className="chat-messages" ref={messagesRef} aria-live="polite" aria-busy={loading} onScroll={event => {
            const element = event.currentTarget;
            const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
            stickToBottom.current = atBottom;
            setShowScrollDown(!atBottom);
          }}>
            <div className="chat-transcript">
            {messages.map((message) => {
              const visibleCart = message.response?.cart && (message.id === latestAssistant ? cart ?? message.response.cart : message.response.cart);
              return (
              <div className={`chat-message ${message.role} ${message.response?.products?.length || message.response?.cart || message.response?.checkout || message.response?.orders || message.response?.addresses || message.response?.favorites || message.response?.coupons || message.response?.addressForm || message.response?.confirmation ? 'has-products' : ''}`} key={message.id}>
                <span>{message.text}</span>
                {message.response?.products?.length ? <div className="chat-products">
                  {message.response.products.map((product, index) => <div key={product.id} className="chat-product-choice">
                    <span className="chat-product-number">Sản phẩm {index + 1}</span>
                    <ProductCard product={product} index={index} />
                    <div className="chat-actions">{message.response?.actions?.filter(action => action.productId === product.id).map(action =>
                      <button key={action.type} type="button" className={action.type === 'cart_add' ? 'is-primary' : undefined} disabled={loading || message.id !== latestAssistant} onClick={() => act(action)}>{action.label}</button>)}</div>
                  </div>)}
                </div> : null}
                {visibleCart && <div className="chat-shopping-summary">
                  <strong>Giỏ hàng · {visibleCart.itemCount} sản phẩm</strong>
                  {!visibleCart.items.length && <p>Giỏ hàng đang trống.</p>}
                  {visibleCart.items.map(item => <ChatCartRow key={`${item.productId}-${item.quantity}`} item={item}
                    actions={message.response?.actions ?? []} disabled={loading || message.id !== latestAssistant} onAction={act} />)}
                  <div className="chat-total"><span>Tổng cộng</span><strong>{formatVnd(visibleCart.total)}</strong></div>
                  <Link to="/cart" onClick={closeChat}>Mở trang giỏ hàng</Link>
                </div>}
                {message.response?.checkout && <div className="chat-shopping-summary">
                  <strong>{message.response.checkout.confirmed ? 'Đã xác nhận tóm tắt' : 'Xem trước mua hàng'}</strong>
                  {message.response.checkout.items.map(item => <div className="chat-cart-line" key={item.product.id}>
                    <span>{item.product.name}<small>{item.quantity} × {formatVnd(item.product.price)}</small></span><strong>{formatVnd(item.subtotal)}</strong>
                  </div>)}
                  <div className="chat-total"><span>Tạm tính toàn bộ giỏ</span><strong>{formatVnd(message.response.checkout.total)}</strong></div>
                  {!!message.response.checkout.addresses.length && <label className="chat-address">Địa chỉ nhận hàng
                    <select value={message.response.checkout.addressId ?? ''} disabled={loading || message.id !== latestAssistant || message.response.checkout.confirmed}
                      onChange={event => act({ type: 'checkout_review', label: 'Chọn địa chỉ nhận hàng', reviewId: message.response!.checkout!.id, addressId: Number(event.target.value) })}>
                      <option value="" disabled>Chọn địa chỉ đã lưu</option>
                      {message.response.checkout.addresses.map(address => <option key={address.id} value={address.id}>{address.fullName} · {address.phone} · {address.address}</option>)}
                    </select>
                  </label>}
                  <p>Cần bổ sung tại checkout: {message.response.checkout.missingFields.join(', ')}.</p>
                  <div className="chat-actions">{message.response.actions?.filter(action => action.type === 'checkout_confirm').map(action =>
                    <button key={action.type} type="button" className="is-primary" disabled={loading || message.id !== latestAssistant} onClick={() => act(action)}>{action.label}</button>)}</div>
                  {message.response.checkoutUrl && <Link to={message.response.checkoutUrl} state={{ chatCheckout: { userId: user?.id,
                    address: message.response.checkout.addresses.find(address => address.id === message.response?.checkout?.addressId) } }} onClick={closeChat}>Tiếp tục đến checkout →</Link>}
                </div>}
                {message.response?.error?.code === 'LOGIN_REQUIRED' && <Link to="/login" onClick={closeChat}>Đăng nhập</Link>}
                {message.response && <ChatAccountCards response={message.response} disabled={loading || message.id !== latestAssistant} onAction={act} />}
              </div>
            ); })}
            {loading && <div className="chat-loading" role="status"><LoaderCircle size={15} /> {messages.at(-1)?.role === 'assistant' ? 'Đang trả lời...' : 'Đang xử lý yêu cầu...'}</div>}
            </div>
          </div>
          {showScrollDown && <button type="button" className="chat-scroll-down" onClick={() => {
            stickToBottom.current = true; setShowScrollDown(false);
            const element = messagesRef.current;
            if (element) element.scrollTop = element.scrollHeight;
          }}><ArrowDown size={15} /> Tin nhắn mới nhất</button>}
          </div>

          <footer className="chat-footer">
          {error && <div className="chat-error" role="alert">{error} {retry && <button type="button" disabled={loading} onClick={() => void request(retry.message, retry.options, true)}>Thử lại yêu cầu</button>}</div>}

          <nav className="chat-shortcuts" aria-label="Chức năng chatbot">{([
            ['cart_view', 'Giỏ hàng', ShoppingCart], ['orders_list', 'Đơn hàng', Package], ['favorites_list', 'Yêu thích', Heart], ['addresses_list', 'Địa chỉ', MapPin], ['coupons_list', 'Voucher', Ticket],
          ] as const).map(([type, label, Icon]) => <button type="button" key={type} disabled={loading} onClick={() => act({ type, label })}><Icon size={15} /><span>{label}</span>{type === 'cart_view' && !!cart?.itemCount && <span className="chat-shortcut-count">{cart.itemCount}</span>}</button>)}</nav>

          <form className="chat-form" onSubmit={send}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Nhập yêu cầu của bạn..."
              aria-label="Tin nhắn cho chatbot"
              maxLength={1000}
              disabled={loading}
              rows={1}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault(); event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button type={loading ? 'button' : 'submit'} aria-label={loading ? 'Dừng phản hồi' : 'Gửi tin nhắn'}
              disabled={!loading && !input.trim()} onClick={loading ? () => inFlight.current?.abort() : undefined}>
              {loading ? <Square size={17} /> : <Send size={17} />}
            </button>
          </form>
          <p className="chat-input-hint">Enter để gửi · Shift + Enter để xuống dòng{expanded && <span>Esc để thu nhỏ</span>}</p>
          </footer>
        </section>
      )}

      <button
        type="button"
        ref={toggleRef}
        className={`chat-toggle ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? 'Đóng chatbot' : 'Mở chatbot'}
        aria-expanded={open}
        aria-controls="shopping-chat"
      >
        {open ? <X size={22} /> : <MessageCircle size={23} />}
      </button>
    </div>
  );
}

function ChatCartRow({ item, actions, disabled, onAction }: { item: CartItem; actions: ChatAction[]; disabled: boolean; onAction: (action: ChatAction) => void }) {
  const [quantity, setQuantity] = useState(String(item.quantity));
  const update = actions.find(action => action.type === 'cart_update_quantity' && action.productId === item.productId);
  const remove = actions.find(action => action.type === 'cart_remove' && action.productId === item.productId);
  return <div className="chat-cart-item">
    <div className="chat-cart-line"><span>{item.product.name}<small>{item.quantity} × {formatVnd(item.product.price)}</small></span><strong>{formatVnd(item.subtotal)}</strong></div>
    {(update || remove) && <form className="chat-cart-controls" onSubmit={event => { event.preventDefault(); if (update) onAction({ ...update, quantity: Number(quantity) }); }}>
      {update && <><input type="number" aria-label={`Số lượng ${item.product.name}`} min="1" max={Math.min(item.product.stock, 9999)} step="1" required value={quantity} disabled={disabled} onChange={event => setQuantity(event.target.value)} /><button type="submit" disabled={disabled}>Cập nhật</button></>}
      {remove && <button type="button" className="is-danger" disabled={disabled} onClick={() => onAction(remove)}>Xóa</button>}
    </form>}
  </div>;
}
