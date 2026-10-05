import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/shared/config/theme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

type Props = {
  onRetry?: () => void;
};

export function StartupScreen({ onRetry }: Props) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.content}>
        {onRetry ? (
          <>
            <ThemedText type="smallBold">Не удалось загрузить данные</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.message}>
              Попробуйте ещё раз. Сохранённые операции остаются на устройстве.
            </ThemedText>
            <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}>
              <ThemedText type="smallBold" style={styles.buttonText}>Повторить</ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color="#2563EB" />
            <ThemedText type="smallBold">Загрузка данных…</ThemedText>
          </>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  message: { textAlign: 'center', maxWidth: 360 },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    backgroundColor: '#2563EB',
    borderRadius: 8,
  },
  buttonText: { color: '#ffffff' },
});
