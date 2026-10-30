export type TransactionFormValues = {
  note: string | null;
  amount: number;
  categoryId: string | null;
  date: Date;
  excludeFromAverage?: boolean;
  obligationPaymentId?: string | null;
};

export type TransactionFormSubmitResult = 'success' | 'error';
