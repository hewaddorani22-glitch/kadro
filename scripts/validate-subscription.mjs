import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [service, context, paywall, envExample, packageJson] = await Promise.all([
  readFile(resolve(projectRoot, 'src/services/subscription.ts'), 'utf8'),
  readFile(resolve(projectRoot, 'src/context/SubscriptionContext.tsx'), 'utf8'),
  readFile(resolve(projectRoot, 'src/app/paywall.tsx'), 'utf8'),
  readFile(resolve(projectRoot, '.env.example'), 'utf8'),
  readFile(resolve(projectRoot, 'package.json'), 'utf8'),
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
if (!paywall.includes('Wiederherstellen')) failures.push('paywall has no user-triggered restore action');
if (!paywall.includes('snapshot?.plans')) failures.push('paywall does not display RevenueCat offering prices');
if (!envExample.includes('EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=')) failures.push('Test Store public key is undocumented');
if (!envExample.includes('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=')) failures.push('iOS public SDK key is undocumented');
if (!envExample.includes('EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=kadro_pro')) failures.push('Kadro entitlement ID is undocumented');
if (!packageJson.includes('"react-native-purchases"')) failures.push('RevenueCat SDK dependency is missing');
if (/REVENUECAT_(SECRET|PRIVATE|V2)_API_KEY/.test(envExample)) failures.push('secret RevenueCat key must not be exposed to Expo');

if (failures.length) {
  throw new Error(`RevenueCat validation failed:\n- ${failures.join('\n- ')}`);
}

console.log('Validated RevenueCat offering, entitlement, purchase, cancellation, and restore boundaries.');
