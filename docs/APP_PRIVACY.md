# App Store privacy answers

Use this as the source of truth when completing **App Privacy** in App Store Connect. Re-check it against the exact production build and every enabled third-party SDK before submitting.

## Tracking

- **Data used to track you:** No.
- No IDFA, advertising, data broker, cross-app targeting or third-party advertising use.

## Data collected and linked to the user

| App Store data type | Purpose | Why |
|---|---|---|
| Health & Fitness → Health | App Functionality | Body measurements, nutrition targets, confirmed meals and macros are stored under the user's Supabase account. |
| Identifiers → User ID | App Functionality | Supabase anonymous or secured account ID; also used as the RevenueCat App User ID. |
| Purchases → Purchase History | App Functionality | RevenueCat and Apple maintain subscription entitlement state. |
| Contact Info → Email Address | App Functionality, Account Management | When the user voluntarily secures/restores the guest account, or when a 14–15-year-old asks a parent/guardian to confirm permission. The guardian address is used from Edge Function memory for Resend delivery and is never written to Kandro's database. Short-lived, separately salted account, recipient and network fingerprints enforce guardian-mail limits and are purged within three hours. |
| Contact Info → Name | App Functionality | An optional display name is stored in the Supabase profile and used for the greeting. |
| Usage Data → Product Interaction | App Functionality | The authenticated gateway stores linked request IDs, state, access kind and short-lived structured nutrition results to enforce the three free analyses, paid access, abuse limits and idempotent retries. |

## Optional analytics

Production currently has PostHog enabled. Even though collection is off by default and an adult user must opt in, the App Privacy answer must cover the users who opt in. It cannot be enabled on a profile under 18. Declare:

| App Store data type | Purpose | Why |
|---|---|---|
| Identifiers → Device ID | Analytics | The SDK persists random device/distinct identifiers. Treat them conservatively as linked to the user/device. |
| Usage Data → Product Interaction | Analytics | Allowlisted feature events and bucketed properties. No food, nutrition value, photo, email or Supabase ID is included. |
| Diagnostics → Other Diagnostic Data | Analytics, App Functionality | Sanitized operational exception type/code and original stack frames, plus limited app/OS/SDK metadata used to diagnose failures. |

If PostHog is deliberately disabled in the submitted production environment, re-run the packet/log test before removing these disclosures merely because the dormant SDK remains present. A default opt-out does **not** make collection undisclosable when an adult can opt in.

## Transient photos and descriptions

Meal photos and descriptions leave the device to fulfil the user-triggered analysis request. The route is pinned to OpenRouter in the United States and ZDR-capable Microsoft Azure endpoints with fallbacks disabled, `store: false`, provider data collection denied and Zero Data Retention. Originals are discarded after compression; confirmed meals contain no image. Under Apple's definition, data processed only transiently to service a request and not retained does not normally count as “collected”.

Before choosing **Photos or Videos: Not Collected** and **Other User Content: Not Collected** for the raw description, deploy the safe-log correction, retain evidence from the live ZDR smoke test and verify that neither application logs nor the selected OpenRouter/Azure route retain request content. If that guarantee changes, disclose the affected types and update the privacy notice before submission.

The gateway's idempotency ledger keeps only the structured nutrition result, not the original photo, Base64 payload, prompt or typed description, for less than 24 hours. It is linked to the Supabase user and is already covered by **Health & Fitness → Health** and **Usage Data → Product Interaction** above. The request tombstone is retained for 30 days and RevenueCat webhook IDs for 90 days; both are used for App Functionality and abuse/duplicate prevention.

## Nutrition lookups

USDA receives normalized food search terms. Open Food Facts receives a barcode. These are used for App Functionality and are not used for tracking. The authenticated Kandro gateway verifies the current consent version before either provider is called. To protect USDA, Open Food Facts and RevenueCat, Supabase keeps only per-provider counters tied to one-way account and source-network pseudonyms. The counters contain no query or barcode and are purged within two hours after last use; this remains covered by **Identifiers → User ID** and **Usage Data → Product Interaction** above.

## Reviewer consistency checks

- Primary English Privacy Policy URL: `https://getkandro.com/en/privacy`
- German Privacy Policy URL: `https://getkandro.com/privacy`
- In-app withdrawal: **You → Analysis & data use → Withdraw consent**
- Account deletion: **You → Delete account and data**
- Analytics opt-out: **You → Privacy settings → Anonymous usage analytics**
- Account deletion does not cancel an Apple subscription; the app says this before deletion.
