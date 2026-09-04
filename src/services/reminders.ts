import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getDictionary, getLocale } from '@/i18n/active';

const REMINDER_KEY = '@kandro/evening-reminder:v1';
const OFFER_SEEN_KEY = '@kandro/reminder-offer-seen:v1';
const IDENTIFIER = 'kandro-evening-summary';
const MORNING_IDENTIFIER = 'kandro-morning-plan';

export const REMINDER_HOUR = 20;
export const REMINDER_MINUTE = 30;
export const MORNING_HOUR = 8;
export const MORNING_MINUTE = 0;

/** Local notifications only. Kandro never registers for remote push. */
export const remindersSupported = Platform.OS !== 'web';

let handlerConfigured = false;

export function configureNotifications() {
  if (!remindersSupported || handlerConfigured) return;
  handlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  applyNotificationChannel();
}

/**
 * The Android channel name is what a user sees in system settings, and it was
 * hard-coded German for everyone. Setting the channel again under the same id
 * updates it, so this runs once at boot and again whenever the language
 * changes: the language is only known a render after the first call.
 */
export function applyNotificationChannel() {
  if (!remindersSupported || Platform.OS !== 'android') return;
  void Notifications.setNotificationChannelAsync('evening-summary', {
    name: getDictionary().today.eveningTitle,
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    vibrationPattern: [0, 180],
    enableVibrate: true,
  }).catch(() => undefined);
}

export async function isEveningReminderEnabled() {
  if (!remindersSupported) return false;
  return (await AsyncStorage.getItem(REMINDER_KEY)) === 'true';
}

/**
 * Whether the one-time offer has already been shown.
 *
 * The reminder is the only mechanism that brings anyone back, and it used to be
 * reachable only from a screen that appears after 18:00. Offering it once, right
 * after the first meal lands, is the difference between a feature that exists
 * and one that gets used. Asked once, never again.
 */
export async function hasSeenReminderOffer() {
  if (!remindersSupported) return true;
  return (await AsyncStorage.getItem(OFFER_SEEN_KEY)) === 'true';
}

export async function markReminderOfferSeen() {
  await AsyncStorage.setItem(OFFER_SEEN_KEY, 'true');
}

async function scheduleEveningReminder() {
  // Read the dictionary at scheduling time: the notification is written once
  // and fires days later, so it has to carry the language chosen back then.
  const t = getDictionary();
  await Notifications.cancelScheduledNotificationAsync(IDENTIFIER).catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    identifier: IDENTIFIER,
    content: {
      title: t.evening.notificationTitle,
      // No streaks, no guilt, no numbers the user has not seen yet.
      body: t.evening.notificationBody,
      data: { route: '/evening' },
      ...(Platform.OS === 'android' ? { channelId: 'evening-summary' } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
    },
  });
}

/**
 * Morning message carrying the day's actual targets.
 *
 * A repeating notification has fixed content, so it is rescheduled whenever the
 * targets change. That keeps "Heute: ~2.320 kcal" true instead of drifting away
 * from the plan it describes.
 */
async function scheduleMorningReminder(calories: number, protein: number) {
  const t = getDictionary();
  await Notifications.cancelScheduledNotificationAsync(MORNING_IDENTIFIER).catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    identifier: MORNING_IDENTIFIER,
    content: {
      title: t.evening.morningTitle,
      // The locale has to follow the language too: a hardcoded de-DE turns
      // 1950 into "1.950" on an English phone.
      body: t.evening.morningBody(
        new Intl.NumberFormat(getLocale()).format(calories),
        protein,
        Math.round((protein * 0.22) / 5) * 5,
      ),
      data: { route: '/(tabs)/today' },
      ...(Platform.OS === 'android' ? { channelId: 'evening-summary' } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: MORNING_HOUR,
      minute: MORNING_MINUTE,
    },
  });
}

/**
 * Turns the daily summary reminder on or off and returns the state that
 * actually applies. Asking for it without permission returns false rather than
 * pretending it worked.
 */
export async function setEveningReminderEnabled(
  enabled: boolean,
  targets?: { calories: number; protein: number },
): Promise<boolean> {
  if (!remindersSupported) return false;
  configureNotifications();
  await markReminderOfferSeen();

  if (!enabled) {
    await Promise.all([
      Notifications.cancelScheduledNotificationAsync(IDENTIFIER).catch(() => undefined),
      Notifications.cancelScheduledNotificationAsync(MORNING_IDENTIFIER).catch(() => undefined),
    ]);
    await AsyncStorage.setItem(REMINDER_KEY, 'false');
    return false;
  }

  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted
    ? true
    : (await Notifications.requestPermissionsAsync()).granted;

  if (!granted) {
    await AsyncStorage.setItem(REMINDER_KEY, 'false');
    return false;
  }

  await scheduleEveningReminder();
  if (targets) await scheduleMorningReminder(targets.calories, targets.protein).catch(() => undefined);
  await AsyncStorage.setItem(REMINDER_KEY, 'true');
  return true;
}

/**
 * Re-arms the reminder on launch. Scheduled notifications survive restarts, but
 * not a reinstall or a revoked permission, so the stored preference is the
 * source of truth.
 */
export async function syncEveningReminder(targets?: { calories: number; protein: number }) {
  if (!remindersSupported) return;
  configureNotifications();
  if (!(await isEveningReminderEnabled())) return;

  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    await AsyncStorage.setItem(REMINDER_KEY, 'false');
    return;
  }
  await scheduleEveningReminder().catch(() => undefined);
  if (targets) await scheduleMorningReminder(targets.calories, targets.protein).catch(() => undefined);
}

export async function clearRemindersAfterAccountDeletion() {
  if (!remindersSupported) return;
  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(IDENTIFIER).catch(() => undefined),
    Notifications.cancelScheduledNotificationAsync(MORNING_IDENTIFIER).catch(() => undefined),
  ]);
  await AsyncStorage.multiRemove([REMINDER_KEY, OFFER_SEEN_KEY]);
}

/** Account-scoped reminder choices must not cross into a restored account. */
export const clearRemindersForAccountSwitch = clearRemindersAfterAccountDeletion;
