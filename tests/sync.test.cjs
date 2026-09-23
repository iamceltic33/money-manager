const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { load, createDatabase, createApis, createRemote } = require('./sync-helpers.cjs');
const { synchronizeDatabase } = load('src/features/sync/api/synchronize-database.ts');

const fixture = async () => {
  const database = await createDatabase();
  const api = createApis(database);
  const userId = randomUUID();
  const remote = createRemote(userId);
  const category = await api.createLocalCategory({ userId, name: 'Своя', type: 'expense' });
  const transaction = await api.createLocalTransaction({ userId, type: 'expense', amount: 15, categoryId: category.id });
  const sync = () => synchronizeDatabase(database, remote, userId);
  return { database, api, userId, remote, category, transaction, sync };
};

test('push, pull, repeated run and second device preserve IDs without additional presets', async () => {
  const f = await fixture(); await f.sync(); await f.sync();
  assert.equal(f.remote.state.categories.size, 1); assert.equal(f.remote.state.transactions.size, 1);
  const device2 = await createDatabase();
  await synchronizeDatabase(device2, f.remote, f.userId);
  assert.equal((await createApis(device2).getLocalCategories(f.userId))[0].id, f.category.id);
  assert.equal((await createApis(device2).getLocalTransactions(f.userId))[0].id, f.transaction.id);
  f.remote.state.transactions.get(f.transaction.id).amount = 27;
  f.remote.state.transactions.get(f.transaction.id).updated_at = '2026-03-01T00:00:00Z';
  await f.sync(); assert.equal(await f.api.getLocalBalance(f.userId), -27);
});

test('edit during upload is sent later; reply does not acknowledge a newer revision', async () => {
  const f = await fixture(); let changed = false;
  f.remote.afterUpsert = async table => {
    if (table !== 'transactions' || changed) return;
    changed = true;
    await f.api.updateLocalTransaction({ userId: f.userId, id: f.transaction.id, amount: 42 });
  };
  await f.sync();
  assert.equal(f.remote.state.transactions.get(f.transaction.id).amount, 42);
  assert.equal((await f.api.getLocalTransactionById(f.userId, f.transaction.id)).amount, 42);
});

test('lost response after remote commit retries without duplicates', async () => {
  const f = await fixture(); let failed = false;
  f.remote.afterUpsert = async () => { if (!failed) { failed = true; throw Error('Lost response'); } };
  await assert.rejects(f.sync, /Lost response/);
  await f.sync();
  assert.equal(f.remote.state.categories.size, 1); assert.equal(f.remote.state.transactions.size, 1);
});

test('delete during upload cannot resurrect a record', async () => {
  const f = await fixture();
  f.remote.afterUpsert = async table => {
    if (table === 'transactions') await f.api.deleteLocalTransaction({ userId: f.userId, id: f.transaction.id });
  };
  await f.sync();
  assert.equal(f.remote.state.transactions.size, 0);
  assert.equal((await f.api.getLocalTransactions(f.userId)).length, 0);
  assert.equal(f.database.sql.prepare('select count(*) as n from local_deletions').get().n, 0);
});

test('edits and deletions during snapshot request survive pull', async () => {
  const f = await fixture(); await f.sync();
  f.remote.afterSnapshot = async () => {
    await f.api.updateLocalTransaction({ userId: f.userId, id: f.transaction.id, amount: 77 });
    await f.api.deleteLocalCategory(f.userId, f.category.id);
  };
  await f.sync();
  const row = await f.api.getLocalTransactionById(f.userId, f.transaction.id);
  assert.equal(row.amount, 77); assert.equal(row.sync_status, 'pending'); assert.equal(row.category_id, null);
  assert.equal(await f.api.getLocalCategoryById(f.userId, f.category.id), null);
});

test('remote deletes are applied without outbound deletion echo', async () => {
  const f = await fixture(); await f.sync();
  await f.remote.remove('categories', f.category.id); await f.sync();
  assert.equal(await f.api.getLocalCategoryById(f.userId, f.category.id), null);
  assert.equal((await f.api.getLocalTransactionById(f.userId, f.transaction.id)).category_id, null);
  assert.equal(f.database.sql.prepare('select count(*) as n from local_deletions').get().n, 0);
  await f.remote.remove('transactions', f.transaction.id); await f.sync();
  assert.equal(await f.api.getLocalBalance(f.userId), 0);
});

test('conflicting remote edit does not overwrite either side', async () => {
  const f = await fixture(); await f.sync();
  f.remote.state.transactions.get(f.transaction.id).amount = 35;
  f.remote.state.transactions.get(f.transaction.id).updated_at = '2026-05-01T00:00:00Z';
  await f.api.updateLocalTransaction({ userId: f.userId, id: f.transaction.id, amount: 99 });
  await assert.rejects(f.sync, /Conflict/);
  assert.equal(f.remote.state.transactions.get(f.transaction.id).amount, 35);
  const row = await f.api.getLocalTransactionById(f.userId, f.transaction.id);
  assert.equal(row.amount, 99); assert.equal(row.sync_status, 'failed');
});

