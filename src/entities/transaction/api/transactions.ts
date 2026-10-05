import { randomUUID } from 'expo-crypto';

import { getLocalDb } from '@/shared/api/local-db';

import { normalizeTransactionAmount } from '../lib';

import type {
  CreateLocalTransactionParams,
  DeleteLocalTransactionParams,
  LocalTransaction,
  GetLocalTransactionPageParams,
  LocalTransactionPage,
  UpdateLocalTransactionParams,
} from '../model/types';

type BalanceRow = {
  balance: number | null;
};

export async function createLocalTransaction(params: CreateLocalTransactionParams) {
  const database = await getLocalDb();
  const now = new Date().toISOString();
  const id = randomUUID();
  const amount = normalizeTransactionAmount(params.amount);

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
        sync_error,
        exclude_from_average
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    id,
    params.userId,
    null,
    params.type,
    amount,
    params.categoryId ?? null,
    params.note ?? null,
    params.occurredAt?.toISOString() ?? now,
    now,
    now,
    'pending',
    null,
    params.excludeFromAverage ? 1 : 0
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

  const amount = params.amount === undefined
    ? currentTransaction.amount
    : normalizeTransactionAmount(params.amount);

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
        sync_error = ?,
        exclude_from_average = ?
      where user_id = ? and id = ?;
    `,
    params.type ?? currentTransaction.type,
    amount,
    params.categoryId === undefined ? currentTransaction.category_id : params.categoryId,
    params.note === undefined ? currentTransaction.note : params.note,
    params.occurredAt?.toISOString() ?? currentTransaction.occurred_at,
    new Date().toISOString(),
    'pending',
    null,
    params.excludeFromAverage === undefined
      ? currentTransaction.exclude_from_average
      : params.excludeFromAverage ? 1 : 0,
    params.userId,
    params.id
  );

  const updatedTransaction = await getLocalTransactionById(params.userId, params.id);

  if (!updatedTransaction) {
    throw new Error('Не удалось обновить локальную операцию');
  }

  return updatedTransaction;
}

export async function deleteLocalTransaction(params: DeleteLocalTransactionParams) {
  const database = await getLocalDb();
  const currentTransaction = await getLocalTransactionById(params.userId, params.id);

  if (!currentTransaction) {
    throw new Error('Локальная операция не найдена');
  }

  await database.runAsync(
    `
      delete from transactions
      where user_id = ? and id = ?;
    `,
    params.userId,
    params.id
  );
}

export async function getLocalTransactions(userId: string) {
  const database = await getLocalDb();

  return database.getAllAsync<LocalTransaction>(
    `
      select *
      from transactions
      where user_id = ?
      order by occurred_at desc, created_at desc, id desc;
    `,
    userId
  );
}

export async function getLocalTransactionsPage({
  userId,
  limit = 40,
  cursor,
  filters = {},
}: GetLocalTransactionPageParams): Promise<LocalTransactionPage> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new Error('Размер страницы должен быть целым числом от 1 до 200');
  }
  if (!userId) throw new Error('Пользователь не выбран');

  const conditions = ['user_id = ?'];
  const bindings: (string | number)[] = [userId];

  if (filters.type != null) {
    conditions.push('type = ?');
    bindings.push(filters.type);
  }
  if (filters.categoryIds?.length) {
    const ids = [...new Set(filters.categoryIds)];
    conditions.push(`category_id in (${ids.map(() => '?').join(', ')})`);
    bindings.push(...ids);
  }
  if (filters.dateFrom) {
    conditions.push('occurred_at >= ?');
    bindings.push(filters.dateFrom.toISOString());
  }
  if (filters.dateTo) {
    conditions.push('occurred_at <= ?');
    bindings.push(filters.dateTo.toISOString());
  }
  if (cursor) {
    conditions.push('(occurred_at, created_at, id) < (?, ?, ?)');
    bindings.push(cursor.occurredAt, cursor.createdAt, cursor.id);
  }

  const database = await getLocalDb();
  // One extra row determines the end without a separate count query.
  const rows = await database.getAllAsync<LocalTransaction>(`
    select * from transactions
    where ${conditions.join(' and ')}
    order by occurred_at desc, created_at desc, id desc
    limit ?;
  `, ...bindings, limit + 1);
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];

  return {
    items,
    hasMore,
    nextCursor: hasMore && last ? {
      occurredAt: last.occurred_at,
      createdAt: last.created_at,
      id: last.id,
    } : null,
  };
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
