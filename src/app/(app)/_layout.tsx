import { AppHeader } from '@/widgets/app-header';
import { ThemedView } from '@/shared/ui/themed-view';
import { useAuthStore } from '@/features/auth';
import { useTransactionsStore } from '@/entities/transaction';
import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';

export default function TabLayout() {
    const { session } = useAuthStore();
    const { initialized, init } = useTransactionsStore();

    useEffect(() => {
        if (session && !initialized) {
            init();
        }
    }, [init, initialized, session]);

    if (!session) return <Redirect href={'/auth'} />
    return (
        <ThemedView style={{ flex: 1 }}>
            <AppHeader />
            <Stack screenOptions={{ headerShown: false }} />
        </ThemedView>
    );
}
