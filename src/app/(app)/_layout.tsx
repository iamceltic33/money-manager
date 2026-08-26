import { AppHeader } from '@/components/app-header';
import { OperationSwitcher } from '@/components/operation-switcher';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/auth-store';
import { useBaseStore } from '@/store/base-store';
import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

export default function TabLayout() {
    const { session } = useAuthStore();
    const { initialized, init } = useBaseStore();

    useEffect(() => {
        if (session && !initialized) {
            init();
        }
    }, [init, initialized, session]);

    if (!session) return <Redirect href={'/auth'} />
    return (
        <ThemedView style={{ flex: 1 }}>
            <AppHeader />
            <View style={{
                width: '100%',
                maxWidth: MaxContentWidth,
                alignSelf: 'center',
                paddingHorizontal: Spacing.four,
            }}><OperationSwitcher /></View>
            <Stack screenOptions={{ headerShown: false }} />
        </ThemedView>
    );
}
