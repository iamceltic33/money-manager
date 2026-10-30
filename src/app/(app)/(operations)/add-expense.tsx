import { Redirect, useLocalSearchParams } from 'expo-router';

export default function AddExpense() {
  const params = useLocalSearchParams<{ paymentId?: string | string[] }>();
  const paymentId = Array.isArray(params.paymentId) ? params.paymentId[0] : params.paymentId;

  return <Redirect href={{
    pathname: '/add-operation',
    params: { type: 'expense', ...(paymentId ? { paymentId } : {}) },
  }} />;
}
