import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  PurchasesPackage,
} from 'react-native-purchases';

import { ensureSupabaseUser } from '@/services/supabaseClient';
import { getDictionary } from '@/i18n/active';

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

  const units = { DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year' } as const;
  const unit = units[String(intro.periodUnit ?? '').toUpperCase() as keyof typeof units];
  if (!unit) return null;
  return getDictionary().billing.trialPeriod(count, unit);
}

function toPlan(id: SubscriptionPlanId, purchasePackage: PurchasesPackage | null): SubscriptionPlan | null {
  if (!purchasePackage) return null;
  const { product } = purchasePackage;
  const t = getDictionary();
  const yearly = id === 'yearly';
  const hasFreeTrial = Boolean(product.introPrice && product.introPrice.price === 0);
  const monthlyEquivalent = yearly
    ? (typeof product.pricePerMonth === 'number' ? product.pricePerMonth : product.price / 12)
    : product.price;
  return {
    id,
    package: purchasePackage,
    price: t.billing.pricePerPeriod(product.priceString, yearly),
    detail: yearly && product.pricePerMonthString
      ? t.billing.perMonth(product.pricePerMonthString)
      : yearly
        ? t.billing.yearlyBilling
        : t.billing.monthlyFlexible,
    billing: t.billing.billingLine(product.priceString, yearly),
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
  if (!(await ensureRevenueCatConfigured())) throw new Error(getDictionary().errors.billingSetupMissing);
  const { customerInfo } = await Purchases.purchasePackage(plan.package);
  return hasPro(customerInfo);
}

export async function restoreSubscription() {
  if (!(await ensureRevenueCatConfigured())) throw new Error(getDictionary().errors.billingSetupMissing);
  return hasPro(await Purchases.restorePurchases());
}

/**
 * Drops RevenueCat's on-device identity after the server has erased the
 * linked customer. The backend deletion is authoritative; this cleanup must
 * never make an already-completed account deletion look like it failed.
 */
export async function clearSubscriptionIdentityAfterAccountDeletion() {
  if (!publicApiKey() || !(await Purchases.isConfigured())) return;
  if (!(await Purchases.isAnonymous())) await Purchases.logOut();
  configurationPromise = null;
}

export function isSubscriptionPurchaseCancelled(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; userCancelled?: boolean | null };
  return candidate.userCancelled === true || candidate.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}

export function subscriptionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLocaleLowerCase('en-US');
  const t = getDictionary();
  // The provider speaks English; our own thrown messages come from the
  // dictionary, so match those by value instead of by a German fragment that
  // stopped matching the moment the app also spoke English.
  const ownSetupError = message === t.errors.billingSetupMissing || message === t.errors.billingNotConfigured;
  if (normalized.includes('invalid api key')) return t.errors.billingKeyMismatch;
  if (normalized.includes('offering') || normalized.includes('package')) return t.errors.offeringMissing;
  if (normalized.includes('network')) return t.errors.billingUnreachable;
  if (normalized.includes('not configured') || ownSetupError) return t.errors.billingNotConfigured;
  return message || t.errors.billingStatusFailed;
}
