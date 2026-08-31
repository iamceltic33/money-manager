import { initializeLocalUser } from '@/shared/api/local-db';
import { useCategoryStore } from '@/entities/category';
import { useTransactionsStore } from '@/entities/transaction';
import { useAuthStore } from '@/features/auth';
import { showErrorToast } from '@/shared/model/toast-store';
import { ThemedView } from '@/shared/ui/themed-view';
import { AppHeader } from '@/widgets/app-header';
import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';

export default function TabLayout() {
  const { session } = useAuthStore();
  const {
    userId: transactionsUserId,
    initialized: transactionsInitialized,
    init: initTransactions,
  } = useTransactionsStore();
  const {
    userId: categoriesUserId,
    initialized: categoriesInitialized,
    init: initCategories,
  } = useCategoryStore();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;

    const currentUserId = userId;
    let isActive = true;

    async function prepareLocalData() {
      try {
        await initializeLocalUser(currentUserId);

        if (!isActive) return;

        if (!transactionsInitialized || transactionsUserId !== currentUserId) {
          await initTransactions(currentUserId);
        }

        if (!categoriesInitialized || categoriesUserId !== currentUserId) {
          await initCategories(currentUserId);
        }
      } catch (error) {
        showErrorToast(error, 'Не удалось подготовить локальные данные');
      }
    }

    prepareLocalData();

    return () => {
      isActive = false;
    };
  }, [
    categoriesInitialized,
    categoriesUserId,
    initCategories,
    initTransactions,
    transactionsInitialized,
    transactionsUserId,
    userId,
  ]);

  if (!session) return <Redirect href="/auth" />;

  return (
    <ThemedView style={{ flex: 1 }}>
      <AppHeader />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemedView>
  );
}
