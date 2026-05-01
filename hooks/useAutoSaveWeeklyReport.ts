/**
 * Hook to save weekly reports automatically when medicines or health data changes.
 * This integrates weekly report generation with the health data update flow.
 * Reports are always saved, even with blank data for new users.
 */
import { DailySugarLog } from '@/constants/data';
import { useAuth } from '@/hooks/useAuth';
import { useWeeklyReport } from '@/hooks/useWeeklyReport';
import { db, hasFirebaseConfig } from '@/lib/firebase';
import { getRecentMedicineLogDates, getRecentMedicineLogs } from '@/lib/medicine-logs';
import { getWeekEndDate, getWeekStartDate } from '@/lib/week-utils';
import { doc, getDoc } from 'firebase/firestore';
import { useCallback } from 'react';

async function getRecentSugarLogs(uid: string, days = 7): Promise<DailySugarLog[]> {
  if (!hasFirebaseConfig || !uid) return [];
  const dateKeys = getRecentMedicineLogDates(days);
  const logs = await Promise.all(
    dateKeys.map(async (dateKey) => {
      const ref = doc(db, 'users', uid, 'sugarlogs', dateKey);
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) {
        return { date: dateKey } as DailySugarLog;
      }
      const data = snapshot.data() as DailySugarLog;
      return {
        date: dateKey,
        fasting: data?.fasting,
        postFood: data?.postFood,
        level: data?.level,
        source: data?.source,
        timestamp: data?.timestamp,
      } as DailySugarLog;
    })
  );
  return logs;
}

export function useAutoSaveWeeklyReport() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const { saveWeeklyReport } = useWeeklyReport();

  const autoSaveAfterUpdate = useCallback(async () => {
    if (!uid) {
      console.log('⏳ No uid available for auto-save');
      return;
    }

    try {
      console.log('💾 Auto-saving weekly report after update...');
      const [meds, sugars] = await Promise.all([
        getRecentMedicineLogs(uid, 7),
        getRecentSugarLogs(uid, 7),
      ]);
      console.log('📊 Fetched data for auto-save:', { medsCount: meds.length, sugarsCount: sugars.length });

      // Always save, even if meds/sugars are empty (blank data for new users)
      const weekStart = getWeekStartDate();
      const weekEnd = getWeekEndDate();
      await saveWeeklyReport({
        medicineLogDays: meds,
        sugarLogs: sugars,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
      });
      console.log('✅ Auto-save weekly report completed');
    } catch (err) {
      console.error('❌ Auto-save weekly report failed:', err instanceof Error ? err.message : String(err));
    }
  }, [uid, saveWeeklyReport]);

  return { autoSaveAfterUpdate };
}
