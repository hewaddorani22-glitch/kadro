/**
 * Meals a new user may log before the paywall appears.
 *
 * One was not enough to show what the product does: the promise is that the day
 * re-plans after every meal, and a single scan cannot demonstrate that. Three
 * covers a full day: breakfast, lunch, dinner: so the paywall arrives after
 * the user has seen the loop, not before.
 *
 * Each analysis costs well under one cent, so the allowance is cheap; the real
 * spend ceiling is the provider budget, not this number.
 */
export const FREE_SCAN_ALLOWANCE = 3;

/**
 * New installs behind the hard paywall (owner decision 10/2026) get one free
 * AI analysis: the first scan right after onboarding. The server value
 * (paywall_config.hard_after_first_scan_free_analyses) is authoritative; the
 * copy ("Probe-Analyse") assumes exactly one.
 */
export const FIRST_SCAN_FREE_ALLOWANCE = 1;