test('failed snapshot cannot remove local data; foreign snapshot rejected', async () => {
  const f = await fixture(); await f.sync();
  f.remote.beforeSnapshot = async () => { throw Error('Offline'); };
  await assert.rejects(f.sync, /Offline/);
  assert.ok(await f.api.getLocalCategoryById(f.userId, f.category.id));
  f.remote.beforeSnapshot = null;
  f.remote.state.categories.get(f.category.id).user_id = randomUUID();
  await assert.rejects(f.sync, /аккаунта/);
  assert.ok(await f.api.getLocalCategoryById(f.userId, f.category.id));
});

test('server initializes empty account only once, even after all categories deleted', async () => {
  const db1 = await createDatabase(); const db2 = await createDatabase(); const user = randomUUID(); const remote = createRemote(user);
  await synchronizeDatabase(db1, remote, user); await synchronizeDatabase(db2, remote, user);
  assert.equal(remote.state.categories.size, 1);
  const api = createApis(db1); const category = (await api.getLocalCategories(user))[0];
  await api.deleteLocalCategory(user, category.id); await synchronizeDatabase(db1, remote, user);
  await synchronizeDatabase(await createDatabase(), remote, user);
  assert.equal(remote.state.categories.size, 0);
});

test('unrelated account is neither uploaded nor changed', async () => {
  const f = await fixture(); const other = randomUUID();
  const row = await f.api.createLocalTransaction({ userId: other, type: 'income', amount: 30 });
  await f.sync();
  assert.equal(f.remote.state.transactions.has(row.id), false);
  assert.equal((await f.api.getLocalTransactionById(other, row.id)).sync_status, 'pending');
});

test('same-timestamp edits increment revision while sync metadata does not', async () => {
  const f = await fixture();
  const read = () => f.database.sql.prepare('select * from transactions where id=?').get(f.transaction.id);
  const first = read();
  f.database.sql.prepare("update transactions set amount=22,updated_at=?,sync_status='pending' where id=?").run(first.updated_at,f.transaction.id);
  assert.equal(read().local_revision,first.local_revision+1);
  f.database.sql.prepare('update transactions set remote_updated_at=? where id=?').run(first.updated_at,f.transaction.id);
  assert.equal(read().local_revision,first.local_revision+1);
});

test('concurrent synchronization calls share one run; different accounts are serialized', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let count = 0;
  const { synchronize } = load('src/features/sync/model/synchronize.ts', {
    '@/shared/api/local-db': { getLocalDb: async () => ({}) },
    '@/shared/api/supabase': { supabase: { auth: { getSession: async () => ({data:{session:{user:{id:'A'},access_token:'test'}},error:null}) } } },
    '../api/remote': { createSyncRemote: () => ({}) },
    '../api/synchronize-database': { synchronizeDatabase: async () => { count++; await gate; } },
  });
  const first = synchronize('A'); const second = synchronize('A');
  assert.equal(first,second);
  const changedAccount = synchronize('B');
  release(); await first;
  await assert.rejects(changedAccount,/Аккаунт изменился/);
  assert.equal(count,1);
});

test('logout during category loading does not restore previous account data', async () => {
  let resolveQuery;
  const promise = new Promise(resolve => { resolveQuery=resolve; });
  const { useCategoryStore } = load('src/entities/category/model/category-store.ts', {
    '../api/categories': { getLocalCategories: () => promise },
    '@/shared/model/toast-store': { showErrorToast: () => {} },
  });
  const init = useCategoryStore.getState().init('A');
  useCategoryStore.getState().reset();
  resolveQuery([{id:'old'}]); await init;
  assert.equal(useCategoryStore.getState().userId,null);
  assert.equal(useCategoryStore.getState().categories.length,0);
});

test('edit between incoming delete marking and delete keeps row and clears marker', async () => {
  const f = await fixture(); await f.sync();
  await f.remote.remove('transactions',f.transaction.id);
  const original = f.database.runAsync; let edited=false;
  f.database.runAsync=async(query,...args)=>{
    const result=await original(query,...args);
    if(query.includes('update transactions set remote_deleted = 1')&&!edited){
      edited=true;
      await f.api.updateLocalTransaction({userId:f.userId,id:f.transaction.id,amount:88});
    }
    return result;
  };
  await f.sync();
  const row=await f.api.getLocalTransactionById(f.userId,f.transaction.id);
  assert.equal(row.amount,88);assert.equal(row.sync_status,'pending');assert.equal(row.remote_deleted,0);
});
