import { Plus, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { ThemedText } from '@/shared/ui/themed-text';

import { CATEGORY_ICON_OPTIONS, type CategoryIconName } from '../consts';
import { useCategoryStore } from '../model/category-store';
import type { LocalCategoryType } from '../model/types';
import { CategoryIcon } from './category-icon';

const DEFAULT_CATEGORY_COLORS: Record<LocalCategoryType, string> = {
  income: '#16A34A',
  expense: '#DC2626',
};

type Props = {
  type: LocalCategoryType;
  value?: string | null;
  onChange: (categoryId: string | null) => void;
};

export function TransactionCategoryField({ type, value, onChange }: Props) {
  const theme = useTheme();
  const allCategories = useCategoryStore((state) => state.categories);
  const createCategory = useCategoryStore((state) => state.createCategory);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<CategoryIconName>('receipt');

  const categories = useMemo(
    () => allCategories.filter((category) => category.type === type),
    [allCategories, type]
  );

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === value) ?? null,
    [categories, value]
  );

  function openModal() {
    setName('');
    setSelectedIcon(type === 'income' ? 'money' : 'receipt');
    setIsModalVisible(true);
  }

  async function handleCreateCategory() {
    const trimmedName = name.trim();

    if (!trimmedName) return;

    try {
      const category = await createCategory({
        type,
        name: trimmedName,
        icon: selectedIcon,
        color: DEFAULT_CATEGORY_COLORS[type],
      });

      onChange(category.id);
      setIsModalVisible(false);
      setName('');
    } catch {}
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <ThemedText type="smallBold">Категория</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {selectedCategory?.name ?? 'Не выбрана'}
          </ThemedText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.categoryList}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {categories.map((category) => {
          const isSelected = category.id === value;
          const color = category.color ?? DEFAULT_CATEGORY_COLORS[type];

          return (
            <Pressable
              accessibilityRole="button"
              key={category.id}
              onPress={() => onChange(category.id)}
              style={({ pressed }) => [
                styles.categoryButton,
                {
                  backgroundColor: isSelected ? color : theme.backgroundElement,
                  borderColor: isSelected ? color : theme.backgroundSelected,
                },
                pressed && styles.pressed,
              ]}
            >
              <CategoryIcon
                color={isSelected ? '#FFFFFF' : color}
                name={category.icon}
                size={22}
              />
              <ThemedText
                numberOfLines={1}
                type="small"
                style={[styles.categoryName, isSelected && styles.selectedCategoryName]}
              >
                {category.name}
              </ThemedText>
            </Pressable>
          );
        })}

        <Pressable
          accessibilityRole="button"
          onPress={openModal}
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.backgroundSelected,
            },
            pressed && styles.pressed,
          ]}
        >
          <Plus color="#2563EB" size={22} strokeWidth={2.4} />
          <ThemedText type="smallBold" style={styles.addButtonText}>
            Добавить
          </ThemedText>
        </Pressable>
      </ScrollView>

      {categories.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Категорий пока нет. Добавь первую категорию для этой операции.
        </ThemedText>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
        transparent
        visible={isModalVisible}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Закрыть окно"
            onPress={() => setIsModalVisible(false)}
            style={styles.backdrop}
          />

          <SafeAreaView style={styles.modalSafeArea}>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.backgroundSelected,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <View>
                  <ThemedText type="smallBold">Новая категория</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {type === 'income' ? 'Доход' : 'Расход'}
                  </ThemedText>
                </View>

                <Pressable
                  accessibilityLabel="Закрыть окно"
                  accessibilityRole="button"
                  onPress={() => setIsModalVisible(false)}
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
                <ThemedText type="smallBold">Иконка</ThemedText>
                <View style={styles.iconGrid}>
                  {CATEGORY_ICON_OPTIONS.map((iconName) => {
                    const isSelected = iconName === selectedIcon;
                    const color = DEFAULT_CATEGORY_COLORS[type];

                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={iconName}
                        onPress={() => setSelectedIcon(iconName)}
                        style={({ pressed }) => [
                          styles.iconButton,
                          {
                            backgroundColor: isSelected ? color : theme.backgroundElement,
                            borderColor: isSelected ? color : theme.backgroundSelected,
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
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={handleCreateCategory}
                style={({ pressed }) => [
                  styles.submitButton,
                  !name.trim() && styles.disabledButton,
                  pressed && name.trim() && styles.pressed,
                ]}
              >
                <ThemedText style={styles.submitButtonText}>Добавить категорию</ThemedText>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.two,
  },
  header: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryList: {
    gap: Spacing.two,
    paddingRight: Spacing.four,
  },
  categoryButton: {
    width: 92,
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  categoryName: {
    maxWidth: '100%',
    textAlign: 'center',
  },
  selectedCategoryName: {
    color: '#FFFFFF',
  },
  addButton: {
    width: 108,
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
    padding: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  addButtonText: {
    color: '#2563EB',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.46)',
  },
  modalSafeArea: {
    width: '100%',
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
  submitButton: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  disabledButton: {
    opacity: 0.48,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
  },
});
