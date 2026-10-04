import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getDictionary } from '@/i18n/active';

const KEY = '@kandro/reminders:v2';
const LEGACY_KEY = '@kandro/evening-reminder:v1';
const OFFER_KEY = '@kandro/reminder-offer-seen:v1';
const PENDING_KEY = '@kandro/reminder-onboarding:v1';
const DECISION_KEY = '@kandro/reminder-decision:v1';
export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'evening'] as const;
export type MealSlot = typeof MEAL_SLOTS[number];
export type SlotSetting = { enabled: boolean; hour: number; minute: number };
export const DEFAULT_SLOTS: Record<MealSlot, SlotSetting> = {
  breakfast: { enabled: false, hour: 8, minute: 0 },
  lunch: { enabled: true, hour: 12, minute: 30 },
  dinner: { enabled: true, hour: 18, minute: 30 },
  evening: { enabled: false, hour: 20, minute: 30 },
};
const SLOT_IDS: Record<MealSlot, string> = { breakfast: 'kandro-reminder-breakfast', lunch: 'kandro-reminder-lunch', dinner: 'kandro-reminder-dinner', evening: 'kandro-reminder-evening' };
// Meals open the camera (fastest), the end-of-day check opens a description.
const SLOT_MODE: Record<MealSlot, 'photo' | 'description'> = { breakfast: 'photo', lunch: 'photo', dinner: 'photo', evening: 'description' };
export const REMINDER_IDS = ['kandro-meal-reminder', 'kandro-evening-summary', 'kandro-morning-plan', ...Object.values(SLOT_IDS)] as const;
const IDS = REMINDER_IDS;
export const REMINDER_HOUR = 20;
export const REMINDER_MINUTE = 30;
export const MORNING_HOUR = 8;
export const MORNING_MINUTE = 0;
export const remindersSupported = Platform.OS !== 'web';
export type ReminderSettings = { enabled: boolean; hour: number; minute: number; mode: 'daily' | 'legacy' | 'meals'; slots?: Record<MealSlot, SlotSetting> };
function validSlots(slots: unknown): slots is Record<MealSlot, SlotSetting> {
  if (!slots || typeof slots !== 'object') return false;
  return MEAL_SLOTS.every(slot => { const value = (slots as Record<string, SlotSetting>)[slot]; return value && typeof value.enabled === 'boolean' && validReminderTime(value.hour, value.minute); });
}
/** Settings as meal slots; an older single daily time becomes the dinner slot. */
export function reminderSlots(settings: ReminderSettings): Record<MealSlot, SlotSetting> {
  if (settings.mode === 'meals' && settings.slots) return settings.slots;
  if (!settings.enabled) return DEFAULT_SLOTS;
  return { ...DEFAULT_SLOTS, lunch: { ...DEFAULT_SLOTS.lunch, enabled: false }, dinner: { enabled: true, hour: settings.hour, minute: settings.minute } };
}
export type ReminderPermission = 'notDetermined' | 'authorized' | 'quiet' | 'denied' | 'unavailable' | 'error';
export type ReminderOnboardingChoice = 'enabled' | 'skipped';
async function recordDecision(change: { permission?: ReminderPermission; onboarding?: ReminderOnboardingChoice }) {
  const previous = JSON.parse(await AsyncStorage.getItem(DECISION_KEY) ?? '{}');
  await AsyncStorage.setItem(DECISION_KEY, JSON.stringify({ ...previous, ...change }));
}
let onboardingPendingSession: boolean | null = null;
let onboardingRevision = 0;
const onboardingListeners = new Set<() => void>();
function publishOnboardingPending(pending: boolean) {
  onboardingRevision += 1;
  if (onboardingPendingSession === pending) return;
  onboardingPendingSession = pending;
  onboardingListeners.forEach(listener => listener());
}
export const getReminderOnboardingSnapshot = () => onboardingPendingSession;
export function subscribeReminderOnboarding(listener: () => void) {
  onboardingListeners.add(listener);
  return () => { onboardingListeners.delete(listener); };
}
let configured = false;
let generation = 0;
let mutation: Promise<unknown> = Promise.resolve();
let accessAllowed = true;
/** Keep the preference; only scheduled/delivered reminders are paused. */
export function setReminderAccessAllowed(allowed: boolean) {
  accessAllowed = allowed;
  if (!allowed && remindersSupported) void serialize(async () => { await cancelOwn(); }).catch(() => undefined);
}
function serialize<T>(fn: (epoch: number) => Promise<T>) {
  const epoch = generation;
  const next = mutation.then(() => fn(epoch), () => fn(epoch));
  mutation = next.catch(() => undefined);
  return next;
}
const current = (epoch: number) => epoch === generation;

