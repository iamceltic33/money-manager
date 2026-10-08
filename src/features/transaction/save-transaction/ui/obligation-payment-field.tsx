import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLocalObligations, getLocalObligationPayments, type LocalObligationPayment } from '@/entities/obligation';
import { useTransactionResource } from '@/entities/transaction';
import { useTheme } from '@/shared/lib/theme';
import { ThemedText, ThemedView } from '@/shared/ui';
import { Spacing } from '@/shared/config/theme';

type Selection = { payment: LocalObligationPayment; categoryId: string | null };
export function ObligationPaymentField({ value, onChange, transactionId }: { value: string | null | undefined; onChange: (value: string | null, selection?: Selection) => void; transactionId?: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const load = useCallback(async (userId: string) => {
    const [parents, payments] = await Promise.all([getLocalObligations(userId), getLocalObligationPayments(userId)]);
    return payments.filter(payment => !payment.transaction_id || payment.transaction_id === transactionId).map(payment => {
      const parent = parents.find(row => row.id === payment.obligation_id);
      return { payment, name: parent?.name ?? 'Обязательство', categoryId: parent?.category_id ?? null };
    });
  }, [transactionId]);
  const resource = useTransactionResource(load);
  const selected = resource.data?.find(row => row.payment.id === value);
  const label = (row: NonNullable<typeof selected>) => `${row.name} · ${row.payment.due_date.split('-').reverse().join('.')} · ${row.payment.amount} KZT`;
  const choose = (id: string | null, selection?: Selection) => { onChange(id, selection); setOpen(false); };
  const button = (text: string, onPress: () => void) => <Pressable accessibilityRole="button" onPress={onPress} style={[styles.button, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}><ThemedText type="small">{text}</ThemedText></Pressable>;
  return <View style={styles.field}>
    <ThemedText type="smallBold">Платёж по кредиту или рассрочке</ThemedText>
    {button(selected ? label(selected) : value ? 'Выбранный платёж · открыть список' : 'Без связи с платежом', () => { resource.retry(); setOpen(true); })}
    {value && !resource.loading && !resource.error && !selected ? <ThemedText type="small" style={{ color: '#DC2626' }}>Платёж недоступен. Выберите другой или уберите связь.</ThemedText> : null}
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <ThemedView style={styles.root}><SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="subtitle">Выберите платёж</ThemedText>
        {button('Без связи с платежом', () => choose(null))}
        {resource.loading ? <ActivityIndicator /> : resource.error ? <><ThemedText>Не удалось загрузить платежи</ThemedText>{button('Повторить', resource.retry)}</> : <>
          {!resource.data?.length ? <ThemedText themeColor="textSecondary">Нет неоплаченных платежей. Добавьте обязательство и его расписание в разделе «Кредиты и рассрочки».</ThemedText> : null}
          {resource.data?.map(row => <View key={row.payment.id}>{button(`${row.payment.id === value ? '✓ ' : ''}${label(row)}`, () => choose(row.payment.id, row))}</View>)}
        </>}
        {button('Закрыть', () => setOpen(false))}
      </ScrollView></SafeAreaView></ThemedView>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, field: { gap: Spacing.two },
  button: { minHeight: 52, borderRadius: 8, borderWidth: 1, padding: Spacing.three, justifyContent: 'center' },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five },
});
