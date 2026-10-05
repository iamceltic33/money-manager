const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./sync-helpers.cjs');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function fixture() {
  const state = { userId: 'alice', revision: 1 };
  const values = [];
  let cursor = 0, previous, effect, cleanup;
  const { useTransactionResource: runResource } = load('src/entities/transaction/model/use-transaction-resource.ts', {
    './transactions-store': { useTransactionsStore: selector => selector(state) },
    '@/entities/category': { useCategoryStore: selector => selector({ categories: [] }) },
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in values)) values[index] = initial;
        return [values[index], value => { values[index] = typeof value === 'function' ? value(values[index]) : value; }];
      },
      useEffect(callback, deps) {
        if (!previous || deps.some((value, i) => value !== previous[i])) {
          previous = deps; effect = callback;
        }
      },
    },
  });
  return {
    state,
    render(query, enabled = true, refreshOnChanges = true) {
      cursor = 0;
      const result = runResource(query, enabled, refreshOnChanges);
      if (effect) { const next = effect; effect = null; cleanup?.(); cleanup = next(); }
      return result;
    },
  };
}

test('resource never shows previous ID/account/revision data or late responses', async () => {
  const f = fixture();
  const a = deferred(), b = deferred(), c = deferred();
  const loadA = () => a.promise, loadB = () => b.promise, loadC = () => c.promise;
  assert.equal(f.render(loadA).loading, true);
  assert.equal(f.render(loadB).data, undefined);
  a.resolve({ id: 'a' }); await flush();
  assert.equal(f.render(loadB).loading, true);
  b.resolve({ id: 'b' }); await flush();
  assert.equal(f.render(loadB).data.id, 'b');
  f.state.revision++;
  assert.equal(f.render(loadC).data, undefined);
  f.state.userId = 'bob';
  assert.equal(f.render(loadC).data, undefined);
  c.resolve({ id: 'c' }); await flush();
  assert.equal(f.render(loadC).data.id, 'c');
});

test('resource defers full history until forecast is focused and supports read retry', async () => {
  const f = fixture();
  let calls = 0;
  const read = async () => { calls++; if (calls === 1) throw new Error('read failed'); return []; };
  f.render(read, false);
  assert.equal(calls, 0);
  f.render(read, true); await flush();
  const error = f.render(read, true);
  assert.equal(error.error, true);
  assert.equal(error.loading, false);
  error.retry();
  assert.equal(f.render(read, true).loading, true); await flush();
  assert.equal(f.render(read, true).data.length, 0);
  assert.equal(calls, 2);
});


test('editing snapshot survives background refresh without losing account isolation', async () => {
  const f = fixture();
  let calls = 0;
  const read = async userId => { calls++; return { id: 'editing', userId }; };
  f.render(read, true, false); await flush();
  assert.equal(f.render(read, true, false).data.userId, 'alice');
  f.state.revision++;
  assert.equal(f.render(read, true, false).loading, false);
  assert.equal(calls, 1);
  f.state.userId = 'bob';
  assert.equal(f.render(read, true, false).data, undefined); await flush();
  assert.equal(f.render(read, true, false).data.userId, 'bob');
});
