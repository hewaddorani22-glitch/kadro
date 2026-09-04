# Privacy- und Legal-Code-Trace

**Stichtag/Abrufdatum:** 4. September 2026

**Commit:** `22b1bf91af7824ffb976389e8bf259a0c8c1ccb5`

Dieses Dokument ist eine technische Nachweisführung. Es ist keine Rechtsberatung und keine Freigabe der Rechtstexte.

## 1. Maßgebliche offizielle Quellen

| ID | Offizielle Quelle | Relevanter Abschnitt | Abgeleitete Prüffrage |
|---|---|---|---|
| SRC-WEB-01 | Apple, [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) | 1.5; 1.4.1; 2.3; 5.1.1(i), 5.1.1(v), 5.1.2(i); laut Apple zuletzt aktualisiert 8. Juni 2026 | Ist Kontakt erreichbar, sind Gesundheits-/Metadatenclaims wahr, beschreibt die Policy Daten/Empfänger/Retention/Löschung, gibt es vor KI-Weitergabe ausdrückliche Einwilligung und ist Account-Löschung in der App erreichbar? |
| SRC-WEB-02 | Apple, [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/) | Account deletion requirements und Subscriptions | Löscht eine Account-Erstellungs-App den vollständigen Account in der App und erklärt sie die getrennte Abo-Kündigung? |
| SRC-WEB-03 | Apple, [App privacy details on the App Store](https://developer.apple.com/app-store/app-privacy-details/) | Data collection, linked data, third-party practices | Stimmen Policy, produktive Datenflüsse und App-Privacy-Antworten einschließlich SDKs überein? |
| SRC-WEB-04 | EU, [Verordnung (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj) | Art. 8, insbesondere Abs. 1 bis 2 | Bei einwilligungsbasierter ISS-Verarbeitung von Kindern gilt grundsätzlich 16; Mitgliedstaaten dürfen bis 13 absenken. Nationale Unterschiede und angemessene Verifikation müssen geprüft werden. |
| SRC-WEB-05 | EU, [Verordnung (EU) 2024/3228](https://eur-lex.europa.eu/eli/reg/2024/3228/oj) | Art. 1 bis 3 | Die frühere EU-ODR-Verordnung wurde zum 20. Juli 2025 aufgehoben; Beschwerden endeten schon am 20. März 2025. |
| SRC-WEB-06 | UK ICO, [What are the rules about an ISS and consent?](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/children-and-the-uk-gdpr/what-are-the-rules-about-an-iss-and-consent/) | UK age of consent | Die Altersgrenze ist territorial nicht überall gleich; im Vereinigten Königreich nennt die Behörde 13 Jahre. |
| SRC-WEB-07 | US FTC, [Complying with COPPA: Frequently Asked Questions](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions) | Coverage, age screens and parental consent | US-Vertrieb erfordert eine gesonderte COPPA-/Alters-Scope-Prüfung; eine neutrale Altersabfrage kann relevant sein. |
| SRC-WEB-08 | RevenueCat, [Identifying Customers](https://www.revenuecat.com/docs/customers/identifying-customers) | Custom App User IDs; login/aliasing | Eine benutzerdefinierte App User ID identifiziert den RevenueCat-Kunden und verbindet dessen Kauf-/Entitlement-Historie. |
| SRC-WEB-09 | PostHog, [Identifying users](https://posthog.com/docs/product-analytics/identify) | Anonymous users | Auch nicht identifizierte Events tragen eine automatisch erzeugte anonyme ID, die lokal gespeichert und über Sitzungen genutzt wird. |
| SRC-WEB-10 | OpenRouter, [Data collection](https://openrouter.ai/docs/guides/privacy/data-collection) und [Zero Data Retention](https://openrouter.ai/docs/guides/features/zdr) | Request metadata; ZDR routing | `store:false`, verweigerte Datensammlung und ZDR schützen Prompt-Inhalte, beseitigen aber nicht jede von OpenRouter dokumentierte Request-Metadatenverarbeitung. |
| SRC-WEB-11 | Supabase, [Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous) | Anonymous users | Anonyme Supabase-Anmeldung liefert ein authentifiziertes Nutzungserlebnis ohne angeforderte PII; sie bleibt dennoch ein Account/Benutzerobjekt. |

Bei Anbieterquellen war auf der geöffneten Seite kein verlässliches Veröffentlichungsdatum ausgewiesen. Deshalb wird nur das Abrufdatum behauptet.

## 2. Website-/Waitlist-Dateninventar

| Verarbeitung | Technische Evidenz | Öffentliche Offenlegung | Ergebnis |
|---|---|---|---|
| Sprachauswahl | `site/index.html:10-21`, `localStorage['kandro-lang']` | Nicht ausdrücklich in der Datenschutzseite genannt | Niedriges Risiko; technisch nur Präferenz, aber der vollständige Web-Datenkatalog sollte sie nennen. |
| Wartelisten-E-Mail und Sprache | `site/waitlist.js:58-65`; `supabase/functions/waitlist/index.ts:130-168` | `site/privacy/index.html:63-66`, EN analog | grundsätzlich beschrieben |
| Kampagnenquelle `?ref=` | `site/waitlist.js:64`; als `source` gespeichert in `waitlist/index.ts:137,155` | Nicht im aufgezählten Wartelisteninventar | Offenlegung unvollständig |
| Anmelde-, Bestätigungs- und Abmeldezeit | Migration `20260903210000_add_waitlist.sql:18-20` | Anmelde-/Bestätigungszeit genannt; Abmeldezeit nicht als Feld erläutert | teilweise beschrieben |
| gesalzener IP-Hash | `waitlist/index.ts:56-65,139-147`; Migration Zeile 25 | `site/privacy/index.html:65`, EN analog | beschrieben |
| Bestätigungstoken | Migration Zeile 21-22; Edge Function Zeile 150-155 | nicht erwähnt; Retention nicht definiert | Offenlegung/Retention unvollständig |
| Zugriffsschutz | Migration Zeile 36-41 | technische Maßnahme muss nicht im Detail veröffentlicht werden | RLS aktiv, keine öffentlichen Policies, öffentliche Rollen entzogen |
| Abmeldung/Löschung | `waitlist/index.ts:187-198` aktualisiert nur Zeitstempel und `confirmed_at`; kein öffentlicher Client/Link in Bestätigungsmail | jede Mail mit Abmeldelink; Löschung nach Abmeldung oder spätestens sechs Monate nach Start | nachweislicher Widerspruch |

## 3. App-/Provider-Dateninventar gegen Policy

| Anbieter/Funktion | Tatsächlicher Codepfad | Öffentlicher Text | Abweichung/Unsicherheit |
|---|---|---|---|
| Supabase Account/Cloud | Profile, Mahlzeiten und anonymer/e-mail-gesicherter User; Policy `site/privacy/index.html:40-42,52` | Zweck und EU-Region genannt; Live-Edge-Header `eu-central-1` | Wesentliche Kategorien beschrieben; konkrete Backup-/Processor-Fristen bleiben nur abstrakt. |
| OpenRouter/Microsoft Azure | `supabase/functions/nutrition/index.ts:33-46,101-125`; `store:false`, `data_collection:'deny'`, `only:['azure']`, kein Fallback, `zdr:true` | `site/privacy/index.html:45-47,59-61` | Inhaltsdatenweg passt zum Code. OpenRouter dokumentiert jedoch weiterhin Request-Metadaten; Kategorien/Retention/Transfermechanismus sind nicht konkret beschrieben. |
| USDA/Open Food Facts | Textsuchbegriffe bzw. Barcodes, `nutrition/index.ts` | `site/privacy/index.html:46,60-61` | Grundfluss beschrieben; Barcode als übertragene Kennung und Anbieterfristen nicht detailliert. |
| RevenueCat | `src/services/subscription.ts:58-88` übergibt die Supabase-User-ID als Custom App User ID; Zeile 131-166 liest CustomerInfo/Offerings und führt Kauf/Restore aus | nur „Abo-Verwaltung“ in `site/privacy/index.html:60` | Pseudonyme Account-ID, Kauf-/Abo-/Entitlement-Daten, Zweck, Verknüpfung und Retention fehlen. |
| PostHog | `src/services/telemetry.ts:47-105`: standardmäßig opt-out, `personProfiles:'never'`, GeoIP/Replay/Autocapture/Remote Flags aus, Allowlist. SDK fügt dennoch eine stabile anonyme ID und nicht vollständig entfernte technische App-/OS-Felder hinzu. | „anonyme Funktionsereignisse und bereinigte Fehler“, Ausschluss bestimmter Inhaltsdaten in `site/privacy/index.html:43,60` | Gute Datenminimierung, aber zufällige ID, App-/OS-/SDK-Felder sowie Retention fehlen; „anonym“ kann den persistenten pseudonymen Ereignisbezug verschleiern. |
| Resend | Wartelisten- und Guardian-E-Mails in `supabase/functions/waitlist/index.ts:87-101` und `guardian-consent/index.ts:78-96` | Resend als Empfänger genannt | Provider-Retention/Transfermechanismus nicht konkret. Guardian-E-Mail-Löschung ist best effort und ihr Updatefehler wird nicht geprüft. |
| Lokale Benachrichtigung | `src/services/reminders.ts`; kein Remote-Push-Tokenfluss gefunden | keine Push-Nennung | Im geprüften Stand nur lokal; daher kein festgestellter Drittanbieter-/Remote-Push-Widerspruch. |

## 4. Guardian-/Minderjährigen-Trace

- Die App lässt im Onboarding kein Alter unter 14 zu (`src/app/onboarding.tsx`, `NumberStep min={14}`).
- Für Alter 14 und 15 wird eine Guardian-E-Mail verlangt; Analyse bleibt ohne Serverbestätigung gesperrt.
- `supabase/functions/guardian-consent/index.ts:98-105` akzeptiert nur 14/15 und DE/EN.
- Guardian-Links laufen nach 48 Stunden ab; Token wird gehasht gespeichert.
- Nach erfolgreichem Versand versucht die Function, die Guardian-E-Mail zu nullen (`guardian-consent/index.ts:154-160`). Der Fehler dieses Update-Aufrufs wird nicht ausgewertet. Ein Crash zwischen Versand und Update oder ein Updatefehler kann daher die in der Policy als „unmittelbar“ zugesagte Löschung verhindern.
- `supabase/functions/nutrition/index.ts:589-619` prüft Authentifizierung, Mindestalter, aktuelle Privacy-Version, ausdrückliche Wellness-Einwilligung und für Unter-16-Jährige aktuelle Guardian-Zustimmung, bevor ein Provider erreicht wird.
- Unter 18 bleibt PostHog laut UI-/Servicecode ausgeschaltet.

Die technische Sperre ist substanziell. Nicht technisch beweisbar ist, dass eine Person für alle angebotenen Länder wirksam einwilligen darf, dass der Guardian wirklich sorgeberechtigt ist oder dass die gewählte Bestätigungsmethode in jedem Zielmarkt genügt. Dafür fehlt eine von einer verantwortlichen Stelle bestätigte Länder-/Altersmatrix.

## 5. Account-Löschung

- Auffindbarkeit: `src/app/(tabs)/profile.tsx:240-250`.
- Bestätigung, Abo-Hinweis und Apple-Abo-Link: `src/app/account-deletion.tsx:23-94`.
- Serveraufruf und anschließende Löschung lokaler Daten, Consent, Telemetrie und Reminder: `src/services/accountDeletion.ts:13-34`.
- Authentifizierte serverseitige User-Löschung: `supabase/functions/delete-account/index.ts:9-20`.
- Öffentliche Erklärung: `site/privacy/index.html:54-57` und `site/support/index.html:56-60`, jeweils EN analog.
- Live-Test-Evidenz: `release/app-store-audit/evidence/network/03_account_deletion_live.log`, Exit 0; temporärer Account, Profil-Cascade und Refresh-Token-Widerruf bestanden.

Status in diesem Teilbereich: technisch nachgewiesen. Eine separate Website-Löschseite ist für den vorhandenen In-App-Löschweg nicht erforderlich.

## 6. Konkrete Lücken, die aus diesem Trace folgen

1. Die Wartelisten-Policy beschreibt eine Abmelde-/Löschfunktion, die so nicht existiert.
2. Die Providerdarstellung ist keine vollständige Abbildung der produktiven Kategorien und Retention, insbesondere bei RevenueCat, PostHog und OpenRouter-Metadaten.
3. Die versprochene sofortige Entfernung der Guardian-E-Mail ist nicht transaktional bzw. fehlertolerant abgesichert.
4. Die allgemeine 14+-Regel ist nicht mit allen beabsichtigten Storefronts/jurisdiktionalen Anforderungen abgeglichen.
5. App-Privacy-Antworten dürfen erst nach Abgleich dieser Datenflüsse und des finalen Archivs veröffentlicht werden.
