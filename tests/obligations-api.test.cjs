const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createDatabase, createApis, load } = require('./sync-helpers.cjs');
const { generateMonthlyDates, getMonthlyPaymentId } = load('src/entities/obligation/lib/schedule.ts');
const values = { name: 'Loan', paymentMode: 'fixed', monthlyAmount: 75.255, paymentDay: 31, firstPaymentDate: '2026-10-01', lastPaymentDate: '2027-03-31' };
async function fixture(t) {
  const db = await createDatabase(); t.after(() => db.sql.close());
  return { db, api: createApis(db), userId: 'alice' };
}

test('monthly dates preserve 31st across February, leap years and calendar boundaries', async () => {
  assert.deepEqual(Array.from(generateMonthlyDates('2026-12-31', '2027-03-31', 31)), ['2026-12-31', '2027-01-31', '2027-02-28', '2027-03-31']);
  assert.deepEqual(Array.from(generateMonthlyDates('2028-02-01', '2028-03-01', 31)), ['2028-02-29']);
  assert.deepEqual(Array.from(generateMonthlyDates('0004-02-01', '0004-02-29', 31)), ['0004-02-29']);
  assert.deepEqual(Array.from(generateMonthlyDates('2026-10-16', '2026-11-14', 15)), []);
  assert.equal(await getMonthlyPaymentId('ABC', '2026-10-15'), await getMonthlyPaymentId('abc', '2026-10-31'));
  assert.notEqual(await getMonthlyPaymentId('abc', '2026-10-31'), await getMonthlyPaymentId('abc', '2026-11-30'));
  for (const args of [['2026-02-30', '2026-12-31', 31], ['2026-10-01', '2026-09-01', 15], ['2026-10-01', '2026-12-31', 0]]) assert.throws(() => generateMonthlyDates(...args));
});

test('fixed creation is atomic, normalizes amounts and never affects balance', async t => {
  const f = await fixture(t);
  const row = await f.api.createLocalObligation({ ...values, userId: f.userId });
  const payments = await f.api.getLocalObligationPayments(f.userId, row.id);
  assert.equal(payments.length, 6);
  assert.equal(row.monthly_amount, 75.26);
  assert.ok(payments.every(p => p.amount === 75.26 && p.transaction_id === null));
  assert.equal(await f.api.getLocalBalance(f.userId), 0);
  assert.equal((await f.api.getLocalObligations('bob')).length, 0);
  assert.equal(await f.api.getLocalObligationById('bob', row.id), null);
  await assert.rejects(f.api.updateLocalObligation({ ...values, id: row.id, userId: 'bob' }));
  const original = f.db.runAsync;
  f.db.runAsync = async (query, ...args) => {
    if (query.includes('insert into obligation_payments')) throw new Error('disk failure');
    return original(query, ...args);
  };
  await assert.rejects(f.api.createLocalObligation({ ...values, userId: f.userId }), /disk failure/);
  f.db.runAsync = original;
  assert.equal((await f.api.getLocalObligations(f.userId)).length, 1);
});

test('regeneration retains paid months and rolls back attempts to exclude a paid date', async t => {
  const f = await fixture(t);
  const row = await f.api.createLocalObligation({ ...values, userId: f.userId });
  const original = await f.api.getLocalObligationPayments(f.userId, row.id);
  const expense = await f.api.createLocalTransaction({ userId: f.userId, type: 'expense', amount: 75 });
  await f.api.linkLocalObligationPayment(f.userId, original[0].id, expense.id);
  await f.api.updateLocalObligation({ ...values, userId: f.userId, id: row.id, monthlyAmount: 90, paymentDay: 15 });
  const changed = await f.api.getLocalObligationPayments(f.userId, row.id);
  assert.equal(changed.length, 6);
  assert.equal(changed[0].id, original[0].id);
  assert.equal(changed[0].amount, 75.26);
  assert.equal(changed[0].due_date, '2026-10-31');
  assert.equal(changed[1].id, original[1].id);
  assert.equal(changed[1].amount, 90);
  assert.equal(changed[1].due_date, '2026-11-15');
  await assert.rejects(f.api.updateLocalObligation({ ...values, userId: f.userId, id: row.id, firstPaymentDate: '2026-11-01' }));
  assert.deepEqual(await f.api.getLocalObligationPayments(f.userId, row.id), changed);
  await assert.rejects(f.api.deleteLocalObligation(f.userId, row.id), /оплаченными/);
});

