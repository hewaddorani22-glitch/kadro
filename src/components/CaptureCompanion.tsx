import { useEffect, useRef, useState } from 'react';
import { AppState, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { usePathname, useRouter } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/i18n/LanguageProvider';
import { useLocalDay } from '@/hooks/useLocalDay';
import { subscribeSuccessfulMealCreates } from '@/services/syncRepository';
import { getLocalDataGeneration, subscribePrivateDataInvalidation } from '@/services/localRepository';
import { clearReviewUsage, recordSuccessfulMeal, requestReviewAfterReturn } from '@/services/reviewRequest';
import { clearWidgetSharing, publishWidgetSnapshot, subscribeWidgetSharing } from '@/services/widgetSnapshot';
import { usePresentationIdle } from '@/services/presentation';
import { clearCaptureIntent, getScanInputDraft, invalidateScanInputState, pendingCaptureIntent, pendingPlanIntent, queueCaptureIntent, queuePlanIntent, reminderIntent, subscribeCaptureIntent, takePlanIntent } from '@/services/captureIntents';
import { configureNotifications, isReminderOnboardingPending, remindersSupported } from '@/services/reminders';
const RESPONSE_KEY = '@kandro/last-reminder-response:v1';
export function CaptureCompanion() {
  const app = useApp(); const { language, ready } = useLanguage(); const day = useLocalDay();
  const path = usePathname(); const router = useRouter(); const idle = usePresentationIdle();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [keyboard, setKeyboard] = useState(false); const [revision, setRevision] = useState(0);
  const suspended = useRef(false); const previousPath = useRef(path); const returnedToToday = useRef(false);
  const allowed = app.hydrationReady && app.wellnessConsentGranted && !!app.profile.completedAt && ready;
  const unfinishedCapture = !!getScanInputDraft() || (!app.isCurrentScanLogged && (app.analysisStatus !== 'idle' || !!app.photoUri || !!app.descriptionInput));
  const quiet = allowed && foreground && !keyboard && idle && path.endsWith('/today') && !app.analysisError && !unfinishedCapture && !pendingCaptureIntent();
  const quietRef = useRef(quiet); quietRef.current = quiet;
  useEffect(() => {
    const a = AppState.addEventListener('change', value => { setForeground(value === 'active'); if (value === 'active') setRevision(n => n + 1); });
    const b = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const c = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { a.remove(); b.remove(); c.remove(); };
  }, []);
  useEffect(() => {
    const removeSave = subscribeSuccessfulMealCreates(event => { void recordSuccessfulMeal(event.id, event.source, event.generation).catch(() => undefined); });
    const removePrivacy = subscribePrivateDataInvalidation(async () => {
      suspended.current = true; returnedToToday.current = false;
      clearCaptureIntent(); invalidateScanInputState();
      // Native file invalidation happens synchronously before either promise.
      await Promise.all([clearWidgetSharing(), clearReviewUsage()]);
    });
    const refresh = () => setRevision(n => n + 1);
    const removeWidget = subscribeWidgetSharing(refresh); const removeIntent = subscribeCaptureIntent(refresh);
    return () => { removeSave(); removePrivacy(); removeWidget(); removeIntent(); };
  }, []);
  useEffect(() => { if (!allowed) suspended.current = false; }, [allowed]);
  useEffect(() => {
    if (!allowed || !foreground || suspended.current) return;
    void publishWidgetSnapshot({ consumed: app.consumed, targets: app.targets, language, day }, getLocalDataGeneration()).catch(() => undefined);
  }, [allowed, foreground, app.consumed, app.targets, language, day, revision]);
  useEffect(() => {
    if (!remindersSupported) return;
    configureNotifications();
    let active = true; let chain = Promise.resolve();
    const receive = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      chain = chain.then(async () => {
        const parsed = reminderIntent(response);
        if (!parsed || !active || (await AsyncStorage.getItem(RESPONSE_KEY)) === parsed.key) return;
        await AsyncStorage.setItem(RESPONSE_KEY, parsed.key);
        if (!active) return;
        if ('plan' in parsed) queuePlanIntent(); else queueCaptureIntent(parsed.mode);
        await Notifications.clearLastNotificationResponseAsync();
      }).catch(() => undefined);
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(receive);
    void Notifications.getLastNotificationResponseAsync().then(receive).catch(() => undefined);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!allowed || !foreground || !pendingCaptureIntent() || ['/capture', '/paywall', '/account-help', '/access-setup', '/onboarding', '/reminder-setup', '/data-consent'].includes(path)) return;
    let active = true;
    void isReminderOnboardingPending().then(pending => { if (active && !pending && pendingCaptureIntent()) { Keyboard.dismiss(); router.push('/capture'); } }).catch(() => undefined);
    return () => { active = false; };
  }, [allowed, foreground, path, revision, router]);
  useEffect(() => {
    if (!allowed || !foreground || !pendingPlanIntent() || ['/capture', '/paywall', '/account-help', '/access-setup', '/onboarding', '/reminder-setup', '/data-consent'].includes(path)) return;
    let active = true;
    void isReminderOnboardingPending().then(pending => { if (active && !pending && takePlanIntent()) { Keyboard.dismiss(); router.navigate('/(tabs)/plan'); } }).catch(() => undefined);
    return () => { active = false; };
  }, [allowed, foreground, path, revision, router]);
  useEffect(() => {
    if (path.endsWith('/today') && previousPath.current !== path && !['/', '/onboarding', '/reminder-setup', '/data-consent'].includes(previousPath.current)) returnedToToday.current = true;
    if (!path.endsWith('/today')) returnedToToday.current = false;
    previousPath.current = path;
  }, [path]);
  useEffect(() => {
    if (!quiet || !returnedToToday.current) return;
    const timer = setTimeout(() => { void requestReviewAfterReturn(() => quietRef.current && returnedToToday.current).catch(() => undefined); }, 2000);
    return () => clearTimeout(timer);
  }, [quiet, path, revision]);
  return null;
}
