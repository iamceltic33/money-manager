import {
  ArrowDownLeft,
  ArrowUpRight,
  ReceiptText,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { CategoryIcon, useCategoryStore } from '@/entities/category';
import { MaxContentWidth, Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';
import type { LocalTransaction } from '../model/types';
import { Footer } from './transaction-details-footer';
import { DetailRow } from './transaction-details-row';
type Props = {
  transaction: LocalTransaction;
};
const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
});
const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const typeLabels: Record<LocalTransaction['type'], string> = {
  income: 'Доход',
  expense: 'Расход',
};
function formatNullableValue(value: string | null) {
  return value ?? 'Не указано';
}
function formatDate(value: string) {
  return dateTimeFormatter.format(new Date(value));
}
export function TransactionDetails({ transaction }: Props) {
  const theme = useTheme();
  const isIncome = transaction.type === 'income';
  const Icon = isIncome ? ArrowDownLeft : ArrowUpRight;
  const category = useCategoryStore((state) => state.getCategoryById(transaction.category_id));
  const accentColor = isIncome ? styles.incomeText.color : styles.expenseText.color;
  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.content,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundSelected,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={[styles.iconBadge, { backgroundColor: theme.background }]}>
            {category ? (
              <CategoryIcon color={category.color ?? accentColor} name={category.icon} />
            ) : (
              <Icon color={accentColor} size={28} strokeWidth={2.4} />
            )}
          </View>
          <View style={styles.headerText}>
            <ThemedText type="small" themeColor="textSecondary">
              {typeLabels[transaction.type]}
            </ThemedText>
            <ThemedText
              type="subtitle"
              style={[styles.amount, isIncome ? styles.incomeText : styles.expenseText]}
            >
              {isIncome ? '+' : '-'} {currencyFormatter.format(transaction.amount)} KZT
            </ThemedText>
          </View>
        </View>
        <View style={styles.noteBlock}>
          <ReceiptText color={theme.textSecondary} size={20} strokeWidth={2.3} />
          <View style={styles.noteContent}>
            <ThemedText type="small" themeColor="textSecondary">
              Заметка
            </ThemedText>
            <ThemedText type="default">
              {formatNullableValue(transaction.note)}
            </ThemedText>
          </View>
        </View>
        <View style={styles.details}>
          {category?.name && <DetailRow label="Категория" value={category.name} />}
          <DetailRow label="Тип" value={typeLabels[transaction.type]} />
          <DetailRow label="Сумма" value={`${currencyFormatter.format(transaction.amount)} KZT`} />
          <DetailRow label="Дата операции" value={formatDate(transaction.occurred_at)} />
        </View>
      <Footer id={transaction.id}/>
      </View>
    </ThemedView>
  );
}
const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  amount: {
    fontSize: 30,
    lineHeight: 38,
  },
  noteBlock: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  noteContent: {
    flex: 1,
    gap: Spacing.half,
  },
  details: {
    gap: Spacing.two,
  },
  incomeText: {
    color: '#16A34A',
  },
  expenseText: {
    color: '#DC2626',
  },
});
