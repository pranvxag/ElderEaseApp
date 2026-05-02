import { useAuth } from '@/hooks/useAuth';
import { useAutoSaveWeeklyReport } from '@/hooks/useAutoSaveWeeklyReport';
import { useMedications } from '@/hooks/useMedications';
import { useMedicines } from '@/hooks/useMedicines';
import { useUserProfile } from '@/hooks/useUserProfile';
import { addMedicineToLogs, getLocalDateKey } from '@/lib/medicine-logs';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import {
  Alert,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Medication, MedStatus } from '../../constants/data';
import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '../../constants/theme';
import {
  formatMedicationScheduleSummary,
  FREQUENCY_OPTIONS,
  getDefaultTimeSlots,
  normalizeTimeSlots,
  slotToReminderTime,
} from '../../lib/medicine';

const TIME_ITEM_HEIGHT = 48;

const HOURS = Array.from({ length: 12 }, (_, idx) => String(idx + 1));
const MINUTES = Array.from({ length: 12 }, (_, idx) => String(idx * 5).padStart(2, '0'));
const PERIODS = ['AM', 'PM'] as const;

const STATUS_CONFIG: Record<MedStatus, { label: string; color: string; bg: string; icon: string }> = {
  taken: { label: 'Taken ✓', color: Colors.success, bg: Colors.successLight, icon: 'checkmark-circle' },
  upcoming: { label: 'Upcoming', color: Colors.warning, bg: Colors.warningLight, icon: 'time-outline' },
  missed: { label: 'Missed', color: Colors.missed, bg: Colors.missedLight, icon: 'close-circle' },
  skipped: { label: 'Skipped', color: Colors.textMuted, bg: Colors.inputBg, icon: 'remove-circle-outline' },
};

const PILL_COLORS = ['#FF6B6B', '#4ECDC4', '#A78BFA', '#FCD34D', '#60A5FA', '#34D399', '#FB923C'];

const FREQUENCY_TO_TRACKER: Record<string, Medication['frequency']> = {
  'Once a day': 'daily',
  'Twice a day': 'twice-daily',
  'Three times a day': 'daily',
  'Every 8 hours': 'daily',
  'Every 12 hours': 'twice-daily',
  Weekly: 'weekly',
  'As needed': 'as-needed',
};

