import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
// Owner TestFlight 1.0.3 (24) feedback: "3l Milch und 2 Toast" showed "Toast ?",
// typed reminder times, hard paywall never reached. Real modules; mocked
// native boundaries; zero external HTTP.
globalThis.fetch = async () => { throw new Error('TEST_EXTERNAL_HTTP_BLOCKED'); };
const shared = new URL('../supabase/functions/_shared/', import.meta.url);
const bls = await import(new URL('bls-reference.mjs', shared));
const search = await import(new URL('bls-search.mjs', shared));
const amounts = await import(new URL('description-amounts.mjs', shared));
function compile(path, deps = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(name => { assert.ok(name in deps, `Unmocked dependency ${name}`); return deps[name]; }, module, module.exports);
  return module.exports;
}
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('PASS', name); };

await test('plain toast from a description resolves to ordinary BLS wheat toast, not an unresolved row', () => {
  for (const searchTermEn of ['toast', 'toast bread', 'white toast bread', 'wheat toast', 'toast slices']) {
    const facts = bls.resolveBlsFacts({ name: 'Toast', searchTermEn, referenceKey: 'other' });
    assert.equal(facts?.referenceId, 'B314000', searchTermEn);
    assert.equal(facts.estimatedReference, true);
    assert.equal(bls.requiresFoodIdentityCorrection({ name: 'Toast', searchTermEn }), false);
  }
  assert.equal(bls.resolveBlsFacts({ name: 'Toast', searchTermEn: 'toasted white bread' })?.referenceId, 'B314072');
  assert.equal(bls.resolveBlsFacts({ name: 'Vollkorntoast', searchTermEn: 'whole wheat toast' })?.referenceId, 'B111200');
  // Gluten-free and dish rows keep their own identity.
  assert.equal(bls.resolveBlsFacts({ name: 'Toast', searchTermEn: 'gluten-free toast' })?.referenceId ?? null, bls.resolveExactBlsFacts('gluten-free toast')?.referenceId ?? null);
});

await test('"3l Milch und 2 Toast" keeps the milk volume and leaves the toast count to the model', () => {
  const parsed = amounts.descriptionAmounts('3l Milch und 2 Toast');
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].milkVolumeMl, 3000);
  const detection = { title: 'Milch, Toast', confidence: 'high', items: [
    { name: 'Milch', searchTermEn: 'milk', referenceKey: 'other', estimatedGrams: 250, estimatedGramsLow: 200, estimatedGramsHigh: 300, preparation: 'unknown', confidence: 'high', optional: false },
    { name: 'Toast', searchTermEn: 'toast', referenceKey: 'other', estimatedGrams: 50, estimatedGramsLow: 40, estimatedGramsHigh: 60, preparation: 'unknown', confidence: 'high', optional: false, pieceCount: 2, pieceLabel: 'Scheibe' },
  ] };
  const applied = amounts.applyDescriptionAmounts(detection, '3l Milch und 2 Toast');
  assert.equal(applied.items[0].estimatedGrams, 3090);
  assert.equal(bls.resolveBlsFacts(applied.items[1])?.referenceId, 'B314000');
});

await test('search for Toast/Toastbrot lists ordinary wheat toast first, gluten-free not on top', () => {
  for (const query of ['Toast', 'toast', 'Toastbrot']) {
    const results = search.searchBlsCatalog(query, 'de', 15);
    assert.equal(results[0].code, 'B314000', query);
    assert.notEqual(results[0].code, 'B8A8000');
    assert.ok(results.some(row => row.code === 'B111200'));
  }
  // Explicit requests keep their identity.
  assert.equal(search.searchBlsCatalog('Toastbrot glutenfrei', 'de', 5)[0].code, 'B8A8000');
});

const memory = new Map();
const storage = { getItem: async key => memory.get(key) ?? null, setItem: async (key, value) => { memory.set(key, value); }, removeItem: async key => { memory.delete(key); }, multiRemove: async keys => { keys.forEach(key => memory.delete(key)); } };
const scheduled = new Map();
let permission = 2;
const notifications = { IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 }, SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date' }, setNotificationHandler() {},
  getPermissionsAsync: async () => ({ ios: { status: permission }, granted: permission === 2, canAskAgain: permission === 0 }), requestPermissionsAsync: async () => ({ ios: { status: 2 }, granted: true }),
  cancelScheduledNotificationAsync: async id => { scheduled.delete(id); }, dismissNotificationAsync: async () => undefined, scheduleNotificationAsync: async record => { scheduled.set(record.identifier, record); return record.identifier; } };
