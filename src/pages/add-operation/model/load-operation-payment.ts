import { getLocalObligations, getLocalObligationPayments } from '@/entities/obligation';
import type { TransactionFormValues } from '@/features/transaction/save-transaction';

export async function loadOperationPayment(userId: string, paymentId: string): Promise<Partial<TransactionFormValues>> {
  const [parents, payments] = await Promise.all([
    getLocalObligations(userId),
    getLocalObligationPayments(userId),
  ]);
  const payment = payments.find(row => row.id === paymentId && !row.transaction_id && !row.remote_deleted);
  const parent = parents.find(row => row.id === payment?.obligation_id && !row.remote_deleted);
  if (!payment || !parent) throw new Error('Платёж недоступен');

  return {
    obligationPaymentId: payment.id,
    amount: payment.amount,
    categoryId: parent.category_id,
  };
}
