import { getLocalDb } from '@/shared/api/local-db';

import type {
  CreateLocalTransactionParams,
  LocalTransaction,
  UpdateLocalTransactionParams,
} from '../model/types';

type BalanceRow = {
  balance: number | null;
};

function createLocalId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function createLocalTransaction(params: CreateLocalTransactionParams) {
  const database = await getLocalDb();
  const now = new Date().toISOString();
  const id = createLocalId();

  await database.runAsync(
    `
      insert into transactions (
        id,
        user_id,
        remote_id,
        type,
        amount,
        category_id,
        note,
        occurred_at,
        created_at,
        updated_at,
        sync_status,
        sync_error
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    id,
    params.userId,
    null,
    params.type,
    params.amount,
    params.categoryId ?? null,
    params.note ?? null,
    params.occurredAt?.toISOString() ?? now,
    now,
    now,
    'pending',
    null
  );

  const transaction = await getLocalTransactionById(params.userId, id);

  if (!transaction) {
    throw new Error('Не удалось создать локальную операцию');
  }

  return transaction;
}

export async function getLocalTransactionById(userId: string, id: string) {
  const database = await getLocalDb();

  return database.getFirstAsync<LocalTransaction>(
    `
      select *
      from transactions
      where user_id = ? and id = ?;
    `,
    userId,
    id
  );
}

export async function updateLocalTransaction(params: UpdateLocalTransactionParams) {
  const database = await getLocalDb();
  const currentTransaction = await getLocalTransactionById(params.userId, params.id);

  if (!currentTransaction) {
    throw new Error('Локальная операция не найдена');
  }

  await database.runAsync(
    `
      update transactions
      set
        type = ?,
        amount = ?,
        category_id = ?,
        note = ?,
        occurred_at = ?,
        updated_at = ?,
        sync_status = ?,
        sync_error = ?
      where user_id = ? and id = ?;
    `,
    params.type ?? currentTransaction.type,
    params.amount ?? currentTransaction.amount,
    params.categoryId === undefined ? currentTransaction.category_id : params.categoryId,
    params.note === undefined ? currentTransaction.note : params.note,
    params.occurredAt?.toISOString() ?? currentTransaction.occurred_at,
    new Date().toISOString(),
    'pending',
    null,
    params.userId,
    params.id
  );

  const updatedTransaction = await getLocalTransactionById(params.userId, params.id);

  if (!updatedTransaction) {
    throw new Error('Не удалось обновить локальную операцию');
  }

  return updatedTransaction;
}

export async function getLocalTransactions(userId: string) {
  const database = await getLocalDb();

  return database.getAllAsync<LocalTransaction>(
    `
      select *
      from transactions
      where user_id = ?
      order by occurred_at desc, created_at desc;
    `,
    userId
  );
}

export async function getLocalBalance(userId: string) {
  const database = await getLocalDb();
  const row = await database.getFirstAsync<BalanceRow>(
    `
      select coalesce(
        sum(
          case
            when type = 'income' then amount
            when type = 'expense' then -amount
            else 0
          end
        ),
        0
      ) as balance
      from transactions
      where user_id = ?;
    `,
    userId
  );

  return Number(row?.balance ?? 0);
}

export async function getPendingLocalTransactions(userId: string) {
  const database = await getLocalDb();

  return database.getAllAsync<LocalTransaction>(
    `
      select *
      from transactions
      where user_id = ? and sync_status in ('pending', 'failed')
      order by created_at asc;
    `,
    userId
  );
}
