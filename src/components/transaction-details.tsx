import { ArrowDownLeft, ArrowUpRight, Database, ReceiptText } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LocalTransaction } from '@/shared/local-db/types';

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

const syncStatusLabels: Record<LocalTransaction['sync_status'], string> = {
  pending: 'Ожидает синхронизации',
  synced: 'Синхронизировано',
  failed: 'Ошибка синхронизации',
};

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

function DetailRow(props: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { borderColor: theme.backgroundSelected }]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.rowLabel}>
        {props.label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.rowValue}>
        {props.value}
      </ThemedText>
    </View>
  );
}

export function TransactionDetails({ transaction }: Props) {
  const theme = useTheme();
  const isIncome = transaction.type === 'income';
  const Icon = isIncome ? ArrowDownLeft : ArrowUpRight;

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
            <Icon
              color={isIncome ? styles.incomeText.color : styles.expenseText.color}
              size={28}
              strokeWidth={2.4}
            />
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
          <DetailRow label="ID" value={transaction.id} />
          <DetailRow label="Remote ID" value={formatNullableValue(transaction.remote_id)} />
          <DetailRow label="Тип" value={typeLabels[transaction.type]} />
          <DetailRow label="Сумма" value={`${currencyFormatter.format(transaction.amount)} KZT`} />
          <DetailRow label="Категория" value={formatNullableValue(transaction.category_id)} />
          <DetailRow label="Дата операции" value={formatDate(transaction.occurred_at)} />
          <DetailRow label="Создано" value={formatDate(transaction.created_at)} />
          <DetailRow label="Обновлено" value={formatDate(transaction.updated_at)} />
        </View>

        <View style={[styles.syncBlock, { borderColor: theme.backgroundSelected }]}>
          <Database color={theme.textSecondary} size={20} strokeWidth={2.3} />
          <View style={styles.syncContent}>
            <ThemedText type="small" themeColor="textSecondary">
              Статус синхронизации
            </ThemedText>
            <ThemedText type="smallBold">
              {syncStatusLabels[transaction.sync_status]}
            </ThemedText>
            {transaction.sync_error ? (
              <ThemedText type="small" style={styles.expenseText}>
                {transaction.sync_error}
              </ThemedText>
            ) : null}
          </View>
        </View>
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
  row: {
    minHeight: 44,
    borderTopWidth: 1,
    paddingTop: Spacing.two,
    gap: Spacing.half,
  },
  rowLabel: {
    textTransform: 'uppercase',
  },
  rowValue: {
    flexShrink: 1,
  },
  syncBlock: {
    borderTopWidth: 1,
    paddingTop: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  syncContent: {
    flex: 1,
    gap: Spacing.half,
  },
  incomeText: {
    color: '#16A34A',
  },
  expenseText: {
    color: '#DC2626',
  },
});
