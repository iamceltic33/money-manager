const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, createDatabase, createApis } = require('./sync-helpers.cjs');
const { getFundsDepletionForecast: forecast } = load('src/pages/forecasts/model/get-funds-depletion-forecast.ts', {
  '@/shared/utils/forecast-calculations': load('src/shared/utils/forecast-calculations.ts'),
});
const { forecastWeeks, forecastWeekCount, depletionDays, calendarDay } = load('src/pages/forecasts/model/payment-forecast.ts');
const now = () => new Date(2026, 9, 7, 12);
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const history = () => Array.from({ length: 7 }, (_, index) => ({ id: `tx${index}`, type: 'expense', amount: 10, category_id: null, exclude_from_average: 0, occurred_at: new Date(2026, 9, index + 1, 12).toISOString() }));
const payment = (id, date, amount, transaction_id = null) => ({ id, obligation_id: 'loan', due_date: date, amount, transaction_id });
const params = (extra = {}) => ({ history: history(), categories: [], balance: 1000, now: now(), ...extra });

test('payments today, last day and next-week boundary occur once; overdue payments are carried into today', () => {
  const payments = [payment('old', '2026-09-01', 5), payment('today', '2026-10-07', 10), payment('end', '2026-10-13', 20), payment('next', '2026-10-14', 30), payment('paid', '2026-10-07', 900, 'actual')];
  const rows = forecastWeeks(1000, 70, payments, now(), 3);
  assert.deepEqual(Array.from(rows, row => row.paymentExpense), [35, 30, 0]);
  assert.deepEqual(Array.from(rows, row => row.remainingBalance), [895, 795, 725]);
  assert.equal(dateKey(rows[0].start), '2026-10-07');
  assert.equal(dateKey(rows[0].end), '2026-10-13');
  assert.equal(rows[0].payments[0].overdue, true);
});

test('linked actual expenses are excluded from ordinary average without affecting the availability gate or balance', () => {
  const rows = history(); rows[6].amount = 600;
  const paid = payment('paid', '2026-10-07', 500, 'tx6');
  const result = forecast(params({ history: rows, payments: [paid] }));
  assert.equal(result.averageWeeklyExpense, 60);
  assert.equal(forecast(params({ history: rows })).averageWeeklyExpense, 660);
  assert.equal(rows[6].exclude_from_average, 0);
  const excluded = forecast(params({ history: rows, payments: [paid], categories: [{ id: 'exclude', exclude_from_average: 1 }], }));
  assert.equal(excluded.averageWeeklyExpense, 60);
});

test('depletion is on the payment date and uses ordinary spending before that date', () => {
  const payments = [payment('big', '2026-10-10', 80)];
  assert.equal(dateKey(forecast(params({ balance: 100, payments })).estimatedDate), '2026-10-10');
  assert.equal(depletionDays(20, 10, payments, now()), 2);
  assert.equal(depletionDays(100, 10, [payment('small', '2026-10-10', 20)], now()), 8);
  assert.equal(depletionDays(100, 0, [payment('late', '2026-11-15', 100)], now()), 39);
});

test('zero ordinary average allows payment-only prediction; exact zero is distinguished from negative balance', () => {
  const rows = history().map(row => ({ ...row, exclude_from_average: 1 }));
  const payments = [payment('one', '2026-10-14', 100)];
  const result = forecast(params({ history: rows, balance: 100, payments }));
  assert.equal(result.averageWeeklyExpense, 0);
  assert.equal(dateKey(result.estimatedDate), '2026-10-14');
  assert.equal(forecastWeekCount(100, 0, payments, now()), 2);
  assert.equal(forecastWeekCount(99, 0, payments, now()), 2);
  assert.equal(forecastWeekCount(100, 70, [], now()), 2);
  assert.equal(forecastWeekCount(140, 70, [], now()), 3);
  assert.equal(forecastWeekCount(0, 0, [], now()), 0);
  assert.equal(forecast(params({ history: rows, balance: 101, payments })).estimatedDate, null);
  assert.equal(forecastWeekCount(101, 0, payments, now()), 2);
});

test('incomplete history retains unavailable ordinary forecast but known payment schedule remains usable', () => {
  const payments = [payment('manual', '2026-10-15', 200), payment('other-month', '2026-12-15', 300)];
  const result = forecast(params({ history: history().slice(0, 6), payments }));
  assert.equal(result.averageWeeklyExpense, undefined);
  assert.match(result.unavailableMessage, /6 из 7/);
  const rows = forecastWeeks(1000, 0, payments, now(), 11);
  assert.equal(rows.reduce((sum, row) => sum + row.paymentExpense, 0), 500);
  assert.equal(rows[5].paymentExpense, 0); // No invented November payment.
});

