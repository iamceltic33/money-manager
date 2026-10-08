const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createDatabase, createApis, load } = require('./sync-helpers.cjs');
const { runLocalMigrations } = load('src/shared/api/local-db/migrations.ts');
const timestamp = '2026-10-05T12:00:00.000Z';

async function fixture(t) {
  const db = await createDatabase();
  t.after(() => db.sql.close());
  const api = createApis(db);
  const category = await api.createLocalCategory({ userId: 'alice', type: 'expense', name: 'Кредит' });
  const foreignCategory = await api.createLocalCategory({ userId: 'bob', type: 'expense', name: 'Кредит' });
  const incomeCategory = await api.createLocalCategory({ userId: 'alice', type: 'income', name: 'Зарплата' });
  const expense = await api.createLocalTransaction({ userId: 'alice', type: 'expense', amount: 75, categoryId: category.id });
  const income = await api.createLocalTransaction({ userId: 'alice', type: 'income', amount: 200 });
  const foreignExpense = await api.createLocalTransaction({ userId: 'bob', type: 'expense', amount: 75 });
  const obligation = async (id, overrides = {}) => {
    const value = { user: 'alice', category: category.id, mode: 'fixed', amount: 75, day: 31,
      start: '2026-10-01', end: '2027-03-31', ...overrides };
    return db.runAsync(`insert into obligations
      (id, user_id, name, category_id, payment_mode, monthly_amount, payment_day, first_payment_date, last_payment_date, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`, id, value.user, id, value.category, value.mode,
    value.amount, value.day, value.start, value.end, timestamp, timestamp);
  };
  const payment = (id, overrides = {}) => {
    const value = { user: 'alice', obligation: 'loan', due: '2026-10-31', amount: 75, transaction: null, ...overrides };
    return db.runAsync(`insert into obligation_payments
      (id, user_id, obligation_id, due_date, amount, transaction_id, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?);`, id, value.user, value.obligation, value.due, value.amount, value.transaction, timestamp, timestamp);
  };
  return { db, api, category, foreignCategory, incomeCategory, expense, income, foreignExpense, obligation, payment };
}

async function resetToV9(db) {
  const triggers = await db.getAllAsync(`select name from sqlite_master where type = 'trigger'
    and (tbl_name in ('obligations', 'obligation_payments') or name in
      ('categories_guard_obligations', 'transactions_guard_obligation_payments',
       'categories_detach_obligations', 'transactions_detach_obligation_payments'));`);
  for (const row of triggers) await db.execAsync(`drop trigger ${row.name};`);
  await db.execAsync('drop table obligation_payments; drop table obligations; PRAGMA user_version = 9;');
}

test('v9 upgrade preserves every old row, balance and queue; new schema is repeatable', async t => {
  const f = await fixture(t);
  await f.api.deleteLocalTransaction({ userId: 'bob', id: f.foreignExpense.id });
  await resetToV9(f.db);
  await f.db.runAsync('insert into local_users (id, created_at, initialized_at) values (?, ?, ?), (?, ?, ?);',
    'alice', timestamp, timestamp, 'bob', timestamp, timestamp);
  const snapshot = async () => {
    const result = {};
    for (const table of ['categories', 'transactions', 'local_users', 'local_deletions']) {
      result[table] = await f.db.getAllAsync(`select * from ${table} order by rowid;`);
    }
    return result;
  };
  const before = await snapshot();
  const balance = await f.api.getLocalBalance('alice');
  await runLocalMigrations(f.db);
  await runLocalMigrations(f.db);
  assert.equal((await f.db.getFirstAsync('PRAGMA user_version;')).user_version, 11);
  assert.deepEqual(await snapshot(), before);
  await f.obligation('loan');
  await f.payment('october');
  assert.equal(await f.api.getLocalBalance('alice'), balance);
  assert.equal((await f.db.getAllAsync('PRAGMA foreign_key_check;')).length, 0);
});

test('failed schema migration rolls back tables, triggers and version and can retry', async t => {
  const f = await fixture(t);
  await resetToV9(f.db);
  const exec = f.db.execAsync;
  f.db.execAsync = async query => {
    await exec(query);
    if (query.includes('create table if not exists obligations')) throw new Error('simulated interruption');
  };
  await assert.rejects(runLocalMigrations(f.db), /simulated interruption/);
  assert.equal((await f.db.getFirstAsync('PRAGMA user_version;')).user_version, 9);
  assert.equal(await f.db.getFirstAsync("select name from sqlite_master where name = 'obligations';"), null);
  f.db.execAsync = exec;
  await runLocalMigrations(f.db);
  assert.equal((await f.db.getFirstAsync('PRAGMA user_version;')).user_version, 11);
});

