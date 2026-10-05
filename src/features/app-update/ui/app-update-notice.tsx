import { usePathname } from 'expo-router';
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { cancelRestart, tryBeginRestart, useRestartGuard } from '@/shared/model/restart-guard';
import { ThemedText } from '@/shared/ui/themed-text';

export function AppUpdateNotice() {
  if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return null;
  return <NativeUpdateNotice />;
}

function NativeUpdateNotice() {
  const theme = useTheme();
  const pathname = usePathname();
  const { isUpdatePending, isChecking, isDownloading, downloadedUpdate } = Updates.useUpdates();
  const busy = useRestartGuard(state => state.activeTasks > 0);
  const restarting = useRestartGuard(state => state.restarting);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checking = useRef(false);
  const lastCheck = useRef(0);
  const updateState = useRef({ isChecking, isDownloading, isUpdatePending });
  updateState.current = { isChecking, isDownloading, isUpdatePending };

  // The native ON_LOAD check handles startup. Check again on foreground, at most once per 5 minutes.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      const current = updateState.current;
      if (state !== 'active' || checking.current || current.isChecking || current.isDownloading
        || current.isUpdatePending || Date.now() - lastCheck.current < 5 * 60 * 1000) return;
      checking.current = true;
      lastCheck.current = Date.now();
      const check = async () => {
        try {
          const result = await Updates.checkForUpdateAsync();
          if (result.isAvailable || result.isRollBackToEmbedded) await Updates.fetchUpdateAsync();
        } catch {
          // Offline/update server errors must not interrupt finance workflows. Retry on a later foreground.
        } finally {
          checking.current = false;
        }
      };
      void check();
    });
    return () => subscription.remove();
  }, []);

  const restart = async () => {
    if (!tryBeginRestart()) return;
    setError(null);
    try {
      await Updates.reloadAsync();
    } catch {
      cancelRestart();
      setError('Не удалось перезапустить. Попробуйте ещё раз или откройте приложение позже.');
    }
  };

  // Do not offer to discard an unfinished transaction/category/auth form.
  const safeScreen = pathname === '/' || pathname === '/transactions' || pathname === '/forecasts';
  const visible = isUpdatePending && Boolean(downloadedUpdate) && !dismissed && safeScreen;

  return <>
    {visible && !restarting ? (
      <SafeAreaView edges={['bottom', 'left', 'right']} pointerEvents="box-none" style={styles.root}>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold" accessibilityLiveRegion="polite">Обновление готово</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {error ?? (busy ? 'Дождитесь завершения сохранения и синхронизации.' : 'Перезапустите приложение, чтобы применить обновление.')}
          </ThemedText>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => setDismissed(true)} style={styles.button}>
              <ThemedText type="smallBold">Позже</ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy}
              onPress={() => void restart()} style={[styles.button, styles.primary, busy && styles.disabled]}>
              <ThemedText type="smallBold" style={styles.primaryText}>Перезапустить</ThemedText>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    ) : null}
    <Modal visible={restarting} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ActivityIndicator />
          <ThemedText type="smallBold">Перезапускаем приложение…</ThemedText>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  root: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 900, elevation: 900, alignItems: 'center', padding: Spacing.three },
  card: { width: '100%', maxWidth: 520, borderRadius: 12, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two, flexWrap: 'wrap' },
  button: { minHeight: 44, paddingHorizontal: Spacing.three, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  primary: { backgroundColor: '#2563EB' },
  primaryText: { color: '#FFFFFF' },
  disabled: { opacity: 0.45 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four, backgroundColor: 'rgba(0,0,0,0.5)' },
});
