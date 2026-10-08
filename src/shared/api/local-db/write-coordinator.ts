import type { SQLiteDatabase } from 'expo-sqlite';

let previousWrite: Promise<unknown> = Promise.resolve();

// Never hold this queue across network calls. It also protects multi-statement web transactions.
export function runLocalWrite<T>(action: () => Promise<T>): Promise<T> {
  const result = previousWrite.catch(() => {}).then(action);
  previousWrite = result;
  return result;
}

export function withLocalTransaction<T>(database: SQLiteDatabase, action: (db: SQLiteDatabase) => Promise<T>) {
  return runLocalWrite(async () => {
    let result!: T;
    await database.withTransactionAsync(async () => { result = await action(database); });
    return result;
  });
}
