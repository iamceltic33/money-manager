import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { ThemedText } from '@/shared/ui/themed-text';

import { useCategoryStore } from '../model/category-store';
import type { CategoryFormValues, LocalCategory, LocalCategoryType } from '../model/types';
import { CategoryFormModal, DEFAULT_CATEGORY_COLORS } from './category-form-modal';
import { CategoryIcon } from './category-icon';

type Props = {
  type: LocalCategoryType;
};

export function CategoryGrid({ type }: Props) {
  const theme = useTheme();
  const allCategories = useCategoryStore((state) => state.categories);
  const createCategory = useCategoryStore((state) => state.createCategory);
  const updateCategory = useCategoryStore((state) => state.updateCategory);
  const deleteCategory = useCategoryStore((state) => state.deleteCategory);
  const [selectedCategory, setSelectedCategory] = useState<LocalCategory | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const categories = useMemo(
    () => allCategories.filter((category) => category.type === type),
    [allCategories, type]
  );

  const handleSubmitCategory = async (values: CategoryFormValues) => {
    try {
      if (selectedCategory) {
        await updateCategory({
          id: selectedCategory.id,
          type,
          name: values.name,
          icon: values.icon,
          color: values.color,
          excludeFromAverage: values.excludeFromAverage,
        });
      } else {
        await createCategory({
          type,
          name: values.name,
          icon: values.icon,
          color: values.color,
          excludeFromAverage: values.excludeFromAverage,
        });
      }

      setIsModalVisible(false);
      setSelectedCategory(null);
    } catch {}
  }

  const openCreateModal = () => {
    setSelectedCategory(null);
    setIsModalVisible(true);
  }

  const closeModal = () => {
    setIsModalVisible(false);
    setSelectedCategory(null);
  }

  const handleDeleteCategory = async (category: LocalCategory) => {
    try {
      await deleteCategory(category.id);
      closeModal();
    } catch {}
  }

  return (
    <View style={styles.root}>
      <View style={styles.grid}>
        {categories.map((category) => {
          const color = category.color ?? DEFAULT_CATEGORY_COLORS[type];

          return (
            <Pressable
              accessibilityRole="button"
              key={category.id}
              style={({ pressed }) => [
                styles.categoryCard,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.backgroundSelected,
                },
                pressed && styles.pressed,
              ]}
              onPress={() => {
                setSelectedCategory(category);
                setIsModalVisible(true);
              }}
            >
              <View style={[styles.iconBox, { backgroundColor: color }]}>
                <CategoryIcon color="#FFFFFF" name={category.icon} size={22} />
              </View>
              <ThemedText numberOfLines={1} type="smallBold" style={styles.categoryName}>
                {category.name}
              </ThemedText>
            </Pressable>
          );
        })}

        <Pressable
          accessibilityRole="button"
          onPress={openCreateModal}
          style={({ pressed }) => [
            styles.addCard,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.backgroundSelected,
            },
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.addIconBox, { backgroundColor: theme.background }]}>
            <Plus color="#2563EB" size={22} strokeWidth={2.4} />
          </View>
          <ThemedText numberOfLines={1} type="smallBold" style={styles.addText}>
            Добавить
          </ThemedText>
        </Pressable>
      </View>

      {categories.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
          Категорий пока нет.
        </ThemedText>
      ) : null}

      <CategoryFormModal
        onClose={closeModal}
        onSubmit={handleSubmitCategory}
        type={type}
        category={selectedCategory}
        visible={isModalVisible}
        onDelete={handleDeleteCategory}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  categoryCard: {
    flexBasis: '31.8%',
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  addCard: {
    flexBasis: '31.8%',
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
    padding: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    maxWidth: '100%',
    textAlign: 'center',
  },
  addText: {
    color: '#2563EB',
  },
  emptyText: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.78,
  },
});
