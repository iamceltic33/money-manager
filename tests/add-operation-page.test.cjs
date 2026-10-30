const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { load } = require('./sync-helpers.cjs');

function fixture(canDismiss = true, error, create = async () => {}, options = {}) {
  const states = [], updates = [];
  let cursor = 0, initializations = 0, currentError = error;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => updates.push(() => {
        states[index] = typeof value === 'function' ? value(states[index]) : value;
      })];
    },
    useRef(initial) {
      const index = cursor++;
      return states[index] ??= { current: initial };
    },
  };
  const calls = [], reads = [];
  let cleanup, pendingEffect;
  const useFocusEffect = callback => { if (!cleanup) pendingEffect = callback; };
  const stack = canDismiss ? [options.caller ?? '/', '/add-operation'] : ['/add-operation'];
  const params = { paymentId: options.paymentId, type: options.type };
  let userId = 'alice', query, resourceArgs;
  let resource = { loading: true, error: false, data: undefined, retry: () => { resource = { ...resource, loading: true, error: false }; } };
  const paymentLoader = load('src/pages/add-operation/model/load-operation-payment.ts', {
    '@/entities/obligation': {
      getLocalObligations: async id => { reads.push(['parents', id]); return options.parents ?? []; },
      getLocalObligationPayments: async id => { reads.push(['payments', id]); return options.payments ?? []; },
    },
  });
  react.useCallback = callback => callback;
  const router = {
    canDismiss: () => canDismiss,
    back: () => { calls.push(['back']); stack.pop(); },
    replace: path => { calls.push(['replace', path]); stack[stack.length - 1] = path; },
  };
  const jsx = (type, props, key) => ({ type, props, key });
  const modules = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/entities/transaction': { useTransactionsStore: selector => selector({ userId, createTransaction: async (...args) => {
      calls.push(['create', ...args]);
      if (currentError) throw currentError;
      await create(...args);
    } }), useTransactionResource: (callback, enabled, refreshOnChanges) => {
      query = callback;
      resourceArgs = [enabled, refreshOnChanges];
      return resource;
    } },
    '@/features/transaction/save-transaction': {
      TransactionForm: 'Form',
      ...load('src/features/transaction/save-transaction/model/switch-transaction-draft-type.ts'),
      createTransactionDraft(values) {
        initializations++;
        return load('src/features/transaction/save-transaction/model/create-transaction-draft.ts').createTransactionDraft(values);
      },
    },
    '../model/load-operation-payment': paymentLoader,
    '@/shared/ui/query-status': { QueryStatus: 'QueryStatus' },
    '@/widgets/operation-switcher': { OperationSwitcher: 'Switcher' },
    '@/shared/config/theme': { Spacing: {}, MaxContentWidth: 600 },
    '@/shared/lib/navigation/go-back': load('src/shared/lib/navigation/go-back.ts'),
    '@/shared/model/toast-store': { showSuccessToast: text => calls.push(['toast', text]) },
    '@/shared/ui/themed-view': { ThemedView: 'View' },
    'expo-router': { useFocusEffect, useRouter: () => router, useLocalSearchParams: () => params },
    'react-native': { StyleSheet: { create: styles => styles } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeArea' },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('src/pages/add-operation/ui/add-operation-page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; } });
  let node, switcher, status, entryKey;
  const render = () => {
    while (updates.length) updates.shift()();
    cursor = 0;
    let tree = exports.AddOperationPage();
    if (tree.key !== entryKey) {
      cleanup?.();
      cleanup = undefined;
      entryKey = tree.key;
      states.length = 0;
    }
    while (typeof tree.type === 'function') tree = tree.type(tree.props);
    node = switcher = status = undefined;
    const visit = child => {
      if (!child || typeof child !== 'object') return;
      if (child.type === 'Form') node = child;
      if (child.type === 'Switcher') switcher = child;
      if (child.type === 'QueryStatus') status = child;
      const children = child.props?.children;
      (Array.isArray(children) ? children : [children]).forEach(visit);
    };
    visit(tree);
    if (pendingEffect) {
      cleanup = pendingEffect();
      pendingEffect = undefined;
    }
  };
  render();
  return {
    calls,
    reads,
    stack,
    params,
    blur() { cleanup?.(); cleanup = undefined; },
    unmount() { cleanup?.(); cleanup = undefined; updates.length = 0; },
    get pendingUpdates() { return updates.length; },
    render,
    get hasForm() { return Boolean(node); },
    get status() { return status?.props; },
    get resourceArgs() { return resourceArgs; },
    async loadPayment() {
      try {
        const data = await query(userId);
        resource = { ...resource, loading: false, error: false, data };
      } catch {
        resource = { ...resource, loading: false, error: true, data: undefined };
      }
    },
    replaceLoadedDefaults(data) { resource = { ...resource, data }; },
    setUserId(id) { userId = id; resource = { ...resource, loading: true, error: false, data: undefined }; },
    get switcher() { return switcher.props; },
    get componentType() { return node.type; },
    get form() { return node.props; },
    get key() { return node.key; },
    get initializations() { return initializations; },
    setError(value) { currentError = value; },
  };
}

