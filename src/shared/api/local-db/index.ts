import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { runLocalMigrations } from './migrations';

const DATABASE_NAME = 'money-manager.db';

let databasePromise: Promise<SQLiteDatabase> | null = null;

export function getLocalDb(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      await runLocalMigrations(database);
      return database;
    });
  }

  return databasePromise;
}
