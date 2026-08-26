import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignInForm } from '@/components/auth/sign-in-form';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AuthMode = 'sign-in' | 'sign-up';

export function Authorization() {
  const theme = useTheme();
  const [mode, setMode] = useState<AuthMode>('sign-in');

  const isSignUp = mode === 'sign-up';

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: 'padding', default: undefined })}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <View style={[styles.logo, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={styles.logoText}>M</ThemedText>
              </View>

              <View style={styles.titleBlock}>
                <ThemedText type="subtitle" style={styles.title}>
                  {isSignUp ? 'Создай аккаунт' : 'С возвращением'}
                </ThemedText>
                <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
                  {isSignUp
                    ? 'Начни вести доходы, расходы и бюджеты в одном месте.'
                    : 'Войди, чтобы продолжить управлять своими финансами.'}
                </ThemedText>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.segmentedControl, { backgroundColor: theme.background }]}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setMode('sign-in')}
                  style={[
                    styles.segmentButton,
                    !isSignUp && { backgroundColor: theme.backgroundSelected },
                  ]}
                >
                  <ThemedText type="smallBold">Вход</ThemedText>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setMode('sign-up')}
                  style={[
                    styles.segmentButton,
                    isSignUp && { backgroundColor: theme.backgroundSelected },
                  ]}
                >
                  <ThemedText type="smallBold">Регистрация</ThemedText>
                </Pressable>
              </View>

              {isSignUp ? (
                <SignUpForm onSignInPress={() => setMode('sign-in')} />
              ) : (
                <SignInForm onSignUpPress={() => setMode('sign-up')} />
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.four,
    marginBottom: Spacing.five,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
  },
  titleBlock: {
    gap: Spacing.two,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 420,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    alignSelf: 'center',
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.four,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: Spacing.one,
    gap: Spacing.one,
  },
  segmentButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
