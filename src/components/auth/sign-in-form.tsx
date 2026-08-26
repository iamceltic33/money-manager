import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { authFormStyles as styles } from '@/components/auth/auth-form.styles';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { signIn } from '@/store/auth-store';

type SignInFormProps = {
  onSignUpPress: () => void;
};

export function SignInForm({ onSignUpPress }: SignInFormProps) {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  function handleSubmit() {
    signIn(email, password).catch(() => undefined);
  }

  return (
    <>
      <View style={styles.form}>
        <View style={styles.field}>
          <ThemedText type="smallBold">Email</ThemedText>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            inputMode="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              {
                backgroundColor: theme.background,
                color: theme.text,
                borderColor: theme.backgroundSelected,
              },
            ]}
            value={email}
          />
        </View>

        <View style={styles.field}>
          <ThemedText type="smallBold">Пароль</ThemedText>
          <View style={styles.passwordInputWrapper}>
            <TextInput
              autoCapitalize="none"
              autoComplete="current-password"
              onChangeText={setPassword}
              placeholder="Введите пароль"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry={!isPasswordVisible}
              style={[
                styles.input,
                styles.passwordInput,
                {
                  backgroundColor: theme.background,
                  color: theme.text,
                  borderColor: theme.backgroundSelected,
                },
              ]}
              value={password}
            />
            <Pressable
              accessibilityLabel={isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'}
              accessibilityRole="button"
              onPress={() => setIsPasswordVisible((value) => !value)}
              style={styles.passwordToggle}
            >
              {isPasswordVisible ? (
                <EyeOff color={theme.textSecondary} size={20} strokeWidth={2} />
              ) : (
                <Eye color={theme.textSecondary} size={20} strokeWidth={2} />
              )}
            </Pressable>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={handleSubmit}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <ThemedText style={styles.primaryButtonText}>Войти</ThemedText>
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" onPress={onSignUpPress} style={styles.footerAction}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.footerText}>
          Еще нет аккаунта?
        </ThemedText>
        <ThemedText type="smallBold" style={styles.footerLink}>
          Создать
        </ThemedText>
      </Pressable>
    </>
  );
}
