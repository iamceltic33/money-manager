import type { Tables } from '@/shared/api/supabase/database.types';

export type SyncTable = 'categories' | 'transactions';
export type CloudCategory = Tables<'categories'>;
export type CloudTransaction = Tables<'transactions'>;
export type CloudRow = CloudCategory | CloudTransaction;
export type SyncSnapshot = {
  categories: CloudCategory[];
  transactions: CloudTransaction[];
};

export type SyncRemote = {
  initialize: (seedDefaults: boolean) => Promise<void>;
  snapshot: () => Promise<SyncSnapshot>;
  upsert: (table: SyncTable, row: CloudRow, expectedUpdatedAt: string | null) => Promise<CloudRow>;
  ensureCategory: (row: CloudCategory) => Promise<void>;
  remove: (table: SyncTable, id: string) => Promise<void>;
};
