// import { HEALTH_TIPS, MOCK_MEDICATIONS, MOCK_ROUTINE } from '@/constants/data';
import { HEALTH_TIPS, MOCK_MEDICATIONS, MOCK_ROUTINE } from '../../constants/data';
// import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '../../constants/theme';

const { width } = Dimensions.get('window');

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getTodayString(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function HomeScreen() {
  const greeting = getGreeting();
  const todayStr = getTodayString();
  console.log("HEALTH_TIPS:", HEALTH_TIPS);
  // const tip = HEALTH_TIPS[Math.floor(Math.random() * HEALTH_TIPS.length)];
  const tip = Array.isArray(HEALTH_TIPS) && HEALTH_TIPS.length > 0
  ? HEALTH_TIPS[Math.floor(Math.random() * HEALTH_TIPS.length)]
  : {
      tip: "Stay hydrated and take your medicines on time.",
      category: "General",
      icon: "heart",
      color: Colors.primary,
    };

  const takenCount = MOCK_MEDICATIONS.filter((m) => m.status === 'taken').length;
  const totalMeds = MOCK_MEDICATIONS.length;
  const routineDone = MOCK_ROUTINE.filter((r) => r.done).length;
  const totalRoutine = MOCK_ROUTINE.length;
  const routinePercent = Math.round((routineDone / totalRoutine) * 100);

  const upcomingMeds = MOCK_MEDICATIONS.filter((m) => m.status === 'upcoming');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── Greeting Banner ── */}
      <View style={styles.banner}>
        <View style={styles.bannerLeft}>
          <Text style={styles.greeting}>{greeting}! 🌟</Text>
          <Text style={styles.userName}>Mr. Singh</Text>
          <Text style={styles.date}>{todayStr}</Text>
        </View>
        <View style={styles.bannerRight}>
          <View style={styles.streakBadge}>
            <Text style={styles.streakFire}>🔥</Text>
            <Text style={styles.streakNum}>12</Text>
            <Text style={styles.streakLabel}>day streak</Text>
          </View>
        </View>
      </View>

      {/* ── Quick Stats Row ── */}
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(tabs)/medications')}>
          <View style={[styles.statIcon, { backgroundColor: Colors.primaryLight }]}>
            <Ionicons name="medical" size={22} color={Colors.primary} />
          </View>
          <Text style={styles.statNum}>
            {takenCount}/{totalMeds}
          </Text>
          <Text style={styles.statLabel}>Medicines{'\n'}Today</Text>
          <View style={[styles.statBar, { backgroundColor: Colors.border }]}>
            <View
              style={[
                styles.statBarFill,
                { width: `${(takenCount / totalMeds) * 100}%`, backgroundColor: Colors.primary },
              ]}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(tabs)/routine')}>
          <View style={[styles.statIcon, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="checkmark-circle" size={22} color="#2E7D32" />
          </View>
          <Text style={styles.statNum}>{routinePercent}%</Text>
          <Text style={styles.statLabel}>Routine{'\n'}Done</Text>
          <View style={[styles.statBar, { backgroundColor: Colors.border }]}>
            <View
              style={[
                styles.statBarFill,
                { width: `${routinePercent}%`, backgroundColor: '#2E7D32' },
              ]}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(tabs)/emergency')}>
          <View style={[styles.statIcon, { backgroundColor: Colors.emergencyLight }]}>
            <Ionicons name="heart" size={22} color={Colors.emergency} />
          </View>
          <Text style={[styles.statNum, { color: Colors.emergency }]}>SOS</Text>
          <Text style={styles.statLabel}>Emergency{'\n'}Button</Text>
          <View style={[styles.sosIndicator]}>
            <View style={styles.sosDot} />
            <Text style={styles.sosText}>Ready</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Upcoming Medicines ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Medicines</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/medications')}>
            <Text style={styles.sectionLink}>See all →</Text>
          </TouchableOpacity>
        </View>

        {upcomingMeds.length === 0 ? (
          <View style={styles.allDoneCard}>
            <Text style={styles.allDoneIcon}>🎉</Text>
            <Text style={styles.allDoneText}>All medicines taken today!</Text>
            <Text style={styles.allDoneSub}>Great job keeping up your streak.</Text>
          </View>
        ) : (
          upcomingMeds.map((med) => (
            <View key={med.id} style={styles.upcomingCard}>
              <View style={[styles.pillDot, { backgroundColor: med.color }]} />
              <View style={styles.upcomingInfo}>
                <Text style={styles.upcomingName}>{med.name}</Text>
                <Text style={styles.upcomingDose}>{med.dosage}</Text>
              </View>
              <View style={styles.upcomingRight}>
                <Text style={styles.upcomingTime}>{med.time}</Text>
                <View style={styles.upcomingBadge}>
                  <Text style={styles.upcomingBadgeText}>Upcoming</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {/* ── Today's Routine Snapshot ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Routine</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/routine')}>
            <Text style={styles.sectionLink}>View all →</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.routineSnap}>
          {MOCK_ROUTINE.slice(0, 4).map((item) => (
            <View key={item.id} style={styles.routineSnapItem}>
              <View
                style={[
                  styles.routineSnapIcon,
                  { backgroundColor: item.done ? item.color + '20' : Colors.inputBg },
                ]}
              >
                <Ionicons
                  name={(item.icon + (item.done ? '' : '-outline')) as any}
                  size={20}
                  color={item.done ? item.color : Colors.textMuted}
                />
                {item.done && (
                  <View style={styles.doneCheck}>
                    <Ionicons name="checkmark" size={10} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={[styles.routineSnapLabel, item.done && { color: item.color }]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Daily Health Tip ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Health Tip</Text>
        <View style={[styles.tipCard, { borderLeftColor: tip.color }]}>
          <View style={[styles.tipIconBg, { backgroundColor: tip.color + '20' }]}>
            <Ionicons name={tip.icon as any} size={24} color={tip.color} />
          </View>
          <View style={styles.tipContent}>
            <Text style={[styles.tipCategory, { color: tip.color }]}>{tip.category}</Text>
            <Text style={styles.tipText}>{tip.tip}</Text>
          </View>
        </View>
      </View>

      {/* ── Emergency Quick Button ── */}
      <TouchableOpacity
        style={styles.emergencyBanner}
        activeOpacity={0.85}
        onPress={() => router.push('/(tabs)/emergency')}
      >
        <Ionicons name="alert-circle" size={28} color="#fff" />
        <View style={styles.emergencyBannerText}>
          <Text style={styles.emergencyBannerTitle}>Need Help?</Text>
          <Text style={styles.emergencyBannerSub}>Tap to call your emergency contact instantly</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#fff" />
      </TouchableOpacity>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 24,
  },

  // Banner
  banner: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl + 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  bannerLeft: { flex: 1 },
  greeting: {
    fontSize: FontSizes.md,
    color: Colors.primaryMid,
    fontWeight: FontWeights.medium,
    marginBottom: 2,
  },
  userName: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.heavy,
    color: Colors.textOnPrimary,
    marginBottom: 4,
  },
  date: {
    fontSize: FontSizes.sm,
    color: Colors.primaryMid,
    fontWeight: FontWeights.regular,
  },
  bannerRight: { alignItems: 'center' },
  streakBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    alignItems: 'center',
    minWidth: 72,
  },
  streakFire: { fontSize: 24 },
  streakNum: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.heavy,
    color: '#fff',
  },
  streakLabel: {
    fontSize: FontSizes.xs,
    color: Colors.primaryMid,
    fontWeight: FontWeights.medium,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    gap: 10,
    marginTop: -Spacing.lg,
    marginBottom: Spacing.base,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.card,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  statNum: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.heavy,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginVertical: 4,
    fontWeight: FontWeights.medium,
  },
  statBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  statBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  sosIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  sosDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
  },
  sosText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: FontWeights.semibold,
  },

  // Section
  section: {
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
  },
  sectionLink: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
  },

  // All done
  allDoneCard: {
    backgroundColor: Colors.successLight,
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  allDoneIcon: { fontSize: 36, marginBottom: 8 },
  allDoneText: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.success,
    marginBottom: 4,
  },
  allDoneSub: {
    fontSize: FontSizes.md,
    color: Colors.success,
    opacity: 0.8,
  },

  // Upcoming card
  upcomingCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.lg,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    ...Shadows.card,
  },
  pillDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: Spacing.md,
    flexShrink: 0,
  },
  upcomingInfo: { flex: 1 },
  upcomingName: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  upcomingDose: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  upcomingRight: { alignItems: 'flex-end' },
  upcomingTime: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
    marginBottom: 4,
  },
  upcomingBadge: {
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.accent + '50',
  },
  upcomingBadgeText: {
    fontSize: 11,
    fontWeight: FontWeights.semibold,
    color: Colors.warning,
  },

  // Routine snap
  routineSnap: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.lg,
    padding: Spacing.base,
    justifyContent: 'space-around',
    ...Shadows.card,
  },
  routineSnapItem: { alignItems: 'center', gap: 6 },
  routineSnapIcon: {
    width: 48,
    height: 48,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  doneCheck: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routineSnapLabel: {
    fontSize: 11,
    fontWeight: FontWeights.semibold,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Health tip
  tipCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.lg,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    borderLeftWidth: 4,
    ...Shadows.card,
  },
  tipIconBg: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tipContent: { flex: 1 },
  tipCategory: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tipText: {
    fontSize: FontSizes.body,
    color: Colors.textPrimary,
    lineHeight: 26,
    fontWeight: FontWeights.regular,
  },

  // Emergency banner
  emergencyBanner: {
    marginHorizontal: Spacing.base,
    backgroundColor: Colors.emergency,
    borderRadius: Radii.xl,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.strong,
  },
  emergencyBannerText: { flex: 1 },
  emergencyBannerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: '#fff',
    marginBottom: 2,
  },
  emergencyBannerSub: {
    fontSize: FontSizes.sm,
    color: 'rgba(255,255,255,0.85)',
  },
});