import { memo } from 'react';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { CategoryIcon, type LocalCategory } from '@/entities/category';
import { Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { ThemedText } from '@/shared/ui/themed-text';
import type { LocalTransaction } from '../model/types';

export const TransactionRow = memo(function TransactionRow({ transaction, category }: {
  transaction: LocalTransaction; category?: LocalCategory;
}) {
  const theme = useTheme();
  const income = transaction.type === 'income';
  const accent = income ? '#16A34A' : '#DC2626';
  return (
    <Link href={`/transactions/${transaction.id}`} asChild>
      <Pressable style={styles.pressable}>
        {({ pressed }) => (
          <View style={[styles.row, pressed && styles.pressed]}>
            <View style={[styles.icon, { backgroundColor: theme.background }]}>
              <CategoryIcon color={category?.color ?? accent} name={category?.icon} />
            </View>
            <View style={styles.text}>
              <ThemedText numberOfLines={1} type="smallBold">{category?.name ?? (income ? 'Доход' : 'Расход')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{new Date(transaction.occurred_at).toLocaleDateString()}</ThemedText>
            </View>
            <ThemedText numberOfLines={1} type="smallBold" style={{ color: accent, flexShrink: 0 }}>
              {income ? '+' : '-'} {transaction.amount}
            </ThemedText>
          </View>
        )}
      </Pressable>
    </Link>
  );
});

const styles = StyleSheet.create({
  pressable: { width: '100%' },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  icon: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: Spacing.half },
  pressed: { opacity: 0.78 },
});