export function configureNotifications() {
  if (!remindersSupported || configured) return;
  configured = true;
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
  applyNotificationChannel();
}
export function applyNotificationChannel() {
  if (Platform.OS !== 'android') return;
  void Notifications.setNotificationChannelAsync('evening-summary', { name: getDictionary().captureExtras.reminderTitle, importance: Notifications.AndroidImportance.DEFAULT, sound: null }).catch(() => undefined);
}
export function permissionState(permission: Notifications.NotificationPermissionsStatus): ReminderPermission {
  const status = permission.ios?.status;
  if (status === Notifications.IosAuthorizationStatus.PROVISIONAL || status === Notifications.IosAuthorizationStatus.EPHEMERAL) return 'quiet';
  if (permission.granted || status === Notifications.IosAuthorizationStatus.AUTHORIZED) return 'authorized';
  if (permission.status === 'denied' || permission.canAskAgain === false || status === Notifications.IosAuthorizationStatus.DENIED) return 'denied';
  return 'notDetermined';
}
export async function getReminderPermission(): Promise<ReminderPermission> {
  if (!remindersSupported) return 'unavailable';
  try { return permissionState(await Notifications.getPermissionsAsync()); }
  catch { return 'error'; }
}
export function validReminderTime(hour: number, minute: number) {
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 && Number.isInteger(minute) && minute >= 0 && minute <= 59;
}
export async function getReminderSettings(): Promise<ReminderSettings> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) {
    const value = JSON.parse(raw) as ReminderSettings;
    if (typeof value.enabled !== 'boolean' || !validReminderTime(value.hour, value.minute) || !['daily', 'legacy', 'meals'].includes(value.mode) || (value.mode === 'meals' && !validSlots(value.slots))) throw new Error('invalid_reminder_settings');
    return value;
  }
  const old = await AsyncStorage.getItem(LEGACY_KEY);
  return { enabled: old === 'true', hour: REMINDER_HOUR, minute: REMINDER_MINUTE, mode: old === 'true' ? 'legacy' : 'daily' };
}
export async function isEveningReminderEnabled() { return remindersSupported && (await getReminderSettings()).enabled; }
export async function hasSeenReminderOffer() { return (await AsyncStorage.getItem(OFFER_KEY)) === 'true'; }
export async function markReminderOfferSeen() { await AsyncStorage.setItem(OFFER_KEY, 'true'); }
export async function prepareReminderOnboarding() { await AsyncStorage.setItem(PENDING_KEY, 'true'); publishOnboardingPending(true); }
export async function isReminderOnboardingPending() {
  if (onboardingPendingSession !== null) return onboardingPendingSession;
  const revision = onboardingRevision;
  // This optional step must not strand navigation after a storage read failure.
  const pending = (await AsyncStorage.getItem(PENDING_KEY).catch(() => null)) === 'true';
  if (revision === onboardingRevision) publishOnboardingPending(pending);
  return onboardingPendingSession ?? pending;
}
export async function finishReminderOnboarding(choice: ReminderOnboardingChoice = 'skipped') {
  // Publish before navigation/persistence: independent path-triggered reads in
  // the screen and root guard could send Today straight back to this screen.
  publishOnboardingPending(false);
  await recordDecision({ onboarding: choice });
  await markReminderOfferSeen();
  await AsyncStorage.removeItem(PENDING_KEY);
}
async function cancelOwn() {
  await Promise.all(IDS.map(async id => {
    await Notifications.cancelScheduledNotificationAsync(id);
    await Notifications.dismissNotificationAsync(id);
  }));
}
async function schedule(settings: ReminderSettings, epoch: number) {
  await cancelOwn();
  if (!current(epoch) || !accessAllowed) return;
  const t = getDictionary().captureExtras;
  const slotBody: Record<MealSlot, string> = { breakfast: t.notifyBreakfast, lunch: t.notifyLunch, dinner: t.notifyDinner, evening: t.notifyEvening };
  const times = settings.mode === 'meals' && settings.slots
    ? MEAL_SLOTS.filter(slot => settings.slots![slot].enabled).map(slot => ({ id: SLOT_IDS[slot], hour: settings.slots![slot].hour, minute: settings.slots![slot].minute, body: slotBody[slot], mode: SLOT_MODE[slot] }))
    : settings.mode === 'legacy'
      ? [{ id: IDS[1], hour: settings.hour, minute: settings.minute, body: t.notificationBody, mode: 'search' }, { id: IDS[2], hour: MORNING_HOUR, minute: MORNING_MINUTE, body: t.notificationBody, mode: 'search' }]
      : [{ id: IDS[0], hour: settings.hour, minute: settings.minute, body: t.notificationBody, mode: 'search' }];
  for (const time of times) {
    if (!current(epoch) || !accessAllowed) return;
    await Notifications.scheduleNotificationAsync({ identifier: time.id, content: { title: t.notificationTitle, body: time.body, data: { route: '/capture', mode: time.mode } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: time.hour, minute: time.minute, ...(Platform.OS === 'android' ? { channelId: 'evening-summary' } : {}) } });
  }
}
/** Only an explicit user action may ask the OS. No network or push token. */
export function updateReminder(settings: ReminderSettings): Promise<{ enabled: boolean; permission: ReminderPermission }> {
  if (!validReminderTime(settings.hour, settings.minute) || (settings.mode === 'meals' && !validSlots(settings.slots))) return Promise.reject(new Error('invalid_reminder_time'));
  return serialize(async epoch => {
    if (!remindersSupported) return { enabled: false, permission: 'unavailable' };
    configureNotifications();
    if (!current(epoch)) return { enabled: false, permission: 'unavailable' };
    let permission: ReminderPermission = settings.enabled ? await getReminderPermission() : 'authorized';
    if (settings.enabled && permission === 'notDetermined') {
      try { permission = permissionState(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: false, allowBadge: false } })); }
      catch { permission = 'error'; }
    }
    if (!current(epoch)) return { enabled: false, permission: 'unavailable' };
    if (settings.enabled) await recordDecision({ permission });
    if (permission === 'error') return { enabled: false, permission };
    const anySlot = settings.mode !== 'meals' || MEAL_SLOTS.some(slot => settings.slots![slot].enabled);
    const enabled = settings.enabled && anySlot && (permission === 'authorized' || permission === 'quiet');
    if (enabled) await schedule(settings, epoch); else await cancelOwn();
    if (!current(epoch)) return { enabled: false, permission: 'unavailable' };
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...settings, enabled }));
    await markReminderOfferSeen();
    return { enabled, permission };
  });
}
export async function setEveningReminderEnabled(enabled: boolean, _targets?: { calories: number; protein: number }): Promise<boolean> {
  return (await updateReminder({ ...await getReminderSettings(), enabled })).enabled;
}
/** Permission changes do not erase the user's choice or re-prompt. */
export function syncEveningReminder(_targets?: { calories: number; protein: number }) {
  return serialize(async epoch => {
    if (!remindersSupported) return;
    configureNotifications();
    const settings = await getReminderSettings();
    const permission = await getReminderPermission();
    if (!current(epoch)) return;
    if (settings.enabled && ['authorized', 'quiet'].includes(permission)) await schedule(settings, epoch);
    else await cancelOwn();
  });
}
const TRIAL_ID = 'kandro-trial-ending';
/**
 * The paywall timeline promises a reminder before a StoreKit trial renews.
 * Scheduled only after a completed trial purchase; asking the OS here is the
 * user's own follow-up to that promise. Returns whether it was scheduled.
 */
