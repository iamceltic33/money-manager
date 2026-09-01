import { useTransactionsStore } from "@/entities/transaction";
import { MaxContentWidth, Spacing } from "@/shared/config/theme";
import { useTheme } from "@/shared/lib/theme/use-theme";
import { showSuccessToast } from "@/shared/model/toast-store";
import { ThemedText } from "@/shared/ui/themed-text";
import { ThemedView } from "@/shared/ui/themed-view";
import { TransactionForm, type TransactionFormValues } from "@/features/transaction/save-transaction";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AddIncome() {
    const theme = useTheme();
    const { balance, createTransaction } = useTransactionsStore();
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

    const goBack = () => {
        router.replace('/');
    }

    return <ThemedView style={styles.container}>
        <SafeAreaView edges={['bottom']} style={styles.content}>
            <View style={styles.topBar}>
                <Pressable
                    accessibilityLabel="Назад"
                    accessibilityRole="button"
                    onPress={goBack}
                    style={({ pressed }) => [
                        styles.backButton,
                        { backgroundColor: theme.backgroundElement },
                        pressed && styles.pressed,
                    ]}
                >
                    <ChevronLeft color={theme.text} size={22} strokeWidth={2.4} />
                </Pressable>

                <View style={styles.balanceBlock}>
                    <ThemedText type="small" themeColor="textSecondary">Баланс</ThemedText>
                    <ThemedText type="smallBold">
                        {balance} KZT
                    </ThemedText>
                </View>
            </View>

            <TransactionForm
                type="income"
                onSubmit={addIncome}
                buttonText="Добавить доход"
                notePlaceholder="Например, аванс или премия"
                title="Добавить доход"
                description="Введи сумму поступления, которую нужно добавить к общему балансу."
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
    topBar: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.three,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    balanceBlock: {
        alignItems: 'flex-end',
    },
    pressed: {
        opacity: 0.78,
    },
});