test('new screen saves an expense and returns to its caller or home for a direct link', async () => {
  for (const canDismiss of [true, false]) {
    const f = fixture(canDismiss);
    assert.equal(f.form.type, 'expense');
    const values = { amount: 125.5, date: new Date(), categoryId: 'category', note: 'note', excludeFromAverage: true, obligationPaymentId: 'payment' };
    assert.equal(await f.form.onSubmit(values), 'success');
    assert.equal(f.calls[0][0], 'create');
    assert.equal(f.calls[0][1], values.amount);
    assert.equal(f.calls[0][2], 'expense');
    const saved = f.calls[0][3];
    assert.equal(saved.occurredAt.getTime(), values.date.getTime());
    assert.notEqual(saved.occurredAt, values.date);
    for (const key of ['categoryId', 'note', 'excludeFromAverage', 'obligationPaymentId']) assert.equal(saved[key], values[key]);
    assert.deepEqual(f.calls.slice(1), [['toast', 'Расход добавлен'], canDismiss ? ['back'] : ['replace', '/']]);
  }
});

test('failed expense save does not report success or navigate away', async () => {
  const error = new Error('write failed');
  const f = fixture(true, error);
  assert.equal(await f.form.onSubmit({ amount: 1, date: new Date(), categoryId: null, note: null }), 'error');
  assert.equal(f.calls.length, 1);
});


test('screen creates one draft per opening and keeps edits through rerenders', () => {
  const f = fixture();
  const initial = f.form.draft;
  for (let i = 0; i < 3; i++) f.render();
  assert.equal(f.form.draft, initial);
  assert.equal(f.initializations, 1);
  f.form.onDraftChange(current => ({ ...current, amountText: '12,', note: '  draft  ' }));
  f.render();
  assert.equal(f.form.draft.amountText, '12,');
  assert.equal(f.form.draft.note, '  draft  ');
  assert.equal(f.form.type, 'expense');
  assert.equal(f.key, undefined);
  assert.equal(f.initializations, 1);
  const reopened = fixture();
  assert.notEqual(reopened.form.draft, f.form.draft);
  assert.equal(reopened.form.draft.amountText, '');
});

test('screen owns busy state and rejects duplicate saves before and after rerender', async () => {
  let finish;
  const waiting = new Promise(resolve => { finish = resolve; });
  const f = fixture(true, undefined, () => waiting);
  const values = { amount: 1, date: new Date(), categoryId: null, note: null };
  const pending = f.form.onSubmit(values);
  await f.form.onSubmit(values);
  f.render();
  assert.equal(f.form.isSubmitting, true);
  await f.form.onSubmit(values);
  assert.equal(f.calls.filter(call => call[0] === 'create').length, 1);
  finish();
  await pending;
  f.render();
  assert.equal(f.form.isSubmitting, true);
  assert.equal(f.initializations, 1);
});

