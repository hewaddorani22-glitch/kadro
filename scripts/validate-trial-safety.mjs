// Actual paywall, store mapper and reminder service; native/StoreKit boundaries
// are deterministic fixtures. No network, purchase, OS permission or revenue claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
const source = path => fs.readFileSync(new URL(path, root), 'utf8');
function compile(path, mocks, raw = source(path)) {
  const js = ts.transpileModule(raw, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', '__DEV__', js)(id => { if (!(id in mocks)) throw Error(`Unmocked dependency: ${id}`); return mocks[id]; }, module, module.exports, false);
  return module.exports;
}
const results = [];
async function test(name, run) { try { await run(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, error: error.message }); } }
const dictionary = compile('src/i18n/en.ts', {}).en;
// The dictionary export can change without replacing the billing implementation.
const dict = dictionary ?? compile('src/i18n/en.ts', {}).default;
const currentTime = Date.parse('2026-10-04T10:00:00Z');
const originalNow = Date.now; Date.now = () => currentTime;
const day = 86_400_000;
const entitlement = overrides => ({ isActive: true, store: 'APP_STORE', periodType: 'TRIAL', latestPurchaseDate: '2026-10-02T10:00:00.000Z', willRenew: true, productIdentifier: 'annual', expirationDate: new Date(currentTime + 5 * day).toISOString(), ...overrides });
const customer = value => ({ entitlements: { active: value ? { kandro_pro: value } : {} } });
const service = compile('src/services/subscription.ts', {
  'expo-constants': { default: {}, ExecutionEnvironment: { StoreClient: 'expo' } },
  'react-native': { Platform: { OS: 'ios' } },
  'react-native-purchases': { default: {}, INTRO_ELIGIBILITY_STATUS: {}, LOG_LEVEL: {}, PURCHASES_ERROR_CODE: {} },
  '@/services/supabaseClient': { ensureSupabaseUser: async () => null },
  '@/i18n/active': { getDictionary: () => dict },
});
const mapperSource = source('src/services/subscription.ts').slice(source('src/services/subscription.ts').indexOf('function trialLabelFrom'), source('src/services/subscription.ts').indexOf('export async function loadSubscriptionSnapshot'));
const mapper = new Function('getDictionary', `${ts.transpileModule(mapperSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText}; return toPlan;`)(() => dict);
const packageFor = (intro = {}) => ({ product: { identifier: 'annual', price: 59, priceString: '£59.00', introPrice: { price: 0, periodUnit: 'DAY', periodNumberOfUnits: 7, cycles: 1, ...intro } } });
await test('Store eligibility and actual free duration determine the seven-day offer', () => {
  assert.equal(mapper('yearly', packageFor(), true).trialDays, 7);
  assert.equal(mapper('yearly', packageFor(), false).hasFreeTrial, false);
  assert.equal(mapper('yearly', packageFor({ price: 1 }), true).trialDays, null);
  assert.equal(mapper('yearly', packageFor({ cycles: 2 }), true).trialDays, 14);
  assert.equal(mapper('yearly', packageFor({ periodUnit: 'WEEK', periodNumberOfUnits: 1 }), true).trialDays, 7);
  assert.equal(mapper('yearly', packageFor({ cycles: -1 }), true).hasFreeTrial, false);
});
await test('Actual entitlement expiry survives, including a cancelled-but-still-active trial', () => {
  const trial = service.currentTrialFrom(customer(entitlement()));
  assert.equal(trial.expiresAt, '2026-10-09T10:00:00.000Z');
  assert.equal(trial.startedAt, '2026-10-02T10:00:00.000Z');
  assert.equal(service.currentTrialFrom(customer(entitlement({ latestPurchaseDate: 'broken' }))).startedAt, null);
  assert.equal(service.currentTrialFrom(customer(entitlement({ latestPurchaseDate: '2026-10-05T10:00:00.000Z' }))).startedAt, null);
  assert.equal(service.currentTrialFrom(customer(entitlement({ willRenew: false }))).willRenew, false);
  for (const changes of [{ isActive: false }, { periodType: 'NORMAL' }, { store: 'TEST_STORE' }, { expirationDate: null }, { expirationDate: 'broken' }, { expirationDate: new Date(currentTime).toISOString() }]) assert.equal(service.currentTrialFrom(customer(entitlement(changes))), null);
  assert.equal(service.currentTrialFrom(customer(null)), null);
});
function reminderFixture(raw) {
  const memory = new Map(), scheduled = new Map(); let permission = 2, requests = 0, writes = 0, permissionWait = null;
  const notifications = {
    IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
    SchedulableTriggerInputTypes: { DATE: 'date' }, setNotificationHandler() {},
    async getPermissionsAsync() { if (permissionWait) await permissionWait; return { granted: permission === 2, ios: { status: permission }, status: permission === 1 ? 'denied' : 'undetermined' }; },
    async requestPermissionsAsync() { requests++; throw Error('Unexpected OS prompt'); },
    async cancelScheduledNotificationAsync(id) { scheduled.delete(id); }, async dismissNotificationAsync() {},
    async getAllScheduledNotificationsAsync() { return [...scheduled.values()]; },
    async scheduleNotificationAsync(value) { writes++; scheduled.set(value.identifier, value); return value.identifier; },
  };
  const storage = { getItem: async key => memory.get(key) ?? null, setItem: async (key, value) => memory.set(key, value), removeItem: async key => memory.delete(key), multiRemove: async keys => keys.forEach(key => memory.delete(key)) };
  const reminders = compile('src/services/reminders.ts', { '@react-native-async-storage/async-storage': storage, 'expo-notifications': notifications, 'react-native': { Platform: { OS: 'ios' } }, '@/i18n/active': { getDictionary: () => dict, getLocale: () => 'en-GB' } }, raw);
  return { reminders, memory, scheduled, setPermission(v) { permission = v; }, blockPermission(v) { permissionWait = v; }, counts: () => ({ requests, writes }) };
}
const trial = service.currentTrialFrom(customer(entitlement()));
await test('Reminder uses true expiry minus two days, with stable dedupe and a restore-safe ID', async () => {
  const f = reminderFixture();
  assert.equal(await f.reminders.scheduleTrialEndingReminder(trial), true);
  assert.equal(f.scheduled.get('kandro-trial-ending').trigger.date.getTime(), currentTime + 3 * day);
  assert.equal(await f.reminders.scheduleTrialEndingReminder(trial), true);
  assert.equal(f.counts().writes, 1); assert.equal(f.scheduled.size, 1);
  const changed = { ...trial, expiresAt: new Date(currentTime + 8 * day).toISOString() };
  assert.equal(await f.reminders.scheduleTrialEndingReminder(changed), true);
  assert.equal(f.scheduled.size, 1); assert.equal(f.counts().writes, 2);
  assert.equal(f.scheduled.get('kandro-trial-ending').trigger.date.getTime(), currentTime + 6 * day);
  assert.equal(f.counts().requests, 0);
});
await test('Denied/undetermined notifications never re-prompt; quiet permission is valid', async () => {
  const f = reminderFixture();
  for (const permission of [0, 1]) { f.setPermission(permission); assert.equal(await f.reminders.scheduleTrialEndingReminder(trial), false); assert.equal(f.scheduled.size, 0); }
  f.setPermission(3); assert.equal(await f.reminders.scheduleTrialEndingReminder(trial), true);
  assert.equal(f.counts().requests, 0);
});
await test('Cancellation, paid renewal, revoked permission and shortened sandbox trials remove stale reminders', async () => {
  const f = reminderFixture();
  for (const value of [null, { ...trial, willRenew: false }, { ...trial, expiresAt: 'invalid' }, { ...trial, expiresAt: new Date(currentTime + 30 * 60_000).toISOString() }]) {
    await f.reminders.scheduleTrialEndingReminder(trial);
    assert.equal(await f.reminders.scheduleTrialEndingReminder(value), false); assert.equal(f.scheduled.size, 0);
  }
  await f.reminders.scheduleTrialEndingReminder(trial); f.setPermission(1);
  await f.reminders.scheduleTrialEndingReminder(trial); assert.equal(f.scheduled.size, 0);
});
await test('Account deletion wins against an in-flight trial scheduling permission read', async () => {
  const f = reminderFixture(); let release; const wait = new Promise(resolve => { release = resolve; });
  f.blockPermission(wait); const pending = f.reminders.scheduleTrialEndingReminder(trial);
  await Promise.resolve(); const clear = f.reminders.clearRemindersForAccountSwitch(); release();
  await Promise.all([pending, clear]); assert.equal(f.scheduled.size, 0); assert.equal(f.memory.size, 0);
});
await test('A stale subscription generation cannot schedule for another account', async () => {
  const f = reminderFixture(); let valid = true, release;
  f.blockPermission(new Promise(resolve => { release = resolve; }));
  const pending = f.reminders.scheduleTrialEndingReminder(trial, () => valid);
  await Promise.resolve(); valid = false; release();
  assert.equal(await pending, false); assert.equal(f.scheduled.size, 0);
});
// Render the real screen with a tiny hook runtime, retaining effects and state.
function hooks() {
  const slots = []; let cursor = 0, effects = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) { const n = cursor++; if (!slots[n]) slots[n] = { value: initial }; return [slots[n].value, next => { slots[n].value = typeof next === 'function' ? next(slots[n].value) : next; }]; },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useMemo(fn, deps) { const n = cursor++; if (!same(slots[n]?.deps, deps)) slots[n] = { value: fn(), deps }; return slots[n].value; },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) { const n = cursor++; if (!same(slots[n]?.deps, deps)) { slots[n] = { deps }; effects.push(fn); } },
  };
  return { react, render(Screen) { cursor = 0; const tree = Screen(); const queue = effects; effects = []; queue.forEach(fn => fn()); return tree; } };
}
const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...(Array.isArray(node.props?.children) ? node.props.children : [node.props?.children]).flatMap(child => Array.isArray(child) ? child.flatMap(nodes) : nodes(child))];
function paywallFixture({ days = 7, eligible = true, mode = 'native-store', hard = true } = {}) {
  const h = hooks(); let purchaseOutcome = 'cancelled';
  const state = { status: 'ready', busy: false, error: null, snapshot: { configured: true, mode, plans: { yearly: { ...mapper('yearly', packageFor({ periodNumberOfUnits: days }), eligible) }, monthly: { ...mapper('monthly', packageFor(), eligible) } } }, async purchase() { return purchaseOutcome; }, async refresh() {}, async restore() { return 'none'; }, async syncTrialReminder() { return true; } };
  const jsx = (type, props) => ({ type, props });
  const screen = compile('src/app/paywall.tsx', {
    react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { ActivityIndicator: 'Spinner', Alert: { alert() {} }, BackHandler: { addEventListener: () => ({ remove() {} }) }, Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: x => x }, Text: 'Text', View: 'View', useWindowDimensions: () => ({ fontScale: 1 }) },
    'expo-router': { Stack: { Screen: 'Stack' }, useFocusEffect() {}, useLocalSearchParams: () => ({}), useRouter: () => ({ replace() {}, push() {} }) },
    'react-native-safe-area-context': { SafeAreaView: 'Safe', useSafeAreaInsets: () => ({ bottom: 0 }) },
    '@expo/vector-icons/Ionicons': 'Icon', '@/components/PersonalGoalSummary': { PersonalGoalSummary: 'PersonalGoalSummary' }, '@/components/ui': { PrimaryButton: 'Primary' }, '@/components/KandroMark': { KandroMark: 'Mark' }, '@/components/RevenueCatExperimentPreferences': { RevenueCatExperimentPreferences: 'MeasurementPreferences' }, '@/constants/theme': { radii: {} }, '@/constants/product': { FREE_SCAN_ALLOWANCE: 3 },
    '@/services/presentation': { usePresentationBlock() {} }, '@/context/ThemeContext': { useTheme: () => ({ colors: {} }), useThemedStyles: () => ({}) },
    '@/context/AccessContext': { useAccess: () => ({ record: { hard, variant: hard ? 'B' : 'A', source: 'qa' }, refresh: async () => {}, markSeen() {}, ready: true, state: 'allowed' }) },
    '@/context/AppContext': { useApp: () => ({ freeScansLeft: 3, profile: null, targets: { calories: 0 } }) }, '@/services/accessPolicy': { takeAccessDestination: () => '/' }, '@/context/SubscriptionContext': { useSubscription: () => state },
    '@/i18n/LanguageProvider': { useLanguage: () => ({ t: dict, locale: 'en-GB' }) }, '@/services/haptics': { successHaptic() {} }, '@/services/reminders': { TRIAL_REMINDER_LEAD_DAYS: 2 }, '@/utils/format': { formatNumber: n => String(n) }, '@/utils/units': { formatWeight: kg => kg + ' kg' }, '@/services/telemetry': { toBillingMode: x => x, trackEvent() {} },
  }).default;
  const render = () => h.render(screen);
  const cards = tree => nodes(tree).filter(n => n.type?.name === 'PlanCard');
  const choose = (tree, label) => cards(tree).find(n => n.props.label === label).props.onPress();
  const selected = tree => cards(tree).find(n => n.props.selected)?.props.label;
  return { state, render, selected, choose, setOutcome(v) { purchaseOutcome = v; } };
}
await test('Annual defaults only for an eligible real seven-day offer and never overwrites manual monthly choice', () => {
  const f = paywallFixture(); f.render(); assert.equal(f.selected(f.render()), dict.paywall.yearly);
  f.choose(f.render(), dict.paywall.monthly); f.state.snapshot = { ...f.state.snapshot, plans: { ...f.state.snapshot.plans } };
  assert.equal(f.selected(f.render()), dict.paywall.monthly); assert.equal(f.selected(f.render()), dict.paywall.monthly);
  for (const options of [{ eligible: false }, { days: 14 }, { mode: 'test-store' }]) { const other = paywallFixture(options); other.render(); assert.equal(other.selected(other.render()), dict.paywall.monthly); }
});
await test('Explicit store cancellation leaves hard paywall with honest guidance and no automatic retry', async () => {
  assert.equal(typeof dict.paywall.purchaseCancelledTitle, 'string');
  assert.equal(typeof dict.paywall.purchaseCancelledBody, 'string');
  const f = paywallFixture(); let calls = 0; f.state.purchase = async () => { calls++; return 'cancelled'; };
  f.render(); const tree = f.render(); nodes(tree).find(n => n.type === 'Primary').props.onPress();
  await Promise.resolve(); await Promise.resolve();
  const texts = nodes(f.render()).filter(n => n.type === 'Text').map(n => n.props.children);
  assert.ok(texts.includes(dict.paywall.purchaseCancelledTitle)); assert.ok(texts.includes(dict.paywall.purchaseCancelledBody)); assert.equal(calls, 1);
  f.choose(f.render(), dict.paywall.monthly); assert.ok(!nodes(f.render()).some(n => n.type === 'Text' && n.props.children === dict.paywall.purchaseCancelledTitle));
});
if (process.argv.includes('--baseline')) {
  const before = path => execFileSync('git', ['show', `c412a38:${path}`], { cwd: root, encoding: 'utf8' });
  await test('BASELINE RED: old intro mapper must count repeated zero-price periods', () => {
    const text = before('src/services/subscription.ts');
    const fragment = text.slice(text.indexOf('function trialLabelFrom'), text.indexOf('export async function loadSubscriptionSnapshot'));
    const oldMapper = new Function('getDictionary', `${ts.transpileModule(fragment, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText}; return toPlan;`)(() => dict);
    assert.equal(oldMapper('yearly', packageFor({ cycles: 2 }), true).trialDays, 14);
  });
  await test('BASELINE RED: old reminder scheduled from now, ignoring a trial started two days earlier', async () => {
    const f = reminderFixture(before('src/services/reminders.ts'));
    assert.equal(await f.reminders.scheduleTrialEndingReminder(7, '£59.00/year'), true);
    assert.equal(f.scheduled.get('kandro-trial-ending').trigger.date.getTime(), currentTime + 3 * day);
  });
}
Date.now = originalNow;
console.log(JSON.stringify({ passed: results.filter(r => r.passed).length, total: results.length, results }, null, 2));
if (results.some(r => !r.passed)) process.exitCode = 1;
