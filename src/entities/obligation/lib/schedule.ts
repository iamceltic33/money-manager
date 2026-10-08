import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import type { CalendarDate } from '../model/types';

export function parseCalendarDate(value: CalendarDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('Дата должна иметь формат ГГГГ-ММ-ДД');
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  if (year < 1 || year > 9999 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Некорректная календарная дата');
  }
  return { year, month, day };
}

export function generateMonthlyDates(first: CalendarDate, last: CalendarDate, paymentDay: number): CalendarDate[] {
  const start = parseCalendarDate(first);
  const end = parseCalendarDate(last);
  if (first > last) throw new Error('Начало срока позже окончания');
  if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) throw new Error('День платежа должен быть от 1 до 31');
  const result: CalendarDate[] = [];
  for (let monthIndex = start.year * 12 + start.month - 1; monthIndex <= end.year * 12 + end.month - 1; monthIndex++) {
    const year = Math.floor(monthIndex / 12);
    const month = monthIndex % 12 + 1;
    const endOfMonth = new Date(0);
    endOfMonth.setUTCFullYear(year, month, 0);
    const day = Math.min(paymentDay, endOfMonth.getUTCDate());
    const date = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (date >= first && date <= last) result.push(date);
  }
  return result;
}

// UUID v8: same obligation/month has the same ID on every device, including regeneration.
export async function getMonthlyPaymentId(obligationId: string, dueDate: CalendarDate) {
  parseCalendarDate(dueDate);
  const hash = (await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${obligationId.toLowerCase()}:${dueDate.slice(0, 7)}`)).toLowerCase();
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-${((parseInt(hash[16], 16) & 3) | 8).toString(16)}${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
