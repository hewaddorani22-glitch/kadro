import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [service, accountDeletion, context, paywall, scan, result, appContext, localRepository, envExample, packageJson, dictDe, dictEn] = await Promise.all([
  readFile(resolve(projectRoot, 'src/services/subscription.ts'), 'utf8'),
  readFile(resolve(projectRoot, 'src/services/accountDeletion.ts'), 'utf8'),
  readFile(resolve(projectRoot, 'src/context/SubscriptionContext.tsx'), 'utf8'),
  readFile(resolve(projectRoot, 'src/app/paywall.tsx'), 'utf8'),
  readFile(resolve(projectRoot, 'src/app/(tabs)/scan.tsx'), 'utf8'),
  readFile(resolve(projectRoot, 'src/app/result.tsx'), 'utf8'),
  readFile(resolve(projectRoot, 'src/context/AppContext.tsx'), 'utf8'),
  readFile(resolve(projectRoot, 'src/services/localRepository.ts'), 'utf8'),
  readFile(resolve(projectRoot, '.env.example'), 'utf8'),
  readFile(resolve(projectRoot, 'package.json'), 'utf8'),
  readFile(resolve(projectRoot, 'src/i18n/de.ts'), 'utf8'),
  readFile(resolve(projectRoot, 'src/i18n/en.ts'), 'utf8'),
]);

