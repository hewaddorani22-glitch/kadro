import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, PrimaryButton } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import {
  AccountLinkState,
  accountLinkErrorMessage,
  enableNewCloudAccount,
  getAccountLinkState,
  requestEmailLink,
  resendEmailLink,
  setAccountPassword,
  verifyEmailLink,
} from '@/services/accountLinking';
import { useLanguage } from '@/i18n/LanguageProvider';

type ViewMode = 'upgrade' | 'sign-in';

export function AccountLinkCard() {
  const { loadExistingAccount, refreshCloudState, userName } = useApp();
  const [account, setAccount] = useState<AccountLinkState | null>(null);
  const [mode, setMode] = useState<ViewMode>('upgrade');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { language, t } = useLanguage();

  useEffect(() => {
    let active = true;
    void getAccountLinkState()
      .then((next) => {
        if (!active) return;
        setAccount(next);
        if (next.status === 'pending' || next.status === 'linked') setEmail(next.email);
      })
      .catch((failure) => {
        if (active) setError(accountLinkErrorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, []);

  const run = async (action: () => Promise<AccountLinkState>, success: string, refresh = false) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await action();
      setAccount(next);
      if (next.status === 'pending' || next.status === 'linked') setEmail(next.email);
      if (next.status === 'linked') setShowPassword(true);
      if (refresh) await refreshCloudState();
      setMessage(success);
    } catch (failure) {
      setError(accountLinkErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await resendEmailLink(email);
      setMessage(t.account.resent);
    } catch (failure) {
      setError(accountLinkErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const confirmExistingAccountLoad = () => {
    Alert.alert(
      t.account.replaceTitle,
      t.account.replaceText,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.account.replaceAction,
          onPress: () => void run(
            () => loadExistingAccount(email, password),
            t.account.loadedMessage,
          ),
        },
      ],
    );
  };

  if (!account) {
    return (
      <Card style={styles.card}>
        <ActivityIndicator color={colors.accentText} />
        <Text style={styles.loadingText}>{t.account.loading}</Text>
      </Card>
    );
  }

  if (account.status === 'unavailable') {
    return (
      <Card style={styles.card}>
        <AccountHeader icon="cloud-offline-outline" title={t.account.unavailableTitle} />
        <Text style={styles.body}>{t.account.unavailableText}</Text>
      </Card>
    );
  }

  if (account.status === 'disabled') {
    return (
      <Card style={styles.card}>
        <AccountHeader icon="cloud-offline-outline" title={t.account.disabledTitle} />
        <Text style={styles.body}>{t.account.disabledText}</Text>
        <PrimaryButton
          disabled={busy}
          icon="cloud-upload-outline"
          label={busy ? t.account.enablingCloud : t.account.enableCloud}
          onPress={() => void run(enableNewCloudAccount, t.account.enabledMessage, true)}
          variant="secondary"
        />
        <Feedback error={error} message={message} />
      </Card>
    );
  }

  if (account.status === 'linked') {
    return (
      <Card style={[styles.card, styles.linkedCard]}>
        <AccountHeader icon="shield-checkmark" title={t.account.linkedTitle} />
        <Text style={styles.body}>{t.account.linkedText}</Text>
        <View style={styles.emailPill}>
          <Ionicons color={colors.accentText} name="mail-outline" size={16} />
          <Text style={styles.emailText}>{account.email}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showPassword }} onPress={() => setShowPassword((current) => !current)} style={styles.textButton}>
          <Text style={styles.textButtonLabel}>{showPassword ? t.account.closePassword : t.account.setPassword}</Text>
          <Ionicons color={colors.accentText} name={showPassword ? 'chevron-up' : 'chevron-down'} size={17} />
        </Pressable>
        {showPassword ? (
          <View style={styles.form}>
            <AccountInput
              autoComplete="new-password"
              onChangeText={setPassword}
              placeholder={t.account.passwordPlaceholder}
              secureTextEntry
              value={password}
            />
            <PrimaryButton
              disabled={busy || password.length < 8}
              icon="key-outline"
              label={busy ? t.common.saving : t.account.savePassword}
              onPress={() => void run(() => setAccountPassword(password), t.account.passwordSaved)}
            />
          </View>
        ) : null}
        <Feedback error={error} message={message} />
      </Card>
    );
  }

  if (mode === 'sign-in') {
    return (
      <Card style={styles.card}>
        <AccountHeader icon="log-in-outline" title={t.account.signInTitle} />
        <Text style={styles.body}>{t.account.signInText}</Text>
        <View style={styles.form}>
          <AccountInput autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder={t.account.email} value={email} />
          <AccountInput autoComplete="current-password" onChangeText={setPassword} placeholder={t.account.password} secureTextEntry value={password} />
          <PrimaryButton
            disabled={busy || !email.trim() || password.length < 8}
            icon="log-in-outline"
            label={busy ? t.account.loadingAccount : t.account.loadAccount}
            onPress={confirmExistingAccountLoad}
          />
        </View>
        <Pressable accessibilityRole="button" onPress={() => { setMode('upgrade'); setError(null); setMessage(null); }} style={styles.centerButton}>
          <Text style={styles.textButtonLabel}>{t.account.backToSecure}</Text>
        </Pressable>
        <Feedback error={error} message={message} />
      </Card>
    );
  }

  if (account.status === 'pending') {
    return (
      <Card style={styles.card}>
        <AccountHeader icon="mail-unread-outline" title={t.account.pendingTitle} />
        <Text style={styles.body}>{t.account.pendingText(account.email)}</Text>
        <View style={styles.form}>
          <AccountInput keyboardType="number-pad" maxLength={8} onChangeText={setCode} placeholder={t.account.codePlaceholder} value={code} />
          <PrimaryButton
            disabled={busy || !/^\d{6,8}$/.test(code)}
            icon="checkmark-circle-outline"
            label={busy ? t.account.checkingCode : t.account.confirmCode}
            onPress={() => void run(() => verifyEmailLink(account.email, code), t.account.emailConfirmed)}
          />
        </View>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void resend()} style={styles.centerButton}>
          <Text style={styles.textButtonLabel}>{t.account.resend}</Text>
        </Pressable>
        <Feedback error={error} message={message} />
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <AccountHeader icon="shield-outline" title={t.account.secureTitle} />
      <Text style={styles.body}>{t.account.secureText}</Text>
      <View style={styles.form}>
        <AccountInput autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder={t.account.email} value={email} />
        <PrimaryButton
          disabled={busy || !email.trim()}
          icon="mail-outline"
          label={busy ? t.account.sendingEmail : t.account.sendEmail}
          onPress={() => void run(() => requestEmailLink(email, userName, language), t.account.checkInbox)}
        />
      </View>
      <Pressable accessibilityRole="button" onPress={() => { setMode('sign-in'); setError(null); setMessage(null); }} style={styles.centerButton}>
        <Text style={styles.textButtonLabel}>{t.account.signInTitle}</Text>
      </Pressable>
      <Feedback error={error} message={message} />
    </Card>
  );
}

function AccountHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.icon}><Ionicons color={colors.text} name={icon} size={22} /></View>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

function AccountInput({
  autoComplete,
  keyboardType = 'default',
  maxLength,
  onChangeText,
  placeholder,
  secureTextEntry,
  value,
}: {
  autoComplete?: 'current-password' | 'email' | 'new-password';
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  maxLength?: number;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
}) {
  return (
    <TextInput
      autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      autoComplete={autoComplete}
      autoCorrect={false}
      accessibilityLabel={placeholder}
      keyboardType={keyboardType}
      maxLength={maxLength}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      secureTextEntry={secureTextEntry}
      style={styles.input}
      value={value}
    />
  );
}

function Feedback({ error, message }: { error: string | null; message: string | null }) {
  if (!error && !message) return null;
  return (
    <View accessibilityLiveRegion={error ? 'assertive' : 'polite'} style={[styles.feedback, error ? styles.errorFeedback : styles.successFeedback]}>
      <Ionicons color={error ? colors.attention : colors.success} name={error ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={17} />
      <Text style={[styles.feedbackText, error ? styles.errorText : styles.successText]}>{error ?? message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  linkedCard: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  loadingText: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  form: { gap: 10 },
  input: { minHeight: 52, borderRadius: radii.button, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 15, paddingHorizontal: 15 },
  emailPill: { minHeight: 42, borderRadius: radii.pill, backgroundColor: colors.surface, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  emailText: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '600' },
  textButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  centerButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  textButtonLabel: { color: colors.accentText, fontSize: 12, fontWeight: '700' },
  feedback: { borderRadius: 14, padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  errorFeedback: { backgroundColor: colors.attentionSoft },
  successFeedback: { backgroundColor: colors.accentSoft },
  feedbackText: { flex: 1, fontSize: 11, lineHeight: 16 },
  errorText: { color: colors.attention },
  successText: { color: colors.success },
});
