import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  PurchasesPackage,
} from 'react-native-purchases';

import { ensureSupabaseUser } from '@/services/supabaseClient';

export type SubscriptionPlanId = 'yearly' | 'monthly';

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  package: PurchasesPackage;
  price: string;
  detail: string;
  billing: string;
  hasFreeTrial: boolean;
};

export type SubscriptionSnapshot = {
  configured: boolean;
  entitlementActive: boolean;
  mode: 'unconfigured' | 'test-store' | 'native-store' | 'web';
  plans: Record<SubscriptionPlanId, SubscriptionPlan | null>;
};

const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() || 'kadro_pro';
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
let configurationPromise: Promise<boolean> | null = null;

function publicApiKey() {
  if (isExpoGo) return process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY?.trim();
  if (Platform.OS === 'ios') return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();
  if (Platform.OS === 'android') return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim();
  return process.env.EXPO_PUBLIC_REVENUECAT_WEB_API_KEY?.trim();
}

function subscriptionMode(): SubscriptionSnapshot['mode'] {
  if (!publicApiKey()) return 'unconfigured';
  if (isExpoGo) return 'test-store';
  if (Platform.OS === 'web') return 'web';
  return 'native-store';
}

function hasPro(customerInfo: CustomerInfo) {
  return Boolean(customerInfo.entitlements.active[ENTITLEMENT_ID]);
}

async function syncRevenueCatUser() {
  const user = await ensureSupabaseUser().catch(() => null);
  if (!user) return;
  const revenueCatUserId = await Purchases.getAppUserID();
  if (revenueCatUserId !== user.id) await Purchases.logIn(user.id);
}

async function ensureRevenueCatConfigured() {
  const apiKey = publicApiKey();
  if (!apiKey) return false;

  if (!configurationPromise) {
    configurationPromise = (async () => {
      await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
      const user = await ensureSupabaseUser().catch(() => null);
      const alreadyConfigured = await Purchases.isConfigured();
      if (!alreadyConfigured) {
        Purchases.configure({ apiKey, ...(user ? { appUserID: user.id } : {}) });
      } else if (user) {
        await syncRevenueCatUser();
      }
      return true;
    })().catch((error) => {
      configurationPromise = null;
      throw error;
    });
  }

  const configured = await configurationPromise;
  if (configured) await syncRevenueCatUser();
  return configured;
}

function toPlan(id: SubscriptionPlanId, purchasePackage: PurchasesPackage | null): SubscriptionPlan | null {
  if (!purchasePackage) return null;
  const { product } = purchasePackage;
  const yearly = id === 'yearly';
  const hasFreeTrial = Boolean(product.introPrice && product.introPrice.price === 0);
  return {
    id,
    package: purchasePackage,
    price: `${product.priceString} / ${yearly ? 'Jahr' : 'Monat'}`,
    detail: yearly && product.pricePerMonthString
      ? `${product.pricePerMonthString} pro Monat`
      : yearly
        ? 'Jährliche Abrechnung'
        : 'Flexibel, jederzeit kündbar',
    billing: `${product.priceString} pro ${yearly ? 'Jahr' : 'Monat'}. Automatische Verlängerung, jederzeit im Store kündbar.`,
    hasFreeTrial,
  };
}

export async function loadSubscriptionSnapshot(): Promise<SubscriptionSnapshot> {
  const configured = await ensureRevenueCatConfigured();
  if (!configured) {
    return {
      configured: false,
      entitlementActive: false,
      mode: 'unconfigured',
      plans: { yearly: null, monthly: null },
    };
  }

  const [customerInfo, offerings] = await Promise.all([
    Purchases.getCustomerInfo(),
    Purchases.getOfferings(),
  ]);
  const offering = offerings.current;
  return {
    configured: true,
    entitlementActive: hasPro(customerInfo),
    mode: subscriptionMode(),
    plans: {
      yearly: toPlan('yearly', offering?.annual ?? null),
      monthly: toPlan('monthly', offering?.monthly ?? null),
    },
  };
}

export async function purchaseSubscription(plan: SubscriptionPlan) {
  if (!(await ensureRevenueCatConfigured())) throw new Error('RevenueCat ist noch nicht eingerichtet.');
  const { customerInfo } = await Purchases.purchasePackage(plan.package);
  return hasPro(customerInfo);
}

export async function restoreSubscription() {
  if (!(await ensureRevenueCatConfigured())) throw new Error('RevenueCat ist noch nicht eingerichtet.');
  return hasPro(await Purchases.restorePurchases());
}

export function isSubscriptionPurchaseCancelled(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; userCancelled?: boolean | null };
  return candidate.userCancelled === true || candidate.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}

export function subscriptionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLocaleLowerCase('en-US');
  if (normalized.includes('invalid api key')) return 'Der RevenueCat-Schlüssel passt nicht zu dieser Umgebung.';
  if (normalized.includes('offering') || normalized.includes('package')) return 'In RevenueCat fehlen noch das aktuelle Offering oder seine Monats-/Jahrespakete.';
  if (normalized.includes('network')) return 'RevenueCat ist gerade nicht erreichbar. Bitte prüfe deine Verbindung.';
  if (normalized.includes('not configured') || normalized.includes('nicht eingerichtet')) return 'RevenueCat ist für diesen Build noch nicht eingerichtet.';
  return message || 'Der Abo-Status konnte gerade nicht geladen werden.';
}
