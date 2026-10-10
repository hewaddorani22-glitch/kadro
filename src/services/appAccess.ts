import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessRecord, FREE_ACCESS, UNRESOLVED_ACCESS, applyHardWall, parseAccessRecord, resolveAccess } from '@/services/accessPolicy';
import { getHardWallSnapshot, loadHardWall, setHardWallServerMode } from '@/services/hardWall';
import { functionsBaseUrl, getAccessSession, getCurrentSessionUserId, supabase, supabaseAnonKey } from '@/services/supabaseClient';
import { getDictionary } from '@/i18n/active';
import { loadSubscriptionSnapshot } from '@/services/subscription';
import { refreshServerEntitlement } from '@/services/serverEntitlement';

const key = (owner: string) => `@kandro/access:v1:${owner}`;
const entryKey = (owner: string) => `@kandro/access-entry:v1:${owner}`;
type Cache = { record: AccessRecord; fallback: boolean; ageConfirmed?: boolean; paywallSeen?: boolean };
let current: { owner: string; record: AccessRecord } | null = null;
// Optional measurement must not trust a cached pre-migration QA/public label.
// This freshness bit is deliberately separate from the durable access cache.
let measurementVerifiedOwner: string | null = null;
export function isAppAccessMeasurementVerified(owner: string | null) { return !!owner && measurementVerifiedOwner === owner; }
let generation = 0;
const listeners = new Set<() => void>();
export function subscribeAppAccess(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
function emit() { for (const fn of listeners) fn(); }
export function invalidateAppAccess() { generation++; current = null; measurementVerifiedOwner = null; setHardWallServerMode(null); emit(); }
// The hard-wall store follows the record's server mode; null = no answer yet.
function setCurrent(owner: string, record: AccessRecord) { current = { owner, record }; setHardWallServerMode(record.mode ?? null); }
// A fallback keeps the last server-issued mode: going offline must neither
// lift a hard wall nor impose one the server already ruled out.
function freeFallback(cached: AccessRecord): AccessRecord { return cached.mode ? { ...FREE_ACCESS, mode: cached.mode, freeAnalyses: cached.freeAnalyses } : FREE_ACCESS; }

async function read(owner: string): Promise<Cache> {
  const raw = await AsyncStorage.getItem(key(owner));
  if (!raw) return { record: FREE_ACCESS, fallback: false };
  const value = JSON.parse(raw) as Cache;
  return { ...value, record: parseAccessRecord(value.record) };
}
async function request(path: string, body?: Record<string, unknown>) {
  const epoch = generation;
  const session = await getAccessSession();
  if (!session || !functionsBaseUrl || !supabaseAnonKey) throw Error('access_unavailable');
  const abort = new AbortController(); const timeout = setTimeout(() => abort.abort(), 8000);
  try {
    const response = await fetch(`${functionsBaseUrl}/nutrition/v1/${path}`, {
      method: body ? 'POST' : 'GET', signal: abort.signal,
      headers: { Authorization: `Bearer ${session.accessToken}`, apikey: supabaseAnonKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw Error('access_unavailable');
    const parsed = parseAccessRecord(await response.json());
    // A server without the 20261010120000 mode has no opinion on the hard wall:
    // the install flag decides, so fresh installs are walled before that
    // migration is live and earlier installs keep their legacy scope.
    const record: AccessRecord = parsed;
    if (epoch !== generation || session.userId !== await getCurrentSessionUserId()) throw Error('cloud_identity_changed');
    return { owner: session.userId, record };
  } finally { clearTimeout(timeout); }
}
export async function prepareAccessEnrollment(ageConfirmed: boolean) {
  const owner = await getCurrentSessionUserId();
  if (owner) await AsyncStorage.setItem(entryKey(owner), JSON.stringify({ ageConfirmed }));
}
export async function hasAccessEnrollmentPending() {
  const owner = await getCurrentSessionUserId();
  return !!owner && !!await AsyncStorage.getItem(entryKey(owner));
}
export async function excludeUnassignedAccess() {
  const owner = await getCurrentSessionUserId();
  if (!owner) return FREE_ACCESS;
  const { error } = await supabase!.rpc('exclude_paywall_access_v1');
  if (error) throw error;
  await AsyncStorage.removeItem(entryKey(owner));
  return refreshAppAccess();
}
export async function refreshAppAccess(): Promise<AccessRecord> {
  measurementVerifiedOwner = null;
  const owner = await getCurrentSessionUserId(); const epoch = generation;
  if (!owner) return FREE_ACCESS;
  let cached: Cache;
  try { cached = await read(owner); }
  catch { cached = { record: current?.owner === owner ? current.record : UNRESOLVED_ACCESS, fallback: false }; }
  try {
    // A recorded free fallback remains an exclusion even after connectivity returns.
    if (cached.fallback && supabase) {
      const { error } = await supabase.rpc('exclude_paywall_access_v1');
      if (error) throw error;
    }
    const next = await request('access');
    if (epoch !== generation || next.owner !== owner) throw Error('cloud_identity_changed');
    setCurrent(next.owner, next.record);
    measurementVerifiedOwner = owner;
    // Storage errors cannot turn a successfully resolved B into a free fallback.
    await AsyncStorage.setItem(key(owner), JSON.stringify({ ...cached, fallback: false, record: next.record })).catch(() => undefined);
    return next.record;
  } catch (error) {
    measurementVerifiedOwner = null;
    if (epoch !== generation || owner !== await getCurrentSessionUserId()) throw error;
    // Existing B keeps its assignment and only the last server-issued expiry.
    const record = cached.record.variant === 'B' || cached.record.access === 'unknown' || cached.record.mode === 'hard_after_first_scan' ? cached.record : freeFallback(cached.record);
    await AsyncStorage.setItem(key(owner), JSON.stringify({ ...cached, record, fallback: record.access === 'free' })).catch(() => undefined);
    setCurrent(owner, record);
    return record;
  }
}
export async function completeAccessEnrollment(firstUse: boolean): Promise<AccessRecord> {
  measurementVerifiedOwner = null;
  const owner = await getCurrentSessionUserId(); const epoch = generation;
  if (!owner) return FREE_ACCESS;
  const cached = await read(owner);
  const pending = JSON.parse(await AsyncStorage.getItem(entryKey(owner)) ?? '{}') as { ageConfirmed?: boolean };
  let next: AccessRecord;
  try {
    const snapshot = await loadSubscriptionSnapshot();
    await refreshServerEntitlement();
    const monthly = snapshot.plans.monthly;
    const result = await request('access/enroll', {
      firstUse: firstUse && !cached.fallback, ageConfirmed: pending.ageConfirmed === true,
      trialEligible: snapshot.mode === 'native-store' && monthly?.hasFreeTrial === true,
      sevenDays: monthly?.trialDays === 7, product: monthly?.package.product.identifier ?? null,
    });
    if (epoch !== generation || result.owner !== owner) throw Error('cloud_identity_changed');
    next = result.record;
    await AsyncStorage.setItem(key(owner), JSON.stringify({ ...cached, record: next, fallback: false })).catch(() => undefined);
  } catch {
    if (epoch !== generation || owner !== await getCurrentSessionUserId()) throw Error('cloud_identity_changed');
    next = cached.record.variant === 'B' || cached.record.mode === 'hard_after_first_scan' ? cached.record : freeFallback(cached.record);
    await AsyncStorage.setItem(key(owner), JSON.stringify({ ...cached, record: next, fallback: next.variant !== 'B' }));
    if (next.variant !== 'B') await supabase?.rpc('exclude_paywall_access_v1');
  }
  if (epoch !== generation || owner !== await getCurrentSessionUserId()) throw Error('cloud_identity_changed');
  await AsyncStorage.removeItem(entryKey(owner)).catch(() => undefined);
  setCurrent(owner, next); emit();
  return next;
}
export async function markAccessPaywallSeen() {
  const owner = await getCurrentSessionUserId();
  if (owner) await AsyncStorage.setItem(key(owner), JSON.stringify({ ...await read(owner), paywallSeen: true }));
}
export async function accessPaywallSeen() {
  const owner = await getCurrentSessionUserId();
  return owner ? (await read(owner)).paywallSeen === true : true;
}
/** The record new use is checked against, including the install's hard wall. */
async function effectiveRecord(owner: string) {
  await loadHardWall();
  return applyHardWall(current?.owner === owner ? current.record : (await read(owner)).record, getHardWallSnapshot());
}
/** UI and local saves share the same resolver; the server independently enforces it. */
export async function assertNewAppUse() {
  const owner = await getCurrentSessionUserId();
  if (!owner) return;
  if (!['active', 'free'].includes(resolveAccess(await effectiveRecord(owner)))) throw Error(getDictionary().access.accessRequired);
}
export async function authorizeMealCreate(id: string) {
  await assertNewAppUse();
  const owner = await getCurrentSessionUserId();
  const record = owner ? await effectiveRecord(owner) : FREE_ACCESS;
  // A/old clients retain offline creation. B needs a per-meal server receipt
  // before its local pending mutation; retrying that receipt after expiry works.
  if (record.hard) {
    const { error } = await supabase!.rpc('authorize_meal_create_v1', { p_meal_id: id });
    if (error) throw Error(getDictionary().access.saveOnline);
    if (owner !== await getCurrentSessionUserId()) throw Error('cloud_identity_changed');
  }
}
