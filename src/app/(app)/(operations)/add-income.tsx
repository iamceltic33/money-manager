import { useTransactionsStore } from "@/entities/transaction";
import { TransactionForm, type TransactionFormValues } from "@/features/transaction/save-transaction";
import { MaxContentWidth, Spacing } from "@/shared/config/theme";
import { showSuccessToast } from "@/shared/model/toast-store";
import { ThemedView } from "@/shared/ui/themed-view";
import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AddIncome() {
    const { createTransaction } = useTransactionsStore();
    const router = useRouter();

    const addIncome = async ({note, amount, categoryId, date}: TransactionFormValues) => {
        try {
            await createTransaction(amount, 'income', {
                occurredAt: date,
                categoryId,
                note,
            });
            showSuccessToast('Доход добавлен');
            router.replace('/');
        } catch {}
    }

    return <ThemedView style={styles.container}>
        <SafeAreaView edges={['bottom']} style={styles.content}>
            <TransactionForm
                type="income"
                onSubmit={addIncome}
                buttonText="Добавить доход"
                notePlaceholder="Например, аванс или премия"
                title="Добавить доход"
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
