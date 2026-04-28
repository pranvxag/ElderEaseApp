import { useMedications } from '@/hooks/useMedications';
import { useMedicines } from '@/hooks/useMedicines';
import { useUserProfile } from '@/hooks/useUserProfile';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import {
    Alert,
    Modal,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Medication, MedStatus } from '../../constants/data';
import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '../../constants/theme';
import { Medicine } from '../../types/user';
// import { Colors, FontSizes, FontWeights, Spacing, Radii, Shadows } from '@/constants/theme';
// import { MOCK_MEDICATIONS, Medication, MedStatus } from '@/constants/data';

const STATUS_CONFIG: Record<MedStatus, { label: string; color: string; bg: string; icon: string }> = {
  taken: { label: 'Taken ✓', color: Colors.success, bg: Colors.successLight, icon: 'checkmark-circle' },
  upcoming: { label: 'Upcoming', color: Colors.warning, bg: Colors.warningLight, icon: 'time-outline' },
  missed: { label: 'Missed', color: Colors.missed, bg: Colors.missedLight, icon: 'close-circle' },
  skipped: { label: 'Skipped', color: Colors.textMuted, bg: Colors.inputBg, icon: 'remove-circle-outline' },
};

const PILL_COLORS = ['#FF6B6B', '#4ECDC4', '#A78BFA', '#FCD34D', '#60A5FA', '#34D399', '#FB923C'];

const FREQUENCY_OPTIONS = ['Once a day', 'Twice a day', 'Three times a day', 'Weekly', 'As needed'];

const TIME_OPTIONS = [
  'Morning (6–9 AM)',
  'Mid-morning (9–12 PM)',
  'Afternoon (12–3 PM)',
  'Evening (3–6 PM)',
  'Night (6–9 PM)',
  'Bedtime (9 PM+)',
];

const TIME_TO_REMINDER: Record<string, string> = {
  'Morning (6–9 AM)': '8:00 AM',
  'Mid-morning (9–12 PM)': '10:00 AM',
  'Afternoon (12–3 PM)': '1:00 PM',
  'Evening (3–6 PM)': '5:00 PM',
  'Night (6–9 PM)': '8:00 PM',
  'Bedtime (9 PM+)': '9:00 PM',
};