test('failed save releases busy state and preserves the screen draft for retry', async () => {
  const error = new Error('write failed');
  const f = fixture(true, error);
  f.form.onDraftChange(current => ({ ...current, amountText: '50', note: 'keep me' }));
  f.render();
  const draft = f.form.draft;
  const values = { amount: 50, date: draft.date, categoryId: null, note: 'keep me' };
  const pending = f.form.onSubmit(values);
  f.render();
  assert.equal(f.form.isSubmitting, true);
  assert.equal(await pending, 'error');
  f.render();
  assert.equal(f.form.isSubmitting, false);
  assert.equal(f.form.draft, draft);
  assert.equal(f.calls.length, 1);
  f.setError(undefined);
  await f.form.onSubmit(values);
  f.render();
  assert.equal(f.calls.filter(call => call[0] === 'create').length, 2);
  assert.equal(f.calls.at(-1)[0], 'back');
  assert.equal(f.initializations, 1);
});


test('switching type keeps one form and raw fields, resets incompatible selections without navigation', () => {
  const f = fixture();
  const formType = f.componentType;
  const date = new Date('2026-10-20T12:00:00Z');
  f.form.onDraftChange(current => ({ ...current, amountText: '0012,', date, note: '  note  ', categoryId: 'expense-category', obligationPaymentId: 'payment', excludeFromAverage: true }));
  f.render();
  const selected = f.form.draft;
  f.switcher.onTypeChange('expense');
  f.render();
  assert.equal(f.form.draft, selected);
  for (const type of ['income', 'expense', 'income', 'expense']) {
    f.switcher.onTypeChange(type);
    f.render();
    assert.equal(f.form.type, type);
    assert.equal(f.switcher.type, type);
    assert.equal(f.form.title, type === 'expense' ? 'Добавить расход' : 'Добавить доход');
    assert.equal(f.form.draft.amountText, '0012,');
    assert.equal(f.form.draft.note, '  note  ');
    assert.equal(f.form.draft.date, date);
    assert.equal(f.form.draft.excludeFromAverage, true);
    assert.equal(f.form.draft.categoryId, null);
    assert.equal(f.form.draft.obligationPaymentId, null);
    assert.equal(f.componentType, formType);
    assert.equal(f.key, undefined);
    assert.equal(f.initializations, 1);
  }
  assert.deepEqual(f.calls, []);
});

test('queued type changes apply to the latest draft and type', () => {
  const f = fixture();
  f.form.onDraftChange(current => ({ ...current, amountText: '12,', obligationPaymentId: 'payment' }));
  f.switcher.onTypeChange('income');
  f.switcher.onTypeChange('expense');
  f.render();
  assert.equal(f.form.type, 'expense');
  assert.equal(f.form.draft.amountText, '12,');
  assert.equal(f.form.draft.obligationPaymentId, null);
});

test('saving locks the switcher and keeps it locked after success until leaving the screen', async () => {
  let finish;
  const waiting = new Promise(resolve => { finish = resolve; });
  const f = fixture(true, undefined, () => waiting);
  const pending = f.form.onSubmit({ amount: 1, date: new Date(), note: null, categoryId: null });
  f.switcher.onTypeChange('income');
  f.render();
  assert.equal(f.switcher.disabled, true);
  assert.equal(f.form.type, 'expense');
  f.switcher.onTypeChange('income');
  f.render();
  assert.equal(f.form.type, 'expense');
  finish();
  await pending;
  f.render();
  assert.equal(f.switcher.disabled, true);
});

test('income labels and submission match the selected type and omit expense-only fields', async () => {
  const f = fixture();
  f.switcher.onTypeChange('income');
  f.render();
  assert.equal(f.form.buttonText, 'Добавить доход');
  await f.form.onSubmit({ amount: 10, date: new Date(), categoryId: null, note: null, excludeFromAverage: true, obligationPaymentId: 'stale' });
  assert.equal(f.calls[0][2], 'income');
  assert.equal('excludeFromAverage' in f.calls[0][3], false);
  assert.equal('obligationPaymentId' in f.calls[0][3], false);
  assert.equal(f.calls[1][1], 'Доход добавлен');
});


