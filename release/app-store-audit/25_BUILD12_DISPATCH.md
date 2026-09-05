# Build 12 dispatch

Source: `bb61299488e8b8652d083848bfdb15b14309f31b`.

`npm install`, full `npm run verify`, remote EAS environment validation and remote production release validation passed on 2026-09-05. The worktree was clean at dispatch.

- EAS build: `2305776f-828d-42fb-9cdf-d304a12114d8`
- Version: 1.0.0 (12)
- Automatic Apple upload scheduled: `d78f7658-a9e0-4f13-b084-e8827285fe60`
- Initial status: NEW; not yet evidence of Apple processing or TestFlight availability.
- No App Review submission authorized or performed.

Includes camera focus/foreground guards and bounded navigation stack, bounded iOS photo acquisition, nutrition reference precision, and decimal weight entry in onboarding/profile. Hosted USDA energy correction was already deployed separately.

The owner subsequently supplied a Build 11 crash report. It records EXC_BREAKPOINT/SIGTRAP on captureSessionQueue during AVCaptureSession addInput/configuration, with a second captureSessionQueue concurrently configuring camera formats. This supports a camera lifecycle overlap hypothesis, not a conclusively symbolicated app-level cause or a demonstrated fix. It is not a Jetsam termination. The original report is intentionally not committed because it contains device identifiers.

Mandatory device retest: 15–20 repeated photo scans/close/reopen cycles on the owner's iPhone 17 Pro, including rapid transitions and background/foreground; exact weight entry with comma/point and save/reopen; Pro purchase/restore. The release remains blocked until the corrected native candidate passes. Browser and static tests do not certify native camera stability.
