const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load } = require('./sync-helpers.cjs');
const { createHistoryWheel } = load('src/pages/home-history/model/create-history-wheel.ts');
const delta = (deltaY, extra = {}) => ({ deltaX: 0, deltaY, deltaMode: 0, ctrlKey: false, ...extra });

test('wheel opens once per burst; idle gaps reset distance; returning home permits opening again', () => {
  const wheel = createHistoryWheel();
  assert.equal(wheel.update(delta(40), 1000), false);
  assert.equal(wheel.update(delta(40), 1300), false);
  assert.equal(wheel.update(delta(40), 1350), true);
  assert.equal(wheel.update(delta(100), 1400), false);
  wheel.reset();
  assert.equal(wheel.update(delta(80), 1500), true);
});

test('horizontal scroll, browser zoom and upward scroll cannot open history; lines and pages are normalized', () => {
  const wheel = createHistoryWheel();
  assert.equal(wheel.update(delta(100, { ctrlKey: true }), 1000), false);
  assert.equal(wheel.update(delta(100, { deltaX: 200 }), 1050), false);
  assert.equal(wheel.update(delta(-100), 1100), false);
  assert.equal(wheel.update(delta(5, { deltaMode: 1 }), 1150), true);
  wheel.reset();
  assert.equal(wheel.update(delta(1, { deltaMode: 2 }), 1200), true);
});