test('manual payments retain varying amounts; paid edits, duplicate months and foreign links are rejected', async t => {
  const f = await fixture(t);
  const row = await f.api.createLocalObligation({ userId: f.userId, name: 'Variable', paymentMode: 'manual', firstPaymentDate: '2026-10-01', lastPaymentDate: '2027-03-31' });
  assert.equal((await f.api.getLocalObligationPayments(f.userId, row.id)).length, 0);
  const oct = await f.api.createLocalObligationPayment({ userId: f.userId, obligationId: row.id, dueDate: '2026-10-10', amount: 50 });
  await f.api.createLocalObligationPayment({ userId: f.userId, obligationId: row.id, dueDate: '2026-11-10', amount: 120 });
  await assert.rejects(f.api.createLocalObligationPayment({ userId: f.userId, obligationId: row.id, dueDate: '2026-10-20', amount: 75 }));
  await assert.rejects(f.api.createLocalObligationPayment({ userId: 'bob', obligationId: row.id, dueDate: '2026-12-10', amount: 75 }));
  await f.api.updateLocalObligationPayment({ userId: f.userId, id: oct.id, dueDate: '2026-10-15', amount: 55 });
  const foreign = await f.api.createLocalTransaction({ userId: 'bob', type: 'expense', amount: 55 });
  await assert.rejects(f.api.linkLocalObligationPayment(f.userId, oct.id, foreign.id));
  const own = await f.api.createLocalTransaction({ userId: f.userId, type: 'expense', amount: 55 });
  await f.api.linkLocalObligationPayment(f.userId, oct.id, own.id);
  await assert.rejects(f.api.updateLocalObligationPayment({ userId: f.userId, id: oct.id, dueDate: '2026-10-16', amount: 56 }), /Оплаченный/);
  await f.api.linkLocalObligationPayment(f.userId, oct.id, null);
  await f.api.deleteLocalObligationPayment(f.userId, oct.id);
  assert.equal((await f.api.getLocalObligationPayments(f.userId, row.id)).length, 1);
  await f.api.deleteLocalObligation(f.userId, row.id);
  assert.equal((await f.api.getLocalObligations(f.userId)).length, 0);
  assert.equal(await f.api.getLocalBalance(f.userId), -55);
  assert.ok((await f.db.getAllAsync('select * from local_deletions;')).some(d => d.entity_type === 'obligation'));
});

test('a failed schedule transaction cannot roll back a concurrent ordinary expense', async t => {
  const f = await fixture(t);
  const original = f.db.runAsync;
  f.db.runAsync = async (query, ...args) => {
    if (query.includes('insert into obligation_payments')) throw new Error('schedule failed');
    return original(query, ...args);
  };
  const results = await Promise.allSettled([
    f.api.createLocalObligation({ ...values, userId: f.userId }),
    f.api.createLocalTransaction({ userId: f.userId, type: 'expense', amount: 25 }),
  ]);
  f.db.runAsync = original;
  assert.equal(results[0].status, 'rejected');
  assert.equal(results[1].status, 'fulfilled');
  assert.equal(await f.api.getLocalBalance(f.userId), -25);
  assert.equal((await f.api.getLocalObligations(f.userId)).length, 0);
});

test('expense and selected payment commit atomically; stale, paid, foreign and income links roll back', async t => {
  const { api, userId } = await fixture(t);
  const parent = await api.createLocalObligation({ ...values, userId });
  const [first, second] = await api.getLocalObligationPayments(userId, parent.id);
  const expense = await api.createLocalTransaction({ userId, type: 'expense', amount: 80, excludeFromAverage: true, obligationPaymentId: first.id });
  assert.equal((await api.getLocalObligationPayments(userId))[0].transaction_id, expense.id);
  assert.equal(expense.amount, 80);
  assert.equal(expense.exclude_from_average, 1);
  assert.equal(first.amount, 75.26);
  for (const params of [
    { userId, type: 'expense', amount: 900, obligationPaymentId: first.id },
    { userId, type: 'expense', amount: 900, obligationPaymentId: 'removed' },
    { userId: 'bob', type: 'expense', amount: 900, obligationPaymentId: second.id },
    { userId, type: 'income', amount: 900, obligationPaymentId: second.id },
  ]) await assert.rejects(api.createLocalTransaction(params));
  assert.equal(await api.getLocalBalance(userId), -80);
  assert.equal(await api.getLocalBalance('bob'), 0);
  await api.updateLocalTransaction({ userId, id: expense.id, amount: 85, obligationPaymentId: second.id });
  let payments = await api.getLocalObligationPayments(userId);
  assert.equal(payments[0].transaction_id, null);
  assert.equal(payments[1].transaction_id, expense.id);
  await assert.rejects(api.updateLocalTransaction({ userId, id: expense.id, amount: 1000, obligationPaymentId: 'removed' }));
  assert.equal((await api.getLocalTransactionById(userId, expense.id)).amount, 85);
  assert.equal((await api.getLocalObligationPayments(userId))[1].transaction_id, expense.id);
  // Existing API callers preserve linkage and the original forecast exclusion flag.
  await api.updateLocalTransaction({ userId, id: expense.id, note: 'Updated' });
  assert.equal((await api.getLocalObligationPayments(userId))[1].transaction_id, expense.id);
  assert.equal((await api.getLocalTransactionById(userId, expense.id)).exclude_from_average, 1);
  await api.updateLocalTransaction({ userId, id: expense.id, obligationPaymentId: null });
  payments = await api.getLocalObligationPayments(userId);
  assert.ok(payments.every(row => row.transaction_id === null));
  assert.equal(await api.getLocalBalance(userId), -85);
});

test('rejected payment transfer retains both original links and amounts', async t => {
  const { api, userId } = await fixture(t);
  const parent = await api.createLocalObligation({ ...values, userId });
  const [first, second] = await api.getLocalObligationPayments(userId, parent.id);
  const a = await api.createLocalTransaction({ userId, type: 'expense', amount: 75, obligationPaymentId: first.id });
  const b = await api.createLocalTransaction({ userId, type: 'expense', amount: 90, obligationPaymentId: second.id });
  await assert.rejects(api.updateLocalTransaction({ userId, id: a.id, amount: 500, obligationPaymentId: second.id }), /другим расходом/);
  const rows = await api.getLocalObligationPayments(userId);
  assert.equal(rows[0].transaction_id, a.id);
  assert.equal(rows[1].transaction_id, b.id);
  assert.equal(await api.getLocalBalance(userId), -165);
});
