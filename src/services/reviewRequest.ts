import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { getLocalDataGeneration } from '@/services/localRepository';
import { localDateKey } from '@/utils/date';
import { presentationIsIdle, holdPresentation } from '@/services/presentation';
import { recordReviewUsage, reviewEligible, REVIEW_USAGE_KEY, REVIEW_ATTEMPTS_KEY, type ReviewUsage, type ReviewAttempt } from '@/services/reviewPolicy';
let chain: Promise<unknown> = Promise.resolve();
let pendingReturn = false;
let privacyGeneration = 0;
function serial<T>(work: () => Promise<T>) { const next = chain.then(work, work); chain = next.catch(() => undefined); return next; }
export function recordSuccessfulMeal(id: string, source: string, generation: number, now = Date.now()) {
  if (source === 'demo') return Promise.resolve();
  const epoch = privacyGeneration;
  return serial(async () => {
    const raw = await AsyncStorage.getItem(REVIEW_USAGE_KEY);
    if (generation !== getLocalDataGeneration() || epoch !== privacyGeneration) return;
    const usage = raw ? JSON.parse(raw) as ReviewUsage : null;
    const next = recordReviewUsage(usage, id, localDateKey(new Date(now)), now);
    await AsyncStorage.setItem(REVIEW_USAGE_KEY, JSON.stringify(next));
    if (generation === getLocalDataGeneration() && epoch === privacyGeneration) pendingReturn = true;
  });
}
export function clearReviewUsage() {
  privacyGeneration += 1;
  pendingReturn = false;
  return serial(() => AsyncStorage.removeItem(REVIEW_USAGE_KEY));
}
/** StoreKit may silently do nothing. This records an attempt, never a rating. */
export function requestReviewAfterReturn(isStillQuiet: () => boolean) {
  const generation = getLocalDataGeneration();
  const epoch = privacyGeneration;
  return serial(async () => {
    if (!pendingReturn || Platform.OS !== 'ios' || !isStillQuiet() || !presentationIsIdle()) return;
    const version = Application.nativeApplicationVersion;
    if (!version || !await StoreReview.isAvailableAsync()) return;
    const [usageRaw, attemptsRaw] = await Promise.all([AsyncStorage.getItem(REVIEW_USAGE_KEY), AsyncStorage.getItem(REVIEW_ATTEMPTS_KEY)]);
    const usage = usageRaw ? JSON.parse(usageRaw) as ReviewUsage : null;
    const attempts = attemptsRaw ? JSON.parse(attemptsRaw) as ReviewAttempt[] : [];
    const now = Date.now();
    if (!reviewEligible(usage, attempts, version, now) || generation !== getLocalDataGeneration() || epoch !== privacyGeneration || !isStillQuiet() || !presentationIsIdle()) return;
    // Persist a reservation before calling StoreKit. Recheck after storage;
    // a competing task cancels this reservation without consuming an attempt.
    await AsyncStorage.setItem(REVIEW_ATTEMPTS_KEY, JSON.stringify([...attempts.filter(a => now - a.at < 365 * 86400000), { version, at: now }]));
    if (generation !== getLocalDataGeneration() || epoch !== privacyGeneration || !isStillQuiet() || !presentationIsIdle()) {
      await AsyncStorage.setItem(REVIEW_ATTEMPTS_KEY, JSON.stringify(attempts));
      return;
    }
    const release = holdPresentation();
    pendingReturn = false;
    try { await StoreReview.requestReview(); }
    finally { release(); }
  });
}
