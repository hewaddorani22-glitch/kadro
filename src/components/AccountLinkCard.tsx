import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, PrimaryButton } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import {
  AccountLinkState,
  accountLinkErrorMessage,
  enableNewCloudAccount,
  getAccountLinkState,
  refreshEmailLink,
  requestEmailLink,
  resendEmailLink,
  setAccountPassword,
  signInToExistingAccount,
  verifyEmailLink,
} from '@/services/accountLinking';

type ViewMode = 'upgrade' | 'sign-in';

export function AccountLinkCard() {
  const { refreshCloudState } = useApp();
  const [account, setAccount] = useState<AccountLinkState | null>(null);
  const [mode, setMode] = useState<ViewMode>('upgrade');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setMessage('Die Bestätigungs-E-Mail wurde erneut gesendet.');
    } catch (failure) {
      setError(accountLinkErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  if (!account) {
    return (
      <Card style={styles.card}>
        <ActivityIndicator color={colors.accentDeep} />
        <Text style={styles.loadingText}>Kontostatus wird geladen …</Text>
      </Card>
    );
  }

  if (account.status === 'unavailable') {
    return (
      <Card style={styles.card}>
        <AccountHeader icon="cloud-offline-outline" title="Nur auf diesem Gerät" />
        <Text style={styles.body}>Cloud-Synchronisierung ist für diesen Build nicht eingerichtet.</Text>
      </Card>
    );
  }

  if (account.status === 'disabled') {
    return (
      <Card style={styles.card}>
        <AccountHeader icon="cloud-offline-outline" title="Cloud nach Löschung deaktiviert" />
        <Text style={styles.body}>Kadro legt nicht automatisch wieder einen Gast-Account an. Du kannst die Cloud später bewusst neu aktivieren.</Text>
        <PrimaryButton
          disabled={busy}
          icon="cloud-upload-outline"
          label={busy ? 'Cloud wird aktiviert …' : 'Neuen Cloud-Account anlegen'}
          onPress={() => void run(enableNewCloudAccount, 'Ein neuer leerer Cloud-Account wurde angelegt.', true)}
          variant="secondary"
        />
        <Feedback error={error} message={message} />
      </Card>
    );
  }

  if (account.status === 'linked') {
    return (
      <Card style={[styles.card, styles.linkedCard]}>
        <AccountHeader icon="shield-checkmark" title="Konto gesichert" />
        <Text style={styles.body}>Dein Verlauf bleibt mit derselben Kadro-ID verknüpft.</Text>
        <View style={styles.emailPill}>
          <Ionicons color={colors.accentDeep} name="mail-outline" size={16} />
          <Text style={styles.emailText}>{account.email}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showPassword }} onPress={() => setShowPassword((current) => !current)} style={styles.textButton}>
          <Text style={styles.textButtonLabel}>{showPassword ? 'Passwortfeld schließen' : 'Passwort setzen oder ändern'}</Text>
          <Ionicons color={colors.accentDeep} name={showPassword ? 'chevron-up' : 'chevron-down'} size={17} />
        </Pressable>
        {showPassword ? (
          <View style={styles.form}>
            <AccountInput
              autoComplete="new-password"
              onChangeText={setPassword}
              placeholder="Mindestens 8 Zeichen"
              secureTextEntry
              value={password}
            />
            <PrimaryButton
              disabled={busy || password.length < 8}
              icon="key-outline"
              label={busy ? 'Wird gespeichert …' : 'Passwort speichern'}
              onPress={() => void run(() => setAccountPassword(password), 'Passwort gespeichert. Dein Konto kann jetzt wiederhergestellt werden.')}
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
        <AccountHeader icon="log-in-outline" title="Vorhandenes Konto laden" />
        <Text style={styles.body}>Lokale Scans werden nach der Anmeldung sicher mit diesem Konto synchronisiert.</Text>
        <View style={styles.form}>
          <AccountInput autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="E-Mail-Adresse" value={email} />
          <AccountInput autoComplete="current-password" onChangeText={setPassword} placeholder="Passwort" secureTextEntry value={password} />
          <PrimaryButton
            disabled={busy || !email.trim() || password.length < 8}
            icon="log-in-outline"
            label={busy ? 'Konto wird geladen …' : 'Konto laden'}
            onPress={() => void run(() => signInToExistingAccount(email, password), 'Konto geladen und synchronisiert.', true)}
          />
        </View>
        <Pressable accessibilityRole="button" onPress={() => { setMode('upgrade'); setError(null); setMessage(null); }} style={styles.centerButton}>
          <Text style={styles.textButtonLabel}>Zurück zur Kontosicherung</Text>
        </Pressable>
        <Feedback error={error} message={message} />
      </Card>
    );
  }

  if (account.status === 'pending') {
    return (
      <Card style={styles.card}>
        <AccountHeader icon="mail-unread-outline" title="E-Mail bestätigen" />
        <Text style={styles.body}>Öffne den Link in der E-Mail an {account.email}. Falls ein Code angezeigt wird, kannst du ihn direkt eingeben.</Text>
        <View style={styles.form}>
          <AccountInput keyboardType="number-pad" maxLength={8} onChangeText={setCode} placeholder="6- bis 8-stelliger Code" value={code} />
          <PrimaryButton
            disabled={busy || !/^\d{6,8}$/.test(code)}
            icon="checkmark-circle-outline"
            label={busy ? 'Code wird geprüft …' : 'Code bestätigen'}
            onPress={() => void run(() => verifyEmailLink(account.email, code), 'E-Mail bestätigt. Lege jetzt dein Passwort fest.')}
          />
          <PrimaryButton
            disabled={busy}
            icon="refresh-outline"
            label="Ich habe den Link geöffnet"
            onPress={() => void run(refreshEmailLink, 'E-Mail bestätigt. Lege jetzt dein Passwort fest.')}
            variant="secondary"
          />
        </View>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void resend()} style={styles.centerButton}>
          <Text style={styles.textButtonLabel}>E-Mail erneut senden</Text>
        </Pressable>
        <Feedback error={error} message={message} />
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <AccountHeader icon="shield-outline" title="Verlauf dauerhaft sichern" />
      <Text style={styles.body}>Verknüpfe deine aktuelle Kadro-ID mit einer E-Mail. Mahlzeiten und Ziele bleiben dabei erhalten.</Text>
      <View style={styles.form}>
        <AccountInput autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="E-Mail-Adresse" value={email} />
        <PrimaryButton
          disabled={busy || !email.trim()}
          icon="mail-outline"
          label={busy ? 'E-Mail wird gesendet …' : 'Bestätigungs-E-Mail senden'}
          onPress={() => void run(() => requestEmailLink(email), 'Prüfe jetzt dein E-Mail-Postfach.')}
        />
      </View>
      <Pressable accessibilityRole="button" onPress={() => { setMode('sign-in'); setError(null); setMessage(null); }} style={styles.centerButton}>
        <Text style={styles.textButtonLabel}>Vorhandenes Konto laden</Text>
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
  title: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  form: { gap: 10 },
  input: { minHeight: 52, borderRadius: radii.button, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 15, paddingHorizontal: 15 },
  emailPill: { minHeight: 42, borderRadius: radii.pill, backgroundColor: colors.surface, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  emailText: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '700' },
  textButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  centerButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  textButtonLabel: { color: colors.accentDeep, fontSize: 12, fontWeight: '800' },
  feedback: { borderRadius: 14, padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  errorFeedback: { backgroundColor: colors.attentionSoft },
  successFeedback: { backgroundColor: colors.accentSoft },
  feedbackText: { flex: 1, fontSize: 11, lineHeight: 16 },
  errorText: { color: colors.attention },
  successText: { color: colors.success },
});
