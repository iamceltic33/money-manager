const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function setup(path, overrides) {
  const values = [];
  let cursor = 0;
  let effect;
  let previousDeps;
  let cleanup;
  let hides = 0;
  const jsx = (type, props, key) => ({ type, props, key });
  const exports = {};
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = initial;
      return [values[index], value => { values[index] = typeof value === 'function' ? value(values[index]) : value; }];
    },
    useEffect(callback, deps) {
      if (!previousDeps || deps.some((value, i) => value !== previousDeps[i])) {
        previousDeps = deps;
        effect = callback;
      }
    },
  };
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports,
    require(name) {
      if (name in overrides) return overrides[name];
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react-native') return { View: 'View' };
      if (name === 'expo-splash-screen') return { hide: () => { hides++; } };
      if (name === '@/shared/ui/startup-screen') return { StartupScreen: 'StartupScreen' };
      if (name === '@/shared/model/toast-store') return { showErrorToast() {} };
      throw new Error(name);
    },
  });
  const Component = Object.values(exports)[0];
  return {
    render() {
      cursor = 0;
      const tree = Component({ children: 'app' });
      if (effect) { const next = effect; effect = null; cleanup?.(); cleanup = next(); }
      return tree;
    },
    get hides() { return hides; },
  };
}

function local() {
  const auth = { session: { user: { id: 'a' } } };
  const authStore = selector => selector(auth);
  authStore.getState = () => auth;
  const categories = { initialized: false, userId: 'a', init: async () => {}, refresh: async () => {} };
  const transactions = { ...categories };
  let syncCalls = 0;
  const sync = deferred();
  const harness = setup('src/core/providers/local-data-provider.tsx', {
    '@/features/auth': { useAuthStore: authStore },
    '@/entities/category': { useCategoryStore: { getState: () => categories } },
    '@/entities/transaction': { useTransactionsStore: { getState: () => transactions } },
    '@/features/sync': { synchronize: () => { syncCalls++; return sync.promise; } },
  });
  return { harness, auth, categories, transactions, get syncCalls() { return syncCalls; } };
}

test('waits for both local stores, then shows app without waiting for network', async () => {
  const state = local();
  const pending = deferred();
  state.categories.init = async () => { state.categories.initialized = true; };
  state.transactions.init = async () => { await pending.promise; state.transactions.initialized = true; };
  let tree = state.harness.render();
  tree.props.onLayout();
  await flush();
  assert.equal(state.harness.render().props.children.type, 'StartupScreen');
  assert.equal(state.harness.hides, 0);
  pending.resolve();
  await flush();
  tree = state.harness.render();
  assert.equal(tree.props.children, 'app');
  tree.props.onLayout();
  assert.equal(state.harness.hides, 1);
  assert.equal(state.syncCalls, 1);
});

test('resolved but failed init shows retry; retry succeeds', async () => {
  const state = local();
  state.harness.render();
  await flush();
  let tree = state.harness.render();
  assert.equal(tree.key, 'error');
  tree.props.onLayout();
  assert.equal(state.harness.hides, 1);
  assert.equal(state.syncCalls, 0);
  state.categories.init = async () => { state.categories.initialized = true; };
  state.transactions.init = async () => { state.transactions.initialized = true; };
  tree.props.children.props.onRetry();
  assert.equal(state.harness.render().key, 'loading');
  await flush();
  assert.equal(state.harness.render().props.children, 'app');
});

test('rejected init reaches error screen', async () => {
  const state = local();
  state.categories.init = async () => { throw new Error('DB unavailable'); };
  state.harness.render();
  await flush();
  assert.equal(state.harness.render().key, 'error');
});

test('account change discards old pending initialization', async () => {
  const state = local();
  const pending = deferred();
  state.categories.init = () => pending.promise;
  state.harness.render();
  state.auth.session.user.id = 'b';
  state.harness.render();
  pending.resolve();
  await flush();
  assert.notEqual(state.harness.render().props.children, 'app');
  assert.equal(state.syncCalls, 0);
});

test('auth restoration only hides splash for signed-out session', async () => {
  for (const session of [null, { user: { id: 'a' } }]) {
    const state = { session: null, setSession(value) { state.session = value; }, setIsLoading() {} };
    const harness = setup('src/core/providers/auth-provider.tsx', {
      '@/features/auth': { useAuthStore: () => state },
      '@/shared/api/supabase': { supabase: { auth: {
        getSession: async () => ({ data: { session }, error: null }),
        onAuthStateChange: () => ({ data: { listener: undefined, subscription: { unsubscribe() {} } } }),
      } } },
    });
    assert.equal(harness.render().type, 'StartupScreen');
    await flush();
    const tree = harness.render();
    assert.equal(tree.props.children, 'app');
    tree.props.onLayout();
    assert.equal(harness.hides, session ? 0 : 1);
  }
});

test('database can reopen after an opening or migration failure', async () => {
  for (const failure of ['open', 'migration']) {
    let opens = 0;
    let migrations = 0;
    let closes = 0;
    const database = { closeAsync: async () => { closes++; } };
    const exports = {};
    vm.runInNewContext(ts.transpileModule(readFileSync('src/shared/api/local-db/client.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, {
      exports,
      require(name) {
        if (name === 'expo-sqlite') return { openDatabaseAsync: async () => {
          opens++;
          if (failure === 'open' && opens === 1) throw new Error('open failed');
          return database;
        } };
        if (name === './migrations') return { runLocalMigrations: async () => {
          migrations++;
          if (failure === 'migration' && migrations === 1) throw new Error('migration failed');
        } };
        throw new Error(name);
      },
    });
    const first = exports.getLocalDb();
    assert.equal(exports.getLocalDb(), first);
    await assert.rejects(first);
    assert.equal(await exports.getLocalDb(), database);
    assert.equal(await exports.getLocalDb(), database);
    assert.equal(opens, 2);
    assert.equal(closes, failure === 'migration' ? 1 : 0);
  }
});
