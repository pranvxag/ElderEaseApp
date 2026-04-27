import AICallLogo from '@/components/icons/AICallLogo';
import { useAuth } from '@/hooks/useAuth';
import { useHealthData } from '@/hooks/useHealthData';
import { useMedications } from '@/hooks/useMedications';
import { useUserProfile } from '@/hooks/useUserProfile';
import { getApiProxyBaseUrl } from '@/lib/apiProxy';
import { LANGUAGE_CODES, PreferredLanguage } from '@/types/user';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');

// Use a server-side proxy to avoid embedding API keys in the client build.
const PROXY_BASE = getApiProxyBaseUrl();
const FIREBASE_PROJECT = 'elderease-pranvxag';

// ─── Design palette ───────────────────────────────────────────────────────────
const P = {
  bg:         '#040C18',
  surface:    '#0A1524',
  card:       '#0F1D32',
  border:     '#172844',
  primary:    '#4A8FF6',
  accent:     '#00D48F',
  danger:     '#FF3B50',
  textPri:    '#EDF1FF',
  textSec:    '#4E6280',
  agentBg:    '#0C1B30',
  userBg:     '#112D64',
  chipBg:     '#0C1B30',
  chipBorder: '#1A3058',
  mic:        '#7C3AED',
  micActive:  '#A855F7',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type CallMode = 'sugar' | 'meds';
interface Message { role: 'agent' | 'user'; text: string; }

// ─── Language helpers ─────────────────────────────────────────────────────────
function getLangCodes(lang: PreferredLanguage) {
  return LANGUAGE_CODES[lang] ?? LANGUAGE_CODES['en'];
}

function buildSystemPrompt(mode: CallMode, medList: string, lang: PreferredLanguage): string {
  const langInstruction =
    lang === 'hi' ? 'Always respond in Hindi (Devanagari script). Use simple, friendly Hindi.' :
    lang === 'mr' ? 'Always respond in Marathi (Devanagari script). Use simple, friendly Marathi.' :
    'Always respond in English. Use simple, clear English.';

  if (mode === 'meds') {
    return `You are ElderEase, a warm and caring AI health assistant calling an elderly person.
Your job is to remind them to take their medications and confirm they have taken them.
Today's medications: ${medList || 'no medications scheduled'}.
Rules:
- ${langInstruction}
- Speak in simple, short sentences. Be warm, patient, and reassuring.
- Start by greeting them and asking if they have taken their medication.
- If they say yes: congratulate them warmly and say their caregiver will be notified.
- If they say no: gently remind them to take it now and offer to wait.
- If they seem confused: speak more slowly, repeat gently.
- End the call kindly after confirming.
- Keep each response to 2-3 short sentences maximum.`;
  }

  return `You are ElderEase, a caring AI health assistant calling an elderly person to check their blood sugar.
Your job is to ask them about their blood sugar reading and record the value.
Rules:
- ${langInstruction}
- Speak in simple, short, reassuring sentences.
- Ask them what their sugar reading is today.
- When they give a number, confirm it back clearly.
- Give brief feedback (normal: 80–140 mg/dL; high if above 180; low if below 70).
- Do NOT give medical advice — only say whether to inform their doctor.
- If they say a value, end your message with: SUGAR_VALUE:<number> (e.g. SUGAR_VALUE:120)
- Keep each response to 2-3 short sentences maximum.`;
}

// ─── Groq API ───────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callGroqAgent(
  systemPrompt: string,
  history: { role: 'system' | 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const url = `${PROXY_BASE}/api/groq`;

  const requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'system', content: systemPrompt }, ...history],
      temperature: 0.7,
      max_tokens: 300,
    }),
  };
  // Exponential backoff with a reasonable initial delay for free-tier quotas.
  let backoff = 2000;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Awaited<ReturnType<typeof fetch>>;
    try {
      response = await fetch(url, requestOptions);
    } catch (networkError) {
      if (attempt === maxAttempts) {
        throw new Error(
          `Could not reach API proxy at ${PROXY_BASE}. Start the server and set EXPO_PUBLIC_API_PROXY_URL for emulator/device usage. Original error: ${String(networkError)}`
        );
      }

      console.warn(`Groq network error (attempt ${attempt}). Retrying in ${backoff}ms...`, networkError);
      await sleep(backoff);
      backoff *= 2;
      continue;
    }

    if (response.status === 429) {
      if (attempt === maxAttempts) {
        const e = await response.text();
        throw new Error(`Groq 429: ${e}`);
      }

      console.warn(`Groq rate limited (attempt ${attempt}). Retrying in ${backoff}ms...`);
      await sleep(backoff);
      backoff *= 2;
      continue;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(async () => ({ error: { message: await response.text() } }));
      throw new Error(`Groq ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }

  throw new Error('Groq request failed after retries.');
}

// ─── Google Cloud TTS ─────────────────────────────────────────────────────────
async function synthesizeSpeech(text: string, langCode: string): Promise<string | null> {
  try {
    const url = `${PROXY_BASE}/api/tts`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: langCode,
          ssmlGender: 'FEMALE',
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.9,
          pitch: 0.0,
        },
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const base64Audio = data.audioContent;
    if (!base64Audio) return null;

    // Write to temp file and play
    const path = `${FileSystem.cacheDirectory}tts_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(path, base64Audio, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return path;
  } catch (e) {
    console.warn('TTS error:', e);
    return null;
  }
}

// ─── Google Cloud STT ─────────────────────────────────────────────────────────
async function transcribeSpeech(audioBase64: string, langCode: string): Promise<string> {
  const url = `${PROXY_BASE}/api/stt`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          encoding: 'AMR_WB',
          sampleRateHertz: 16000,
          languageCode: langCode,
          alternativeLanguageCodes: ['en-IN', 'hi-IN', 'mr-IN'],
          model: 'default',
          enableAutomaticPunctuation: true,
        },
        audio: { content: audioBase64 },
      }),
    });

    if (!response.ok) {
      console.warn('STT error:', await response.text());
      return '';
    }

    const data = await response.json();
    return data.results?.[0]?.alternatives?.[0]?.transcript ?? '';
  } catch (error) {
    console.warn('STT network error:', error);
    return '';
  }
}

