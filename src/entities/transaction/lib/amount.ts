const AMOUNT_INPUT_PATTERN = /^\d*(?:[.,]\d{0,2})?$/;
const SUBMIT_AMOUNT_PATTERN = /^\d+(?:[.,]\d{0,2})?$/;

export function isTransactionAmountInputAllowed(value: string) {
  return AMOUNT_INPUT_PATTERN.test(value);
}

export function normalizeTransactionAmount(amount: number) {
  if (!Number.isFinite(amount)) {
    throw new Error('Некорректная сумма операции');
  }

  const normalizedAmount = Math.round((amount + Number.EPSILON) * 100) / 100;

  if (normalizedAmount <= 0) {
    throw new Error('Сумма операции должна быть больше нуля');
  }

  return normalizedAmount;
}

export function formatTransactionAmountInput(amount: number) {
  return normalizeTransactionAmount(amount).toString();
}

export function parseTransactionAmountInput(value: string) {
  const normalizedValue = value.trim().replace(',', '.');

  if (!SUBMIT_AMOUNT_PATTERN.test(normalizedValue)) {
    return null;
  }

  return normalizeTransactionAmount(Number(normalizedValue));
}
