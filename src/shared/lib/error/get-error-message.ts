export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === 'Invalid login credentials') {
      return 'Неверный email или пароль';
    }

    if (error.message === 'Email not confirmed') {
      return 'Подтверди email перед входом';
    }

    if (error.message === 'Network request failed') {
      return 'Проверь подключение к интернету';
    }

    return error.message;
  }

  return 'Что-то пошло не так';
}
