import type { ChatResponse } from './types';

export function createTextQueue(onText: (text: string) => void, signal: AbortSignal) {
  const baseRate = 0.5;
  let pending = '';
  let rate = baseRate;
  let nextAt = 0;
  let lastArrival: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finishing = false;
  let closed = false;
  let resolveDone!: () => void;
  const done = new Promise<void>(resolve => { resolveDone = resolve; });

  const cancel = () => {
    if (closed) return;
    closed = true;
    pending = '';
    clearTimeout(timer);
    timer = undefined;
    signal.removeEventListener('abort', cancel);
    resolveDone();
  };

  const display = () => {
    timer = undefined;
    if (closed || !pending) return;
    // Keep every character, including Markdown spacing; only choose where to pause.
    const words = [...pending.matchAll(/\s*\S+\s*/gu)];
    const last = words[Math.min(2, words.length) - 1];
    const end = last ? last.index! + last[0].length : pending.length;
    const text = pending.slice(0, end);
    pending = pending.slice(end);
    const target = Math.min(90, baseRate + Math.max(0, words.length - 120) * 0.3);
    rate += Math.max(-2, Math.min(3, target - rate));
    nextAt = Date.now() + Math.ceil(Math.min(2, words.length) * 1000 / rate);
    onText(text);
    if (closed) return;
    if (pending) timer = setTimeout(display, Math.max(0, nextAt - Date.now()));
    else if (finishing) cancel();
  };

  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();

  return {
    push(text: string) {
      if (closed || finishing || !text) return;
      const now = Date.now();
      const gap = lastArrival === undefined ? 0 : now - lastArrival;
      lastArrival = now;
      const words = text.match(/\S+/gu)?.length ?? 0;
      // A sparse upstream chunk fits the time already spent waiting: show it without another delay.
      if (!pending && gap >= 250 && words <= gap * baseRate / 1000) {
        rate = baseRate;
        nextAt = now + Math.ceil(2000 / rate);
        onText(text);
        return;
      }
      pending += text;
      if (timer === undefined) {
        const wait = Math.max(0, nextAt - now);
        if (wait) timer = setTimeout(display, wait);
        else display();
      }
    },
    finish() {
      finishing = true;
      if (!pending) cancel();
      return done;
    },
    cancel,
  };
}

export async function readChatStream(response: Response, onDelta: (text: string) => void): Promise<ChatResponse> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.message;
    throw new Error(Array.isArray(message) ? message.join('. ') : typeof message === 'string' ? message : 'Không thể kết nối chatbot. Vui lòng thử lại.');
  }
  if (!response.headers.get('Content-Type')?.includes('text/event-stream') || !response.body) {
    throw new Error('Chatbot chưa hỗ trợ phản hồi trực tiếp. Vui lòng khởi động lại backend.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator: RegExpMatchArray | null;
      while ((separator = buffer.match(/\r?\n\r?\n/))) {
        const frame = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index! + separator[0].length);
        const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!data) continue;
        let event;
        try { event = JSON.parse(data); } catch { throw new Error('Phản hồi chatbot không hợp lệ. Vui lòng thử lại.'); }
        if (event.type === 'delta' && typeof event.text === 'string') onDelta(event.text);
        if (event.type === 'result' && typeof event.reply?.message === 'string') return event.reply;
        if (event.type === 'error') throw new Error(Array.isArray(event.message) ? event.message.join('. ') : event.message || 'Chatbot phản hồi thất bại.');
      }
    }
    throw new TypeError('Kết nối bị gián đoạn khi chatbot đang trả lời. Bạn có thể thử lại yêu cầu.');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
