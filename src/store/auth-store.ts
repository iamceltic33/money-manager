import { showErrorToast, showSuccessToast } from '@/store/toast-store';
import { signIn as sbSignIn, signUp as sbSignUp } from '@/shared/utils/supabase/authorization';
import { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

type AuthStore = {
    session: Session | null;
    loading: boolean;
    setSession: (session: Session | null) => void;
    setIsLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
    session: null,
    loading: true,
    setIsLoading: (loading) => set({loading}),
    setSession: (session) => set({session})
}))

export const signIn = async (email: string, password: string) => {
    const state = useAuthStore.getState();
    state.setIsLoading(true);

    try {
        const data = await sbSignIn({email, password});
        state.setSession(data.session);
    } catch (error) {
        showErrorToast(error, 'Не удалось войти');
        throw error;
    } finally {
        useAuthStore.getState().setIsLoading(false);
    }
}

export const signUp = async (email: string, password: string, displayName?: string) => {
    const state = useAuthStore.getState();
    state.setIsLoading(true);

    try {
        const data = await sbSignUp({email, password, displayName});
        state.setSession(data.session);
        showSuccessToast('Аккаунт создан');
    } catch (error) {
        showErrorToast(error, 'Не удалось зарегистрироваться');
        throw error;
    } finally {
        useAuthStore.getState().setIsLoading(false);
    }
}
