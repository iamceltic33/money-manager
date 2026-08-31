export type LocalTransactionType = 'income' | 'expense';

export type LocalSyncStatus = 'pending' | 'synced' | 'failed';

export type LocalTransaction = {
  id: string;
  user_id: string;
  remote_id: string | null;
  type: LocalTransactionType;
  amount: number;
  category_id: string | null;
  note: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  sync_status: LocalSyncStatus;
  sync_error: string | null;
};

export type CreateLocalTransactionParams = {
  userId: string;
  type: LocalTransactionType;
  amount: number;
  categoryId?: string | null;
  note?: string | null;
  occurredAt?: Date;
};

export type UpdateLocalTransactionParams = {
  userId: string;
  id: string;
  type?: LocalTransactionType;
  amount?: number;
  categoryId?: string | null;
  note?: string | null;
  occurredAt?: Date;
};
