import { getLocalDb } from '@/shared/api/local-db';

export type ExpenseReportRow = { categoryId: string | null; amount: number; count: number };

export async function getLocalExpenseReport(userId: string, start: Date, endExclusive: Date) {
  if (!userId || !Number.isFinite(start.getTime()) || !Number.isFinite(endExclusive.getTime()) || start >= endExclusive) {
    throw new Error('Некорректный период отчёта');
  }
  const database = await getLocalDb();
  // Aggregate the complete period in SQLite, independently of history pagination.
  return database.getAllAsync<ExpenseReportRow>(`
    select category_id as categoryId, sum(amount) as amount, count(*) as count
    from transactions
    where user_id = ? and type = 'expense' and occurred_at >= ? and occurred_at < ?
    group by category_id
    order by amount desc, category_id asc;
  `, userId, start.toISOString(), endExclusive.toISOString());
}
