import { FormEvent, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Bot, LoaderCircle, MessageCircle, RotateCcw, Send, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { chatApi } from '../api/services';
import { formatVnd } from '../api/client';
import { ProductCard } from './ProductCard';
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
  text: 'Xin chào! Tôi có thể giúp bạn tìm đồ gia dụng phù hợp.',
};

export function ChatWidget() {
  const { user } = useAuth();
  return <ShoppingChat key={user?.id ?? 'guest'} />;
}

function ShoppingChat() {
  const { sync, cart } = useCart();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionId = useRef(crypto.randomUUID());
  const busy = useRef(false);
  const active = useRef(true);
  const [retry, setRetry] = useState<{ message: string; options: ChatRequestOptions } | null>(null);
  const latestAssistant = messages.filter(message => message.role === 'assistant').at(-1)?.id;

  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  useEffect(() => {
    if (!open) return;
    const messages = messagesRef.current;
    if (messages) messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, open]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.matchMedia('(min-width: 561px)').matches
      ? window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 180)
      : undefined;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const request = async (message: string, options: ChatRequestOptions = { requestId: crypto.randomUUID() }, replay = false) => {
    if (!message || busy.current) return;
    busy.current = true;
    if (!replay) setMessages((current) => [...current, { id: Date.now(), role: 'user', text: message }]);
    setInput('');
    setError('');
    setRetry(null);
    setLoading(true);

    try {
      const { data } = await chatApi.send(message, sessionId.current, options);
      if (!active.current) return;
      if (data.cart) sync(data.cart);
      setMessages((current) => [...current, { id: Date.now(), role: 'assistant', text: data.message, response: data }]);
    } catch (requestError) {
      if (!active.current) return;
      const serverMessage = axios.isAxiosError(requestError) && requestError.response?.data?.message;
      setError(typeof serverMessage === 'string' ? serverMessage : Array.isArray(serverMessage) ? serverMessage.join('. ') : 'Chatbot đang bận. Bạn vui lòng thử lại sau.');
      if (axios.isAxiosError(requestError) && !requestError.response) setRetry({ message, options });
    } finally {
      busy.current = false;
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
    <div className={`chat-widget ${open ? 'is-open' : ''}`}>
      {open && (
        <section className="chat-panel" role="dialog" aria-labelledby="chat-title">
          <header className="chat-header">
            <div className="chat-avatar"><Bot size={20} /></div>
            <div>
              <strong id="chat-title">Trợ lý gia dụng</strong>
              <span>Luôn sẵn sàng hỗ trợ</span>
            </div>
            <button type="button" className="chat-reset" disabled={loading} aria-label="Bắt đầu cuộc trò chuyện mới" onClick={() => {
              sessionId.current = crypto.randomUUID(); setMessages([initialMessage]); setInput(''); setError(''); setRetry(null);
            }}><RotateCcw size={17} /></button>
            <button type="button" className="chat-close" onClick={() => setOpen(false)} aria-label="Đóng chatbot">
              <X size={19} />
            </button>
          </header>

          <div className="chat-messages" ref={messagesRef} aria-live="polite" aria-busy={loading}>
            {messages.map((message) => {
              const visibleCart = message.response?.cart && (message.id === latestAssistant ? cart ?? message.response.cart : message.response.cart);
              return (
              <div className={`chat-message ${message.role} ${message.response?.products?.length || message.response?.cart || message.response?.checkout ? 'has-products' : ''}`} key={message.id}>
                <span>{message.text}</span>
                {message.response?.products?.length ? <div className="chat-products">
                  {message.response.products.map((product, index) => <div key={product.id} className="chat-product-choice">
                    <span className="chat-product-number">Sản phẩm {index + 1}</span>
                    <ProductCard product={product} index={index} />
                    <div className="chat-actions">{message.response?.actions?.filter(action => action.productId === product.id).map(action =>
                      <button key={action.type} type="button" disabled={loading || message.id !== latestAssistant} onClick={() => act(action)}>{action.label}</button>)}</div>
                  </div>)}
                </div> : null}
                {visibleCart && <div className="chat-shopping-summary">
                  <strong>Giỏ hàng · {visibleCart.itemCount} sản phẩm</strong>
                  {!visibleCart.items.length && <p>Giỏ hàng đang trống.</p>}
                  {visibleCart.items.map(item => <ChatCartRow key={`${item.productId}-${item.quantity}`} item={item}
                    actions={message.response?.actions ?? []} disabled={loading || message.id !== latestAssistant} onAction={act} />)}
                  <div className="chat-total"><span>Tổng cộng</span><strong>{formatVnd(visibleCart.total)}</strong></div>
                  <Link to="/cart" onClick={() => setOpen(false)}>Mở trang giỏ hàng</Link>
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
                    <button key={action.type} type="button" disabled={loading || message.id !== latestAssistant} onClick={() => act(action)}>{action.label}</button>)}</div>
                  {message.response.checkoutUrl && <Link to={message.response.checkoutUrl} state={{ chatCheckout: { userId: user?.id,
                    address: message.response.checkout.addresses.find(address => address.id === message.response?.checkout?.addressId) } }} onClick={() => setOpen(false)}>Tiếp tục đến checkout →</Link>}
                </div>}
                {message.response?.error?.code === 'LOGIN_REQUIRED' && <Link to="/login" onClick={() => setOpen(false)}>Đăng nhập</Link>}
              </div>
            ); })}
            {loading && <div className="chat-message assistant chat-loading"><LoaderCircle size={15} /> Đang suy nghĩ...</div>}
          </div>

          {error && <div className="chat-error" role="alert">{error} {retry && <button type="button" disabled={loading} onClick={() => void request(retry.message, retry.options, true)}>Thử lại yêu cầu</button>}</div>}

          <form className="chat-form" onSubmit={send}>
            <button type="button" className="chat-view-cart" disabled={loading} onClick={() => act({ type: 'cart_view', label: 'Xem giỏ hàng' })} aria-label="Xem giỏ hàng">Giỏ</button>
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Hỏi về sản phẩm..."
              aria-label="Tin nhắn cho chatbot"
              maxLength={1000}
              disabled={loading}
            />
            <button type="submit" aria-label="Gửi tin nhắn" disabled={loading || !input.trim()}>
              <Send size={17} />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className={`chat-toggle ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? 'Đóng chatbot' : 'Mở chatbot'}
        aria-expanded={open}
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
      {remove && <button type="button" disabled={disabled} onClick={() => onAction(remove)}>Xóa</button>}
    </form>}
  </div>;
}
