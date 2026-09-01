import { Spacing } from '@/shared/config';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { ThemedText } from '@/shared/ui';
import { useRouter } from 'expo-router';
import { Pencil, Trash2 } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useTransactionsStore } from '../model/transactions-store';

type Props = {
  id: string;
};

const dangerColor = '#DC2626';

export function Footer(props: Props) {
  const theme = useTheme();
  const { deleteTransaction } = useTransactionsStore();
  const router = useRouter();
  const { id } = props;

  const onEditPress = () => {
    router.push({
      pathname: '/transactions/[id]/edit',
      params: { id },
    });
  };

  const onDeletePress = () => {
    Alert.alert('Вы действительно хотите удалить операцию?', '', [
      {
        text: 'Отмена',
        style: 'cancel',
      },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          deleteTransaction(id);
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.actions}>
      <Pressable
        accessibilityRole="button"
        onPress={onEditPress}
        style={({ pressed }) => [
          styles.actionButton,
          {
            backgroundColor: theme.background,
            borderColor: theme.backgroundSelected,
          },
          pressed && styles.pressed,
        ]}
      >
        <Pencil color={theme.text} size={18} strokeWidth={2.3} />
        <ThemedText numberOfLines={1} type="smallBold" style={styles.actionText}>
          Изменить
        </ThemedText>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={onDeletePress}
        style={({ pressed }) => [
          styles.actionButton,
          {
            backgroundColor: theme.background,
            borderColor: dangerColor,
          },
          pressed && styles.pressed,
        ]}
      >
        <Trash2 color={dangerColor} size={18} strokeWidth={2.3} />
        <ThemedText numberOfLines={1} type="smallBold" style={styles.deleteButtonText}>
          Удалить
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  actionText: {
    flexShrink: 1,
  },
  deleteButtonText: {
    flexShrink: 1,
    color: dangerColor,
  },
  pressed: {
    opacity: 0.78,
  },
});
