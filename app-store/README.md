# Kandro App Store screenshots

Six `6.9-inch` iPhone screenshots per locale in Apple's `1320 × 2868 px` portrait format, RGB without alpha:

- `screenshots/de-DE/`
- `screenshots/en-US/`

Upload all six in filename order. The order follows the conversion story: the hook first, then ease, then the daily loop, then trust.

1. `01-photo` — Photo to calories (hook). Real result screen of the in-app example meal; the photo card is that example's own photo.
2. `02-voice` — Speak or type a meal in plain sentences. Real describe sheet; the speech bubbles are example inputs.
3. `03-today` — Today: calories and macros left, live.
4. `04-adapt` — After a big lunch, three meals that fit the rest of the day.
5. `05-portions` — Portions instead of grams, with BLS reference data.
6. `06-plan` — The personal plan with the goal curve.

## How they are made

Every phone screen is an unedited capture of the **Release build** of the app on the iPhone 17 Pro Max simulator (native 1320 × 2868), running offline with no backend, no accounts and no AI calls. The only edit is covering the demo-only line "Beispielmahlzeit: wird nicht gespeichert" / "Example meal: not saved" on the result screen. Sheets (`02`, `05`) are shown as an unscaled crop of the same capture.

`compose/render.py` places each capture into a frame (headline, subline, phone or sheet) and renders it with headless Chrome in SF Pro. Copy and layout live in `compose/frames.json`; the raw captures are in `compose/captures/<locale>/`.

```bash
python3 app-store/compose/render.py
```

To refresh a capture: build the Release app for the simulator without `.env` (`EXPO_NO_DOTENV=1`), complete onboarding (DE: 29 years, female, 178 cm, 78 kg, target 71.5 kg; EN: same person in US units), log via search (2 bananas, low-fat quark, lasagne 250 g) and save `xcrun simctl io <device> screenshot` into the captures folder.

## Accuracy boundary

All numbers in the headlines match the screens (2 bananas = 240 g). Apple permits text overlays as long as the screenshots show the real app; re-capture any screen whose released UI materially changes.
