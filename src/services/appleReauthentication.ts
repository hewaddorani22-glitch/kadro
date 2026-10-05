import AsyncStorage from '@react-native-async-storage/async-storage';

const REAUTH_KEY = '@kandro/apple-reauthentication:v1';
const TOKEN_PENDING_KEY = '@kandro/apple-token-pending:v1';

/** Only identity references, never Apple codes, ID tokens or refresh tokens. */
export type AppleAccountReference = { userId: string; appleUserId: string };
let blockedIdentity: AppleAccountReference | null = null;
let pendingTokenIdentity: AppleAccountReference | null = null;
let deletionCount = 0;
let deletionGeneration = 0;

let accountOperations: Promise<unknown> = Promise.resolve();

/** Auth writes and deletion share one queue: late SDK writes cannot revive a deleted session. */
export function runAccountOperation<T>(operation: () => Promise<T>, deletion = false): Promise<T> {
  const expectedDeletionGeneration = deletionGeneration;
  const result = accountOperations.then(async () => {
    if (!deletion && expectedDeletionGeneration !== deletionGeneration) {
      throw Object.assign(new Error('The account action is no longer current'), { code: 'account_operation_stale' });
    }
    return operation();
  });
  accountOperations = result.then(() => undefined, () => undefined);
  return result;
}

/** Apple may emit a revoke event while our deliberate server deletion runs. */
export function beginAppleAccountDeletion() {
  deletionCount += 1;
  deletionGeneration += 1;
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    deletionCount -= 1;
    deletionGeneration += 1;
  };
}

async function readReference(key: string): Promise<AppleAccountReference | null> {
  const value = await AsyncStorage.getItem(key);
  if (!value) return null;
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object'
    || typeof (parsed as AppleAccountReference).userId !== 'string'
    || !(parsed as AppleAccountReference).userId
    || typeof (parsed as AppleAccountReference).appleUserId !== 'string'
    || !(parsed as AppleAccountReference).appleUserId) throw new Error('Apple account recovery state is unreadable');
  const { userId, appleUserId } = parsed as AppleAccountReference;
  return { userId, appleUserId };
}

export async function loadAppleReauthentication() {
  return blockedIdentity ?? readReference(REAUTH_KEY);
}

export async function requireAppleReauthentication(reference: AppleAccountReference) {
  // Block callers before asynchronous persistence or local sign-out can run.
  blockedIdentity = { userId: reference.userId, appleUserId: reference.appleUserId };
  await AsyncStorage.setItem(REAUTH_KEY, JSON.stringify(blockedIdentity));
}

export async function clearAppleReauthentication() {
  await AsyncStorage.removeItem(REAUTH_KEY);
  blockedIdentity = null;
}

export const loadAppleTokenPending = async () => pendingTokenIdentity ?? readReference(TOKEN_PENDING_KEY);
export async function markAppleTokenPending(reference: AppleAccountReference) {
  pendingTokenIdentity = { userId: reference.userId, appleUserId: reference.appleUserId };
  await AsyncStorage.setItem(TOKEN_PENDING_KEY, JSON.stringify(pendingTokenIdentity));
}
export async function clearAppleTokenPending(userId: string) {
  if ((await loadAppleTokenPending())?.userId === userId) {
    await AsyncStorage.removeItem(TOKEN_PENDING_KEY);
    pendingTokenIdentity = null;
  }
}

/** Call only after confirmed account deletion, not when its server request fails. */
export async function clearAppleAuthenticationState() {
  await AsyncStorage.multiRemove([REAUTH_KEY, TOKEN_PENDING_KEY]);
  blockedIdentity = null;
  pendingTokenIdentity = null;
}

/** A token marker from A must not hijack an explicitly confirmed switch to B. */
export function selectAppleRecoveryReference(input: {
  reauthentication: AppleAccountReference | null;
  tokenPending: AppleAccountReference | null;
  previousUserId: string | null;
  currentUserId: string | null;
}) {
  if (input.reauthentication) return input.reauthentication;
  const pending = input.tokenPending;
  if (!pending) return null;
  const confirmedOtherDestination = input.previousUserId === pending.userId
    && input.currentUserId !== null && input.currentUserId !== input.previousUserId;
  return confirmedOtherDestination ? null : pending;
}

type CredentialState = 'authorized' | 'revoked' | 'not-found' | 'transferred' | 'unavailable';
type MonitorDependencies = {
  readIdentity: () => Promise<AppleAccountReference | null>;
  readCredentialState: (appleUserId: string) => Promise<CredentialState>;
  generation: () => number;
  onRevoked: (reference: AppleAccountReference) => Promise<void>;
};

/** Coalesces native events and rejects checks belonging to a replaced identity. */
export function createAppleCredentialMonitor(deps: MonitorDependencies) {
  let stopped = false;
  let checking: Promise<void> | null = null;
  let lockedUserId: string | null = null;
  const check = (): Promise<void> => {
    if (stopped || deletionCount > 0) return Promise.resolve();
    if (checking) return checking;
    checking = (async () => {
      const generation = deps.generation();
      const currentDeletionGeneration = deletionGeneration;
      let identity: AppleAccountReference | null;
      let state: CredentialState;
      try {
        identity = await deps.readIdentity();
        if (!identity || lockedUserId === identity.userId) return;
        state = await deps.readCredentialState(identity.appleUserId);
      } catch {
        // Simulator limitations, unavailable Apple services and offline failures
        // are not proof of a revocation and never erase/sign out an account.
        return;
      }
      if (state === 'transferred') return; // Migration is not a new identity or revocation.
      if (state !== 'revoked' && state !== 'not-found') return;
      if (stopped || deletionCount > 0 || currentDeletionGeneration !== deletionGeneration || generation !== deps.generation()) return;
      const current = await deps.readIdentity().catch(() => null);
      if (stopped || deletionCount > 0 || currentDeletionGeneration !== deletionGeneration || generation !== deps.generation() || current?.userId !== identity.userId || current.appleUserId !== identity.appleUserId) return;
      lockedUserId = identity.userId;
      try { await deps.onRevoked(identity); }
      catch (error) { lockedUserId = null; throw error; }
    })().finally(() => { checking = null; });
    return checking;
  };
  return { check, start() { stopped = false; }, reset() { lockedUserId = null; }, stop() { stopped = true; } };
}
