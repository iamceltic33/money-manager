import { useCallback } from 'react';
import { getLocalObligations, getLocalObligationPayments } from '@/entities/obligation';
import { QueryStatus } from '@/shared/ui/query-status';
import { useTransactionResource, useTransactionsStore } from "@/entities/transaction";
import { TransactionForm, type TransactionFormValues } from "@/features/transaction/save-transaction";
import { MaxContentWidth, Spacing } from "@/shared/config/theme";
import { goBack } from '@/shared/lib/navigation/go-back';
import { showSuccessToast } from "@/shared/model/toast-store";
import { ThemedView } from "@/shared/ui/themed-view";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function AddExpensePage() {
    const { createTransaction } = useTransactionsStore();
    const router = useRouter();
    const { paymentId } = useLocalSearchParams<{ paymentId?: string }>();

    const load = useCallback(async (userId: string) => {
        if (!paymentId) return {};
        const [parents, payments] = await Promise.all([getLocalObligations(userId), getLocalObligationPayments(userId)]);
        const payment = payments.find(row => row.id === paymentId && !row.transaction_id);
        if (!payment) throw new Error('Платёж недоступен');
        return { obligationPaymentId: payment.id, amount: payment.amount, categoryId: parents.find(row => row.id === payment.obligation_id)?.category_id ?? null };
    }, [paymentId]);
    const resource = useTransactionResource(load, true, false);

    const addExpense = async ({ note, amount, categoryId, date, excludeFromAverage, obligationPaymentId }: TransactionFormValues) => {
        try {
            await createTransaction(amount, 'expense', {
                occurredAt: date,
                categoryId,
                note,
                excludeFromAverage,
                obligationPaymentId
            });
            showSuccessToast('Расход добавлен');
            goBack(router, '/add-expense');
        } catch {}
    }

    if (resource.loading || resource.error) return <ThemedView style={{ flex: 1 }}><QueryStatus loading={resource.loading} error={resource.error} retry={resource.retry} /></ThemedView>;

    return <ThemedView style={styles.container}>
        <SafeAreaView edges={['bottom']} style={styles.content}>
            <TransactionForm
                key={paymentId ?? 'ordinary'}
                defaultValues={resource.data}
                type="expense"
                onSubmit={addExpense}
                buttonText="Добавить расход"
                notePlaceholder="Например, продукты или такси"
                title="Добавить расход"
            />
        </SafeAreaView>
    </ThemedView>
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
    },
    content: {
        flex: 1,
        width: '100%',
        maxWidth: MaxContentWidth,
        paddingHorizontal: Spacing.four,
        paddingTop: Spacing.five,
        gap: Spacing.three,
    },
});
