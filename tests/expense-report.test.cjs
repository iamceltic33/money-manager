const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createDatabase, createApis, load } = require('./sync-helpers.cjs');
const { getReportRange } = load('src/pages/reports/model/report-period.ts');

// Exercise calendar math in a timezone east of UTC, including local midnight.
process.env.TZ = 'Asia/Almaty';
test('presets start on Monday/month/year and include the selected last day', () => {
  const now = new Date(2026, 9, 5, 12);
  for (const [period, month, day] of [['week', 9, 5], ['month', 9, 1], ['year', 0, 1]]) {
    const range = getReportRange(period, now, now, now);
    assert.equal(range.start.getMonth(), month);
    assert.equal(range.start.getDate(), day);
    assert.equal(range.start.getHours(), 0);
    assert.equal(range.endExclusive.getDate(), 6);
  }
  const sunday = new Date(2026, 9, 4);
  assert.equal(getReportRange('week', sunday, sunday, sunday).start.getDate(), 28);
  assert.equal(getReportRange('week', sunday, sunday, sunday).start.getMonth(), 8);
  const leap = getReportRange('custom', now, new Date(2024, 1, 29, 15), new Date(2024, 1, 29, 2));
  assert.equal(leap.endExclusive.getMonth(), 2);
  assert.equal(leap.endExclusive.getDate(), 1);
});

test('report aggregates all expenses, isolates accounts and respects local inclusive dates', async t => {
  const database = await createDatabase();
  t.after(() => database.sql.close());
  const api = createApis(database);
  const { getLocalExpenseReport } = load('src/entities/transaction/api/expense-report.ts', {
    '@/shared/api/local-db': { getLocalDb: async () => database },
  });
  const category = await api.createLocalCategory({ userId: 'alice', type: 'expense', name: 'Еда', excludeFromAverage: true });
  const day = new Date(2026, 9, 5);
  const range = getReportRange('custom', day, day, day);
  // More than both summary and history page sizes; exclusions still belong in reports.
  for (let i = 0; i < 85; i++) {
    await api.createLocalTransaction({ userId: 'alice', type: 'expense', amount: 1.25, categoryId: category.id, occurredAt: day, excludeFromAverage: true });
  }
  await api.createLocalTransaction({ userId: 'alice', type: 'expense', amount: 2.5, occurredAt: new Date(range.endExclusive.getTime() - 1) });
  for (const occurredAt of [new Date(day.getTime() - 1), range.endExclusive]) {
    await api.createLocalTransaction({ userId: 'alice', type: 'expense', amount: 999, occurredAt });
  }
  await api.createLocalTransaction({ userId: 'alice', type: 'income', amount: 999, occurredAt: day });
  await api.createLocalTransaction({ userId: 'bob', type: 'expense', amount: 999, occurredAt: day });
  const report = await getLocalExpenseReport('alice', range.start, range.endExclusive);
  assert.equal(report.length, 2);
  assert.equal(report[0].categoryId, category.id);
  assert.equal(report[0].amount, 106.25);
  assert.equal(report[0].count, 85);
  assert.equal(report[1].categoryId, null);
  assert.equal(report[1].amount, 2.5);
  assert.equal((await getLocalExpenseReport('nobody', range.start, range.endExclusive)).length, 0);
  await assert.rejects(getLocalExpenseReport('', range.start, range.endExclusive));
  await assert.rejects(getLocalExpenseReport('alice', range.endExclusive, range.start));
  // Deleting a category retains the expenses in the uncategorized group.
  await api.deleteLocalCategory('alice', category.id);
  const after = await getLocalExpenseReport('alice', range.start, range.endExclusive);
  assert.equal(after.length, 1);
  assert.equal(after[0].categoryId, null);
  assert.equal(after[0].amount, 108.75);
});
