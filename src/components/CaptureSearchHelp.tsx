/**
 * AI search assistance stays switched off in the app.
 *
 * The server-side candidate routes the search term through OpenRouter to
 * Google Vertex AI (Gemini), a recipient that neither the privacy notice nor
 * the explicit consent names. Its optional consent copy was removed on
 * 09.10.2026 so that a server capability flag alone can never show an
 * undisclosed transfer. Before enabling it again: write and review the consent
 * text in both languages, disclose the recipient in legal.de.ts/legal.en.ts,
 * bump PRIVACY_VERSION, and restore the UI from git history (commit before
 * this change).
 */
export function CaptureSearchHelp(_props: { query: string; onConfirm: (query: string) => void }) {
  return null;
}
