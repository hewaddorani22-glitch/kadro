import AsyncStorage from '@react-native-async-storage/async-storage';
import { REVENUECAT_EXPERIMENT_CONSENT_VERSION, type ExperimentVariant } from '@/services/revenueCatExperimentPolicy';

const PREFIX = '@kandro/rc-experiment-consent:v1:';
export type ExperimentConsent = { enabled: boolean; pendingRemoval: boolean; attributesPresent: boolean; originalVariant: ExperimentVariant | null };
type Entry = { value: ExperimentConsent; loaded: boolean; revision: number };
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let operation: Promise<unknown> = Promise.resolve();
let identityRevision = 0;
const empty = (): ExperimentConsent => ({ enabled: false, pendingRemoval: false, attributesPresent: false, originalVariant: null });
function entry(owner: string) { let value = entries.get(owner); if (!value) { value = { value: empty(), loaded: false, revision: 0 }; entries.set(owner, value); } return value; }
function changed() { listeners.forEach(listener => listener()); }
function serial<T>(fn: () => Promise<T>) { const next = operation.then(fn, fn); operation = next.catch(() => undefined); return next; }
function persist(owner: string, value: ExperimentConsent) { return AsyncStorage.setItem(PREFIX + owner, JSON.stringify({ version: REVENUECAT_EXPERIMENT_CONSENT_VERSION, ...value })); }
export function subscribeRevenueCatExperimentConsent(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function peekRevenueCatExperimentConsent(owner: string): ExperimentConsent { return { ...entry(owner).value }; }

export async function readRevenueCatExperimentConsent(owner: string): Promise<ExperimentConsent> {
  const state = entry(owner); const revision = state.revision; const identity = identityRevision;
  if (!state.loaded) {
    const raw = await AsyncStorage.getItem(PREFIX + owner);
    let value = empty();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.version === REVENUECAT_EXPERIMENT_CONSENT_VERSION) value = {
          enabled: parsed.enabled === true, pendingRemoval: parsed.pendingRemoval === true,
          attributesPresent: parsed.attributesPresent === true,
          originalVariant: parsed.originalVariant === 'A' || parsed.originalVariant === 'B' ? parsed.originalVariant : null,
        };
      } catch { /* Corrupt or old consent never grants permission. */ }
    }
    if (revision === state.revision && identity === identityRevision) { state.value = value; state.loaded = true; }
  }
  return { ...state.value };
}

/** Close the in-memory gate before waiting on disk or the SDK. */
export function setRevenueCatExperimentConsent(owner: string, enabled: boolean) {
  const state = entry(owner); const revision = ++state.revision;
  state.value = { ...state.value, enabled: false, pendingRemoval: enabled ? state.value.pendingRemoval : true };
  state.loaded = true; changed();
  return serial(async () => {
    const value = { ...state.value, enabled };
    if (revision !== state.revision) return { ...state.value };
    await persist(owner, value);
    if (revision === state.revision) { state.value = value; changed(); }
    return { ...state.value };
  });
}

export function rememberRevenueCatExperimentVariant(owner: string, variant: ExperimentVariant) {
  return serial(async () => {
    const state = entry(owner);
    if (!state.value.enabled || (state.value.originalVariant && state.value.originalVariant !== variant)) return false;
    const revision = state.revision;
    const value = { ...state.value, originalVariant: variant, attributesPresent: true };
    await persist(owner, value);
    if (revision !== state.revision) return false;
    state.value = value;
    return true;
  });
}

export function markRevenueCatExperimentRemovalCompleted(owner: string) {
  return serial(async () => {
    const state = entry(owner); const revision = state.revision;
    const value = { ...state.value, pendingRemoval: false, attributesPresent: false };
    await persist(owner, value);
    if (revision === state.revision) { state.value = value; changed(); }
  });
}

/** A public participant becoming QA must no longer retain measurement tags. */
export function queueRevenueCatExperimentRemoval(owner: string) {
  const state = entry(owner); const revision = ++state.revision;
  state.value = { ...state.value, pendingRemoval: true }; changed();
  return serial(async () => { if (revision === state.revision) await persist(owner, state.value); });
}

/** Backend account deletion erases the RC customer; remove all local opt-ins first. */
export function clearRevenueCatExperimentConsentAfterDeletion() {
  identityRevision++;
  for (const state of entries.values()) { state.revision++; state.value = empty(); state.loaded = true; }
  changed();
  return serial(async () => {
    const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(PREFIX));
    await AsyncStorage.multiRemove(keys);
  });
}
