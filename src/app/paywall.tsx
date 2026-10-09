import { PersonalGoalSummary } from '@/components/PersonalGoalSummary';
import { usePresentationBlock } from '@/services/presentation';
import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui';
import { KandroMark } from '@/components/KandroMark';
import { radii } from '@/constants/theme';
import { FREE_SCAN_ALLOWANCE } from '@/constants/product';
import { useAccess } from '@/context/AccessContext';
import { useApp } from '@/context/AppContext';
import { takeAccessDestination } from '@/services/accessPolicy';
import { useSubscription } from '@/context/SubscriptionContext';
import { useLanguage } from '@/i18n/LanguageProvider';
import { successHaptic } from '@/services/haptics';
import { TRIAL_REMINDER_LEAD_DAYS } from '@/services/reminders';
import { formatNumber } from '@/utils/format';
import { formatWeight } from '@/utils/units';
import { toBillingMode, trackEvent } from '@/services/telemetry';
import { markPaywallShown } from '@/services/paywallExposure';

type Plan = 'yearly' | 'monthly';

export default function PaywallScreen() {
  usePresentationBlock(true);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  // Enlarged text scrolls everything; normal text keeps the purchase button
  // in view instead of below the fold.
  const largeText = fontScale > 1.15;
  const access = useAccess();
  const { freeScansLeft, profile, targets } = useApp();
  const hard = access.record.hard;
  // Interrupted mid-scan after the free analyses: say why the paywall appears.
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const blocked = reason === 'blocked' && !hard;
  const { t, locale } = useLanguage();
  const [selected, setSelected] = useState<Plan>('monthly');
  const [cancelled, setCancelled] = useState(false);
  const planChosen = useRef(false);
  const { busy, error, purchase, refresh, restore, snapshot, status, syncTrialReminder } = useSubscription();
  const yearly = snapshot?.plans.yearly ?? null;
  const monthly = snapshot?.plans.monthly ?? null;
  const selectedPlan = snapshot?.plans[selected] ?? null;
  const testStore = snapshot?.mode === 'test-store';
  const billingMode = toBillingMode(snapshot?.mode);
  const paywallViewed = useRef(false);

  const resume = async () => { await access.refresh(); router.replace(takeAccessDestination() as never); };
  useFocusEffect(useCallback(() => {
    if (status !== 'loading' && access.ready && !paywallViewed.current) {
      paywallViewed.current = true;
      markPaywallShown(blocked ? 'blocked' : hard ? 'hard' : access.entryPaywall ? 'entry' : 'manual');
      void access.markSeen();
      trackEvent('paywall viewed', { billing_mode: billingMode });
      if (access.record.source !== 'qa' && ['A', 'B'].includes(access.record.variant)) {
        trackEvent('access paywall shown', { experiment: 'paywall_access_v1', variant: access.record.variant as 'A' | 'B', environment: 'production', cohort_source: 'public', access_version: 'v1' });
      }
    }
    const back = BackHandler.addEventListener('hardwareBackPress', () => hard);
    return () => back.remove();
  }, [access.ready, access.record.variant, access.record.source, billingMode, status, hard]));

  useEffect(() => {
    if (!snapshot?.configured) return;
    // Annual is the default only for this customer's real seven-day offer.
    // Refreshes must not overwrite a plan the customer deliberately selected.
    if (!planChosen.current) {
      setSelected(snapshot.mode === 'native-store' && yearly?.hasFreeTrial && yearly.trialDays === 7
        ? 'yearly' : monthly ? 'monthly' : 'yearly');
    } else if (!selectedPlan) {
      setSelected(monthly ? 'monthly' : 'yearly');
    }
  }, [monthly, selectedPlan, snapshot?.configured, snapshot?.mode, yearly]);
  const choosePlan = (next: Plan) => { planChosen.current = true; setSelected(next); setCancelled(false); };

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const subscribe = async () => {
    if (status === 'active') {
      await resume();
      return;
    }
    if (!selectedPlan || status === 'unconfigured' || status === 'error' || status === 'pending' || access.state === 'verification') {
      await refresh(); await access.refresh();
      return;
    }
    if (busy) return;
    setCancelled(false);
    trackEvent('subscription purchase started', { billing_mode: billingMode, plan: selected });
    const result = await purchase(selected);
    trackEvent('subscription purchase ended', { billing_mode: billingMode, plan: selected, outcome: result });
    if (result === 'cancelled') { setCancelled(true); return; }
    if (result !== 'active') return;
    trackEvent('subscription purchase completed', { billing_mode: billingMode, plan: selected, purchase_kind: selectedPlan?.hasFreeTrial ? 'trial' : 'paid' });
    void successHaptic();
    // Schedule from the purchased entitlement; a declined notification prompt
    // or accelerated sandbox trial cannot be presented as a scheduled reminder.
    const reminded = testStore ? true : await syncTrialReminder();
    Alert.alert(
      testStore ? t.paywall.activatedTest : t.paywall.activated,
      testStore ? t.paywall.activatedTestBody : (!trialTimeline || reminded) ? t.paywall.activatedBody : `${t.paywall.activatedBody}\n\n${t.paywall.trialReminderOff}`,
      [{ text: t.paywall.continueLabel, onPress: () => { void resume(); } }],
    );
  };

  const restorePurchase = async () => {
    if (status === 'unconfigured') {
      Alert.alert(t.paywall.notLinkedTitle, t.paywall.notLinkedBody);
      return;
    }
    if (busy) return;
    trackEvent('subscription restore started', { billing_mode: billingMode });
    const result = await restore();
    trackEvent('subscription restore ended', { billing_mode: billingMode, outcome: result });
    if (result !== 'active' && result !== 'none') return;
    const active = result === 'active';
    trackEvent('subscription restore completed', { active, billing_mode: billingMode });
    Alert.alert(
      active ? t.paywall.restoredTitle : t.paywall.noPurchaseTitle,
      active ? t.paywall.restoredBody : t.paywall.noPurchaseBody,
      active ? [{ text: t.paywall.continueLabel, onPress: () => { void resume(); } }] : undefined,
    );
  };

  // A real StoreKit trial (eligibility checked) gets a plain timeline: what
  // happens today, when we remind, when billing starts. No pressure framing.
  const trialTimeline = Boolean(status !== 'active' && !testStore && selectedPlan?.hasFreeTrial
    && selectedPlan.trialDays && selectedPlan.trialDays > TRIAL_REMINDER_LEAD_DAYS);
  // A user's own goal is the strongest reason to start: name it.
  const goalWeight = profile && profile.age >= 18 && profile.goal !== 'maintain' && profile.targetWeightKg ? profile.targetWeightKg : null;
  const goalHeadline = goalWeight ? t.paywall.goalHeadline(formatWeight(goalWeight, profile.unitSystem, locale)) : null;
  const plan = profile && targets.calories > 0
    ? t.paywall.planLine(formatNumber(targets.calories, locale), formatNumber(targets.protein, locale))
    : null;

  const buttonLabel = busy
    ? t.paywall.ctaProcessing
    : status === 'loading'
      ? t.paywall.ctaLoading
      : status === 'active'
        ? t.paywall.ctaActive
        : status === 'unconfigured'
          ? t.paywall.ctaReload
          : (!selectedPlan || status === 'error' || status === 'pending' || access.state === 'verification')
            ? t.paywall.ctaReload
            : testStore
              ? t.paywall.ctaTest
              : selectedPlan?.hasFreeTrial
                ? selectedPlan.trialDays === 7 ? t.access.trialCTA : t.paywall.ctaTrial
                : t.paywall.ctaStart;

  const billingCopy = status === 'active'
    ? t.paywall.billingActive
    : status === 'unconfigured'
      ? t.paywall.billingPreview
      : selectedPlan
        ? selectedPlan.trialDays === 7 && selectedPlan.hasFreeTrial && !testStore
          ? t.access.trialThen(selectedPlan.price)
          : `${selectedPlan.billing}${testStore ? t.paywall.testStoreNote : ''}`
        : t.paywall.billingMissing;

  // App Store Review guideline 3.1.2 requires length, price and the renewal
  // terms to be visible before the purchase, not only in the store listing.
  // A missing renewal notice is one of the most common rejection reasons.
  const savingPercent = yearly?.monthlyEquivalent && monthly?.priceAmount
    ? Math.round((1 - yearly.monthlyEquivalent / monthly.priceAmount) * 100)
    : null;
  const yearlyBadge = savingPercent && savingPercent >= 5 ? t.paywall.cheaper(savingPercent) : undefined;

  const renewalCopy = selected === 'yearly'
    ? t.paywall.renewalYear
    : t.paywall.renewalMonth;

  // Enlarged text must not let fixed purchase terms consume the whole screen.
  // Keep every plan, action and legal link in the same scrollable flow then.
  const renewalTerms = status !== 'active' ? (
    <Text style={styles.renewal}>
      {renewalCopy} {t.paywall.renewalTail}
    </Text>
  ) : null;
  const purchaseControls = (
    <View style={[styles.footer, largeText && styles.scrollingFooter, { paddingBottom: insets.bottom + 10 }]}>
      <PrimaryButton
        disabled={busy || status === 'loading'}
        icon={status === 'active' ? 'checkmark-circle-outline' : 'arrow-forward'}
        label={buttonLabel}
        onPress={() => void subscribe()}
      />
      {trialTimeline ? <Text style={styles.dueToday}>{t.paywall.dueToday}</Text> : null}
      <Text style={styles.billing}>{billingCopy}</Text>
      {largeText ? renewalTerms : null}
      <View style={styles.legalRow}>
        <Pressable accessibilityRole="link" onPress={() => router.push('/terms')}><Text style={styles.legal}>{t.paywall.terms}</Text></Pressable>
        <View style={styles.legalDot} />
        <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')}><Text style={styles.legal}>{t.paywall.privacy}</Text></Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView key={fontScale} edges={['top', 'left', 'right']} style={styles.safe}>
      <Stack.Screen options={{ gestureEnabled: !hard, presentation: hard ? 'card' : 'modal' }} />
      <View style={styles.topBar}>
        {!hard ? <Pressable accessibilityLabel={t.paywall.close} accessibilityRole="button" hitSlop={8} onPress={() => { void resume(); }} style={styles.closeButton}>
          <Ionicons color={colors.text} name="close" size={22} />
        </Pressable> : <KandroMark size={28} />}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || status === 'loading' }} disabled={busy || status === 'loading'} onPress={() => void restorePurchase()} style={styles.restoreButton}>
          <Text style={[styles.restore, (busy || status === 'loading') && styles.disabledText]}>{t.paywall.restore}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        {plan && !blocked ? <View style={styles.planReady}>
          <Ionicons color={colors.accentText} name="checkmark-circle" size={18} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={styles.planReadyLabel}>{t.paywall.planReady}</Text>
            <Text style={styles.planReadyValue}>{plan}</Text>
          </View>
        </View> : <View style={styles.heroMark}><KandroMark size={32} /></View>}
        {testStore ? <View style={styles.testBadge}><Text style={styles.testBadgeText}>{t.paywall.testStoreBadge}</Text></View> : null}
        <Text style={styles.eyebrow}>{t.paywall.eyebrow}</Text>
        <Text style={styles.title}>{blocked ? t.paywall.blockedHeadline(FREE_SCAN_ALLOWANCE) : goalHeadline ?? (hard ? t.paywall.hardTitle : t.access.title)}</Text>
        <Text style={styles.subtitle}>{blocked ? t.paywall.blockedSub : hard ? t.paywall.hardSubtitle : t.access.subtitle}</Text>

        {!blocked ? <PersonalGoalSummary profile={profile} /> : null}

        <View style={styles.benefits}>
          <Benefit detail={t.paywall.benefit1Detail} icon="scan-outline" title={t.paywall.benefit1} />
          <Benefit detail={t.paywall.benefit2Detail} icon="create-outline" title={t.paywall.benefit2} />
        </View>

        {!hard ? <View style={styles.keepsCard}>
          <Ionicons color={colors.accentText} name="lock-open-outline" size={17} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.benefitTitle}>{t.paywall.freeTitle}</Text>
            <Text style={styles.keepsText}>{t.paywall.keeps}</Text>
            <Text style={styles.keepsText}>{t.paywall.freeAnalysesLeft(freeScansLeft, FREE_SCAN_ALLOWANCE)}</Text>
          </View>
        </View> : null}

        <View style={styles.plans}>
          <PlanCard
            detail={monthly?.trialLabel ? t.paywall.trialFirst(monthly.trialLabel) : (monthly?.detail ?? t.paywall.monthlyFallback)}
            disabled={!monthly}
            label={t.paywall.monthly}
            onPress={() => choosePlan('monthly')}
            price={monthly?.price ?? t.paywall.unavailable}
            selected={selected === 'monthly'}
          />
          <PlanCard
            badge={yearlyBadge}
            detail={yearly?.trialLabel ? t.paywall.trialFirst(yearly.trialLabel) : (yearly?.detail ?? t.paywall.yearlyFallback)}
            disabled={!yearly}
            label={t.paywall.yearly}
            onPress={() => choosePlan('yearly')}
            price={yearly?.price ?? t.paywall.unavailable}
            selected={selected === 'yearly'}
          />
        </View>
        {trialTimeline && selectedPlan ? <View style={styles.timeline}>
          <TimelineStep detail={t.paywall.timelineTodayDetail} icon="lock-open-outline" title={t.paywall.timelineToday} />
          <TimelineStep detail={t.paywall.timelineReminderDetail} icon="notifications-outline" title={t.paywall.timelineDay(selectedPlan.trialDays! - TRIAL_REMINDER_LEAD_DAYS)} />
          <TimelineStep detail={t.paywall.timelineChargeDetail(selectedPlan.price)} icon="card-outline" last title={t.paywall.timelineDay(selectedPlan.trialDays!)} />
        </View> : null}
        {cancelled && hard ? <View accessibilityLiveRegion="polite" style={styles.cancelNotice}>
          <Text style={styles.benefitTitle}>{t.paywall.purchaseCancelledTitle}</Text>
          <Text style={styles.keepsText}>{t.paywall.purchaseCancelledBody}</Text>
        </View> : null}
        {status === 'loading' ? <ActivityIndicator color={colors.accentText} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {access.state === 'verification' ? <Text accessibilityLiveRegion="polite" style={styles.error}>{t.access.verify}</Text> : null}
        <Pressable accessibilityRole="button" style={{ padding: 14, minHeight: 48 }} onPress={() => router.push('/account-help' as never)}><Text style={styles.legal}>{t.access.accountHelp} · {t.access.signIn}</Text></Pressable>
        {!largeText ? <View style={styles.inlineTerms}>{renewalTerms}</View> : null}
        {largeText ? purchaseControls : null}
      </ScrollView>

      {!largeText ? purchaseControls : null}
    </SafeAreaView>
  );
}

