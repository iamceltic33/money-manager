import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { runLocalMigrations } from './migrations';

const DATABASE_NAME = 'money-manager.db';

let databasePromise: Promise<SQLiteDatabase> | null = null;

export function getLocalDb(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      try {
        await runLocalMigrations(database);
        return database;
      } catch (error) {
        await database.closeAsync().catch(() => {});
        throw error;
      }
    }).catch((error) => {
      // A failed open/migration must not poison every subsequent retry.
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}
