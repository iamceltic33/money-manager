import { useCallback, useRef, useState } from 'react';
import { useTransactionResource, useTransactionsStore, type LocalTransactionType } from '@/entities/transaction';
import { createTransactionDraft, switchTransactionDraftType, TransactionForm, type TransactionFormSubmitResult, type TransactionFormValues } from '@/features/transaction/save-transaction';
import { MaxContentWidth, Spacing } from '@/shared/config/theme';
import { goBack } from '@/shared/lib/navigation/go-back';
import { showSuccessToast } from '@/shared/model/toast-store';
import { ThemedView } from '@/shared/ui/themed-view';
import { QueryStatus } from '@/shared/ui/query-status';
import { OperationSwitcher } from '@/widgets/operation-switcher';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadOperationPayment } from '../model/load-operation-payment';

export function AddOperationPage() {
  const params = useLocalSearchParams<{ type?: string | string[]; paymentId?: string | string[] }>();
  const requestedType = Array.isArray(params.type) ? params.type[0] : params.type;
  const initialType = requestedType === 'income' ? 'income' : 'expense';
  const requestedPaymentId = Array.isArray(params.paymentId) ? params.paymentId[0] : params.paymentId;
  const paymentId = initialType === 'expense' ? requestedPaymentId : undefined;
  const userId = useTransactionsStore(state => state.userId);

  return paymentId
    ? <PaymentOperationLoader key={`${userId}:${paymentId}`} paymentId={paymentId} />
    : <AddOperationForm key={userId} initialType={initialType} />;
}

function PaymentOperationLoader({ paymentId }: { paymentId: string }) {
  const load = useCallback((userId: string) => loadOperationPayment(userId, paymentId), [paymentId]);
  // Freeze the loaded defaults: background sync must not remount the form or reset edits.
  const resource = useTransactionResource(load, true, false);
  if (resource.loading || resource.error || !resource.data) {
    return <ThemedView style={styles.container}>
      <QueryStatus loading={resource.loading} error={resource.error} retry={resource.retry} errorMessage="Не удалось загрузить платёж" />
    </ThemedView>;
  }

  return <AddOperationForm defaultValues={resource.data} />;
}

function AddOperationForm({ defaultValues, initialType = 'expense' }: { defaultValues?: Partial<TransactionFormValues>; initialType?: LocalTransactionType }) {
  const createTransaction = useTransactionsStore(state => state.createTransaction);
  const router = useRouter();
  const [{ type, draft }, setOperation] = useState(() => ({
    type: initialType,
    draft: createTransactionDraft(defaultValues),
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionPendingRef = useRef(false);
  const lifecycleRef = useRef({ active: true, completed: false });

  useFocusEffect(useCallback(() => {
    lifecycleRef.current.active = true;
    if (lifecycleRef.current.completed) {
      goBack(router, '/add-operation');
    } else {
      setIsSubmitting(submissionPendingRef.current);
    }
    return () => { lifecycleRef.current.active = false; };
  }, [router]));

  const changeType = (nextType: LocalTransactionType) => {
    if (!lifecycleRef.current.active || lifecycleRef.current.completed || submissionPendingRef.current) return;
    setOperation(current => current.type === nextType ? current : {
      type: nextType,
      draft: switchTransactionDraftType(current.draft, current.type, nextType),
    });
  };

  const addOperation = async ({ amount, date, categoryId, note, excludeFromAverage, obligationPaymentId }: TransactionFormValues): Promise<TransactionFormSubmitResult> => {
    if (!lifecycleRef.current.active || lifecycleRef.current.completed || submissionPendingRef.current) return 'error';
    submissionPendingRef.current = true;
    setIsSubmitting(true);
    try {
      const submittedType = type;
      const submittedValues = {
        occurredAt: new Date(date.getTime()),
        categoryId,
        note,
        ...(submittedType === 'expense' ? { excludeFromAverage, obligationPaymentId } : {}),
      };
      await createTransaction(amount, submittedType, submittedValues);
      lifecycleRef.current.completed = true;
    } catch {
      // The store has already shown the save error. Keep the draft available for retry.
      return 'error';
    } finally {
      submissionPendingRef.current = false;
      if (lifecycleRef.current.active && !lifecycleRef.current.completed) setIsSubmitting(false);
    }

    if (lifecycleRef.current.active) {
      showSuccessToast(type === 'expense' ? 'Расход добавлен' : 'Доход добавлен');
      goBack(router, '/add-operation');
    }
    return 'success';
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['bottom']} style={styles.content}>
        <OperationSwitcher type={type} onTypeChange={changeType} disabled={isSubmitting} />
        <TransactionForm
          type={type}
          draft={draft}
          onDraftChange={update => {
            if (!lifecycleRef.current.active || lifecycleRef.current.completed) return;
            setOperation(current => ({
              ...current,
              draft: typeof update === 'function' ? update(current.draft) : update,
            }));
          }}
          isSubmitting={isSubmitting}
          onSubmit={addOperation}
          buttonText={type === 'expense' ? 'Добавить расход' : 'Добавить доход'}
          notePlaceholder={type === 'expense' ? 'Например, продукты или такси' : 'Например, зарплата или подарок'}
          title={type === 'expense' ? 'Добавить расход' : 'Добавить доход'}
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
    paddingTop: Spacing.five,
    gap: Spacing.three,
  },
});
