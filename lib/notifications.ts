import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Medication } from '../constants/data';

const TIME_LABEL_TO_REMINDER: Record<string, string> = {
  'Morning (6–9 AM)': '8:00 AM',
  'Mid-morning (9–12 PM)': '10:00 AM',
  'Afternoon (12–3 PM)': '1:00 PM',
  'Evening (3–6 PM)': '5:00 PM',
  'Night (6–9 PM)': '8:00 PM',
  'Bedtime (9 PM+)': '9:00 PM',
};

// ── How notifications appear when app is in foreground ──────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Request permission from the user ────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    console.warn('Local push reminders are not supported on web.');
    return false;
  }

  if (!Device.isDevice) {
    console.warn('Push notifications only work on a physical device.');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Notification permission not granted.');
    return false;
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('medication-reminders', {
      name: 'Medication Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1A7A6E',
      sound: 'default',
    });
  }

  return true;
}

// ── Parse "9:00 AM" → { hour: 9, minute: 0 } ────────────────────────────────
function parseTime(timeStr: string): { hour: number; minute: number } | null {
  const normalizedTime = TIME_LABEL_TO_REMINDER[timeStr] ?? timeStr;
  const match = normalizedTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();

  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  return { hour, minute };
}

// ── Schedule a daily repeating reminder for one medication ──────────────────
export async function scheduleMedicationReminder(med: Medication): Promise<string | null> {
  if (Platform.OS === 'web') {
    console.warn('Medication reminders are not supported on web.');
    return null;
  }

  const time = parseTime(med.time);
  if (!time) {
    console.warn(`Could not parse time for medication: ${med.name} (${med.time})`);
    return null;
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `💊 Time for ${med.name}`,
      body: `${med.dosage} — ${med.purpose}`,
      data: { medicationId: med.id },
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId: 'medication-reminders' }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: time.hour,
      minute: time.minute,
    },
  });

  return notificationId;
}

// ── Cancel a scheduled notification by its ID ────────────────────────────────
export async function cancelMedicationReminder(notificationId: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

// ── Schedule reminders for ALL medications ───────────────────────────────────
// Returns a map of { medicationId → notificationId }
export async function scheduleAllReminders(
  medications: Medication[]
): Promise<Record<string, string>> {
  const mapping: Record<string, string> = {};

  for (const med of medications) {
    const notifId = await scheduleMedicationReminder(med);
    if (notifId) {
      mapping[med.id] = notifId;
    }
  }

  return mapping;
}

// ── Cancel ALL scheduled notifications (e.g. on logout / reset) ─────────────

export async function cancelAllReminders(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ── Send an immediate "streak at risk" nudge ────────────────────────────────
export async function sendStreakReminderNow(missedMedName: string): Promise<void> {
  if (Platform.OS === 'web') {
    console.warn('Immediate reminders are not supported on web.');
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "⚠️ Don't break your streak!",
      body: `You haven't taken ${missedMedName} yet today.`,
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId: 'medication-reminders' }),
    },
    trigger: null, // fires immediately
  });
}

// ── Send an immediate alert for abnormal blood sugar readings ───────────────
export async function sendBloodSugarAlert(payload: {
  value: number;
  unit?: string;
  timestamp?: string;
}): Promise<void> {
  if (Platform.OS === 'web') {
    console.warn('Blood sugar alerts not supported on web.');
    return;
  }

  const { value, unit } = payload;
  let title = `Blood sugar: ${value}${unit ? ` ${unit}` : ''}`;
  let body = '';

  if (value < 70) {
    title = 'Low blood sugar';
    body = `Reading ${value}${unit ? ` ${unit}` : ''}. Consider glucose or medical help.`;
  } else if (value >= 180) {
    title = 'High blood sugar';
    body = `Reading ${value}${unit ? ` ${unit}` : ''}. Consider contacting a provider.`;
  } else {
    // no alert for normal ranges
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: 'medication-reminders' }),
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('Failed to send blood sugar alert', err);
  }
}
