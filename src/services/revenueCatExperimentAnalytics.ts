import type { AccessRecord } from '@/services/accessPolicy';
import { getCurrentSessionUserId } from '@/services/supabaseClient';
import { isAppAccessMeasurementVerified } from '@/services/appAccess';
import { writeRevenueCatExperimentAttributes } from '@/services/subscription';
import { clearedExperimentAttributes, experimentAttributes, experimentMeasurementEligible, type ExperimentInstallOrigin } from '@/services/revenueCatExperimentPolicy';
import { clearRevenueCatExperimentConsentAfterDeletion, markRevenueCatExperimentRemovalCompleted, peekRevenueCatExperimentConsent, queueRevenueCatExperimentRemoval, readRevenueCatExperimentConsent, rememberRevenueCatExperimentVariant, setRevenueCatExperimentConsent, subscribeRevenueCatExperimentConsent } from '@/services/revenueCatExperimentConsent';
import { readRevenueCatExperimentOrigin } from '@/services/revenueCatExperimentOrigin';

type Context = { owner: string | null; ready: boolean; serverVerified: boolean; age: number | null; record: AccessRecord | null };
export type ExperimentMeasurementSnapshot = {
  consent: boolean; eligible: boolean;
  status: 'off' | 'paused' | 'accepted' | 'removal_pending' | 'error';
};
let context: Context = { owner: null, ready: false, serverVerified: false, age: null, record: null };
let revision = 0;
let running = false;
let again = false;
let lastAccepted: string | null = null;
let cancelOriginWait: (() => void) | null = null;
let snapshot: ExperimentMeasurementSnapshot = { consent: false, eligible: false, status: 'off' };
const listeners = new Set<() => void>();
export function getRevenueCatExperimentMeasurementSnapshot() { return { ...snapshot }; }
export function subscribeRevenueCatExperimentMeasurement(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
function publish(next: Partial<ExperimentMeasurementSnapshot>) {
  const updated = { ...snapshot, ...next };
  if (JSON.stringify(updated) === JSON.stringify(snapshot)) return;
  snapshot = updated; listeners.forEach(fn => fn());
}
function current(epoch: number, owner: string) { return epoch === revision && context.owner === owner; }

/** Synchronous invalidation is also used directly by the auth callback. */
export function invalidateRevenueCatExperimentMeasurement() {
  cancelOriginWait?.();
  revision++; context = { owner: null, ready: false, serverVerified: false, age: null, record: null }; lastAccepted = null;
  publish({ consent: false, eligible: false, status: 'off' });
}

export function updateRevenueCatExperimentMeasurement(next: Context) {
  cancelOriginWait?.();
  revision++; context = next;
  publish({ consent: next.owner ? peekRevenueCatExperimentConsent(next.owner).enabled : false,
    eligible: next.ready && !!next.owner && typeof next.age === 'number' && Number.isFinite(next.age) && next.age >= 18, status: 'off' });
  schedule();
}

function originForCurrentScope(): Promise<ExperimentInstallOrigin> {
  return new Promise(resolve => {
    let finished = false;
    const finish = (value: ExperimentInstallOrigin) => {
      if (finished) return;
      finished = true; clearTimeout(timer);
      if (cancelOriginWait === cancel) cancelOriginWait = null;
      resolve(value);
    };
    const cancel = () => finish('unknown');
    const timer = setTimeout(cancel, 5000);
    cancelOriginWait = cancel;
    // Revocation stops waiting immediately. An already-started OS request may
    // finish, but its later answer can neither block removal nor export data.
    void readRevenueCatExperimentOrigin().then(finish, cancel);
  });
}

async function synchronize() {
  const epoch = revision; const input = context; const owner = input.owner;
  if (!owner || !input.ready || await getCurrentSessionUserId() !== owner || !current(epoch, owner)) return;
  let consent = await readRevenueCatExperimentConsent(owner);
  if (!current(epoch, owner)) return;
  // A confirmed age correction withdraws the optional opt-in. Merely loading an
  // unknown age suspends work without silently changing a stored preference.
  if (typeof input.age === 'number' && input.age < 18 && consent.enabled) {
    await setRevenueCatExperimentConsent(owner, false);
    consent = peekRevenueCatExperimentConsent(owner);
  }
  if (!experimentMeasurementEligible(input.age, input.record) && consent.attributesPresent && !consent.pendingRemoval) {
    await queueRevenueCatExperimentRemoval(owner);
    consent = peekRevenueCatExperimentConsent(owner);
  }
  const allowed = () => current(epoch, owner) && input.serverVerified && isAppAccessMeasurementVerified(owner) && peekRevenueCatExperimentConsent(owner).enabled;
  publish({ consent: consent.enabled, status: consent.enabled ? 'paused' : 'off' });
  if (consent.pendingRemoval) {
    publish({ status: 'removal_pending' });
    const cleared = await writeRevenueCatExperimentAttributes(owner, clearedExperimentAttributes(), () => current(epoch, owner));
    if (!current(epoch, owner)) return;
    if (!cleared) return;
    lastAccepted = null;
    await markRevenueCatExperimentRemovalCompleted(owner);
    if (!current(epoch, owner)) return;
    consent = peekRevenueCatExperimentConsent(owner);
    publish({ status: consent.enabled ? 'paused' : 'off' });
  }
  if (!allowed() || !experimentMeasurementEligible(input.age, input.record)) return;
  const origin = await originForCurrentScope();
  if (!allowed()) return;
  const attributes = experimentAttributes({ consent: true, age: input.age, record: input.record, origin, originalVariant: consent.originalVariant });
  if (!attributes) return;
  if (!await rememberRevenueCatExperimentVariant(owner, input.record!.variant as 'A' | 'B') || !allowed()) return;
  const signature = `${owner}:${attributes.kandro_variant}`;
  if (lastAccepted === signature) { publish({ status: 'accepted' }); return; }
  const accepted = await writeRevenueCatExperimentAttributes(owner, attributes, allowed);
  if (accepted && allowed()) { lastAccepted = signature; publish({ status: 'accepted' }); }
}

function schedule() {
  again = true;
  if (running) return;
  running = true;
  void (async () => {
    while (again) {
      again = false;
      const epoch = revision;
      try { await synchronize(); }
      catch { if (epoch === revision) publish({ status: 'error' }); }
    }
  })().finally(() => { running = false; if (again) schedule(); });
}
subscribeRevenueCatExperimentConsent(() => {
  const owner = context.owner;
  if (owner) {
    const consent = peekRevenueCatExperimentConsent(owner);
    if (!consent.enabled) cancelOriginWait?.();
    publish({ consent: consent.enabled, status: consent.pendingRemoval ? 'removal_pending' : consent.enabled ? 'paused' : 'off' });
  }
  schedule();
});

export async function setRevenueCatExperimentMeasurementEnabled(enabled: boolean) {
  const owner = context.owner;
  if (!owner || !context.ready || (enabled && (context.age === null || !Number.isFinite(context.age) || context.age < 18))) throw Error('experiment_consent_unavailable');
  if (await getCurrentSessionUserId() !== owner || context.owner !== owner) throw Error('experiment_identity_changed');
  await setRevenueCatExperimentConsent(owner, enabled);
}

/** Drain/replace our queued attributes before the backend erases the RC customer. */
export async function clearRevenueCatExperimentMeasurementForAccountDeletion() {
  invalidateRevenueCatExperimentMeasurement();
  await clearRevenueCatExperimentConsentAfterDeletion();
  const owner = await getCurrentSessionUserId();
  if (owner) await writeRevenueCatExperimentAttributes(owner, clearedExperimentAttributes(), () => true);
}
