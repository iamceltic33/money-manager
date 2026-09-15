import { Spacing } from "@/shared/config";
import { useTheme } from "@/shared/lib/theme";
import { ThemedText } from "@/shared/ui";
import { StyleSheet, View } from "react-native";

export function DetailRow(props: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { borderColor: theme.backgroundSelected }]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.rowLabel}>
        {props.label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.rowValue}>
        {props.value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    borderTopWidth: 1,
    paddingTop: Spacing.two,
    gap: Spacing.half,
  },
  rowLabel: {
    textTransform: 'uppercase',
  },
  rowValue: {
    flexShrink: 1,
  }
});