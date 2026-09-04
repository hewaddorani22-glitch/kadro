# Kandro App Store screenshots

This package contains the primary `6.9-inch` iPhone screenshot set in Apple's accepted `1320 × 2868 px` portrait format.

## Upload order

Use all five images in filename order for each localization:

- `screenshots/en-US/`
- `screenshots/de-DE/`

The first three are deliberately ordered around outcome, mechanism and differentiation:

1. Build muscle / get lean / know what is next
2. Review a photo-based estimate before it counts
3. Re-plan the rest of the day after a large meal
4. Flexible logging
5. Cookable recipes that fit the remaining targets

## Accuracy boundary

The UI, copy and nutrition numbers are deterministic and reflect existing Kandro functionality. The supporting chicken-bowl photograph was generated with the built-in Imagegen tool and is used only as the meal photo inside the scan-result UI. No generated text or generated UI is used.

Apple permits text and image overlays, but the screenshots must continue to reflect the real app experience. Re-run the final comparison after the TestFlight build is installed and replace any screen whose released UI has materially changed.

## Regeneration

Run the generator with a Python environment that includes Pillow:

```bash
/Users/hewaddorani/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/generate-app-store-screenshots.py
```

The generator writes RGB PNG files without transparency and also creates contact sheets under `app-store/previews/`.

## Imagegen prompt

Supporting photograph: a realistic weekday high-protein chicken rice bowl with grilled chicken breast, rice, broccoli and bell pepper; warm cream stone background; premium natural editorial food photography; Kandro cream, moss and pistachio palette; portrait composition with generous negative space; no text, UI, logos, hands, supplements or watermarks.
