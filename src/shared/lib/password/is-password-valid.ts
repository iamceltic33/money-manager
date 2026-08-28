type Reason = 'length' | 'lowerCaseLetters' | 'uppercaseLetter' | 'digit' | 'specialCharacter';
type ReturnValue = {
    ok: true
} | {
    ok: false,
    reasons: Record<Reason, boolean>
}

export function isPasswordValid(password: string): ReturnValue {
  const hasMinLength = password.length >= 8;
  const hasLowercaseLetter = /[a-z]/.test(password);
  const hasUppercaseLetter = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecialCharacter = /[^A-Za-z0-9]/.test(password);
  const isValid = 
    hasMinLength &&
    hasLowercaseLetter &&
    hasUppercaseLetter &&
    hasDigit &&
    hasSpecialCharacter;
  if (isValid) return { ok: true };
  return {
    ok: false,
    reasons: {
        length: hasMinLength,
        lowerCaseLetters: hasLowercaseLetter,
        uppercaseLetter: hasUppercaseLetter,
        digit: hasDigit,
        specialCharacter: hasSpecialCharacter
    }
  }

}
