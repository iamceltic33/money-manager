import { showErrorToast } from '@/shared/model/toast-store';
import { create } from 'zustand';

import {
  createLocalTransaction,
  deleteLocalTransaction,
  getLocalBalance,
  getLocalTransactions,
  updateLocalTransaction,
} from '../api/transactions';
import type {
  CreateLocalTransactionParams,
  LocalTransaction,
  LocalTransactionType,
  UpdateLocalTransactionParams,
} from './types';

type CreateTransactionParams = Omit<CreateLocalTransactionParams, 'amount' | 'type' | 'userId'>;
type UpdateTransactionParams = Omit<UpdateLocalTransactionParams, 'userId'>;

type Store = {
  userId: string | null;
  balance: number;
  history: LocalTransaction[];
  initialized: boolean;
  init: (userId: string) => Promise<void>;
  reset: () => void;
  refresh: () => Promise<void>;
  createTransaction: (
    balance: number,
    type: LocalTransactionType,
    params?: CreateTransactionParams
  ) => Promise<void>;
  updateTransaction: (params: UpdateTransactionParams) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  getTransaction: (id: string) => LocalTransaction | null;
};

async function getLocalSummary(userId: string) {
  const [balance, history] = await Promise.all([
    getLocalBalance(userId),
    getLocalTransactions(userId),
  ]);

  return { balance, history };
}

function getRequiredUserId() {
  const userId = useTransactionsStore.getState().userId;

  if (!userId) {
    throw new Error('Пользователь не выбран');
  }

  return userId;
}

export const useTransactionsStore = create<Store>((set, get) => ({
  userId: null,
  balance: 0,
  history: [],
  initialized: false,
  init: async (userId) => {
    if (get().initialized && get().userId === userId) return;

    try {
      const { balance, history } = await getLocalSummary(userId);

      set({
        userId,
        balance,
        history,
        initialized: true,
      });
    } catch (error) {
      showErrorToast(error, 'Не удалось загрузить локальные данные');
    }
  },
  reset: () => {
    set({
      userId: null,
      balance: 0,
      history: [],
      initialized: false,
    });
  },
  refresh: async () => {
    try {
      const userId = getRequiredUserId();
      const { balance, history } = await getLocalSummary(userId);

      set({
        balance,
        history,
      });
    } catch (error) {
      showErrorToast(error, 'Не удалось обновить локальные данные');
    }
  },
  createTransaction: async (amount, type, params) => {
    try {
      const userId = getRequiredUserId();

      await createLocalTransaction({
        amount,
        type,
        userId,
        ...params,
      });

      const summary = await getLocalSummary(userId);

      set({
        ...summary,
        initialized: true,
      });
    } catch (error) {
      showErrorToast(
        error,
        type === 'income' ? 'Не удалось добавить доход' : 'Не удалось добавить расход'
      );
      throw error;
    }
  },
  updateTransaction: async (params) => {
    try {
      const userId = getRequiredUserId();

      await updateLocalTransaction({
        ...params,
        userId,
      });

      const summary = await getLocalSummary(userId);

      set({
        ...summary,
        initialized: true,
      });
    } catch (error) {
      showErrorToast(error, 'Не удалось обновить операцию');
      throw error;
    }
  },
  deleteTransaction: async (id) => {
    try {
      const userId = getRequiredUserId();

      await deleteLocalTransaction({
        id,
        userId,
      });

      const summary = await getLocalSummary(userId);

      set({
        ...summary,
        initialized: true,
      });
    } catch (error) {
      showErrorToast(error, 'Не удалось удалить операцию');
      throw error;
    }
  },
  getTransaction: (id) => {
    return get().history.find((item) => item.id === id) ?? null;
  },
}));
