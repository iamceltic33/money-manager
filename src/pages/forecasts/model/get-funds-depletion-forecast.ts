import type { LocalObligationPayment } from '@/entities/obligation';
import { calendarDay as getCalendarDay, dateAfterDays, depletionDays } from './payment-forecast';
import type { LocalCategory } from '@/entities/category';
import type { LocalTransaction } from '@/entities/transaction';
import {
  calculateAverageDailyExpense,
  calculateAverageWeeklyExpense,
} from '@/shared/utils/forecast-calculations';


type Params = {
  history: LocalTransaction[];
  payments?: LocalObligationPayment[];
  categories: LocalCategory[];
  balance: number;
  now: Date;
};

type Result = {
  averageWeeklyExpense?: number;
  estimatedDate: Date | null;
  unavailableMessage?: string;
};

export function getFundsDepletionForecast({ history, categories, balance, now, payments = [] }: Params): Result {
  const today = getCalendarDay(now);
  const expenses = history
    .filter((transaction) => transaction.type === 'expense')
    .map((transaction) => ({ transaction, day: getCalendarDay(new Date(transaction.occurred_at)) }))
    .filter(({ day }) => Number.isFinite(day) && day <= today);
  const filledDays = [...new Set(expenses.map(({ day }) => day))].sort((a, b) => a - b);

  if (filledDays.length < 7) {
    return {
      estimatedDate: null,
      unavailableMessage: `Для прогноза нужны расходы за 7 разных дней. Заполнено: ${filledDays.length} из 7`,
    };
  }

  if (balance <= 0) {
    return { estimatedDate: null, unavailableMessage: 'Текущий баланс уже исчерпан' };
  }

  // Первая дата расчёта — седьмой заполненный день, затем шаг в семь календарных дней.
  const firstCalculationDay = filledDays[6];
  const calculationDay = firstCalculationDay + Math.floor((today - firstCalculationDay) / 7) * 7;
  const periodStart = Math.max(filledDays[0], calculationDay - 27);
  const excludedCategoryIds = new Set(categories
    .filter((category) => category.exclude_from_average === 1)
    .map((category) => category.id));
  const linkedTransactionIds = new Set(payments.flatMap(row => row.transaction_id ? [row.transaction_id] : []));
  const totalExpenses = expenses.reduce((total, { transaction, day }) => {
    if (day < periodStart || day > calculationDay
      || linkedTransactionIds.has(transaction.id)
      || transaction.exclude_from_average === 1
      || (transaction.category_id !== null && excludedCategoryIds.has(transaction.category_id))) {
      return total;
    }

    return total + transaction.amount;
  }, 0);
  const dailyExpense = calculateAverageDailyExpense(totalExpenses, calculationDay - periodStart + 1)!;
  const remainingDays = depletionDays(balance, dailyExpense, payments, now);

  if (remainingDays === null) {
    return { estimatedDate: null, averageWeeklyExpense: calculateAverageWeeklyExpense(dailyExpense), unavailableMessage: 'Средств хватает на известные платежи; дата исчерпания не определена при нулевом обычном расходе' };
  }

  const estimatedDate = dateAfterDays(now, remainingDays);

  if (!Number.isFinite(estimatedDate.getTime())) {
    return { estimatedDate: null, unavailableMessage: 'Дата выходит за пределы доступного расчёта' };
  }

  return { estimatedDate, averageWeeklyExpense: calculateAverageWeeklyExpense(dailyExpense) };
}
