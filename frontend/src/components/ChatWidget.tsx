import { FormEvent, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Bot, LoaderCircle, MessageCircle, Send, X } from 'lucide-react';
import { chatApi } from '../api/services';
import { ProductCard } from './ProductCard';
import type { Product } from '../api/types';
import '../styles/chat-widget.css';

type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  products?: Product[];
};

const initialMessage: ChatMessage = {
  id: 1,
  role: 'assistant',
  text: 'Xin chào! Tôi có thể giúp bạn tìm đồ gia dụng phù hợp.',
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionId = useRef(`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).current;

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

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    setMessages((current) => [...current, { id: Date.now(), role: 'user', text: message }]);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const response = await chatApi.send(message, sessionId);
      setMessages((current) => [...current, { id: Date.now(), role: 'assistant', text: response.data.message, products: response.data.products }]);
    } catch (requestError) {
      const serverMessage = axios.isAxiosError(requestError) && requestError.response?.data?.message;
      setError(typeof serverMessage === 'string' ? serverMessage : 'Chatbot đang bận. Bạn vui lòng thử lại sau.');
    } finally {
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    }
  };

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
            <button type="button" className="chat-close" onClick={() => setOpen(false)} aria-label="Đóng chatbot">
              <X size={19} />
            </button>
          </header>

          <div className="chat-messages" ref={messagesRef} aria-live="polite" aria-busy={loading}>
            {messages.map((message) => (
              <div className={`chat-message ${message.role} ${message.products?.length ? 'has-products' : ''}`} key={message.id}>
                <span>{message.text}</span>
                {message.products?.length ? <div className="chat-products">
                  {message.products.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}
                </div> : null}
              </div>
            ))}
            {loading && <div className="chat-message assistant chat-loading"><LoaderCircle size={15} /> Đang suy nghĩ...</div>}
          </div>

          {error && <p className="chat-error" role="alert">{error}</p>}

          <form className="chat-form" onSubmit={send}>
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
