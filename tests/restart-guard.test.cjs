const assert = require('node:assert/strict');
const test = require('node:test');
const { load } = require('./sync-helpers.cjs');

const makeGuard = () => load('src/shared/model/restart-guard.ts');

test('restart waits for all concurrent tasks, rejects duplicate restart and new writes', () => {
  const guard = makeGuard();
  const save = guard.beginAppTask();
  const sync = guard.beginAppTask();
  assert.equal(guard.tryBeginRestart(), false);
  save();
  save(); // completing the same task twice must not release another task
  assert.equal(guard.tryBeginRestart(), false);
  sync();
  assert.equal(guard.tryBeginRestart(), true);
  assert.equal(guard.tryBeginRestart(), false);
  assert.throws(() => guard.beginAppTask());
  guard.cancelRestart();
  const retry = guard.beginAppTask();
  retry();
  assert.equal(guard.tryBeginRestart(), true);
});

test('transaction saving holds guard through summary refresh and releases it after failure', async () => {
  const guard = makeGuard();
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  let fail = false;
  const { useTransactionsStore } = load('src/entities/transaction/model/transactions-store.ts', {
    '@/shared/model/restart-guard': guard,
    '@/shared/model/toast-store': { showErrorToast: () => {} },
    '../api/transactions': {
      createLocalTransaction: async () => { if (fail) throw new Error('write failed'); },
      getLocalBalance: async () => 100,
      getLocalTransactionsPage: async () => { await waiting; return { items: [] }; },
    },
  });
  useTransactionsStore.setState({ userId: 'test' });
  const saving = useTransactionsStore.getState().createTransaction(100, 'income');
  await Promise.resolve();
  assert.equal(guard.tryBeginRestart(), false);
  release();
  await saving;
  assert.equal(guard.useRestartGuard.getState().activeTasks, 0);
  fail = true;
  await assert.rejects(useTransactionsStore.getState().createTransaction(100, 'income'));
  assert.equal(guard.tryBeginRestart(), true);
});
