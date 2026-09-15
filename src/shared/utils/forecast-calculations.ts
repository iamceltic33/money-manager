export function calculateAverageDailyExpense(
  totalExpenses: number,
  calendarDays: number
): number | null {
  assertNonNegativeFinite(totalExpenses, 'Сумма расходов');

  if (!Number.isInteger(calendarDays) || calendarDays < 0) {
    throw new RangeError('Количество дней должно быть целым неотрицательным числом');
  }

  return calendarDays === 0 ? null : totalExpenses / calendarDays;
}

export function calculateAverageWeeklyExpense(averageDailyExpense: number): number {
  assertNonNegativeFinite(averageDailyExpense, 'Средний дневной расход');

  return averageDailyExpense * 7;
}

export function calculateDaysUntilFundsRunOut(
  balance: number,
  averageDailyExpense: number
): number | null {
  if (!Number.isFinite(balance)) {
    throw new RangeError('Баланс должен быть конечным числом');
  }

  assertNonNegativeFinite(averageDailyExpense, 'Средний дневной расход');

  if (balance <= 0) return 0;
  if (averageDailyExpense === 0) return null;

  return balance / averageDailyExpense;
}

/** Остаток после указанного числа полных недель, без округления. */
export function calculateBalanceAfterWeeks(
  balance: number,
  averageWeeklyExpense: number,
  weeks: number
): number {
  if (!Number.isFinite(balance)) throw new RangeError('Некорректный баланс');
  assertNonNegativeFinite(averageWeeklyExpense, 'Средний недельный расход');
  if (!Number.isInteger(weeks) || weeks < 0) throw new RangeError('Некорректное число недель');

  return balance - averageWeeklyExpense * weeks;
}

/** Включает первую неделю с отрицательным остатком, даже если предыдущая закончилась нулём. */
export function calculateWeeksUntilNegativeBalance(balance: number, averageWeeklyExpense: number): number | null {
  if (!Number.isFinite(balance)) throw new RangeError('Некорректный баланс');
  assertNonNegativeFinite(averageWeeklyExpense, 'Средний недельный расход');
  if (balance < 0) return 0;
  if (averageWeeklyExpense === 0) return null;

  return Math.floor(balance / averageWeeklyExpense) + 1;
}

function assertNonNegativeFinite(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} должен быть конечным неотрицательным числом`);
  }
}
