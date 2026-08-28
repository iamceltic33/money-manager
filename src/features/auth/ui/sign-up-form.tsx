import { Eye, EyeOff } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { authFormStyles as styles } from './auth-form.styles';
import { ThemedText } from '@/shared/ui/themed-text';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { isPasswordValid } from '@/shared/lib/password/is-password-valid';
import { signUp } from '../model/auth-store';

type SignUpFormProps = {
  onSignInPress: () => void;
};

export function SignUpForm({ onSignInPress }: SignUpFormProps) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const passwordValidationResult = useMemo(() => isPasswordValid(password), [password]);
  const shouldShowPasswordHint = password.length > 0 && !passwordValidationResult;

  const handleSubmit = () => {
    signUp(email, password, name).catch(() => undefined);
  }

  return (
    <>
      <View style={styles.form}>
        <View style={styles.field}>
          <ThemedText type="smallBold">Имя</ThemedText>
          <TextInput
            autoCapitalize="words"
            autoComplete="name"
            onChangeText={setName}
            placeholder="Например, Руслан"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              {
                backgroundColor: theme.background,
                color: theme.text,
                borderColor: theme.backgroundSelected,
              },
            ]}
            value={name}
          />
        </View>

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
              autoComplete="new-password"
              onChangeText={setPassword}
              placeholder="Минимум 8 символов, цифра и спецсимвол"
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
          {shouldShowPasswordHint && (
            <ThemedText type="small" style={[styles.hint, { color: '#DC2626' }]}>
              Пароль должен содержать 8+ символов, большие и маленькие буквы, цифру и спецсимвол.
            </ThemedText>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={handleSubmit}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <ThemedText style={styles.primaryButtonText}>Зарегистрироваться</ThemedText>
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" onPress={onSignInPress} style={styles.footerAction}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.footerText}>
          Уже есть аккаунт?
        </ThemedText>
        <ThemedText type="smallBold" style={styles.footerLink}>
          Войти
        </ThemedText>
      </Pressable>
    </>
  );
}