// ─── Sugar helpers ────────────────────────────────────────────────────────────
function extractSugarTag(text: string): number | null {
  const m = text.match(/SUGAR_VALUE:(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}
function cleanAgentText(text: string): string {
  return text.replace(/SUGAR_VALUE:\d+/g, '').trim();
}

// ─── Waveform ─────────────────────────────────────────────────────────────────
function Waveform({ active, color = P.accent }: { active: boolean; color?: string }) {
  const bars = useRef(Array.from({ length: 8 }, () => new Animated.Value(0.15))).current;
  const loopsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (active) {
      loopsRef.current.forEach(l => l.stop());
      loopsRef.current = bars.map((bar, i) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(bar, { toValue: 0.25 + Math.random() * 0.75, duration: 180 + i * 70, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
            Animated.timing(bar, { toValue: 0.1 + Math.random() * 0.3,  duration: 180 + i * 55, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          ])
        );
        setTimeout(() => loop.start(), i * 70);
        return loop;
      });
    } else {
      loopsRef.current.forEach(l => l.stop());
      bars.forEach(bar => Animated.timing(bar, { toValue: 0.15, duration: 400, useNativeDriver: false }).start());
    }
    return () => loopsRef.current.forEach(l => l.stop());
  }, [active]);

  return (
    <View style={wv.wrap}>
      {bars.map((bar, i) => (
        <Animated.View key={i} style={[wv.bar, {
          height:  bar.interpolate({ inputRange: [0, 1], outputRange: [3, 26] }),
          opacity: bar.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
          backgroundColor: active ? color : P.textSec,
        }]} />
      ))}
    </View>
  );
}
const wv = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 30, width: 52 },
  bar:  { width: 3.5, borderRadius: 2 },
});

// ─── Typing dots ──────────────────────────────────────────────────────────────
function TypingDots() {
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 160),
        Animated.timing(dot, { toValue: -7, duration: 280, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0,  duration: 280, useNativeDriver: true }),
        Animated.delay(480),
      ]))
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={td.wrap}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[td.dot, { transform: [{ translateY: dot }] }]} />
      ))}
    </View>
  );
}
const td = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 5 },
  dot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: P.textSec },
});

