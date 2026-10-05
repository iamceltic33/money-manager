import { MaxContentWidth, Spacing } from '@/shared/config/theme';
import { OperationSwitcher } from '@/widgets/operation-switcher';
import { Stack, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function OperationsLayout() {
  const pathname = usePathname();
  return (
    <>
      {pathname !== '/' ? <View style={styles.switcherWrapper}>
        <OperationSwitcher />
      </View> : null}
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

const styles = StyleSheet.create({
  switcherWrapper: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
  },
});
