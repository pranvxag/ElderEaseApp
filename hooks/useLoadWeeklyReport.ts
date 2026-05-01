/**
 * Hook to load weekly reports from Firestore with fallback to blank data.
 * Ensures every user always has a week structure, even if they haven't logged anything yet.
 */
import { useAuth } from '@/hooks/useAuth';
import { WeeklyReportData } from '@/hooks/useWeeklyReport';
import { db, hasFirebaseConfig } from '@/lib/firebase';
import { formatDateKey, getWeekEndDate, getWeekKey, getWeekStartDate } from '@/lib/week-utils';
import { doc, getDoc } from 'firebase/firestore';
import { useCallback, useState } from 'react';

export interface WeeklyReportWithStatus {
  exists: boolean; // Whether report exists in Firestore
  data: WeeklyReportData;
}

/**
 * Create blank weekly report data structure for a user with no data
 */
function createBlankWeeklyReport(): WeeklyReportData {
  const now = new Date();
  const weekKey = getWeekKey(now);
  const weekNumber = parseInt(weekKey.match(/\d+/)?.[0] ?? '1', 10);
  const weekStart = getWeekStartDate();
  const weekEnd = getWeekEndDate();

  return {
    weekKey,
    weekNumber,
    year: now.getFullYear(),
    startDate: formatDateKey(weekStart),
    endDate: formatDateKey(weekEnd),
    generatedAt: now.toISOString(),
    lastUpdatedAt: now.toISOString(),
    medicines: {
      adherence: 0,
      perDay: [],
    },
    sugar: [],
  };
}

export function useLoadWeeklyReport() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const [loading, setLoading] = useState(false);

  const loadWeeklyReport = useCallback(async (): Promise<WeeklyReportWithStatus> => {
    if (!uid || !hasFirebaseConfig) {
      // Return blank data if no user or Firebase config
      return {
        exists: false,
        data: createBlankWeeklyReport(),
      };
    }

    setLoading(true);
    try {
      const weekKey = getWeekKey();
      const ref = doc(db, 'users', uid, 'weeklyReports', weekKey);
      const snapshot = await getDoc(ref);

      if (snapshot.exists()) {
        // Report exists in Firestore
        const data = snapshot.data() as WeeklyReportData;
        console.log(`Loaded weekly report from Firestore: uid=${uid}, week=${weekKey}`);
        return {
          exists: true,
          data,
        };
      } else {
        // Report doesn't exist, return blank data
        console.log(`Weekly report not found for user: uid=${uid}, week=${weekKey}. Using blank data.`);
        return {
          exists: false,
          data: createBlankWeeklyReport(),
        };
      }
    } catch (error) {
      console.error('Failed to load weekly report:', error);
      // On error, return blank data
      return {
        exists: false,
        data: createBlankWeeklyReport(),
      };
    } finally {
      setLoading(false);
    }
  }, [uid]);

  return { loadWeeklyReport, loading };
}
