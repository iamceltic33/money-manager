import { supabase } from "@/shared/api/supabase";
import { useAuthStore } from "@/features/auth";
import { showErrorToast } from "@/shared/model/toast-store";
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
