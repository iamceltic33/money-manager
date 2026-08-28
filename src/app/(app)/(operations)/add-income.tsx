import { ThemedText } from "@/shared/ui/themed-text";
import { ThemedView } from "@/shared/ui/themed-view";
import { DateField } from "@/shared/ui/date-field";
import { MaxContentWidth, Spacing } from "@/shared/config/theme";
import { useTheme } from "@/shared/lib/theme/use-theme";
import { showSuccessToast } from "@/shared/model/toast-store";
import { useTransactionsStore } from "@/entities/transaction";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AddIncome() {
    const theme = useTheme();
    const [textValue, setTextValue] = useState('');
    const { balance, createTransaction } = useTransactionsStore();
    const router = useRouter();
    const [date, setDate] = useState(new Date());

    const addIncome = async () => {
        if (!textValue) return;
        const amount = Number(textValue);
        if (isNaN(amount)) return;
        try {
            await createTransaction(amount, 'income', { occurredAt: date });
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

            <ThemedText type="subtitle" style={styles.title}>Добавить доход</ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.description}>
                Введи сумму поступления, которую нужно добавить к общему балансу.
            </ThemedText>

            <TextInput
                inputMode="decimal"
                keyboardType="decimal-pad"
                onChangeText={setTextValue}
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
                style={[
                    styles.input,
                    {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.backgroundSelected,
                        color: theme.text,
                    },
                ]}
                value={textValue}
            />

            <DateField label="Дата расхода" value={date} onChange={setDate} maximumDate={new Date()}/>

            <Pressable
                accessibilityRole="button"
                onPress={addIncome}
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
                <ThemedText style={styles.buttonText}>Добавить доход</ThemedText>
            </Pressable>
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
    title: {
        textAlign: 'center',
    },
    description: {
        textAlign: 'center',
    },
    input: {
        minHeight: 72,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: Spacing.four,
        fontSize: 32,
        lineHeight: 38,
        fontWeight: '700',
        textAlign: 'center',
    },
    button: {
        minHeight: 52,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#16A34A',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        lineHeight: 22,
        fontWeight: '700',
    },
    pressed: {
        opacity: 0.78,
    },
});
