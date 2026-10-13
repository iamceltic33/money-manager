import { LogOut } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '@/features/auth';
import { signOut } from '@/shared/api/supabase/authorization';
import { MaxContentWidth, Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { showErrorToast } from '@/shared/model/toast-store';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';

export function ProfilePage() {
  const theme = useTheme();
  const email = useAuthStore(state => state.session?.user.email);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const signingOut = useRef(false);

  const handleSignOut = async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      showErrorToast(error, 'Не удалось выйти из аккаунта');
    } finally {
      signingOut.current = false;
      setIsSigningOut(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle">Профиль</ThemedText>
          <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
            <ThemedText type="small" themeColor="textSecondary">Email</ThemedText>
            <ThemedText selectable>{email || 'Email не указан'}</ThemedText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Выйти из аккаунта"
            accessibilityState={{ disabled: isSigningOut, busy: isSigningOut }}
            disabled={isSigningOut}
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.signOutButton,
              { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
              (pressed || isSigningOut) && styles.dimmed,
            ]}
          >
            {isSigningOut
              ? <ActivityIndicator size="small" color="#DC2626" />
              : <LogOut color="#DC2626" size={20} />}
            <ThemedText type="smallBold" style={styles.signOutText}>
              {isSigningOut ? 'Выходим…' : 'Выйти из аккаунта'}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  content: { padding: Spacing.four, gap: Spacing.three },
  card: { borderWidth: 1, borderRadius: 8, padding: Spacing.three, gap: Spacing.two },
  signOutButton: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  signOutText: { color: '#DC2626', flexShrink: 1 },
  dimmed: { opacity: 0.72 },
});
