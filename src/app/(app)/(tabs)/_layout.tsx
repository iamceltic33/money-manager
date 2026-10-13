import { Tabs, usePathname, useRouter } from 'expo-router';
import { ChartNoAxesCombined, House, Shapes, User, WalletCards } from 'lucide-react-native';

import { useTheme } from '@/shared/lib/theme/use-theme';

export default function MainTabsLayout() {
  const theme = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Tabs
      initialRouteName="(home)"
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: { backgroundColor: theme.backgroundElement, borderTopColor: theme.backgroundSelected },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{ title: 'Главная', tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }}
        listeners={{
          tabPress: event => {
            // Returning from another tab keeps history; pressing the active tab opens home.
            if (pathname === '/' || pathname === '/transactions') {
              event.preventDefault();
              if (pathname === '/transactions') router.dismissTo('/');
            }
          },
        }}
      />
      <Tabs.Screen name="categories" options={{ title: 'Категории', tabBarIcon: ({ color, size }) => <Shapes color={color} size={size} /> }} />
      <Tabs.Screen name="obligations" options={{ title: 'Кредиты', tabBarIcon: ({ color, size }) => <WalletCards color={color} size={size} /> }} />
      <Tabs.Screen name="forecasts" options={{ title: 'Прогнозы', tabBarIcon: ({ color, size }) => <ChartNoAxesCombined color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Профиль', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
