import { Info } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LocalTransaction } from '@/shared/local-db/types';
import { Link } from 'expo-router';

type Props = {
  transactions: LocalTransaction[]
}

export function TransactionsPreview(props: Props) {
  const theme = useTheme();
  const { transactions } = props;

  return (
    <ThemedView
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.backgroundSelected,
        },
      ]}
    >
      <View style={styles.header}>
        <View>
          <ThemedText type="smallBold">Последние операции</ThemedText>
        </View>
      </View>

      <View style={styles.list}>
        {transactions.map((item, index) => {
          const isIncome = item.type === 'income';
          return <View key={item.id}>
            <Link href={`/transactions/${item.id}`} asChild>
              <Pressable>
                <View style={styles.row}>
                  <View style={[styles.iconBadge, { backgroundColor: theme.background }]}>
                    <Info color={isIncome ? styles.incomeAmount.color : styles.expenseAmount.color} size={20} strokeWidth={2.4} />
                  </View>
                  <View style={styles.rowContent}>
                    {item.category_id && <ThemedText type="smallBold">{item.category_id}</ThemedText>}
                    <ThemedText type="small" themeColor="textSecondary">
                      {(new Date(item.occurred_at)).toLocaleDateString()}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold" style={isIncome ? styles.incomeAmount : styles.expenseAmount}>
                    {item.type === 'income' ? '+' : '-'} {item.amount}
                  </ThemedText>
                </View>
              </Pressable>
            </Link>
            {(index !== transactions.length - 1) && <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />}
          </View>
        })}
      </View>
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
    justifyContent: 'space-between',
  },
  list: {
    gap: Spacing.three,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    gap: Spacing.half,
  },
  incomeAmount: {
    color: '#16A34A',
  },
  expenseAmount: {
    color: '#DC2626',
  },
  divider: {
    height: 1,
    opacity: 0.7,
  },
});
