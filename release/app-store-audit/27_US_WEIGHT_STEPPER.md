# US weight stepping

The shared onboarding/profile weight control used whole-pound steps and rounded every pound edit to 0.1 kg before converting back for display. This made the displayed pound grid unstable. US now steps by 0.1 lb; pound edits use the exact existing conversion without intermediate rounding. UK retains whole-pound stepping for its whole stone/pound display.

Regression executes the actual UI conversion expression and unit helpers over 3,527 tenth-pound inputs, including a simulated round-trip through the existing numeric(5,2) kg storage. Twenty ascending/descending steps from 218.9 preserve every tenth.

Local cloud-disabled browser QA: entered 218,9; four 100 ms presses displayed 219, 219,1, 219,2, 219,3; minus displayed 219,2. Saved profile and reopened editing: 219,2 lb retained. Zero-duration synthetic clicks did not activate onPressIn in this browser; this is not a native rapid-touch test. Native tapping/holding still needs the replacement binary.

`npm install` and full `npm run verify` passed (`/tmp/kandro-lb-verify.log`). No TestFlight build or App Review submission was created in this follow-up.
