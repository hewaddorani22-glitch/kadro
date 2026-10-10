# App Store and TestFlight handoff

This file is the source of truth for Kandro's iOS App Store setup. English is the primary App Store localization; German is the additional localization. Customer-facing listing text (name, subtitle, keywords, promotional text, description, What's New) lives in `store.config.json` and is checked by `npm run validate:store-listing`; do not copy it here, where it goes stale.

**Version state (09.10.2026):** `app.json` and `store.config.json` are at `1.0.4`; work happens on `growth/1.0.4-funnel`. App Store Connect confirms 1.0.3 is already live. The 1.0.4 draft is configured for manual release. Builds 38 and older must not be submitted (release gate in `AGENTS.md`), and App Review submission needs the owner's explicit approval for the exact build number. The build history is in `docs/ROADMAP.md`.

## Product metadata

- **Name:** `Kandro: AI Calorie Counter` (en-US) · `Kandro: Kalorienzähler & KI` (de-DE)
- **Subtitle:** `Food photo log & meal ideas` (en-US) · `Kalorien per Foto & Essensplan` (de-DE)
- **Positioning:** "Kandro sagt dir, was als Nächstes passt." / "Kandro tells you what fits next." Target group 18–30, DACH first.
- **Primary category:** Health & Fitness · **Secondary:** Food & Drink
- **Bundle ID:** `com.hewaddorani.kandro`
- **Apple Team ID:** `85S69CVRAY`
- **App Store Connect Apple ID:** `6808622187`
- **Version:** see `app.json` → `expo.version` (currently `1.0.4`)
- **SKU suggestion:** `kandro-ios-001`
- **Copyright:** `2026 Hewad Dorani`
- **Support URL:** `https://getkandro.com/en/support` · `https://getkandro.com/support`
- **Privacy Policy URL:** `https://getkandro.com/en/privacy` · `https://getkandro.com/privacy`

## Age rating: 16+ (set in App Store Connect)

Owner decision 09.10.2026: Kandro is for people aged 16 and over; there are no under-16 users, and 16–17-year-olds never get a calorie deficit.

- In App Store Connect → App Information → Age Rating, answer the questionnaire truthfully (**Health or Wellness Topics** present, no medical-treatment or objectionable-content descriptors), then set the age rating to **16+**. If the questionnaire computes a lower rating, use the developer override to raise it to 16+. Do not select the Kids category.
- The listing, privacy notice, terms and website already say 16+ (`store.config.json`, `src/i18n/legal.*.ts`, `site/`). The in-app age picker and server age checks are a separate change; confirm they enforce 16 before submitting a build with this rating.
- Older builds offered ages 14–15 with emailed guardian approval. The `guardian-consent` function stays deployed until those builds are retired, and the privacy notice still describes how it handles requests.

## Store listing

`store.config.json` holds both locales. Rules the validator enforces: name and subtitle at most 30 characters, keywords at most 100 bytes with no word repeated from the name or subtitle, promotional text at most 170 characters, the description opens with the next-meal promise (three dishes for the rest of the day, at home / supermarket / on the go), states 16+, states the free scope (search, barcode, daily balance, suggestions, history, three AI analyses) and the Pro scope (fair-use analyses, weekly review), carries the trial, renewal and cancellation terms, links Terms, Privacy and Apple's standard EULA, and does not mention access tests or variants.

## Screenshot package

Six 6.9-inch portrait screenshots per locale at `1320 × 2868` px in `app-store/screenshots/<locale>/`, uploaded in filename order: `01-adapt` (782 / 585 kcal left, now what?), `02-photo`, `03-voice`, `04-today`, `05-portions`, `06-plan`. Captions live in `app-store/compose/frames.json`.

**Rendered and visually inspected on 09.10.2026:** all twelve screenshots were regenerated with `python3 app-store/compose/render.py`. The new Today and starting-plan captures show the five-step onboarding and day selector. Native purchase/trial checks remain separate; the simulator captures do not prove them.

## CI repository variables

`.github/workflows/ci.yml` reads the provider identity that the legal pages and the release check need from repository variables instead of the workflow file. The three variables were created and read back against the production identity on 09.10.2026. They are managed under GitHub → repository → Settings → Secrets and variables → Actions → **Variables**:

