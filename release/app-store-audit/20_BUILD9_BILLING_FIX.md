# Build 9 purchase confirmation fix, 2026-09-05

## Confirmed failure and cause

The owner reported a successful Apple purchase followed by Kandro's orange
server-confirmation warning. A read-only, secret-authenticated temporary
diagnostic reproduced the failure against the actual RevenueCat customer:
HTTP 200, Apple App Store, sandbox, gives_access=true, allowed product ID and
active matching entitlement. The old shared parser nevertheless returned false.

The real v2 subscription response contains product_id on the subscription and
an unexpanded entitlement resource. It does not contain entitlement.products.
Our validator's synthetic fixture included this optional nested list, hiding
the false denial. No billing issue or declined Apple transaction caused it.

## Remediation

Require the exact server-owned iOS product resource allowlist, Apple store,
supported store environment, gives_access=true and matching active entitlement.
Do not require the optional nested products list. If present, continue rejecting
contradictory product/app metadata. Device-provided entitlement flags never
grant server access. No manual grant, purchase, transfer or account mutation.

The same shared fix is deployed to nutrition and revenuecat-webhook. It applies
to installed Build 9 without a new native binary. Existing short-lived negative
client results can require waiting 21 seconds or reopening before Restore.

## Evidence

- Updated regression fixture mirrors the authenticated live response shape,
  using fictitious resource IDs and no personal/transaction data.
- Before fix: regression fails, expected active=true but got false.
- After fix: actual provider response returns active=true with its expiry.
- npm install and full npm run verify passed (including TypeScript, entitlement
  boundaries, provider limits, Expo Doctor and web export).
- Wrong product, wrong entitlement, inactive entitlement, non-Apple Test Store,
  expired/no-access subscription and contradictory expanded app still rejected.
- Both production functions deployed successfully. Temporary diagnostic removed
  after testing; it required an admin secret and never returned provider keys.
- On-device Restore on the exact installed binary remains owner confirmation.

## Reference

https://www.revenuecat.com/docs/api-v2/customer/resources

The general schema's fully expanded example must not be used as proof that an
optional nested relationship is included in the real endpoint response.

App Review remains unsubmitted and subject to the remaining native test gates.
