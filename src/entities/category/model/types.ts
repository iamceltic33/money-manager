export type LocalCategoryType = 'income' | 'expense';

export type LocalSyncStatus = 'pending' | 'synced' | 'failed';

export type LocalCategory = {
  id: string;
  remote_id: string | null;
  type: LocalCategoryType;
  name: string;
  color: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  sync_status: LocalSyncStatus;
  sync_error: string | null;
};

export type CreateLocalCategoryParams = {
  type: LocalCategoryType;
  name: string;
  color?: string | null;
  icon?: string | null;
  sortOrder?: number;
};

export type UpdateLocalCategoryParams = {
  id: string;
  type?: LocalCategoryType;
  name?: string;
  color?: string | null;
  icon?: string | null;
  sortOrder?: number;
};