const copy = { notificationTitle: 'Ein Moment für dich', notificationBody: 'generic', notifyBreakfast: 'b', notifyLunch: 'l', notifyDinner: 'd', notifyEvening: 'e', reminderTitle: 'r', slotBreakfast: 'Frühstück', slotLunch: 'Mittagessen', slotDinner: 'Abendessen', slotEvening: 'Tagesabschluss',
  mealReminderLeft: (kcal, protein) => `Noch ${kcal} kcal und ${protein} g Protein übrig`, mealReminderLeftKcal: kcal => `Noch ${kcal} kcal übrig · Protein geschafft`, mealReminderIdeas: slot => `3 Ideen fürs ${slot} warten auf dich.`, reengageBody: 'Kein Stress.' };
const reminders = compile('src/services/reminders.ts', { '@react-native-async-storage/async-storage': storage, 'expo-notifications': notifications, 'react-native': { Platform: { OS: 'ios' } }, '@/i18n/active': { getDictionary: () => ({ captureExtras: copy }) } });
const intents = compile('src/services/captureIntents.ts');

const slotIds = () => [...new Set([...scheduled.keys()].map(id => id.replace(/-\d$/, '')))].sort();
await test('meal reminders schedule each tapped meal for the coming week with its own time, title and capture mode', async () => {
  reminders.setReminderDayStatus(null);
  const slots = { ...reminders.DEFAULT_SLOTS, breakfast: { enabled: true, hour: 7, minute: 45 }, evening: { enabled: true, hour: 21, minute: 0 } };
  const result = await reminders.updateReminder({ enabled: true, mode: 'meals', slots, hour: 7, minute: 45 });
  assert.equal(result.enabled, true);
  assert.deepEqual(slotIds(), ['kandro-reminder-breakfast', 'kandro-reminder-dinner', 'kandro-reminder-evening', 'kandro-reminder-lunch']);
  assert.equal(scheduled.size, 4 * reminders.SLOT_OCCURRENCES);
  const breakfast = scheduled.get('kandro-reminder-breakfast');
  assert.equal(breakfast.trigger.type, 'date'); assert.equal(breakfast.trigger.date.getHours(), 7); assert.equal(breakfast.trigger.date.getMinutes(), 45);
  assert.equal(breakfast.content.body, 'b'); assert.equal(breakfast.content.data.mode, 'photo');
  // Meal reminders name their meal; the generic title stays only for the old single daily reminder.
  assert.ok([...scheduled.values()].every(row => row.content.title !== copy.notificationTitle));
  assert.equal(breakfast.content.title, 'Frühstück');
  const days = [...scheduled.keys()].filter(id => id.startsWith('kandro-reminder-lunch')).map(id => scheduled.get(id).trigger.date.getTime()).sort((a, b) => a - b);
  assert.equal(new Set(days.map(time => new Date(time).toDateString())).size, reminders.SLOT_OCCURRENCES, 'one per day, never two on the same day');
  assert.equal(scheduled.get('kandro-reminder-evening').content.data.mode, 'description');
  const stored = await reminders.getReminderSettings();
  assert.equal(stored.mode, 'meals'); assert.equal(stored.slots.breakfast.minute, 45);
  // Turning one meal off removes only that notification.
  await reminders.updateReminder({ ...stored, slots: { ...stored.slots, lunch: { ...stored.slots.lunch, enabled: false } } });
  assert.ok(![...scheduled.keys()].some(id => id.startsWith('kandro-reminder-lunch'))); assert.ok(scheduled.has('kandro-reminder-dinner'));
  // No meal selected means nothing scheduled, never an empty "enabled" state.
  const none = Object.fromEntries(reminders.MEAL_SLOTS.map(slot => [slot, { ...stored.slots[slot], enabled: false }]));
  assert.equal((await reminders.updateReminder({ ...stored, slots: none })).enabled, false);
  assert.equal(scheduled.size, 0);
  await assert.rejects(reminders.updateReminder({ ...stored, slots: { ...stored.slots, dinner: { enabled: true, hour: 25, minute: 0 } } }));
});

