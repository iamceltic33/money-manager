import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

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

  const formattedDate = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value);

  const handlePress = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        minimumDate,
        maximumDate,
        onValueChange: (_, date) => {
          if (date) {
            onChange(date);
          }
        },
      });
      return;
    }

    if (Platform.OS === 'ios') {
      setIsPickerVisible((currentValue) => !currentValue);
      return;
    }

    // TODO: Add a web date picker fallback for React Native Web.
  };

  const handleIOSChange = (_: unknown, date?: Date) => {
    if (date) {
      onChange(date);
    }

    setIsPickerVisible(false);
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
});
