const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./sync-helpers.cjs');

const { switchTransactionDraftType } = load('src/features/transaction/save-transaction/model/switch-transaction-draft-type.ts');

const makeDraft = (amountText = '12,') => ({
  amountText,
  date: new Date('2026-10-23T12:00:00Z'),
  note: '  заметка  ',
  categoryId: 'expense-category',
  obligationPaymentId: 'payment',
  excludeFromAverage: true,
});

test('expense → income → expense keeps user input without restoring category or payment', () => {
  for (const amountText of ['', '12,', '12.', '0012,30']) {
    const expense = Object.freeze(makeDraft(amountText));
    const income = switchTransactionDraftType(expense, 'expense', 'income');
    assert.equal(income.categoryId, null);
    assert.equal(income.obligationPaymentId, null);
    const selectedIncome = Object.freeze({ ...income, categoryId: 'income-category' });
    const returnedExpense = switchTransactionDraftType(selectedIncome, 'income', 'expense');
    assert.equal(returnedExpense.categoryId, null);
    assert.equal(returnedExpense.obligationPaymentId, null);
    for (const draft of [income, returnedExpense]) {
      for (const key of ['amountText', 'date', 'note', 'excludeFromAverage']) {
        assert.equal(draft[key], expense[key]);
      }
    }
    assert.equal(expense.categoryId, 'expense-category');
    assert.equal(expense.obligationPaymentId, 'payment');
    assert.equal(selectedIncome.categoryId, 'income-category');
  }
});

test('pressing the selected type preserves the same draft and its selections', () => {
  const expense = Object.freeze(makeDraft());
  const income = Object.freeze({ ...expense, categoryId: 'income-category', obligationPaymentId: null });
  assert.equal(switchTransactionDraftType(expense, 'expense', 'expense'), expense);
  assert.equal(switchTransactionDraftType(income, 'income', 'income'), income);
});

test('the expense forecast preference survives both transitions when disabled', () => {
  const expense = { ...makeDraft(), excludeFromAverage: false };
  const income = switchTransactionDraftType(expense, 'expense', 'income');
  const returnedExpense = switchTransactionDraftType(income, 'income', 'expense');
  assert.equal(income.excludeFromAverage, false);
  assert.equal(returnedExpense.excludeFromAverage, false);
});
