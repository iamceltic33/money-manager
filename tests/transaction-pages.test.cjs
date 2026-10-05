const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createDatabase, createApis, load } = require('./sync-helpers.cjs');

async function fixture(count = 125) {
  const database = await createDatabase();
  const api = createApis(database);
  const category = await api.createLocalCategory({ userId: 'alice', name: 'Еда', type: 'expense' });
  const sameDate = '2026-09-28T12:00:00.000Z';
  for (let i = 0; i < count; i++) {
    await database.runAsync(`insert into transactions
      (id, user_id, type, amount, category_id, occurred_at, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?);`,
    `id-${String(i).padStart(4, '0')}`, 'alice', i % 2 ? 'income' : 'expense', i + 1,
    i % 2 ? null : category.id, sameDate, sameDate, sameDate);
  }
  await api.createLocalTransaction({ userId: 'bob', type: 'income', amount: 999 });
  return { database, api, category, sameDate };
}

async function collect(api, filters, limit = 17) {
  const items = [];
  let cursor = null;
  for (let pageNumber = 0; pageNumber < 100; pageNumber++) {
    const page = await api.getLocalTransactionsPage({ userId: 'alice', filters, limit, cursor });
    assert.ok(page.items.length <= limit);
    assert.equal(page.hasMore, page.nextCursor !== null);
    items.push(...page.items);
    if (!page.hasMore) return items;
    cursor = page.nextCursor;
  }
  throw new Error('Pagination did not terminate');
}

test('ties are ordered by ID and pages contain every account row exactly once', async t => {
  const f = await fixture(); t.after(() => f.database.sql.close());
  const items = await collect(f.api);
  assert.equal(items.length, 125);
  assert.equal(new Set(items.map(row => row.id)).size, 125);
  assert.deepEqual(items.map(row => row.id), Array.from({ length: 125 }, (_, i) => `id-${String(124 - i).padStart(4, '0')}`));
  assert.ok(items.every(row => row.user_id === 'alice'));
  const first = await f.api.getLocalTransactionsPage({ userId: 'alice' });
  assert.equal(first.items.length, 40);
  assert.equal(first.hasMore, true);
  // Details are available outside the loaded page and never leak another account.
  assert.equal((await f.api.getLocalTransactionById('alice', 'id-0000')).amount, 1);
  assert.equal(await f.api.getLocalTransactionById('bob', 'id-0000'), null);
  const balance = await f.api.getLocalBalance('alice');
  await f.api.getLocalTransactionsPage({ userId: 'alice', limit: 1, filters: { type: 'income' } });
  assert.equal(await f.api.getLocalBalance('alice'), balance);
  assert.equal((await f.api.getLocalTransactions('alice')).length, 125);
});

test('type, categories and inclusive date boundaries filter before the page limit', async t => {
  const f = await fixture(90); t.after(() => f.database.sql.close());
  const boundary = new Date(f.sameDate);
  const filters = { type: 'expense', categoryIds: [f.category.id, f.category.id], dateFrom: boundary, dateTo: boundary };
  const items = await collect(f.api, filters);
  assert.equal(items.length, 45);
  assert.ok(items.every(row => row.type === 'expense' && row.category_id === f.category.id));
  assert.equal((await collect(f.api, { dateFrom: new Date(boundary.getTime() + 1) })).length, 0);
  assert.equal((await collect(f.api, { dateTo: new Date(boundary.getTime() - 1) })).length, 0);
  assert.equal((await collect(f.api, { categoryIds: ["' OR 1=1 --"] })).length, 0);
  assert.equal((await collect(f.api, { type: 'income', categoryIds: [] })).length, 45);
});

test('empty, short and exact-size pages terminate without an extra request', async t => {
  const f = await fixture(4); t.after(() => f.database.sql.close());
  for (const limit of [4, 10]) {
    const page = await f.api.getLocalTransactionsPage({ userId: 'alice', limit });
    assert.equal(page.items.length, 4);
    assert.equal(page.hasMore, false);
    assert.equal(page.nextCursor, null);
  }
  assert.equal((await f.api.getLocalTransactionsPage({ userId: 'nobody' })).items.length, 0);
  for (const limit of [0, -1, 1.5, 201, Infinity, NaN]) {
    await assert.rejects(f.api.getLocalTransactionsPage({ userId: 'alice', limit }));
  }
});

test('cursor still works after its row is deleted and new rows are inserted ahead', async t => {
  const f = await fixture(5); t.after(() => f.database.sql.close());
  const first = await f.api.getLocalTransactionsPage({ userId: 'alice', limit: 2 });
  await f.api.deleteLocalTransaction({ userId: 'alice', id: first.nextCursor.id });
  await f.api.createLocalTransaction({ userId: 'alice', type: 'income', amount: 10, occurredAt: new Date('2026-10-01T00:00:00.000Z') });
  const next = await f.api.getLocalTransactionsPage({ userId: 'alice', limit: 3, cursor: first.nextCursor });
  assert.deepEqual(next.items.map(row => row.id), ['id-0002', 'id-0001', 'id-0000']);
  assert.equal(next.hasMore, false);
});

test('v8 upgrade preserves records, is repeatable and uses index for cursor order', async t => {
  const f = await fixture(); t.after(() => f.database.sql.close());
  const before = await f.api.getLocalTransactions('alice');
  await f.database.execAsync('drop index transactions_user_page_idx; PRAGMA user_version = 8;');
  const { runLocalMigrations } = load('src/shared/api/local-db/migrations.ts');
  await runLocalMigrations(f.database);
  await runLocalMigrations(f.database);
  assert.equal((await f.database.getFirstAsync('PRAGMA user_version;')).user_version, 9);
  assert.deepEqual(await f.api.getLocalTransactions('alice'), before);
  const plan = await f.database.getAllAsync(`explain query plan select * from transactions
    where user_id = ? and (occurred_at, created_at, id) < (?, ?, ?)
    order by occurred_at desc, created_at desc, id desc limit ?;`,
  'alice', f.sameDate, f.sameDate, 'id-0100', 41);
  assert.ok(plan.some(row => row.detail.includes('transactions_user_page_idx')));
  assert.ok(plan.every(row => !row.detail.includes('TEMP B-TREE')));
});
