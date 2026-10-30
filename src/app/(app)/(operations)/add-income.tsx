import { Redirect } from 'expo-router';

export default function AddIncome() {
  return <Redirect href={{ pathname: '/add-operation', params: { type: 'income' } }} />;
}
