import { OperationSwitcher } from '@/components/operation-switcher';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function OperationsLayout() {
  return (
    <>
      <View style={styles.switcherWrapper}>
        <OperationSwitcher />
      </View>
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
