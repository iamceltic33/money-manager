import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { TransactionDetails } from "@/components/transaction-details";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useTransactionsStore } from "@/store/transactions-store";
import { useLocalSearchParams } from "expo-router";
import { SearchX } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TransactionDetailsPage() {
    const theme = useTheme();
    const params = useLocalSearchParams<{id: string}>();
    const { getTransaction } = useTransactionsStore();
    const transaction = getTransaction(params.id);
    if (!transaction) {
        return (
            <ThemedView style={styles.container}>
                <SafeAreaView edges={['bottom']} style={styles.content}>
                    <View
                        style={[
                            styles.emptyCard,
                            {
                                backgroundColor: theme.backgroundElement,
                                borderColor: theme.backgroundSelected,
                            },
                        ]}
                    >
                        <View style={[styles.emptyIcon, { backgroundColor: theme.background }]}>
                            <SearchX color={theme.textSecondary} size={32} strokeWidth={2.3} />
                        </View>
                        <ThemedText type="smallBold">Транзакция не найдена</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                            Возможно, операция была удалена или еще не загружена.
                        </ThemedText>
                    </View>
                </SafeAreaView>
            </ThemedView>
        );
    }

    return <TransactionDetails transaction={transaction}/>
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
        gap: Spacing.three,
    },
    emptyCard: {
        minHeight: 220,
        borderWidth: 1,
        borderRadius: 8,
        padding: Spacing.four,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.two,
    },
    emptyIcon: {
        width: 56,
        height: 56,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.one,
    },
    emptyText: {
        textAlign: 'center',
    },
});
