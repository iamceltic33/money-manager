import { LocalDataProvider } from '@/core/providers/local-data-provider';
import { useAuthStore } from '@/features/auth';
import { ThemedView } from '@/shared/ui/themed-view';
import { AppHeader } from '@/widgets/app-header';
import { Redirect, Stack } from 'expo-router';

export default function TabLayout() {
  const { session } = useAuthStore();

  if (!session) return <Redirect href="/auth" />;

  return (
    <LocalDataProvider>
      <ThemedView style={{ flex: 1 }}>
        <AppHeader />
        <Stack screenOptions={{ headerShown: false }} />
      </ThemedView>
    </LocalDataProvider>
  );
}
