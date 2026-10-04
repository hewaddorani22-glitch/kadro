export type ReviewUsage = { firstAt: number; ids: string[]; days: string[] };
export type ReviewAttempt = { version: string; at: number };
export const REVIEW_USAGE_KEY = '@kandro/review-usage:v1';
export const REVIEW_ATTEMPTS_KEY = '@kandro/review-attempts:v1';
const DAY = 86400000;
export function recordReviewUsage(usage: ReviewUsage | null, id: string, day: string, now: number): ReviewUsage {
  const state = usage ?? { firstAt: now, ids: [], days: [] };
  if (!id || state.ids.includes(id)) return state;
  return { firstAt: state.firstAt, ids: [...state.ids, id].slice(-500), days: [...new Set([...state.days, day])].slice(0, 365) };
}
export function reviewEligible(usage: ReviewUsage | null, attempts: ReviewAttempt[], version: string, now: number) {
  return !!usage && usage.ids.length >= 5 && usage.days.length >= 3 && now - usage.firstAt >= 3 * DAY
    && !attempts.some(attempt => attempt.version === version || now - attempt.at < 120 * DAY)
    && attempts.filter(attempt => now - attempt.at < 365 * DAY).length < 3;
}
