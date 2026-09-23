import { getLocalDb } from './client';

export type LocalDeletion = {
  user_id: string;
  entity_type: 'category' | 'transaction';
  entity_id: string;
  remote_id: string | null;
  deleted_at: string;
  sync_status: 'pending' | 'failed';
  sync_error: string | null;
  revision: number;
};

export const getPendingLocalDeletions = async (userId: string) => {
  const database = await getLocalDb();

  return database.getAllAsync<LocalDeletion>(
    `
      select * from local_deletions
      where user_id = ? and sync_status in ('pending', 'failed')
      order by deleted_at asc, entity_type asc, entity_id asc;
    `,
    userId
  );
};
