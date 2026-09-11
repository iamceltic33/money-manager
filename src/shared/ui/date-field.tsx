import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/shared/ui/themed-text';
import { Spacing } from '@/shared/config/theme';
import { useTheme } from '@/shared/lib/theme/use-theme';

type Props = {
  value: Date;
  onChange: (date: Date) => void;
  label: string;
  minimumDate?: Date;
  maximumDate?: Date;
};

export function DateField(props: Props) {
  const { value, label, onChange, minimumDate, maximumDate = new Date() } = props;
  const theme = useTheme();
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [webDateText, setWebDateText] = useState(formatDateInputValue(value));

  const formattedDate = useMemo(
    () =>
      new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(value),
    [value]
  );

  useEffect(() => {
    setWebDateText(formatDateInputValue(value));
  }, [value]);

  const changeDate = (date: Date) => {
    onChange(date);
    setWebDateText(formatDateInputValue(date));
  };

  const handlePress = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        minimumDate,
        maximumDate,
        onValueChange: (_, date) => {
          if (date) {
            changeDate(date);
          }
        },
      });
      return;
    }

    if (Platform.OS === 'ios') {
      setIsPickerVisible((currentValue) => !currentValue);
      return;
    }

    setIsPickerVisible((currentValue) => !currentValue);
  };

  const handleIOSChange = (_: unknown, date?: Date) => {
    if (date) {
      changeDate(date);
    }

    setIsPickerVisible(false);
  };

  const handleWebDateChange = (text: string) => {
    setWebDateText(text);

    const date = parseDateInputValue(text);

    if (!date) return;
    if (minimumDate && date < startOfDay(minimumDate)) return;
    if (maximumDate && date > endOfDay(maximumDate)) return;

    onChange(date);
  };

  return (
    <View style={styles.root}>
      <ThemedText type="smallBold">{label}</ThemedText>

      <Pressable
        accessibilityRole="button"
        onPress={handlePress}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundSelected,
          },
          pressed && styles.pressed,
        ]}
      >
        <ThemedText style={styles.value}>{formattedDate}</ThemedText>
        <Calendar color={theme.textSecondary} size={20} strokeWidth={2.3} />
      </Pressable>

      {Platform.OS === 'web' && isPickerVisible ? (
        <TextInput
          accessibilityLabel={label}
          inputMode="numeric"
          onChangeText={handleWebDateChange}
          placeholder="ГГГГ-ММ-ДД"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.webInput,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.backgroundSelected,
              color: theme.text,
            },
          ]}
          value={webDateText}
        />
      ) : null}

      {Platform.OS === 'ios' && isPickerVisible ? (
        <View
          style={[
            styles.iosPickerWrapper,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.backgroundSelected,
            },
          ]}
        >
          <DateTimePicker
            display="inline"
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            mode="date"
            onValueChange={handleIOSChange}
            value={value}
          />
        </View>
      ) : null}
    </View>
  );
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) {
    return null;
  }

  return date;
}

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

function endOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);

  return nextDate;
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.two,
  },
  field: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  value: {
    flex: 1,
  },
  pressed: {
    opacity: 0.78,
  },
  iosPickerWrapper: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  webInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
});
