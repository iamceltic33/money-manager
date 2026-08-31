import { showErrorToast } from '@/shared/model/toast-store';
import { create } from 'zustand';

import {
  createLocalCategory,
  getLocalCategories,
  updateLocalCategory,
} from '../api/categories';
import type {
  CreateLocalCategoryParams,
  LocalCategory,
  UpdateLocalCategoryParams,
} from './types';

type CreateCategoryParams = Omit<CreateLocalCategoryParams, 'userId'>;
type UpdateCategoryParams = Omit<UpdateLocalCategoryParams, 'userId'>;

type CategoryStore = {
  userId: string | null;
  categories: LocalCategory[];
  initialized: boolean;
  init: (userId: string) => Promise<void>;
  reset: () => void;
  refresh: () => Promise<void>;
  createCategory: (params: CreateCategoryParams) => Promise<LocalCategory>;
  updateCategory: (params: UpdateCategoryParams) => Promise<LocalCategory>;
  getCategoryById: (id?: string | null) => LocalCategory | null;
};

function sortCategories(categories: LocalCategory[]) {
  return [...categories].sort((firstCategory, secondCategory) => {
    if (firstCategory.type !== secondCategory.type) {
      return firstCategory.type.localeCompare(secondCategory.type);
    }

    if (firstCategory.sort_order !== secondCategory.sort_order) {
      return firstCategory.sort_order - secondCategory.sort_order;
    }

    return firstCategory.name.localeCompare(secondCategory.name);
  });
}

function getRequiredUserId() {
  const userId = useCategoryStore.getState().userId;

  if (!userId) {
    throw new Error('Пользователь не выбран');
  }

  return userId;
}

export const useCategoryStore = create<CategoryStore>((set, get) => ({
  userId: null,
  categories: [],
  initialized: false,
  init: async (userId) => {
    if (get().initialized && get().userId === userId) return;

    try {
      const categories = await getLocalCategories(userId);

      set({
        userId,
        categories,
        initialized: true,
      });
    } catch (error) {
      showErrorToast(error, 'Не удалось загрузить категории');
    }
  },
  reset: () => {
    set({
      userId: null,
      categories: [],
      initialized: false,
    });
  },
  refresh: async () => {
    try {
      const userId = getRequiredUserId();
      const categories = await getLocalCategories(userId);

      set({ categories });
    } catch (error) {
      showErrorToast(error, 'Не удалось обновить категории');
    }
  },
  createCategory: async (params) => {
    try {
      const userId = getRequiredUserId();
      const category = await createLocalCategory({
        ...params,
        userId,
      });

      set((state) => ({
        categories: sortCategories([...state.categories, category]),
        initialized: true,
      }));

      return category;
    } catch (error) {
      showErrorToast(error, 'Не удалось добавить категорию');
      throw error;
    }
  },
  updateCategory: async (params) => {
    try {
      const userId = getRequiredUserId();
      const category = await updateLocalCategory({
        ...params,
        userId,
      });

      set((state) => ({
        categories: sortCategories(
          state.categories.map((item) => (item.id === category.id ? category : item))
        ),
        initialized: true,
      }));

      return category;
    } catch (error) {
      showErrorToast(error, 'Не удалось обновить категорию');
      throw error;
    }
  },
  getCategoryById: (id) => {
    if (!id) return null;

    return get().categories.find((category) => category.id === id) ?? null;
  },
}));
