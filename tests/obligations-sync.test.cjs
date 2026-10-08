const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { createDatabase, createApis, createRemote, load } = require('./sync-helpers.cjs');
const { synchronizeDatabase } = load('src/features/sync/api/synchronize-database.ts');
const fixed = { name: 'Fixed', paymentMode: 'fixed', monthlyAmount: 75, paymentDay: 31, firstPaymentDate: '2026-10-01', lastPaymentDate: '2027-03-31' };
async function fixture(t) {
  const db = await createDatabase(); t.after(() => db.sql.close());
  const userId = randomUUID(); const api = createApis(db); const remote = createRemote(userId);
  const category = await api.createLocalCategory({ userId, name: 'Loan', type: 'expense' });
  const obligation = await api.createLocalObligation({ ...fixed, userId, categoryId: category.id });
  return { db, api, userId, category, obligation, remote, sync: () => synchronizeDatabase(db, remote, userId) };
}

test('two devices exchange schedules and payment links without duplicating months or changing balance', async t => {
  const f = await fixture(t);
  const payments = await f.api.getLocalObligationPayments(f.userId);
  const expense = await f.api.createLocalTransaction({ userId: f.userId, type: 'expense', amount: 70, categoryId: f.category.id });
  await f.api.linkLocalObligationPayment(f.userId, payments[0].id, expense.id);
  await f.sync(); await f.sync();
  assert.equal(f.remote.state.obligations.size, 1);
  assert.equal(f.remote.state.obligation_payments.size, 6);
  const second = await createDatabase(); t.after(() => second.sql.close());
  await synchronizeDatabase(second, f.remote, f.userId);
  const api = createApis(second);
  assert.equal((await api.getLocalObligationPayments(f.userId))[0].transaction_id, expense.id);
  assert.equal(await api.getLocalBalance(f.userId), -70);
  await api.updateLocalObligation({ ...fixed, userId: f.userId, id: f.obligation.id, categoryId: f.category.id, monthlyAmount: 90, paymentDay: 15 });
  await synchronizeDatabase(second, f.remote, f.userId); await f.sync();
  const changed = await f.api.getLocalObligationPayments(f.userId);
  assert.equal(changed.length, 6);
  assert.equal(changed[0].amount, 75); assert.equal(changed[0].transaction_id, expense.id);
  assert.equal(changed[1].amount, 90); assert.equal(changed[1].due_date, '2026-11-15');
  assert.equal(f.db.sql.prepare('select count(*) as n from local_deletions').get().n, 0);
});

test('schedule rebuilt during payment upload is not acknowledged as the previous generation', async t => {
  const f = await fixture(t); let changed = false;
  f.remote.afterUpsert = async table => {
    if (table !== 'obligation_payments' || changed) return;
    changed = true;
    await f.api.updateLocalObligation({ ...fixed, userId: f.userId, id: f.obligation.id, monthlyAmount: 100 });
  };
  await f.sync();
  assert.ok([...f.remote.state.obligation_payments.values()].every(row => row.amount === 100));
  assert.ok((await f.api.getLocalObligationPayments(f.userId)).every(row => row.amount === 100 && row.sync_status === 'synced'));
});

test('deletion during upload and retries do not resurrect schedules', async t => {
  const f = await fixture(t); let removed = false;
  f.remote.afterUpsert = async table => {
    if (table !== 'obligation_payments' || removed) return;
    removed = true; await f.api.deleteLocalObligation(f.userId, f.obligation.id);
  };
  await f.sync(); await f.sync();
  assert.equal(f.remote.state.obligations.size, 0); assert.equal(f.remote.state.obligation_payments.size, 0);
  assert.equal((await f.api.getLocalObligations(f.userId)).length, 0);
  assert.equal(f.db.sql.prepare('select count(*) as n from local_deletions').get().n, 0);
});

