import AICallLogo from '@/components/icons/AICallLogo';
import { Colors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { useHealthData } from '@/hooks/useHealthData';
import { extractSugarFromText } from '@/lib/ai/parse';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function AICallScreen() {
  const { addEntry } = useHealthData();
  const [inCall, setInCall] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedValue, setParsedValue] = useState<number | null>(null);

  const [SpeechModule, setSpeechModule] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import('expo-speech');
        if (mounted) setSpeechModule(mod);
      } catch (e) {
        console.warn('expo-speech not available:', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  function startCall() {
    setInCall(true);
    // Simple Hindi prompt — try expo-speech if available, otherwise skip
    try {
      SpeechModule?.speak('नमस्ते। क्या आप बता सकते हैं कि आज आपकी शुगर कितनी है?', { language: 'hi-IN' });
    } catch (e) {
      console.warn('TTS failed or not available', e);
    }
  }

  function handleParse() {
    const res = extractSugarFromText(transcript);
    setParsedValue(res.value);
    if (!res.value) {
      Alert.alert('No value detected', 'Could not automatically detect a numeric sugar value. Please enter it manually.');
    }
  }

  function handleSave() {
    if (!parsedValue) {
      Alert.alert('Missing value', 'Please enter a numeric sugar value before saving.');
      return;
    }
    addEntry({ value: parsedValue, unit: 'mg/dL', source: 'ai-call', transcript });
    Alert.alert('Saved', 'Blood-sugar reading saved.');
    router.replace('/(tabs)/emergency');
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.titleRow}>
        <AICallLogo size={36} style={{ marginRight: Spacing.md }} />
        <Text style={styles.title}>AI Health Call (Demo)</Text>
      </View>

      {!inCall ? (
        <TouchableOpacity style={styles.callBtn} onPress={startCall} activeOpacity={0.85}>
          <Text style={styles.callBtnText}>Start AI Call</Text>
        </TouchableOpacity>
      ) : (
        <>
          <Text style={styles.label}>Transcript (editable)</Text>
          <TextInput
            style={styles.input}
            value={transcript}
            onChangeText={setTranscript}
            placeholder="Type or paste what the user said (e.g. 'मेरी शुगर 140 है')"
            placeholderTextColor="rgba(0,0,0,0.35)"
            multiline
          />

          <TouchableOpacity style={styles.actionBtn} onPress={handleParse} activeOpacity={0.85}>
            <Text style={styles.actionText}>Parse Value</Text>
          </TouchableOpacity>

          <View style={styles.parsedRow}>
            <Text style={styles.parsedLabel}>Detected value:</Text>
            <Text style={styles.parsedValue}>{parsedValue ?? '—'}</Text>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>Save Reading</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.base, paddingTop: Spacing.xl, backgroundColor: Colors.background, minHeight: '100%' },
  title: { fontSize: FontSizes.xxl, fontWeight: FontWeights.heavy, color: Colors.textPrimary, marginBottom: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  callBtn: { backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: Radii.xl, alignItems: 'center' },
  callBtnText: { color: '#fff', fontSize: FontSizes.md, fontWeight: FontWeights.bold },
  label: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: Spacing.lg, marginBottom: Spacing.xs },
  input: { backgroundColor: Colors.cardBg, borderRadius: Radii.lg, padding: Spacing.md, minHeight: 120, color: Colors.textPrimary },
  actionBtn: { backgroundColor: Colors.primaryLight, padding: Spacing.md, borderRadius: Radii.lg, alignItems: 'center', marginTop: Spacing.md },
  actionText: { color: Colors.primary, fontWeight: FontWeights.bold },
  parsedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md },
  parsedLabel: { color: Colors.textSecondary },
  parsedValue: { fontWeight: FontWeights.heavy, color: Colors.textPrimary },
  saveBtn: { backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: Radii.xl, alignItems: 'center', marginTop: Spacing.lg },
  saveBtnText: { color: '#fff', fontWeight: FontWeights.bold },
});
