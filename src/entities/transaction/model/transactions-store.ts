import { beginAppTask } from '@/shared/model/restart-guard';
import { showErrorToast } from '@/shared/model/toast-store';
import { create } from 'zustand';

import {
  createLocalTransaction,
  deleteLocalTransaction,
  getLocalBalance,
  getLocalTransactionsPage,
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
  recentTransactions: LocalTransaction[];
  revision: number;
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
};

async function getLocalSummary(userId: string) {
  const [balance, page] = await Promise.all([
    getLocalBalance(userId),
    getLocalTransactionsPage({ userId, limit: 20 }),
  ]);

  return { balance, recentTransactions: page.items };
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
  recentTransactions: [],
  revision: 0,
  initialized: false,
  init: async (userId) => {
    if (get().initialized && get().userId === userId) return;

    set({ userId });

    try {
      const { balance, recentTransactions } = await getLocalSummary(userId);
      if (get().userId !== userId) return;

      set({
        userId,
        balance,
        recentTransactions,
        revision: get().revision + 1,
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
      recentTransactions: [],
      revision: get().revision + 1,
      initialized: false,
    });
  },
  refresh: async () => {
    try {
      const userId = getRequiredUserId();
      const { balance, recentTransactions } = await getLocalSummary(userId);
      if (get().userId !== userId) return;

      set({
        balance,
        recentTransactions,
        revision: get().revision + 1,
      });
    } catch (error) {
      showErrorToast(error, 'Не удалось обновить локальные данные');
    }
  },
  createTransaction: async (amount, type, params) => {
    const finish = beginAppTask();
    try {
      const userId = getRequiredUserId();

      await createLocalTransaction({
        amount,
        type,
        userId,
        ...params,
      });

      const summary = await getLocalSummary(userId);
      if (get().userId !== userId) return;

      set({
        ...summary,
        revision: get().revision + 1,
        initialized: true,
      });
    } catch (error) {
      showErrorToast(
        error,
        type === 'income' ? 'Не удалось добавить доход' : 'Не удалось добавить расход'
      );
      throw error;
    } finally {
      finish();
    }
  },
  updateTransaction: async (params) => {
    const finish = beginAppTask();
    try {
      const userId = getRequiredUserId();

      await updateLocalTransaction({
        ...params,
        userId,
      });

      const summary = await getLocalSummary(userId);
      if (get().userId !== userId) return;

      set({
        ...summary,
        revision: get().revision + 1,
        initialized: true,
      });
    } catch (error) {
      showErrorToast(error, 'Не удалось обновить операцию');
      throw error;
    } finally {
      finish();
    }
  },
  deleteTransaction: async (id) => {
    const finish = beginAppTask();
    try {
      const userId = getRequiredUserId();

      await deleteLocalTransaction({
        id,
        userId,
      });

      const summary = await getLocalSummary(userId);
      if (get().userId !== userId) return;

      set({
        ...summary,
        revision: get().revision + 1,
        initialized: true,
      });
    } catch (error) {
      showErrorToast(error, 'Не удалось удалить операцию');
      throw error;
    } finally {
      finish();
    }
  },
}));