export async function scheduleTrialEndingReminder(trialDays: number, price: string) {
  if (!remindersSupported || !Number.isInteger(trialDays) || trialDays < 3) return false;
  try {
    configureNotifications();
    let permission = await getReminderPermission();
    if (permission === 'notDetermined') permission = permissionState(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: false, allowBadge: false } }));
    if (permission !== 'authorized' && permission !== 'quiet') return false;
    const t = getDictionary().paywall;
    await Notifications.cancelScheduledNotificationAsync(TRIAL_ID);
    await Notifications.scheduleNotificationAsync({ identifier: TRIAL_ID, content: { title: t.trialReminderTitle, body: t.trialReminderBody(price) }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + (trialDays - TRIAL_REMINDER_LEAD_DAYS) * 86_400_000), ...(Platform.OS === 'android' ? { channelId: 'evening-summary' } : {}) } });
    return true;
  } catch { return false; }
}
export const TRIAL_REMINDER_LEAD_DAYS = 2;
export function clearRemindersAfterAccountDeletion() {
  generation += 1;
  publishOnboardingPending(false);
  return serialize(async () => {
    if (remindersSupported) { await cancelOwn(); await Notifications.cancelScheduledNotificationAsync(TRIAL_ID).catch(() => undefined); }
    await AsyncStorage.multiRemove([KEY, LEGACY_KEY, OFFER_KEY, PENDING_KEY, DECISION_KEY]);
  });
}
export const clearRemindersForAccountSwitch = clearRemindersAfterAccountDeletion;
