# Kandro Pro render loop and dictation segments

Source report: Sentry `kandro-ios`, 7 Oct 2026, release `com.hewaddorani.kandro@1.0.3+40`, iPhone14,2, iOS 26.6.1. `ui:react_render:Error` with the stack `setOptions → dispatchSetState → enqueueConcurrentHookUpdate → getRootForUpdatedFiber`. The owner reports that tapping "Kandro Pro" in Profile while subscribed shows "Something went wrong".

## Kandro Pro

`getRootForUpdatedFiber` throws when React's nested-update limit is reached ("Maximum update depth exceeded"). The paywall rendered `<Stack.Screen options={{ … }} />` with a new object on every render. expo-router's `Screen` calls `navigation.setOptions(options)` in a layout effect keyed on that object, so every render issued another navigator update. The options are now memoized on `hard`. The release gate also rejects inline `options={{` literals in non-layout route files.

## Dictation

On iOS 18+, continuous `SFSpeechRecognizer` sessions report each pause as a final result, and the next segment starts a new transcript (expo-speech-recognition emits `isFinal: true` per segment). The button rebuilt the field from the pre-dictation text plus `results[0]`. After a pause, it therefore replaced everything spoken before. Finished segments are now committed and only the running segment is replaced. Recognition errors other than `aborted` and `no-speech` now show a short retry hint instead of failing silently.

## Verification

- The full `npm run verify` passed, except `validate-revenuecat-experiment.mjs`. That script compiles Swift with `swiftc`, which is unavailable in the Linux container, and it fails identically on the unmodified base. Run it on macOS.
- The new release-gate markers fail against the previous paywall and dictation code and pass with the fix.
- Not yet verified natively. On a TestFlight build, open Profile → Kandro Pro as an active subscriber (and as a free user, and from the blocked-scan route). Dictate a meal with two or three pauses in German and in English, then stop and restart.