const failures = [];
// Execute the actual plan mapper, not a second implementation of its rules.
const mapper = service.slice(service.indexOf('function trialLabelFrom'), service.indexOf('export async function loadSubscriptionSnapshot'));
const compiledMapper = ts.transpileModule(mapper, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const toPlan = new Function('getDictionary', `${compiledMapper}; return toPlan;`)(() => ({ billing: {
  trialPeriod: (count, unit) => `${count} ${unit}`, pricePerPeriod: (price) => price,
  perMonth: (price) => price, yearlyBilling: 'annual', monthlyFlexible: 'monthly', billingLine: (price) => price,
} }));
const trialPackage = { product: { identifier: 'test', price: 30, priceString: '30', introPrice: { price: 0, periodNumberOfUnits: 7, periodUnit: 'DAY' } } };
for (const eligibility of [undefined, false]) {
  assert.equal(toPlan('yearly', trialPackage, eligibility).hasFreeTrial, false);
  assert.equal(toPlan('yearly', trialPackage, eligibility).trialLabel, null);
}
assert.equal(toPlan('yearly', trialPackage, true).trialLabel, '7 day');
assert.equal(toPlan('yearly', { product: { ...trialPackage.product, introPrice: null } }, true).hasFreeTrial, false);
assert.match(service, /checkTrialOrIntroductoryPriceEligibility/);
assert.match(service, /status ===\s*INTRO_ELIGIBILITY_STATUS\.INTRO_ELIGIBILITY_STATUS_ELIGIBLE/);
assert.match(service, /toPlan\('yearly', offering\?\.annual \?\? null, trialEligible/);
assert.match(service, /toPlan\('monthly', offering\?\.monthly \?\? null, trialEligible/);
for (const invariant of [
  'Purchases.configure',
  'Purchases.getOfferings',
  'Purchases.getCustomerInfo',
  'Purchases.purchasePackage',
  'Purchases.restorePurchases',
  'Purchases.isAnonymous',
  'Purchases.logOut',
  'customerInfo.entitlements.active[ENTITLEMENT_ID]',
  'ensureSupabaseUser',
]) {
  if (!service.includes(invariant)) failures.push(`subscription invariant missing: ${invariant}`);
}
if (!accountDeletion.includes('clearSubscriptionIdentityAfterAccountDeletion')) {
  failures.push('account deletion must discard the RevenueCat on-device identity');
}

if (!service.includes('ExecutionEnvironment.StoreClient')) failures.push('Expo Go must select the RevenueCat Test Store');
if (!context.includes("'active' | 'cancelled' | 'failed'")) failures.push('purchase flow must distinguish cancellation from failure');
// The copy moved into the dictionaries, so assert on the wiring and on both
// languages actually carrying the string.
if (!paywall.includes('t.paywall.restore')) failures.push('paywall has no user-triggered restore action');
if (!paywall.includes('snapshot?.plans')) failures.push('paywall does not display RevenueCat offering prices');

// The paywall must persuade with facts, not with pressure. These pin the
// honest bits so a later "conversion optimisation" cannot quietly remove them.
if (!paywall.includes('savingPercent')) {
  failures.push('the yearly saving must be computed from the real prices, not asserted');
}
if (!paywall.includes('trialLabel')) failures.push('a free trial must state its actual length before the purchase');
if (!paywall.includes('t.paywall.keeps')) {
  failures.push('the paywall must state that existing history stays accessible without Pro');
}
for (const [label, dict] of [['German', dictDe], ['English', dictEn]]) {
  // Guideline 3.1.2 wants the renewal terms and the legal links clear and
  // conspicuous. They were nine point grey, which is the size something gets
  // when you would rather it were not read — and a reviewer reads it that way.
  const paywall = readFileSync(new URL('../src/app/paywall.tsx', import.meta.url), 'utf8');
  for (const [style, minimum] of [['renewal', 12], ['legal', 12]]) {
    const size = Number(paywall.match(new RegExp(`\\b${style}: \\{[^}]*fontSize: (\\d+)`))?.[1] ?? 0);
    if (size < minimum) {
      failures.push(`paywall ${style} text is ${size}pt; App Review expects the renewal terms to be legible`);
    }
  }

  for (const key of ['restore', 'keeps', 'renewalYear', 'renewalMonth', 'renewalTail']) {
    if (!dict.includes(`${key}:`)) failures.push(`${label} paywall is missing ${key}`);
  }
}

// Preview copy is shown when the native store cannot be loaded. It must never
// advertise a monthly equivalent that disagrees with the annual preview price.
for (const [label, dict, decimalSeparator] of [
  ['German', dictDe, ','],
  ['English', dictEn, '.'],
]) {
  const annual = dict.match(/previewYearly:\s*['"](?:€)?([0-9]+[.,][0-9]{2})\s*(?:€)?['"]/)?.[1];
  const monthly = dict.match(/yearlyFallback:\s*['"](?:€)?([0-9]+[.,][0-9]{2})\s*(?:€)?\s+(?:pro Monat|per month)['"]/)?.[1];
  const parsePrice = (value) => Number(value?.replace(decimalSeparator, '.'));
  if (!annual || !monthly || Math.abs(parsePrice(annual) / 12 - parsePrice(monthly)) > 0.011) {
    failures.push(`${label} annual preview and monthly equivalent disagree`);
  }
}
if (/Nur noch|läuft ab in|Angebot endet|letzte Chance|only .* left|offer ends|last chance/i.test(paywall + dictDe + dictEn)) {
  failures.push('the paywall must not use countdowns, scarcity or loss framing');
}
if (!service.includes('trialLabelFrom') || !service.includes('monthlyEquivalent')) {
  failures.push('the subscription service must expose trial length and comparable amounts');
}
if (!scan.includes('freeScansLeft > 0') || !scan.includes("subscriptionStatus === 'active'")) {
  failures.push('scanner does not enforce the free-scan entitlement boundary');
}
// A wall the user saw coming reads as a price; a wall that appears without
// warning reads as a bait and switch.
// The wording moved into the dictionaries; the guarantee is that the scanner
// surfaces the remaining allowance at all, in whichever language.
if (!scan.includes('FREE_SCAN_ALLOWANCE') || !scan.includes('t.scan.allowanceLeft')) {
  failures.push('scanner does not show the remaining free allowance before the paywall');
}
const analyzeFlow = appContext.slice(
  appContext.indexOf('const analyzeCurrentPhoto = useCallback'),
  appContext.indexOf('const resumeLatestAnalysis = useCallback'),
);
const saveFlow = appContext.slice(
  appContext.indexOf('const logScannedMeal = useCallback'),
  appContext.indexOf('const logPlannedMeal = useCallback'),
);
if (!analyzeFlow.includes('countLifetimeScanOnce(invocationScanId)') || saveFlow.includes('countLifetimeScanOnce')) {
  failures.push('the free allowance must be spent once per successful request, before optional meal save');
}
if (!result.includes('savedOnArrival') || !result.includes('logScannedMeal()')) failures.push('the first complete result is not persisted before the paywall boundary');
if (!appContext.includes('setLifetimeScanCount')) failures.push('a completed scan does not update the free-scan boundary');
if (!localRepository.includes('loadAllStoredScans')) failures.push('the free-scan boundary does not survive a new day locally');
if (!envExample.includes('EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=')) failures.push('Test Store public key is undocumented');
if (!envExample.includes('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=')) failures.push('iOS public SDK key is undocumented');
if (!envExample.includes('EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=kandro_pro')) failures.push('Kandro entitlement ID is undocumented');
if (!packageJson.includes('"react-native-purchases"')) failures.push('RevenueCat SDK dependency is missing');
if (/REVENUECAT_(SECRET|PRIVATE|V2)_API_KEY/.test(envExample)) failures.push('secret RevenueCat key must not be exposed to Expo');

if (failures.length) {
  throw new Error(`RevenueCat validation failed:\n- ${failures.join('\n- ')}`);
}

console.log('Validated the announced free-scan allowance plus RevenueCat offering, entitlement, purchase, cancellation, and restore boundaries.');
