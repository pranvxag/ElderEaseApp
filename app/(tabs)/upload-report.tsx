import UploadReportLogo from '@/components/icons/UploadReportLogo';
import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { useHealthData } from '@/hooks/useHealthData';
import { parseLabReport } from '@/lib/ai/parseReport';
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

export default function UploadReportScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const { addEntry } = useHealthData();

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
        Alert.alert('Image picker unavailable', 'Image upload requires a native runtime (device / dev client). Paste OCR text manually.');
        return;
      }

      const res = await mod.launchImageLibraryAsync({
        mediaTypes: mod.MediaTypeOptions.Images,
        quality: 0.6,
        base64: false,
      });

      if (!res.canceled) {
        // @ts-ignore
        setImageUri((res as any).uri ?? (res as any).assets?.[0]?.uri ?? null);
      }
    } catch (err) {
      console.warn('image pick failed', err);
    }
  }

  function handleExtract() {
    const values = parseLabReport(ocrText);
    if (values.length === 0) {
      Alert.alert('No lab values found', 'Try adjusting the text or paste OCR output.');
      return;
    }

    let saved = 0;
    for (const v of values) {
      if (v.key === 'blood_sugar') {
        addEntry({ value: v.value, unit: (v.unit as any) || 'mg/dL', source: 'manual', transcript: v.raw });
        saved++;
      }
    }

    Alert.alert('Report parsed', `Saved ${saved} readings.`);
    setOcrText('');
    setImageUri(null);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.titleRow}>
        <UploadReportLogo size={32} style={{ marginRight: Spacing.md }} />
        <Text style={styles.title}>Upload Blood Report</Text>
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

        <Text style={styles.label}>OCR / Report Text</Text>
        <TextInput
          multiline
          value={ocrText}
          onChangeText={setOcrText}
          placeholder="Paste OCR text here or type report text"
          placeholderTextColor="rgba(0,0,0,0.35)"
          style={styles.textarea}
        />

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setOcrText('')} activeOpacity={0.85}>
            <Text style={styles.secondaryText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleExtract} activeOpacity={0.85}>
            <Text style={styles.primaryText}>Extract Values</Text>
          </TouchableOpacity>
        </View>
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
});
