import ScanLogo from '@/components/icons/ScanLogo';
import UploadReportLogo from '@/components/icons/UploadReportLogo';
import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ScanPickerScreen() {
  const [type, setType] = useState<'report' | 'prescription'>('report');
  const autoOpenedRef = useRef(false);
  const initialTypeRef = useRef(type);

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
});
