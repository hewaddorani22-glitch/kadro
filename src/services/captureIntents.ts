import type { FoodSearchResult } from '@/services/mealAnalysis';
export const CAPTURE_MODES = ['photo', 'barcode', 'description', 'search'] as const;
export type CaptureMode = typeof CAPTURE_MODES[number];
export type ScanInputState = {
  mode: CaptureMode; description: string; searchQuery: string; barcodeEntry: string;
  pendingFood: FoodSearchResult | null; portion: { amount: string; unitIndex: number } | null;
};
export function captureMode(value: unknown): CaptureMode | null { return typeof value === 'string' && (CAPTURE_MODES as readonly string[]).includes(value) ? value as CaptureMode : null; }
export function parseCaptureURL(path: string): CaptureMode | null {
  try {
    const url = new URL(path, 'kandro://local');
    const allowedPath = url.protocol === 'kandro:' && (url.hostname === 'capture' && (url.pathname === '' || url.pathname === '/') || url.hostname === 'local' && url.pathname === '/capture');
    if (!allowedPath || url.username || url.password || url.hash || [...url.searchParams.keys()].some(key => key !== 'mode') || url.searchParams.getAll('mode').length !== 1) return null;
    return captureMode(url.searchParams.get('mode'));
  } catch { return null; }
}
let intent: { mode: CaptureMode; serial: number } | null = null;
let sequence = 0;
let lastLink: { path: string; at: number } | null = null;
let scanDraft: CaptureMode | null = null;
// RAM only: a widget can remount the tab stack. Keep the actual form, not just
// its mode, until an explicit cancel/handoff or account/privacy invalidation.
let scanInputState: ScanInputState | null = null;
let scanInputRevision = 0;
const listeners = new Set<() => void>();
export function queueCaptureIntent(mode: CaptureMode) { intent = { mode, serial: ++sequence }; listeners.forEach(fn => fn()); }
export function receiveCaptureLink(path: string, now = Date.now()) {
  const mode = parseCaptureURL(path); if (!mode) return false;
  if (lastLink?.path === path && now - lastLink.at < 1500) return true;
  lastLink = { path, at: now }; queueCaptureIntent(mode); return true;
}
export const pendingCaptureIntent = () => intent;
export function clearCaptureIntent() { intent = null; listeners.forEach(fn => fn()); }
export function subscribeCaptureIntent(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function setScanInputDraft(mode: CaptureMode | null) { scanDraft = mode; if (!mode) scanInputState = null; }
export const getScanInputDraft = () => scanDraft;
export const getScanInputState = () => scanInputState;
export const getScanInputRevision = () => scanInputRevision;
export function invalidateScanInputState() { scanInputRevision++; setScanInputDraft(null); }
export function saveScanInputState(value: ScanInputState, revision = scanInputRevision) {
  if (revision !== scanInputRevision) return;
  if (!value.description.trim() && !value.searchQuery.trim() && !value.barcodeEntry.trim() && !value.pendingFood) { setScanInputDraft(null); return; }
  scanDraft = value.mode; scanInputState = value;
}
// Keep in sync with REMINDER_IDS in services/reminders.ts (no native import here).
const OWN_REMINDER_IDS = ['kandro-meal-reminder', 'kandro-evening-summary', 'kandro-morning-plan', 'kandro-reminder-breakfast', 'kandro-reminder-lunch', 'kandro-reminder-dinner', 'kandro-reminder-evening'];
export function reminderIntent(response: { actionIdentifier: string; notification: { date: number; request: { identifier: string; content: { data?: Record<string, unknown> } } } }) {
  const request = response.notification.request;
  if (response.actionIdentifier !== 'expo.modules.notifications.actions.DEFAULT' || !OWN_REMINDER_IDS.includes(request.identifier)) return null;
  const mode = captureMode(request.content.data?.mode);
  if (request.content.data?.route !== '/capture' || !mode || mode === 'barcode' || !Number.isFinite(response.notification.date)) return null;
  return { key: `${request.identifier}:${response.notification.date}`, mode };
}
