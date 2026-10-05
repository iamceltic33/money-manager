const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, createDatabase, createApis } = require('./sync-helpers.cjs');

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const row = id => ({ id, occurred_at: '2026-10-01', created_at: '2026-10-01' });
const page = (ids, hasMore = false) => ({ items: ids.map(row), hasMore, nextCursor: hasMore ? { occurredAt: '2026-10-01', createdAt: '2026-10-01', id: ids.at(-1) } : null });
function setup() {
  const requests = [];
  const { createTransactionPagesStore } = load('src/entities/transaction/model/transaction-pages-store.ts', {
    '../api/transactions': { getLocalTransactionsPage: params => {
      const request = { ...deferred(), params }; requests.push(request); return request.promise;
    } },
  });
  return { store: createTransactionPagesStore(), requests };
}
const query = (revision = 1, userId = 'alice', filters = {}) => ({ userId, revision, filters });

test('repeated end events share one request; duplicates are removed; end stops requests', async () => {
  const { store, requests } = setup();
  store.getState().configure(query());
  store.getState().configure(query());
  void store.getState().loadMore();
  assert.equal(requests.length, 1);
  requests[0].resolve(page(['a', 'b'], true)); await flush();
  void store.getState().loadMore(); void store.getState().loadMore();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].params.cursor.id, 'b');
  requests[1].resolve(page(['b', 'c'])); await flush();
  assert.deepEqual([...store.getState().items.map(item => item.id)], ['a', 'b', 'c']);
  await store.getState().loadMore(); assert.equal(requests.length, 2);
});

test('filter change, revision and account switch discard outdated answers', async () => {
  const { store, requests } = setup();
  store.getState().configure(query());
  store.getState().configure(query(1, 'alice', { type: 'expense' }));
  requests[0].resolve(page(['old'])); await flush();
  assert.equal(store.getState().items.length, 0);
  assert.equal(store.getState().loading, true);
  requests[1].resolve(page(['expense'])); await flush();
  store.getState().configure(query(2, 'alice', { type: 'expense' }));
  assert.equal(store.getState().items.length, 0);
  store.getState().configure(query(3, 'bob'));
  requests[2].resolve(page(['alice'])); await flush();
  requests[3].resolve(page(['bob'])); await flush();
  assert.deepEqual([...store.getState().items.map(item => item.id)], ['bob']);
});

test('failure retains rows and cursor; automatic retry waits for explicit action', async () => {
  const { store, requests } = setup();
  store.getState().configure(query());
  requests[0].resolve(page(['a'], true)); await flush();
  void store.getState().loadMore();
  requests[1].reject(new Error('read failed')); await flush();
  assert.equal(store.getState().error, true);
  assert.equal(store.getState().items.length, 1);
  await store.getState().loadMore(); assert.equal(requests.length, 2);
  void store.getState().loadMore(true);
  assert.equal(requests[2].params.cursor.id, 'a');
  requests[2].resolve(page(['b'])); await flush();
  assert.equal(store.getState().error, false);
  assert.equal(store.getState().items.length, 2);
});

test('summary only keeps twenty rows, balance covers all, CRUD and refresh invalidate lists', async t => {
  const database = await createDatabase(); t.after(() => database.sql.close());
  const api = createApis(database);
  for (let i = 0; i < 55; i++) await api.createLocalTransaction({ userId: 'alice', type: 'income', amount: 10 });
  let fullReads = 0;
  const { useTransactionsStore } = load('src/entities/transaction/model/transactions-store.ts', {
    '../api/transactions': { ...api, getLocalTransactions: async () => { fullReads++; return []; } },
    '@/shared/model/toast-store': { showErrorToast() {} },
  });
  const state = () => useTransactionsStore.getState();
  await state().init('alice');
  assert.equal(state().balance, 550);
  assert.equal(state().recentTransactions.length, 20);
  const initialRevision = state().revision;
  await state().createTransaction(5, 'expense');
  assert.equal(state().balance, 545);
  assert.equal(state().revision, initialRevision + 1);
  const id = state().recentTransactions[0].id;
  await state().updateTransaction({ id, amount: 7 });
  assert.equal(state().revision, initialRevision + 2);
  await state().deleteTransaction(id);
  assert.equal(state().revision, initialRevision + 3);
  await state().refresh();
  assert.equal(state().revision, initialRevision + 4);
  assert.equal(fullReads, 0);
  assert.equal((await api.getLocalTransactions('alice')).length, 55);
});

test('data invalidation reloads the previously visited range, not only first page', async () => {
  const { store, requests } = setup();
  const ids = Array.from({ length: 40 }, (_, i) => `first-${i}`);
  const more = Array.from({ length: 40 }, (_, i) => `second-${i}`);
  store.getState().configure(query());
  requests[0].resolve(page(ids, true)); await flush();
  void store.getState().loadMore();
  requests[1].resolve(page(more, true)); await flush();
  assert.equal(store.getState().items.length, 80);
  store.getState().configure(query(2));
  requests[2].resolve(page(ids, true)); await flush();
  assert.equal(requests.length, 4);
  assert.equal(store.getState().loading, true);
  requests[3].resolve(page(more, true)); await flush();
  assert.equal(store.getState().items.length, 80);
  assert.equal(store.getState().loading, false);
  store.getState().configure(query(2, 'alice', { type: 'income' }));
  requests[4].resolve(page(ids, true)); await flush();
  assert.equal(requests.length, 5);
  assert.equal(store.getState().items.length, 40);
});
