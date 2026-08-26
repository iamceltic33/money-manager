import { supabase } from "@/shared/utils/supabase";
import { useAuthStore } from "@/store/auth-store";
import { showErrorToast } from "@/store/toast-store";
import * as SplashScreen from 'expo-splash-screen';
import { PropsWithChildren, useEffect } from "react";

export function AuthProvider({children}: PropsWithChildren) {
    const { setSession, setIsLoading } = useAuthStore();

    useEffect(() => {
        supabase.auth.getSession()
            .then(({ data }) => {
                setSession(data.session);
            })
            .catch((error) => {
                showErrorToast(error, 'Не удалось восстановить сессию');
            })
            .finally(() => {
                setIsLoading(false);
                SplashScreen.hideAsync();
            })

        const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
            setSession(session);
        })

        return () => {
            listener.subscription.unsubscribe();
        }
    }, [setIsLoading, setSession])
    return <>
        {children}
    </>
}
