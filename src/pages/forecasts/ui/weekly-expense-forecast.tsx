import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { ThemedText } from '@/shared/ui/themed-text';
import type { LocalObligation, LocalObligationPayment } from '@/entities/obligation';
import { forecastWeekCount, forecastWeeks } from '../model/payment-forecast';

type Props = {
  balance: number;
  averageWeeklyExpense?: number;
  payments: LocalObligationPayment[];
  obligations: LocalObligation[];
  startDate: Date;
};

const PAGE_SIZE = 12;
const amountFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function WeeklyExpenseForecast({ balance, averageWeeklyExpense, startDate, payments, obligations }: Props) {
  const theme = useTheme();
  const [visibleWeeks, setVisibleWeeks] = useState(PAGE_SIZE);
  const totalWeeks = forecastWeekCount(balance, averageWeeklyExpense ?? 0, payments, startDate);

  if (totalWeeks === null || totalWeeks === 0) return null;

  const displayedWeeks = Math.min(visibleWeeks, totalWeeks);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">Динамика расходов по неделям</ThemedText>
      {averageWeeklyExpense === undefined ? <ThemedText type="small" themeColor="textSecondary">Показаны только известные платежи. Обычные расходы пока не оценены; остаток без них может быть завышен.</ThemedText> : null}
      <View style={styles.amounts}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.column}>Расход</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.column}>Остаток</ThemedText>
      </View>
      {forecastWeeks(balance, averageWeeklyExpense ?? 0, payments, startDate, displayedWeeks).map(row => {
        const { week, remainingBalance } = row;
        const isNegative = remainingBalance < 0;
        const formatDate = (date: Date) => date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
        return (
          <View key={week} style={[styles.week, { borderTopColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold">
              Неделя {week} · {formatDate(row.start)} — {formatDate(row.end)}
            </ThemedText>
            <View style={styles.amounts}>
              <View style={styles.column}>
                <ThemedText type="small" style={styles.negative}>≈ −{amountFormatter.format(row.totalExpense)}</ThemedText>
              </View>
              <View style={styles.column}>
                <ThemedText type="smallBold" style={isNegative ? styles.negative : styles.positive}>
                  ≈ {amountFormatter.format(remainingBalance)}
                </ThemedText>
              </View>
            </View>
            <ThemedText type="small" themeColor="textSecondary">Обычные расходы: {averageWeeklyExpense === undefined ? 'не оценены' : `≈ ${amountFormatter.format(row.ordinaryExpense)}`} · Платежи: {amountFormatter.format(row.paymentExpense)}</ThemedText>
            {row.payments.map(({ payment, overdue }) => <ThemedText key={payment.id} type="small" themeColor="textSecondary">
              {obligations.find(parent => parent.id === payment.obligation_id)?.name ?? 'Обязательство'} · {payment.due_date.split('-').reverse().join('.')} · {amountFormatter.format(payment.amount)} KZT{overdue ? ' · просрочен, учтён сегодня' : ''}
            </ThemedText>)}
            {isNegative ? <ThemedText type="small" style={styles.negative}>Баланс уйдёт в минус</ThemedText> : null}
          </View>
        );
      })}
      {displayedWeeks < totalWeeks ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setVisibleWeeks((previous) => previous + PAGE_SIZE)}
          style={({ pressed }) => [styles.moreButton, { backgroundColor: theme.background }, pressed && styles.pressed]}
        >
          <ThemedText type="smallBold">Показать ещё недели</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  week: {
    borderTopWidth: 1,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  amounts: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  column: {
    flex: 1,
    gap: Spacing.one,
  },
  negative: {
    color: '#DC2626',
  },
  positive: {
    color: '#16A34A',
  },
  moreButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.two,
  },
  pressed: {
    opacity: 0.78,
  },
});
