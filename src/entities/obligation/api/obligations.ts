import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getLocalDb } from '@/shared/api/local-db';
import { runLocalWrite, withLocalTransaction } from '@/shared/api/local-db/write-coordinator';
import { beginAppTask } from '@/shared/model/restart-guard';
import { normalizeTransactionAmount } from '@/entities/transaction/lib/amount';
import { generateMonthlyDates, getMonthlyPaymentId, parseCalendarDate } from '../lib/schedule';
import type { CalendarDate, LocalObligation, LocalObligationPayment } from '../model/types';

export type ObligationValues = {
  name: string;
  categoryId?: string | null;
  firstPaymentDate: CalendarDate;
  lastPaymentDate: CalendarDate;
} & (
  | { paymentMode: 'fixed'; monthlyAmount: number; paymentDay: number }
  | { paymentMode: 'manual'; monthlyAmount?: never; paymentDay?: never }
);

function requireUser(userId: string) {
  if (!userId.trim()) throw new Error('Пользователь не выбран');
}
function amount(value: number) {
  const normalized = normalizeTransactionAmount(value);
  if (normalized <= 0 || normalized > 999999999999.99) throw new Error('Некорректная сумма платежа');
  return normalized;
}
async function mutate<T>(action: (db: SQLiteDatabase) => Promise<T>) {
  const finish = beginAppTask();
  try { return await withLocalTransaction(await getLocalDb(), action); } finally { finish(); }
}
async function obligation(db: SQLiteDatabase, userId: string, id: string) {
  requireUser(userId);
  const row = await db.getFirstAsync<LocalObligation>('select * from obligations where user_id = ? and id = ?;', userId, id);
  if (!row) throw new Error('Обязательство не найдено');
  return row;
}
async function payment(db: SQLiteDatabase, userId: string, id: string) {
  requireUser(userId);
  const row = await db.getFirstAsync<LocalObligationPayment>('select * from obligation_payments where user_id = ? and id = ?;', userId, id);
  if (!row) throw new Error('Платёж не найден');
  return row;
}
function validateValues(values: ObligationValues) {
  if (!values.name.trim()) throw new Error('Укажите название обязательства');
  parseCalendarDate(values.firstPaymentDate);
  parseCalendarDate(values.lastPaymentDate);
  if (values.firstPaymentDate > values.lastPaymentDate) throw new Error('Начало срока позже окончания');
  if (values.paymentMode === 'fixed') {
    amount(values.monthlyAmount);
    const dates = generateMonthlyDates(values.firstPaymentDate, values.lastPaymentDate, values.paymentDay);
    if (!dates.length) throw new Error('В выбранном сроке нет даты платежа');
  } else if (values.paymentMode !== 'manual' || values.monthlyAmount != null || values.paymentDay != null) {
    throw new Error('Некорректный режим платежей');
  }
}
async function touchParent(db: SQLiteDatabase, userId: string, id: string) {
  await db.runAsync("update obligations set updated_at = ?, sync_status = 'pending', sync_error = null where user_id = ? and id = ?;", new Date().toISOString(), userId, id);
}
async function insertPayment(db: SQLiteDatabase, userId: string, obligationId: string, dueDate: CalendarDate, value: number) {
  parseCalendarDate(dueDate);
  const id = await getMonthlyPaymentId(obligationId, dueDate);
  const now = new Date().toISOString();
  await db.runAsync(`insert into obligation_payments (id, user_id, obligation_id, due_date, amount, created_at, updated_at)
    values (?, ?, ?, ?, ?, ?, ?);`, id, userId, obligationId, dueDate, amount(value), now, now);
  return payment(db, userId, id);
}
async function buildFixedSchedule(db: SQLiteDatabase, row: LocalObligation) {
  if (row.payment_mode !== 'fixed') return;
  const paid = await db.getAllAsync<{ month: string }>(
    'select substr(due_date, 1, 7) as month from obligation_payments where user_id = ? and obligation_id = ? and transaction_id is not null;', row.user_id, row.id);
  const paidMonths = new Set(paid.map(item => item.month));
  for (const date of generateMonthlyDates(row.first_payment_date, row.last_payment_date, row.payment_day)) {
    if (!paidMonths.has(date.slice(0, 7))) await insertPayment(db, row.user_id, row.id, date, row.monthly_amount);
  }
}

