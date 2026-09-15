import type { LocalCategory } from '@/entities/category';
import type { LocalTransaction } from '@/entities/transaction';
import {
  calculateAverageDailyExpense,
  calculateAverageWeeklyExpense,
  calculateDaysUntilFundsRunOut,
} from '@/shared/utils/forecast-calculations';

const DAY_MS = 86_400_000;

type Params = {
  history: LocalTransaction[];
  categories: LocalCategory[];
  balance: number;
  now: Date;
};

type Result = {
  averageWeeklyExpense?: number;
  estimatedDate: Date | null;
  unavailableMessage?: string;
};

export function getFundsDepletionForecast({ history, categories, balance, now }: Params): Result {
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
  const totalExpenses = expenses.reduce((total, { transaction, day }) => {
    if (day < periodStart || day > calculationDay
      || transaction.exclude_from_average === 1
      || (transaction.category_id !== null && excludedCategoryIds.has(transaction.category_id))) {
      return total;
    }

    return total + transaction.amount;
  }, 0);
  const dailyExpense = calculateAverageDailyExpense(totalExpenses, calculationDay - periodStart + 1)!;
  const remainingDays = calculateDaysUntilFundsRunOut(balance, dailyExpense);

  if (remainingDays === null) {
    return { estimatedDate: null, unavailableMessage: 'Нет учитываемых расходов за расчётный период' };
  }

  const estimatedDate = new Date(now);
  estimatedDate.setDate(estimatedDate.getDate() + Math.ceil(remainingDays));

  if (!Number.isFinite(estimatedDate.getTime())) {
    return { estimatedDate: null, unavailableMessage: 'Дата выходит за пределы доступного расчёта' };
  }

  return { estimatedDate, averageWeeklyExpense: calculateAverageWeeklyExpense(dailyExpense) };
}

function getCalendarDay(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}
