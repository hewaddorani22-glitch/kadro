# Description, search and UI follow-up, 2026-09-05

## Fixes

- Show original description on analyzing and confirm, including accessible text.
- Text rejection has DE/EN description guidance, not camera/image advice.
- Editing returns to the description mode with the original input preserved.
- Do not reject identifiable text due to photo-only clarity or plate count.
  Unidentifiable/no-food input is still rejected; unspecified portions remain
  estimates and explicit sauces must remain included.
- Haferflocken matches spaced BLS "Hafer Flocken" including cooked variants;
  oats/rolled oats and banana plurals are supported. Basic raw/cooked/dried
  variants precede compound dishes. No brands or nutrition facts invented.
- Real model testing exposed goulash mapped to soup. Added BLS Y1A1000 and
  Y341023 (beef/pork stew) beside the existing soup, with independent spot checks
  and consciously updated 66-case evaluation digest. Other source values unchanged.
- Existing hitSlop and theme-border fixes were already present. Plan's cleanup
  was unmount-only; it now also cancels on blur and guards late save completion.

## Evidence and boundaries

- Local actual provider calls: "gulasch mit apfel soße" and "200 g Gulasch mit
  80 g Apfelsoße" both HTTP 200. Updated model uses Y1A1000, not soup. Explicit
  200/80 grams preserved. At 200 grams, source goulash computes 248 kcal,
  26 g protein, 8 g carbs and 12 g fat (rounded). Not a weighed-meal accuracy test.
- Pure regression covers text-vs-photo clarity, empty text result, bilingual
  top-two oats/banana rankings and explicit dried-banana preference.
- Browser 390x844 with isolated local-only test profile: original input visible,
  no overflow; "Change input" retains text in the editor. This exercised the
  offline error path, not a hosted authenticated description success.
- Screenshot: ignored output/playwright/description-input-mobile.png.
- Full local verify plus focused search/USDA ranking tests. No new native build
  or physical device pass is claimed. The UI changes require a replacement
  TestFlight binary; server-side changes can reach installed builds directly.
- No App Review submission. Dynamic Type, VoiceOver and physical touch remain
  device checks. Static checks do not prove every possible color/layout pair.
