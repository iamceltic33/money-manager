import type { LocalTransactionType } from '@/entities/transaction';
import type { TransactionDraft } from './transaction-draft';

export function switchTransactionDraftType(
  draft: TransactionDraft,
  currentType: LocalTransactionType,
  nextType: LocalTransactionType,
): TransactionDraft {
  if (currentType === nextType) return draft;

  return {
    ...draft,
    categoryId: null,
    obligationPaymentId: nextType === 'income' ? null : draft.obligationPaymentId,
  };
}
