import type { LocalObligationPayment } from '@/entities/obligation';

const DAY_MS = 86_400_000;
// Only remove floating-point noise; keep fractional averages unrounded.
function cleanRemainder(value: number, scale: number) {
  return Math.abs(value) <= Number.EPSILON * Math.max(1, Math.abs(scale)) * 8 ? 0 : value;
}
function ceilingDays(value: number) {
  return Math.ceil(value - Number.EPSILON * Math.max(1, Math.abs(value)) * 8);
}
export function calendarDay(date: Date) {
  const day = new Date(0);
  day.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  return day.getTime() / DAY_MS;
}
export function paymentCalendarDay(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0); date.setUTCFullYear(year, month - 1, day);
  return date.getTime() / DAY_MS;
}
export function dateAfterDays(now: Date, days: number) {
  const date = new Date(now); date.setDate(date.getDate() + days); return date;
}
export function pendingPaymentEvents(payments: LocalObligationPayment[], now: Date) {
  const today = calendarDay(now);
  return payments.filter(row => row.transaction_id === null).map(payment => ({
    payment, offset: Math.max(0, paymentCalendarDay(payment.due_date) - today),
    overdue: paymentCalendarDay(payment.due_date) < today,
  })).sort((a, b) => a.offset - b.offset || a.payment.id.localeCompare(b.payment.id));
}

// Ordinary spending is continuous between calendar-day payment events.
export function depletionDays(balance: number, dailyExpense: number, payments: LocalObligationPayment[], now: Date): number | null {
  if (balance <= 0) return 0;
  let remaining = balance;
  let offset = 0;
  for (const event of pendingPaymentEvents(payments, now)) {
    const ordinary = dailyExpense * (event.offset - offset);
    if (dailyExpense > 0 && remaining <= ordinary) return offset + ceilingDays(remaining / dailyExpense);
    remaining = cleanRemainder(remaining - ordinary - event.payment.amount, balance);
    offset = event.offset;
    if (remaining <= 0) return offset;
  }
  return dailyExpense > 0 ? offset + ceilingDays(remaining / dailyExpense) : null;
}

export function forecastWeekCount(balance: number, weeklyExpense: number, payments: LocalObligationPayment[], now: Date) {
  if (balance < 0) return 0;
  const events = pendingPaymentEvents(payments, now);
  const lastWeek = events.length ? Math.floor(events[events.length - 1].offset / 7) + 1 : 0;
  const remainingAfter = (weeks: number) => cleanRemainder(balance - weeklyExpense * weeks
    - events.reduce((sum, event) => sum + (event.offset < weeks * 7 ? event.payment.amount : 0), 0), balance);
  if (!weeklyExpense && remainingAfter(lastWeek) >= 0) return lastWeek;
  let low = 1;
  let high = weeklyExpense ? Math.max(1, Math.floor(balance / weeklyExpense) + 2) : lastWeek;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (remainingAfter(middle) < 0) high = middle;
    else low = middle + 1;
  }
  return high;
}

export function forecastWeeks(balance: number, weeklyExpense: number, payments: LocalObligationPayment[], now: Date, count: number) {
  const events = pendingPaymentEvents(payments, now);
  let remainingBalance = balance;
  let cursor = 0;
  return Array.from({ length: count }, (_, index) => {
    const weekPayments: typeof events = [];
    while (cursor < events.length && events[cursor].offset < (index + 1) * 7) weekPayments.push(events[cursor++]);
    const paymentExpense = weekPayments.reduce((sum, event) => sum + event.payment.amount, 0);
    remainingBalance = cleanRemainder(remainingBalance - weeklyExpense - paymentExpense, balance);
    return { week: index + 1, start: dateAfterDays(now, index * 7), end: dateAfterDays(now, index * 7 + 6), paymentExpense,
      ordinaryExpense: weeklyExpense, totalExpense: weeklyExpense + paymentExpense, remainingBalance, payments: weekPayments };
  });
}
