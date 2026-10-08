import { getLocalDb } from '@/shared/api/local-db';
import { runLocalWrite } from '@/shared/api/local-db/write-coordinator';
import type { LocalTransaction } from '@/entities/transaction';
import type { LocalCategory } from '@/entities/category';
import type { LocalObligation, LocalObligationPayment } from '@/entities/obligation';

export async function loadForecastData(userId: string) {
  if (!userId) throw new Error('Пользователь не выбран');
  const db = await getLocalDb();
  // Share the write queue so sync and expense/link edits cannot split the snapshot.
  return runLocalWrite(async () => {
    const history = await db.getAllAsync<LocalTransaction>('select * from transactions where user_id = ?;', userId);
    const categories = await db.getAllAsync<LocalCategory>('select * from categories where user_id = ?;', userId);
    const obligations = await db.getAllAsync<LocalObligation>('select * from obligations where user_id = ?;', userId);
    const payments = await db.getAllAsync<LocalObligationPayment>('select * from obligation_payments where user_id = ?;', userId);
    const row = await db.getFirstAsync<{ balance: number }>("select coalesce(sum(case when type = 'income' then amount else -amount end), 0) as balance from transactions where user_id = ?;", userId);
    return { history, categories, obligations, payments, balance: row?.balance ?? 0 };
  });
}
