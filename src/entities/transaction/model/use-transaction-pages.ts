import { useEffect, useMemo } from 'react';
import { useCategoryStore } from '@/entities/category';
import { useStore } from 'zustand';
import { useTransactionsStore } from './transactions-store';
import { createTransactionPagesStore, getTransactionQueryKey } from './transaction-pages-store';
import type { LocalTransactionPageFilters } from './types';

export function useTransactionPages(filters: LocalTransactionPageFilters, enabled = true) {
  const userId = useTransactionsStore(state => state.userId);
  const revision = useTransactionsStore(state => state.revision);
  const categoryKey = useCategoryStore(state => state.categories.map(category => category.id).join('|'));
  const store = useMemo(() => createTransactionPagesStore(), []);
  const state = useStore(store);
  const query = useMemo(() => ({ userId: userId ?? '', filters, revision, categoryKey }), [userId, filters, revision, categoryKey]);
  const key = getTransactionQueryKey(query);
  useEffect(() => {
    if (enabled) store.getState().configure(query);
  }, [store, query, enabled]);
  const current = state.queryKey === key;
  return {
    ...state,
    loadMore: (retry = false) => current ? state.loadMore(retry) : Promise.resolve(),
    items: current ? state.items : [],
    loading: !current || state.loading,
    error: current && state.error,
  };
}
