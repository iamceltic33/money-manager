import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/shared/ui/themed-text';
import { Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { useToastStore } from '@/shared/model/toast-store';

const TOAST_DURATION = 3600;

export function AppToast() {
  const theme = useTheme();
  const { id, message, type, hideToast } = useToastStore();

  useEffect(() => {
    if (!message) return;

    const timeoutId = setTimeout(hideToast, TOAST_DURATION);

    return () => clearTimeout(timeoutId);
  }, [hideToast, id, message]);

  if (!message) return null;

  const Icon = type === 'error' ? AlertCircle : type === 'success' ? CheckCircle2 : Info;
  const accentColor = type === 'error' ? '#DC2626' : type === 'success' ? '#16A34A' : '#2563EB';

  return (
    <SafeAreaView pointerEvents="box-none" style={styles.root}>
      <View
        pointerEvents="auto"
        style={[
          styles.toast,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundSelected,
          },
        ]}
      >
        <Icon color={accentColor} size={20} strokeWidth={2.3} />
        <ThemedText style={styles.message} type="smallBold">
          {message}
        </ThemedText>
        <Pressable
          accessibilityLabel="Закрыть уведомление"
          accessibilityRole="button"
          onPress={hideToast}
          style={styles.closeButton}
        >
          <X color={theme.textSecondary} size={18} strokeWidth={2.3} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000,
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  toast: {
    width: '100%',
    maxWidth: 520,
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  message: {
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
