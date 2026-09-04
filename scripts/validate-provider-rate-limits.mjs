import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(root, path), 'utf8');
const [gateway, migration, gatewayEnv, runbook, revenueCat, webhook] = await Promise.all([
  read('supabase/functions/nutrition/index.ts'),
  read('supabase/migrations/20260904212500_rate_limit_nutrition_providers.sql'),
  read('supabase/.env.gateway.example'),
  read('docs/GATEWAY.md'),
  read('supabase/functions/_shared/revenuecat.mjs'),
  read('supabase/functions/revenuecat-webhook/index.ts'),
]);

assert.match(gateway, /consume_nutrition_provider_quota/,
  'hosted nutrition routes do not claim an atomic provider quota');
assert.match(gateway, /lookupBarcode\([^]*claimProviderRequest\(context\.supabaseAdmin, data\.user\.id, 'off_barcode', networkHash\)/,
  'barcode reaches Open Food Facts before its abuse claim');
assert.match(gateway, /searchFoods\([^]*claimProviderRequest\([^]*providerRoute[^]*networkHash/,
  'search does not supply its authenticated provider-abuse claim');
assert.match(gateway, /NUTRITION_RATE_LIMIT_SALT[\s\S]*trustedClientIp\(request[\s\S]*chain\.at\(-1\)[\s\S]*crypto\.subtle\.digest/,
  'account rotation is not bounded by a server-salted edge-proxy network fingerprint');
assert.match(gateway, /if \(!networkHash\)[\s\S]*status: 503/,
  'missing trustworthy network provenance must fail closed');
const search = gateway.slice(gateway.indexOf('async function searchFoods'), gateway.indexOf('async function searchOpenFoodFacts'));
const providerClaimIndex = search.indexOf("claimProvider ? () => claimProvider('off_search')");
assert.ok(search.indexOf('if (results.length)') < providerClaimIndex,
  'local BLS hits should remain unlimited and provider-free');
assert.ok(providerClaimIndex > 0,
  'a German cache miss can reach Open Food Facts before its abuse claim');
assert.ok(search.includes("claimProvider('usda_search')"),
  'an English cache miss can reach USDA before its abuse claim');
assert.match(gateway, /searchUsdaOnce\([^]*await claimUsda\?\.\(\)[^]*fetch\(`https:\/\/api\.nal\.usda\.gov/,
  'paid-analysis USDA resolution can fetch before claiming a provider unit');
assert.match(gateway, /usdaRows\([^]*await claimUsda\?\.\(\)[^]*fetch\(`https:\/\/api\.nal\.usda\.gov/,
  'free search can fetch USDA before claiming each provider unit');
assert.match(gateway, /searchOpenFoodFacts\([^]*await claimOff\?\.\(\)[^]*fetch\(url/,
  'food search can fetch Open Food Facts before claiming a provider unit');
assert.match(gateway, /lookupBarcode\([^]*await claimOff\?\.\(\)[^]*fetch\(`https:\/\/world\.openfoodfacts\.org/,
  'barcode lookup can fetch Open Food Facts before claiming a provider unit');
const analysisFlow = gateway.slice(gateway.indexOf("context.supabase.rpc('consume_analysis_quota')"), gateway.indexOf("const completed ="));
const paidFlow = analysisFlow;
assert.ok(analysisFlow.indexOf("claimProviderRequest(context.supabaseAdmin, data.user.id, 'usda_analysis'") < analysisFlow.indexOf("'consume_global_analysis_quota'"),
  'an exhausted USDA/network bucket can consume the non-refundable global AI-day breaker');
assert.ok(paidFlow.indexOf("claimProviderRequest(context.supabaseAdmin, data.user.id, 'usda_analysis'") < paidFlow.indexOf('mark_analysis_request_started'),
  'a paid model request can start before reserving first USDA capacity');
assert.match(paidFlow, /prepaidUsdaUnit[\s\S]*analyzePhoto\([^]*claimAnalysisUsda[\s\S]*analyzeDescription\([^]*claimAnalysisUsda/,
  'additional USDA calls in paid analyses do not consume provider units');
assert.match(gateway, /status: 429[\s\S]*'Retry-After': String\(retryAfter\)[\s\S]*code: 'provider_rate_limited'/,
  'provider throttling needs a stable error code and Retry-After response');
assert.match(gatewayEnv, /^NUTRITION_RATE_LIMIT_SALT=$/m,
  'the required server-only network salt is absent from the gateway environment template');
assert.match(runbook, /NUTRITION_RATE_LIMIT_SALT/,
  'the required provider-rate salt is absent from the deployment runbook');

assert.match(migration, /primary key \(route, subject_key\)/,
  'provider quota counters are not serialized by route and subject');
assert.match(migration, /pg_advisory_xact_lock[\s\S]*:global[\s\S]*pg_advisory_xact_lock[\s\S]*network_key[\s\S]*pg_advisory_xact_lock[\s\S]*user_key/,
  'global, network and user provider counters are not locked atomically in a stable order');
assert.match(migration, /for subject_index[\s\S]*subject_row\.request_count >= subject_limits\[subject_index\][\s\S]*for subject_index[\s\S]*insert into private\.nutrition_provider_rate_limits/,
  'a rejected provider request can still consume a quota slot');
assert.match(migration, /p_route = 'usda_search'[\s\S]*interval '1 hour'[\s\S]*global_limit := 100[\s\S]*p_route = 'usda_analysis'[\s\S]*global_limit := 300/,
  'USDA search and analysis do not have separate hourly request-unit budgets');
assert.match(migration, /p_route = 'off_search'[\s\S]*interval '1 minute'[\s\S]*global_limit := 4[\s\S]*global_limit := 7/,
  'Open Food Facts search/read budgets exceed the published shared-egress limits');
assert.match(migration, /double burst[\s\S]*800[\s\S]*double-burst[\s\S]*8 and 14/,
  'fixed-window boundary bursts are not proven below provider limits');
assert.match(migration, /'user:' \|\| pg_catalog\.md5\(p_user_id::text\)[\s\S]*'network:' \|\| p_network_hash/,
  'provider rate storage persists raw account identifiers');
assert.doesNotMatch(migration, /^\s*(?:query|barcode_value|search_term)\s+text/gm,
  'provider rate storage must not persist a food query or barcode');
assert.match(migration, /updated_at < retention_clock - interval '1 hour'[\s\S]*'17 \* \* \* \*'/,
  'an hourly cleanup needs a one-hour threshold to honor the disclosed two-hour maximum');
assert.match(migration, /revoke all on function public\.consume_nutrition_provider_quota\(uuid, text, text\)[\s\S]*from public, anon, authenticated[\s\S]*grant execute[\s\S]*to service_role/,
  'untrusted clients can invoke the provider quota with arbitrary identities');

assert.match(migration, /route in \([^)]*'revenuecat'[^)]*\)/,
  'RevenueCat and nutrition providers must share the same server-only counter table');
assert.match(migration, /create function private\.consume_revenuecat_provider_quota\([\s\S]*p_request_units smallint default 1[\s\S]*subject_limits smallint\[\] := array\[200::smallint\]/,
  'RevenueCat does not have an atomic batch-capable 200/minute project reservation');
assert.match(migration, /480 Customer Information requests\/minute\/project[\s\S]*boundary burst[\s\S]*400/,
  'RevenueCat fixed-window double burst is not proven below its published 480/minute project limit');
assert.match(migration, /subject_row\.request_count \+ p_request_units > subject_limits\[subject_index\][\s\S]*request_count \+ p_request_units/,
  'RevenueCat alias batches are not reserved all-or-nothing as request units');
assert.match(migration, /subject_limits := subject_limits \|\| array\[10::smallint, 3::smallint\]/,
  'public RevenueCat refreshes are not bounded by both source network and account');
assert.match(migration, /revoke all on function public\.consume_revenuecat_provider_quota\(uuid, text, smallint\)[\s\S]*from public, anon, authenticated[\s\S]*grant execute[\s\S]*to service_role/,
  'untrusted clients can mint RevenueCat provider reservations');
assert.match(revenueCat, /typeof claimRequest !== 'function'[\s\S]*await claimRequest\(\);[\s\S]*response = await fetchImpl/,
  'the shared RevenueCat helper can fetch without a mandatory immediately-adjacent claim');
assert.match(gateway, /consume_revenuecat_provider_quota[\s\S]*p_user_id: userId[\s\S]*p_network_hash: networkHash[\s\S]*p_request_units: 1/,
  'public RevenueCat refresh does not claim user, network and global capacity');
assert.match(gateway, /if \(!networkHash\)[\s\S]*entitlement_verification_unavailable[\s\S]*consume_revenuecat_provider_quota/,
  'missing trusted source provenance can reach RevenueCat');
assert.ok((gateway.match(/refreshRevenueCatAccess\(context\.supabaseAdmin, data\.user\.id, networkHash\)/g) ?? []).length >= 2,
  'the stale-analysis entitlement path can bypass the same RevenueCat claim as public refresh');
assert.ok(webhook.indexOf('reserveRevenueCatProviderRequests(validated.event.userIds.length)') < webhook.indexOf('Promise.all('),
  'a webhook can start a partial alias batch before reserving every RevenueCat unit');
assert.match(webhook, /consume_revenuecat_provider_quota[\s\S]*p_user_id: null[\s\S]*p_network_hash: null[\s\S]*p_request_units: requestUnits/,
  'webhooks do not share the project-wide RevenueCat bucket used by public refreshes');
assert.match(webhook, /reservedRequestTickets -= 1[\s\S]*claimRequest: claimReservedRequest/,
  'each webhook alias fetch must consume one pre-reserved local request ticket');

console.log('Provider abuse limits passed: nutrition and RevenueCat requests are atomically bounded before fetch.');
