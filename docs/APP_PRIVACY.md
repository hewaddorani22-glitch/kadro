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
| Contact Info → Email Address | App Functionality, Account Management | Only when the user voluntarily secures or restores the guest account by email. |

## Optional analytics

If production PostHog remains enabled, declare **Usage Data → Product Interaction** for Analytics. Collection is off by default and the user must opt in. Kandro sends only bucketed feature events; no food, nutrition value, photo, email or Supabase ID is included. Treat the SDK's random installation identifier conservatively as linked to the user/device in App Store Connect.

If PostHog is disabled in the submitted production environment, do not declare Product Interaction merely because the dormant SDK is present; confirm with a packet/log test that nothing is transmitted.

## Transient photos and descriptions

Meal photos and descriptions leave the device to fulfil the user-triggered analysis request. The route is pinned to OpenRouter in the United States and ZDR-capable Microsoft Azure endpoints with fallbacks disabled, `store: false`, provider data collection denied and Zero Data Retention. Originals are discarded after compression; confirmed meals contain no image. Under Apple's definition, data processed only transiently to service a request and not retained does not normally count as “collected”.

Before choosing **Photos or Videos: Not Collected**, retain evidence from the live ZDR smoke test and verify that neither application logs nor the selected OpenRouter/Azure route retain request content. If that guarantee changes, update both this answer and the privacy notice before submission.

## Nutrition lookups

USDA receives normalized food search terms. Open Food Facts receives a barcode. These are used for App Functionality and are not used for tracking. The authenticated Kandro gateway verifies the current consent version before either provider is called.

## Reviewer consistency checks

- Primary English Privacy Policy URL: `https://getkandro.com/en/privacy`
- German Privacy Policy URL: `https://getkandro.com/privacy`
- In-app withdrawal: **You → Analysis & data use → Withdraw consent**
- Account deletion: **You → Delete account and data**
- Analytics opt-out: **You → Privacy settings → Anonymous usage analytics**
- Account deletion does not cancel an Apple subscription; the app says this before deletion.
