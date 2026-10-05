import { useEffect, useState } from 'react';
import { HomeHistoryPage } from '@/pages/home-history';
import { StyleSheet, View } from 'react-native';
import { LocalDataProvider } from '@/core/providers/local-data-provider';
import { useAuthStore } from '@/features/auth';
import { ThemedView } from '@/shared/ui/themed-view';
import { AppHeader } from '@/widgets/app-header';
import { Redirect, Stack, usePathname } from 'expo-router';

export default function TabLayout() {
  const pathname = usePathname();
  const showFeed = pathname === '/' || pathname === '/transactions';
  const routeMode = pathname === '/' ? 'home' : 'history';
  const [lastMode, setLastMode] = useState<'home' | 'history'>(routeMode);
  useEffect(() => {
    if (showFeed) setLastMode(routeMode);
  }, [showFeed, routeMode]);
  const { session } = useAuthStore();

  if (!session) return <Redirect href="/auth" />;

  return (
    <LocalDataProvider>
      <ThemedView style={{ flex: 1 }}>
        <AppHeader />
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(operations)" options={{ animation: 'none' }} />
            <Stack.Screen name="transactions" options={{ animation: 'none' }} />
          </Stack>
          <View
            pointerEvents={showFeed ? 'auto' : 'none'}
            accessibilityElementsHidden={!showFeed}
            importantForAccessibility={showFeed ? 'auto' : 'no-hide-descendants'}
            style={[StyleSheet.absoluteFill, { opacity: showFeed ? 1 : 0, zIndex: showFeed ? 1 : -1 }]}
          >
            <HomeHistoryPage mode={showFeed ? routeMode : lastMode} active={showFeed} />
          </View>
        </View>
      </ThemedView>
    </LocalDataProvider>
  );
}
