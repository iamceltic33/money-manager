import { RefreshCw } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { useCategoryStore } from '@/entities/category';
import { useTransactionsStore } from '@/entities/transaction';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { showErrorToast, showSuccessToast } from '@/shared/model/toast-store';

import { synchronize } from '../model/synchronize';
import { useSyncStore } from '../model/sync-store';

type Props = { userId?: string };

export const SyncButton = ({ userId }: Props) => {
  const theme = useTheme();
  const busy = useSyncStore(state => Boolean(userId && state.activeUsers[userId]));
  const currentUser = useRef(userId);

  useEffect(() => {
    currentUser.current = userId;
    return () => { currentUser.current = undefined; };
  }, [userId]);

  const handlePress = async () => {
    if (!userId || useSyncStore.getState().activeUsers[userId]) return;

    try {
      await synchronize(userId);
      if (currentUser.current === userId) showSuccessToast('Синхронизация завершена');
    } catch (error) {
      if (currentUser.current === userId) showErrorToast(error);
    } finally {
      if (currentUser.current === userId) {
        await Promise.all([
          useCategoryStore.getState().userId === userId && useCategoryStore.getState().refresh(),
          useTransactionsStore.getState().userId === userId && useTransactionsStore.getState().refresh(),
        ]);
      }
    }
  };

  return (
    <Pressable
      accessibilityLabel={busy ? 'Синхронизация выполняется' : 'Синхронизировать данные'}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy || !userId, busy }}
      disabled={busy || !userId}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}
    >
      {busy
        ? <ActivityIndicator size="small" color={theme.text} />
        : <RefreshCw size={22} strokeWidth={2.2} color={theme.text} />}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.72 },
});
