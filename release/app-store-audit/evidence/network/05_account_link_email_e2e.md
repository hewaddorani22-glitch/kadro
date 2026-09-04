# Production email-link E2E evidence

- Audit date: 2026-09-04 (Europe/Berlin)
- Environment: production Supabase Auth and the delivered Kandro email template
- Account: disposable Gmail plus-alias; the address and one-time code are intentionally omitted
- Requested locale: English (`language=en`)
- Received message: branded Kandro email in English with a six-digit one-time code
- Verification: PASS
- Identity continuity: PASS; the verified email session kept the same Supabase user UUID as the original anonymous session
- Metadata continuity: PASS; `language=en` remained attached to the user
- Redirect behavior: no localhost redirect was used; verification happened with `verifyOtp` inside the app contract
- Cleanup: PASS; the temporary production user was deleted after verification

The first diagnostic attempt selected an older code from Gmail's threaded view and was rejected as expected. That temporary account was also deleted. The second run searched the exact disposable alias and completed the complete flow successfully. No email address, UUID, OTP or credential is stored in this evidence file.
