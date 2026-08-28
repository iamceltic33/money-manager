import { StyleSheet } from 'react-native';

import { Spacing } from '@/shared/config/theme';

export const authFormStyles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    lineHeight: 22,
  },
  passwordInputWrapper: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 64,
  },
  passwordToggle: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 56,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    marginTop: -Spacing.one,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    marginTop: Spacing.one,
  },
  pressed: {
    opacity: 0.82,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  footerAction: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  footerText: {
    textAlign: 'center',
  },
  footerLink: {
    color: '#2563EB',
  },
});
