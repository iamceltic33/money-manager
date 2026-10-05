import { useTransactionsStore } from "@/entities/transaction";
import { TransactionForm, type TransactionFormValues } from "@/features/transaction/save-transaction";
import { MaxContentWidth, Spacing } from "@/shared/config/theme";
import { showSuccessToast } from "@/shared/model/toast-store";
import { ThemedView } from "@/shared/ui/themed-view";
import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AddExpense() {
    const { createTransaction } = useTransactionsStore();
    const router = useRouter();

    const addExpense = async ({ note, amount, categoryId, date, excludeFromAverage }: TransactionFormValues) => {
        try {
            await createTransaction(amount, 'expense', {
                occurredAt: date,
                categoryId,
                note,
                excludeFromAverage
            });
            showSuccessToast('Расход добавлен');
            router.replace('/');
        } catch {}
    }

    return <ThemedView style={styles.container}>
        <SafeAreaView edges={['bottom']} style={styles.content}>
            <TransactionForm
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
