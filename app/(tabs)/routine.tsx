import { MOCK_ROUTINE, RoutineItem } from '@/constants/data';
import { Colors, FontSizes, FontWeights, Radii, Shadows, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const BADGES = [
  { id: '1', emoji: '🌱', label: '3-Day Streak', earned: true },
  { id: '2', emoji: '⭐', label: '7-Day Streak', earned: true },
  { id: '3', emoji: '🏆', label: '14-Day Streak', earned: false },
  { id: '4', emoji: '💎', label: '30-Day Streak', earned: false },
  { id: '5', emoji: '🔥', label: 'On Fire', earned: true },
  { id: '6', emoji: '💊', label: 'Med Perfect', earned: false },
];

const WEEK_DATA = [
  { day: 'Mon', score: 90 },
  { day: 'Tue', score: 75 },
  { day: 'Wed', score: 100 },
  { day: 'Thu', score: 85 },
  { day: 'Fri', score: 60 },
  { day: 'Sat', score: 95 },
  { day: 'Sun', score: 70 },
];

function RoutineCard({
  item,
  onToggle,
  onIncrement,
}: {
  item: RoutineItem;
  onToggle: (id: string) => void;
  onIncrement: (id: string) => void;
}) {
  const hasProgress = item.max > 1;
  const progress = item.current / item.max;
  const progressPct = Math.min(100, Math.round(progress * 100));

  return (
    <View style={[styles.routineCard, item.done && styles.routineCardDone]}>
      <TouchableOpacity
        style={[styles.checkCircle, item.done && { backgroundColor: item.color, borderColor: item.color }]}
        onPress={() => onToggle(item.id)}
        activeOpacity={0.8}
      >
        {item.done && <Ionicons name="checkmark" size={20} color="#fff" />}
      </TouchableOpacity>

      <View style={[styles.routineIcon, { backgroundColor: item.color + '20' }]}>
        <Ionicons name={item.icon as any} size={22} color={item.color} />
      </View>

      <View style={styles.routineInfo}>
        <View style={styles.routineTopRow}>
          <Text style={[styles.routineLabel, item.done && styles.routineLabelDone]}>{item.label}</Text>
          {item.done && (
            <View style={styles.donePill}>
              <Text style={styles.donePillText}>Done!</Text>
            </View>
          )}
        </View>
        <Text style={styles.routineTarget}>{item.target}</Text>

        {hasProgress && (
          <View style={styles.progressRow}>
            <View style={[styles.miniBarBg, { backgroundColor: item.color + '20' }]}>
              <View
                style={[
                  styles.miniBarFill,
                  { width: `${progressPct}%`, backgroundColor: item.color },
                ]}
              />
            </View>
            <Text style={[styles.progressLabel, { color: item.color }]}>
              {item.current}/{item.max} {item.unit}
            </Text>
          </View>
        )}
      </View>

      {hasProgress && !item.done && (
        <TouchableOpacity
          style={[styles.incrBtn, { backgroundColor: item.color + '20' }]}
          onPress={() => onIncrement(item.id)}
        >
          <Ionicons name="add" size={20} color={item.color} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function RoutineScreen() {
  const [items, setItems] = useState<RoutineItem[]>(MOCK_ROUTINE);
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'badges'>('today');

  const doneCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const score = Math.round((doneCount / totalCount) * 100);

  function handleToggle(id: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      )
    );
  }

  function handleIncrement(id: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = Math.min(item.current + 1, item.max);
        return { ...item, current: next, done: next >= item.max };
      })
    );
  }

  function getScoreLabel(): string {
    if (score >= 90) return 'Excellent! 🌟';
    if (score >= 70) return 'Great Job! 👏';
    if (score >= 50) return 'Keep Going! 💪';
    return 'Let\'s Start! 🌱';
  }

  function getScoreColor(): string {
    if (score >= 90) return Colors.success;
    if (score >= 70) return Colors.primary;
    if (score >= 50) return Colors.accent;
    return Colors.warning;
  }

  return (
    <View style={styles.screen}>
      {/* ── Score Header ── */}
      <View style={styles.header}>
        <View style={styles.scoreSection}>
          <View style={styles.scoreCircle}>
            <Text style={[styles.scoreNum, { color: getScoreColor() }]}>{score}</Text>
            <Text style={styles.scoreMax}>/ 100</Text>
          </View>
          <View style={styles.scoreInfo}>
            <Text style={styles.scoreLabel}>{getScoreLabel()}</Text>
            <Text style={styles.scoreSubtitle}>
              {doneCount} of {totalCount} tasks done today
            </Text>
            <View style={styles.scoreProgressBg}>
              <View
                style={[
                  styles.scoreProgressFill,
                  { width: `${score}%`, backgroundColor: getScoreColor() },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Streak */}
        <View style={styles.streakRow}>
          <Ionicons name="flame" size={18} color={Colors.accent} />
          <Text style={styles.streakText}>12 day streak — keep it up!</Text>
        </View>
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabRow}>
        {(['today', 'week', 'badges'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'today' ? '📋 Today' : t === 'week' ? '📊 Weekly' : '🏆 Badges'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* TODAY TAB */}
        {activeTab === 'today' && (
          <View style={styles.padded}>
            {items.map((item) => (
              <RoutineCard
                key={item.id}
                item={item}
                onToggle={handleToggle}
                onIncrement={handleIncrement}
              />
            ))}
          </View>
        )}

        {/* WEEKLY TAB */}
        {activeTab === 'week' && (
          <View style={styles.padded}>
            <Text style={styles.sectionTitle}>This Week's Performance</Text>
            <View style={styles.barChart}>
              {WEEK_DATA.map((d, i) => {
                const isToday = i === new Date().getDay() - 1;
                return (
                  <View key={d.day} style={styles.barCol}>
                    <Text style={styles.barScore}>{d.score}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: `${d.score}%`,
                            backgroundColor: isToday ? Colors.primary : Colors.primaryMid,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barDay, isToday && { color: Colors.primary, fontWeight: FontWeights.bold }]}>
                      {d.day}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.weekSummary}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNum}>82%</Text>
                <Text style={styles.summaryLabel}>Weekly avg</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNum}>5/7</Text>
                <Text style={styles.summaryLabel}>Perfect days</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNum}>12</Text>
                <Text style={styles.summaryLabel}>Day streak</Text>
              </View>
            </View>

            <View style={styles.reportCard}>
              <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
              <Text style={styles.reportText}>
                Your caregiver received your weekly report on Sunday. Keep up the good work!
              </Text>
            </View>
          </View>
        )}

        {/* BADGES TAB */}
        {activeTab === 'badges' && (
          <View style={styles.padded}>
            <Text style={styles.sectionTitle}>Your Achievements</Text>
            <View style={styles.badgesGrid}>
              {BADGES.map((badge) => (
                <View
                  key={badge.id}
                  style={[styles.badgeCard, !badge.earned && styles.badgeCardLocked]}
                >
                  <Text style={[styles.badgeEmoji, !badge.earned && { opacity: 0.3 }]}>
                    {badge.emoji}
                  </Text>
                  <Text style={[styles.badgeLabel, !badge.earned && styles.badgeLabelLocked]}>
                    {badge.label}
                  </Text>
                  {!badge.earned && (
                    <View style={styles.lockOverlay}>
                      <Ionicons name="lock-closed" size={14} color={Colors.textMuted} />
                    </View>
                  )}
                </View>
              ))}
            </View>

            <View style={styles.nextBadgeCard}>
              <Text style={styles.nextBadgeTitle}>🎯 Next Goal</Text>
              <Text style={styles.nextBadgeText}>
                Take all medications for 14 consecutive days to earn the{' '}
                <Text style={{ fontWeight: FontWeights.bold }}>14-Day Streak 🏆</Text> badge!
              </Text>
              <View style={styles.nextBadgeProgress}>
                <View style={[styles.nextBadgeFill, { width: '86%' }]} />
              </View>
              <Text style={styles.nextBadgeCount}>12 of 14 days — 2 more to go!</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },

  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.lg,
  },
  scoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    marginBottom: Spacing.md,
  },
  scoreCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scoreNum: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.heavy,
  },
  scoreMax: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  scoreInfo: { flex: 1 },
  scoreLabel: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.heavy,
    color: '#fff',
    marginBottom: 2,
  },
  scoreSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.primaryMid,
    marginBottom: 8,
  },
  scoreProgressBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreProgressFill: {
    height: '100%',
    borderRadius: 3,
  },

  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radii.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  streakText: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.textSecondary,
  },
  tabTextActive: { color: Colors.primary },

  body: { flex: 1 },
  padded: { padding: Spacing.base },

  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.base,
  },

  // Routine card
  routineCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.lg,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  routineCardDone: {
    borderColor: Colors.primaryLight,
    backgroundColor: Colors.primaryLight,
  },
  checkCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  routineIcon: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  routineInfo: { flex: 1 },
  routineTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  routineLabel: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
  },
  routineLabelDone: { color: Colors.primaryDark },
  donePill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.full,
  },
  donePillText: { color: '#fff', fontSize: 11, fontWeight: FontWeights.bold },
  routineTarget: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniBarFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 12, fontWeight: FontWeights.bold, minWidth: 48 },
  incrBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Bar chart
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.lg,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    height: 160,
    alignItems: 'flex-end',
    ...Shadows.card,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barScore: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  barTrack: {
    width: 22,
    height: 90,
    backgroundColor: Colors.inputBg,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 6,
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
  },
  barDay: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },

  weekSummary: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.lg,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    ...Shadows.card,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.heavy,
    color: Colors.primary,
  },
  summaryLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: Colors.divider,
    alignSelf: 'stretch',
    marginVertical: 4,
  },

  reportCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radii.md,
    padding: Spacing.base,
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.primaryMid,
  },
  reportText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.primaryDark,
    lineHeight: 20,
  },

  // Badges
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  badgeCard: {
    width: '30%',
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
    ...Shadows.card,
    position: 'relative',
  },
  badgeCardLocked: { backgroundColor: Colors.inputBg },
  badgeEmoji: { fontSize: 32 },
  badgeLabel: {
    fontSize: 11,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  badgeLabelLocked: { color: Colors.textMuted },
  lockOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
  },

  nextBadgeCard: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radii.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.accent + '50',
  },
  nextBadgeTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.warning,
    marginBottom: 6,
  },
  nextBadgeText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  nextBadgeProgress: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  nextBadgeFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 4,
  },
  nextBadgeCount: {
    fontSize: FontSizes.sm,
    color: Colors.warning,
    fontWeight: FontWeights.semibold,
  },
});