await test("today's remaining meal reminders carry today's real numbers and open Plan; done or over days stay neutral", async () => {
  const RealDate = Date; const fixed = new RealDate('2026-10-09T09:00:00');
  globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed.getTime(); } };
  try {
    const key = '2026-10-09';
    const slots = { ...reminders.DEFAULT_SLOTS, breakfast: { enabled: true, hour: 8, minute: 0 }, lunch: { enabled: true, hour: 12, minute: 30 }, dinner: { enabled: true, hour: 18, minute: 30 }, evening: { enabled: true, hour: 20, minute: 30 } };
    reminders.setReminderDayStatus({ day: key, remainingCalories: 1234.4, remainingProtein: 61.6, loggedTypes: ['Breakfast'] });
    await reminders.updateReminder({ enabled: true, mode: 'meals', slots, hour: 12, minute: 30 });
    const lunch = scheduled.get('kandro-reminder-lunch');
    assert.equal(lunch.content.title, 'Noch 1234 kcal und 62 g Protein übrig');
    assert.equal(lunch.content.body, '3 Ideen fürs Mittagessen warten auf dich.');
    assert.deepEqual(lunch.content.data, { route: '/plan' });
    assert.equal(scheduled.get('kandro-reminder-dinner').content.body, '3 Ideen fürs Abendessen warten auf dich.');
    // 08:00 already passed: breakfast starts tomorrow, neutral, because tomorrow's numbers are unknown.
    const breakfast = scheduled.get('kandro-reminder-breakfast');
    assert.equal(breakfast.trigger.date.getDate(), 10); assert.equal(breakfast.content.title, 'Frühstück'); assert.equal(breakfast.content.data.route, '/capture');
    assert.equal(scheduled.get('kandro-reminder-lunch-1').content.title, 'Mittagessen', 'later days stay neutral');
    assert.equal(scheduled.get('kandro-reminder-evening').content.data.mode, 'description', 'the end-of-day check stays a neutral capture');
    // Lunch already logged: no lunch nudge today; tomorrow's lunch remains.
    reminders.setReminderDayStatus({ day: key, remainingCalories: 900, remainingProtein: 0, loggedTypes: ['Lunch'] });
    await reminders.syncEveningReminder();
    assert.ok(!scheduled.has('kandro-reminder-lunch')); assert.ok(scheduled.has('kandro-reminder-lunch-1'));
    assert.equal(scheduled.get('kandro-reminder-dinner').content.title, 'Noch 900 kcal übrig · Protein geschafft');
    // Over budget or nearly complete: neutral, never "3 ideas", never negative numbers.
    for (const remainingCalories of [-300, 150]) {
      reminders.setReminderDayStatus({ day: key, remainingCalories, remainingProtein: 20, loggedTypes: [] });
      await reminders.syncEveningReminder();
      const dinner = scheduled.get('kandro-reminder-dinner');
      assert.equal(dinner.content.title, 'Abendessen'); assert.equal(dinner.content.body, 'd'); assert.equal(dinner.content.data.route, '/capture');
    }
    // A stale status from yesterday never personalises today.
    reminders.setReminderDayStatus({ day: '2026-10-08', remainingCalories: 1500, remainingProtein: 80, loggedTypes: [] });
    await reminders.syncEveningReminder();
    assert.equal(scheduled.get('kandro-reminder-dinner').content.title, 'Abendessen');
  } finally { globalThis.Date = RealDate; reminders.setReminderDayStatus(null); }
});

