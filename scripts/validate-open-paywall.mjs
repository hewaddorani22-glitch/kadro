// Owner decision 04.10.2026: the paywall test is open to new adult installs,
// linked or anonymous. Protections for existing, minor and paying users stay.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20261004160156_reopen_paywall_new_installs.sql');
assert.doesNotMatch(migration, /is_anonymous|email_confirmed_at/, 'an anonymous new install must be eligible');
assert.match(migration, /u\.created_at<c\.starts_at or exists\(select 1 from public\.meals where user_id=p_user_id\)/, 'existing accounts stay excluded');
assert.match(migration, /coalesce\(e\.free_completed,0\)>0/, 'prior free use stays excluded');
assert.match(migration, /p\.age<18 or p_age_confirmed is distinct from true/, 'minors stay excluded');
assert.match(migration, /then 'pro'/, 'active subscribers stay excluded');
assert.match(migration, /if exists\(select 1 from private\.paywall_assignments where user_id=p_user_id\) then return/, 'assignments are never re-drawn');
assert.match(migration, /get_byte\(pg_catalog\.uuid_send\(pg_catalog\.gen_random_uuid\(\)\),0\)<128/, '50/50 split');
assert.doesNotMatch(migration, /delete from|update private\.paywall_assignments|alter table/i);

function fixture(ready = true, pending = true) {
  const slots = []; let cursor = 0; const effects = []; const enrolled = [], navigated = [];
  const react = {
    useState(initial) { const n = cursor++; if (!(n in slots)) slots[n] = initial; return [slots[n], value => { slots[n] = typeof value === 'function' ? value(slots[n]) : value; }]; },
    useRef(initial) { const n = cursor++; if (!(n in slots)) slots[n] = { current: initial }; return slots[n]; },
    useEffect(fn) { effects.push(fn); },
  };
  const jsx = (type, props) => ({ type, props });
  const access = { ready, enrollmentPending: pending, async enroll(value) { enrolled.push(value); } };
  const mocks = { react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, 'react-native': { Text: 'Text', View: 'View' }, '@/components/KandroMark': { KandroMark: 'KandroMark' }, 'expo-router': { Redirect: 'Redirect', useRouter: () => ({ replace: path => navigated.push(path) }) }, '@/components/ui': { Screen: 'Screen', PrimaryButton: 'Button' }, '@/context/AccessContext': { useAccess: () => access }, '@/context/ThemeContext': { useTheme: () => ({ colors: {} }) }, '@/i18n/LanguageProvider': { useLanguage: () => ({ t: { access: { identityTitle: 'Access', preparing: 'Preparing', verify: 'Retry', identityContinue: 'Check', identitySkip: 'Skip', settingUp: 'Setting up' }, common: { moment: 'Busy' } } }) } };
  const compiled = ts.transpileModule(read('src/app/access-setup.tsx'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} }; new Function('require', 'module', 'exports', compiled)(name => { assert.ok(name in mocks, name); return mocks[name]; }, module, module.exports);
  return { enrolled, navigated, effects, render() { cursor = 0; effects.length = 0; return module.exports.default(); } };
}
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); await new Promise(r => setTimeout(r, 350)); for (let i = 0; i < 5; i++) await Promise.resolve(); };
const f = fixture(); f.render(); f.effects.forEach(fn => fn()); await flush();
assert.deepEqual(f.enrolled, [true], 'a fresh install enrolls automatically as first use, without a checkbox');
assert.deepEqual(f.navigated, ['/(tabs)/today']);
f.render(); f.effects.forEach(fn => fn()); await flush();
assert.deepEqual(f.enrolled, [true], 'enrollment runs once');
const g = fixture(false); g.render(); g.effects.forEach(fn => fn()); await flush();
assert.deepEqual(g.enrolled, [], 'no enrollment before access is ready');
console.log('PASS open cohort for new adult installs; existing/minor/pro/prior-use exclusions, stable assignment, 50/50 split and automatic single enrollment.');
