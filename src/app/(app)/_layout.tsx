import { LocalDataProvider } from '@/core/providers/local-data-provider';
import { useAuthStore } from '@/features/auth';
import { ThemedView } from '@/shared/ui/themed-view';
import { AppHeader } from '@/widgets/app-header';
import { Redirect, Stack } from 'expo-router';

export default function AppLayout() {
  const { session } = useAuthStore();

  if (!session) return <Redirect href="/auth" />;

  return (
    <LocalDataProvider>
      <ThemedView style={{ flex: 1 }}>
        <AppHeader />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
          <Stack.Screen name="(operations)" options={{ animation: 'none' }} />
          <Stack.Screen name="transactions" options={{ animation: 'none' }} />
        </Stack>
      </ThemedView>
    </LocalDataProvider>
  );
}
