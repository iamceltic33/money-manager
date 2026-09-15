import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MaxContentWidth, Spacing } from '@/shared/config/theme';
import { useCategoryStore } from '@/entities/category';
import { useTransactionsStore } from '@/entities/transaction';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';
import { useTheme } from '@/shared/lib/theme/use-theme';

import { getFundsDepletionForecast } from '../model/get-funds-depletion-forecast';
import { FundsDepletionForecast } from './funds-depletion-forecast';
import { WeeklyExpenseForecast } from './weekly-expense-forecast';

export function ForecastsPage() {
  const router = useRouter();
  const theme = useTheme();
  const history = useTransactionsStore((state) => state.history);
  const balance = useTransactionsStore((state) => state.balance);
  const transactionsInitialized = useTransactionsStore((state) => state.initialized);
  const categories = useCategoryStore((state) => state.categories);
  const categoriesInitialized = useCategoryStore((state) => state.initialized);
  const [now, setNow] = useState(() => new Date());

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  useFocusEffect(useCallback(() => {
    setNow(new Date());
  }, []));

  const forecast = useMemo(() => {
    if (!transactionsInitialized || !categoriesInitialized) {
      return { estimatedDate: null, unavailableMessage: 'Загрузка данных…' };
    }

    return getFundsDepletionForecast({ history, categories, balance, now });
  }, [history, categories, balance, now, transactionsInitialized, categoriesInitialized]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Назад"
              accessibilityRole="button"
              onPress={goBack}
              style={({ pressed }) => [
                styles.backButton,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}
            >
              <ChevronLeft color={theme.text} size={22} strokeWidth={2.4} />
            </Pressable>
            <ThemedText type="subtitle" style={styles.title}>Прогнозы</ThemedText>
          </View>
          <FundsDepletionForecast {...forecast} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.78,
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
