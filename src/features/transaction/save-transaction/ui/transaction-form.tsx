import { TransactionCategoryField } from "@/entities/category";
import { MaxContentWidth, Spacing } from "@/shared/config";
import { useTheme } from "@/shared/lib/theme";
import { DateField, ThemedText } from "@/shared/ui";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

export type TransactionFormValues = {
    note: string | null;
    amount: number;
    categoryId: string | null;
    date: Date;
};

type Props = {
    title: string;
    description: string;
    buttonText: string;
    onSubmit: (values: TransactionFormValues) => void | Promise<void>;
    type: 'income' | 'expense';
    notePlaceholder?: string;
    defaultValues?: Partial<TransactionFormValues>
};

const buttonColors: Record<Props['type'], string> = {
    income: '#16A34A',
    expense: '#DC2626',
};

function parseAmount(value: string) {
    const normalizedValue = value.trim().replace(',', '.');

    if (!/^\d+(\.\d+)?$/.test(normalizedValue)) {
        return null;
    }

    const amount = Number(normalizedValue);

    return amount > 0 ? amount : null;
}

export function TransactionForm(props: Props) {
    const { defaultValues } = props;
    const theme = useTheme();
    const [amountText, setAmountText] = useState<string>(defaultValues?.amount?.toString() ?? '');
    const [date, setDate] = useState(defaultValues?.date ?? new Date());
    const [categoryId, setCategoryId] = useState<string | null>(defaultValues?.categoryId ?? null);
    const [note, setNote] = useState(defaultValues?.note ?? '');

    const onSubmit = () => {
        const amount = parseAmount(amountText);

        if (!amount) return;

        props.onSubmit({
            amount,
            date,
            note: note.trim() || null,
            categoryId,
        });
    };

    return <View style={styles.content}>
        <ThemedText type="subtitle" style={styles.title}>{props.title}</ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.description}>{props.description}</ThemedText>

        <TextInput
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setAmountText}
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
            value={amountText}
            maxLength={256}
        />

        <DateField label={props.type === 'income' ? 'Дата дохода' : 'Дата расхода'} value={date} onChange={setDate} maximumDate={new Date()} />

        <TransactionCategoryField
            type={props.type}
            value={categoryId}
            onChange={setCategoryId}
        />

        <View style={styles.noteField}>
            <ThemedText type="smallBold">Заметка</ThemedText>
            <TextInput
                multiline
                onChangeText={setNote}
                placeholder={props.notePlaceholder}
                placeholderTextColor={theme.textSecondary}
                style={[
                    styles.noteInput,
                    {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.backgroundSelected,
                        color: theme.text,
                    },
                ]}
                textAlignVertical="top"
                value={note}
            />
        </View>

        <Pressable
            accessibilityRole="button"
            onPress={onSubmit}
            style={({ pressed }) => [
                styles.button,
                { backgroundColor: buttonColors[props.type] },
                pressed && styles.pressed,
            ]}
        >
            <ThemedText style={styles.buttonText}>{props.buttonText}</ThemedText>
        </Pressable>
    </View>
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        width: '100%',
        maxWidth: MaxContentWidth,
        paddingHorizontal: 0,
        gap: Spacing.three,
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
    noteField: {
        gap: Spacing.two,
    },
    noteInput: {
        minHeight: 96,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.three,
        fontSize: 16,
        lineHeight: 22,
        fontWeight: '500',
    },
    button: {
        minHeight: 52,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
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
