// Actual enrollment screen plus the additive SQL contract; zero network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20261004145423_restore_verified_new_adult_paywall.sql');
assert.match(migration, /lock table private\.paywall_assignments in access exclusive mode/);
assert.match(migration, /public_cohort_requires_explicit_preservation_review/);
assert.match(migration, /pause_public_enrollment_before_restore/);
assert.match(migration, /u\.is_anonymous is distinct from false or u\.email_confirmed_at is null/);
assert.match(migration, /exists\(select 1 from public\.meals where user_id=p_user_id\)/);
assert.match(migration, /coalesce\(e\.free_completed,0\)>0/);
assert.match(migration, /get_byte\(pg_catalog\.uuid_send\(pg_catalog\.gen_random_uuid\(\)\),0\)<128/);
assert.doesNotMatch(migration, /delete from|update private\.paywall_assignments|update public\.analysis_access|alter table/i);
function fixture() {
  const slots = []; let cursor = 0; const enrolled = [], navigated = [];
  const react = { useState(initial) { const n=cursor++; if (!(n in slots)) slots[n]=initial; return [slots[n],value=>{slots[n]=typeof value==='function'?value(slots[n]):value;}]; } };
  const jsx=(type,props)=>({type,props});
  const access={ ready:true, enrollmentPending:true, async enroll(value){enrolled.push(value);} };
  const mocks={ react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{Text:'Text',Pressable:'Pressable'},'expo-router':{Redirect:'Redirect',useRouter:()=>({replace:path=>navigated.push(path)})},'@/components/ui':{Screen:'Screen',Card:'Card',PrimaryButton:'Button'},'@/components/AccountLinkCard':{AccountLinkCard:'ExistingOptionalAccountLink'},'@/context/AccessContext':{useAccess:()=>access},'@/context/ThemeContext':{useTheme:()=>({colors:{}})},'@/i18n/LanguageProvider':{useLanguage:()=>({t:{access:{identityTitle:'Access',identityBody:'Optional',firstUse:'First use',identityContinue:'Check',identitySkip:'Skip',verify:'Retry'},common:{moment:'Busy'}}})}};
  const compiled=ts.transpileModule(read('src/app/access-setup.tsx'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const module={exports:{}};new Function('require','module','exports',compiled)(name=>{assert.ok(name in mocks,name);return mocks[name]},module,module.exports);
  return {enrolled,navigated,render(){cursor=0;return module.exports.default();}};
}
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(Array.isArray(n.props?.children)?n.props.children:[n.props?.children]).flatMap(c=>Array.isArray(c)?c.flatMap(nodes):nodes(c))];
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
const f=fixture();let tree=f.render();assert.deepEqual(f.enrolled,[]);assert.ok(nodes(tree).some(n=>n.type==='ExistingOptionalAccountLink'));
assert.equal(nodes(tree).find(n=>n.props?.accessibilityRole==='checkbox').props.accessibilityState.checked,false);
nodes(tree).find(n=>n.type==='Button'&&n.props.label==='Check').props.onPress();await flush();assert.deepEqual(f.enrolled,[false]);
const g=fixture();tree=g.render();nodes(tree).find(n=>n.props?.accessibilityRole==='checkbox').props.onPress();tree=g.render();nodes(tree).find(n=>n.type==='Button'&&n.props.label==='Check').props.onPress();await flush();assert.deepEqual(g.enrolled,[true]);
const h=fixture();tree=h.render();nodes(tree).find(n=>n.props?.accessibilityRole==='checkbox').props.onPress();tree=h.render();nodes(tree).find(n=>n.type==='Button'&&n.props.label==='Skip').props.onPress();await flush();assert.deepEqual(h.enrolled,[false]);
console.log('PASS explicit first use, optional existing account link, skip exclusions, 50/50 server rule and additive deployment gates; no network. Actual SQL/RPC proof is in the own local database report.');
