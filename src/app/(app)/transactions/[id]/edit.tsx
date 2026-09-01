import { useTransactionsStore } from '@/entities/transaction';
import { TransactionForm, type TransactionFormValues } from '@/features/transaction/save-transaction';
import { MaxContentWidth, Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EditTransactionPage() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const { getTransaction, updateTransaction } = useTransactionsStore();
  const transaction = getTransaction(params.id);
  const router = useRouter();

  const onSubmit = async (_values: TransactionFormValues) => {
    const { note, amount, date, categoryId } = _values;
    try {
      await updateTransaction({
        id: params.id, note, amount, occurredAt: date, categoryId
      });
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } catch {

    }
  };

  if (!transaction) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView edges={['bottom']} style={styles.content}>
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.backgroundSelected,
              },
            ]}
          >
            <View style={[styles.emptyIcon, { backgroundColor: theme.background }]}>
              <SearchX color={theme.textSecondary} size={32} strokeWidth={2.3} />
            </View>
            <ThemedText type="smallBold">Транзакция не найдена</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              Возможно, операция была удалена или еще не загружена.
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['bottom']} style={styles.content}>
        <TransactionForm
          type={transaction.type}
          onSubmit={onSubmit}
          buttonText="Сохранить изменения"
          notePlaceholder="Добавь заметку"
          title="Редактировать операцию"
          description="Измени данные операции и сохрани обновленную версию."
          defaultValues={{
            amount: transaction.amount,
            categoryId: transaction.category_id,
            date: new Date(transaction.occurred_at),
            note: transaction.note,
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  emptyCard: {
    minHeight: 220,
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  emptyText: {
    textAlign: 'center',
  },
});
