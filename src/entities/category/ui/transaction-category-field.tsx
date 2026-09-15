import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { ThemedText } from '@/shared/ui/themed-text';

import { useCategoryStore } from '../model/category-store';
import type { CategoryFormValues, LocalCategory, LocalCategoryType } from '../model/types';
import { CategoryFormModal, DEFAULT_CATEGORY_COLORS } from './category-form-modal';
import { CategoryIcon } from './category-icon';

type Props = {
  type: LocalCategoryType;
  value?: string | null;
  onChange: (categoryId: string | null) => void;
};

export function TransactionCategoryField({ type, value, onChange }: Props) {
  const theme = useTheme();
  const allCategories = useCategoryStore((state) => state.categories);
  const createCategory = useCategoryStore((state) => state.createCategory);
  const updateCategory = useCategoryStore((state) => state.updateCategory);
  const deleteCategory = useCategoryStore((state) => state.deleteCategory);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editableCategory, setEditableCategory] = useState<LocalCategory | null>(null);

  const categories = useMemo(
    () => allCategories.filter((category) => category.type === type),
    [allCategories, type]
  );

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === value) ?? null,
    [categories, value]
  );

  const openCreateModal = () => {
    setEditableCategory(null);
    setIsModalVisible(true);
  };

  const openEditModal = (category: LocalCategory) => {
    setEditableCategory(category);
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setEditableCategory(null);
  };

  const handleSubmitCategory = async (values: CategoryFormValues) => {
    try {
      if (editableCategory) {
        await updateCategory({
          id: editableCategory.id,
          name: values.name,
          icon: values.icon,
          color: values.color,
          excludeFromAverage: values.excludeFromAverage
        });
      } else {
        const category = await createCategory({
          type,
          name: values.name,
          icon: values.icon,
          color: values.color,
          excludeFromAverage: values.excludeFromAverage
        });

        onChange(category.id);
      }

      closeModal();
    } catch {}
  };

  const handleDeleteCategory = async (category: LocalCategory) => {
    try {
      await deleteCategory(category.id);

      if (value === category.id) {
        onChange(null);
      }

      closeModal();
    } catch {}
  };

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
              accessibilityHint="Долгое нажатие откроет редактирование категории"
              accessibilityRole="button"
              key={category.id}
              onLongPress={() => openEditModal(category)}
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
          onPress={openCreateModal}
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

      <CategoryFormModal
        category={editableCategory}
        onClose={closeModal}
        onDelete={handleDeleteCategory}
        onSubmit={handleSubmitCategory}
        type={type}
        visible={isModalVisible}
      />
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
  pressed: {
    opacity: 0.78,
  },
});
