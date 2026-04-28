import { EmergencyContact } from '@/constants/data';
import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { useEmergencyContacts } from '@/hooks/useEmergencyContacts';
import { useHealthData } from '@/hooks/useHealthData';
import { getEmergencyContactSlotLabel } from '@/lib/emergency-contacts';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');
const SOS_BTN_SIZE = Math.min(width * 0.55, 240);

function ContactCard({
  contact,
  onCall,
}: {
  contact: EmergencyContact;
  onCall: (c: EmergencyContact) => void;
}) {
  return (
    <View style={[styles.contactCard, contact.isPrimary && styles.contactCardPrimary]}>
      {contact.isPrimary && (
        <View style={styles.primaryTag}>
          <Ionicons name="star" size={12} color={Colors.accent} />
          <Text style={styles.primaryTagText}>Primary</Text>
        </View>
      )}
      <View style={[styles.avatar, { backgroundColor: contact.color }]}>
        <Text style={styles.avatarText}>{contact.initials}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{contact.name}</Text>
        <Text style={styles.contactSlot}>{getEmergencyContactSlotLabel(contact.slot)}</Text>
        <Text style={styles.contactRelation}>{contact.relation}</Text>
        <Text style={styles.contactPhone}>{contact.phone}</Text>
      </View>
      <TouchableOpacity
        style={[styles.callBtn, contact.isPrimary && styles.callBtnPrimary]}
        onPress={() => onCall(contact)}
        activeOpacity={0.8}
      >
        <Ionicons name="call" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export default function EmergencyScreen() {
  const [contacts, , contactsLoading] = useEmergencyContacts();
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(5);
  const [sosCancelled, setSosCancelled] = useState(false);

  const { latest } = useHealthData();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulse animation for SOS button
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.07, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  function handleSOSPress() {
    setSosCountdown(5);
    setSosCancelled(false);
    setShowSOSModal(true);
    let count = 5;
    countdownRef.current = setInterval(() => {
      count -= 1;
      setSosCountdown(count);
      if (count <= 0) {
        clearInterval(countdownRef.current!);
        setShowSOSModal(false);
        triggerSOS();
      }
    }, 1000);
  }

  function handleCancelSOS() {
    clearInterval(countdownRef.current!);
    setSosCancelled(true);
    setShowSOSModal(false);
  }

  function triggerSOS() {
    const primary = contacts.find((c) => c.isPrimary);
    Alert.alert(
      '🚨 SOS Sent!',
      `Calling ${primary?.name ?? 'your emergency contact'}...\n\nSMS has been sent to all emergency contacts with your location.`,
      [
        {
          text: 'Call Now',
          onPress: () => {
            if (primary) Linking.openURL(`tel:${primary.phone.replace(/\s/g, '')}`);
          },
        },
        { text: 'OK', style: 'cancel' },
      ]
    );
  }

  function handleCallContact(contact: EmergencyContact) {
    Alert.alert(`Call ${contact.name}?`, `${contact.relation} — ${contact.phone}`, [
      {
        text: 'Call',
        onPress: () => Linking.openURL(`tel:${contact.phone.replace(/\s/g, '')}`),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  if (contactsLoading) {
    return null;
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Warning Banner ── */}
        <View style={styles.warningBanner}>
          <Ionicons name="information-circle" size={20} color={Colors.emergency} />
          <Text style={styles.warningText}>
            For life-threatening emergencies, call <Text style={styles.warningBold}>112</Text> directly.
          </Text>
        </View>

        {/* ── Latest Reading Strip (from AI call / manual) ── */}
        {/** show latest entry if present **/}
        {latest ? (
          <View style={styles.latestStrip}>
            <Text style={styles.latestText}>
              Latest sugar: {latest.value} {latest.unit} • {new Date(latest.timestamp).toLocaleString()}
            </Text>
            <TouchableOpacity style={styles.recheckBtn} onPress={() => router.push('/(tabs)/ai-call')}>
              <Text style={styles.recheckText}>Re-check</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── SOS Button Section ── */}
        <View style={styles.sosSection}>
          <Text style={styles.sosLabel}>Press if you need immediate help</Text>

          {/* Outer ring */}
          <View style={styles.sosRingOuter}>
            <View style={styles.sosRingMid}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity
                  style={styles.sosBtn}
                  onPress={handleSOSPress}
                  activeOpacity={0.9}
                >
                  <Ionicons name="alert-circle" size={48} color="#fff" />
                  <Text style={styles.sosBtnText}>HELP</Text>
                  <Text style={styles.sosBtnSub}>TAP FOR EMERGENCY</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          <Text style={styles.sosFootnote}>
            Will call your primary contact and SMS all emergency contacts
          </Text>
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => Linking.openURL('tel:112')}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={22} color={Colors.emergency} />
            <Text style={styles.quickBtnLabel}>Call 112</Text>
            <Text style={styles.quickBtnSub}>National Emergency</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => Linking.openURL('tel:108')}
            activeOpacity={0.8}
          >
            <Ionicons name="medkit" size={22} color="#3B82F6" />
            <Text style={styles.quickBtnLabel}>Call 108</Text>
            <Text style={styles.quickBtnSub}>Ambulance</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => {
              const primary = contacts.find((c) => c.isPrimary);
              if (primary) handleCallContact(primary);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="person" size={22} color={Colors.primary} />
            <Text style={styles.quickBtnLabel}>Primary</Text>
            <Text style={styles.quickBtnSub}>Contact</Text>
          </TouchableOpacity>
        </View>

        {/* ── Contacts List ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Emergency Contacts</Text>
            <TouchableOpacity
              style={styles.addContactBtn}
              onPress={() => router.push('/profile/edit')}
            >
              <Ionicons name="add" size={18} color={Colors.primary} />
              <Text style={styles.addContactText}>Add</Text>
            </TouchableOpacity>
          </View>

          {contacts.map((contact) => (
            <ContactCard key={contact.id} contact={contact} onCall={handleCallContact} />
          ))}
        </View>

        {/* ── Safety Tips ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety Tips</Text>
          {[
            { icon: 'location-outline', tip: 'Keep location services ON so help can find you quickly.' },
            { icon: 'phone-portrait-outline', tip: 'Keep your phone charged above 20% at all times.' },
            { icon: 'people-outline', tip: 'Inform your contacts when you travel somewhere alone.' },
            { icon: 'medical-outline', tip: 'Always carry a list of your medications when going out.' },
          ].map((item, i) => (
            <View key={i} style={styles.tipItem}>
              <View style={styles.tipIconBg}>
                <Ionicons name={item.icon as any} size={20} color={Colors.primary} />
              </View>
              <Text style={styles.tipText}>{item.tip}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── SOS Countdown Modal ── */}
      <Modal visible={showSOSModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.countdownModal}>
            <View style={styles.countdownCircle}>
              <Text style={styles.countdownNum}>{sosCountdown}</Text>
            </View>
            <Text style={styles.countdownTitle}>Calling for Help...</Text>
            <Text style={styles.countdownSub}>
              Contacting your emergency contacts in {sosCountdown} second{sosCountdown !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelSOS}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 24 },

  warningBanner: {
    backgroundColor: Colors.emergencyLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.emergencyBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: 12,
  },
  warningText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.emergency,
    fontWeight: FontWeights.medium,
  },
  warningBold: { fontWeight: FontWeights.heavy },

  // SOS Section
  sosSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    backgroundColor: Colors.emergencyLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.emergencyBorder,
  },
  sosLabel: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.emergency,
    marginBottom: Spacing.xl,
    opacity: 0.8,
  },
  sosRingOuter: {
    width: SOS_BTN_SIZE + 40,
    height: SOS_BTN_SIZE + 40,
    borderRadius: (SOS_BTN_SIZE + 40) / 2,
    backgroundColor: 'rgba(217, 48, 37, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  sosRingMid: {
    width: SOS_BTN_SIZE + 16,
    height: SOS_BTN_SIZE + 16,
    borderRadius: (SOS_BTN_SIZE + 16) / 2,
    backgroundColor: 'rgba(217, 48, 37, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosBtn: {
    width: SOS_BTN_SIZE,
    height: SOS_BTN_SIZE,
    borderRadius: SOS_BTN_SIZE / 2,
    backgroundColor: Colors.emergency,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: Colors.emergency,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  sosBtnText: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.heavy,
    color: '#fff',
    letterSpacing: 4,
  },
  sosBtnSub: {
    fontSize: 11,
    fontWeight: FontWeights.bold,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1,
  },
  sosFootnote: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: '80%',
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    gap: 10,
    backgroundColor: Colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickBtnLabel: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
  },
  quickBtnSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },

  // Section
  section: { paddingHorizontal: Spacing.base, paddingTop: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
  },
  addContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
  },
  addContactText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.primary,
  },

  // Contact card
  contactCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.lg,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.md,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  contactCardPrimary: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: Colors.primaryLight,
  },
  primaryTag: {
    position: 'absolute',
    top: -10,
    left: 16,
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  primaryTagText: {
    fontSize: 11,
    fontWeight: FontWeights.bold,
    color: '#fff',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.heavy,
    color: '#fff',
  },
  contactInfo: { flex: 1 },
  contactName: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  contactRelation: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  contactSlot: {
    fontSize: FontSizes.xs,
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
  },
  callBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnPrimary: { backgroundColor: Colors.primary },

  // Safety tips
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.md,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  tipIconBg: {
    width: 38,
    height: 38,
    borderRadius: Radii.sm,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tipText: {
    flex: 1,
    fontSize: FontSizes.body,
    color: Colors.textPrimary,
    lineHeight: 26,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownModal: {
    backgroundColor: Colors.cardBg,
    borderRadius: 24,
    padding: Spacing.xxl,
    alignItems: 'center',
    width: width * 0.8,
    gap: Spacing.base,
  },
  countdownCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.emergency,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  countdownNum: {
    fontSize: FontSizes.display,
    fontWeight: FontWeights.heavy,
    color: '#fff',
  },
  countdownTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.heavy,
    color: Colors.emergency,
  },
  countdownSub: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  cancelBtn: {
    backgroundColor: Colors.inputBg,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: 14,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
  },
  latestStrip: {
    backgroundColor: Colors.cardBg,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  latestText: {
    color: Colors.textPrimary,
    fontWeight: FontWeights.bold,
  },
  recheckBtn: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
  },
  recheckText: { color: Colors.primary, fontWeight: FontWeights.semibold },
});