function Dropdown({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Select…',
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={dd.wrapper}>
      <Text style={dd.label}>{label}</Text>
      <TouchableOpacity style={dd.trigger} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={value ? dd.triggerText : dd.placeholder}>{value || placeholder}</Text>
        <Text style={dd.arrow}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={dd.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={dd.sheet}>
            <Text style={dd.sheetTitle}>{label}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[dd.option, value === option && dd.optionActive]}
                  onPress={() => {
                    onSelect(option);
                    setOpen(false);
                  }}
                >
                  <Text style={[dd.optionText, value === option && dd.optionTextActive]}>{option}</Text>
                  {value === option && <Text style={dd.check}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function getReminderDefaultsByFrequency(frequency: string): string[] {
  if (frequency === 'Twice a day') {
    return ['09:00 AM', '06:00 PM'];
  }
  if (frequency === 'Three times a day') {
    return ['08:00 AM', '01:00 PM', '08:00 PM'];
  }
  return ['09:00 AM'];
}

function normalizeDisplayTime(time: string): string {
  const [rawTime, periodRaw] = (time || '09:00 AM').split(' ');
  const period = periodRaw === 'PM' ? 'PM' : 'AM';
  const [rawHour = '9', rawMinute = '00'] = rawTime.split(':');
  const hourNum = Number.parseInt(rawHour, 10);
  const minuteNum = Number.parseInt(rawMinute, 10);
  const hour = Number.isFinite(hourNum) && hourNum >= 1 && hourNum <= 12 ? String(hourNum).padStart(2, '0') : '09';
  const minute = Number.isFinite(minuteNum) ? String(minuteNum).padStart(2, '0') : '00';
  return `${hour}:${minute} ${period}`;
}

function AlarmTimePicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (time: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState('09');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');

  const hourRef = React.useRef<ScrollView>(null);
  const minuteRef = React.useRef<ScrollView>(null);
  const periodRef = React.useRef<ScrollView>(null);

  const displayValue = normalizeDisplayTime(value || '09:00 AM');

  const syncFromValue = React.useCallback((nextValue: string) => {
    const normalized = normalizeDisplayTime(nextValue || '09:00 AM');
    const [timePart, periodPart] = normalized.split(' ');
    const [hourPart, minutePart] = timePart.split(':');
    setSelectedHour(hourPart);
    setSelectedMinute(minutePart);
    setSelectedPeriod(periodPart === 'PM' ? 'PM' : 'AM');

    const hourIndex = Math.max(0, HOURS.findIndex((item) => item === String(Number.parseInt(hourPart, 10))));
    const minuteIndex = Math.max(0, MINUTES.findIndex((item) => item === minutePart));
    const periodIndex = PERIODS.findIndex((item) => item === (periodPart === 'PM' ? 'PM' : 'AM'));

    requestAnimationFrame(() => {
      hourRef.current?.scrollTo({ y: hourIndex * TIME_ITEM_HEIGHT, animated: false });
      minuteRef.current?.scrollTo({ y: minuteIndex * TIME_ITEM_HEIGHT, animated: false });
      periodRef.current?.scrollTo({ y: Math.max(0, periodIndex) * TIME_ITEM_HEIGHT, animated: false });
    });
  }, []);

  const onHourScrollEnd = (offsetY: number) => {
    const idx = Math.max(0, Math.min(HOURS.length - 1, Math.round(offsetY / TIME_ITEM_HEIGHT)));
    setSelectedHour(String(Number(HOURS[idx])).padStart(2, '0'));
  };

  const onMinuteScrollEnd = (offsetY: number) => {
    const idx = Math.max(0, Math.min(MINUTES.length - 1, Math.round(offsetY / TIME_ITEM_HEIGHT)));
    setSelectedMinute(MINUTES[idx]);
  };

  const onPeriodScrollEnd = (offsetY: number) => {
    const idx = Math.max(0, Math.min(PERIODS.length - 1, Math.round(offsetY / TIME_ITEM_HEIGHT)));
    setSelectedPeriod(PERIODS[idx]);
  };

  return (
    <View style={dd.wrapper}>
      <Text style={dd.label}>{label}</Text>
      <TouchableOpacity
        style={styles.timeDisplay}
        activeOpacity={0.85}
        onPress={() => {
          syncFromValue(displayValue);
          setOpen(true);
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="alarm-outline" size={20} color={Colors.primary} />
          <Text style={styles.timeDisplayText}>{displayValue}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.timePickerModal} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.timePickerSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.timePickerTitle}>{label}</Text>

            <View style={styles.timeColumns}>
              <View pointerEvents="none" style={styles.timeSelectionZone} />

              <View style={styles.timeColumn}>
                <ScrollView
                  ref={hourRef}
                  snapToInterval={TIME_ITEM_HEIGHT}
                  decelerationRate="fast"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.timeColumnContent}
                  onMomentumScrollEnd={(e) => onHourScrollEnd(e.nativeEvent.contentOffset.y)}
                >
                  {HOURS.map((hour) => {
                    const hourDisplay = String(Number(hour)).padStart(2, '0');
                    const selected = selectedHour === hourDisplay;
                    return (
                      <TouchableOpacity
                        key={hour}
                        style={[styles.timeItem, selected && styles.timeItemSelected]}
                        onPress={() => {
                          setSelectedHour(hourDisplay);
                          const idx = HOURS.findIndex((item) => item === hour);
                          hourRef.current?.scrollTo({ y: idx * TIME_ITEM_HEIGHT, animated: true });
                        }}
                      >
                        <Text style={[styles.timeItemText, selected && styles.timeItemTextSelected]}>{hour}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.timeColumn}>
                <ScrollView
                  ref={minuteRef}
                  snapToInterval={TIME_ITEM_HEIGHT}
                  decelerationRate="fast"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.timeColumnContent}
                  onMomentumScrollEnd={(e) => onMinuteScrollEnd(e.nativeEvent.contentOffset.y)}
                >
                  {MINUTES.map((minute) => {
                    const selected = selectedMinute === minute;
                    return (
                      <TouchableOpacity
                        key={minute}
                        style={[styles.timeItem, selected && styles.timeItemSelected]}
                        onPress={() => {
                          setSelectedMinute(minute);
                          const idx = MINUTES.findIndex((item) => item === minute);
                          minuteRef.current?.scrollTo({ y: idx * TIME_ITEM_HEIGHT, animated: true });
                        }}
                      >
                        <Text style={[styles.timeItemText, selected && styles.timeItemTextSelected]}>{minute}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.timeColumn}>
                <ScrollView
                  ref={periodRef}
                  snapToInterval={TIME_ITEM_HEIGHT}
                  decelerationRate="fast"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.timeColumnContent}
                  onMomentumScrollEnd={(e) => onPeriodScrollEnd(e.nativeEvent.contentOffset.y)}
                >
                  {PERIODS.map((period) => {
                    const selected = selectedPeriod === period;
                    return (
                      <TouchableOpacity
                        key={period}
                        style={[styles.timeItem, selected && styles.timeItemSelected]}
                        onPress={() => {
                          setSelectedPeriod(period);
                          const idx = PERIODS.findIndex((item) => item === period);
                          periodRef.current?.scrollTo({ y: idx * TIME_ITEM_HEIGHT, animated: true });
                        }}
                      >
                        <Text style={[styles.timeItemText, selected && styles.timeItemTextSelected]}>{period}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity
              style={styles.timeConfirmBtn}
              activeOpacity={0.9}
              onPress={() => {
                onChange(`${selectedHour}:${selectedMinute} ${selectedPeriod}`);
                setOpen(false);
              }}
            >
              <Text style={styles.timeConfirmText}>Set Reminder</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const dd = StyleSheet.create({
  wrapper: { marginTop: 10 },
  label: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginBottom: Spacing.xs },
  trigger: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  triggerText: { color: Colors.textPrimary, fontSize: FontSizes.md },
  placeholder: { color: Colors.textMuted, fontSize: FontSizes.md },
  arrow: { color: Colors.textMuted, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    padding: Spacing.lg,
    maxHeight: '60%',
  },
  sheetTitle: {
    color: Colors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    marginBottom: Spacing.md,
  },
  option: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radii.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  optionActive: { backgroundColor: Colors.primary + '22' },
  optionText: { color: Colors.textPrimary, fontSize: FontSizes.md },
  optionTextActive: { color: Colors.primary, fontWeight: FontWeights.bold },
  check: { color: Colors.primary, fontWeight: FontWeights.bold },
});

function MedCard({
  med,
  onEdit,
  onMarkTaken,
  onMarkNotTaken,
  onSnooze,
  onDelete,
  onUndo,
  canUndoTaken,
}: {
  med: Medication;
  onEdit: (med: Medication) => void;
  onMarkTaken: (id: string) => void;
  onMarkNotTaken: (id: string) => void;
  onSnooze: (id: string) => void;
  onDelete: (id: string) => void;
  onUndo: (id: string) => void;
  canUndoTaken: (id: string) => boolean;
}) {
  const cfg = STATUS_CONFIG[med.status];
  const scheduleSummary = formatMedicationScheduleSummary(
    med.frequency,
    med.times?.length ? med.times.filter((t): t is string => t !== undefined) : [med.time || '9:00 AM'],
  );
  return (
    <View style={[styles.medCardCompact, med.status === 'taken' && styles.medCardTaken]}>
      <View style={[styles.medLeftCompact, { borderLeftColor: med.color }]}>
        <Text style={[styles.medNameCompact, med.status === 'taken' && styles.textDim]} numberOfLines={1}>
          {med.name}
        </Text>
        {/** Show dose label if present */}
        {(med as any).doseLabel && (
          <Text style={styles.doseLabelText}>{(med as any).doseLabel} • {med.time}</Text>
        )}
        <Text style={styles.medMetaCompact}>{med.dosage} • {scheduleSummary}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <Ionicons name="alarm-outline" size={12} color={Colors.primary} />
          <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: '600' }}>
            Reminder: {(med as any).reminderTime || med.time}
          </Text>
        </View>
      </View>

      <View style={styles.medRightCompact}>
        <View style={[styles.statusBadgeCompact, { backgroundColor: cfg.bg }]}> 
          <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
          <Text style={[styles.statusTextCompact, { color: cfg.color }]}>{cfg.label}</Text>
        </View>

        {med.status !== 'taken' ? (
          <TouchableOpacity style={styles.btnTakenCompact} onPress={() => {
            console.log('Mark Taken button pressed for:', med.id);
            onMarkTaken(med.id);
          }} activeOpacity={0.85}>
            <Text style={styles.btnTakenText}>Mark Taken</Text>
          </TouchableOpacity>
        ) : (
          canUndoTaken(med.id) && (
            <TouchableOpacity style={styles.btnUndoCompact} onPress={() => onUndo(med.id)} activeOpacity={0.85}>
              <Text style={styles.btnUndoText}>Undo</Text>
            </TouchableOpacity>
          )
        )}

        <View style={styles.iconRowCompact}>
          <TouchableOpacity onPress={() => onEdit(med)} style={styles.iconBtn} activeOpacity={0.8}>
            <Ionicons name="create-outline" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(med.id)} style={styles.iconBtn} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function MedicationsScreen() {
  const {
    meds,
    addMedication,
    updateMedication,
    markTaken,
    markNotTaken,
    snoozeMedication,
    undoTaken,
    canUndoTaken,
    deleteMed,
    recentMedicineLogs,
    loading,
  } = useMedications();
  const { autoSaveAfterUpdate } = useAutoSaveWeeklyReport();
  const { loading: profileMedicinesLoading } = useMedicines();
  const { user } = useAuth();
  const { profile, saveProfile, loading: profileLoading } = useUserProfile();
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<MedStatus | 'all'>('all');
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [selectedLogDate, setSelectedLogDate] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  React.useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Add med form state
  const [newName, setNewName] = useState('');
  const [newDosage, setNewDosage] = useState('');
  const [newFrequency, setNewFrequency] = useState('');
  const [newTimeSlots, setNewTimeSlots] = useState<string[]>(getDefaultTimeSlots('Once a day'));
  const [reminderTimes, setReminderTimes] = useState<string[]>(['09:00 AM']);
  const [newNotes, setNewNotes] = useState('');
  const [newDurationDays, setNewDurationDays] = useState('');
  const [selectedColor, setSelectedColor] = useState(PILL_COLORS[0]);

  React.useEffect(() => {
    setNewTimeSlots(reminderTimes.map((time) => normalizeDisplayTime(time)));
  }, [reminderTimes]);

  const swipeDownResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 40) {
            setShowModal(false);
          }
        },
      }),
    []
  );

  const takenCount = meds.filter((m) => m.status === 'taken').length;
  const totalCount = meds.length;
  const adherence = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  const filtered = filter === 'all' ? meds : meds.filter((m) => m.status === filter);

  const expandedMeds = React.useMemo(() => {
    const todayKey = getLocalDateKey();
    const todayLog = recentMedicineLogs.find((d) => d.date === todayKey);
    return filtered.flatMap((med) => {
      // single-dose medicine: return with status from today's entry if present
      if (!med.times || med.times.length <= 1) {
        const entry = todayLog?.entries.find((e) => e.medicineId === med.id && e.doseIndex === 0);
        const status = entry
          ? entry.status === 'taken'
            ? 'taken'
            : entry.status === 'not_taken'
            ? 'missed'
            : entry.status === 'snoozed'
            ? 'skipped'
            : 'upcoming'
          : med.status;
        return [{ ...med, status } as Medication];
      }

      return med.times.map((time, index) => {
        const entry = todayLog?.entries.find((e) => e.medicineId === med.id && e.doseIndex === index);
        const status = entry
          ? entry.status === 'taken'
            ? 'taken'
            : entry.status === 'not_taken'
            ? 'missed'
            : entry.status === 'snoozed'
            ? 'skipped'
            : 'upcoming'
          : 'upcoming';
        return ({
          ...med,
          id: `${med.id}:${index}`,
          originalId: med.id,
          time,
          doseLabel: `Dose ${index + 1}`,
          doseIndex: index,
          status,
        } as any);
      });
    });
  }, [filtered]);

  const effectiveSelectedLogDate = React.useMemo(() => {
    if (recentMedicineLogs.length === 0) return '';
    if (selectedLogDate && recentMedicineLogs.some((day) => day.date === selectedLogDate)) {
      return selectedLogDate;
    }
    return recentMedicineLogs[recentMedicineLogs.length - 1].date;
  }, [recentMedicineLogs, selectedLogDate]);

  if (loading || profileLoading || profileMedicinesLoading) return null;

  function openAddModal() {
    setEditingMedication(null);
    setNewName('');
    setNewDosage('');
    setNewFrequency('');
    setNewTimeSlots(getDefaultTimeSlots('Once a day'));
    setReminderTimes(['09:00 AM']);
    setNewNotes('');
    setNewDurationDays('');
    setSelectedColor(PILL_COLORS[0]);
    setShowModal(true);
  }

  function openEditModal(med: Medication) {
    setEditingMedication(med);
    setNewName(med.name);
    setNewDosage(med.dosage);
    setNewFrequency(med.frequency === 'twice-daily' ? 'Twice a day' : med.frequency === 'weekly' ? 'Weekly' : med.frequency === 'as-needed' ? 'As needed' : 'Once a day');
    const existingTimes = normalizeTimeSlots(
      med.times?.length ? med.times.filter((t): t is string => t !== undefined) : [med.time || '9:00 AM'],
      med.frequency,
    );
    setReminderTimes(existingTimes.map((time) => normalizeDisplayTime(time)));
    setNewTimeSlots(existingTimes);
    setNewNotes(med.instructions || med.purpose || '');
    setNewDurationDays(med.durationDays ? String(med.durationDays) : '');
    setSelectedColor(med.color);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingMedication(null);
  }

  function handleMarkTaken(id: string, doseIndex: number = 0) {
    console.log('handleMarkTaken called with id:', id, 'doseIndex:', doseIndex);
    markTaken(id, doseIndex);
    autoSaveAfterUpdate();
  }

  function handleMarkNotTaken(id: string) {
    const med = expandedMeds.find((m) => m.id === id);
    const doseIndex = (med as any)?.doseIndex ?? 0;
    markNotTaken(id, doseIndex);
    // Auto-save weekly report after medicine status changes
    autoSaveAfterUpdate();
  }

  function handleSnooze(id: string) {
    const med = expandedMeds.find((m) => m.id === id);
    const doseIndex = (med as any)?.doseIndex ?? 0;
    snoozeMedication(id, doseIndex);
    // Auto-save weekly report after medicine status changes
    autoSaveAfterUpdate();
  }

  function handleUndo(id: string) {
    const med = expandedMeds.find((m) => m.id === id);
    const doseIndex = (med as any)?.doseIndex ?? 0;
    undoTaken(id, doseIndex);
    // Auto-save weekly report after medicine status changes
    autoSaveAfterUpdate();
  }

  async function handleDelete(id: string) {
    try {
      await deleteMed(id);
    } catch (error) {
      console.error('Delete medicine failed:', error);
      Alert.alert('Delete failed', 'Could not remove medicine right now. Please try again.');
    }
  }

  function toReminderTime(label: string): string {
    return slotToReminderTime(label);
  }

  function toTrackerFrequency(label: string): Medication['frequency'] {
    return FREQUENCY_TO_TRACKER[label] || 'daily';
  }

  function parseDurationDays(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const parsed = Number.parseInt(value.trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
    return parsed;
  }

  async function handleAddMed() {
    if (!newName.trim() || !newDosage.trim() || !newFrequency.trim()) {
      Alert.alert('Missing Info',
        'Please fill medicine name, dosage, and frequency.');
      return;
    }

    const uid = user?.uid;
    if (!uid) {
      Alert.alert('Not signed in', 'Please sign in to add medicines.');
      return;
    }

    const name = newName.trim();
    const dosage = newDosage.trim();
    const frequencyLabel = newFrequency.trim();
    const notes = newNotes.trim();
    const duration = parseDurationDays(newDurationDays);

    const timesToUse = reminderTimes?.length > 0
      ? reminderTimes
      : newTimeSlots?.length > 0
      ? newTimeSlots
      : ['09:00 AM'];

    console.log('Calling addMedicineToLogs with uid:', uid);

    try {
      await addMedicineToLogs(uid, {
        name,
        dosage,
        times: timesToUse,
        frequency: frequencyLabel,
        notes: notes || null,
        reminderTime: timesToUse[0],
      }, duration);

      setNewName('');
      setNewDosage('');
      setNewFrequency('');
      setNewTimeSlots(getDefaultTimeSlots('Once a day'));
      setReminderTimes(['09:00 AM']);
      setNewNotes('');
      setNewDurationDays('');
      setSelectedColor(PILL_COLORS[0]);
      closeModal();

    } catch (error) {
      console.error('Add medicine failed:', error);
      Alert.alert('Save failed',
        'Could not add medicine. Please try again.');
    }
  }

  return (
    <View style={styles.screen}>
      {/* ── Adherence Summary ── */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryLeft}>
          <Text style={styles.summaryTitle}>Today{"'"}s Adherence</Text>
          <Text style={styles.summarySubtitle}>
            {takenCount} of {totalCount} medicines taken
          </Text>
        </View>
        <View style={styles.summaryCircle}>
          <Text style={styles.summaryPct}>{adherence}%</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${adherence}%` }]} />
      </View>

      {/* ── Filter Tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {(['all', 'upcoming', 'taken', 'missed'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => {
              if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setFilter(f);
            }}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all'
                ? `All (${meds.length})`
                : `${f.charAt(0).toUpperCase() + f.slice(1)} (${meds.filter((m) => m.status === f).length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Today&apos;s Medicines</Text>
          <Text style={styles.sectionSubtitle}>Keep only today&apos;s schedule visible here</Text>
        </View>
        <View style={styles.sectionPill}>
          <Text style={styles.sectionPillText}>{meds.length} active</Text>
        </View>
      </View>

      {/* ── Med List ── */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 800); }} />}
      >
        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>💊</Text>
            <Text style={styles.emptyText}>No {filter !== 'all' ? filter : ''} medications</Text>
          </View>
        )}
        {expandedMeds.map((med) => (
          <MedCard
            key={med.id}
            med={med}
            onEdit={openEditModal}
            onMarkTaken={(id) => {
              console.log('MedCard onMarkTaken pressed, id:', id, 'med.id:', med.id, 'med.originalId:', med.originalId);
              handleMarkTaken(med.id, (med as any).doseIndex ?? 0);
            }}
            onMarkNotTaken={handleMarkNotTaken}
            onSnooze={handleSnooze}
            onDelete={(id) => handleDelete((med as any).originalId ?? id)}
            onUndo={handleUndo}
            canUndoTaken={canUndoTaken}
          />
        ))}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* History moved to floating button/modal */}

      <TouchableOpacity style={styles.historyFab} onPress={() => setShowHistoryModal(true)} activeOpacity={0.85}>
        <Ionicons name="time-outline" size={22} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showHistoryModal} transparent animationType="slide" onRequestClose={() => setShowHistoryModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowHistoryModal(false)}>
          <Pressable style={[styles.modalSheet, { maxHeight: '70%' }]} onPress={(e) => e.stopPropagation()}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.historyTitle}>7-Day History</Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)} style={styles.closeButton}>
                <Ionicons name="close" size={18} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyChips}>
              {recentMedicineLogs.map((day) => (
                <TouchableOpacity
                  key={day.date}
                  style={[styles.historyChip, effectiveSelectedLogDate === day.date && styles.historyChipActive]}
                  onPress={() => setSelectedLogDate(day.date)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.historyChipText, effectiveSelectedLogDate === day.date && styles.historyChipTextActive]}>
                    {day.date.slice(5).replace('-', '/')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ marginTop: 8 }}>
              {recentMedicineLogs
                .filter((day) => day.date === effectiveSelectedLogDate)
                .map((day) => (
                  <ScrollView key={day.date} style={styles.historyCard} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {day.entries.length === 0 ? (
                      <Text style={styles.historyEmpty}>No log entries for this day yet.</Text>
                    ) : (
                      day.entries.map((entry) => (
                        <View key={entry.id} style={styles.historyRow}>
                          <View style={styles.historyRowLeft}>
                            <Text style={styles.historyMedicine}>{entry.medicineName}</Text>
                            <Text style={styles.historyMeta}>{entry.scheduledTime}</Text>
                          </View>
                          <Text style={styles.historyStatus}>{entry.status.replace('_', ' ')}</Text>
                        </View>
                      ))
                    )}
                  </ScrollView>
                ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Add FAB ── */}
      <TouchableOpacity style={styles.fab} onPress={openAddModal} activeOpacity={0.85}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* ── Add Medication Modal ── */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader} {...swipeDownResponder.panHandlers}>
              <View style={styles.dragHandleArea}>
                <View style={styles.modalHandle} />
                <Text style={styles.swipeHint}>Swipe down to close</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={closeModal}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Close add medication form"
              >
                <Ionicons name="close" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalTitle}>{editingMedication ? 'Edit Medication' : 'Add New Medication'}</Text>

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <Text style={styles.fieldLabel}>Medicine Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Aspirin"
                value={newName}
                onChangeText={setNewName}
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.fieldLabel}>Dosage</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 75mg — 1 tablet"
                value={newDosage}
                onChangeText={setNewDosage}
                placeholderTextColor={Colors.textMuted}
              />

              <Dropdown
                label="Frequency *"
                value={newFrequency}
                options={FREQUENCY_OPTIONS}
                onSelect={(value) => {
                  setNewFrequency(value);
                  setReminderTimes(getReminderDefaultsByFrequency(value));
                }}
                placeholder="Select frequency"
              />

              {(newFrequency === 'Once a day' || !newFrequency || !['Twice a day', 'Three times a day'].includes(newFrequency)) && (
                <AlarmTimePicker
                  label="Reminder Time"
                  value={reminderTimes[0] || '09:00 AM'}
                  onChange={(time) => setReminderTimes([normalizeDisplayTime(time)])}
                />
              )}

              {newFrequency === 'Twice a day' && (
                <>
                  <AlarmTimePicker
                    label="Morning Dose Time"
                    value={reminderTimes[0] || '09:00 AM'}
                    onChange={(time) =>
                      setReminderTimes((prev) => [
                        normalizeDisplayTime(time),
                        normalizeDisplayTime(prev[1] || '06:00 PM'),
                      ])
                    }
                  />
                  <AlarmTimePicker
                    label="Evening Dose Time"
                    value={reminderTimes[1] || '06:00 PM'}
                    onChange={(time) =>
                      setReminderTimes((prev) => [
                        normalizeDisplayTime(prev[0] || '09:00 AM'),
                        normalizeDisplayTime(time),
                      ])
                    }
                  />
                </>
              )}

              {newFrequency === 'Three times a day' && (
                <>
                  <AlarmTimePicker
                    label="Morning Dose Time"
                    value={reminderTimes[0] || '08:00 AM'}
                    onChange={(time) =>
                      setReminderTimes((prev) => [
                        normalizeDisplayTime(time),
                        normalizeDisplayTime(prev[1] || '01:00 PM'),
                        normalizeDisplayTime(prev[2] || '08:00 PM'),
                      ])
                    }
                  />
                  <AlarmTimePicker
                    label="Afternoon Dose Time"
                    value={reminderTimes[1] || '01:00 PM'}
                    onChange={(time) =>
                      setReminderTimes((prev) => [
                        normalizeDisplayTime(prev[0] || '08:00 AM'),
                        normalizeDisplayTime(time),
                        normalizeDisplayTime(prev[2] || '08:00 PM'),
                      ])
                    }
                  />
                  <AlarmTimePicker
                    label="Night Dose Time"
                    value={reminderTimes[2] || '08:00 PM'}
                    onChange={(time) =>
                      setReminderTimes((prev) => [
                        normalizeDisplayTime(prev[0] || '08:00 AM'),
                        normalizeDisplayTime(prev[1] || '01:00 PM'),
                        normalizeDisplayTime(time),
                      ])
                    }
                  />
                </>
              )}

              <Text style={styles.fieldLabel}>Notes / Purpose</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Take after food"
                value={newNotes}
                onChangeText={setNewNotes}
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.fieldLabel}>For How Many Days (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 7"
                value={newDurationDays}
                onChangeText={setNewDurationDays}
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
              />
              <Text style={styles.helperText}>
                Leave empty to keep this medicine until you delete it.
              </Text>

              <Text style={styles.fieldLabel}>Pill Color</Text>
              <View style={styles.colorRow}>
                {PILL_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorDot, { backgroundColor: c }, selectedColor === c && styles.colorDotSelected]}
                    onPress={() => setSelectedColor(c)}
                  >
                    {selectedColor === c && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.addBtn} onPress={handleAddMed} activeOpacity={0.85}>
                <Text style={styles.addBtnText}>{editingMedication ? 'Save Changes' : 'Add Medication'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },

  summaryBar: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLeft: {},
  summaryTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: '#fff',
  },
  summarySubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.primaryMid,
    marginTop: 2,
  },
  summaryCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  summaryPct: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.heavy,
    color: '#fff',
  },

  progressBarBg: {
    height: 6,
    backgroundColor: Colors.primaryDark,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.accent,
  },

  filterScroll: { flexGrow: 0, backgroundColor: Colors.cardBg },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: 6,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.textSecondary,
  },
  filterChipTextActive: { color: '#fff' },

  list: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.base, paddingTop: 8, paddingBottom: Spacing.base },

  sectionHeader: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    marginBottom: 6,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.lg,
    backgroundColor: Colors.cardBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.card,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sectionPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryLight,
  },
  sectionPillText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
  },

  medCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.lg,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    overflow: 'hidden',
    ...Shadows.card,
  },
  medCardTaken: { opacity: 0.75 },
  medCardCompact: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.base,
    ...Shadows.card,
  },
  medLeftCompact: {
    flex: 1,
    borderLeftWidth: 4,
    paddingLeft: 10,
    paddingRight: 8,
  },
  medNameCompact: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
  },
  medMetaCompact: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  doseLabelText: {
    fontSize: FontSizes.xs,
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
    marginTop: 2,
  },
  medRightCompact: { alignItems: 'flex-end', marginLeft: 8 },
  statusBadgeCompact: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderRadius: Radii.full },
  statusTextCompact: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold },
  btnTakenCompact: { backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radii.full, marginTop: 8 },
  btnUndoCompact: { backgroundColor: Colors.successLight, paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radii.full, marginTop: 8 },
  
  iconRowCompact: { flexDirection: 'row', marginTop: 8 },
  iconBtn: { marginLeft: 8, padding: 6 },
  medStrip: { width: 5 },
  medBody: { flex: 1, paddingHorizontal: Spacing.base, paddingVertical: 10 },
  medTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  medLeft: { flex: 1, marginRight: Spacing.md },
  medName: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  textDim: { color: Colors.textSecondary },
  medDose: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  medSchedule: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
    marginBottom: 2,
  },
  medPurpose: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  medRight: { alignItems: 'flex-end' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.full,
    marginBottom: 6,
  },
  statusText: { fontSize: 12, fontWeight: FontWeights.bold },
  medTime: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
  },

  instructionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    backgroundColor: Colors.inputBg,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  instructionsText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },

  medFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakFire: { fontSize: 16 },
  streakText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeights.semibold,
  },
  medActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  statusActionGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  btnTaken: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
  },
  btnTakenText: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
  },
  btnSecondaryAction: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
  },
  btnSecondaryActionText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
  },
  btnUndo: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
  },
  btnUndoText: {
    color: Colors.success,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
  },
  btnDelete: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: FontSizes.lg,
    color: Colors.textMuted,
    fontWeight: FontWeights.medium,
  },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.strong,
    zIndex: 1000,
    elevation: 12,
  },

  historyFab: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.strong,
    zIndex: 1000,
    elevation: 12,
  },

  historyPanel: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.xs,
    marginBottom: 12,
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.lg,
    padding: Spacing.base,
    maxHeight: 250,
    ...Shadows.card,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historyTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
  },
  historySubtitle: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  historyCountPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.inputBg,
  },
  historyCountText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    color: Colors.textSecondary,
  },
  historyChips: {
    gap: 8,
    paddingBottom: 8,
  },
  historyChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radii.full,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  historyChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  historyChipText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeights.semibold,
  },
  historyChipTextActive: { color: '#fff' },
  historyCard: {
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    maxHeight: 150,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  historyRowLeft: { flex: 1, marginRight: Spacing.sm },
  historyMedicine: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
  },
  historyMeta: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  historyStatus: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
    textTransform: 'capitalize',
  },
  historyEmpty: {
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.md,
    paddingBottom: 24,
    maxHeight: '76%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    paddingTop: 0,
    paddingBottom: 4,
  },
  dragHandleArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  modalHandle: {
    width: 32,
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginBottom: 4,
  },
  swipeHint: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  fieldLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.textSecondary,
    marginBottom: 4,
    marginTop: 6,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: 9,
    fontSize: FontSizes.body,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  helperText: {
    marginTop: 3,
    marginBottom: 2,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 2,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotSelected: {
    borderWidth: 2,
    borderColor: Colors.textPrimary,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.lg,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  addBtnText: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
  timePickerModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  timePickerSheet: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  timeColumns: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    height: 144,
    position: 'relative',
  },
  timeSelectionZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 48,
    height: 48,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  timeColumn: {
    width: 72,
    height: 144,
    overflow: 'hidden',
  },
  timeColumnContent: {
    paddingVertical: 48,
  },
  timeItem: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  timeItemSelected: {
    backgroundColor: Colors.primary + '22',
  },
  timeItemText: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  timeItemTextSelected: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 26,
  },
  timeConfirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  timeConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  timeDisplay: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeDisplayText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1,
  },
});