test('fixed/manual modes and real calendar dates reject invalid amounts and ranges', async t => {
  const f = await fixture(t);
  await f.obligation('loan');
  await f.obligation('manual', { mode: 'manual', amount: null, day: null });
  await f.payment('oct', { obligation: 'manual', amount: 80.25 });
  await f.payment('nov', { obligation: 'manual', due: '2026-11-15', amount: 110 });
  await f.payment('dec', { obligation: 'manual', due: '2026-12-15', amount: 95 });
  for (const overrides of [{ amount: null }, { amount: 0 }, { amount: -1 }, { amount: Infinity },
    { day: null }, { day: 0 }, { day: 32 }, { day: 1.5 }, { mode: 'manual' },
    { start: '2026-02-30' }, { start: '2026-2-01' }, { start: 'invalid' },
    { start: '0000-01-01' }, { end: '2026-09-30' }]) {
    await assert.rejects(f.obligation('invalid', overrides));
  }
  await f.obligation('leap', { start: '2028-02-29', end: '2028-03-31' });
  for (const overrides of [{ amount: 0 }, { amount: -1 }, { due: '2026-11-31' },
    { due: '2026-09-30' }, { due: '2027-04-01' }, { obligation: 'missing' }]) {
    await assert.rejects(f.payment('invalid', overrides));
  }
  await assert.rejects(f.payment('duplicate-month', { obligation: 'manual', due: '2026-10-01' }));
  await assert.rejects(f.db.runAsync("update obligations set last_payment_date = '2026-11-01' where id = 'manual';"));
});

test('links isolate accounts and allow only one actual expense per payment', async t => {
  const f = await fixture(t);
  for (const category of [f.foreignCategory.id, f.incomeCategory.id, 'missing']) {
    await assert.rejects(f.obligation('invalid', { category }));
  }
  await f.obligation('loan');
  await assert.rejects(f.payment('foreign', { user: 'bob' }));
  for (const transaction of [f.income.id, f.foreignExpense.id, 'missing']) {
    await assert.rejects(f.payment('invalid', { transaction }));
  }
  await f.payment('october', { transaction: f.expense.id });
  await assert.rejects(f.payment('november', { due: '2026-11-30', transaction: f.expense.id }));
  await assert.rejects(f.db.runAsync("update transactions set type = 'income' where id = ?;", f.expense.id));
  await assert.rejects(f.db.runAsync("update transactions set user_id = 'bob' where id = ?;", f.expense.id));
  await assert.rejects(f.db.runAsync("update categories set type = 'income' where id = ?;", f.category.id));
  await assert.rejects(f.db.runAsync("update categories set user_id = 'bob' where id = ?;", f.category.id));
  await assert.rejects(f.db.runAsync("update obligations set user_id = 'bob' where id = 'loan';"));
  await assert.rejects(f.db.runAsync("update obligation_payments set user_id = 'bob' where id = 'october';"));
  await assert.rejects(f.db.runAsync("delete from obligations where id = 'loan';"));
});

test('deleting expense reopens plan; deleting category retains obligation and expense history', async t => {
  const f = await fixture(t);
  await f.obligation('loan');
  await f.payment('october', { transaction: f.expense.id });
  await f.db.execAsync("update obligations set sync_status = 'synced'; update obligation_payments set sync_status = 'synced';");
  await f.api.deleteLocalCategory('alice', f.category.id);
  const obligation = await f.db.getFirstAsync("select * from obligations where id = 'loan';");
  assert.equal(obligation.category_id, null);
  assert.equal(obligation.sync_status, 'pending');
  assert.equal(obligation.local_revision, 1);
  assert.equal((await f.api.getLocalTransactionById('alice', f.expense.id)).category_id, null);
  await f.api.deleteLocalTransaction({ userId: 'alice', id: f.expense.id });
  const payment = await f.db.getFirstAsync("select * from obligation_payments where id = 'october';");
  assert.equal(payment.transaction_id, null);
  assert.equal(payment.amount, 75);
  assert.equal(payment.sync_status, 'pending');
  assert.equal(payment.local_revision, 1);
  assert.equal((await f.db.getAllAsync('PRAGMA foreign_key_check;')).length, 0);
});
