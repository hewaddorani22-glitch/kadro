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
  /** Localised trial length, e.g. "7 Tage", when the store offers one. */
  trialLabel: string | null;
  /** Raw amounts so the UI can compare plans instead of asserting a saving. */
  priceAmount: number;
  monthlyEquivalent: number | null;
};

export type SubscriptionSnapshot = {
  configured: boolean;
  entitlementActive: boolean;
  mode: 'unconfigured' | 'test-store' | 'native-store' | 'web';
  plans: Record<SubscriptionPlanId, SubscriptionPlan | null>;
};

const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() || 'kandro_pro';
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

/** Turns the store's intro period into German copy, or null when there is none. */
function trialLabelFrom(product: PurchasesPackage['product']): string | null {
  const intro = product.introPrice;
  if (!intro || intro.price !== 0) return null;

  const count = intro.periodNumberOfUnits ?? 0;
  if (count < 1) return null;

  const unit = String(intro.periodUnit ?? '').toUpperCase();
  const nouns: Record<string, [string, string]> = {
    DAY: ['Tag', 'Tage'],
    WEEK: ['Woche', 'Wochen'],
    MONTH: ['Monat', 'Monate'],
    YEAR: ['Jahr', 'Jahre'],
  };
  const noun = nouns[unit];
  if (!noun) return null;
  return `${count} ${count === 1 ? noun[0] : noun[1]}`;
}

function toPlan(id: SubscriptionPlanId, purchasePackage: PurchasesPackage | null): SubscriptionPlan | null {
  if (!purchasePackage) return null;
  const { product } = purchasePackage;
  const yearly = id === 'yearly';
  const hasFreeTrial = Boolean(product.introPrice && product.introPrice.price === 0);
  const monthlyEquivalent = yearly
    ? (typeof product.pricePerMonth === 'number' ? product.pricePerMonth : product.price / 12)
    : product.price;
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
    trialLabel: trialLabelFrom(product),
    priceAmount: product.price,
    monthlyEquivalent: Number.isFinite(monthlyEquivalent) ? monthlyEquivalent : null,
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
