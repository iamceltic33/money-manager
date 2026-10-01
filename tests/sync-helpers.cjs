const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
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
      if (name === 'expo-crypto') return { randomUUID };
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
    ...load('src/entities/transaction/api/transactions.ts', {
      ...overrides, '../lib': load('src/entities/transaction/lib/amount.ts'),
    }),
  };
};

const createRemote = (userId) => {
  const state = { categories: new Map(), transactions: new Map() };
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
      const snapshot = structuredClone({ categories: [...state.categories.values()], transactions: [...state.transactions.values()] });
      await remote.afterSnapshot?.();
      return snapshot;
    },
    upsert: async (table, row) => {
      await remote.beforeUpsert?.(table, row);
      const existing = state[table].get(row.id);
      const comparable = value => JSON.stringify(Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'updated_at').sort()));
      if (table === 'transactions' && row.category_id && !state.categories.has(row.category_id)) throw Error('Missing category');
      const saved = existing && comparable(existing) === comparable(row) ? existing
        : { ...row, updated_at: new Date(Date.UTC(2026, 0, 1, 0, 0, ++clock)).toISOString() };
      state[table].set(row.id, structuredClone(saved));
      await remote.afterUpsert?.(table, row);
      return structuredClone(saved);
    },
    remove: async (table, id) => {
      state[table].delete(id);
      if (table === 'categories') for (const row of state.transactions.values()) {
        if (row.category_id === id) row.category_id = null;
      }
    },
    ensureCategory: async row => {
      if (!state.categories.has(row.id)) state.categories.set(row.id, structuredClone(row));
    },
  };
  return remote;
};

module.exports = { load, createDatabase, createApis, createRemote };