function Benefit({ detail, icon, title }: { detail: string; icon: keyof typeof Ionicons.glyphMap; title: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.benefit}>
      <View style={styles.benefitIcon}><Ionicons color={colors.accentText} name={icon} size={20} /></View>
      <View style={styles.benefitCopy}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitDetail}>{detail}</Text>
      </View>
      <Ionicons color={colors.success} name="checkmark-circle" size={20} />
    </View>
  );
}

function TimelineStep({ detail, icon, last, title }: { detail: string; icon: keyof typeof Ionicons.glyphMap; last?: boolean; title: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.step}>
      <View style={styles.stepRail}>
        <View style={styles.stepIcon}><Ionicons color={colors.accentText} name={icon} size={15} /></View>
        {!last ? <View style={styles.stepLine} /> : null}
      </View>
      <View style={[styles.benefitCopy, !last && { paddingBottom: 14 }]}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitDetail}>{detail}</Text>
      </View>
    </View>
  );
}

function PlanCard({ badge, detail, disabled, label, onPress, price, selected }: { badge?: string; detail: string; disabled?: boolean; label: string; onPress: () => void; price: string; selected: boolean }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1;
  const priceLabel = <Text style={[styles.planPrice, largeText && styles.planPriceLarge]}>{price}</Text>;
  return (
    <Pressable aria-checked={selected} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress} style={[styles.planCard, largeText && styles.planCardLarge, selected && styles.planCardSelected, disabled && styles.planCardDisabled]}>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={styles.planCopy}>
        <View style={styles.planLabelRow}>
          <Text style={styles.planLabel}>{label}</Text>
          {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
        </View>
        <Text style={styles.planDetail}>{detail}</Text>
        {largeText ? priceLabel : null}
      </View>
      {!largeText ? priceLabel : null}
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  topBar: { minHeight: 55, paddingVertical: 6, gap: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  restoreButton: { flexShrink: 1, minHeight: 44, justifyContent: 'center' },
  restore: { textAlign: 'right', color: colors.muted, fontSize: 15, fontWeight: '600' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center', paddingTop: 15, paddingBottom: 16 },
  heroMark: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.neutralSoft, alignItems: 'center', justifyContent: 'center' },
  testBadge: { backgroundColor: colors.accent, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 5, marginTop: 10 },
  testBadgeText: { color: colors.onAccent, fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  eyebrow: { color: colors.accentText, fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginTop: 16 },
  title: { color: colors.text, fontSize: 36, lineHeight: 41, fontWeight: '700', letterSpacing: -1.2, textAlign: 'center', marginTop: 7 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 340, marginTop: 10 },
  progressCard: { alignSelf: 'stretch', marginTop: 20, borderRadius: radii.card, backgroundColor: colors.neutralSoft, paddingHorizontal: 14, paddingVertical: 12, gap: 3 },
  progressLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  progressValue: { color: colors.text, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  keepsCard: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 18, borderRadius: radii.card, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, padding: 13 },
  keepsText: { flex: 1, minWidth: 0, color: colors.text, fontSize: 14, lineHeight: 20 },
  benefits: { alignSelf: 'stretch', gap: 9, marginTop: 22 },
  benefit: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: radii.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, paddingVertical: 11 },
  benefitIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  benefitCopy: { flex: 1, minWidth: 0, gap: 3 },
  benefitTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  benefitDetail: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  planReady: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radii.card, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, paddingHorizontal: 14, paddingVertical: 12 },
  planReadyLabel: { color: colors.accentText, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  planReadyValue: { color: colors.text, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timeline: { alignSelf: 'stretch', marginTop: 22 },
  step: { flexDirection: 'row', gap: 12 },
  stepRail: { alignItems: 'center', width: 30 },
  stepIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  stepLine: { flex: 1, width: 2, backgroundColor: colors.accent, marginVertical: 3 },
  inlineTerms: { alignSelf: 'stretch', marginTop: 4 },
  dueToday: { color: colors.text, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  plans: { alignSelf: 'stretch', gap: 10, marginTop: 25 },
  planCard: { minHeight: 76, borderRadius: radii.button, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 11 },
  planCardLarge: { alignItems: 'flex-start', paddingVertical: 14 },
  planCardSelected: { borderColor: colors.accentText, backgroundColor: colors.neutralSoft },
  planCardDisabled: { opacity: 0.45 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.accentText },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accentText },
  planCopy: { flex: 1, minWidth: 0, gap: 4 },
  planLabelRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  planLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  planDetail: { color: colors.muted, fontSize: 13 },
  badge: { flexShrink: 0, backgroundColor: colors.text, borderRadius: radii.pill, paddingHorizontal: 7, paddingVertical: 4 },
  badgeText: { color: colors.surface, fontSize: 7, fontWeight: '800', letterSpacing: 0.7 },
  planPrice: { flexShrink: 0, color: colors.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  planPriceLarge: { flexShrink: 1 },
  scrollingFooter: { alignSelf: 'stretch', marginTop: 20 },
  cancelNotice: { alignSelf: 'stretch', gap: 4, paddingVertical: 8 },
  measurement: { alignSelf: 'stretch', marginTop: 16 },
  footer: { gap: 9, paddingTop: 10, backgroundColor: colors.background },
  loader: { marginTop: 12 },
  error: { color: colors.attention, fontSize: 14, lineHeight: 20, marginTop: 12, textAlign: 'center' },
  disabledText: { opacity: 0.45 },
  billing: { color: colors.muted, fontSize: 11, textAlign: 'center' },
  renewal: { color: colors.text, fontSize: 12, lineHeight: 17, textAlign: 'center', paddingHorizontal: 4 },
  legalRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8 },
  legal: { color: colors.accentText, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
  legalDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.muted },
});
