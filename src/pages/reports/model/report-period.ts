export type ReportPeriod = 'week' | 'month' | 'year' | 'custom';

export function getReportRange(period: ReportPeriod, now: Date, from: Date, to: Date) {
  const start = new Date(period === 'custom' ? from : now);
  const end = new Date(period === 'custom' ? to : now);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (period === 'week') start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  if (period === 'month') start.setDate(1);
  if (period === 'year') start.setMonth(0, 1);
  const endExclusive = new Date(end);
  endExclusive.setDate(endExclusive.getDate() + 1);
  return { start, end, endExclusive };
}
