import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { AccountLinkCard } from '@/components/AccountLinkCard';
import { Card, Eyebrow, PageTitle, Screen, SectionTitle } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { formatNumber } from '@/utils/format';

export default function ProfileScreen() {
  const router = useRouter();
  const { syncMode, targets, userName } = useApp();
  const [savePhotos, setSavePhotos] = useState(false);
  const [notifications, setNotifications] = useState(true);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>A</Text></View>
        <View style={styles.headerCopy}>
          <Eyebrow>Dein Profil</Eyebrow>
          <PageTitle>{userName}</PageTitle>
          <Text style={styles.subtitle}>
            {syncMode === 'cloud'
              ? 'Cloud-Synchronisierung aktiv'
              : syncMode === 'syncing'
                ? 'Konto wird verbunden …'
                : syncMode === 'error'
                  ? 'Offline · wird später synchronisiert'
                  : 'Lokal auf diesem Gerät'}
          </Text>
        </View>
        <Pressable style={styles.editButton}><Ionicons color={colors.text} name="create-outline" size={20} /></Pressable>
      </View>

      <View style={styles.section}>
        <SectionTitle>Dein Konto</SectionTitle>
        <AccountLinkCard />
      </View>

      <Pressable onPress={() => router.push('/paywall')}>
        <Card style={styles.proCard}>
          <View style={styles.proIcon}><Ionicons color={colors.text} name="infinite" size={26} /></View>
          <View style={styles.proCopy}>
            <Text style={styles.proTitle}>Kadro Pro</Text>
            <Text style={styles.proText}>Unbegrenzte Scans. Ein Plan, der sich weiter anpasst.</Text>
          </View>
          <View style={styles.tryPill}><Text style={styles.tryText}>GRATIS TESTEN</Text></View>
        </Card>
      </Pressable>

      <View style={styles.section}>
        <SectionTitle>Dein Plan</SectionTitle>
        <Card style={styles.planCard}>
          <View style={styles.planGrid}>
            <PlanStat label="Kalorien" value={formatNumber(targets.calories)} />
            <PlanStat label="Protein" value={`${targets.protein} g`} />
            <PlanStat label="Ziel" value="Reduzieren" />
            <PlanStat label="Aktivität" value="Leicht" />
          </View>
          <Pressable style={styles.updateRow}>
            <Ionicons color={colors.accentDeep} name="options-outline" size={19} />
            <Text style={styles.updateText}>Ziele und Präferenzen anpassen</Text>
            <Ionicons color={colors.muted} name="chevron-forward" size={18} />
          </Pressable>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle>Einstellungen</SectionTitle>
        <Card style={styles.listCard}>
          <ToggleRow
            detail="Originalfotos werden nach der Analyse verworfen."
            icon="image-outline"
            label="Mahlzeitenfotos speichern"
            onValueChange={setSavePhotos}
            value={savePhotos}
          />
          <View style={styles.divider} />
          <ToggleRow
            detail="Sanfte Hinweise zu deinen üblichen Essenszeiten."
            icon="notifications-outline"
            label="Intelligente Erinnerungen"
            onValueChange={setNotifications}
            value={notifications}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle>Support und Datenschutz</SectionTitle>
        <Card style={styles.listCard}>
          <MenuRow icon="shield-checkmark-outline" label="Datenschutz" />
          <View style={styles.divider} />
          <MenuRow icon="document-text-outline" label="Nutzungsbedingungen" />
          <View style={styles.divider} />
          <MenuRow icon="help-circle-outline" label="Hilfe und Feedback" />
        </Card>
      </View>

      <View style={styles.wellnessNote}>
        <Ionicons color={colors.muted} name="information-circle-outline" size={18} />
        <Text style={styles.wellnessText}>Kadro liefert allgemeine Wellness-Schätzungen und ist kein medizinischer Dienst.</Text>
      </View>

      <Text style={styles.version}>Kadro · MVP 0.1.0</Text>
    </Screen>
  );
}

function PlanStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.planStat}>
      <Text style={styles.planStatLabel}>{label}</Text>
      <Text style={styles.planStatValue}>{value}</Text>
    </View>
  );
}

function ToggleRow({ detail, icon, label, onValueChange, value }: { detail: string; icon: keyof typeof Ionicons.glyphMap; label: string; onValueChange: (value: boolean) => void; value: boolean }) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.rowIcon}><Ionicons color={colors.text} name={icon} size={20} /></View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      <Switch ios_backgroundColor={colors.border} onValueChange={onValueChange} thumbColor={colors.surface} trackColor={{ false: colors.border, true: colors.accentDeep }} value={value} />
    </View>
  );
}

function MenuRow({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <Pressable style={styles.menuRow}>
      <View style={styles.rowIcon}><Ionicons color={colors.text} name={icon} size={20} /></View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons color={colors.muted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 20, fontWeight: '800' },
  headerCopy: { flex: 1, gap: 3 },
  subtitle: { color: colors.muted, fontSize: 13 },
  editButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  proCard: { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  proIcon: { width: 46, height: 46, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  proCopy: { flex: 1, gap: 4 },
  proTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  proText: { color: colors.text, opacity: 0.7, fontSize: 11, lineHeight: 15 },
  tryPill: { backgroundColor: colors.text, borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 6 },
  tryText: { color: colors.white, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  section: { gap: 13 },
  planCard: { padding: 8 },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  planStat: { width: '50%', padding: 14, gap: 4 },
  planStatLabel: { color: colors.muted, fontSize: 11 },
  planStatValue: { color: colors.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  updateRow: { minHeight: 54, borderRadius: 18, backgroundColor: colors.neutralSoft, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  updateText: { flex: 1, color: colors.accentDeep, fontSize: 12, fontWeight: '700' },
  listCard: { padding: 8 },
  toggleRow: { minHeight: 78, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 11 },
  menuRow: { minHeight: 58, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowIcon: { width: 40, height: 40, borderRadius: 15, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 3 },
  rowLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  rowDetail: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  menuLabel: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 60 },
  wellnessNote: { flexDirection: 'row', gap: 9, paddingHorizontal: 8 },
  wellnessText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 },
  version: { color: colors.muted, fontSize: 10, textAlign: 'center' },
});