test('both types retain every draft field after a failed save and can retry successfully', async () => {
  for (const type of ['expense', 'income']) {
    const f = fixture(true, new Error('write failed'));
    f.switcher.onTypeChange(type);
    f.render();
    const date = new Date('2026-10-28T12:00:00Z');
    f.form.onDraftChange(current => ({ ...current, amountText: '125,50', date, note: '  keep spaces  ', categoryId: 'category', obligationPaymentId: type === 'expense' ? 'payment' : null, excludeFromAverage: true }));
    f.render();
    const draft = f.form.draft;
    const values = { amount: 125.5, date, note: 'keep spaces', categoryId: draft.categoryId, obligationPaymentId: draft.obligationPaymentId, excludeFromAverage: true };
    const pending = f.form.onSubmit(values);
    f.render();
    assert.equal(f.form.isSubmitting, true);
    assert.equal(await pending, 'error');
    f.render();
    assert.equal(f.form.type, type);
    assert.equal(f.form.draft, draft);
    assert.equal(f.form.isSubmitting, false);
    assert.equal(f.switcher.disabled, false);
    assert.equal(f.calls.length, 1);
    f.setError(undefined);
    assert.equal(await f.form.onSubmit(values), 'success');
    const call = f.calls[1];
    assert.equal(call[2], type);
    assert.equal(call[3].categoryId, 'category');
    assert.equal(call[3].note, 'keep spaces');
    assert.equal(call[3].excludeFromAverage, type === 'expense' ? true : undefined);
    assert.equal(call[3].obligationPaymentId, type === 'expense' ? 'payment' : undefined);
    assert.equal(f.calls[2][1], type === 'expense' ? 'Расход добавлен' : 'Доход добавлен');
  }
});

test('an in-flight request keeps its click-time snapshot while later edits remain in the draft', async () => {
  for (const type of ['expense', 'income']) {
    let finish;
    const waiting = new Promise(resolve => { finish = resolve; });
    const f = fixture(true, undefined, () => waiting);
    f.switcher.onTypeChange(type);
    f.render();
    const date = new Date('2026-10-28T12:00:00Z');
    const originalTime = date.getTime();
    const values = { amount: 125.5, date, categoryId: 'original-category', note: 'original note', excludeFromAverage: false, obligationPaymentId: null };
    const pending = f.form.onSubmit(values);
    values.date.setFullYear(2030);
    values.amount = 999;
    values.note = 'mutated input';
    f.form.onDraftChange(current => ({ ...current, amountText: '999', note: 'new edit' }));
    f.switcher.onTypeChange(type === 'expense' ? 'income' : 'expense');
    f.render();
    assert.equal(await f.form.onSubmit(values), 'error');
    assert.equal(f.calls.length, 1);
    const call = f.calls[0];
    assert.equal(call[1], 125.5);
    assert.equal(call[2], type);
    assert.equal(call[3].occurredAt.getTime(), originalTime);
    assert.equal(call[3].note, 'original note');
    assert.equal(call[3].categoryId, 'original-category');
    assert.equal(f.form.type, type);
    assert.equal(f.form.draft.note, 'new edit');
    finish();
    assert.equal(await pending, 'success');
    f.render();
    assert.equal(f.form.isSubmitting, true);
  }
});


const paymentOptions = () => ({
  paymentId: 'payment',
  parents: [{ id: 'parent', category_id: 'payment-category', remote_deleted: 0 }],
  payments: [{ id: 'payment', obligation_id: 'parent', amount: 123.45, due_date: '2026-01-01', transaction_id: null, remote_deleted: 0 }],
});

