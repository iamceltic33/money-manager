import { QueryStatus } from '@/shared/ui/query-status';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { MaxContentWidth, Spacing } from '@/shared/config/theme';
import { useCategoryStore } from '@/entities/category';
import { getLocalTransactions, useTransactionResource, useTransactionsStore } from '@/entities/transaction';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';

import { getFundsDepletionForecast } from '../model/get-funds-depletion-forecast';
import { FundsDepletionForecast } from './funds-depletion-forecast';
import { WeeklyExpenseForecast } from './weekly-expense-forecast';

export function ForecastsPage() {
  const focused = useIsFocused();
  const { data: history, loading, error, retry } = useTransactionResource(getLocalTransactions, focused);
  const balance = useTransactionsStore((state) => state.balance);
  const transactionsInitialized = useTransactionsStore((state) => state.initialized);
  const categories = useCategoryStore((state) => state.categories);
  const categoriesInitialized = useCategoryStore((state) => state.initialized);
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(useCallback(() => {
    setNow(new Date());
  }, []));

  const forecast = useMemo(() => {
    if (!transactionsInitialized || !categoriesInitialized || !history) {
      return { estimatedDate: null, unavailableMessage: 'Загрузка данных…' };
    }

    return getFundsDepletionForecast({ history, categories, balance, now });
  }, [history, categories, balance, now, transactionsInitialized, categoriesInitialized]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <ThemedText type="subtitle" style={styles.title}>Прогнозы</ThemedText>
          {loading || error ? <QueryStatus loading={loading} error={error} retry={retry} /> : <FundsDepletionForecast {...forecast} />}
          {forecast.averageWeeklyExpense !== undefined ? (
            <WeeklyExpenseForecast
              balance={balance}
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
