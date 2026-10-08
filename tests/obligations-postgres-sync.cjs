// Explicit integration test against the disposable cluster described in docs/synchronization.md.
// Not part of *.test.cjs: requires MM_TEST_PG_SOCKET pointing to /tmp/mm-obligations-pg.*.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { createDatabase, createApis, load } = require('./sync-helpers.cjs');
const { synchronizeDatabase } = load('src/features/sync/api/synchronize-database.ts');
const socket = process.env.MM_TEST_PG_SOCKET;
assert.ok(socket?.startsWith('/tmp/mm-obligations-pg.'), 'Use a disposable PostgreSQL socket in /tmp/mm-obligations-pg.*');
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const sql = statement => execFileSync('psql', ['-h', socket, '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', statement], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
function remoteFor(userId) {
  const run = statement => sql(`begin; set local role authenticated; set local request.jwt.claim.sub = ${quote(userId)}; ${statement}; commit;`);
  const tableNames = ['categories', 'transactions', 'obligations', 'obligation_payments'];
  const ensure = async (table, row) => {
    assert.ok(tableNames.includes(table));
    run(`insert into public.${table} select * from jsonb_populate_record(null::public.${table}, ${quote(JSON.stringify(row))}::jsonb) on conflict (id) do nothing`);
  };
  return {
    initialize: async seed => run(`select public.initialize_account_data(${seed ? 'true' : 'false'})`),
    snapshot: async () => JSON.parse(run('select public.get_sync_snapshot()')),
    upsert: async (table, row) => JSON.parse(run(`select public.apply_sync_change(${quote(table)}, ${quote(JSON.stringify(row))}::jsonb)`)),
    ensureRow: ensure,
    ensureCategory: row => ensure('categories', row),
    remove: async (table, id) => {
      assert.ok(tableNames.includes(table));
      run(table === 'obligations' ? `select public.remove_sync_obligation(${quote(id)})`
        : `delete from public.${table} where id = ${quote(id)} and user_id = ${quote(userId)}`);
    },
  };
}
const fixed = { name: 'Fixed', paymentMode: 'fixed', monthlyAmount: 75, paymentDay: 31, firstPaymentDate: '2026-10-01', lastPaymentDate: '2027-03-31' };
async function fixture(t) {
  const userId = randomUUID();
  sql(`insert into auth.users(id) values (${quote(userId)})`);
  t.after(() => sql(`delete from auth.users where id = ${quote(userId)}`));
  const db = await createDatabase(); t.after(() => db.sql.close());
  const api = createApis(db); const remote = remoteFor(userId);
  const obligation = await api.createLocalObligation({ ...fixed, userId });
  return { db, api, remote, userId, obligation, sync: () => synchronizeDatabase(db, remote, userId) };
}

test('real RPCs exchange a paid schedule and regeneration with shortened term between devices', async t => {
  const f = await fixture(t);
  const expense = await f.api.createLocalTransaction({ userId: f.userId, type: 'expense', amount: 70 });
  const first = (await f.api.getLocalObligationPayments(f.userId))[0];
  await f.api.linkLocalObligationPayment(f.userId, first.id, expense.id);
  await f.sync(); await f.sync();
  const snapshot = await f.remote.snapshot();
  assert.equal(snapshot.obligation_payments.length, 6);
  assert.equal(snapshot.obligation_payments.find(p => p.id === first.id).transaction_id, expense.id);
  const second = await createDatabase(); t.after(() => second.sql.close());
  const api = createApis(second);
  await synchronizeDatabase(second, f.remote, f.userId);
  assert.equal(await api.getLocalBalance(f.userId), -70);
  await api.updateLocalObligation({ ...fixed, userId: f.userId, id: f.obligation.id, monthlyAmount: 90, paymentDay: 15, lastPaymentDate: '2026-12-31' });
  await synchronizeDatabase(second, f.remote, f.userId); await f.sync();
  const payments = await f.api.getLocalObligationPayments(f.userId);
  assert.equal(payments.length, 3);
  assert.equal(payments[0].amount, 75); assert.equal(payments[0].transaction_id, expense.id);
  assert.equal(payments[1].due_date, '2026-11-15'); assert.equal(payments[1].amount, 90);
});

test('real RPCs preserve local priority and atomically delete schedule while retaining actual expenses', async t => {
  const f = await fixture(t); await f.sync();
  const cloud = (await f.remote.snapshot()).obligations[0];
  await f.remote.upsert('obligations', { ...cloud, name: 'Cloud edit' });
  await f.api.updateLocalObligation({ ...fixed, userId: f.userId, id: f.obligation.id, name: 'Local edit' });
  await f.sync();
  assert.equal((await f.remote.snapshot()).obligations[0].name, 'Local edit');
  const payment = (await f.api.getLocalObligationPayments(f.userId))[0];
  const expense = await f.api.createLocalTransaction({ userId: f.userId, type: 'expense', amount: 75 });
  await f.api.linkLocalObligationPayment(f.userId, payment.id, expense.id); await f.sync();
  await f.remote.remove('obligations', f.obligation.id); await f.sync();
  assert.equal((await f.api.getLocalObligations(f.userId)).length, 0);
  assert.equal((await f.api.getLocalObligationPayments(f.userId)).length, 0);
  assert.equal(await f.api.getLocalBalance(f.userId), -75);
});

test('new RPCs isolate owners and cannot overwrite or delete another account schedule', async t => {
  const first = await fixture(t); const second = await fixture(t);
  await first.sync(); await second.sync();
  const own = (await first.remote.snapshot()).obligations[0];
  const foreign = (await second.remote.snapshot()).obligations[0];
  await assert.rejects(first.remote.upsert('obligations', foreign));
  await assert.rejects(first.remote.upsert('obligations', { ...foreign, user_id: first.userId }));
  await first.remote.remove('obligations', foreign.id);
  assert.equal((await second.remote.snapshot()).obligations[0].id, foreign.id);
  assert.equal((await first.remote.snapshot()).obligations[0].id, own.id);
});
