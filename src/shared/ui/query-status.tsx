import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Spacing } from '@/shared/config/theme';
import { ThemedText } from './themed-text';

export function QueryStatus({ loading, error, retry, errorMessage = 'Не удалось загрузить операции' }: { loading: boolean; error: boolean; retry: () => void; errorMessage?: string }) {
  return (
    <View style={styles.container}>
      {loading ? <ActivityIndicator color="#2563EB" /> : null}
      {error ? <>
        <ThemedText type="small" style={styles.text}>{errorMessage}</ThemedText>
        <Pressable accessibilityRole="button" onPress={retry} style={styles.button}>
          <ThemedText type="smallBold" themeColor="text">Повторить</ThemedText>
        </Pressable>
      </> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: Spacing.three, gap: Spacing.two },
  text: { textAlign: 'center' },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three },
});
