import ScanLogo from '@/components/icons/ScanLogo';
import { Medication } from '@/constants/data';
import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { useMedications } from '@/hooks/useMedications';
import { ParsedMed, parsePrescription } from '@/lib/ai/parsePrescription';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function ScanPrescriptionScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [parsed, setParsed] = useState<ParsedMed[]>([]);
  const { addMedication } = useMedications();

  const params: any = useLocalSearchParams();

  useEffect(() => {
    if (!params?.image) return;
    try {
      setImageUri(decodeURIComponent(params.image as string));
    } catch {
      setImageUri(params.image as string);
    }
  }, [params?.image]);

  useEffect(() => {
    (async () => {
      try {
        const mod = await import('expo-image-picker');
        const { status } = await mod.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'We need permission to access your photos.');
        }
      } catch (err) {
        // expo-image-picker native module not available (web / unsupported runtime)
        console.warn('expo-image-picker not available', err);
      }
    })();
  }, []);

  async function pickImage() {
    try {
      const mod = await (async () => {
        try {
          return await import('expo-image-picker');
        } catch {
          return null;
        }
      })();

      if (!mod) {
        Alert.alert(
          'Image picker unavailable',
          'Image upload requires a native runtime (device / dev client). Paste OCR text manually.'
        );
        return;
      }

      const res = await mod.launchImageLibraryAsync({
        mediaTypes: mod.MediaTypeOptions.Images,
        quality: 0.6,
        base64: false,
      });

      if (!res.canceled) {
        // support different SDK shapes
        // @ts-ignore
        setImageUri((res as any).uri ?? (res as any).assets?.[0]?.uri ?? null);
      }
    } catch (err) {
      console.warn('image pick failed', err);
    }
  }

  function handleParse() {
    const meds = parsePrescription(ocrText);
    setParsed(meds);
    if (meds.length === 0) Alert.alert('No medicines found', 'Try cleaning the text or enter manually.');
  }

  async function handleCreateReminders() {
    if (parsed.length === 0) {
      Alert.alert('Nothing to create', 'Parse prescription first.');
      return;
    }

    const created: Medication[] = [];
    for (const p of parsed) {
      const med: Medication = {
        id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        name: p.name || p.raw,
        dosage: p.dosage ?? p.raw,
        time: '9:00 AM',
        frequency: 'daily',
        color: '#4ECDC4',
        status: 'upcoming',
        purpose: 'From prescription',
        streak: 0,
      };
      await addMedication(med);
      created.push(med);
    }

    Alert.alert('Reminders created', `Created ${created.length} medications.`);
    setParsed([]);
    setOcrText('');
    setImageUri(null);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.titleRow}>
        <ScanLogo size={32} style={{ marginRight: Spacing.md }} />
        <Text style={styles.title}>Scan Prescription</Text>
      </View>

      <View style={styles.card}>
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.8}>
          <Text style={styles.imagePickerText}>{imageUri ? 'Change Image' : 'Pick Image'}</Text>
        </TouchableOpacity>

        {imageUri ? <Image source={{ uri: imageUri }} style={styles.image} /> : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No image selected</Text>
          </View>
        )}

        <Text style={styles.label}>OCR / Prescription Text</Text>
        <TextInput
          multiline
          value={ocrText}
          onChangeText={setOcrText}
          placeholder="Paste OCR text here or type prescription text"
          placeholderTextColor="rgba(0,0,0,0.35)"
          style={styles.textarea}
        />

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleParse} activeOpacity={0.85}>
            <Text style={styles.secondaryText}>Parse</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateReminders} activeOpacity={0.85}>
            <Text style={styles.primaryText}>Create Reminders</Text>
          </TouchableOpacity>
        </View>

        {parsed.length > 0 && (
          <View style={styles.resultList}>
            <Text style={styles.subtitle}>Detected Medicines</Text>
            {parsed.map((m, i) => (
              <View key={`${m.name}-${i}`} style={styles.medRow}>
                <Text style={styles.medName}>{m.name}</Text>
                <Text style={styles.medDosage}>{m.dosage ?? '—'}</Text>
                <Text style={styles.medRaw}>{m.raw}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.base, alignItems: 'center', paddingBottom: 120, backgroundColor: Colors.background },
  title: { fontSize: FontSizes.xxl, fontWeight: FontWeights.heavy, color: Colors.textPrimary, marginBottom: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  card: { width: '100%', backgroundColor: Colors.cardBg, borderRadius: Radii.lg, padding: Spacing.base, ...Shadows.card },
  imagePicker: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: Radii.md, backgroundColor: Colors.primaryLight },
  imagePickerText: { color: Colors.primary, fontWeight: FontWeights.semibold },
  image: { width: '100%', height: 200, marginTop: Spacing.md, borderRadius: Radii.md },
  placeholder: { width: '100%', height: 200, marginTop: Spacing.md, borderRadius: Radii.md, backgroundColor: Colors.inputBg, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: Colors.textSecondary },
  label: { alignSelf: 'flex-start', marginTop: Spacing.md, marginBottom: Spacing.xs, fontWeight: FontWeights.semibold, color: Colors.textSecondary },
  textarea: { width: '100%', minHeight: 120, backgroundColor: Colors.inputBg, borderRadius: Radii.md, padding: Spacing.md, color: Colors.textPrimary },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.md },
  primaryBtn: { backgroundColor: Colors.primary, paddingVertical: 12, paddingHorizontal: 18, borderRadius: Radii.xl, marginLeft: Spacing.sm },
  primaryText: { color: '#fff', fontWeight: FontWeights.bold },
  secondaryBtn: { backgroundColor: 'transparent', paddingVertical: 12, paddingHorizontal: 18, borderRadius: Radii.xl, borderWidth: 1, borderColor: Colors.border },
  secondaryText: { color: Colors.textSecondary, fontWeight: FontWeights.semibold },
  resultList: { marginTop: Spacing.md },
  medRow: { padding: Spacing.sm, borderBottomColor: Colors.divider, borderBottomWidth: 1 },
  medName: { fontWeight: FontWeights.bold, color: Colors.textPrimary },
  medDosage: { color: Colors.textSecondary },
  medRaw: { color: Colors.textMuted, marginTop: 6 },
  subtitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, marginBottom: Spacing.xs },
});