test('payment entry waits for loading before creating a draft and fills only known fields once', async () => {
  const f = fixture(true, undefined, undefined, paymentOptions());
  assert.equal(f.hasForm, false);
  assert.equal(f.initializations, 0);
  assert.equal(f.status.loading, true);
  assert.deepEqual(f.resourceArgs, [true, false]);
  await f.loadPayment();
  f.render();
  assert.equal(f.form.draft.amountText, '123.45');
  assert.equal(f.form.draft.categoryId, 'payment-category');
  assert.equal(f.form.draft.obligationPaymentId, 'payment');
  assert.equal(f.form.draft.note, '');
  assert.equal(f.form.draft.excludeFromAverage, false);
  assert.notEqual(f.form.draft.date.toISOString().slice(0, 10), '2026-01-01');
  assert.equal(f.initializations, 1);
  assert.deepEqual(f.reads, [['parents', 'alice'], ['payments', 'alice']]);
  f.form.onDraftChange(current => ({ ...current, amountText: '200,', note: '  user note  ' }));
  f.render();
  f.replaceLoadedDefaults({ amount: 999, categoryId: 'different', obligationPaymentId: 'payment' });
  f.render();
  assert.equal(f.form.draft.amountText, '200,');
  assert.equal(f.form.draft.note, '  user note  ');
  assert.equal(f.form.draft.categoryId, 'payment-category');
  assert.equal(f.initializations, 1);
  assert.equal(f.reads.length, 2);
});

test('payment entry → income → expense never reapplies the initial link or defaults', async () => {
  const f = fixture(true, undefined, undefined, paymentOptions());
  await f.loadPayment();
  f.render();
  const date = f.form.draft.date;
  f.switcher.onTypeChange('income');
  f.render();
  assert.equal(f.form.draft.obligationPaymentId, null);
  assert.equal(f.form.draft.categoryId, null);
  f.switcher.onTypeChange('expense');
  f.render();
  assert.equal(f.form.draft.obligationPaymentId, null);
  assert.equal(f.form.draft.categoryId, null);
  assert.equal(f.form.draft.amountText, '123.45');
  assert.equal(f.form.draft.date, date);
  assert.equal(f.initializations, 1);
  f.switcher.onTypeChange('income');
  f.render();
  assert.equal(await f.form.onSubmit({ amount: 123.45, date, categoryId: null, note: null }), 'success');
  assert.equal(f.calls[0][2], 'income');
  assert.equal('obligationPaymentId' in f.calls[0][3], false);
});

test('unavailable payment shows error and retries without creating a premature draft', async () => {
  const options = paymentOptions();
  options.payments[0].transaction_id = 'another-expense';
  const f = fixture(true, undefined, undefined, options);
  await f.loadPayment();
  f.render();
  assert.equal(f.hasForm, false);
  assert.equal(f.status.error, true);
  assert.equal(f.status.errorMessage, 'Не удалось загрузить платёж');
  assert.equal(f.initializations, 0);
  options.payments[0].transaction_id = null;
  f.status.retry();
  f.render();
  assert.equal(f.status.loading, true);
  await f.loadPayment();
  f.render();
  assert.equal(f.hasForm, true);
  assert.equal(f.form.draft.obligationPaymentId, 'payment');
  assert.equal(f.initializations, 1);
});

test('missing, deleted payments and missing parents are unavailable; null category stays null', async () => {
  for (const change of [o => { o.payments = []; }, o => { o.payments[0].remote_deleted = 1; }, o => { o.parents = []; }, o => { o.parents[0].remote_deleted = 1; }]) {
    const options = paymentOptions();
    change(options);
    const f = fixture(true, undefined, undefined, options);
    await f.loadPayment();
    f.render();
    assert.equal(f.status.error, true);
    assert.equal(f.initializations, 0);
  }
  const options = paymentOptions();
  options.parents[0].category_id = null;
  const f = fixture(true, undefined, undefined, options);
  await f.loadPayment();
  f.render();
  assert.equal(f.form.draft.categoryId, null);
});

test('account change discards a loaded payment draft until the new account has loaded it', async () => {
  const options = paymentOptions();
  const f = fixture(true, undefined, undefined, options);
  await f.loadPayment();
  f.render();
  f.form.onDraftChange(current => ({ ...current, note: 'alice draft' }));
  f.render();
  options.payments = [];
  f.setUserId('bob');
  f.render();
  assert.equal(f.hasForm, false);
  await f.loadPayment();
  f.render();
  assert.equal(f.status.error, true);
  assert.deepEqual(f.reads.slice(-2), [['parents', 'bob'], ['payments', 'bob']]);
});

