const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { load } = require('./sync-helpers.cjs');

function fixture(defaultValues, type = 'expense', submit = async () => {}, controlledDraft) {
  const states = [], updates = [];
  let cursor = 0, draftInitializations = 0;
  const amount = load('src/entities/transaction/lib/amount.ts');
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
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Pressable: 'Pressable', TextInput: 'TextInput', View: 'View', StyleSheet: { create: value => value } },
    'react-native-keyboard-controller': { KeyboardAwareScrollView: 'KeyboardAwareScrollView' },
    '@/entities/category': { TransactionCategoryField: 'Category' },
    '@/entities/transaction': amount,
    '@/shared/config': { Spacing: {}, MaxContentWidth: 600 },
    '@/shared/lib/theme': { useTheme: () => ({}) },
    '@/shared/ui': { CheckboxField: 'Checkbox', DateField: 'Date', ThemedText: 'Text' },
    './obligation-payment-field': { ObligationPaymentField: 'Payment' },
    '../model/create-transaction-draft': {
      createTransactionDraft(values) {
        draftInitializations++;
        return load('src/features/transaction/save-transaction/model/create-transaction-draft.ts').createTransactionDraft(values);
      },
    },
  };
  vm.runInNewContext(ts.transpileModule(readFileSync('src/features/transaction/save-transaction/ui/transaction-form.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Date, require: name => {
    assert.ok(name in modules, `Unexpected module: ${name}`);
    return modules[name];
  } });
  const props = { type, defaultValues, title: 'Операция', buttonText: 'Сохранить', onSubmit: submit };
  if (controlledDraft !== undefined) {
    delete props.defaultValues;
    props.draft = controlledDraft;
    props.onDraftChange = update => updates.push(() => {
      props.draft = typeof update === 'function' ? update(props.draft) : update;
    });
  }
  const renderNode = node => {
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') return renderNode(node.type(node.props));
    const children = node.props?.children;
    return { ...node, props: { ...node.props, children: Array.isArray(children) ? children.map(renderNode) : renderNode(children) } };
  };
  let tree;
  return {
    get localHookCount() { return states.length; },
    get draftInitializations() { return draftInitializations; },
    props,
    render() {
      while (updates.length) updates.shift()();
      cursor = 0;
      tree = renderNode(exports.TransactionForm(props));
    },
    field(type, index = 0) {
      const found = [];
      const visit = node => {
        if (!node || typeof node !== 'object') return;
        if (node.type === type) found.push(node.props);
        const children = node.props?.children;
        (Array.isArray(children) ? children : [children]).forEach(visit);
      };
      visit(tree);
      assert.ok(found[index], `Missing field: ${type}`);
      return found[index];
    },
  };
}

test('batched field edits survive rerender and changed defaults; submit keeps existing normalization', async () => {
  let saved;
  const f = fixture(undefined, 'expense', async values => { saved = values; });
  f.render();
  assert.equal(f.field('TextInput').value, '');
  const date = new Date('2026-10-23T12:00:00Z');
  f.field('TextInput').onChangeText('12,');
  f.field('Date').onChange(date);
  f.field('Category').onChange('category');
  f.field('TextInput', 1).onChangeText('  заметка  ');
  f.field('Checkbox').onChange(true);
  f.props.defaultValues = { amount: 999, note: 'replacement', obligationPaymentId: 'replacement' };
  f.render();
  assert.equal(f.field('TextInput').value, '12,');
  assert.equal(f.field('Date').value, date);
  assert.equal(f.field('Category').value, 'category');
  assert.equal(f.field('TextInput', 1).value, '  заметка  ');
  assert.equal(f.field('Checkbox').checked, true);
  f.field('TextInput').onChangeText('12,345');
  f.render();
  assert.equal(f.field('TextInput').value, '12,');
  await f.field('Pressable').onPress();
  assert.equal(saved.amount, 12);
  assert.equal(saved.date, date);
  assert.equal(saved.note, 'заметка');
  assert.equal(saved.categoryId, 'category');
  assert.equal(saved.excludeFromAverage, true);
  assert.equal(saved.obligationPaymentId, undefined);
});

