const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID, createHash } = require('node:crypto');
let writeCoordinator;
const vm = require('node:vm');
const ts = require('typescript');

const load = (path, overrides = {}) => {
  const file = resolve(path);
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, Date, Promise, Map, Set, AbortSignal, process,
    require: (name) => {
      if (name in overrides) return overrides[name];
      if (name === 'expo-crypto') return { randomUUID, CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digestStringAsync: async (_, value) => createHash('sha256').update(value).digest('hex') };
      if (name === '@/shared/api/local-db/write-coordinator') return writeCoordinator ??= load('src/shared/api/local-db/write-coordinator.ts');
      if (name === '@/entities/transaction/lib/amount') return load('src/entities/transaction/lib/amount.ts');
      if (name === '@/shared/model/restart-guard') return load('src/shared/model/restart-guard.ts', overrides);
      if (name.startsWith('.')) return load(resolve(dirname(file), name + '.ts'), overrides);
      return require(name);
    },
  });
  return exports;
};

const createDatabase = async () => {
  const sql = new DatabaseSync(':memory:');
  const database = {
    sql,
    execAsync: async query => sql.exec(query),
    runAsync: async (query, ...args) => sql.prepare(query).run(...args),
    getFirstAsync: async (query, ...args) => sql.prepare(query).get(...args) ?? null,
    getAllAsync: async (query, ...args) => sql.prepare(query).all(...args),
    withTransactionAsync: async (fn) => {
      sql.exec('begin');
      try { await fn(); sql.exec('commit'); } catch (error) { sql.exec('rollback'); throw error; }
    },
  };
  await load('src/shared/api/local-db/migrations.ts').runLocalMigrations(database);
  return database;
};

const createApis = (database) => {
  const overrides = { '@/shared/api/local-db': { getLocalDb: async () => database } };
  return {
    ...load('src/entities/category/api/categories.ts', overrides),
    ...load('src/entities/obligation/api/obligations.ts', overrides),
    ...load('src/entities/transaction/api/transactions.ts', {
      ...overrides, '../lib': load('src/entities/transaction/lib/amount.ts'),
    }),
  };
};

const createRemote = (userId) => {
  const state = { categories: new Map(), transactions: new Map(), obligations: new Map(), obligation_payments: new Map() };
  let initialized = false;
  let clock = 0;
  const remote = {
    state,
    beforeUpsert: null,
    afterUpsert: null,
    beforeSnapshot: null,
    afterSnapshot: null,
    initialize: async (seed) => {
      if (initialized) return;
      if (seed && !state.categories.size && !state.transactions.size) {
        const id = randomUUID();
        state.categories.set(id, { id, user_id: userId, name: 'Еда', type: 'expense', color: null,
          icon: null, sort_order: 0, exclude_from_average: false, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' });
      }
      initialized = true;
    },
    snapshot: async () => {
      await remote.beforeSnapshot?.();
      const snapshot = structuredClone({ categories: [...state.categories.values()], transactions: [...state.transactions.values()], obligations: [...state.obligations.values()], obligation_payments: [...state.obligation_payments.values()] });
      await remote.afterSnapshot?.();
      return snapshot;
    },
    upsert: async (table, row) => {
      await remote.beforeUpsert?.(table, row);
      const existing = state[table].get(row.id);
      const comparable = value => JSON.stringify(Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'updated_at').sort()));
      if ((table === 'transactions' || table === 'obligations') && row.category_id && !state.categories.has(row.category_id)) throw Error('Missing category');
      if (table === 'obligation_payments') {
        if (!state.obligations.has(row.obligation_id)) throw Error('Missing obligation');
        if (row.transaction_id && !state.transactions.has(row.transaction_id)) throw Error('Missing transaction');
        for (const other of state.obligation_payments.values()) {
          if (other.id !== row.id && other.obligation_id === row.obligation_id && other.due_date.slice(0, 7) === row.due_date.slice(0, 7)) throw Error('Duplicate payment month');
          if (other.id !== row.id && row.transaction_id && other.transaction_id === row.transaction_id) throw Error('Duplicate actual expense');
        }
      }
      const saved = existing && comparable(existing) === comparable(row) ? existing
        : { ...row, updated_at: new Date(Date.UTC(2026, 0, 1, 0, 0, ++clock)).toISOString() };
      state[table].set(row.id, structuredClone(saved));
      await remote.afterUpsert?.(table, row);
      return structuredClone(saved);
    },
    remove: async (table, id) => {
      state[table].delete(id);
      if (table === 'obligations') for (const row of state.obligation_payments.values()) {
        if (row.obligation_id === id) state.obligation_payments.delete(row.id);
      }
      if (table === 'transactions') for (const row of state.obligation_payments.values()) {
        if (row.transaction_id === id) row.transaction_id = null;
      }
      if (table === 'categories') for (const row of [...state.transactions.values(), ...state.obligations.values()]) {
        if (row.category_id === id) row.category_id = null;
      }
    },
    ensureRow: async (table, row) => { if (!state[table].has(row.id)) state[table].set(row.id, structuredClone(row)); },
    ensureCategory: async row => {
      if (!state.categories.has(row.id)) state.categories.set(row.id, structuredClone(row));
    },
  };
  return remote;
};

module.exports = { load, createDatabase, createApis, createRemote };
