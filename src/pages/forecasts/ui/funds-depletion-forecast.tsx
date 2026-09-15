import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { ThemedText } from '@/shared/ui/themed-text';

type Props = {
  estimatedDate: Date | null;
  unavailableMessage?: string;
};

export function FundsDepletionForecast({
  estimatedDate,
  unavailableMessage = 'Пока недостаточно данных для прогноза',
}: Props) {
  const theme = useTheme();
  const formattedDate = estimatedDate?.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  }).replace(/\s*г\.$/, '');

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary">
        Средств хватит до
      </ThemedText>
      {formattedDate ? (
        <>
          <ThemedText
            accessibilityLabel={`Примерно до ${formattedDate}`}
            type="subtitle"
            style={styles.date}
          >
            ≈ {formattedDate}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            При текущем темпе расходов и без новых поступлений
          </ThemedText>
        </>
      ) : (
        <ThemedText type="smallBold">{unavailableMessage}</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  date: {
    fontSize: 28,
    lineHeight: 36,
  },
});