// ─── Main component ───────────────────────────────────────────────────────────
export default function AICallScreen() {
  const { addEntry }                = useHealthData();
  const { upcomingMeds, markTaken } = useMedications();
  const { user }                    = useAuth();
  const { profile }                 = useUserProfile();

  const preferredLang = (profile?.preferredLanguage ?? 'en') as PreferredLanguage;
  const langCodes     = getLangCodes(preferredLang);

  const [inCall,        setInCall]        = useState(false);
  const [callMode,      setCallMode]      = useState<CallMode | null>(null);
  const [incoming,      setIncoming]      = useState(false);
  const [connected,     setConnected]     = useState(false);
  const [muted,         setMuted]         = useState(false);
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [userInput,     setUserInput]     = useState('');
  const [agentTyping,   setAgentTyping]   = useState(false);
  const [detectedSugar, setDetectedSugar] = useState<number | null>(null);
  const [callEnded,     setCallEnded]     = useState(false);
  const [seconds,       setSeconds]       = useState(0);

  // Voice recording state
  const [isRecording,   setIsRecording]   = useState(false);
  const [isTranscribing,setIsTranscribing]= useState(false);
  const [pendingVoice,  setPendingVoice]  = useState('');
  const [audioToPlay,   setAudioToPlay]    = useState<string | null>(null);

  const secondsRef    = useRef(0);
  const timerRef      = useRef<any>(null);
  const scrollRef     = useRef<ScrollView>(null);
  const chatHistory   = useRef<{ role: 'system' | 'user' | 'assistant'; content: string }[]>([]);
  const recorder      = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player         = useAudioPlayer(audioToPlay);

  // Animations
  const ring1      = useRef(new Animated.Value(0)).current;
  const ring2      = useRef(new Animated.Value(0)).current;
  const ring3      = useRef(new Animated.Value(0)).current;
  const ringLoops  = useRef<Animated.CompositeAnimation[]>([]);
  const statusPulse = useRef(new Animated.Value(1)).current;
  const micPulse    = useRef(new Animated.Value(1)).current;

  // Request audio permissions on mount
  useEffect(() => {
    requestRecordingPermissionsAsync().catch(() => {});
    setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    }).catch(() => {});
    return () => { stopRing(); stopTimer(); };
  }, []);

  useEffect(() => {
    if (!audioToPlay) return;
    player.play();
  }, [audioToPlay, player]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, agentTyping]);

  useEffect(() => {
    if (!connected) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(statusPulse, { toValue: 0.25, duration: 900, useNativeDriver: true }),
      Animated.timing(statusPulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [connected]);

  useEffect(() => {
    if (!isRecording) { micPulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(micPulse, { toValue: 1.3, duration: 600, useNativeDriver: true }),
      Animated.timing(micPulse, { toValue: 1.0, duration: 600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [isRecording]);

  // ─── Audio helpers ──────────────────────────────────────────────────────
  async function playAudio(path: string) {
    if (muted) return;
    try {
      setAudioToPlay(path);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  async function speak(text: string) {
    if (muted) return;
    const clean = cleanAgentText(text);
    const path  = await synthesizeSpeech(clean, langCodes.tts);
    if (path) await playAudio(path);
  }

  // ─── Recording ──────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      await setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setPendingVoice('');
    } catch (e) {
      Alert.alert('Mic Error', 'Could not start recording. Please check microphone permissions.');
    }
  }

  async function stopRecording() {
    if (!recorder.isRecording) return;
    setIsRecording(false);
    setIsTranscribing(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;

      if (!uri) { setIsTranscribing(false); return; }

      // Read as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const transcript = await transcribeSpeech(base64, langCodes.stt);
      if (transcript) {
        setPendingVoice(transcript);
        setUserInput(transcript);
      } else {
        Alert.alert('Could not understand', 'Please speak clearly and try again.');
      }
    } catch (e) {
      console.warn('Recording stop error:', e);
    } finally {
      setIsTranscribing(false);
    }
  }

  // ─── Ring & Timer ────────────────────────────────────────────────────────
  function startRing() {
    [ring1, ring2, ring3].forEach(r => r.setValue(0));
    ringLoops.current = [ring1, ring2, ring3].map((anim, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 500),
        Animated.timing(anim, { toValue: 1, duration: 1600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(400),
      ]))
    );
    ringLoops.current.forEach(l => l.start());
  }

  function stopRing() {
    try { ringLoops.current.forEach(l => l.stop()); } catch (_) {}
  }

  function startTimer() {
    stopTimer(); secondsRef.current = 0; setSeconds(0);
    timerRef.current = setInterval(() => { secondsRef.current += 1; setSeconds(secondsRef.current); }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  // ─── Call lifecycle ──────────────────────────────────────────────────────
  function startCallWithMode(mode: CallMode) {
    setCallMode(mode); setInCall(true); setIncoming(true);
    setMessages([]); setDetectedSugar(null); setCallEnded(false);
    chatHistory.current = [];
    startRing();
  }

  async function acceptCall() {
    if (!callMode) return;
    setIncoming(false); setConnected(true);
    stopRing(); startTimer();

    const medList = upcomingMeds?.map(m => `${m.name} at ${m.time}`).join(', ') || '';
    const system  = buildSystemPrompt(callMode, medList, preferredLang);

    setAgentTyping(true);
    try {
      const openingMsg = { role: 'user' as const, content: '[Call connected. Please greet the patient warmly and start the conversation.]' };
      chatHistory.current = [openingMsg];
      const agentReply = await callGroqAgent(system, chatHistory.current);
      chatHistory.current.push({ role: 'assistant', content: agentReply });
      const cleanReply = cleanAgentText(agentReply);
      setMessages([{ role: 'agent', text: cleanReply }]);
      await speak(agentReply);
    } catch (_) {
      const fallback = preferredLang === 'hi'
        ? 'नमस्ते! मैं ElderEase हूँ। आप कैसे हैं?'
        : preferredLang === 'mr'
        ? 'नमस्कार! मी ElderEase आहे. आपण कसे आहात?'
        : 'Hello! This is ElderEase. How are you today?';
      setMessages([{ role: 'agent', text: fallback }]);
    } finally { setAgentTyping(false); }
  }

  function declineCall() {
    stopRing();
    setIncoming(false); setConnected(false); setInCall(false); setCallMode(null);
  }

  function endCall() {
    stopTimer();
    if (isRecording) stopRecording();
    setConnected(false); setCallEnded(true);
  }

  function dismissCall() {
    setInCall(false); setCallMode(null); setCallEnded(false);
    setMessages([]); chatHistory.current = [];
    setPendingVoice(''); setUserInput('');
  }

  // ─── Send message ────────────────────────────────────────────────────────
  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? userInput).trim();
    if (!text || agentTyping || !callMode) return;
    setUserInput(''); setPendingVoice('');

    setMessages(prev => [...prev, { role: 'user', text }]);
    chatHistory.current.push({ role: 'user', content: text });

    const medList = upcomingMeds?.map(m => `${m.name} at ${m.time}`).join(', ') || '';
    const system  = buildSystemPrompt(callMode, medList, preferredLang);

    setAgentTyping(true);
    try {
      const agentReply = await callGroqAgent(system, chatHistory.current);
      const sugar      = extractSugarTag(agentReply);
      if (sugar) setDetectedSugar(sugar);
      const cleanReply = cleanAgentText(agentReply);
      chatHistory.current.push({ role: 'assistant', content: agentReply });
      setMessages(prev => [...prev, { role: 'agent', text: cleanReply }]);
      await speak(agentReply);
      if (/bye|goodbye|take care|धन्यवाद|ठीक है|नमस्ते|धन्यवाद|निरोगी राहा/i.test(cleanReply)) {
        setTimeout(() => endCall(), 3500);
      }
    } catch (_) {
      setMessages(prev => [...prev, { role: 'agent', text: 'Sorry, connection issue. Please try again.' }]);
    } finally { setAgentTyping(false); }
  }

  async function handleMarkAllTaken() {
    upcomingMeds?.forEach(m => markTaken(m.id));
    sendMessage(preferredLang === 'hi' ? 'मैंने सभी दवाइयाँ ले ली हैं।' : preferredLang === 'mr' ? 'मी सर्व औषधे घेतली आहेत.' : 'I have taken all my medicines.');
  }

  function saveSugar() {
    if (!detectedSugar) {
      Alert.alert('No reading detected', 'Tell the agent your blood sugar number during the call.');
      return;
    }
    const transcript = messages.map(m => `${m.role === 'agent' ? 'Agent' : 'You'}: ${m.text}`).join('\n');
    addEntry({ value: detectedSugar, unit: 'mg/dL', source: 'ai-call', transcript });
    Alert.alert('Saved!', `Blood sugar ${detectedSugar} mg/dL saved.`, [
      { text: 'OK', onPress: () => router.replace('/(tabs)/emergency') },
    ]);
  }

  const mmss = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  const makeRingStyle = (anim: Animated.Value) => ({
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
    opacity:   anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.55, 0.2, 0] }),
  });

  // Quick reply chips per language
  const medChips  = preferredLang === 'hi'
    ? ['हाँ, ले ली', 'अभी नहीं', 'मुझे मदद चाहिए']
    : preferredLang === 'mr'
    ? ['हो, घेतल्या', 'अजून नाही', 'मला मदत हवी']
    : ['Yes, I took it', 'Not yet', 'I need help'];

  const sugarChips = preferredLang === 'hi'
    ? ['मेरी शुगर 110 है', 'मेरी शुगर 140 है', 'मेरी शुगर 200 है', 'मैंने जांच नहीं की']
    : preferredLang === 'mr'
    ? ['माझी शुगर 110 आहे', 'माझी शुगर 140 आहे', 'माझी शुगर 200 आहे', 'मी तपासले नाही']
    : ['My sugar is 110', 'My sugar is 140', 'My sugar is 200', 'I did not check'];

  // ═══════════════════════════════════════════════════════════════════════════
  // IDLE SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  if (!inCall) {
    return (
      <View style={s.screen}>
        <View style={s.orb1} />
        <View style={s.orb2} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.idleContent} showsVerticalScrollIndicator={false}>
          <View style={s.idleHeader}>
            <View style={s.aiBadge}>
              <View style={s.aiBadgeDot} />
              <Text style={s.aiBadgeText}>AI POWERED · GROQ</Text>
            </View>
            <Text style={s.heroTitle}>Health{'\n'}Calls</Text>
            <Text style={s.heroSub}>
              Your personal AI companion.{'\n'}
              {preferredLang === 'hi' ? 'हिंदी, मराठी और English में उपलब्ध।' :
               preferredLang === 'mr' ? 'हिंदी, मराठी आणि English मध्ये उपलब्ध.' :
               'Speaks Hindi, Marathi & English, available 24/7.'}
            </Text>
          </View>

          <TouchableOpacity style={s.callCard} onPress={() => startCallWithMode('meds')} activeOpacity={0.85}>
            <View style={[s.cardAccentBar, { backgroundColor: P.primary }]} />
            <View style={s.cardBody}>
              <View style={[s.cardIconWrap, { backgroundColor: '#0A1E3A' }]}>
                <Text style={s.cardEmoji}>💊</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>
                  {preferredLang === 'hi' ? 'दवाई रिमाइंडर' : preferredLang === 'mr' ? 'औषध स्मरण' : 'Medication Reminder'}
                </Text>
                <Text style={s.cardDesc}>
                  {preferredLang === 'hi' ? 'AI आपकी दवाइयाँ लेने की पुष्टि करेगा।' :
                   preferredLang === 'mr' ? 'AI तुमची औषधे घेण्याची पुष्टी करेल.' :
                   'AI confirms you\'ve taken your medications.'}
                </Text>
                <View style={s.cardMeta}>
                  <Text style={s.cardMetaText}>{upcomingMeds?.length ?? 0} meds today</Text>
                </View>
              </View>
              <Text style={s.cardArrow}>›</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[s.callCard, { borderColor: '#0A2B1E' }]} onPress={() => startCallWithMode('sugar')} activeOpacity={0.85}>
            <View style={[s.cardAccentBar, { backgroundColor: P.accent }]} />
            <View style={s.cardBody}>
              <View style={[s.cardIconWrap, { backgroundColor: '#001E14' }]}>
                <Text style={s.cardEmoji}>🩸</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>
                  {preferredLang === 'hi' ? 'ब्लड शुगर जाँच' : preferredLang === 'mr' ? 'रक्त साखर तपासणी' : 'Blood Sugar Check'}
                </Text>
                <Text style={s.cardDesc}>
                  {preferredLang === 'hi' ? 'अपनी शुगर रीडिंग बताएं। AI रिकॉर्ड करेगा।' :
                   preferredLang === 'mr' ? 'तुमची शुगर रीडिंग सांगा. AI रेकॉर्ड करेल.' :
                   'Report your glucose reading. AI records it.'}
                </Text>
                <View style={[s.cardMeta, { backgroundColor: '#001A10', borderColor: '#003020' }]}>
                  <Text style={[s.cardMetaText, { color: P.accent }]}>Normal: 80–140 mg/dL</Text>
                </View>
              </View>
              <Text style={[s.cardArrow, { color: P.accent }]}>›</Text>
            </View>
          </TouchableOpacity>

          <View style={s.featureRow}>
            {[
              { icon: '🎤', text: 'Voice Input' },
              { icon: '🔊', text: 'Natural TTS' },
              { icon: '🌐', text: 'Hindi · Marathi · English' },
            ].map(f => (
              <View key={f.text} style={s.featureChip}>
                <Text style={s.featureIcon}>{f.icon}</Text>
                <Text style={s.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INCOMING SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  if (inCall && incoming) {
    return (
      <View style={s.incomingScreen}>
        <Animated.View style={[s.ringCircle, { backgroundColor: 'rgba(74,143,246,0.45)' }, makeRingStyle(ring1)]} />
        <Animated.View style={[s.ringCircle, { backgroundColor: 'rgba(74,143,246,0.30)' }, makeRingStyle(ring2)]} />
        <Animated.View style={[s.ringCircle, { backgroundColor: 'rgba(74,143,246,0.15)' }, makeRingStyle(ring3)]} />

        <View style={s.incomingAvatarOuter}>
          <View style={s.incomingAvatarInner}><AICallLogo size={52} /></View>
        </View>

        <View style={s.incomingLabelRow}>
          <View style={s.incomingDot} />
          <Text style={s.incomingCallLabel}>INCOMING CALL</Text>
        </View>

        <Text style={s.incomingName}>{callMode === 'meds' ? 'ElderEase' : 'AI Health Check'}</Text>
        <Text style={s.incomingSubtitle}>{callMode === 'meds' ? '💊  Medication Reminder' : '🩸  Blood Sugar Check'}</Text>
        <Text style={s.incomingPowered}>Groq Llama · Fast AI responses</Text>

        <View style={s.incomingActions}>
          <View style={s.incomingBtnGroup}>
            <Pressable style={[s.incomingBtn, s.declineBtn]} onPress={declineCall}>
              <Text style={s.incomingBtnIcon}>✕</Text>
            </Pressable>
            <Text style={s.incomingBtnLabel}>Decline</Text>
          </View>
          <View style={s.incomingBtnGroup}>
            <Pressable style={[s.incomingBtn, s.acceptBtn]} onPress={acceptCall}>
              <Text style={s.incomingBtnIcon}>✓</Text>
            </Pressable>
            <Text style={s.incomingBtnLabel}>Accept</Text>
          </View>
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  if (inCall && callEnded) {
    return (
      <View style={s.summaryScreen}>
        <Text style={s.summaryTitle}>
          {preferredLang === 'hi' ? 'कॉल सारांश' : preferredLang === 'mr' ? 'कॉल सारांश' : 'Call Summary'}
        </Text>
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statValue}>{mmss}</Text>
            <Text style={s.statLabel}>DURATION</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue}>{messages.length}</Text>
            <Text style={s.statLabel}>MESSAGES</Text>
          </View>
          {detectedSugar ? (
            <View style={[s.statCard, { borderColor: 'rgba(0,212,143,0.4)' }]}>
              <Text style={[s.statValue, { color: P.accent }]}>{detectedSugar}</Text>
              <Text style={[s.statLabel, { color: P.accent }]}>MG/DL</Text>
            </View>
          ) : (
            <View style={s.statCard}>
              <Text style={[s.statValue, { color: callMode === 'meds' ? P.accent : P.textSec }]}>
                {callMode === 'meds' ? '✓' : '—'}
              </Text>
              <Text style={s.statLabel}>{callMode === 'meds' ? 'DONE' : 'SUGAR'}</Text>
            </View>
          )}
        </View>

        <Text style={s.transcriptLabel}>TRANSCRIPT</Text>
        <ScrollView style={s.summScroll} showsVerticalScrollIndicator={false}>
          {messages.map((msg, i) => (
            <View key={i} style={[s.summBubble, msg.role === 'agent' ? s.summAgent : s.summUser]}>
              <Text style={s.summRole}>{msg.role === 'agent' ? '🤖  ElderEase' : '👤  You'}</Text>
              <Text style={s.summText}>{msg.text}</Text>
            </View>
          ))}
        </ScrollView>

        {callMode === 'sugar' && (
          <TouchableOpacity style={s.saveBtn} onPress={saveSugar} activeOpacity={0.85}>
            <Text style={s.saveBtnText}>💾  Save Blood Sugar Reading</Text>
          </TouchableOpacity>
        )}
        {callMode === 'meds' && (
          <TouchableOpacity style={s.saveBtn} onPress={handleMarkAllTaken} activeOpacity={0.85}>
            <Text style={s.saveBtnText}>✅  Mark All Meds as Taken</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.doneBtn} onPress={dismissCall} activeOpacity={0.85}>
          <Text style={s.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONNECTED / ACTIVE CALL
  // ═══════════════════════════════════════════════════════════════════════════
  if (inCall && connected) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
        <View style={s.connScreen}>

          {/* Header */}
          <View style={s.connHeader}>
            <View style={s.connAvatarWrap}><AICallLogo size={28} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.connName}>{callMode === 'meds' ? 'ElderEase Reminder' : 'AI Health Check'}</Text>
              <View style={s.connStatusRow}>
                <Animated.View style={[s.connStatusDot, { opacity: statusPulse }]} />
                <Text style={s.connStatusText}>{mmss} · Connected</Text>
              </View>
            </View>
            <Waveform active={agentTyping} />
            {detectedSugar ? (
              <View style={s.sugarBadge}>
                <Text style={s.sugarVal}>{detectedSugar}</Text>
                <Text style={s.sugarUnit}>mg/dL</Text>
              </View>
            ) : null}
          </View>

          <View style={s.divider} />

          {/* Chat */}
          <ScrollView ref={scrollRef} style={s.chatScroll} contentContainerStyle={s.chatContent} showsVerticalScrollIndicator={false}>
            {messages.map((msg, i) => (
              <View key={i} style={[s.msgRow, msg.role === 'user' ? s.msgRowUser : s.msgRowAgent]}>
                {msg.role === 'agent' && (
                  <View style={s.agentPip}><Text style={s.agentPipText}>E</Text></View>
                )}
                <View style={[s.msgBubble, msg.role === 'agent' ? s.agentBubble : s.userBubble]}>
                  <Text style={[s.msgText, msg.role === 'user' && s.msgTextUser]}>{msg.text}</Text>
                </View>
              </View>
            ))}

            {agentTyping && (
              <View style={[s.msgRow, s.msgRowAgent]}>
                <View style={s.agentPip}><Text style={s.agentPipText}>E</Text></View>
                <View style={[s.msgBubble, s.agentBubble]}><TypingDots /></View>
              </View>
            )}

            {/* Transcribing indicator */}
            {isTranscribing && (
              <View style={[s.msgRow, s.msgRowUser]}>
                <View style={[s.msgBubble, s.userBubble, { opacity: 0.6 }]}>
                  <Text style={s.msgTextUser}>🎤 Transcribing…</Text>
                </View>
              </View>
            )}

            {/* Quick-reply chips */}
            {callMode === 'meds' && messages.length > 0 && !agentTyping && (
              <View style={s.chipRow}>
                {medChips.map(chip => (
                  <TouchableOpacity key={chip} style={s.chip} onPress={() => setUserInput(chip)}>
                    <Text style={s.chipText}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {callMode === 'sugar' && messages.length > 0 && !agentTyping && !detectedSugar && (
              <View style={s.chipRow}>
                {sugarChips.map(chip => (
                  <TouchableOpacity key={chip} style={s.chip} onPress={() => setUserInput(chip)}>
                    <Text style={s.chipText}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Input bar with mic */}
          <View style={s.inputBar}>
            {/* Mic button */}
            <Animated.View style={{ transform: [{ scale: micPulse }] }}>
              <TouchableOpacity
                style={[s.micBtn, isRecording && s.micBtnActive]}
                onPress={isRecording ? stopRecording : startRecording}
                disabled={agentTyping || isTranscribing}
              >
                <Text style={s.micIcon}>{isRecording ? '⏹' : '🎤'}</Text>
              </TouchableOpacity>
            </Animated.View>

            <TextInput
              style={s.textInput}
              value={userInput}
              onChangeText={setUserInput}
              placeholder={
                isRecording ? (preferredLang === 'hi' ? 'सुन रहा हूँ…' : preferredLang === 'mr' ? 'ऐकत आहे…' : 'Listening…') :
                isTranscribing ? 'Transcribing…' :
                preferredLang === 'hi' ? 'जवाब लिखें…' :
                preferredLang === 'mr' ? 'उत्तर लिहा…' : 'Type your reply…'
              }
              placeholderTextColor={isRecording ? P.micActive : P.textSec}
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
              editable={!agentTyping && !isRecording && !isTranscribing}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!userInput.trim() || agentTyping) && s.sendBtnDisabled]}
              onPress={() => sendMessage()}
              disabled={!userInput.trim() || agentTyping}
            >
              <Text style={s.sendBtnIcon}>↑</Text>
            </TouchableOpacity>
          </View>

          {/* Voice confirm banner */}
          {pendingVoice && !isRecording && !isTranscribing && (
            <View style={s.voiceBanner}>
              <Text style={s.voiceBannerText} numberOfLines={2}>🎤 {"\""}{pendingVoice}{"\""}</Text>
              <View style={s.voiceBannerActions}>
                <TouchableOpacity style={s.voiceConfirmBtn} onPress={() => sendMessage()}>
                  <Text style={s.voiceConfirmText}>Send ✓</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.voiceCancelBtn} onPress={() => { setPendingVoice(''); setUserInput(''); }}>
                  <Text style={s.voiceCancelText}>Clear ✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Controls */}
          <View style={s.controlBar}>
            <TouchableOpacity style={s.ctrlPill} onPress={() => setMuted(v => !v)}>
              <Text style={s.ctrlEmoji}>{muted ? '🔇' : '🔈'}</Text>
              <Text style={[s.ctrlLabel, muted && { color: P.primary }]}>{muted ? 'Muted' : 'Mute'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.endCallBtn} onPress={endCall}>
              <Text style={{ fontSize: 18, marginBottom: 2 }}>📵</Text>
              <Text style={s.endCallText}>End Call</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.ctrlPill} onPress={() => {}}>
              <Text style={s.ctrlEmoji}>🌐</Text>
              <Text style={s.ctrlLabel}>
                {preferredLang === 'hi' ? 'हिंदी' : preferredLang === 'mr' ? 'मराठी' : 'English'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.bg },
  orb1: { position: 'absolute', width: 340, height: 340, borderRadius: 170, backgroundColor: 'rgba(74,143,246,0.055)', top: -100, right: -80 },
  orb2: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(0,212,143,0.045)', bottom: 80, left: -90 },

  idleContent: { padding: 24, paddingTop: 62, paddingBottom: 40 },
  idleHeader:  { marginBottom: 36 },
  aiBadge:     { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 20 },
  aiBadgeDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: P.accent },
  aiBadgeText: { color: P.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  heroTitle:   { fontSize: 44, fontWeight: '900', color: P.textPri, letterSpacing: -1, lineHeight: 50, marginBottom: 12 },
  heroSub:     { fontSize: 15, color: P.textSec, lineHeight: 24, maxWidth: SCREEN_W * 0.75 },

  callCard:     { backgroundColor: P.card, borderRadius: 22, marginBottom: 16, borderWidth: 1, borderColor: P.border, overflow: 'hidden' },
  cardAccentBar:{ height: 3 },
  cardBody:     { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
  cardIconWrap: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cardEmoji:    { fontSize: 26 },
  cardTitle:    { color: P.textPri, fontSize: 16, fontWeight: '700', marginBottom: 5 },
  cardDesc:     { color: P.textSec, fontSize: 13, lineHeight: 19.5, marginBottom: 10 },
  cardMeta:     { alignSelf: 'flex-start', backgroundColor: '#0A1D35', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: P.border },
  cardMetaText: { color: P.textSec, fontSize: 11, fontWeight: '600' },
  cardArrow:    { color: P.primary, fontSize: 26, fontWeight: '300' },
  featureRow:   { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 8 },
  featureChip:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: P.surface, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: P.border },
  featureIcon:  { fontSize: 14 },
  featureText:  { color: P.textSec, fontSize: 12, fontWeight: '500' },

  incomingScreen:      { flex: 1, backgroundColor: '#020810', alignItems: 'center', justifyContent: 'center', padding: 24 },
  ringCircle:          { position: 'absolute', width: 148, height: 148, borderRadius: 74 },
  incomingAvatarOuter: { width: 118, height: 118, borderRadius: 59, borderWidth: 1.5, borderColor: 'rgba(74,143,246,0.35)', alignItems: 'center', justifyContent: 'center', marginBottom: 36, shadowColor: P.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 24, elevation: 20, backgroundColor: '#090F1E' },
  incomingAvatarInner: { width: 92, height: 92, borderRadius: 46, backgroundColor: P.card, alignItems: 'center', justifyContent: 'center' },
  incomingLabelRow:    { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  incomingDot:         { width: 7, height: 7, borderRadius: 4, backgroundColor: P.primary },
  incomingCallLabel:   { color: P.primary, fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  incomingName:        { color: P.textPri, fontSize: 30, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
  incomingSubtitle:    { color: P.textSec, fontSize: 15, marginBottom: 6 },
  incomingPowered:     { color: '#1E2F48', fontSize: 11, marginBottom: 60 },
  incomingActions:     { flexDirection: 'row', gap: 52 },
  incomingBtnGroup:    { alignItems: 'center', gap: 10 },
  incomingBtn:         { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  declineBtn:          { backgroundColor: '#280810', borderWidth: 2, borderColor: '#6B1520', shadowColor: P.danger, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 14, elevation: 14 },
  acceptBtn:           { backgroundColor: '#042415', borderWidth: 2, borderColor: '#136B3A', shadowColor: P.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 14, elevation: 14 },
  incomingBtnIcon:     { color: P.textPri, fontSize: 26, fontWeight: '700' },
  incomingBtnLabel:    { color: P.textSec, fontSize: 12, fontWeight: '600' },

  connScreen:    { flex: 1, backgroundColor: P.bg, paddingTop: Platform.OS === 'ios' ? 52 : 28 },
  connHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 14 },
  connAvatarWrap:{ width: 46, height: 46, borderRadius: 23, backgroundColor: P.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: P.border },
  connName:      { color: P.textPri, fontSize: 14, fontWeight: '700' },
  connStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  connStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: P.accent },
  connStatusText:{ color: P.textSec, fontSize: 11 },
  divider:       { height: 1, backgroundColor: P.border, marginHorizontal: 18, marginBottom: 4 },
  sugarBadge:    { backgroundColor: 'rgba(0,212,143,0.12)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', marginLeft: 8, borderWidth: 1, borderColor: 'rgba(0,212,143,0.25)' },
  sugarVal:      { color: P.accent, fontSize: 14, fontWeight: '800', lineHeight: 17 },
  sugarUnit:     { color: P.accent, fontSize: 9, fontWeight: '600', opacity: 0.8 },

  chatScroll:   { flex: 1 },
  chatContent:  { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, gap: 10 },
  msgRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '86%' },
  msgRowAgent:  { alignSelf: 'flex-start' },
  msgRowUser:   { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  agentPip:     { width: 24, height: 24, borderRadius: 12, backgroundColor: '#112240', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: P.border },
  agentPipText: { color: P.primary, fontSize: 10, fontWeight: '800' },
  msgBubble:    { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, flexShrink: 1 },
  agentBubble:  { backgroundColor: P.agentBg, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: P.border },
  userBubble:   { backgroundColor: P.userBg, borderBottomRightRadius: 5 },
  msgText:      { color: '#D8E4FF', fontSize: 14, lineHeight: 21 },
  msgTextUser:  { color: '#C8DEFF' },

  chipRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 2, paddingTop: 4, paddingBottom: 6 },
  chip:     { backgroundColor: P.chipBg, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: P.chipBorder },
  chipText: { color: '#6688AA', fontSize: 12, fontWeight: '500' },

  inputBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: P.bg, alignItems: 'center' },
  micBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: P.mic, alignItems: 'center', justifyContent: 'center',
    shadowColor: P.mic, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  micBtnActive: {
    backgroundColor: P.micActive,
    shadowColor: P.micActive, shadowOpacity: 0.7,
  },
  micIcon: { fontSize: 18 },
  textInput: { flex: 1, backgroundColor: P.surface, borderRadius: 26, paddingHorizontal: 18, paddingVertical: 12, color: P.textPri, fontSize: 14, borderWidth: 1, borderColor: P.border },
  sendBtn:         { width: 46, height: 46, borderRadius: 23, backgroundColor: P.primary, alignItems: 'center', justifyContent: 'center', shadowColor: P.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  sendBtnDisabled: { opacity: 0.3, shadowOpacity: 0 },
  sendBtnIcon:     { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: -1 },

  // Voice confirm banner
  voiceBanner: { backgroundColor: '#0A1E3A', borderTopWidth: 1, borderTopColor: P.border, paddingHorizontal: 16, paddingVertical: 10 },
  voiceBannerText:    { color: P.textPri, fontSize: 13, marginBottom: 8 },
  voiceBannerActions: { flexDirection: 'row', gap: 10 },
  voiceConfirmBtn:    { flex: 1, backgroundColor: P.accent + '22', borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: P.accent },
  voiceConfirmText:   { color: P.accent, fontWeight: '700', fontSize: 13 },
  voiceCancelBtn:     { flex: 1, backgroundColor: P.danger + '22', borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: P.danger },
  voiceCancelText:    { color: P.danger, fontWeight: '700', fontSize: 13 },

  controlBar:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 18, backgroundColor: P.surface, borderTopWidth: 1, borderTopColor: P.border, gap: 10 },
  ctrlPill:    { flex: 1, alignItems: 'center', paddingVertical: 11, backgroundColor: P.card, borderRadius: 16, borderWidth: 1, borderColor: P.border, gap: 4 },
  ctrlEmoji:   { fontSize: 20 },
  ctrlLabel:   { color: P.textSec, fontSize: 10, fontWeight: '600' },
  endCallBtn:  { flex: 1.3, backgroundColor: '#200810', borderRadius: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#5A1020', shadowColor: P.danger, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10, gap: 2 },
  endCallText: { color: '#FF6678', fontSize: 12, fontWeight: '700' },

  summaryScreen: { flex: 1, backgroundColor: P.bg, paddingHorizontal: 22, paddingTop: Platform.OS === 'ios' ? 58 : 34, paddingBottom: 20 },
  summaryTitle:  { color: P.textPri, fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginBottom: 22 },
  statsRow:      { flexDirection: 'row', gap: 12, marginBottom: 26 },
  statCard:      { flex: 1, backgroundColor: P.card, borderRadius: 18, paddingVertical: 16, borderWidth: 1, borderColor: P.border, alignItems: 'center' },
  statValue:     { color: P.primary, fontSize: 22, fontWeight: '800', lineHeight: 28 },
  statLabel:     { color: P.textSec, fontSize: 9, fontWeight: '700', letterSpacing: 1.2, marginTop: 4 },
  transcriptLabel:{ color: P.textSec, fontSize: 10, fontWeight: '700', letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 12 },
  summScroll:    { flex: 1, marginBottom: 16 },
  summBubble:    { borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: P.border },
  summAgent:     { backgroundColor: P.agentBg },
  summUser:      { backgroundColor: '#0C1E40' },
  summRole:      { color: P.textSec, fontSize: 10, fontWeight: '700', marginBottom: 6 },
  summText:      { color: P.textPri, fontSize: 13, lineHeight: 20 },
  saveBtn:       { backgroundColor: P.primary, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 10, shadowColor: P.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8 },
  saveBtnText:   { color: '#fff', fontSize: 15, fontWeight: '700' },
  doneBtn:       { backgroundColor: P.surface, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: P.border },
  doneBtnText:   { color: P.textSec, fontSize: 14, fontWeight: '600' },
});