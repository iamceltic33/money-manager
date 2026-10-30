/** Editable field values; parse the amount only when submitting the form. */
export type TransactionDraft = {
  amountText: string;
  date: Date;
  note: string;
  categoryId: string | null;
  obligationPaymentId: string | null;
  excludeFromAverage: boolean;
};
