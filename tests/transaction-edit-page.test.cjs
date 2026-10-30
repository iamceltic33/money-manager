const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { load } = require('./sync-helpers.cjs');

function fixture(type = 'expense', canDismiss = true) {
  const calls = [], reads = [];
  const params = { id: 'transaction' };
  const transaction = { id: params.id, type, amount: 123.45, category_id: 'category', occurred_at: '2026-10-20T12:00:00Z', note: '  original  ', exclude_from_average: 1 };
  const payments = [{ id: 'payment', transaction_id: params.id }];
  let query, failure, retries = 0;
  let resource = { data: { ...transaction, obligationPaymentId: type === 'expense' ? 'payment' : null }, loading: false, error: false, retry: () => { retries++; } };
  const router = {
    canDismiss: () => canDismiss,
    back: () => calls.push(['back']),
    replace: href => calls.push(['replace', href]),
  };
  const jsx = (type, props, key) => ({ type, props, key });
  const modules = {
    react: { useCallback: callback => callback },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/entities/obligation': { getLocalObligationPayments: async userId => { reads.push(['payments', userId]); return payments; } },
    '@/entities/transaction': {
      getLocalTransactionById: async (userId, id) => { reads.push(['transaction', userId, id]); return transaction; },
      useTransactionResource: (callback, enabled, refresh) => { query = callback; assert.equal(enabled, true); assert.equal(refresh, false); return resource; },
      useTransactionsStore: selector => selector({ updateTransaction: async values => { calls.push(['update', values]); if (failure) throw failure; } }),
    },
    '@/features/transaction/save-transaction': { TransactionForm: 'Form' },
    '@/shared/ui/query-status': { QueryStatus: 'Status' },
    '@/shared/config/theme': { Spacing: {}, MaxContentWidth: 600 },
    '@/shared/lib/theme/use-theme': { useTheme: () => ({}) },
    '@/shared/lib/navigation/go-back': load('src/shared/lib/navigation/go-back.ts'),
    '@/shared/ui/themed-text': { ThemedText: 'Text' },
    '@/shared/ui/themed-view': { ThemedView: 'View' },
    'expo-router': { useLocalSearchParams: () => params, useRouter: () => router },
    'lucide-react-native': { SearchX: 'SearchX' },
    'react-native': { StyleSheet: { create: value => value }, View: 'View' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeArea' },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('src/pages/transaction-edit/ui/edit-transaction-page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Date, encodeURIComponent, require: name => { assert.ok(name in modules, name); return modules[name]; } });
  let nodes;
  const render = () => {
    nodes = [];
    const visit = node => {
      if (!node || typeof node !== 'object') return;
      nodes.push(node);
      const children = node.props?.children;
      (Array.isArray(children) ? children : [children]).forEach(visit);
    };
    visit(exports.EditTransactionPage());
  };
  render();
  return {
    calls, reads, transaction, payments, render,
    get form() { return nodes.find(node => node.type === 'Form')?.props; },
    get key() { return nodes.find(node => node.type === 'Form')?.key; },
    get status() { return nodes.find(node => node.type === 'Status')?.props; },
    get texts() { return nodes.filter(node => node.type === 'Text').map(node => node.props.children); },
    get retries() { return retries; },
    query: userId => query(userId),
    setResource(value) { resource = { ...resource, ...value }; },
    setFailure(error) { failure = error; },
  };
}

test('editing initializes all fields in the existing mode and keeps the operation type fixed', () => {
  for (const type of ['expense', 'income']) {
    const f = fixture(type);
    const form = f.form;
    assert.equal(form.type, type);
    assert.equal(form.transactionId, 'transaction');
    assert.equal(f.key, 'transaction');
    assert.equal(form.draft, undefined);
    assert.equal(form.onTypeChange, undefined);
    assert.equal(form.defaultValues.amount, 123.45);
    assert.equal(form.defaultValues.categoryId, 'category');
    assert.equal(form.defaultValues.note, '  original  ');
    assert.equal(form.defaultValues.date.getTime(), new Date(f.transaction.occurred_at).getTime());
    assert.equal(form.defaultValues.excludeFromAverage, true);
    assert.equal(form.defaultValues.obligationPaymentId, type === 'expense' ? 'payment' : null);
  }
});

test('editing loads the linked payment only for expenses and does not refresh its snapshot in background', async () => {
  for (const type of ['expense', 'income']) {
    const f = fixture(type);
    const data = await f.query('alice');
    assert.equal(data.obligationPaymentId, type === 'expense' ? 'payment' : null);
    assert.equal(f.reads.filter(call => call[0] === 'payments').length, type === 'expense' ? 1 : 0);
    f.payments.length = 0;
    const unlinked = await f.query('alice');
    assert.equal(unlinked.obligationPaymentId, null);
  }
});

test('expense edit preserves, changes or clears its payment and returns only after successful update', async () => {
  for (const paymentId of ['payment', 'replacement', null]) {
    const f = fixture();
    const date = new Date('2026-10-21T12:00:00Z');
    await f.form.onSubmit({ amount: 200.5, date, categoryId: 'new-category', note: 'edited', excludeFromAverage: false, obligationPaymentId: paymentId });
    const values = f.calls[0][1];
    assert.equal(values.id, 'transaction');
    assert.equal(values.type, undefined);
    assert.equal(values.amount, 200.5);
    assert.equal(values.occurredAt, date);
    assert.equal(values.categoryId, 'new-category');
    assert.equal(values.note, 'edited');
    assert.equal(values.excludeFromAverage, false);
    assert.equal(values.obligationPaymentId, paymentId);
    assert.deepEqual(f.calls[1], ['back']);
  }
});

test('income edit omits expense-only fields and direct edit returns to transaction details', async () => {
  const f = fixture('income', false);
  await f.form.onSubmit({ amount: 10, date: new Date(), note: null, categoryId: null, excludeFromAverage: true, obligationPaymentId: 'ignored' });
  const values = f.calls[0][1];
  assert.equal('type' in values, false);
  assert.equal('excludeFromAverage' in values, false);
  assert.equal('obligationPaymentId' in values, false);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[1])), ['replace', { pathname: '/transactions/[id]', params: { id: 'transaction' } }]);
});

test('edit error keeps the screen and permits retry; loading error and missing record do not render a form', async () => {
  const f = fixture();
  const form = f.form;
  const values = { amount: 10, date: new Date(), note: 'draft', categoryId: null };
  f.setFailure(new Error('write failed'));
  await form.onSubmit(values);
  assert.equal(f.calls.length, 1);
  f.render();
  assert.equal(f.form.type, 'expense');
  f.setFailure(undefined);
  await f.form.onSubmit(values);
  assert.equal(f.calls.at(-1)[0], 'back');
  f.setResource({ loading: true });
  f.render();
  assert.equal(f.form, undefined);
  assert.equal(f.status.loading, true);
  f.setResource({ loading: false, error: true });
  f.render();
  f.status.retry();
  assert.equal(f.retries, 1);
  f.setResource({ error: false, data: null });
  f.render();
  assert.equal(f.form, undefined);
  assert.ok(f.texts.includes('Транзакция не найдена'));
});
