import { Stack, useIsFocused, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { HomeHistoryPage } from '@/pages/home-history';

export default function HomeLayout() {
  const pathname = usePathname();
  const focused = useIsFocused();
  const active = focused && (pathname === '/' || pathname === '/transactions');
  const routeMode = pathname === '/transactions' ? 'history' : 'home';
  const [lastMode, setLastMode] = useState<'home' | 'history'>(routeMode);

  useEffect(() => {
    if (active) setLastMode(routeMode);
  }, [active, routeMode]);

  return (
    <View style={styles.container}>
      <Stack initialRouteName="index" screenOptions={{ headerShown: false, animation: 'none' }} />
      <View
        pointerEvents={active ? 'auto' : 'none'}
        accessibilityElementsHidden={!active}
        importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
        style={[StyleSheet.absoluteFill, { opacity: active ? 1 : 0, zIndex: active ? 1 : -1 }]}
      >
        <HomeHistoryPage mode={active ? routeMode : lastMode} active={active} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
