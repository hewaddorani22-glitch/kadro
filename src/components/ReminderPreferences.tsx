import { usePresentationBlock } from '@/services/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { AppState, Linking, Pressable, Text, View } from 'react-native';
import { Card, PrimaryButton } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { useAccess } from '@/context/AccessContext';
import { useLanguage } from '@/i18n/LanguageProvider';
import { selectionHaptic } from '@/services/haptics';
import { getReminderPermission, getReminderSettings, MEAL_SLOTS, reminderSlots, updateReminder, type MealSlot, type ReminderOnboardingChoice, type ReminderPermission, type ReminderSettings, type SlotSetting } from '@/services/reminders';

const STEP_MINUTES = 15;
const pad = (value: number) => String(value).padStart(2, '0');

/** Shift by whole quarter hours and wrap around midnight. */
function shift(slot: SlotSetting, minutes: number): SlotSetting {
  const total = ((slot.hour * 60 + slot.minute + minutes) % 1440 + 1440) % 1440;
  const snapped = Math.round(total / STEP_MINUTES) * STEP_MINUTES % 1440;
  return { ...slot, hour: Math.floor(snapped / 60), minute: snapped % 60 };
}

/**
 * Meal reminders are chosen by tapping, not by typing "20:30" into a text
 * field. Each meal has a sensible default time that can be nudged in 15-minute
 * steps. Nothing is scheduled and no OS prompt appears until the user saves.
 */
export function ReminderPreferences({ onDone, initialSetup = false }: { onDone?: (choice: ReminderOnboardingChoice) => void; initialSetup?: boolean }) {
  const { colors } = useTheme();
  const access = useAccess();
  const { t } = useLanguage();
  const copy = t.captureExtras;
  const labels: Record<MealSlot, string> = { breakfast: copy.slotBreakfast, lunch: copy.slotLunch, dinner: copy.slotDinner, evening: copy.slotEvening };
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [slots, setSlots] = useState<Record<MealSlot, SlotSetting> | null>(null);
  const [singleSelection, setSingleSelection] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<ReminderPermission>('unavailable');
  const [busy, setBusy] = useState(false);
  usePresentationBlock(busy);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => { void Promise.all([getReminderSettings(), getReminderPermission()]).then(([value, status]) => {
      if (!active) return;
      setSettings(value); setPermission(status);
      const defaults = reminderSlots(value);
      // First onboarding offers one daily time. Preserve explicitly saved
      // multiple choices; the later trial/profile routine remains unrestricted.
      const savedMultiple = value.mode === 'meals' && MEAL_SLOTS.filter(slot => defaults[slot].enabled).length > 1;
      const limited = initialSetup && !savedMultiple;
      setSingleSelection(current => current ?? limited);
      setSlots(current => current ?? (limited && !value.enabled && value.mode !== 'meals'
        ? { ...defaults, lunch: { ...defaults.lunch, enabled: false } }
        : defaults));
    }).catch(() => { if (active) setError(copy.reminderError); }); };
    refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { active = false; subscription.remove(); };
  }, [copy.reminderError, initialSetup]);

  const update = (slot: MealSlot, next: SlotSetting) => {
    void selectionHaptic();
    setError(null);
    setSlots(current => {
      if (!current) return current;
      const updated = { ...current, [slot]: next };
      if (singleSelection && next.enabled) {
        for (const other of MEAL_SLOTS) {
          if (other !== slot) updated[other] = { ...current[other], enabled: false };
        }
      }
      return updated;
    });
  };
  const apply = async (enabled: boolean) => {
    if (busy || !settings || !slots) return;
    if (enabled && !MEAL_SLOTS.some(slot => slots[slot].enabled)) { setError(copy.chooseOne); return; }
    setBusy(true); setError(null);
    try {
      const first = MEAL_SLOTS.find(slot => slots[slot].enabled) ?? 'dinner';
      const next: ReminderSettings = { enabled, mode: 'meals', slots, hour: slots[first].hour, minute: slots[first].minute };
      const result = await updateReminder(next);
      setPermission(result.permission); setSettings({ ...next, enabled: result.enabled });
      if (result.permission === 'unavailable' || result.permission === 'error') setError(copy.reminderError);
      else if (result.enabled) onDone?.('enabled');
    } catch { setError(copy.reminderError); }
    finally { setBusy(false); }
  };

  return <Card>
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>{copy.reminderTitle}</Text>
    <Text style={{ color: colors.muted, fontSize: 16, lineHeight: 23 }}>{singleSelection ? copy.reminderSingleText : copy.reminderText}</Text>
    {access.ready && !access.canUse && !onDone ? <Text style={{ color: colors.muted, fontSize: 16 }}>{t.access.pausedReminder}</Text> : null}
    {slots ? <View style={{ gap: 10, marginTop: 8 }}>
      {MEAL_SLOTS.map(slot => {
        const value = slots[slot];
        const time = `${pad(value.hour)}:${pad(value.minute)}`;
        const stepButton = (minutes: number, label: string, icon: 'remove' | 'add') => (
          <Pressable accessibilityRole="button" accessibilityLabel={`${labels[slot]}: ${label}`} disabled={busy} onPress={() => update(slot, shift(value, minutes))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: colors.border }}>
            <Ionicons color={colors.text} name={icon} size={18} />
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
          </Pressable>
        );
        return <View key={slot} style={{ borderWidth: 1, borderColor: value.enabled ? colors.accentText : colors.border, borderRadius: 14, paddingHorizontal: 12, paddingBottom: value.enabled ? 10 : 0 }}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: value.enabled, disabled: busy }}
            accessibilityLabel={`${labels[slot]}, ${time}`}
            disabled={busy}
            onPress={() => update(slot, { ...value, enabled: !value.enabled })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54 }}
          >
            <Ionicons color={value.enabled ? colors.accentText : colors.muted} name={value.enabled ? 'checkmark-circle' : 'ellipse-outline'} size={24} />
            <Text style={{ flex: 1, color: colors.text, fontSize: 17, fontWeight: '600' }}>{labels[slot]}</Text>
            <Text accessibilityLiveRegion="polite" style={{ color: value.enabled ? colors.text : colors.muted, fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{time}</Text>
          </Pressable>
          {value.enabled ? <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            {stepButton(-STEP_MINUTES, copy.earlier, 'remove')}
            {stepButton(STEP_MINUTES, copy.later, 'add')}
          </View> : null}
        </View>;
      })}
    </View> : null}
    {permission === 'quiet' ? <Text style={{ color: colors.muted }}>{copy.quiet}</Text> : null}
    {permission === 'denied' ? <View><Text style={{ color: colors.muted }}>{copy.permissionDenied}</Text><PrimaryButton label={copy.settings} variant="ghost" onPress={() => void Linking.openSettings().catch(() => setError(copy.reminderError))} /></View> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.attention }}>{error}</Text> : null}
    <PrimaryButton disabled={busy || !settings || !slots || permission === 'unavailable'} label={busy ? t.common.moment : settings?.enabled ? copy.save : copy.activate} onPress={() => void apply(true)} />
    {settings?.enabled ? <PrimaryButton disabled={busy} variant="ghost" label={copy.disable} onPress={() => void apply(false)} /> : null}
    {onDone ? <PrimaryButton disabled={busy} variant="ghost" label={copy.skip} onPress={() => onDone('skipped')} /> : null}
  </Card>;
}
