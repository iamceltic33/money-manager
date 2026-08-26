import { AppLoadingOverlay } from '@/components/ui/app-loading-overlay';
import { AppToast } from '@/components/ui/app-toast';
import { AuthProvider } from '@/providers/AuthProvider';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';


SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}/> 
      </AuthProvider>
      <AppLoadingOverlay />
      <AppToast />
    </ThemeProvider>
  );
}
