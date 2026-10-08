import type { LocalSyncStatus } from '@/entities/transaction/model/types';

export type ObligationPaymentMode = 'fixed' | 'manual';
/** Local calendar date in YYYY-MM-DD format; do not parse it as a UTC timestamp. */
export type CalendarDate = string;

type LocalSyncFields = {
  id: string;
  user_id: string;
  remote_id: string | null;
  created_at: string;
  updated_at: string;
  sync_status: LocalSyncStatus;
  sync_error: string | null;
  remote_updated_at: string | null;
  local_revision: number;
  remote_deleted: 0 | 1;
};

export type LocalObligation = LocalSyncFields & {
  name: string;
  category_id: string | null;
  first_payment_date: CalendarDate;
  last_payment_date: CalendarDate;
} & (
  | { payment_mode: 'fixed'; monthly_amount: number; payment_day: number }
  | { payment_mode: 'manual'; monthly_amount: null; payment_day: null }
);

export type LocalObligationPayment = LocalSyncFields & {
  obligation_id: string;
  due_date: CalendarDate;
  amount: number;
  // NULL = planned/unpaid. One actual expense can settle only one monthly payment.
  transaction_id: string | null;
};
