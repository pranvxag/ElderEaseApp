import ScanLogo from '@/components/icons/ScanLogo';
import UploadReportLogo from '@/components/icons/UploadReportLogo';
import { DailySugarLog } from '@/constants/data';
import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useHealthData } from '@/hooks/useHealthData';
import { useProfile } from '@/hooks/useProfile';
import { db, hasFirebaseConfig } from '@/lib/firebase';
import { getRecentMedicineLogDates, getRecentMedicineLogs, MedicineLogDay } from '@/lib/medicine-logs';
import { router } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type SugarLogDay = DailySugarLog;

function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part));
  if (!year || !month || !day) return dateKey;
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

function getDateRangeLabel(dateKeys: string[]): string {
  if (dateKeys.length === 0) return '';
  const start = dateKeys[0];
  const end = dateKeys[dateKeys.length - 1];
  return `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
}

async function getRecentSugarLogs(uid: string, days = 7): Promise<SugarLogDay[]> {
  if (!hasFirebaseConfig || !uid) return [];
  const dateKeys = getRecentMedicineLogDates(days);
  const logs = await Promise.all(
    dateKeys.map(async (dateKey) => {
      const ref = doc(db, 'users', uid, 'sugarlogs', dateKey);
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) {
        return { date: dateKey } as SugarLogDay;
      }
      const data = snapshot.data() as SugarLogDay;
      return {
        date: dateKey,
        fasting: data?.fasting,
        postFood: data?.postFood,
        level: data?.level,
        source: data?.source,
        timestamp: data?.timestamp,
      } as SugarLogDay;
    })
  );

  return logs;
}

export default function ScanPickerScreen() {
  const [type, setType] = useState<'report' | 'prescription'>('report');
  const autoOpenedRef = useRef(false);
  const initialTypeRef = useRef(type);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [medicineLogs, setMedicineLogs] = useState<MedicineLogDay[]>([]);
  const [sugarLogs, setSugarLogs] = useState<SugarLogDay[]>([]);
  const { user } = useAuth();
  const [profile] = useProfile();
  const uid = user?.uid ?? '';

  const { dailyLog, logsLoading, saveDailyReading } = useHealthData();
  const [fastingInput, setFastingInput] = useState('');
  const [postFoodInput, setPostFoodInput] = useState('');

  const dateKeys = useMemo(() => getRecentMedicineLogDates(7), []);
  const dateRangeLabel = useMemo(() => getDateRangeLabel(dateKeys), [dateKeys]);
  const generatedLabel = useMemo(
    () => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    []
  );

  const medicineSummary = useMemo(() => {
    let totalTaken = 0;
    let totalMissed = 0;
    const perDay = medicineLogs.map((day) => {
      const taken = day.entries.filter((entry) => entry.status === 'taken').length;
      const missed = day.entries.filter((entry) => entry.status === 'not_taken').length;
      totalTaken += taken;
      totalMissed += missed;
      return { date: day.date, taken, missed };
    });

    const total = totalTaken + totalMissed;
    const adherence = total > 0 ? Math.round((totalTaken / total) * 100) : 0;
    return { perDay, adherence };
  }, [medicineLogs]);

  async function loadWeeklyReport() {
    if (!uid) {
      setMedicineLogs([]);
      setSugarLogs([]);
      return;
    }

    setReportLoading(true);
    try {
      const [meds, sugars] = await Promise.all([
        getRecentMedicineLogs(uid, 7),
        getRecentSugarLogs(uid, 7),
      ]);
      setMedicineLogs(meds);
      setSugarLogs(sugars);
    } catch (error) {
      console.warn('Weekly report fetch failed:', error);
      setMedicineLogs([]);
      setSugarLogs([]);
    } finally {
      setReportLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      if (autoOpenedRef.current) return;
      autoOpenedRef.current = true;

      // Only auto-launch camera on native runtimes
      if (Platform.OS === 'web') return;

      try {
        const mod = await (async () => {
          try {
            return await import('expo-image-picker');
          } catch {
            return null;
          }
        })();

        if (!mod) return;

        // Request camera permission if available
        try {
          const permReq = await (mod.requestCameraPermissionsAsync?.() ?? mod.requestMediaLibraryPermissionsAsync?.());
          const status = permReq?.status ?? 'granted';
          if (status !== 'granted') return;
        } catch {
          // ignore permission check errors
        }

        const res = await mod.launchCameraAsync({
          mediaTypes: mod.MediaTypeOptions.Images,
          quality: 0.6,
          base64: false,
        });

        if (!res || (res as any).canceled) return;
        const uri = (res as any).uri ?? (res as any).assets?.[0]?.uri ?? null;
        if (!uri) return;

        if (initialTypeRef.current === 'report') {
          router.push(`/(tabs)/upload-report?image=${encodeURIComponent(uri)}`);
        } else {
          router.push(`/(tabs)/scan-prescription?image=${encodeURIComponent(uri)}`);
        }
      } catch (_err) {
        console.warn('Auto camera launch failed', _err);
      }
    })();
    // intentionally run only once on mount
  }, []);

  function handleAction(action: 'upload' | 'scan') {
    if (type === 'report') {
      if (action === 'upload') router.push('/(tabs)/upload-report');
      else router.push('/(tabs)/upload-report?mode=scan');
    } else {
      if (action === 'upload') router.push('/(tabs)/scan-prescription');
      else router.push('/(tabs)/scan-prescription?mode=scan');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        {type === 'report' ? (
          <UploadReportLogo size={40} style={{ marginRight: Spacing.md }} />
        ) : (
          <ScanLogo size={40} style={{ marginRight: Spacing.md }} />
        )}
        <Text style={styles.title}>Scan</Text>
      </View>

      {/* ── Daily Sugar Report (moved from Emergency tab) ── */}
      {!logsLoading && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Daily Sugar Report</Text>
          <Text style={styles.rangeText}>
            Fasting normal: 70-100 mg/dL • Post Food normal: under 140 mg/dL
          </Text>

          <View style={styles.sugarRow}>
            <Text style={styles.sugarLabel}>Fasting (morning)</Text>
            <View style={styles.sugarInputRow}>
              <TextInput
                value={fastingInput}
                onChangeText={setFastingInput}
                placeholder="e.g. 92"
                keyboardType="numeric"
                placeholderTextColor="rgba(0,0,0,0.35)"
                style={styles.sugarInput}
              />
              <TouchableOpacity
                style={styles.sugarSaveBtn}
                onPress={async () => {
                  const input = fastingInput;
                  const value = Number(input);
                  if (!input.trim() || Number.isNaN(value) || value <= 0) {
                    Alert.alert('Invalid reading', 'Enter a valid sugar level in mg/dL.');
                    return;
                  }

                  try {
                    await saveDailyReading({ type: 'fasting', level: value });
                    setFastingInput('');
                  } catch (err) {
                    console.warn('Saving sugar reading failed:', err);
                    Alert.alert('Save failed', 'Unable to save the reading. Please try again.');
                  }
                }}
              >
                <Text style={styles.sugarSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
            {dailyLog?.fasting ? (
              <Text style={[styles.sugarValue, (dailyLog.fasting.level < 70 || dailyLog.fasting.level > 100) && styles.sugarValueAlert]}>
                {dailyLog.fasting.level} mg/dL • {dailyLog.fasting.time}
              </Text>
            ) : (
              <Text style={styles.sugarValueMuted}>Not logged yet</Text>
            )}
          </View>

          <View style={styles.sugarRow}>
            <Text style={styles.sugarLabel}>Post Food (after meal)</Text>
            <View style={styles.sugarInputRow}>
              <TextInput
                value={postFoodInput}
                onChangeText={setPostFoodInput}
                placeholder="e.g. 135"
                keyboardType="numeric"
                placeholderTextColor="rgba(0,0,0,0.35)"
                style={styles.sugarInput}
              />
              <TouchableOpacity
                style={styles.sugarSaveBtn}
                onPress={async () => {
                  const input = postFoodInput;
                  const value = Number(input);
                  if (!input.trim() || Number.isNaN(value) || value <= 0) {
                    Alert.alert('Invalid reading', 'Enter a valid sugar level in mg/dL.');
                    return;
                  }

                  try {
                    await saveDailyReading({ type: 'postFood', level: value });
                    setPostFoodInput('');
                  } catch (err) {
                    console.warn('Saving sugar reading failed:', err);
                    Alert.alert('Save failed', 'Unable to save the reading. Please try again.');
                  }
                }}
              >
                <Text style={styles.sugarSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
            {dailyLog?.postFood ? (
              <Text style={[styles.sugarValue, dailyLog.postFood.level >= 140 && styles.sugarValueAlert]}>
                {dailyLog.postFood.level} mg/dL • {dailyLog.postFood.time}
              </Text>
            ) : (
              <Text style={styles.sugarValueMuted}>Not logged yet</Text>
            )}
          </View>
        </View>
      )}

      <Text style={styles.subtitle}>Choose type</Text>
      <View style={styles.segment}>
        <TouchableOpacity
          style={[styles.segmentBtn, type === 'report' && styles.segmentBtnActive]}
          onPress={() => setType('report')}
          activeOpacity={0.85}
        >
          <Text style={[styles.segmentText, type === 'report' && styles.segmentTextActive]}>Report</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, type === 'prescription' && styles.segmentBtnActive]}
          onPress={() => setType('prescription')}
          activeOpacity={0.85}
        >
          <Text style={[styles.segmentText, type === 'prescription' && styles.segmentTextActive]}>Prescription</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionCard} onPress={() => handleAction('upload')} activeOpacity={0.9}>
          <UploadReportLogo size={36} />
          <Text style={styles.actionTitle}>Upload</Text>
          <Text style={styles.actionSub}>Choose an image or PDF from device</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={() => handleAction('scan')} activeOpacity={0.9}>
          <ScanLogo size={36} />
          <Text style={styles.actionTitle}>Scan</Text>
          <Text style={styles.actionSub}>Use camera / OCR to scan now</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.reportButton}
        onPress={async () => {
          setReportVisible(true);
          await loadWeeklyReport();
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.reportButtonText}>View Weekly Report</Text>
      </TouchableOpacity>

      <Modal visible={reportVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Weekly Report</Text>
              <TouchableOpacity onPress={() => setReportVisible(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalMeta}>Elder: {profile?.name || user?.displayName || 'User'}</Text>
            <Text style={styles.modalMeta}>Date range: {dateRangeLabel}</Text>
            <Text style={styles.modalMeta}>Generated: {generatedLabel}</Text>

            {reportLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Loading report...</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Medicines</Text>
                  <Text style={styles.sectionSubtitle}>{medicineSummary.adherence}% adherence this week</Text>
                  {medicineSummary.perDay.map((day) => (
                    <View key={day.date} style={styles.rowItem}>
                      <Text style={styles.rowLabel}>{formatDateLabel(day.date)}</Text>
                      <Text style={styles.rowValue}>Taken: {day.taken}</Text>
                      <Text style={styles.rowValue}>Missed: {day.missed}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Sugar</Text>
                  {sugarLogs.map((day) => (
                    <View key={day.date} style={styles.rowItem}>
                      <Text style={styles.rowLabel}>{formatDateLabel(day.date)}</Text>
                      {day.source === 'call' ? (
                        <Text style={styles.rowValue}>
                          Call: {day.level ? `${day.level} mg/dL` : '—'}
                        </Text>
                      ) : (
                        <>
                          <Text style={styles.rowValue}>
                            Morning: {day.fasting?.level ? `${day.fasting.level} mg/dL` : '—'}
                          </Text>
                          <Text style={styles.rowValue}>
                            Evening: {day.postFood?.level ? `${day.postFood.level} mg/dL` : '—'}
                          </Text>
                        </>
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <View style={{ height: 64 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.base, alignItems: 'center', paddingBottom: 120, backgroundColor: Colors.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  title: { fontSize: FontSizes.xxl, fontWeight: FontWeights.heavy, color: Colors.textPrimary },
  subtitle: { alignSelf: 'flex-start', marginTop: Spacing.md, marginBottom: Spacing.xs, color: Colors.textSecondary },
  segment: { flexDirection: 'row', width: '100%', marginTop: Spacing.sm },
  segmentBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.cardBg, alignItems: 'center', marginRight: Spacing.sm },
  segmentBtnActive: { backgroundColor: Colors.primaryLight },
  segmentText: { color: Colors.textSecondary },
  segmentTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  actions: { width: '100%', marginTop: Spacing.md },
  actionCard: { backgroundColor: Colors.cardBg, padding: Spacing.md, borderRadius: Radii.lg, alignItems: 'center', marginBottom: Spacing.md, ...Shadows.card },
  actionTitle: { marginTop: Spacing.sm, fontSize: FontSizes.md, fontWeight: FontWeights.bold, color: Colors.textPrimary },
  actionSub: { marginTop: Spacing.xs, color: Colors.textSecondary },
  reportButton: {
    marginTop: Spacing.sm,
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.card,
  },
  reportButtonText: { color: '#fff', fontSize: FontSizes.md, fontWeight: FontWeights.bold },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    padding: Spacing.base,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.textPrimary },
  modalClose: { color: Colors.primary, fontWeight: FontWeights.semibold },
  modalMeta: { color: Colors.textSecondary, fontSize: FontSizes.sm, marginBottom: 4 },
  modalBody: { marginTop: Spacing.sm },
  loadingWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  loadingText: { color: Colors.textSecondary, fontSize: FontSizes.sm },
  sectionCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.lg,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.bold, color: Colors.textPrimary },
  sectionSubtitle: { color: Colors.textSecondary, fontSize: FontSizes.sm, marginTop: 4, marginBottom: Spacing.sm },
  rowItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowLabel: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, color: Colors.textPrimary },
  rowValue: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 2 },
  rangeText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  sugarRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  sugarLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeights.semibold,
    marginBottom: Spacing.xs,
  },
  sugarInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  sugarInput: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
  },
  sugarSaveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.md,
  },
  sugarSaveText: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
  },
  sugarValue: {
    marginTop: Spacing.xs,
    color: Colors.textPrimary,
    fontSize: FontSizes.sm,
  },
  sugarValueMuted: {
    marginTop: Spacing.xs,
    color: Colors.textMuted,
    fontSize: FontSizes.sm,
  },
  sugarValueAlert: {
    color: Colors.emergency,
    fontWeight: FontWeights.bold,
  },
});
