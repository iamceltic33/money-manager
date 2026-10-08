import type { Tables } from '@/shared/api/supabase/database.types';

export type SyncTable = 'categories' | 'transactions' | 'obligations' | 'obligation_payments';
export type CloudCategory = Tables<'categories'>;
export type CloudTransaction = Tables<'transactions'>;
export type CloudObligation = Tables<'obligations'>;
export type CloudObligationPayment = Tables<'obligation_payments'>;
export type CloudRow = CloudCategory | CloudTransaction | CloudObligation | CloudObligationPayment;
export type SyncSnapshot = {
  categories: CloudCategory[];
  transactions: CloudTransaction[];
  obligations?: CloudObligation[];
  obligation_payments?: CloudObligationPayment[];
};

export type SyncRemote = {
  initialize: (seedDefaults: boolean) => Promise<void>;
  snapshot: () => Promise<SyncSnapshot>;
  upsert: (table: SyncTable, row: CloudRow, expectedUpdatedAt: string | null) => Promise<CloudRow>;
  ensureRow: (table: SyncTable, row: CloudRow) => Promise<void>;
  ensureCategory: (row: CloudCategory) => Promise<void>;
  remove: (table: SyncTable, id: string) => Promise<void>;
};
