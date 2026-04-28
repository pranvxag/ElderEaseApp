import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import {
    getDefaultTimeSlots,
    getRequiredSlotCount,
    TIME_SLOT_OPTIONS,
} from '@/lib/medicine';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  frequency: string;
  selectedTimes: string[];
  onChange: (times: string[]) => void;
};

export default function MedicineTimeSlotPicker({ frequency, selectedTimes, onChange }: Props) {
  const requiredCount = getRequiredSlotCount(frequency);
  const selected = useMemo(() => Array.from(new Set(selectedTimes.filter(Boolean))), [selectedTimes]);

  const toggleTime = (slot: string) => {
    const exists = selected.includes(slot);
    if (exists) {
      onChange(selected.filter((item) => item !== slot));
      return;
    }

    if (requiredCount === 1) {
      onChange([slot]);
      return;
    }

    if (selected.length >= requiredCount) {
      onChange([...selected.slice(1), slot]);
      return;
    }

    onChange([...selected, slot]);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Time slots</Text>
        <Text style={styles.helper}>{requiredCount === 1 ? 'Choose 1' : `Choose ${requiredCount}`}</Text>
      </View>

      <View style={styles.chipWrap}>
        {TIME_SLOT_OPTIONS.map((slot) => {
          const active = selected.includes(slot);
          return (
            <TouchableOpacity
              key={slot}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggleTime(slot)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{slot}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.note}>
        {selected.length > 0
          ? `Selected: ${selected.join(' • ')}`
          : `Default: ${getDefaultTimeSlots(frequency).join(' • ')}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeights.semibold,
  },
  helper: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  chipTextActive: {
    color: Colors.textOnPrimary,
  },
  note: {
    marginTop: 6,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
});