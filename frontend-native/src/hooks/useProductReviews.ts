import { useCallback, useEffect, useRef, useState } from 'react';
import { reviewApi } from '../api';
import { useStore } from '../store';
import type { OwnReview, ReviewPage, ReviewSummary } from '../types';

const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Chưa thể tải đánh giá. Vui lòng thử lại.';

export function useProductReviews(productId: number, onChange: (summary: ReviewSummary) => void) {
  const { user } = useStore();
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const [data, setData] = useState<ReviewPage | null>(null);
  const [own, setOwn] = useState<OwnReview | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [filter, setFilter] = useState(0);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ownError, setOwnError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    reviewApi.list(productId, page, filter || undefined, controller.signal)
      .then(next => { if (!controller.signal.aborted) setData(next); })
      .catch(failure => { if (!controller.signal.aborted) { setData(null); setError(messageOf(failure)); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filter, page, productId, revision]);

  useEffect(() => {
    setOwn(null);
    setRating(0);
    setComment('');
    setOwnError('');
    setSaveError('');
    setSaved(false);
  }, [productId, user?.id]);

  useEffect(() => {
    const controller = new AbortController();
    setOwnError('');
    if (user) reviewApi.mine(productId, controller.signal)
      .then(next => {
        if (controller.signal.aborted) return;
        setOwn(next);
        setRating(next.review?.rating ?? 0);
        setComment(next.review?.comment ?? '');
      })
      .catch(failure => { if (!controller.signal.aborted) setOwnError(messageOf(failure)); });
    return () => controller.abort();
  }, [productId, revision, user, user?.id]);

  const save = useCallback(async () => {
    if (busy || !rating) return;
    setBusy(true);
    setSaveError('');
    setSaved(false);
    const userId = user?.id;
    try {
      const next = await reviewApi.save(productId, rating, comment);
      if (owner.current !== userId) return;
      setOwn(next);
      onChange(next.summary);
      setFilter(0);
      setPage(1);
      setRevision(value => value + 1);
      setSaved(true);
    } catch (failure) {
      setSaveError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  }, [busy, comment, onChange, productId, rating, user?.id]);

  const chooseFilter = useCallback((value: number) => {
    setFilter(value);
    setPage(1);
  }, []);

  const retry = useCallback(() => setRevision(value => value + 1), []);

  return { busy, chooseFilter, comment, data, error, filter, loading, own, ownError, page, rating, retry, save, saved, saveError, setComment, setPage, setRating, user };
}
