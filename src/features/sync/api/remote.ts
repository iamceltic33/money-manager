import { createClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/shared/api/supabase/database.types';

import type { CloudRow, SyncRemote, SyncSnapshot } from './types';

export const createSyncRemote = (userId: string, accessToken: string): SyncRemote => {
  // Сессия закреплена за запуском: смена аккаунта не меняет владельца запросов в полёте.
  const client = createClient<Database>(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_KEY!,
    {
      accessToken: async () => accessToken,
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }
  );

  return {
    initialize: async (seedDefaults) => {
      const { error } = await client.rpc('initialize_account_data', { seed_defaults: seedDefaults })
        .abortSignal(AbortSignal.timeout(20000));
      if (error) throw new Error(error.message);
    },
    snapshot: async () => {
      const { data, error } = await client.rpc('get_sync_snapshot')
        .abortSignal(AbortSignal.timeout(20000));
      if (error) throw new Error(error.message);
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Не удалось получить снимок данных');
      }
      return data as unknown as SyncSnapshot;
    },
    upsert: async (table, row, expectedUpdatedAt) => {
      if (row.user_id !== userId) throw new Error('Неверный владелец записи');
      const { data, error } = await client.rpc('apply_sync_change', {
        entity_type: table,
        payload: row as unknown as Json,
        expected_updated_at: expectedUpdatedAt ?? undefined,
      }).abortSignal(AbortSignal.timeout(20000));
      if (error) throw new Error(error.message);
      return data as unknown as CloudRow;
    },
    remove: async (table, id) => {
      const { error } = await client.from(table).delete().eq('user_id', userId).eq('id', id)
        .abortSignal(AbortSignal.timeout(20000));
      if (error) throw new Error(error.message);
    },
  };
};
