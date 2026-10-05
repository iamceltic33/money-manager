import { supabase } from "@/shared/api/supabase";
import { useAuthStore } from "@/features/auth";
import { showErrorToast } from "@/shared/model/toast-store";
import * as SplashScreen from 'expo-splash-screen';
import { PropsWithChildren, useEffect, useState } from "react";
import { View } from 'react-native';
import { StartupScreen } from '@/shared/ui/startup-screen';

export function AuthProvider({children}: PropsWithChildren) {
    const { session, setSession, setIsLoading } = useAuthStore();
    const [restored, setRestored] = useState(false);

    useEffect(() => {
        supabase.auth.getSession()
            .then(({ data, error }) => {
                if (error) throw error;
                setSession(data.session);
            })
            .catch((error) => {
                showErrorToast(error, 'Не удалось восстановить сессию');
            })
            .finally(() => {
                setIsLoading(false);
                setRestored(true);
            })

        const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
            setSession(session);
        })

        return () => {
            listener.subscription.unsubscribe();
        }
    }, [setIsLoading, setSession])
    const onLayout = () => {
        if (restored && !session) SplashScreen.hide();
    };

    if (!restored) return <StartupScreen />;

    return <View style={{ flex: 1 }} onLayout={onLayout}>
        {children}
    </View>
}
