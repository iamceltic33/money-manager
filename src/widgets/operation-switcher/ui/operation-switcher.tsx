import { router, usePathname } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { LocalTransactionType } from '@/entities/transaction';
import { MaxContentWidth, Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { ThemedText } from '@/shared/ui/themed-text';

const routes = [
  {
    href: '/add-expense',
    label: 'Расход',
    value: 'expense',
    icon: Minus,
  },
  {
    href: '/add-income',
    label: 'Доход',
    value: 'income',
    icon: Plus,
  }
] as const;

type ControlledProps = {
  type: LocalTransactionType;
  onTypeChange: (type: LocalTransactionType) => void;
  disabled?: boolean;
};

type Props = ControlledProps | {
  type?: never;
  onTypeChange?: never;
  disabled?: never;
};

export function OperationSwitcher(props: Props = {}) {
  if (props.type !== undefined) {
    return <OperationSwitcherButtons
      type={props.type}
      disabled={props.disabled}
      onTypeChange={type => {
        if (type !== props.type) props.onTypeChange(type);
      }}
    />;
  }

  return <NavigationOperationSwitcher />;
}

function NavigationOperationSwitcher() {
  const pathname = usePathname();
  return <OperationSwitcherButtons
    type={routes.find(item => item.href === pathname)?.value}
    onTypeChange={type => router.push(routes.find(item => item.value === type)!.href)}
  />;
}

function OperationSwitcherButtons({ type, onTypeChange, disabled = false }: {
  type?: LocalTransactionType;
  onTypeChange: ControlledProps['onTypeChange'];
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
      {routes.map((item) => {
        const Icon = item.icon;
        const isActive = type === item.value;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isActive, disabled }}
            disabled={disabled}
            key={item.value}
            onPress={() => {
              if (!disabled) onTypeChange(item.value);
            }}
            style={({ pressed }) => [
              styles.button,
              isActive && { backgroundColor: theme.background },
              pressed && !disabled && styles.pressed,
              disabled && styles.disabled,
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
  disabled: {
    opacity: 0.5,
  },
});
