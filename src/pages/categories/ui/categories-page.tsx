import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryGrid } from '@/entities/category';
import { MaxContentWidth, Spacing } from '@/shared/config/theme';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';

export function CategoriesPage() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedText type="subtitle" style={styles.title}>Категории</ThemedText>

          <View style={styles.section}>
            <ThemedText type="smallBold">Доходы</ThemedText>
            <CategoryGrid type="income" />
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold">Расходы</ThemedText>
            <CategoryGrid type="expense" />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  title: {
    flexShrink: 1,
    textAlign: 'center',
  },
  section: {
    gap: Spacing.three,
  },
});
