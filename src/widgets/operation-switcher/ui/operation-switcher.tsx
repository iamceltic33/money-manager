import { router, usePathname } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/shared/ui/themed-text';
import { MaxContentWidth, Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';

const routes = [
  {
    href: '/add-income',
    label: 'Доход',
    value: 'income',
    icon: Plus,
  },
  {
    href: '/add-expense',
    label: 'Расход',
    value: 'expense',
    icon: Minus,
  },
] as const;

export function OperationSwitcher() {
  const theme = useTheme();
  const pathname = usePathname();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
      {routes.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Pressable
            accessibilityRole="button"
            key={item.value}
            onPress={() => router.push(item.href)}
            style={({ pressed }) => [
              styles.button,
              isActive && { backgroundColor: theme.background },
              pressed && styles.pressed,
            ]}
          >
            <Icon
              color={isActive ? '#2563EB' : theme.textSecondary}
              size={18}
              strokeWidth={2.4}
            />
            <ThemedText
              type="smallBold"
              style={isActive ? styles.activeText : { color: theme.textSecondary }}
            >
              {item.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.one,
    padding: Spacing.one,
    borderRadius: 8,
    marginTop: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center'
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  activeText: {
    color: '#2563EB',
  },
  pressed: {
    opacity: 0.78,
  },
});
