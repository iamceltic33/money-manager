import { Trash2, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { CheckboxField } from '@/shared/ui/checkbox-field';
import { ThemedText } from '@/shared/ui/themed-text';

import { CATEGORY_ICONS, CATEGORY_ICON_OPTIONS, type CategoryIconName } from '../consts';
import type { CategoryFormValues, LocalCategory, LocalCategoryType } from '../model/types';
import { CategoryIcon } from './category-icon';

export const DEFAULT_CATEGORY_COLORS: Record<LocalCategoryType, string> = {
  income: '#16A34A',
  expense: '#DC2626',
};

const CATEGORY_COLOR_OPTIONS = [
  '#16A34A',
  '#DB2777',
  '#DC2626',
  '#7C3AED',
  '#CA8A04',
  '#0EA5E9',
  '#2563EB',
  '#64748B',
];

type Props = {
  visible: boolean;
  type: LocalCategoryType;
  category?: LocalCategory | null;
  onClose: () => void;
  onSubmit: (values: CategoryFormValues, id?: string) => Promise<void> | void;
  onDelete?: (category: LocalCategory) => Promise<void> | void;
};

function isCategoryIconName(icon: string | null | undefined): icon is CategoryIconName {
  return Boolean(icon && icon in CATEGORY_ICONS);
}

function getInitialIcon(type: LocalCategoryType, category?: LocalCategory | null) {
  if (isCategoryIconName(category?.icon)) {
    return category.icon;
  }

  return type === 'income' ? 'money' : 'receipt';
}

export function CategoryFormModal({ visible, type, category, onClose, onSubmit, onDelete }: Props) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [excludeFromAverage, setExcludeFromAverage] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<CategoryIconName>(getInitialIcon(type, category));
  const [selectedColor, setSelectedColor] = useState(DEFAULT_CATEGORY_COLORS[type]);
  const isEditMode = Boolean(category);

  const title = isEditMode ? 'Редактировать категорию' : 'Новая категория';
  const submitText = isEditMode ? 'Сохранить' : 'Добавить категорию';
  const isSubmitDisabled = !name.trim();

  const colorOptions = useMemo(() => {
    const currentColor = category?.color ?? DEFAULT_CATEGORY_COLORS[type];

    return CATEGORY_COLOR_OPTIONS.includes(currentColor)
      ? CATEGORY_COLOR_OPTIONS
      : [currentColor, ...CATEGORY_COLOR_OPTIONS];
  }, [category?.color, type]);

  useEffect(() => {
    if (!visible) return;

    setName(category?.name ?? '');
    setExcludeFromAverage(category?.exclude_from_average === 1);
    setSelectedIcon(getInitialIcon(type, category));
    setSelectedColor(category?.color ?? DEFAULT_CATEGORY_COLORS[type]);
  }, [category, type, visible]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) return;

    await onSubmit({
      name: trimmedName,
      icon: selectedIcon,
      color: selectedColor,
      excludeFromAverage
    }, category?.id);
  }

  const confirmDelete = () => {
    if (!category || !onDelete) return;

    Alert.alert('Удалить категорию?', 'Операции останутся, но категория у них будет очищена.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          void onDelete(category);
        },
      },
    ]);
  }

  return (
    <Modal animationType="fade" hardwareAccelerated onRequestClose={onClose} transparent visible={visible}>
      <KeyboardProvider preload={false}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityLabel="Закрыть окно" onPress={onClose} style={styles.backdrop} />

          <SafeAreaView edges={['bottom']} style={[styles.modalSafeArea, { backgroundColor: theme.background }]}>
            <KeyboardAwareScrollView
              bottomOffset={Spacing.three}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              style={styles.modalScroll}
              contentContainerStyle={[
                styles.modalCard,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.backgroundSelected,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <View>
                  <ThemedText type="smallBold">{title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {type === 'income' ? 'Доход' : 'Расход'}
                  </ThemedText>
                </View>

                <Pressable
                  accessibilityLabel="Закрыть окно"
                  accessibilityRole="button"
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.closeButton,
                    { backgroundColor: theme.backgroundElement },
                    pressed && styles.pressed,
                  ]}
                >
                  <X color={theme.text} size={20} strokeWidth={2.2} />
                </Pressable>
              </View>

              <View style={styles.field}>
                <ThemedText type="smallBold">Название</ThemedText>
                <TextInput
                  autoCapitalize="sentences"
                  onChangeText={setName}
                  placeholder="Например, продукты"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.backgroundSelected,
                      color: theme.text,
                    },
                  ]}
                  value={name}
                />
              </View>

              <View style={styles.field}>
                <ThemedText type="smallBold">Цвет</ThemedText>
                <View style={styles.colorGrid}>
                  {colorOptions.map((color) => {
                    const isSelected = color === selectedColor;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={color}
                        onPress={() => setSelectedColor(color)}
                        style={({ pressed }) => [
                          styles.colorButton,
                          {
                            backgroundColor: color,
                            borderColor: isSelected ? theme.text : theme.backgroundSelected,
                          },
                          pressed && styles.pressed,
                        ]}
                      />
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <ThemedText type="smallBold">Иконка</ThemedText>
                <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled contentContainerStyle={styles.iconGrid} style={styles.iconScroll}>
                  {CATEGORY_ICON_OPTIONS.map((iconName) => {
                    const isSelected = iconName === selectedIcon;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={iconName}
                        onPress={() => setSelectedIcon(iconName)}
                        style={({ pressed }) => [
                          styles.iconButton,
                          {
                            backgroundColor: isSelected ? selectedColor : theme.backgroundElement,
                            borderColor: isSelected ? selectedColor : theme.backgroundSelected,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <CategoryIcon
                          color={isSelected ? '#FFFFFF' : theme.textSecondary}
                          name={iconName}
                          size={22}
                        />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {isEditMode ? (
                <CheckboxField
                  label="Не учитывать в прогнозе"
                  checked={excludeFromAverage}
                  onChange={setExcludeFromAverage}
                />
              ) : null}

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmitDisabled}
                  onPress={handleSubmit}
                  style={({ pressed }) => [
                    styles.submitButton,
                    { backgroundColor: isSubmitDisabled ? theme.backgroundSelected : selectedColor },
                    pressed && !isSubmitDisabled && styles.pressed,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.submitButtonText,
                      isSubmitDisabled && { color: theme.textSecondary },
                    ]}
                  >
                    {submitText}
                  </ThemedText>
                </Pressable>

                {isEditMode && onDelete ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={confirmDelete}
                    style={({ pressed }) => [
                      styles.deleteButton,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: '#DC2626',
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Trash2 color="#DC2626" size={18} strokeWidth={2.3} />
                    <ThemedText style={styles.deleteButtonText}>Удалить</ThemedText>
                  </Pressable>
                ) : null}
              </View>
            </KeyboardAwareScrollView>
          </SafeAreaView>
        </View>
      </KeyboardProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
  },
  modalSafeArea: {
    width: '100%',
    overflow: 'hidden',
    maxHeight: '92%',
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalCard: {
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  modalHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  colorButton: {
    width: 36,
    height: 36,
    borderWidth: 3,
    borderRadius: 8,
  },
  iconScroll: {
    maxHeight: 156,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    gap: Spacing.two,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  deleteButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
  },
});