export async function getLocalObligations(userId: string) {
  requireUser(userId);
  const db = await getLocalDb();
  return runLocalWrite(() => db.getAllAsync<LocalObligation>('select * from obligations where user_id = ? order by first_payment_date, name, id;', userId));
}
export async function getLocalObligationById(userId: string, id: string) {
  requireUser(userId);
  const db = await getLocalDb();
  return runLocalWrite(() => db.getFirstAsync<LocalObligation>('select * from obligations where user_id = ? and id = ?;', userId, id));
}
export async function getLocalObligationPayments(userId: string, obligationId?: string) {
  requireUser(userId);
  const db = await getLocalDb();
  return runLocalWrite(() => db.getAllAsync<LocalObligationPayment>(
    `select * from obligation_payments where user_id = ? ${obligationId ? 'and obligation_id = ?' : ''} order by due_date, id;`,
    ...(obligationId ? [userId, obligationId] : [userId])));
}
export async function createLocalObligation(params: ObligationValues & { userId: string }) {
  requireUser(params.userId); validateValues(params);
  return mutate(async db => {
    const id = randomUUID(); const now = new Date().toISOString();
    await db.runAsync(`insert into obligations (id, user_id, name, category_id, payment_mode, monthly_amount, payment_day,
      first_payment_date, last_payment_date, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    id, params.userId, params.name.trim(), params.categoryId ?? null, params.paymentMode,
    params.paymentMode === 'fixed' ? amount(params.monthlyAmount) : null,
    params.paymentMode === 'fixed' ? params.paymentDay : null, params.firstPaymentDate, params.lastPaymentDate, now, now);
    const row = await obligation(db, params.userId, id);
    await buildFixedSchedule(db, row);
    return row;
  });
}
export async function updateLocalObligation(params: ObligationValues & { userId: string; id: string }) {
  requireUser(params.userId); validateValues(params);
  return mutate(async db => {
    const old = await obligation(db, params.userId, params.id);
    const scheduleChanged = old.payment_mode !== params.paymentMode
      || old.first_payment_date !== params.firstPaymentDate || old.last_payment_date !== params.lastPaymentDate
      || old.monthly_amount !== (params.paymentMode === 'fixed' ? amount(params.monthlyAmount) : null)
      || old.payment_day !== (params.paymentMode === 'fixed' ? params.paymentDay : null);
    // Changing modes would otherwise silently destroy manually entered future amounts.
    if (old.payment_mode !== params.paymentMode) throw new Error('Изменение режима существующего обязательства пока не поддерживается');
    if (scheduleChanged && old.payment_mode === 'fixed') {
      await db.runAsync('delete from obligation_payments where user_id = ? and obligation_id = ? and transaction_id is null;', params.userId, params.id);
    }
    // Paid dates (and all manual dates) remain protected by the schema range constraint.
    await db.runAsync(`update obligations set name = ?, category_id = ?, payment_mode = ?, monthly_amount = ?, payment_day = ?,
      first_payment_date = ?, last_payment_date = ?, updated_at = ?, sync_status = 'pending', sync_error = null where user_id = ? and id = ?;`,
    params.name.trim(), params.categoryId === undefined ? old.category_id : params.categoryId, params.paymentMode,
    params.paymentMode === 'fixed' ? amount(params.monthlyAmount) : null, params.paymentMode === 'fixed' ? params.paymentDay : null,
    params.firstPaymentDate, params.lastPaymentDate, new Date().toISOString(), params.userId, params.id);
    const row = await obligation(db, params.userId, params.id);
    if (scheduleChanged && row.payment_mode === 'fixed') await buildFixedSchedule(db, row);
    return row;
  });
}
export async function deleteLocalObligation(userId: string, id: string) {
  return mutate(async db => {
    await obligation(db, userId, id);
    // A paid schedule is financial history: only explicit archival should hide it later.
    if (await db.getFirstAsync('select id from obligation_payments where user_id = ? and obligation_id = ? and transaction_id is not null;', userId, id)) {
      throw new Error('Нельзя удалить обязательство с оплаченными платежами');
    }
    await db.runAsync('delete from obligation_payments where user_id = ? and obligation_id = ?;', userId, id);
    await db.runAsync('delete from obligations where user_id = ? and id = ?;', userId, id);
  });
}
export async function createLocalObligationPayment(params: { userId: string; obligationId: string; dueDate: CalendarDate; amount: number }) {
  return mutate(async db => {
    const parent = await obligation(db, params.userId, params.obligationId);
    if (parent.payment_mode !== 'manual') throw new Error('Ручное добавление доступно для платежей с разными суммами');
    const row = await insertPayment(db, params.userId, params.obligationId, params.dueDate, params.amount);
    await touchParent(db, params.userId, params.obligationId);
    return row;
  });
}
export async function updateLocalObligationPayment(params: { userId: string; id: string; dueDate: CalendarDate; amount: number }) {
  return mutate(async db => {
    const row = await payment(db, params.userId, params.id);
    if (row.transaction_id) throw new Error('Оплаченный платёж нельзя менять');
    if ((await obligation(db, params.userId, row.obligation_id)).payment_mode !== 'manual') throw new Error('Измените расписание фиксированного обязательства');
    parseCalendarDate(params.dueDate);
    if (row.due_date.slice(0, 7) !== params.dueDate.slice(0, 7)) throw new Error('Для другого месяца добавьте отдельный платёж');
    await db.runAsync("update obligation_payments set due_date = ?, amount = ?, updated_at = ?, sync_status = 'pending', sync_error = null where user_id = ? and id = ?;",
      params.dueDate, amount(params.amount), new Date().toISOString(), params.userId, params.id);
    await touchParent(db, params.userId, row.obligation_id);
    return payment(db, params.userId, params.id);
  });
}
export async function deleteLocalObligationPayment(userId: string, id: string) {
  return mutate(async db => {
    const row = await payment(db, userId, id);
    if (row.transaction_id) throw new Error('Оплаченный платёж нельзя удалить');
    await db.runAsync('delete from obligation_payments where user_id = ? and id = ?;', userId, id);
    await touchParent(db, userId, row.obligation_id);
  });
}
export async function linkLocalObligationPayment(userId: string, id: string, transactionId: string | null) {
  return mutate(async db => {
    const row = await payment(db, userId, id);
    if (row.transaction_id && transactionId && row.transaction_id !== transactionId) throw new Error('Сначала отвяжите предыдущий расход');
    await db.runAsync("update obligation_payments set transaction_id = ?, updated_at = ?, sync_status = 'pending', sync_error = null where user_id = ? and id = ?;",
      transactionId, new Date().toISOString(), userId, id);
    await touchParent(db, userId, row.obligation_id);
    if (transactionId) await db.runAsync("update transactions set updated_at = ?, sync_status = 'pending', sync_error = null where user_id = ? and id = ?;", new Date().toISOString(), userId, transactionId);
    return payment(db, userId, id);
  });
}
