import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [service, context, paywall, scan, result, appContext, localRepository, envExample, packageJson, dictDe, dictEn] = await Promise.all([
  readFile(resolve(projectRoot, 'src/services/subscription.ts'), 'utf8'),
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
for (const invariant of [
  'Purchases.configure',
  'Purchases.getOfferings',
  'Purchases.getCustomerInfo',
  'Purchases.purchasePackage',
  'Purchases.restorePurchases',
  'customerInfo.entitlements.active[ENTITLEMENT_ID]',
  'ensureSupabaseUser',
]) {
  if (!service.includes(invariant)) failures.push(`subscription invariant missing: ${invariant}`);
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
  for (const key of ['restore', 'keeps', 'renewalYear', 'renewalMonth', 'renewalTail']) {
    if (!dict.includes(`${key}:`)) failures.push(`${label} paywall is missing ${key}`);
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
if (!appContext.includes('saveLifetimeScanCount') || !appContext.includes('alreadyLogged')) {
  failures.push('the free allowance must be spent once per meal, not once per save');
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