await test('re-engagement: one note three days after the last save, moved by each save, respecting switch and permission', async () => {
  const day = 86_400_000; const now = Date.now();
  const saved = new Date(now); saved.setHours(13, 0, 0, 0);
  assert.equal(await reminders.syncReengagementReminder(saved.getTime()), true);
  const row = scheduled.get('kandro-reengage');
  assert.equal(row.content.body, 'Kein Stress.'); assert.equal(row.content.title, undefined); assert.deepEqual(row.content.data, { route: '/capture', mode: 'photo' });
  assert.equal(row.trigger.date.getTime(), saved.getTime() + 3 * day);
  const later = saved.getTime() + day; await reminders.syncReengagementReminder(later);
  assert.equal(scheduled.get('kandro-reengage').trigger.date.getTime(), later + 3 * day, 'each save moves the single note');
  assert.equal([...scheduled.keys()].filter(id => id === 'kandro-reengage').length, 1);
  const lateNight = new Date(now); lateNight.setHours(23, 30, 0, 0);
  assert.equal(reminders.reengagementDate(lateNight.getTime()).getHours(), 18, 'a late-night save is answered in the afternoon');
  // Once the moment passed nothing new is scheduled until the next save: no nagging loop.
  assert.equal(await reminders.syncReengagementReminder(now - 4 * day), false); assert.ok(!scheduled.has('kandro-reengage'));
  await reminders.setReengagementEnabled(false, saved.getTime()); assert.ok(!scheduled.has('kandro-reengage'));
  await reminders.setReengagementEnabled(true, saved.getTime()); assert.ok(scheduled.has('kandro-reengage'));
  permission = 1; assert.equal(await reminders.syncReengagementReminder(saved.getTime()), false); assert.ok(!scheduled.has('kandro-reengage')); permission = 2;
  assert.equal(await reminders.syncReengagementReminder(null), false);
});

await test('the end-of-day offer enables exactly the one evening reminder it promises', async () => {
  reminders.setReminderDayStatus(null);
  await reminders.updateReminder({ enabled: false, mode: 'meals', slots: { ...reminders.DEFAULT_SLOTS }, hour: 12, minute: 30 });
  assert.equal(await reminders.enableEveningCheckIn(), true);
  assert.deepEqual(slotIds(), ['kandro-reminder-evening']);
  const stored = await reminders.getReminderSettings();
  assert.deepEqual(reminders.MEAL_SLOTS.filter(slot => stored.slots[slot].enabled), ['evening']);
  const de = fs.readFileSync(new URL('../src/i18n/de.ts', import.meta.url), 'utf8');
  assert.ok(!de.includes('Zwei ruhige Nachrichten'), 'the offer must not promise two messages');
  assert.ok(de.includes("reminderText: 'Eine ruhige Nachricht am Abend"));
});

await test('an existing single daily reminder is offered as the dinner slot', () => {
  const slots = reminders.reminderSlots({ enabled: true, hour: 19, minute: 15, mode: 'daily' });
  assert.deepEqual(slots.dinner, { enabled: true, hour: 19, minute: 15 });
  assert.equal(slots.lunch.enabled, false);
});

await test('notification taps open only own reminders with a fixed photo/description/search mode', () => {
  const tap = (identifier, mode) => intents.reminderIntent({ actionIdentifier: 'expo.modules.notifications.actions.DEFAULT', notification: { date: 1, request: { identifier, content: { data: { route: '/capture', mode } } } } });
  assert.equal(tap('kandro-reminder-breakfast', 'photo')?.mode, 'photo');
  assert.equal(tap('kandro-reminder-evening', 'description')?.mode, 'description');
  assert.equal(tap('kandro-meal-reminder', 'search')?.mode, 'search');
  assert.equal(tap('kandro-reminder-lunch', 'barcode'), null);
  assert.equal(tap('someone-else', 'photo'), null);
  for (const id of reminders.REMINDER_IDS) assert.ok(tap(id, 'search'), id);
});

