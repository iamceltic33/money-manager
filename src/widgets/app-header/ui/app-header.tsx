import { useRouter } from 'expo-router';
import { ChartNoAxesCombined, LogOut, Menu, Shapes, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTransactionsStore } from '@/entities/transaction';
import { signOut } from '@/shared/api/supabase/authorization';
import { Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { showErrorToast } from '@/shared/model/toast-store';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';

const DRAWER_WIDTH = 300;

export function AppHeader() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { balance, initialized } = useTransactionsStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const drawerPosition = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const drawerWidth = Math.min(DRAWER_WIDTH, width * 0.86);
  const formattedBalance = useMemo(
    () =>
      new Intl.NumberFormat('ru-RU', {
        maximumFractionDigits: 0,
      }).format(balance),
    [balance]
  );

  useEffect(() => {
    Animated.timing(drawerPosition, {
      toValue: isMenuOpen ? 0 : -drawerWidth,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [drawerPosition, drawerWidth, isMenuOpen]);

  function openCategories() {
    setIsMenuOpen(false);
    router.push('/categories');
  }

  const openForecasts = () => {
    setIsMenuOpen(false);
    router.push('/forecasts');
  };

  async function handleSignOut() {
    try {
      setIsMenuOpen(false);
      await signOut();
    } catch (error) {
      showErrorToast(error, 'Не удалось выйти из аккаунта');
    }
  }

  return (
    <>
      <ThemedView style={styles.header} type="background">
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.headerContent}>
            <Pressable
              accessibilityLabel="Открыть меню"
              accessibilityRole="button"
              onPress={() => setIsMenuOpen(true)}
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}
            >
              <Menu color={theme.text} size={22} strokeWidth={2.2} />
            </Pressable>

            <View
              accessibilityLabel={
                initialized
                  ? `Общий баланс ${formattedBalance} KZT`
                  : 'Общий баланс загружается'
              }
              style={[
                styles.balancePill,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.backgroundSelected,
                },
              ]}
            >
              <ThemedText type="small" themeColor="textSecondary" style={styles.balanceLabel}>
                Баланс
              </ThemedText>
              <View style={styles.balanceValue}>
                <ThemedText type="smallBold" numberOfLines={1} adjustsFontSizeToFit>
                  {initialized ? formattedBalance : '...'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  KZT
                </ThemedText>
              </View>
            </View>

            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
      </ThemedView>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsMenuOpen(false)}
        transparent
        visible={isMenuOpen}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Закрыть меню"
            onPress={() => setIsMenuOpen(false)}
            style={styles.backdrop}
          />

          <Animated.View
            style={[
              styles.drawer,
              {
                backgroundColor: theme.background,
                borderRightColor: theme.backgroundSelected,
                transform: [{ translateX: drawerPosition }],
                width: drawerWidth,
              },
            ]}
          >
            <SafeAreaView style={styles.drawerSafeArea}>
              <View style={styles.drawerHeader}>
                <View>
                  <ThemedText type="smallBold">Меню</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Аккаунт
                  </ThemedText>
                </View>

                <Pressable
                  accessibilityLabel="Закрыть меню"
                  accessibilityRole="button"
                  onPress={() => setIsMenuOpen(false)}
                  style={({ pressed }) => [
                    styles.iconButton,
                    { backgroundColor: theme.backgroundElement },
                    pressed && styles.pressed,
                  ]}
                >
                  <X color={theme.text} size={20} strokeWidth={2.2} />
                </Pressable>
              </View>

              <View style={styles.drawerContent}>
                <Pressable
                  accessibilityRole="button"
                  onPress={openCategories}
                  style={({ pressed }) => [
                    styles.menuItem,
                    { backgroundColor: theme.backgroundElement },
                    pressed && styles.pressed,
                  ]}
                >
                  <Shapes color={theme.text} size={20} strokeWidth={2.2} />
                  <ThemedText type="smallBold">Категории</ThemedText>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={openForecasts}
                  style={({ pressed }) => [
                    styles.menuItem,
                    { backgroundColor: theme.backgroundElement },
                    pressed && styles.pressed,
                  ]}
                >
                  <ChartNoAxesCombined color={theme.text} size={20} strokeWidth={2.2} />
                  <ThemedText type="smallBold">Прогнозы</ThemedText>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={handleSignOut}
                  style={({ pressed }) => [
                    styles.menuItem,
                    { backgroundColor: theme.backgroundElement },
                    pressed && styles.pressed,
                  ]}
                >
                  <LogOut color="#DC2626" size={20} strokeWidth={2.2} />
                  <ThemedText type="smallBold" style={styles.signOutText}>
                    Выйти из аккаунта
                  </ThemedText>
                </Pressable>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(127, 127, 127, 0.16)',
  },
  safeArea: {
    width: '100%',
  },
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
  headerSpacer: {
    width: 44,
    height: 44,
  },
  balanceLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  balanceValue: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.72,
  },
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  drawer: {
    flex: 1,
    borderRightWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  drawerSafeArea: {
    flex: 1,
  },
  drawerHeader: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(127, 127, 127, 0.16)',
  },
  drawerContent: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  menuItem: {
    minHeight: 52,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  signOutText: {
    color: '#DC2626',
  },
});
