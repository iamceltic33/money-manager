import { AuthProvider } from '@/core/providers/auth-provider';
import { AppLoadingOverlay } from '@/widgets/app-loading-overlay';
import { AppToast } from '@/widgets/app-toast';
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
