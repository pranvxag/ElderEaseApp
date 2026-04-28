import { useMedications } from '@/hooks/useMedications';
import { useMedicines } from '@/hooks/useMedicines';
import { useUserProfile } from '@/hooks/useUserProfile';
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
import MedicineTimeSlotPicker from '../../components/medicine-time-slot-picker';
import { Medication, MedStatus } from '../../constants/data';
import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '../../constants/theme';
import {
    formatMedicationScheduleSummary,
    FREQUENCY_OPTIONS,
    getDefaultTimeSlots,
    normalizeTimeSlots,
    slotToReminderTime,
} from '../../lib/medicine';
import { Medicine } from '../../types/user';

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
  const scheduleSummary = formatMedicationScheduleSummary(med.frequency, med.times?.length ? med.times : [med.time || '9:00 AM']);
  return (
    <View style={[styles.medCardCompact, med.status === 'taken' && styles.medCardTaken]}>
      <View style={[styles.medLeftCompact, { borderLeftColor: med.color }]}>
        <Text style={[styles.medNameCompact, med.status === 'taken' && styles.textDim]} numberOfLines={1}>
          {med.name}
        </Text>
        <Text style={styles.medMetaCompact}>{med.dosage} • {scheduleSummary}</Text>
      </View>

      <View style={styles.medRightCompact}>
        <View style={[styles.statusBadgeCompact, { backgroundColor: cfg.bg }]}> 
          <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
          <Text style={[styles.statusTextCompact, { color: cfg.color }]}>{cfg.label}</Text>
        </View>

        {med.status !== 'taken' ? (
          <TouchableOpacity style={styles.btnTakenCompact} onPress={() => onMarkTaken(med.id)} activeOpacity={0.85}>
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
    markTaken,
    markNotTaken,
    snoozeMedication,
    undoTaken,
    canUndoTaken,
    deleteMed,
    recentMedicineLogs,
    loading,
  } = useMedications();
  const {
    addMedicine: addProfileMedicine,
    removeMedicine: removeProfileMedicine,
    updateMedicine: updateProfileMedicine,
    loading: profileMedicinesLoading,
  } = useMedicines();
  const { profile, saveProfile, loading: profileLoading } = useUserProfile();
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<MedStatus | 'all'>('all');
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [selectedLogDate, setSelectedLogDate] = useState('');
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

  const takenCount = meds.filter((m) => m.status === 'taken').length;
  const totalCount = meds.length;
  const adherence = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  const filtered = filter === 'all' ? meds : meds.filter((m) => m.status === filter);

  React.useEffect(() => {
    if (recentMedicineLogs.length === 0) return;
    const hasSelected = recentMedicineLogs.some((day) => day.date === selectedLogDate);
    if (!selectedLogDate || !hasSelected) {
      setSelectedLogDate(recentMedicineLogs[recentMedicineLogs.length - 1].date);
    }
  }, [recentMedicineLogs, selectedLogDate]);

  if (loading || profileLoading || profileMedicinesLoading) return null;

  function openAddModal() {
    setEditingMedication(null);
    setNewName('');
    setNewDosage('');
    setNewFrequency('');
    setNewTimeSlots(getDefaultTimeSlots('Once a day'));
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
    setNewTimeSlots(normalizeTimeSlots(med.times?.length ? med.times : [med.time], med.frequency));
    setNewNotes(med.instructions || med.purpose || '');
    setNewDurationDays(med.durationDays ? String(med.durationDays) : '');
    setSelectedColor(med.color);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingMedication(null);
  }

  function handleMarkTaken(id: string) {
    markTaken(id);
  }

  function handleMarkNotTaken(id: string) {
    markNotTaken(id);
  }

  function handleSnooze(id: string) {
    snoozeMedication(id);
  }

  function handleUndo(id: string) {
    undoTaken(id);
  }

  async function handleDelete(id: string) {
    try {
      const nextProfileMedicines = (profile?.medicines ?? []).filter((medicine) => medicine.id !== id);
      await deleteMed(id);
      await removeProfileMedicine(id);
      await saveProfile({ medicines: nextProfileMedicines });
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
    if (!newName.trim() || !newDosage.trim() || !newFrequency.trim() || newTimeSlots.length === 0) {
      Alert.alert('Missing Info', 'Please fill medicine name, dosage, frequency, and time slots.');
      return;
    }

    const name = newName.trim();
    const dosage = newDosage.trim();
    const frequencyLabel = newFrequency.trim();
    const notes = newNotes.trim();
    const durationDays = parseDurationDays(newDurationDays);
    const selectedTimes = normalizeTimeSlots(newTimeSlots, frequencyLabel);
    const reminderTime = toReminderTime(selectedTimes[0]);
    const createdAt = new Date().toISOString();
    const expiresAt = durationDays
      ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const medicineId = editingMedication?.id ?? Date.now().toString();
    const baseMedicine: Medicine = {
      id: medicineId,
      name,
      dosage,
      frequency: frequencyLabel,
      time: selectedTimes[0],
      times: selectedTimes,
      notes: notes || undefined,
      createdAt,
      durationDays,
      expiresAt,
    };

    const newMed: Medication = {
      id: medicineId,
      name,
      dosage,
      time: reminderTime,
      times: selectedTimes,
      frequency: toTrackerFrequency(frequencyLabel),
      color: selectedColor,
      status: editingMedication?.status ?? 'upcoming',
      purpose: notes || editingMedication?.purpose || 'As prescribed',
      streak: editingMedication?.streak ?? 0,
      instructions: notes || undefined,
      createdAt,
      durationDays,
      expiresAt,
    };

    try {
      const existingMedicines = profile?.medicines ?? [];
      const nextProfileMedicines = editingMedication
        ? existingMedicines.map((medicine) => (medicine.id === medicineId ? baseMedicine : medicine))
        : [...existingMedicines, baseMedicine];

      await saveProfile({ medicines: nextProfileMedicines });

      if (editingMedication) {
        await updateProfileMedicine({
          id: medicineId,
          name,
          dosage,
          times: selectedTimes,
          enabled: true,
          frequency: frequencyLabel,
          time: reminderTime,
          notes: notes || undefined,
          createdAt,
          durationDays,
          expiresAt,
        });
        await updateMedication(newMed);
      } else {
        await addProfileMedicine({
          id: medicineId,
          name,
          dosage,
          times: selectedTimes,
          enabled: true,
          frequency: frequencyLabel,
          time: reminderTime,
          notes: notes || undefined,
          createdAt,
          durationDays,
          expiresAt,
        });
        await addMedication(newMed);
      }

      setNewName('');
      setNewDosage('');
      setNewFrequency('');
      setNewTimeSlots(getDefaultTimeSlots('Once a day'));
      setNewNotes('');
      setNewDurationDays('');
      setSelectedColor(PILL_COLORS[0]);
      closeModal();
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
        {filtered.map((med) => (
          <MedCard
            key={med.id}
            med={med}
            onEdit={openEditModal}
            onMarkTaken={handleMarkTaken}
            onMarkNotTaken={handleMarkNotTaken}
            onSnooze={handleSnooze}
            onDelete={handleDelete}
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
                  style={[styles.historyChip, selectedLogDate === day.date && styles.historyChipActive]}
                  onPress={() => setSelectedLogDate(day.date)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.historyChipText, selectedLogDate === day.date && styles.historyChipTextActive]}>
                    {day.date.slice(5).replace('-', '/')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ marginTop: 8 }}>
              {recentMedicineLogs
                .filter((day) => day.date === selectedLogDate)
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
                onSelect={setNewFrequency}
                placeholder="Select frequency"
              />

              <MedicineTimeSlotPicker
                frequency={newFrequency}
                selectedTimes={newTimeSlots}
                onChange={setNewTimeSlots}
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
  medRightCompact: { alignItems: 'flex-end', marginLeft: 8 },
  statusBadgeCompact: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderRadius: Radii.full },
  statusTextCompact: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold },
  btnTakenCompact: { backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radii.full, marginTop: 8 },
  btnUndoCompact: { backgroundColor: Colors.successLight, paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radii.full, marginTop: 8 },
  btnTakenText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: FontWeights.bold },
  btnUndoText: { color: Colors.success, fontSize: FontSizes.xs, fontWeight: FontWeights.bold },
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
});