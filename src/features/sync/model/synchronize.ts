import { getLocalDb } from '@/shared/api/local-db';
import { supabase } from '@/shared/api/supabase';

import { createSyncRemote } from '../api/remote';
import { synchronizeDatabase } from '../api/synchronize-database';
import { useSyncStore } from './sync-store';

const runs = new Map<string, Promise<void>>();
let previousRun: Promise<void> = Promise.resolve();

export const synchronize = (userId: string): Promise<void> => {
  const active = runs.get(userId);
  if (active) return active;

  useSyncStore.getState().setActive(userId, true);

  const run = previousRun.catch(() => {}).then(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session?.user.id !== userId) throw new Error('Аккаунт изменился. Повторите синхронизацию');

    const database = await getLocalDb();
    const remote = createSyncRemote(userId, data.session.access_token);
    await synchronizeDatabase(database, remote, userId);
  }).finally(() => {
    runs.delete(userId);
    useSyncStore.getState().setActive(userId, false);
  });

  runs.set(userId, run);
  previousRun = run;
  return run;
};