| Variable | Value |
|---|---|
| `IMPRESSUM_NAME` | provider name as on getkandro.com/impressum |
| `IMPRESSUM_ADDRESS` | street, postcode and city as on the Impressum |
| `IMPRESSUM_EMAIL` | public contact email |

The "Check legal identity variables" step will fail if one is removed. CI runs on pushes to `main`, `audit/**` and `release/**`, and on pull requests.

## Native TestFlight gate

1. [x] Sign in to Expo and link the EAS project `@hewad/kandro`.
2. [x] Add the public Supabase production values in EAS and keep the local gateway override absent. AI/USDA secrets are live behind the authenticated Supabase gateway, never in the iOS bundle.
3. [x] Create the App Store Connect app record for bundle ID `com.hewaddorani.kandro`. Store metadata is versioned in `store.config.json`; review-contact details, subscription metadata, privacy nutrition labels, regulated-medical-device status, DSA trader details, and screenshots remain dashboard-only checks.
4. [x] Create `com.hewaddorani.kandro.pro.monthly` and `com.hewaddorani.kandro.pro.annual` as auto-renewable subscriptions, connect them to RevenueCat's `kandro_pro` entitlement, and add the public iOS RevenueCat SDK key to the production EAS environment.
5. [x] Historical builds 4 and 5 reached TestFlight. [ ] Create a fresh production build from the final audited commit without submitting it to App Review.
6. Deploy the reviewed server-authoritative analysis/entitlement and privacy-remediation migrations/functions before treating the fresh build as a release candidate.
7. For this loginless App Review flow, set RevenueCat **Sandbox Testing Access** to `Anybody`: the reviewer receives a fresh anonymous Supabase UUID that cannot be pre-allowlisted. Then run Apple-sandbox purchase, cancellation, server entitlement refresh, expiry/refund, pending and restore on a physical iPhone. The server must still accept only `store=app_store` plus the exact internal iOS app, product and entitlement IDs. Expo Go/RevenueCat Test Store (`rc_billing`) is UI simulation only and must remain unable to unlock hosted Pro.
8. Test camera permission denied/granted, network failure/retry, account linking, consent, analytics opt-out and live account deletion in that exact build.
9. Compare and, if needed, regenerate all six localized screenshot pairs only after that build passes.

## Remaining native evidence

- Create and process a fresh TestFlight candidate from the final audited commit; builds 4 and 5 are historical only.
- Native StoreKit sandbox test and App Store subscription metadata/review screenshots.
- At least 30 real iPhone meal-photo results reviewed against the confirmed food and portion, including poor light, blur, partial plates, multiple dishes, and offline retry.
- Native accessibility pass with VoiceOver, Dynamic Type, Reduce Motion, and contrast on a physical iPhone.
- Finish the DSA trader verification code, bank account and US tax questionnaire. These require the account holder's private verification/financial answers.
- Reconfirm the six localized screenshot pairs against the final binary, select the processed build and both subscriptions, then stop for the account holder's final inspection before App Review.

## Anbieter- und URL-Angaben

Diese Werte sind gesetzt und werden von `npm run validate:release` erzwungen:

| Feld | Wert |
|---|---|
| Anbieter | Hewad Dorani, Altenessener Str. 124, 45326 Essen |
| Rechtsform | Einzelunternehmen (Kleingewerbe), § 19 UStG |
| Kontakt | hewaddorani22@gmail.com |
| Privacy Policy URL | https://getkandro.com/privacy |
| Support URL | https://getkandro.com/support |
| Bedingungen | https://getkandro.com/terms |
| Impressum | https://getkandro.com/impressum |

Die Website liegt in `site/` und wird bei jedem Push automatisch über GitHub
Pages deployt. Sie ist bereits live unter
https://getkandro.com/ sowie als GitHub-Pages-Ursprung unter
https://hewaddorani22-glitch.github.io/kadro/.

Die Rechtstexte auf der Website und in der App sind wortgleich. Änderst du
einen, ändere beide.

The exact privacy-label mapping is in [APP_PRIVACY.md](./APP_PRIVACY.md). The reviewer-ready English note and the evidence checklist are in [APP_REVIEW_NOTES.md](./APP_REVIEW_NOTES.md). Run the production gate inside the EAS production environment before building: `npm run validate:release:production`.
