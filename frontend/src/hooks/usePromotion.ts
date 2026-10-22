import { useEffect, useState } from 'react';
import { promotionApi } from '../api/services';
import type { PromotionEvent } from '../api/types';

export function usePromotion() {
  const [event, setEvent] = useState<PromotionEvent | null>(null);
  const [clock, setClock] = useState({ serverTime: new Date().toISOString(), receivedAt: performance.now() });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let boundary: number | undefined;
    let pending = false;
    const load = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const { data } = await promotionApi.current(controller.signal);
        if (controller.signal.aborted) return;
        setClock({ serverTime: data.serverTime, receivedAt: performance.now() });
        setEvent(data.event);
        setError(false);
        window.clearTimeout(boundary);
        if (data.event) boundary = window.setTimeout(() => { setEvent(null); void load(); }, Math.min(2_147_000_000, Math.max(250, Date.parse(data.event.endsAt) - Date.parse(data.serverTime))));
      } catch {
        if (!controller.signal.aborted) { setEvent(null); setError(true); }
      } finally { pending = false; if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    const focus = () => void load();
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => { controller.abort(); window.clearInterval(interval); window.clearTimeout(boundary); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, [revision]);
  return { event, clock, loading, error, retry: () => { setLoading(true); setRevision(value => value + 1); } };
}
