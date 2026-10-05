import { useEffect, useState } from 'react';
import { useCategoryStore } from '@/entities/category';
import { useTransactionsStore } from './transactions-store';

// Separate resources for details and forecasts; never derive them from paginated rows.
export function useTransactionResource<T>(load: (userId: string) => Promise<T>, enabled = true, refreshOnChanges = true) {
  const userId = useTransactionsStore(state => state.userId);
  const revision = useTransactionsStore(state => refreshOnChanges ? state.revision : 0);
  const categoryKey = useCategoryStore(state => refreshOnChanges ? state.categories.map(category => category.id).join('|') : '');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    userId: string; revision: number; categoryKey: string; load: typeof load; attempt: number; data?: T; error?: boolean;
  } | null>(null);
  useEffect(() => {
    if (!userId || !enabled) return;
    let active = true;
    void load(userId).then(data => {
      if (active) setResult({ userId, revision, categoryKey, load, attempt, data });
    }).catch(() => {
      if (active) setResult({ userId, revision, categoryKey, load, attempt, error: true });
    });
    return () => { active = false; };
  }, [userId, revision, load, enabled, attempt, categoryKey]);
  const current = result?.userId === userId && result?.revision === revision
    && result?.categoryKey === categoryKey && result?.load === load && result?.attempt === attempt;
  return {
    data: current ? result?.data : undefined,
    loading: !current,
    error: current && Boolean(result?.error),
    retry: () => setAttempt(value => value + 1),
  };
}
