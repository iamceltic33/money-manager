import {
    createLocalTransaction,
    getLocalBalance,
    getLocalTransactions,
} from '@/shared/local-db/transactions';
import type { LocalTransaction, LocalTransactionType } from '@/shared/local-db/types';
import { showErrorToast } from '@/store/toast-store';
import { create } from 'zustand';

type Store = {
    amount: number;
    history: LocalTransaction[];
    initialized: boolean;
    init: () => Promise<void>;
    refresh: () => Promise<void>;
    changeAmount: (amount: number, type: LocalTransactionType) => Promise<void>;
}

async function getLocalSummary() {
    const [amount, history] = await Promise.all([
        getLocalBalance(),
        getLocalTransactions(),
    ]);

    return { amount, history };
}

export const useBaseStore = create<Store>((set) => ({
    amount: 0,
    history: [],
    initialized: false,
    init: async () => {
        try {
            const { amount, history } = await getLocalSummary();

            set({
                amount,
                history,
                initialized: true,
            });
        } catch (error) {
            showErrorToast(error, 'Не удалось загрузить локальные данные');
        }
    },
    refresh: async () => {
        try {
            const { amount, history } = await getLocalSummary();

            set({
                amount,
                history,
            });
        } catch (error) {
            showErrorToast(error, 'Не удалось обновить локальные данные');
        }
    },
    changeAmount: async (amount, type) => {
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