test('lost response retries and local edits restore remotely deleted parents and paid expenses', async t => {
  const f = await fixture(t); let failed = false;
  f.remote.afterUpsert = async table => { if (table === 'obligation_payments' && !failed) { failed = true; throw new Error('lost'); } };
  await assert.rejects(f.sync, /lost/); await f.sync();
  assert.equal(f.remote.state.obligation_payments.size, 6);
  await f.remote.remove('obligations', f.obligation.id);
  await f.api.updateLocalObligation({ ...fixed, userId: f.userId, id: f.obligation.id, monthlyAmount: 110 });
  await f.sync();
  assert.equal(f.remote.state.obligations.size, 1); assert.equal(f.remote.state.obligation_payments.size, 6);
  const payment = (await f.api.getLocalObligationPayments(f.userId))[0];
  const expense = await f.api.createLocalTransaction({ userId: f.userId, type: 'expense', amount: 110 });
  await f.api.linkLocalObligationPayment(f.userId, payment.id, expense.id); await f.sync();
  await f.remote.remove('transactions', expense.id);
  await f.api.linkLocalObligationPayment(f.userId, payment.id, expense.id); await f.sync();
  assert.equal(f.remote.state.transactions.has(expense.id), true);
  assert.equal(f.remote.state.obligation_payments.get(payment.id).transaction_id, expense.id);
});

test('remote deletion removes clean schedules without deletion echo', async t => {
  const f = await fixture(t); await f.sync();
  await f.remote.remove('obligations', f.obligation.id); await f.sync();
  assert.equal((await f.api.getLocalObligations(f.userId)).length, 0);
  assert.equal((await f.api.getLocalObligationPayments(f.userId)).length, 0);
  assert.equal(f.db.sql.prepare('select count(*) as n from local_deletions').get().n, 0);
});

test('old server remains usable for ordinary data but cannot erase or acknowledge schedules', async t => {
  const f = await fixture(t);
  const snapshot = f.remote.snapshot;
  f.remote.snapshot = async () => { const value = await snapshot(); delete value.obligations; delete value.obligation_payments; return value; };
  await assert.rejects(f.sync, /миграции Supabase/);
  assert.equal((await f.api.getLocalObligationPayments(f.userId)).length, 6);
  assert.equal((await f.api.getLocalObligations(f.userId))[0].sync_status, 'pending');
  await f.api.deleteLocalObligation(f.userId, f.obligation.id);
  // Queue also requires server support before any deletion can be acknowledged.
  await assert.rejects(f.sync, /миграции Supabase/);
  const second = await createDatabase(); t.after(() => second.sql.close());
  const api = createApis(second);
  await api.createLocalTransaction({ userId: f.userId, type: 'income', amount: 10 });
  await synchronizeDatabase(second, f.remote, f.userId);
  assert.equal(await api.getLocalBalance(f.userId), 10);
});

test('dirty payment after snapshot survives parent deletion and invalid snapshot rolls back all local changes', async t => {
  const f = await fixture(t);
  const manual = await f.api.createLocalObligation({ userId: f.userId, name: 'Manual', paymentMode: 'manual', firstPaymentDate: '2026-10-01', lastPaymentDate: '2026-12-31' });
  const row = await f.api.createLocalObligationPayment({ userId: f.userId, obligationId: manual.id, dueDate: '2026-10-10', amount: 10 });
  await f.sync();
  await f.remote.remove('obligations', manual.id);
  let edited = false;
  f.remote.afterSnapshot = async () => {
    if (edited) return; edited = true;
    await f.api.updateLocalObligationPayment({ userId: f.userId, id: row.id, dueDate: row.due_date, amount: 20 });
  };
  await f.sync();
  assert.equal((await f.api.getLocalObligationPayments(f.userId, manual.id))[0].amount, 20);
  f.remote.afterSnapshot = null; await f.sync();
  assert.equal(f.remote.state.obligation_payments.get(row.id).amount, 20);
  const before = await f.api.getLocalObligationPayments(f.userId);
  const bad = f.remote.state.obligation_payments.get(row.id);
  bad.obligation_id = 'missing';
  await assert.rejects(f.sync, /связи платежей/);
  assert.deepEqual(await f.api.getLocalObligationPayments(f.userId), before);
});

test('foreign snapshots and unrelated accounts never enter the local schedule', async t => {
  const f = await fixture(t);
  const other = randomUUID();
  const row = await f.api.createLocalObligation({ ...fixed, userId: other });
  await f.sync();
  assert.equal(f.remote.state.obligations.has(row.id), false);
  const local = await f.api.getLocalObligationPayments(f.userId);
  f.remote.state.obligation_payments.get(local[0].id).user_id = other;
  await assert.rejects(f.sync, /аккаунта/);
  assert.deepEqual(await f.api.getLocalObligationPayments(f.userId), local);
});