test('ordinary entry creates an empty draft without loading any payment', () => {
  const f = fixture();
  assert.equal(f.hasForm, true);
  assert.equal(f.form.draft.amountText, '');
  assert.equal(f.form.draft.obligationPaymentId, null);
  assert.equal(f.initializations, 1);
  assert.equal(f.reads.length, 0);
});


test('income entry chooses the initial type and ignores paymentId without loading a payment', () => {
  for (const type of ['income', ['income']]) {
    const f = fixture(true, undefined, undefined, { type, paymentId: 'irrelevant-payment' });
    assert.equal(f.hasForm, true);
    assert.equal(f.form.type, 'income');
    assert.equal(f.switcher.type, 'income');
    assert.equal(f.form.draft.obligationPaymentId, null);
    assert.equal(f.reads.length, 0);
  }
});

test('unknown initial type defaults to expense, and route defaults never override a live draft', () => {
  const f = fixture(true, undefined, undefined, { type: 'invalid' });
  assert.equal(f.form.type, 'expense');
  f.switcher.onTypeChange('income');
  f.form.onDraftChange(current => ({ ...current, amountText: '42,', note: 'draft' }));
  f.render();
  f.params.type = 'expense';
  f.render();
  assert.equal(f.form.type, 'income');
  assert.equal(f.form.draft.amountText, '42,');
  assert.equal(f.form.draft.note, 'draft');
  assert.equal(f.initializations, 1);
});


test('successful draft is terminal until unmount; reopening starts blank with the requested type', async () => {
  for (const type of ['expense', 'income']) {
    const f = fixture(true, undefined, undefined, { type });
    f.form.onDraftChange(current => ({ ...current, amountText: '50', note: 'old note' }));
    f.render();
    const draft = f.form.draft;
    const submit = f.form.onSubmit;
    assert.equal(await submit({ amount: 50, date: draft.date, categoryId: null, note: 'old note' }), 'success');
    f.render();
    assert.equal(f.form.isSubmitting, true);
    assert.equal(f.switcher.disabled, true);
    assert.equal(await submit({ amount: 50, date: draft.date, categoryId: null, note: 'old note' }), 'error');
    f.switcher.onTypeChange(type === 'income' ? 'expense' : 'income');
    f.form.onDraftChange(current => ({ ...current, note: 'after success' }));
    f.render();
    assert.equal(f.form.type, type);
    assert.equal(f.form.draft, draft);
    assert.equal(f.calls.filter(call => call[0] === 'create').length, 1);
    assert.deepEqual(f.stack, ['/']);
    f.unmount();
    const reopened = fixture(true, undefined, undefined, { type });
    assert.equal(reopened.form.type, type);
    assert.equal(reopened.form.draft.amountText, '');
    assert.equal(reopened.form.draft.note, '');
    assert.equal(reopened.form.isSubmitting, false);
  }
});

test('closing an unsaved draft discards it and stale handlers cannot save or edit it', async () => {
  const f = fixture(true, undefined, undefined, { type: 'income' });
  f.form.onDraftChange(current => ({ ...current, amountText: '12,', note: 'cancelled' }));
  f.render();
  const form = f.form;
  f.unmount();
  form.onDraftChange(current => ({ ...current, note: 'stale' }));
  assert.equal(await form.onSubmit({ amount: 12, date: form.draft.date, categoryId: null, note: 'cancelled' }), 'error');
  assert.equal(f.pendingUpdates, 0);
  assert.deepEqual(f.calls, []);
  const reopened = fixture(true, undefined, undefined, { type: 'income' });
  assert.equal(reopened.form.type, 'income');
  assert.equal(reopened.form.draft.amountText, '');
  assert.equal(reopened.form.draft.note, '');
});

