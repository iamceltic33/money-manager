import { usePathname, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useMemo } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTransactionsStore } from '@/entities/transaction';
import { useAuthStore } from '@/features/auth';
import { SyncButton } from '@/features/sync';
import { Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { goBack as navigateBack, isMainRoute } from '@/shared/lib/navigation/go-back';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';

export function AppHeader() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const showBackButton = !isMainRoute(pathname);
  const balance = useTransactionsStore(state => state.balance);
  const initialized = useTransactionsStore(state => state.initialized);
  const userId = useAuthStore(state => state.session?.user.id);
  const formattedBalance = useMemo(
    () => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(balance),
    [balance]
  );
  const goBack = useCallback(() => navigateBack(router, pathname), [router, pathname]);

  useEffect(() => {
    if (Platform.OS !== 'android' || pathname === '/') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack, pathname]);

  return (
    <ThemedView style={styles.header} type="background">
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.headerContent}>
          {showBackButton ? (
            <Pressable
              accessibilityLabel="Назад"
              accessibilityRole="button"
              onPress={goBack}
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}
            >
              <ChevronLeft color={theme.text} size={22} strokeWidth={2.4} />
            </Pressable>
          ) : <View style={styles.iconButton} />}

          <View
            accessibilityLabel={initialized ? `Общий баланс ${formattedBalance} KZT` : 'Общий баланс загружается'}
            style={[
              styles.balancePill,
              { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
            ]}
          >
            <ThemedText type="small" themeColor="textSecondary" style={styles.balanceLabel}>
              Баланс
            </ThemedText>
            <View style={styles.balanceValue}>
              <ThemedText type="smallBold" numberOfLines={1} adjustsFontSizeToFit>
                {initialized ? formattedBalance : '...'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">KZT</ThemedText>
            </View>
          </View>

          <SyncButton userId={userId} />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(127, 127, 127, 0.16)',
  },
  safeArea: { width: '100%' },
  headerContent: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balancePill: {
    minWidth: 112,
    maxWidth: 180,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceLabel: { fontSize: 12, lineHeight: 16 },
  balanceValue: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  pressed: { opacity: 0.72 },
});
