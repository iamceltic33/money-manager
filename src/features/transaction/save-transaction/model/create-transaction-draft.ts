import { formatTransactionAmountInput } from '@/entities/transaction/lib/amount';
import type { TransactionDraft } from './transaction-draft';
import type { TransactionFormValues } from './transaction-form-values';

export function createTransactionDraft(defaultValues?: Partial<TransactionFormValues>): TransactionDraft {
  return {
    amountText: defaultValues?.amount === undefined ? '' : formatTransactionAmountInput(defaultValues.amount),
    date: defaultValues?.date ?? new Date(),
    note: defaultValues?.note ?? '',
    categoryId: defaultValues?.categoryId ?? null,
    obligationPaymentId: defaultValues?.obligationPaymentId ?? null,
    excludeFromAverage: defaultValues?.excludeFromAverage ?? false,
  };
}
