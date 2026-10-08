import { loadForecastData } from '../model/load-forecast-data';
import { QueryStatus } from '@/shared/ui/query-status';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { MaxContentWidth, Spacing } from '@/shared/config/theme';
import { useTransactionResource, useTransactionsStore } from '@/entities/transaction';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';

import { getFundsDepletionForecast } from '../model/get-funds-depletion-forecast';
import { FundsDepletionForecast } from './funds-depletion-forecast';
import { WeeklyExpenseForecast } from './weekly-expense-forecast';

export function ForecastsPage() {
  const focused = useIsFocused();
  const { data: snapshot, loading, error, retry } = useTransactionResource(loadForecastData, focused);
  const transactionsInitialized = useTransactionsStore((state) => state.initialized);
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(useCallback(() => {
    setNow(new Date());
  }, []));

  const forecast = useMemo(() => {
    if (!transactionsInitialized || !snapshot) {
      return { estimatedDate: null, unavailableMessage: 'Загрузка данных…' };
    }

    return getFundsDepletionForecast({ ...snapshot, now });
  }, [snapshot, now, transactionsInitialized]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <ThemedText type="subtitle" style={styles.title}>Прогнозы</ThemedText>
          {loading || error ? <QueryStatus loading={loading} error={error} retry={retry} /> : <FundsDepletionForecast {...forecast} />}
          {!loading && !error && snapshot?.obligations.some(parent => parent.payment_mode === 'manual') ? <ThemedText type="small" themeColor="textSecondary">Для обязательств с разной суммой учитываются только введённые платежи. Незаполненные месяцы не включены.</ThemedText> : null}
          {!loading && !error && snapshot && snapshot.balance > 0 ? (
            <WeeklyExpenseForecast
              key={`${snapshot.balance}:${now.getTime()}:${snapshot.payments.map(row => `${row.id}:${row.updated_at}:${row.transaction_id}`).join('|')}:${forecast.averageWeeklyExpense}`}
              balance={snapshot.balance}
              payments={snapshot.payments}
              obligations={snapshot.obligations}
              averageWeeklyExpense={forecast.averageWeeklyExpense}
              startDate={now}
            />
          ) : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  title: {
    flexShrink: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    padding: Spacing.four,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
});
