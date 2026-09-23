import { useEffect, type PropsWithChildren } from 'react';

import { useCategoryStore } from '@/entities/category';
import { useTransactionsStore } from '@/entities/transaction';
import { useAuthStore } from '@/features/auth';
import { synchronize } from '@/features/sync';
import { showErrorToast } from '@/shared/model/toast-store';

export const LocalDataProvider = ({ children }: PropsWithChildren) => {
  const userId = useAuthStore(state => state.session?.user.id);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    const prepare = async () => {
      await Promise.all([
        useCategoryStore.getState().init(userId),
        useTransactionsStore.getState().init(userId),
      ]);
      if (!active) return;

      try {
        await synchronize(userId);
      } catch (error) {
        if (active) showErrorToast(error, 'Не удалось синхронизировать данные');
      } finally {
        if (active && useAuthStore.getState().session?.user.id === userId) {
          await Promise.all([
            useCategoryStore.getState().refresh(),
            useTransactionsStore.getState().refresh(),
          ]);
        }
      }
    };

    void prepare();
    return () => { active = false; };
  }, [userId]);

  return children;
};
