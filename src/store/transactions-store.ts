import {
    createLocalTransaction,
    getLocalBalance,
    getLocalTransactions,
} from '@/shared/local-db/transactions';
import type { LocalTransaction, LocalTransactionType } from '@/shared/local-db/types';
import { showErrorToast } from '@/store/toast-store';
import { create } from 'zustand';

type Store = {
    balance: number;
    history: LocalTransaction[];
    initialized: boolean;
    init: () => Promise<void>;
    refresh: () => Promise<void>;
    createTransaction: (balance: number, type: LocalTransactionType) => Promise<void>;
}

async function getLocalSummary() {
    const [balance, history] = await Promise.all([
        getLocalBalance(),
        getLocalTransactions(),
    ]);

    return { balance, history };
}

export const useTransactionsStore = create<Store>((set) => ({
    balance: 0,
    history: [],
    initialized: false,
    init: async () => {
        try {
            const { balance, history } = await getLocalSummary();

            set({
                balance,
                history,
                initialized: true,
            });
        } catch (error) {
            showErrorToast(error, 'Не удалось загрузить локальные данные');
        }
    },
    refresh: async () => {
        try {
            const { balance, history } = await getLocalSummary();

            set({
                balance,
                history,
            });
        } catch (error) {
            showErrorToast(error, 'Не удалось обновить локальные данные');
        }
    },
    createTransaction: async (amount, type) => {
        try {
            await createLocalTransaction({
                amount,
                type,
            });

            const summary = await getLocalSummary();

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
    }
}));