test('payment selection updates amount and category together; reselect and unlink keep manual edits', async () => {
  let saved;
  const f = fixture({ amount: 20, obligationPaymentId: 'old', categoryId: 'old-category' }, 'expense', async values => { saved = values; });
  f.render();
  assert.equal(f.field('Payment').value, 'old');
  const selection = { payment: { id: 'new', amount: 123.45 }, categoryId: 'payment-category' };
  f.field('TextInput', 1).onChangeText('note');
  f.field('Payment').onChange('new', selection);
  f.render();
  assert.equal(f.field('TextInput').value, '123.45');
  assert.equal(f.field('Category').value, 'payment-category');
  assert.equal(f.field('TextInput', 1).value, 'note');
  f.field('TextInput').onChangeText('200');
  f.field('Category').onChange('manual-category');
  f.field('Payment').onChange('new', selection);
  f.render();
  assert.equal(f.field('TextInput').value, '200');
  assert.equal(f.field('Category').value, 'manual-category');
  f.field('Payment').onChange(null);
  f.render();
  await f.field('Pressable').onPress();
  assert.equal(saved.obligationPaymentId, null);
  assert.equal(saved.amount, 200);
  assert.equal(saved.categoryId, 'manual-category');
});

test('failed save keeps edited values and enables retry', async () => {
  let fail;
  const f = fixture({ amount: 10 }, 'expense', () => new Promise((resolve, reject) => { fail = reject; }));
  f.render();
  f.field('TextInput', 1).onChangeText('draft');
  f.render();
  const pending = f.field('Pressable').onPress();
  f.render();
  assert.equal(f.field('Pressable').disabled, true);
  fail(new Error('save failed'));
  await assert.rejects(pending, /save failed/);
  f.render();
  assert.equal(f.field('Pressable').disabled, false);
  assert.equal(f.field('TextInput').value, '10');
  assert.equal(f.field('TextInput', 1).value, 'draft');
});

test('unchanged payment defaults retain the distinction between omitted, null and linked', async () => {
  for (const paymentId of [undefined, null, 'payment']) {
    let saved;
    const f = fixture({ amount: 100, obligationPaymentId: paymentId }, 'expense', async values => { saved = values; });
    f.render();
    f.props.defaultValues = { amount: 999, obligationPaymentId: 'replacement' };
    f.render();
    await f.field('Pressable').onPress();
    assert.equal(saved.obligationPaymentId, paymentId);
    assert.equal(saved.amount, 100);
  }
});

test('income submission omits payment ID even if supplied in defaults', async () => {
  let saved;
  const f = fixture({ amount: 100, note: null, obligationPaymentId: 'payment' }, 'income', async values => { saved = values; });
  f.render();
  await f.field('Pressable').onPress();
  assert.equal(saved.note, null);
  assert.equal('obligationPaymentId' in saved, false);
});


test('controlled fields update the owner draft without initializing a local copy', async () => {
  let saved;
  const date = new Date('2026-10-23T12:00:00Z');
  const initial = Object.freeze({ amountText: '10', date, note: '', categoryId: null, obligationPaymentId: null, excludeFromAverage: false });
  const f = fixture(undefined, 'expense', async values => { saved = values; }, initial);
  f.render();
  f.field('TextInput').onChangeText('12,');
  f.field('TextInput', 1).onChangeText('  draft  ');
  f.field('Category').onChange('category');
  f.field('Checkbox').onChange(true);
  f.render();
  assert.equal(f.props.draft.amountText, '12,');
  assert.equal(f.props.draft.note, '  draft  ');
  assert.equal(f.props.draft.categoryId, 'category');
  assert.equal(f.props.draft.excludeFromAverage, true);
  assert.equal(f.field('TextInput').value, f.props.draft.amountText);
  assert.equal(initial.amountText, '10');
  assert.equal(f.draftInitializations, 0);
  await f.field('Pressable').onPress();
  assert.equal(saved.amount, 12);
  assert.equal(saved.note, 'draft');
  assert.equal(saved.obligationPaymentId, null);
});

test('controlled render and submit use owner changes including payment removal and dates', async () => {
  const { createTransactionDraft } = load('src/features/transaction/save-transaction/model/create-transaction-draft.ts');
  let saved;
  const f = fixture(undefined, 'expense', async values => { saved = values; }, createTransactionDraft({ amount: 10 }));
  f.render();
  const date = new Date('2026-10-22T12:00:00Z');
  f.field('Date').onChange(date);
  f.field('Payment').onChange('payment', { payment: { id: 'payment', amount: 40 }, categoryId: 'payment-category' });
  f.render();
  assert.equal(f.props.draft.date, date);
  assert.equal(f.props.draft.obligationPaymentId, 'payment');
  assert.equal(f.props.draft.amountText, '40');
  assert.equal(f.props.draft.categoryId, 'payment-category');
  // Simulate an owner-driven type change/reset without recreating the form.
  f.props.draft = { ...f.props.draft, amountText: '75.50', note: 'owner', categoryId: null, obligationPaymentId: null };
  f.render();
  assert.equal(f.field('Payment').value, null);
  assert.equal(f.field('TextInput').value, '75.50');
  assert.equal(f.field('TextInput', 1).value, 'owner');
  await f.field('Pressable').onPress();
  assert.equal(saved.obligationPaymentId, null);
  assert.equal(saved.amount, 75.5);
  assert.equal(saved.date, date);
  assert.equal(f.draftInitializations, 0);
});

