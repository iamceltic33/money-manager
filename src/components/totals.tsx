import { Wallet } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

type TotalsProps = {
  balance: number;
  sources?: {
    title: string;
    balance: number;
  }[];
}

export function Totals(props: TotalsProps) {
  const theme = useTheme();

  const formattedBalance = useMemo(
    () =>
      new Intl.NumberFormat('ru-RU', {
        maximumFractionDigits: 0,
      }).format(props.balance),
    [props.balance]
  );

  const otherTotal: number | null = useMemo(() => {
    if (!props.sources || props.sources.length === 0) return null;

    return props.balance - props.sources
      .map((item) => item.balance)
      .reduce((accumulator, current) => accumulator + current, 0);
  }, [props.balance, props.sources]);

  return (
    <ThemedView
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.backgroundSelected,
          marginTop: Spacing.two
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconBadge, { backgroundColor: theme.background }]}>
          <Wallet color="#2563EB" size={22} strokeWidth={2.4} />
        </View>

        <View style={styles.headerText}>
          <ThemedText type="smallBold">Общий баланс</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Текущий результат
          </ThemedText>
        </View>
      </View>

      <View style={styles.balanceBlock}>
        <ThemedText style={styles.balance}>
          {formattedBalance}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="textSecondary">
          KZT
        </ThemedText>
      </View>

      {props.sources && props.sources.length > 0 ? (
        <View style={styles.sources}>
          <ThemedText type="smallBold">Источники</ThemedText>
          {props.sources.map((source, index) => (
            <View key={`${source.title}-${index}`} style={styles.sourceRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {source.title}
              </ThemedText>
              <ThemedText type="smallBold">
                {source.balance}
              </ThemedText>
            </View>
          ))}

          {otherTotal !== null ? (
            <View style={styles.sourceRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Другие источники
              </ThemedText>
              <ThemedText type="smallBold">
                {otherTotal}
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 8,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  balanceBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  balance: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '800',
  },
  sources: {
    gap: Spacing.two,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
});
