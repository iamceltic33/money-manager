import { Link } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryIcon, useCategoryStore } from '@/entities/category';
import type { LocalTransaction } from '@/entities/transaction';
import { Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';

type Props = {
  transactions: LocalTransaction[]
}

export function TransactionsPreview(props: Props) {
  const theme = useTheme();
  const { transactions } = props;
  const categories = useCategoryStore((state) => state.categories);

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
        <ThemedText numberOfLines={1} type="smallBold" style={styles.headerTitle}>Последние операции</ThemedText>

        <Link href="/transactions" asChild>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.historyButton,
              { backgroundColor: theme.background },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.historyButtonContent}>
              <ThemedText numberOfLines={1} type="smallBold" style={styles.historyButtonText}>
                Все
              </ThemedText>
              <ChevronRight color="#2563EB" size={18} strokeWidth={2.4} />
            </View>
          </Pressable>
        </Link>
      </View>

      <View style={styles.list}>
        {transactions.map((item, index) => {
          const isIncome = item.type === 'income';
          const category = categories.find((value) => value.id === item.category_id);
          return <View key={item.id}>
            <Link href={`/transactions/${item.id}`} asChild>
              <Pressable>
                <View style={styles.row}>
                  <View style={[styles.iconBadge, { backgroundColor: theme.background }]}>
                    <CategoryIcon color={category?.color ?? (isIncome ? styles.incomeAmount.color : styles.expenseAmount.color)} name={category?.icon}/>
                  </View>
                  <View style={styles.rowContent}>
                    {category && <ThemedText type="smallBold">{category.name}</ThemedText>}
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
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
  },
  historyButton: {
    flexShrink: 0,
    height: 36,
    borderRadius: 8,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyButtonContent: {
    minWidth: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
  },
  historyButtonText: {
    color: '#2563EB',
    flexShrink: 0,
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
  pressed: {
    opacity: 0.78,
  },
});
