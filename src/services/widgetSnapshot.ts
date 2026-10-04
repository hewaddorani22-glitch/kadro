import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { getLocalDataGeneration } from '@/services/localRepository';
import { localDateKey } from '@/utils/date';
import type { Nutrition, DailyTargets } from '@/types/nutrition';
const KEY = '@kandro/widget-totals:v1';
type Bridge = { invalidate(): string; writeSnapshot(json: string, generation: string): boolean };
const bridge = requireOptionalNativeModule<Bridge>('KandroWidgets');
let nativeGeneration: string | null = null;
let revision = 0;
let sharing = false;
let initialized = false;
let operation: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
function changed() { listeners.forEach(fn => fn()); }
function serial<T>(fn: () => Promise<T>) { const next = operation.then(fn, fn); operation = next.catch(() => undefined); return next; }
export const widgetsAvailable = !!bridge;
export function subscribeWidgetSharing(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export async function getWidgetSharing() {
  if (!initialized) { const epoch = revision; const stored = await AsyncStorage.getItem(KEY); if (epoch === revision) { sharing = stored === 'true'; initialized = true; } }
  return sharing;
}
/** Synchronous native invalidation precedes asynchronous identity/storage work. */
export function invalidateWidgetSnapshot() {
  revision += 1;
  nativeGeneration = null;
  if (bridge) nativeGeneration = bridge.invalidate();
}
export function clearWidgetSharing() {
  sharing = false; initialized = true;
  invalidateWidgetSnapshot(); changed();
  return serial(() => AsyncStorage.removeItem(KEY));
}
export function setWidgetSharing(enabled: boolean) {
  if (!bridge) return Promise.reject(new Error('widget_unavailable'));
  // Remove numbers immediately, even if persisting the new preference fails.
  invalidateWidgetSnapshot(); sharing = false; initialized = true; changed();
  const epoch = revision;
  return serial(async () => {
    if (epoch !== revision) return;
    await AsyncStorage.setItem(KEY, String(enabled));
    if (epoch === revision) { sharing = enabled; changed(); }
  });
}
export async function publishWidgetSnapshot(input: { consumed: Nutrition; targets: DailyTargets; language: 'de' | 'en'; day: string }, generation: number) {
  if (!bridge) return;
  const epoch = revision;
  const enabled = await getWidgetSharing();
  if (epoch !== revision || generation !== getLocalDataGeneration() || input.day !== localDateKey()) return;
  if (!nativeGeneration) nativeGeneration = bridge.invalidate();
  const now = new Date();
  const payload = { schema: 1, generation: nativeGeneration, day: input.day, updatedAt: now.getTime() / 1000, timezoneOffset: now.getTimezoneOffset(), language: input.language, privacy: enabled ? 'shared' : 'actions', ...(enabled ? { calories: input.consumed.calories, protein: input.consumed.protein, targetCalories: input.targets.calories, targetProtein: input.targets.protein } : {}) };
  if (!bridge.writeSnapshot(JSON.stringify(payload), nativeGeneration)) throw new Error('widget_snapshot_rejected');
}