test('a save finishing after close cannot navigate or update a newly opened draft', async () => {
  for (const fail of [false, true]) {
    let finish;
    const waiting = new Promise((resolve, reject) => { finish = fail ? () => reject(new Error('write failed')) : resolve; });
    const old = fixture(true, undefined, () => waiting);
    const pending = old.form.onSubmit({ amount: 10, date: new Date(), categoryId: null, note: 'closed' });
    old.render();
    old.unmount();
    const reopened = fixture(true, undefined, undefined, { type: 'income' });
    reopened.form.onDraftChange(current => ({ ...current, amountText: '99', note: 'new draft' }));
    reopened.render();
    finish();
    assert.equal(await pending, fail ? 'error' : 'success');
    assert.equal(old.calls.length, 1);
    assert.equal(old.pendingUpdates, 0);
    assert.equal(reopened.form.draft.amountText, '99');
    assert.equal(reopened.form.draft.note, 'new draft');
    assert.deepEqual(reopened.calls, []);
  }
});

test('saving from credits returns there, while a direct entry falls back to home', async () => {
  for (const caller of ['/obligations', undefined]) {
    const f = fixture(Boolean(caller), undefined, undefined, { caller });
    assert.equal(await f.form.onSubmit({ amount: 1, date: new Date(), categoryId: null, note: null }), 'success');
    assert.deepEqual(f.stack, [caller ?? '/']);
  }
});


test('a save finishing after loss of focus does not navigate during the closing transition', async () => {
  let finish;
  const waiting = new Promise(resolve => { finish = resolve; });
  const f = fixture(true, undefined, () => waiting);
  const pending = f.form.onSubmit({ amount: 10, date: new Date(), categoryId: null, note: null });
  f.render();
  f.blur();
  finish();
  assert.equal(await pending, 'success');
  assert.equal(f.calls.length, 1);
  assert.equal(f.pendingUpdates, 0);
});

test('returning to a retained screen after a failed background save enables retry without losing input', async () => {
  let reject;
  const waiting = new Promise((resolve, fail) => { reject = fail; });
  const f = fixture(true, undefined, () => waiting);
  f.form.onDraftChange(current => ({ ...current, amountText: '10', note: 'retained' }));
  f.render();
  const draft = f.form.draft;
  const pending = f.form.onSubmit({ amount: 10, date: draft.date, categoryId: null, note: 'retained' });
  f.render();
  f.blur();
  reject(new Error('write failed'));
  assert.equal(await pending, 'error');
  f.render(); // focus setup restores the request status
  f.render();
  assert.equal(f.form.isSubmitting, false);
  assert.equal(f.form.draft, draft);
  assert.equal(f.calls.length, 1);
});

test('payment save returns to credits and a later opening reloads payment availability', async () => {
  const options = { ...paymentOptions(), caller: '/obligations' };
  const f = fixture(true, undefined, async () => { options.payments[0].transaction_id = 'saved-expense'; }, options);
  await f.loadPayment();
  f.render();
  const draft = f.form.draft;
  assert.equal(await f.form.onSubmit({ amount: 123.45, date: draft.date, categoryId: draft.categoryId, note: null, obligationPaymentId: draft.obligationPaymentId }), 'success');
  assert.deepEqual(f.stack, ['/obligations']);
  f.unmount();
  const reopened = fixture(true, undefined, undefined, options);
  await reopened.loadPayment();
  reopened.render();
  assert.equal(reopened.hasForm, false);
  assert.equal(reopened.status.error, true);
  assert.equal(reopened.initializations, 0);
  assert.equal(fixture().form.draft.amountText, '');
});

test('a retained draft saved while unfocused closes on return instead of exposing a completed form', async () => {
  let finish;
  const waiting = new Promise(resolve => { finish = resolve; });
  const f = fixture(true, undefined, () => waiting, { caller: '/obligations' });
  const pending = f.form.onSubmit({ amount: 10, date: new Date(), categoryId: null, note: null });
  f.render();
  f.blur();
  finish();
  assert.equal(await pending, 'success');
  assert.equal(f.calls.length, 1);
  f.render();
  assert.deepEqual(f.stack, ['/obligations']);
  assert.deepEqual(f.calls.slice(1), [['back']]);
});
