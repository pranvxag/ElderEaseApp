import { DailySugarLog } from '@/constants/data';
import { useAuth } from '@/hooks/useAuth';
import { cleanForFirestore, db, hasFirebaseConfig } from '@/lib/firebase';
import { MedicineLogDay } from '@/lib/medicine-logs';
import { formatDateKey, getWeekKey } from '@/lib/week-utils';
import { doc, setDoc } from 'firebase/firestore';
import { useCallback } from 'react';

export type WeeklyReportData = {
  weekKey: string; // "Week 1", "Week 2", etc.
  weekNumber: number; // 1-53
  year: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  generatedAt: string; // ISO timestamp
  lastUpdatedAt: string; // ISO timestamp
  medicines: {
    adherence: number; // 0-100 percentage
    perDay: Array<{
      date: string;
      taken: number;
      missed: number;
    }>;
  };
  sugar: Array<{
    date: string;
    fasting?: { level: number; time?: string };
    postFood?: { level: number; time?: string };
    level?: number; // For call-based readings
    source?: string;
  }>;
};

function profileDocRef(uid: string) {
  return doc(db, 'users', uid);
}

export function useWeeklyReport() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';

  const saveWeeklyReport = useCallback(
    async (data: {
      medicineLogDays: MedicineLogDay[];
      sugarLogs: DailySugarLog[];
      weekStartDate: Date;
      weekEndDate: Date;
    }) => {
      if (!uid || !hasFirebaseConfig) {
        console.warn('❌ Weekly report save skipped', { uid, hasFirebaseConfig });
        return;
      }

      try {
        const now = new Date();
        const weekKey = getWeekKey(now);
        const weekNumber = parseInt(weekKey.match(/\d+/)?.[0] ?? '1', 10);

        // Calculate medicine adherence
        let totalTaken = 0;
        let totalMissed = 0;
        const medicinePerDay = data.medicineLogDays.map((day) => {
          const taken = day.entries.filter((entry) => entry.status === 'taken').length;
          const missed = day.entries.filter((entry) => entry.status === 'not_taken').length;
          totalTaken += taken;
          totalMissed += missed;
          return {
            date: day.date,
            taken,
            missed,
          };
        });

        const adherence = totalTaken + totalMissed > 0
          ? Math.round((totalTaken / (totalTaken + totalMissed)) * 100)
          : 0;

        // Normalize sugar logs - filter out undefined values
        const sugarLogs = data.sugarLogs.map((log) => {
          const entry: any = { date: log.date };
          if (log.fasting !== undefined) entry.fasting = log.fasting;
          if (log.postFood !== undefined) entry.postFood = log.postFood;
          if (log.level !== undefined) entry.level = log.level;
          if (log.source !== undefined) entry.source = log.source;
          return entry;
        });

        const report: WeeklyReportData = {
          weekKey,
          weekNumber,
          year: now.getFullYear(),
          startDate: formatDateKey(data.weekStartDate),
          endDate: formatDateKey(data.weekEndDate),
          generatedAt: now.toISOString(),
          lastUpdatedAt: now.toISOString(),
          medicines: {
            adherence,
            perDay: medicinePerDay,
          },
          sugar: sugarLogs,
        };

        // Clean data before saving to Firestore (removes undefined values)
        const cleanedReport = cleanForFirestore(report);
        
        // Save to Firestore: users/{uid}/weeklyReports/{weekKey}
        const ref = doc(db, 'users', uid, 'weeklyReports', weekKey);
        console.log('📝 Saving report to:', `users/${uid}/weeklyReports/${weekKey}`, { cleanedReport });
        await setDoc(ref, cleanedReport as any, { merge: true });
        console.log(`✅ Saved weekly report: uid=${uid}, week=${weekKey}`);
        return report;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Weekly report save failed for ${uid}:`, errorMsg, error);
        throw error;
      }
    },
    [uid]
  );

  return {
    saveWeeklyReport,
  };
}