await test('open paywall test keeps every protection except the linked-account requirement', () => {
  const sql = fs.readFileSync(new URL('../supabase/migrations/20261004160156_reopen_paywall_new_installs.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /is_anonymous|email_confirmed_at/);
  for (const kept of ["then 'configuration'", "then 'existing'", "then 'age'", "then 'prior_use'", "then 'pro'", "then 'offer'"]) assert.ok(sql.includes(kept), kept);
  assert.ok(/<128 then 'A' else 'B'/.test(sql), '50/50 split');
  assert.ok(!/public_enabled\s*=\s*true/.test(sql), 'migration must not switch the experiment on');
  const screen = fs.readFileSync(new URL('../src/app/access-setup.tsx', import.meta.url), 'utf8');
  assert.ok(screen.includes('void finish(true)') && !screen.includes('AccountLinkCard'), 'a fresh install enrolls automatically without a linking detour');
});

const nutrition = await import(new URL('nutrition.mjs', shared));
await test('everyday drinks may be described in ml/l and become an editable, labelled estimate', () => {
  const cases = { '500 ml Cola': 520, '0,5 l Bier': 505, '300 ml Apfelschorle': 312, '500 ml Wasser': 500, 'a glass of 250 ml orange juice': 260, '200 ml Kaffee': 200, '150 ml Rotwein': 148.5 };
  for (const [text, grams] of Object.entries(cases)) {
    const [amount] = amounts.descriptionAmounts(text);
    assert.equal(amount.grams, grams, text); assert.ok(amount.drinkVolumeMl > 0, text); assert.equal(amount.milkVolumeMl, undefined, text);
  }
  const detection = { title: 'Cola', confidence: 'high', items: [{ name: 'Cola', searchTermEn: 'cola', estimatedGrams: 330, estimatedGramsLow: 330, estimatedGramsHigh: 330, confidence: 'high', optional: false }] };
  const applied = amounts.applyDescriptionAmountsTolerant(detection, '500 ml Cola');
  assert.equal(applied.items[0].estimatedGrams, 520); assert.equal(applied.items[0].confidence, 'medium');
  assert.ok(nutrition.buildAccuracyWarnings(applied, []).includes('drink_volume_estimated'));
});

await test('an amount that cannot be bound safely keeps the model estimate instead of failing the whole description', () => {
  const detection = { title: 'Reis, Hähnchen', confidence: 'high', items: [{ name: 'Reis', searchTermEn: 'rice cooked', estimatedGrams: 150, confidence: 'high' }, { name: 'Hähnchen', searchTermEn: 'chicken breast', estimatedGrams: 120, confidence: 'high' }] };
  for (const text of ['100 g Reis mit Hähnchen', '200 ml Öl', '200 ml Hafermilch', 'Reis und Hähnchen, zusammen 300 g', '6000 g Reis']) {
    assert.throws(() => amounts.applyDescriptionAmounts(detection, text));
    const tolerant = amounts.applyDescriptionAmountsTolerant(detection, text);
    assert.equal(tolerant.amountFallback, true, text);
    assert.deepEqual(tolerant.items.map(item => item.estimatedGrams), [150, 120]);
    assert.ok(tolerant.items.every(item => item.confidence === 'medium'));
    assert.ok(nutrition.buildAccuracyWarnings(tolerant, []).includes('amount_estimated'));
  }
  // A clear amount still binds exactly and raises no fallback warning.
  const exact = amounts.applyDescriptionAmountsTolerant(detection, '200 g Reis');
  assert.equal(exact.items[0].estimatedGrams, 200); assert.equal(exact.amountFallback, undefined);
  // Non-amount failures are not swallowed.
  assert.throws(() => amounts.applyDescriptionAmountsTolerant(null, '200 g Reis'));
});

await test('the example (demo) meal is shown but never saved to the diary', () => {
  const source = fs.readFileSync(new URL('../src/app/result.tsx', import.meta.url), 'utf8');
  assert.ok(/const demo = scanMode === 'demo';/.test(source));
  assert.ok(/if \(demo\) return Promise\.resolve\(true\);\s*if \(saveInFlight\.current\)/.test(source), 'demo short-circuits before logScannedMeal');
});

await test('live finding 04.10.: "ohne Sauce mit 200 g Reis" keeps the rice and "gebraten/gebratene" never duplicates the chicken', () => {
  const text = '150 g Hähnchenbrust gebraten ohne Sauce mit 200 g Reis';
  assert.deepEqual(amounts.descriptionAmounts(text).map(amount => [amount.identity, amount.grams]), [['Hähnchenbrust gebraten', 150], ['Reis', 200]]);
  const detection = { title: 'x', confidence: 'high', items: [
    { name: 'gebratene Hähnchenbrust', searchTermEn: 'fried chicken breast', estimatedGrams: 140, confidence: 'high', preparation: 'fried' },
    { name: 'Reis', searchTermEn: 'cooked rice', estimatedGrams: 180, confidence: 'high' },
  ] };
  const result = amounts.applyDescriptionAmountsTolerant(detection, text);
  assert.deepEqual(result.items.map(item => [item.name, item.estimatedGrams]), [['gebratene Hähnchenbrust', 150], ['Reis', 200]]);
  assert.equal(result.amountFallback, undefined);
});

console.log(JSON.stringify({ passed, scope: 'Beta 24 feedback: toast lookup/search, drink volumes, tolerant amounts, meal-slot reminders, paywall enrollment, demo not saved; zero external HTTP' }));
