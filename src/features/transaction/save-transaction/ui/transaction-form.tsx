import { ObligationPaymentField } from './obligation-payment-field';
import { createTransactionDraft } from '../model/create-transaction-draft';
import type { TransactionDraft } from '../model/transaction-draft';
import type { TransactionFormSubmitResult, TransactionFormValues } from '../model/transaction-form-values';
import { TransactionCategoryField } from "@/entities/category";
import { formatTransactionAmountInput, isTransactionAmountInputAllowed, parseTransactionAmountInput } from "@/entities/transaction";
import { MaxContentWidth, Spacing } from "@/shared/config";
import { useTheme } from "@/shared/lib/theme";
import { CheckboxField, DateField, ThemedText } from "@/shared/ui";
import { useRef, useState, type Dispatch, type SetStateAction, type RefObject } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

export type { TransactionFormSubmitResult, TransactionFormValues } from '../model/transaction-form-values';

type BaseProps = {
    transactionId?: string;
    title: string;
    buttonText: string;
    onSubmit: (values: TransactionFormValues) => void | TransactionFormSubmitResult | Promise<void | TransactionFormSubmitResult>;
    type: 'income' | 'expense';
    notePlaceholder?: string;
    isSubmitting?: boolean;
};

type UncontrolledProps = BaseProps & {
    defaultValues?: Partial<TransactionFormValues>;
    draft?: never;
    onDraftChange?: never;
};

type ControlledProps = BaseProps & {
    draft: TransactionDraft;
    onDraftChange: Dispatch<SetStateAction<TransactionDraft>>;
    defaultValues?: never;
};

type Props = UncontrolledProps | ControlledProps;

const buttonColors: Record<Props['type'], string> = {
    income: '#16A34A',
    expense: '#DC2626',
};

export function TransactionForm(props: Props) {
    return props.isSubmitting === undefined
        ? <LocallySubmittingTransactionForm {...props} />
        : <TransactionFormWithDraft {...props} isSubmitting={props.isSubmitting} />;
}

function LocallySubmittingTransactionForm(props: Props) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const submissionPendingRef = useRef(false);
    const onSubmit = async (values: TransactionFormValues) => {
        if (submissionPendingRef.current) return;
        submissionPendingRef.current = true;
        setIsSubmitting(true);
        try {
            return await props.onSubmit(values);
        } finally {
            submissionPendingRef.current = false;
            setIsSubmitting(false);
        }
    };
    return <TransactionFormWithDraft {...props} onSubmit={onSubmit} isSubmitting={isSubmitting} />;
}

function TransactionFormWithDraft(props: Props & { isSubmitting: boolean }) {
    return props.draft !== undefined
        ? <TransactionFormFields {...props} />
        : <UncontrolledTransactionForm {...props} />;
}

function UncontrolledTransactionForm(props: UncontrolledProps & { isSubmitting: boolean }) {
    const [draft, setDraft] = useState(() => createTransactionDraft(props.defaultValues));
    // Omitted payment IDs preserve existing links; an explicit null removes them.
    const paymentLinkSpecifiedRef = useRef(props.defaultValues?.obligationPaymentId !== undefined);
    const { defaultValues: _defaultValues, ...formProps } = props;

    return <TransactionFormFields {...formProps} draft={draft} onDraftChange={setDraft} paymentLinkSpecifiedRef={paymentLinkSpecifiedRef} />;
}

function TransactionFormFields(props: ControlledProps & { isSubmitting: boolean; paymentLinkSpecifiedRef?: RefObject<boolean> }) {
    const { draft, onDraftChange: setDraft, paymentLinkSpecifiedRef } = props;
    const theme = useTheme();
    const { isSubmitting } = props;
    const { amountText, date, categoryId, note, excludeFromAverage, obligationPaymentId } = draft;
    const isSubmitDisabled = !amountText.trim() || isSubmitting;

    const onAmountChange = (value: string) => {
        if (isTransactionAmountInputAllowed(value)) {
            setDraft(current => ({ ...current, amountText: value }));
        }
    };

    const onSubmit = async () => {
        if (isSubmitting) return;

        const amount = parseTransactionAmountInput(amountText);

        if (!amount) return;

        return await props.onSubmit({
            amount,
            date,
            note: note.trim() || null,
            categoryId,
            excludeFromAverage,
            ...(props.type === 'expense' ? { obligationPaymentId: paymentLinkSpecifiedRef?.current === false ? undefined : obligationPaymentId } : {}),
        });
    };

    return <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        bottomOffset={Spacing.three}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
    >
        <ThemedText type="subtitle" style={styles.title}>{props.title}</ThemedText>

        <TextInput
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={onAmountChange}
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

        <DateField label={props.type === 'income' ? 'Дата дохода' : 'Дата расхода'} value={date} onChange={date => setDraft(current => ({ ...current, date }))} maximumDate={new Date()} />

        <TransactionCategoryField
            type={props.type}
            value={categoryId}
            onChange={categoryId => setDraft(current => ({ ...current, categoryId }))}
        />

        {props.type === 'expense' ? <ObligationPaymentField value={obligationPaymentId} transactionId={props.transactionId} onChange={(id, selection) => {
            if (paymentLinkSpecifiedRef) paymentLinkSpecifiedRef.current = true;
            setDraft(current => ({
                ...current,
                obligationPaymentId: id,
                ...(selection && selection.payment.id !== current.obligationPaymentId ? {
                    amountText: formatTransactionAmountInput(selection.payment.amount),
                    categoryId: selection.categoryId,
                } : {}),
            }));
        }} /> : null}

        <View style={styles.noteField}>
            <ThemedText type="smallBold">Заметка</ThemedText>
            <TextInput
                multiline
                onChangeText={note => setDraft(current => ({ ...current, note }))}
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

        {props.type === 'expense' ? (
            <CheckboxField
                label="Не учитывать в прогнозе"
                checked={excludeFromAverage}
                onChange={excludeFromAverage => setDraft(current => ({ ...current, excludeFromAverage }))}
            />
        ) : null}

        <Pressable
            accessibilityRole="button"
            disabled={isSubmitDisabled}
            onPress={onSubmit}
            style={({ pressed }) => [
                styles.button,
                {
                    backgroundColor: isSubmitDisabled
                        ? theme.backgroundSelected
                        : buttonColors[props.type],
                },
                pressed && !isSubmitDisabled && styles.pressed,
            ]}
        >
            <ThemedText
                style={[
                    styles.buttonText,
                    isSubmitDisabled && { color: theme.textSecondary },
                ]}
            >
                {props.buttonText}
            </ThemedText>
        </Pressable>
    </KeyboardAwareScrollView>
}

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
        width: '100%',
        maxWidth: MaxContentWidth,
    },
    content: {
        flexGrow: 1,
        paddingHorizontal: 0,
        paddingBottom: Spacing.four,
        gap: Spacing.three,
    },
    title: {
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