test('controlled fields wait for the owner to accept an update', () => {
  const { createTransactionDraft } = load('src/features/transaction/save-transaction/model/create-transaction-draft.ts');
  const f = fixture(undefined, 'expense', undefined, createTransactionDraft({ amount: 10 }));
  let proposed;
  f.props.onDraftChange = update => { proposed = update(f.props.draft); };
  f.render();
  f.field('TextInput').onChangeText('20');
  f.render();
  assert.equal(proposed.amountText, '20');
  assert.equal(f.props.draft.amountText, '10');
  assert.equal(f.field('TextInput').value, '10');
  f.props.draft = proposed;
  f.render();
  assert.equal(f.field('TextInput').value, '20');
});


test('screen-controlled busy state disables saving without a local state copy', async () => {
  const { createTransactionDraft } = load('src/features/transaction/save-transaction/model/create-transaction-draft.ts');
  let saves = 0;
  const f = fixture(undefined, 'expense', async () => { saves++; }, createTransactionDraft({ amount: 10 }));
  f.props.isSubmitting = true;
  f.render();
  assert.equal(f.field('Pressable').disabled, true);
  await f.field('Pressable').onPress();
  assert.equal(saves, 0);
  f.props.isSubmitting = false;
  f.render();
  assert.equal(f.field('Pressable').disabled, false);
  await f.field('Pressable').onPress();
  f.render();
  assert.equal(saves, 1);
  assert.equal(f.props.isSubmitting, false);
  assert.equal(f.localHookCount, 0);
  assert.equal(f.draftInitializations, 0);
});


test('explicit save failure is returned without clearing form values in either submission mode', async () => {
  const { createTransactionDraft } = load('src/features/transaction/save-transaction/model/create-transaction-draft.ts');
  for (const externalBusyState of [false, true]) {
    let result = 'error';
    const f = fixture(undefined, 'expense', async () => result, createTransactionDraft({ amount: 12.3, note: '  keep me  ' }));
    if (externalBusyState) f.props.isSubmitting = false;
    f.render();
    assert.equal(await f.field('Pressable').onPress(), 'error');
    f.render();
    assert.equal(f.field('TextInput').value, '12.3');
    assert.equal(f.field('TextInput', 1).value, '  keep me  ');
    assert.equal(f.field('Pressable').disabled, false);
    result = 'success';
    assert.equal(await f.field('Pressable').onPress(), 'success');
  }
});

test('editing defaults survive note-only changes and keep fixed-type fields when submitted', async () => {
  for (const type of ['expense', 'income']) {
    let saved;
    const date = new Date('2026-10-20T12:00:00Z');
    const defaults = { amount: 123.45, date, note: '  original  ', categoryId: 'category', excludeFromAverage: true, obligationPaymentId: type === 'expense' ? 'payment' : null };
    const f = fixture(defaults, type, async values => { saved = values; });
    f.props.transactionId = 'transaction';
    f.render();
    assert.equal(f.field('TextInput').value, '123.45');
    assert.equal(f.field('Date').value, date);
    assert.equal(f.field('Category').type, type);
    assert.equal(f.field('Category').value, 'category');
    assert.equal(f.field('TextInput', 1).value, '  original  ');
    if (type === 'expense') {
      assert.equal(f.field('Payment').value, 'payment');
      assert.equal(f.field('Payment').transactionId, 'transaction');
      assert.equal(f.field('Checkbox').checked, true);
    } else {
      assert.throws(() => f.field('Payment'), /Missing field/);
      assert.throws(() => f.field('Checkbox'), /Missing field/);
    }
    f.field('TextInput', 1).onChangeText('  edited  ');
    f.render();
    await f.field('Pressable').onPress();
    assert.equal(saved.amount, 123.45);
    assert.equal(saved.date, date);
    assert.equal(saved.categoryId, 'category');
    assert.equal(saved.note, 'edited');
    assert.equal(saved.obligationPaymentId, type === 'expense' ? 'payment' : undefined);
    assert.equal(f.draftInitializations, 1);
  }
});
