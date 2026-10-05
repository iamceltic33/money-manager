import { createStore } from 'zustand/vanilla';
import { getLocalTransactionsPage } from '../api/transactions';
import type { LocalTransaction, LocalTransactionCursor, LocalTransactionPageFilters } from './types';

type Query = { userId: string; filters: LocalTransactionPageFilters; revision: number; categoryKey?: string };
type State = {
  queryKey: string;
  items: LocalTransaction[];
  cursor: LocalTransactionCursor | null;
  hasMore: boolean;
  loading: boolean;
  error: boolean;
  configure: (query: Query) => void;
  loadMore: (retry?: boolean) => Promise<void>;
};

export const getTransactionQueryKey = (query: Query) => JSON.stringify(query);

export function createTransactionPagesStore() {
  let generation = 0;
  let query: Query | null = null;
  let reloadCount = 0;
  return createStore<State>((set, get) => ({
    queryKey: '', items: [], cursor: null, hasMore: true, loading: false, error: false,
    configure: (next) => {
      const queryKey = getTransactionQueryKey(next);
      if (get().queryKey === queryKey) return;
      const sameFilters = query?.userId === next.userId && JSON.stringify(query.filters) === JSON.stringify(next.filters);
      reloadCount = sameFilters ? get().items.length : 0;
      generation++;
      query = next;
      set({ queryKey, items: [], cursor: null, hasMore: true, loading: false, error: false });
      void get().loadMore();
    },
    loadMore: async (retry = false) => {
      const state = get();
      if (!query || state.loading || !state.hasMore || (state.error && !retry)) return;
      const requestGeneration = generation;
      const currentQuery = query;
      set({ loading: true, error: false });
      try {
        const items = new Map(get().items.map(item => [item.id, item]));
        let page;
        let cursor = state.cursor;
        do {
          page = await getLocalTransactionsPage({ ...currentQuery, cursor });
          if (generation !== requestGeneration) return;
          for (const item of page.items) items.set(item.id, item);
          cursor = page.nextCursor;
        } while (state.cursor === null && page.hasMore && items.size < reloadCount);
        set({ items: [...items.values()], cursor: page.nextCursor, hasMore: page.hasMore, loading: false });
      } catch {
        if (generation === requestGeneration) set({ error: true, loading: false });
      }
    },
  }));
}
