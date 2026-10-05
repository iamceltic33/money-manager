import { useEffect, useState, type PropsWithChildren } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import { useCategoryStore } from '@/entities/category';
import { useTransactionsStore } from '@/entities/transaction';
import { useAuthStore } from '@/features/auth';
import { synchronize } from '@/features/sync';
import { showErrorToast } from '@/shared/model/toast-store';
import { StartupScreen } from '@/shared/ui/startup-screen';

type StartupState = {
  userId: string;
  status: 'ready' | 'error';
};

export const LocalDataProvider = ({ children }: PropsWithChildren) => {
  const userId = useAuthStore(state => state.session?.user.id);
  const [startup, setStartup] = useState<StartupState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const status = startup?.userId === userId ? startup?.status : undefined;

  useEffect(() => {
    if (!userId) return;
    let active = true;

    const prepare = async () => {
      const results = await Promise.allSettled([
        useCategoryStore.getState().init(userId),
        useTransactionsStore.getState().init(userId),
      ]);
      if (!active || useAuthStore.getState().session?.user.id !== userId) return;

      // Store init handlers show their own errors and may resolve without initializing.
      const categories = useCategoryStore.getState();
      const transactions = useTransactionsStore.getState();
      if (results.some(result => result.status === 'rejected')
        || !categories.initialized || categories.userId !== userId
        || !transactions.initialized || transactions.userId !== userId) {
        setStartup({ userId, status: 'error' });
        return;
      }

      setStartup({ userId, status: 'ready' });

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
  }, [userId, attempt]);

  const retry = () => {
    setStartup(null);
    setAttempt(value => value + 1);
  };

  const onLayout = () => {
    if (status) SplashScreen.hide();
  };

  return (
    <View key={status ?? 'loading'} style={{ flex: 1 }} onLayout={onLayout}>
      {status === 'ready' ? children : <StartupScreen onRetry={status === 'error' ? retry : undefined} />}
    </View>
  );
};