test('existing category/transaction exclusions, weekly recalculation and no-obligation forecasts stay intact', () => {
  const rows = history(); rows[0].category_id = 'excluded'; rows[1].exclude_from_average = 1;
  assert.equal(forecast(params({ history: rows, categories: [{ id: 'excluded', exclude_from_average: 1 }] })).averageWeeklyExpense, 50);
  assert.equal(forecast(params()).averageWeeklyExpense, 70);
  assert.equal(dateKey(forecast(params()).estimatedDate), '2027-01-15');
  assert.equal(forecast(params({ now: new Date(2026, 9, 13, 12) })).averageWeeklyExpense, 70);
  assert.equal(forecast(params({ now: new Date(2026, 9, 14, 12) })).averageWeeklyExpense, 35);
  assert.match(forecast(params({ balance: 0 })).unavailableMessage, /исчерпан/);
});

test('calendar weeks remain seven local dates across DST, year boundary and leap February', () => {
  const oldTZ = process.env.TZ;
  try {
    for (const timezone of ['Asia/Almaty', 'America/New_York', 'UTC']) {
      process.env.TZ = timezone;
      for (const start of [new Date(2026, 9, 30, 12), new Date(2026, 11, 28, 12), new Date(2028, 1, 25, 12)]) {
        const boundary = new Date(start); boundary.setDate(boundary.getDate() + 7);
        const rows = forecastWeeks(1000, 0, [payment('boundary', dateKey(boundary), 10)], start, 2);
        assert.equal(rows[0].paymentExpense, 0);
        assert.equal(rows[1].paymentExpense, 10);
        assert.equal(calendarDay(rows[0].end) - calendarDay(rows[0].start), 6);
      }
    }
  } finally { if (oldTZ === undefined) delete process.env.TZ; else process.env.TZ = oldTZ; }
});

test('forecast snapshot isolates accounts and reflects payment links, unlinking and deleting actual expenses', async t => {
  const db = await createDatabase(); t.after(() => db.sql.close());
  const api = createApis(db);
  const { loadForecastData } = load('src/pages/forecasts/model/load-forecast-data.ts', { '@/shared/api/local-db': { getLocalDb: async () => db } });
  for (const row of history()) await api.createLocalTransaction({ userId: 'alice', type: 'expense', amount: row.amount, occurredAt: new Date(row.occurred_at) });
  await api.createLocalTransaction({ userId: 'alice', type: 'income', amount: 1000 });
  await api.createLocalTransaction({ userId: 'bob', type: 'expense', amount: 99999 });
  const parent = await api.createLocalObligation({ userId: 'alice', name: 'Loan', paymentMode: 'fixed', monthlyAmount: 100, paymentDay: 10, firstPaymentDate: '2026-10-01', lastPaymentDate: '2026-10-31' });
  const [scheduled] = await api.getLocalObligationPayments('alice', parent.id);
  const expense = await api.createLocalTransaction({ userId: 'alice', type: 'expense', amount: 100, occurredAt: now(), obligationPaymentId: scheduled.id });
  const linked = await loadForecastData('alice');
  assert.equal(linked.balance, 830);
  assert.equal(forecast({ ...linked, now: now() }).averageWeeklyExpense, 70);
  assert.equal(forecastWeeks(linked.balance, 70, linked.payments, now(), 1)[0].paymentExpense, 0);
  assert.equal((await loadForecastData('bob')).payments.length, 0);
  await api.updateLocalTransaction({ userId: 'alice', id: expense.id, obligationPaymentId: null });
  const unlinked = await loadForecastData('alice');
  assert.equal(forecast({ ...unlinked, now: now() }).averageWeeklyExpense, 170);
  assert.equal(forecastWeeks(unlinked.balance, 170, unlinked.payments, now(), 1)[0].paymentExpense, 100);
  await api.updateLocalTransaction({ userId: 'alice', id: expense.id, obligationPaymentId: scheduled.id });
  await api.deleteLocalTransaction({ userId: 'alice', id: expense.id });
  const deleted = await loadForecastData('alice');
  assert.equal(deleted.balance, 930);
  assert.equal(deleted.payments[0].transaction_id, null);
  assert.equal(forecast({ ...deleted, now: now() }).averageWeeklyExpense, 70);
});


test('decimal floating-point noise does not turn exact-zero balance into debt or shift depletion by one day', () => {
  assert.equal(forecastWeekCount(0.3, 0.1, [], now()), 4);
  assert.equal(forecastWeeks(0.3, 0.1, [], now(), 3)[2].remainingBalance, 0);
  assert.equal(depletionDays(0.1 + 0.2, 0.1, [], now()), 3);
  assert.equal(depletionDays(0.3, 0, [payment('a', '2026-10-07', 0.1), payment('b', '2026-10-08', 0.2)], now()), 1);
});
