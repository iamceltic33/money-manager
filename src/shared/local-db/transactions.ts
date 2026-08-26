import { getLocalDb } from '.';

import type { CreateLocalTransactionParams, LocalTransaction } from './types';

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
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    id,
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

  const transaction = await getLocalTransactionById(id);

  if (!transaction) {
    throw new Error('Не удалось создать локальную операцию');
  }

  return transaction;
}

export async function getLocalTransactionById(id: string) {
  const database = await getLocalDb();

  return database.getFirstAsync<LocalTransaction>(
    `
      select *
      from transactions
      where id = ?;
    `,
    id
  );
}

export async function getLocalTransactions() {
  const database = await getLocalDb();

  return database.getAllAsync<LocalTransaction>(`
    select *
    from transactions
    order by occurred_at desc, created_at desc;
  `);
}

export async function getLocalBalance() {
  const database = await getLocalDb();
  const row = await database.getFirstAsync<BalanceRow>(`
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
    from transactions;
  `);

  return Number(row?.balance ?? 0);
}

export async function getPendingLocalTransactions() {
  const database = await getLocalDb();

  return database.getAllAsync<LocalTransaction>(`
    select *
    from transactions
    where sync_status in ('pending', 'failed')
    order by created_at asc;
  `);
}