const FREQUENCY_TO_TRACKER: Record<string, Medication['frequency']> = {
  'Once a day': 'daily',
  'Twice a day': 'twice-daily',
  'Three times a day': 'daily',
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
  onMarkTaken,
  onDelete,
}: {
  med: Medication;
  onMarkTaken: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[med.status];
  return (
    <View style={[styles.medCard, med.status === 'taken' && styles.medCardTaken]}>
      {/* Color strip */}
      <View style={[styles.medStrip, { backgroundColor: med.color }]} />

      <View style={styles.medBody}>
        <View style={styles.medTop}>
          <View style={styles.medLeft}>
            <Text style={[styles.medName, med.status === 'taken' && styles.textDim]}>{med.name}</Text>
            <Text style={styles.medDose}>{med.dosage}</Text>
            <Text style={styles.medPurpose}>🎯 {med.purpose}</Text>
          </View>
          <View style={styles.medRight}>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
              <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <Text style={styles.medTime}>{med.time}</Text>
          </View>
        </View>

        {med.instructions && (
          <View style={styles.instructionsRow}>
            <Ionicons name="information-circle-outline" size={15} color={Colors.textMuted} />
            <Text style={styles.instructionsText}>{med.instructions}</Text>
          </View>
        )}

        <View style={styles.medFooter}>
          <View style={styles.streakRow}>
            <Text style={styles.streakFire}>🔥</Text>
            <Text style={styles.streakText}>{med.streak} day streak</Text>
          </View>

          <View style={styles.medActions}>
            {med.status !== 'taken' && (
              <TouchableOpacity
                style={styles.btnTaken}
                onPress={() => onMarkTaken(med.id)}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.btnTakenText}>Mark Taken</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.btnDelete}
              onPress={() =>
                Alert.alert('Remove Medication', `Remove ${med.name} from your list?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => onDelete(med.id) },
                ])
              }
            >
              <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function MedicationsScreen() {
  const { meds, addMedication, markTaken, deleteMed, loading } = useMedications();
  const {
    addMedicine: addProfileMedicine,
    removeMedicine: removeProfileMedicine,
    loading: profileMedicinesLoading,
  } = useMedicines();
  const { profile, saveProfile, loading: profileLoading } = useUserProfile();
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<MedStatus | 'all'>('all');

  // Add med form state
  const [newName, setNewName] = useState('');
  const [newDosage, setNewDosage] = useState('');
  const [newFrequency, setNewFrequency] = useState('');
  const [newTimeLabel, setNewTimeLabel] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newDurationDays, setNewDurationDays] = useState('');
  const [selectedColor, setSelectedColor] = useState(PILL_COLORS[0]);

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

  if (loading || profileLoading || profileMedicinesLoading) return null;

  const takenCount = meds.filter((m) => m.status === 'taken').length;
  const totalCount = meds.length;
  const adherence = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  const filtered = filter === 'all' ? meds : meds.filter((m) => m.status === filter);

  function handleMarkTaken(id: string) {
    markTaken(id);
  }

  async function handleDelete(id: string) {
    try {
      const nextProfileMedicines = (profile?.medicines ?? []).filter((medicine) => medicine.id !== id);
      await Promise.all([
        deleteMed(id),
        removeProfileMedicine(id),
        saveProfile({ medicines: nextProfileMedicines }),
      ]);
    } catch (error) {
      console.error('Delete medicine failed:', error);
      Alert.alert('Delete failed', 'Could not remove medicine right now. Please try again.');
    }
  }

  function toReminderTime(label: string): string {
    return TIME_TO_REMINDER[label] || '9:00 AM';
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
    if (!newName.trim() || !newDosage.trim() || !newFrequency.trim() || !newTimeLabel.trim()) {
      Alert.alert('Missing Info', 'Please fill medicine name, dosage, frequency, and time.');
      return;
    }

    const name = newName.trim();
    const dosage = newDosage.trim();
    const frequencyLabel = newFrequency.trim();
    const timeLabel = newTimeLabel.trim();
    const notes = newNotes.trim();
    const durationDays = parseDurationDays(newDurationDays);
    const reminderTime = toReminderTime(timeLabel);
    const createdAt = new Date().toISOString();
    const expiresAt = durationDays
      ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const profileMedicine: Medicine = {
      id: Date.now().toString(),
      name,
      dosage,
      frequency: frequencyLabel,
      time: timeLabel,
      notes: notes || undefined,
      createdAt,
      durationDays,
      expiresAt,
    };

    const newMed: Medication = {
      id: profileMedicine.id,
      name,
      dosage,
      time: reminderTime,
      frequency: toTrackerFrequency(frequencyLabel),
      color: selectedColor,
      status: 'upcoming',
      purpose: notes || 'As prescribed',
      streak: 0,
      instructions: notes || undefined,
      createdAt,
      durationDays,
      expiresAt,
    };

    try {
      const nextProfileMedicines = [...(profile?.medicines ?? []), profileMedicine];
      await Promise.all([
        saveProfile({ medicines: nextProfileMedicines }),
        addProfileMedicine({
          id: profileMedicine.id,
          name,
          dosage,
          times: [reminderTime],
          enabled: true,
          frequency: frequencyLabel,
          time: reminderTime,
          notes: notes || undefined,
          createdAt,
          durationDays,
          expiresAt,
        }),
      ]);
      await addMedication(newMed);

      setNewName('');
      setNewDosage('');
      setNewFrequency('');
      setNewTimeLabel('');
      setNewNotes('');
      setNewDurationDays('');
      setSelectedColor(PILL_COLORS[0]);
      setShowModal(false);
    } catch (error) {
      console.error('Add medicine failed:', error);
      Alert.alert('Save failed', 'Could not add medicine right now. Please try again.');
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
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all'
                ? `All (${meds.length})`
                : `${f.charAt(0).toUpperCase() + f.slice(1)} (${meds.filter((m) => m.status === f).length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Med List ── */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>💊</Text>
            <Text style={styles.emptyText}>No {filter !== 'all' ? filter : ''} medications</Text>
          </View>
        )}
        {filtered.map((med) => (
          <MedCard key={med.id} med={med} onMarkTaken={handleMarkTaken} onDelete={handleDelete} />
        ))}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Add FAB ── */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* ── Add Medication Modal ── */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader} {...swipeDownResponder.panHandlers}>
              <View style={styles.dragHandleArea}>
                <View style={styles.modalHandle} />
                <Text style={styles.swipeHint}>Swipe down to close</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowModal(false)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Close add medication form"
              >
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalTitle}>Add New Medication 💊</Text>

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
              onSelect={setNewFrequency}
              placeholder="Select frequency"
            />

            <Dropdown
              label="Time *"
              value={newTimeLabel}
              options={TIME_OPTIONS}
              onSelect={setNewTimeLabel}
              placeholder="Select time"
            />

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
                  {selectedColor === c && <Ionicons name="checkmark" size={14} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.addBtn} onPress={handleAddMed} activeOpacity={0.85}>
              <Text style={styles.addBtnText}>Add Medication</Text>
            </TouchableOpacity>
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  summaryPct: {
    fontSize: FontSizes.md,
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
    paddingVertical: Spacing.sm,
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
  listContent: { padding: Spacing.base },

  medCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.lg,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    overflow: 'hidden',
    ...Shadows.card,
  },
  medCardTaken: { opacity: 0.75 },
  medStrip: { width: 5 },
  medBody: { flex: 1, padding: Spacing.base },
  medTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  medLeft: { flex: 1, marginRight: Spacing.md },
  medName: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  textDim: { color: Colors.textSecondary },
  medDose: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  medPurpose: {
    fontSize: FontSizes.xs,
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
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
    paddingTop: 2,
    paddingBottom: 6,
  },
  dragHandleArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginBottom: 6,
  },
  swipeHint: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.heavy,
    color: Colors.textPrimary,
    marginBottom: Spacing.base,
  },
  fieldLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: 14,
    fontSize: FontSizes.body,
    color: Colors.textPrimary,
  },
  helperText: {
    marginTop: 6,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: Colors.textPrimary,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  addBtnText: {
    color: '#fff',
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
  },
});