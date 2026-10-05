import { AuthProvider } from '@/core/providers/auth-provider';
import { AppUpdateNotice } from '@/features/app-update';
import { AppLoadingOverlay } from '@/widgets/app-loading-overlay';
import { AppToast } from '@/widgets/app-toast';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { GestureHandlerRootView } from 'react-native-gesture-handler';


SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AuthProvider>
            <Stack screenOptions={{ headerShown: false }}/>
          </AuthProvider>
          <AppLoadingOverlay />
          <AppUpdateNotice />
          <AppToast />
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
