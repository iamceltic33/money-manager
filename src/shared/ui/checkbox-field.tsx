import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { ThemedText } from './themed-text';

type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function CheckboxField({ label, checked, onChange }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[
        styles.checkbox,
        {
          backgroundColor: checked ? '#2563EB' : theme.backgroundElement,
          borderColor: checked ? '#2563EB' : theme.textSecondary,
        },
      ]}>
        {checked ? <Check color="#FFFFFF" size={16} strokeWidth={2.3} /> : null}
      </View>
      <ThemedText type="small" style={styles.label}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  checkbox: { width: 22, height: 22, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1 },
  pressed: { opacity: 0.78 },
});
