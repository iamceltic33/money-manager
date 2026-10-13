const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./sync-helpers.cjs');
const { goBack } = load('src/shared/lib/navigation/go-back.ts');

function navigate(pathname, canDismiss) {
  const calls = [];
  goBack({
    canDismiss: () => canDismiss,
    back: () => calls.push(['back']),
    dismissTo: href => calls.push(['dismissTo', href]),
    replace: href => calls.push(['replace', JSON.parse(JSON.stringify(href))]),
  }, pathname);
  return calls;
}

test('nested screens return to their caller when a stack history exists', () => {
  for (const path of ['/reports', '/add-expense', '/add-income', '/transactions/id', '/transactions/id/edit']) {
    assert.deepEqual(navigate(path, true), [['back']], path);
  }
});

test('direct links without a stack history use the appropriate parent screen', () => {
  for (const path of ['/reports', '/add-expense', '/add-income']) {
    assert.deepEqual(navigate(path, false), [['replace', '/']], path);
  }
  assert.deepEqual(navigate('/transactions/id', false), [['replace', '/transactions']]);
  assert.deepEqual(navigate('/transactions/id/edit', false), [
    ['replace', { pathname: '/transactions/[id]', params: { id: 'id' } }],
  ]);
});

test('main sections and history return to home rather than previously visited tabs', () => {
  for (const path of ['/categories', '/obligations', '/forecasts', '/profile', '/transactions']) {
    for (const history of [true, false]) assert.deepEqual(navigate(path, history), [['dismissTo', '/']], path);
  }
});
