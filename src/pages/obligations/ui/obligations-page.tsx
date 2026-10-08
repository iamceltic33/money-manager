import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { TransactionCategoryField } from '@/entities/category';
import * as obligations from '@/entities/obligation';
import type { LocalObligation, LocalObligationPayment } from '@/entities/obligation';
import { parseTransactionAmountInput, formatTransactionAmountInput, useTransactionResource, useTransactionsStore } from '@/entities/transaction';
import { MaxContentWidth, Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';
import { showErrorToast } from '@/shared/model/toast-store';
import { DateField, ThemedText, ThemedView } from '@/shared/ui';

export function calendarDate(date: Date) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function localDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(); date.setFullYear(year, month - 1, day); date.setHours(12, 0, 0, 0); return date;
}
const futureLimit = localDate('9999-12-31');
const money = (amount: number) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(amount)} KZT`;
const dateLabel = (date: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(localDate(date));

function Action({ children, onPress, disabled = false, danger = false }: { children: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, opacity: disabled || pressed ? 0.5 : 1 }]}>
    <ThemedText type="smallBold" style={danger ? { color: '#DC2626' } : undefined}>{children}</ThemedText>
  </Pressable>;
}
function Input({ label, value, onChange, numeric = false }: { label: string; value: string; onChange: (value: string) => void; numeric?: boolean }) {
  const theme = useTheme();
  return <View style={styles.field}><ThemedText type="smallBold">{label}</ThemedText><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} inputMode={numeric ? 'decimal' : 'text'} style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]} /></View>;
}

type Editor = { kind: 'obligation'; row?: LocalObligation } | { kind: 'payment'; parent: LocalObligation; row?: LocalObligationPayment };
type Removal = { kind: 'obligation'; id: string } | { kind: 'payment'; id: string };

export function ObligationsPage() {
  const userId = useTransactionsStore(state => state.userId);
  return <ObligationsContent key={userId ?? 'signed-out'} />;
}

function ObligationsContent() {
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const router = useRouter();
  const userId = useTransactionsStore(state => state.userId);
  const refresh = useTransactionsStore(state => state.refresh);
  const load = useCallback(async (userId: string) => {
    const [parents, payments] = await Promise.all([obligations.getLocalObligations(userId), obligations.getLocalObligationPayments(userId)]);
    return { parents, payments };
  }, []);
  const resource = useTransactionResource(load, focused);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [removal, setRemoval] = useState<Removal | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = resource.data?.parents.find(row => row.id === selectedId);
  const payments = resource.data?.payments.filter(row => row.obligation_id === selectedId) ?? [];
  const changed = async () => { await refresh(); resource.retry(); };
  const remove = async () => {
    if (!userId || !removal || busy) return;
    setBusy(true);
    try {
      if (removal.kind === 'obligation') { await obligations.deleteLocalObligation(userId, removal.id); setSelectedId(null); }
      else await obligations.deleteLocalObligationPayment(userId, removal.id);
      setRemoval(null); await changed();
    } catch (error) { showErrorToast(error, 'Не удалось удалить'); } finally { setBusy(false); }
  };
  return <ThemedView style={styles.root}><SafeAreaView edges={['bottom']} style={styles.root}>
    <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ThemedText type="subtitle">Кредиты и рассрочки</ThemedText>
      {resource.loading ? <ActivityIndicator /> : resource.error ? <><ThemedText>Не удалось загрузить обязательства</ThemedText><Action onPress={resource.retry}>Повторить</Action></> : selected ? <>
        <Action onPress={() => setSelectedId(null)}>Все обязательства</Action>
        <ThemedText type="subtitle">{selected.name}</ThemedText>
        <ThemedText themeColor="textSecondary">{dateLabel(selected.first_payment_date)} — {dateLabel(selected.last_payment_date)}</ThemedText>
        <ThemedText>{selected.payment_mode === 'fixed' ? `${money(selected.monthly_amount)} в месяц · день ${selected.payment_day}` : 'Разная сумма каждый месяц'}</ThemedText>
        <Action onPress={() => setEditor({ kind: 'obligation', row: selected })}>Изменить обязательство</Action>
        {selected.payment_mode === 'manual' ? <><ThemedText type="small" themeColor="textSecondary">Добавляйте дату и сумму отдельно для каждого месяца. Для месяцев без записи платёж не запланирован.</ThemedText><Action onPress={() => setEditor({ kind: 'payment', parent: selected })}>Добавить платёж на месяц</Action></> : null}
        {!payments.length ? <ThemedText>Платежей пока нет</ThemedText> : null}
        {payments.map(payment => <View key={payment.id} style={styles.card}>
          <ThemedText type="smallBold">{dateLabel(payment.due_date)} · {money(payment.amount)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{payment.transaction_id ? 'Оплачен · плановая сумма' : payment.due_date < calendarDate(new Date()) ? 'Просрочен' : 'Запланирован'}</ThemedText>
          <Action onPress={() => payment.transaction_id ? router.push({ pathname: '/transactions/[id]', params: { id: payment.transaction_id } }) : router.push({ pathname: '/add-expense', params: { paymentId: payment.id } })}>{payment.transaction_id ? 'Открыть расход' : 'Записать оплату'}</Action>
          {!payment.transaction_id && selected.payment_mode === 'manual' ? <View style={styles.row}>
            <Action onPress={() => setEditor({ kind: 'payment', parent: selected, row: payment })}>Изменить</Action>
            <Action danger onPress={() => setRemoval({ kind: 'payment', id: payment.id })}>Удалить</Action>
          </View> : null}
        </View>)}
        {payments.some(row => row.transaction_id) ? <ThemedText type="small" themeColor="textSecondary">Обязательство с оплаченными платежами сохраняется в истории. Связь с платежом можно изменить в расходе.</ThemedText> : <Action danger onPress={() => setRemoval({ kind: 'obligation', id: selected.id })}>Удалить обязательство</Action>}
      </> : <>
        <Action onPress={() => setEditor({ kind: 'obligation' })}>Добавить обязательство</Action>
        {!resource.data?.parents.length ? <ThemedText themeColor="textSecondary">Добавьте кредит или рассрочку и укажите срок платежей.</ThemedText> : null}
        {resource.data?.parents.map(parent => {
          const rows = resource.data?.payments.filter(row => row.obligation_id === parent.id) ?? [];
          const next = rows.find(row => !row.transaction_id);
          return <View key={parent.id} style={styles.card}>
            <ThemedText type="smallBold">{parent.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{parent.payment_mode === 'fixed' ? `${money(parent.monthly_amount)} в месяц` : 'Разная сумма каждый месяц'} · до {dateLabel(parent.last_payment_date)}</ThemedText>
            <ThemedText type="small">{next ? `Ближайший неоплаченный: ${dateLabel(next.due_date)} · ${money(next.amount)}` : parent.payment_mode === 'manual' ? 'Нет запланированных неоплаченных платежей' : 'Все платежи оплачены'}</ThemedText>
            <Action onPress={() => setSelectedId(parent.id)}>Открыть расписание</Action>
          </View>;
        })}
      </>}
    </KeyboardAwareScrollView>
    {editor && userId ? <EditorModal key={editor.kind === 'obligation' ? editor.row?.id ?? 'new' : editor.row?.id ?? editor.parent.id} editor={editor} userId={userId} onClose={() => setEditor(null)} onSaved={async (id) => { setSelectedId(id); setEditor(null); await changed(); }} /> : null}
    <Modal transparent visible={Boolean(removal)} onRequestClose={() => { if (!busy) setRemoval(null); }} animationType="fade">
      <View style={styles.overlay}><ThemedView style={styles.dialog}>
        <ThemedText type="smallBold">{removal?.kind === 'obligation' ? 'Удалить обязательство и его неоплаченные платежи?' : 'Удалить запланированный платёж?'}</ThemedText>
        <Action disabled={busy} danger onPress={() => { void remove(); }}>{busy ? 'Удаление…' : 'Удалить'}</Action>
        <Action disabled={busy} onPress={() => setRemoval(null)}>Отмена</Action>
      </ThemedView></View>
    </Modal>
  </SafeAreaView></ThemedView>;
}

function EditorModal({ editor, userId, onClose, onSaved }: { editor: Editor; userId: string; onClose: () => void; onSaved: (id: string) => Promise<void> }) {
  const row = editor.kind === 'obligation' ? editor.row : editor.parent;
  const existingPayment = editor.kind === 'payment' ? editor.row : undefined;
  const [name, setName] = useState(row?.name ?? '');
  const [mode, setMode] = useState<'fixed' | 'manual'>(row?.payment_mode ?? 'fixed');
  const [categoryId, setCategoryId] = useState<string | null>(row?.category_id ?? null);
  const [amount, setAmount] = useState(existingPayment ? formatTransactionAmountInput(existingPayment.amount) : row?.payment_mode === 'fixed' ? formatTransactionAmountInput(row.monthly_amount) : '');
  const [day, setDay] = useState(String(row?.payment_day ?? new Date().getDate()));
  const [first, setFirst] = useState(row ? localDate(row.first_payment_date) : new Date());
  const [last, setLast] = useState(row ? localDate(row.last_payment_date) : new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate()));
  const [due, setDue] = useState(existingPayment ? localDate(existingPayment.due_date) : row ? localDate(row.first_payment_date) : new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (editor.kind === 'payment') {
        const parsed = parseTransactionAmountInput(amount);
        if (!parsed) throw new Error('Укажите положительную сумму платежа');
        const values = { userId, dueDate: calendarDate(due), amount: parsed };
        if (editor.row) await obligations.updateLocalObligationPayment({ ...values, id: editor.row.id });
        else await obligations.createLocalObligationPayment({ ...values, obligationId: editor.parent.id });
        await onSaved(editor.parent.id);
      } else {
        const common = { userId, name, categoryId, firstPaymentDate: calendarDate(first), lastPaymentDate: calendarDate(last) };
        const parsed = parseTransactionAmountInput(amount);
        if (mode === 'fixed' && !parsed) throw new Error('Укажите положительную сумму платежа');
        const values: obligations.ObligationValues & { userId: string } = mode === 'fixed' ? { ...common, paymentMode: mode, monthlyAmount: parsed!, paymentDay: Number(day) } : { ...common, paymentMode: mode };
        const result = editor.row ? await obligations.updateLocalObligation({ ...values, id: editor.row.id }) : await obligations.createLocalObligation(values);
        await onSaved(result.id);
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Не удалось сохранить'); } finally { setBusy(false); }
  };
  return <Modal visible animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <ThemedView style={styles.root}><SafeAreaView style={styles.root}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bottomOffset={Spacing.three}>
        <ThemedText type="subtitle">{editor.kind === 'payment' ? 'Платёж на месяц' : editor.row ? 'Изменить обязательство' : 'Новое обязательство'}</ThemedText>
        {editor.kind === 'obligation' ? <>
          <Input label="Название" value={name} onChange={setName} />
          {editor.row ? <ThemedText>{mode === 'fixed' ? 'Постоянная сумма' : 'Разная сумма каждый месяц'}</ThemedText> : <View style={styles.row}>
            <Action onPress={() => setMode('fixed')}>{mode === 'fixed' ? '✓ Постоянная сумма' : 'Постоянная сумма'}</Action>
            <Action onPress={() => setMode('manual')}>{mode === 'manual' ? '✓ Разная сумма' : 'Разная сумма'}</Action>
          </View>}
          <DateField label="Начало срока платежей" value={first} onChange={setFirst} maximumDate={futureLimit} />
          <DateField label="Окончание срока платежей" value={last} onChange={setLast} maximumDate={futureLimit} />
          {mode === 'fixed' ? <><Input label="Ежемесячный платёж, KZT" value={amount} onChange={setAmount} numeric /><Input label="День платежа (1–31)" value={day} onChange={setDay} numeric /><ThemedText type="small" themeColor="textSecondary">Если в месяце нет выбранного дня, платёж назначается на последний день месяца. Изменения расписания затрагивают только неоплаченные месяцы.</ThemedText></> : <ThemedText type="small" themeColor="textSecondary">После сохранения добавьте дату и сумму для каждого месяца в расписании.</ThemedText>}
          <TransactionCategoryField type="expense" value={categoryId} onChange={setCategoryId} />
          {categoryId ? <Action onPress={() => setCategoryId(null)}>Без категории</Action> : null}
        </> : <>
          <ThemedText>{editor.parent.name}</ThemedText>
          <DateField label="Дата платежа" value={due} onChange={setDue} minimumDate={localDate(editor.parent.first_payment_date)} maximumDate={localDate(editor.parent.last_payment_date)} />
          <Input label="Сумма платежа, KZT" value={amount} onChange={setAmount} numeric />
          <ThemedText type="small" themeColor="textSecondary">Один платёж на месяц. При изменении можно выбрать другую дату в том же месяце.</ThemedText>
        </>}
        {error ? <ThemedText style={{ color: '#DC2626' }}>{error}</ThemedText> : null}
        <Action disabled={busy} onPress={() => { void save(); }}>{busy ? 'Сохранение…' : 'Сохранить'}</Action>
        <Action disabled={busy} onPress={onClose}>Отмена</Action>
      </KeyboardAwareScrollView>
    </SafeAreaView></ThemedView>
  </Modal>;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five },
  card: { gap: Spacing.two, padding: Spacing.three, borderWidth: 1, borderColor: 'rgba(127,127,127,0.25)', borderRadius: 8 },
  action: { minHeight: 48, padding: Spacing.two, borderWidth: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  field: { gap: Spacing.two },
  input: { minHeight: 52, paddingHorizontal: Spacing.three, fontSize: 16, borderWidth: 1, borderRadius: 8 },
  row: { gap: Spacing.two },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.three, backgroundColor: 'rgba(0,0,0,0.5)' },
  dialog: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.three, borderRadius: 8, gap: Spacing.three },
});
