import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { useCategoryStore } from '@/entities/category';
import { getLocalExpenseReport, useTransactionResource } from '@/entities/transaction';
import { MaxContentWidth, Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { DateField } from '@/shared/ui/date-field';
import { QueryStatus } from '@/shared/ui/query-status';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';
import { getReportRange, type ReportPeriod } from '../model/report-period';

const periods: { value: ReportPeriod; label: string }[] = [
  { value: 'week', label: 'Неделя' }, { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' }, { value: 'custom', label: 'Период' },
];
const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KZT', maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

export function ReportsPage() {
  const theme = useTheme();
  const focused = useIsFocused();
  const [now, setNow] = useState(() => new Date());
  const [period, setPeriod] = useState<ReportPeriod>('week');
  const [from, setFrom] = useState(() => getReportRange('week', new Date(), new Date(), new Date()).start);
  const [to, setTo] = useState(() => new Date());
  useFocusEffect(useCallback(() => { setNow(new Date()); }, []));
  const range = useMemo(() => getReportRange(period, now, from, to), [period, now, from, to]);
  const valid = range.start <= range.end;
  const load = useCallback((userId: string) => getLocalExpenseReport(userId, range.start, range.endExclusive), [range]);
  const { data, loading, error, retry } = useTransactionResource(load, focused && valid);
  const categories = useCategoryStore(state => state.categories);
  const categoriesInitialized = useCategoryStore(state => state.initialized);
  const rows = useMemo(() => (data ?? []).map(row => {
    const category = categories.find(item => item.id === row.categoryId);
    return { ...row, name: category?.name ?? 'Без категории', color: category?.color ?? '#64748B' };
  }), [data, categories]);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const count = rows.reduce((sum, row) => sum + row.count, 0);
  const largest = Math.max(0, ...rows.map(row => row.amount));

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAwareScrollView bottomOffset={Spacing.three} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <ThemedText type="subtitle">Отчёты</ThemedText>
          <View accessibilityRole="tablist" style={styles.periods}>
            {periods.map(item => (
              <Pressable key={item.value} accessibilityRole="tab" accessibilityState={{ selected: period === item.value }}
                onPress={() => setPeriod(item.value)}
                style={({ pressed }) => [styles.period, { backgroundColor: period === item.value ? theme.backgroundSelected : theme.backgroundElement }, pressed && styles.pressed]}>
                <ThemedText type="smallBold">{item.label}</ThemedText>
              </Pressable>
            ))}
          </View>
          {period === 'custom' ? <View style={styles.dates}>
            <DateField label="С даты" value={from} maximumDate={to < now ? to : now} onChange={setFrom} />
            <DateField label="По дату" value={to} minimumDate={from} maximumDate={now} onChange={setTo} />
          </View> : null}
          <ThemedText type="small" themeColor="textSecondary">{dateFormat.format(range.start)} — {dateFormat.format(range.end)}</ThemedText>
          {!valid ? <ThemedText>Начало периода должно быть не позже его окончания.</ThemedText>
            : loading || error || !categoriesInitialized ? <QueryStatus loading={loading || !categoriesInitialized} error={error} retry={retry} />
            : <>
              <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small" themeColor="textSecondary">Всего расходов</ThemedText>
                <ThemedText type="subtitle">{money.format(total)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Операций: {count}</ThemedText>
              </View>
              <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">Расходы по категориям</ThemedText>
                {rows.length === 0 ? <ThemedText themeColor="textSecondary">За этот период расходов нет.</ThemedText> : rows.map(row => {
                  const share = total > 0 ? row.amount / total * 100 : 0;
                  return <View key={row.categoryId ?? 'uncategorized'} style={styles.row} accessible
                    accessibilityLabel={`${row.name}: ${money.format(row.amount)}, ${share.toFixed(1)} процента расходов`}>
                    <View style={styles.labels}>
                      <ThemedText type="smallBold" style={styles.category}>{row.name}</ThemedText>
                      <ThemedText type="smallBold">{money.format(row.amount)}</ThemedText>
                    </View>
                    <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
                      <View style={[styles.bar, { backgroundColor: row.color, width: `${largest > 0 ? Math.max(0, row.amount) / largest * 100 : 0}%` }]} />
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">{share.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}% · Операций: {row.count}</ThemedText>
                  </View>;
                })}
              </View>
            </>}
        </View>
      </KeyboardAwareScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { alignItems: 'center', padding: Spacing.four, paddingBottom: Spacing.five },
  content: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  periods: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  period: { minHeight: 44, flexGrow: 1, paddingHorizontal: Spacing.three, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  pressed: { opacity: 0.75 },
  dates: { gap: Spacing.three },
  card: { padding: Spacing.four, borderRadius: 12, gap: Spacing.three },
  row: { gap: Spacing.two, paddingVertical: Spacing.two },
  labels: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.two },
  category: { flexGrow: 1, flexShrink: 1 },
  track: { height: 16, borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
});
