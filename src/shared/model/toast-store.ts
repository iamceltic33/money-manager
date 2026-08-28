import { create } from 'zustand';

import { getErrorMessage } from '@/shared/lib/error/get-error-message';

type ToastType = 'error' | 'success' | 'info';

type ToastState = {
  id: number;
  message: string | null;
  type: ToastType;
  showToast: (message: string, type?: ToastType) => void;
  hideToast: () => void;
};

export const useToastStore = create<ToastState>((set) => ({
  id: 0,
  message: null,
  type: 'info',
  showToast: (message, type = 'info') => {
    set((state) => ({
      id: state.id + 1,
      message,
      type,
    }));
  },
  hideToast: () => {
    set({ message: null });
  },
}));

export function showToast(message: string, type: ToastType = 'info') {
  useToastStore.getState().showToast(message, type);
}

export function showErrorToast(error: unknown, fallbackMessage?: string) {
  showToast(fallbackMessage ?? getErrorMessage(error), 'error');
}

export function showSuccessToast(message: string) {
  showToast(message, 'success');
}
