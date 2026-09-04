# 10 – Landingpage-, Privacy- und Legal-Audit

**Gesamtstatus dieses Gates:** `FAIL`

**Auditdatum:** 5. September 2026

**Geprüfter Commit:** `22b1bf91af7824ffb976389e8bf259a0c8c1ccb5`

**Lokaler Remediation-Stand:** aktueller Audit-Arbeitsbaum, nicht deployt. Der oben genannte Commit bleibt der Live-/Baseline-Stand; die lokale Quelle und `https://getkandro.com` sind ausdrücklich **nicht** inhaltsgleich.

**Live-System:** `https://getkandro.com`

**Scope:** Landingpage, Support, Datenschutz, Bedingungen, Quellen, Impressum, Bestätigungs-/Guardian-Seiten, Warteliste, Website-Netzwerk, App-/Web-Textkonsistenz und Account-Löschdarstellung.

**Grenze:** Dieser Bericht ist ein technischer Pre-Submission-Audit, keine Rechtsberatung und keine Garantie einer Apple-Freigabe.

## 1. Ergebnis in einem Satz

Die Website ist im geprüften Baseline-Stand live, zweisprachig, technisch sauber erreichbar, responsiv weitgehend belastbar und ohne beobachtetes Webtracking. Im davon abweichenden lokalen Quellstand sind Wartelisten-Löschung, Provider-Offenlegung, Guardian-Fail-Closed, ODR-Hinweis, Kontrast, Mobile-Overflow und Accuracy-Copy behoben und lokal geprüft. Zusätzlich dokumentiert der lokale Stand kurzlebige, pseudonyme Provider-Limitzähler für USDA, Open Food Facts und RevenueCat. Dieses Gate bleibt `FAIL`, weil diese Änderungen nicht live sind und internationale Minderjährigenprüfung, Supportzustellung, Providerkonto-/DPA-/Retention-Nachweise sowie App-Privacy-Antworten weiterhin manuell bestätigt werden müssen. Es wurde innerhalb dieses Website-/Legal-Gates kein P0 gefunden.

## 2. Finding-Übersicht

| ID | Status | Schwere | Kategorie | Kurzbefund |
|---|---|---:|---|---|
| WEB-P1-01 | `FAIL` | P1 | MANDATORY_APPLE | Abmeldelink, unmittelbare Löschung, getrennte Token und automatische Fristen lokal implementiert; auf der öffentlichen Website noch nicht deployt |
| WEB-P1-02 | `MANUAL_CONFIRMATION_REQUIRED` | P1 | MANDATORY_APPLE | Code und DE/EN-Offenlegung lokal angeglichen; Produktionskonto-/DPA-/Retention-Nachweise und App-Privacy-Abgleich bleiben manuell |
| WEB-P1-03 | `FAIL` | P1 | LEGAL_EXTERNAL | Veralteter EU-ODR-Satz und Link lokal entfernt; auf der öffentlichen Website noch nicht deployt |
| WEB-P1-04 | `MANUAL_CONFIRMATION_REQUIRED` | P1 | LEGAL_EXTERNAL | 14+-/Guardian-Modell ist technisch umgesetzt, aber nicht für die internationale Distribution rechtlich validiert |
| WEB-P1-05 | `MANUAL_CONFIRMATION_REQUIRED` | P1 | MANDATORY_APPLE | Öffentliche Supportadresse vorhanden, tatsächliche externe Zustellung und betreute Antwortfähigkeit nicht nachgewiesen |
| WEB-P2-01 | `FIXED_VERIFIED` | P2 | HIG_QUALITY | Hero-Microcopy erreicht im korrigierten lokalen Stand 5,20:1; Lighthouse DE/EN meldet keine Kontrastfehler; Live-Retest bleibt separat offen |
| WEB-P2-02 | `FIXED_VERIFIED` | P2 | HIG_QUALITY | DE-Bedingungsseite besteht im korrigierten lokalen Stand bei 320/375/390/430 px ohne Überlauf; Live-Retest bleibt separat offen |
| WEB-P2-03 | `FAIL` | P2 | TECHNICAL_QUALITY | Wichtige Browser-Sicherheitsheader fehlen auf GitHub Pages |
| WEB-P2-04 | `FIXED_VERIFIED` | P2 | REVIEW_RISK | Der korrigierte DE/EN-Stand trennt Datenbank-/Durchschnittswerte von geschätzter Zuordnung, Zubereitung und Portion; Live-Retest bleibt separat offen |

## 3. P1-Findings

### WEB-P1-01 – Wartelisten-Abmeldung und Löschung widersprechen der Policy

- **Status:** `FAIL` (lokal korrigiert und getestet, öffentlich noch nicht ausgerollt)
- **Schwere:** P1
- **Kategorie:** MANDATORY_APPLE
- **Quelle:** Apple App Review Guidelines 5.1.1(i) verlangt eine Policy, die Erhebung, Nutzung, Retention/Löschung und Widerruf erklärt und den tatsächlichen Umgang abbildet.
- **Öffentliche Zusage:** `site/privacy/index.html:64-66` und `site/en/privacy/index.html:64-66`: jede Mail enthalte einen Abmeldelink; nach Abmeldung bzw. spätestens sechs Monate nach Start werde der Eintrag gelöscht. Startseiten versprechen „jederzeit abmelden“.
- **Baseline-Evidenz des geprüften Commits:**
  - `supabase/functions/waitlist/index.ts:87-99`: Die einzige vorhandene Bestätigungsmail enthält Bestätigungslink und Ignorierhinweis, aber keinen Abmeldelink.
  - `supabase/functions/waitlist/index.ts:187-198`: `/unsubscribe` setzt nur `unsubscribed_at` und löscht `confirmed_at`; E-Mail, Token, IP-Hash, Sprache, Quelle und Zeitstempel bleiben gespeichert.
  - Es gibt keine öffentliche Abmeldeseite und keinen Clientaufruf an `/unsubscribe`.
  - Es gibt keinen Cleanup-Job oder eine Migration, die sechs Monate nach Start löscht.
  - `scripts/validate-waitlist.mjs` prüft nur das Vorkommen der Policy-Begriffe, nicht deren Umsetzung.
- **Lokale Remediation:**
  1. Jede vorhandene DE-/EN-Wartelistenmail enthält jetzt einen sprachpassenden Abmeldelink; Bestätigung und Abmeldung verwenden getrennte 48-Hex-Token.
  2. `/unsubscribe` löscht die vollständige Zeile unmittelbar und gibt für existierende und unbekannte syntaktisch gültige Token dieselbe Antwort zurück.
  3. `/unsubscribe/` und `/en/unsubscribe/` verlangen eine bewusste Bestätigung und bewahren den Token beim Sprachwechsel.
  4. `private.purge_waitlist()` löscht unbestätigte Einträge nach 30 Tagen und bestätigte Einträge sechs Monate nach dem vom Verantwortlichen tatsächlich gesetzten Launchzeitpunkt. `launched_at` startet bewusst als `NULL`; `pg_cron` ruft die Funktion täglich auf.
  5. Schlägt der Resend-Aufruf fehl, stellt eine tokengebundene Compare-and-swap-Kompensation den vorherigen erreichbaren Zustand wieder her oder entfernt den von diesem Versuch neu angelegten Datensatz.
  6. `scripts/validate-waitlist.mjs` prüft Mailinhalt, Token-Trennung, Löschwirkung ohne Existenzleck, Versandkompensation, Seiten, reale Fristlogik und Runbook.
- **Verbleibende Aktion:** Migration, Function und Website nach bewusster Freigabe deployen; anschließend echten DE-/EN-Rundlauf einschließlich Datenbanknachweis protokollieren. Jede später separat implementierte Launch-/Folgenachricht muss denselben personalisierten Abmeldelink verwenden.
- **Retest:** Sign-up → lokalisierte Bestätigung → Confirm → Launch-Mail mit Abmeldelink → Abmeldung → Datenbanknachweis der versprochenen Löschung; anschließend Fristtest mit kontrollierter Uhr.

### WEB-P1-02 – Datenschutzhinweise bilden tatsächliche Datenflüsse nicht vollständig ab

- **Status:** `MANUAL_CONFIRMATION_REQUIRED`
- **Schwere:** P1
- **Kategorie:** MANDATORY_APPLE
- **Quelle:** Apple Guidelines 5.1.1(i), 5.1.2(i) und App Privacy Details verlangen Offenlegung der Datenkategorien, Nutzung, Drittanbieterpraktiken, Retention/Löschung und Weitergabe, einschließlich Drittanbieter-KI.
- **Baseline-Lücken des geprüften Commits:**
  1. **RevenueCat:** `src/services/subscription.ts:58-88` verwendet die Supabase-User-ID als RevenueCat Custom App User ID; Kauf-/Abo-/Entitlementinformationen werden gelesen und verarbeitet. Die Policy sagt nur „Abo-Verwaltung“ (`site/privacy/index.html:60`) und nennt weder pseudonyme Account-ID noch Kauf-/Entitlementdaten, Verknüpfung, Zweckdetails oder Retention.
  2. **PostHog:** Die App minimiert stark und ist standardmäßig opt-out (`src/services/telemetry.ts:47-105`). Das SDK verwendet dennoch eine persistierte anonyme Distinct ID und technische App-/OS-Felder, die nicht vollständig von `blockedAutomaticProperties` entfernt werden. Die Policy nennt nur „anonyme Funktionsereignisse und bereinigte Fehler“, aber nicht diese Kennung/Felder oder Retention.
  3. **OpenRouter:** `store:false`, `data_collection:'deny'`, Azure-only, kein Fallback und ZDR sind im Code nachgewiesen (`supabase/functions/nutrition/index.ts:101-125`). OpenRouter dokumentiert unabhängig davon Request-Metadaten. Die Policy erklärt Prompt-/Fotoinhalt, aber keine Metadatenkategorien oder deren Retention.
  4. **Warteliste:** `source` aus `?ref=` und technische Tokenfelder werden gespeichert, aber im Wartelisteninventar nicht genannt.
  5. **Guardian-Mail:** Die Policy verspricht unmittelbares Löschen der Guardian-Adresse. `guardian-consent/index.ts:154-160` prüft den Fehler des Nullungs-Updates nicht; bei Fehler/Prozessabbruch kann die Adresse entgegen der Zusage stehen bleiben.
  6. **Retention/Übermittlung:** Für RevenueCat, PostHog, Resend und OpenRouter-Metadaten fehlen nachvollziehbare Fristen/Kriterien sowie eine konkret verantwortete Darstellung internationaler Übermittlungen.
- **Lokale Remediation:**
  1. DE/EN nennen RevenueCat Custom App User ID (Supabase-UUID), Kauf-/Abo-/Entitlementdaten und Zweck; PostHog als pseudonyme persistente Distinct-/Geräte-ID mit allowlist-basierten Interaktionen, bereinigten Fehlern und technischen Feldern; OpenRouter-ZDR-Inhaltsgrenze und getrennte inhaltsfreie Request-Metadaten; sowie Wartelisten-Sprache, Kampagnenquelle, Token und IP-Hash.
  2. Retention ist als überprüfbares Kriterium statt erfundener Anbieterfrist formuliert. Opt-out stoppt künftige PostHog-Übertragung, löscht bereits gesendete Ereignisse nicht automatisch; Apple/RevenueCat-Aufbewahrung ist getrennt von Accountlöschung erklärt.
  3. Guardian-Adressen werden nie in die Datenbank geschrieben. Falls das zusätzliche Nullungs-Update für historische Zeilen fehlschlägt, wird die Anfrage entfernt und der Vorgang fail-closed beendet.
  4. Guardian-Bestätigung und Löschung des gehashten Einmal-Tokens erfolgen atomar in einer Datenbanktransaktion; Replay ist ungültig. Abgelaufene Anfragen entfernt ein täglicher Job.
  5. Der öffentliche Guardian-Endpoint begrenzt deklarierte und tatsächlich gelesene Request-Bodies auf 4 KiB und bricht bei Überschreitung vor dem JSON-Parsing ab.
  6. Die lokale Provider-Drosselung speichert nur pseudonyme Account-/Netzwerkkennungen, Route, Zähler und Zeitstempel; keine Suchbegriffe, Barcodes, Fotos oder Mahlzeitentexte. Ein stündlicher Purge begrenzt die tatsächliche Aufbewahrung auf weniger als zwei Stunden. Die Migration ist einer von drei im Remote-Dry-Run ausstehenden Schritten und daher noch nicht Produktionswahrheit.
- **Verbleibende Aktion:** Produktionskonten, DPA/Transfermechanismen und konkrete Retention-/Löschoptionen von Supabase, OpenRouter/Azure, RevenueCat, PostHog und Resend durch den Verantwortlichen belegen; danach App-Privacy-Antworten zeilenweise mit der finalen Datenkarte abgleichen und den Release-Build per Netzwerk-Capture testen.
- **Retest:** Netzwerk-Capture eines frischen Release-Builds mit Analytics off/on, Kauf/Restore und Foto-/Textanalyse; Provider-Dashboards/Retention manuell bestätigen; Policy und App-Privacy-Felder zeilenweise abgleichen.

### WEB-P1-03 – EU-ODR-Hinweis ist veraltet

- **Status:** `FAIL` (lokal korrigiert und getestet, öffentlich noch nicht ausgerollt)
- **Schwere:** P1
- **Kategorie:** LEGAL_EXTERNAL
- **Quelle:** Offizielle Verordnung (EU) 2024/3228 hob die ODR-Verordnung zum 20. Juli 2025 auf; neue Beschwerden endeten am 20. März 2025.
- **Evidenz:** `site/impressum/index.html:50-51` behauptet am 4. September 2026 noch, die Europäische Kommission stelle eine Online-Streitbeilegungsplattform bereit. Der Link leitet nur auf eine allgemeine Verlagerungsseite weiter.
- **Auswirkung:** Nachweislich sachlich überholte Anbieterinformation auf der öffentlichen Release-Domain.
- **Lokale Remediation:** ODR-Satz und veralteter Link sind aus `site/impressum/index.html` entfernt. Die davon getrennte Aussage zur Nichtteilnahme an Verbraucherschlichtung blieb unverändert und muss fachlich durch die verantwortliche Person bzw. Rechtsberatung bestätigt werden.
- **Retest:** Live-Impressum DE/EN-Navigation, Linkcrawl und fachliche Gegenprüfung gegen die aktuelle offizielle EU-Quelle.

### WEB-P1-04 – Minderjährigenmodell international nicht validiert

- **Status:** `MANUAL_CONFIRMATION_REQUIRED`
- **Schwere:** P1
- **Kategorie:** LEGAL_EXTERNAL
- **Quelle:** DSGVO Art. 8 erlaubt je Mitgliedstaat unterschiedliche Grenzen von 13 bis 16 für einwilligungsbasierte Dienste; UK ICO nennt 13 für das Vereinigte Königreich; FTC COPPA verlangt eine eigene US-Scope-/Unter-13-Prüfung. Zusätzlich verarbeitet Kandro ernährungs-, körper- und zielbezogene Wellnessdaten.
- **Technische Evidenz:** Mindestalter 14, Guardian-Flow für 14/15, 48-Stunden-Token, versionierte Einwilligung, serverseitiges Gate vor Provideraufrufen und ausgeschaltetes Analytics unter 18 sind vorhanden.
- **Offene Frage:** Der Text verallgemeinert ein deutsches 14/15-Modell, während EN-Website und geplanter Store-Vertrieb international sind. Es fehlt eine bestätigte Länder-/Storefrontmatrix zu Altersgrenze, Einwilligungsfähigkeit für sensible Wellnessdaten, Guardian-Verifikation, Widerruf, Kaufkontrollen und Store-Altersfreigabe.
- **Auswirkung:** Kein technischer Nachweis kann die territoriale rechtliche Wirksamkeit ersetzen. Eine pauschale weltweite Freigabe für 14-Jährige darf aus dem deutschen Text nicht abgeleitet werden.
- **Erforderliche Aktion:** Verantwortliche/rechtliche Prüfung pro beabsichtigter Storefront dokumentieren. Bis zur Freigabe betroffene Storefronts beschränken oder Alters-/Guardian-Regeln regionalisieren. App Store Connect Age Rating separat wahrheitsgemäß aus den tatsächlichen Inhalten beantworten; nicht „Made for Kids“ wählen, sofern dies nicht bewusst beabsichtigt und vollständig umgesetzt ist.
- **Retest:** signierte Länder-/Altersmatrix, abgestimmte Terms/Privacy/Onboarding-/Storefrontregeln und Test der regionalen Varianten.

### WEB-P1-05 – Supportadresse technisch sichtbar, Zustellung nicht end-to-end belegt

- **Status:** `MANUAL_CONFIRMATION_REQUIRED`
- **Schwere:** P1
- **Kategorie:** MANDATORY_APPLE
- **Quelle:** Apple Guideline 1.5 verlangt leicht auffindbare, korrekte und aktuelle Kontaktinformationen.
- **Evidenz:** `site/support/index.html:31-42` und EN analog sind öffentlich und enthalten eine `mailto:`-Adresse sowie Anbieteranschrift. Der Link ist syntaktisch korrekt. Die Website verspricht eine Antwort „in der Regel innerhalb von zwei Werktagen“.
- **Nicht verifiziert:** Externe Zustellbarkeit, Spamzustellung, betreute Inbox und tatsächliche Fähigkeit, die zugesagte Reaktionszeit einzuhalten. Der Audit erzeugte bewusst keine externe Nachricht.
- **Erforderliche Aktion:** Von einer unabhängigen externen Mailbox eine eindeutig markierte Testanfrage an die veröffentlichte Adresse senden, Eingang/Spam/Antwort protokollieren und den SLA-Text nur beibehalten, wenn er operativ getragen wird. Dieselbe Adresse in App Store Connect und Review Notes abgleichen.
- **Retest:** vollständiger Send/Receive/Reply-Nachweis ohne sensible Anhänge.

## 4. P2-Findings

### WEB-P2-01 – Zu geringer Kontrast der Hero-Microcopy

- **Status:** `FIXED_VERIFIED` (korrigierter lokaler Stand; Live-Retest als separates Gate)
- **Schwere:** P2
- **Kategorie:** HIG_QUALITY
- **Evidenz:** Lighthouse 12.8.2 meldet auf DE und EN 3,47:1 für `.microcopy` (`#818378` auf `#f5f3ee`, 12,32 px) statt 4,5:1; `site/styles.css:80`.
- **Remediation/Nachweis:** `.microcopy` wurde von `#818378` auf `#64675d` abgedunkelt. Rechnerischer Kontrast auf `#F5F3EE`: 5,20:1. Lighthouse 12.8.2 meldet lokal auf DE und EN Accessibility 1,00, Best Practices 1,00 und null `color-contrast`-Treffer.

### WEB-P2-02 – Horizontaler Überlauf in deutschen Bedingungen

- **Status:** `FIXED_VERIFIED` (korrigierter lokaler Stand; Live-Retest als separates Gate)
- **Schwere:** P2
- **Kategorie:** HIG_QUALITY
- **Evidenz:** `/terms/` hat bei 390 px `scrollWidth=395` bei `clientWidth=390`; Screenshot `evidence/web/terms-de-mobile-overflow.png`. Alle anderen geprüften Seiten und 820 px bestanden.
- **Remediation/Nachweis:** Rechtstextseiten erlauben jetzt `overflow-wrap:anywhere`. Lokaler Browsertest der deutschen Bedingungen bei 320/375/390/430 px: `scrollWidth === clientWidth`, kein horizontaler Überlauf.

### WEB-P2-03 – Browser-Sicherheitsheader fehlen

- **Status:** `FAIL`
- **Schwere:** P2
- **Kategorie:** TECHNICAL_QUALITY
- **Evidenz:** Live-Root über GitHub Pages sendet kein CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy` oder `Permissions-Policy`. HTTPS-Redirect und gültiges Zertifikat bestehen.
- **Aktion:** Falls GitHub Pages die Header nicht konfigurierbar ausliefert, Domain über einen kontrollierbaren Reverse Proxy/CDN legen. CSP muss die vorhandenen Inline-/externen Skripte und Supabase-Fetches bewusst erlauben; nicht blind `unsafe-inline` freigeben. Danach Header- und Funktionsretest.

### WEB-P2-04 – Mehrdeutige Genauigkeitsaussage auf der Datenquellenseite

- **Status:** `FIXED_VERIFIED` (korrigierter lokaler Stand; Live-Retest als separates Gate)
- **Schwere:** P2
- **Kategorie:** REVIEW_RISK
- **Quelle:** Apple Guidelines 1.4.1 und 2.3 verlangen nachvollziehbare Methodik und wahrheitsgetreue Gesundheits-/Metadatenclaims.
- **Evidenz:** `site/sources/index.html:36`/EN Zeile 36 sagt, BLS-Nährwerte „werden nicht geschätzt“; Zeile 60 sagt „Alle Angaben in Kandro sind Schätzungen“. Die beabsichtigte Trennung zwischen nicht von KI generierten Referenzwerten und geschätzter Zuordnung/Portion ist erst im restlichen Kontext erkennbar.
- **Remediation/Nachweis:** DE/EN sagen nun ausdrücklich: BLS-Referenzwerte werden nicht von der KI erzeugt, sind jedoch Datenbank-/Durchschnittswerte; Gerichtserkennung, Zuordnung, angenommene Zubereitung und Portionsskalierung bleiben Schätzungen. `npm run site:legal` und `npm run validate:site` belegen die Parität zwischen App- und Webtext.

## 5. Nachweislich bestandene Teilbereiche

| Prüffeld | Status | Evidenz |
|---|---|---|
| HTTPS, Zertifikat, HTTP→HTTPS, www→apex | `PASS` | gültiges Let's-Encrypt-Zertifikat, `ssl_verify_result=0`, saubere 301/200-Kette |
| Öffentliche Pflichtseiten DE/EN | `PASS` | Privacy, Terms, Support, Confirm, Sources und Guardian jeweils 301 auf Slash-URL und 200; Impressum 200 |
| Interne Links/Canonicals/Hreflang | `PASS` | Live-Crawl und `npm run validate:site`, Exit 0 |
| Quellstand entspricht Live-Stand | `FAIL` | Der frühere SHA-256-Vergleich galt nur für den Baseline-Zeitpunkt. Der aktuelle lokale Remediation-Stand enthält noch nicht deployte Legal-, Unsubscribe- und Privacy-Änderungen und ist daher nicht mit der öffentlichen Website gleichzusetzen. |
| Startseite responsiv | `PASS` | 390 px und 820 px ohne Überlauf; Screenshots vorhanden |
| Semantische A11y-Basis | `PASS` | je Seite `main`/`h1`, Alttexte, Formularlabels und zugängliche Namen; Kontrast-Ausnahme separat als P2 |
| Website-Tracker/Cookies im geprüften Lauf | `PASS` | keine Analytics-/Ad-Requests; keine gespeicherten Cookies; nur Sprachpräferenz in Local Storage |
| Wartelistenstatus und Sprachpayload | `PASS` | Live-Status 200/accepting; DE/EN-Formular sichtbar; abgefangene Payload korrekt lokalisiert |
| Waitlist-Datenbankzugriff | `PASS` | RLS, keine Policies, öffentliche Rollen entzogen; Service-Rolle nur in Edge Function |
| Double-Opt-in-Bestätigungsweg | `PASS` | lokalisierte Mailvorlagen, tokenisierter Confirm-Pfad, ungültige Tokens sicher abgewiesen; vollständiger echter Mailflow bleibt manuell |
| CORS-Basisschutz | `PASS` | fremder Origin erhält nicht seine eigene ACAO-Freigabe; erlaubte Produktionsdomain funktioniert |
| Health-/Accuracy-Disclaimer | `PASS` | Terms/Support/Sources erklären Schätzung, Korrekturmöglichkeit und Nicht-Medizinprodukt; eine Formulierungsunschärfe separat P2 |
| Falsche Reviews/Testimonials/Apple-Empfehlung | `PASS` | keine gefunden |
| App-Store-Badge/Preisbehauptung | `NOT_APPLICABLE` | kein offizielles Badge und keine konkreten Websitepreise; „Coming to the App Store“ entspricht Prelaunch-Zustand |
| Separate Privacy-Choices-Webseite | `NOT_APPLICABLE` | im geprüften Weblauf keine nicht notwendigen Tracker/Cookies; App bietet Opt-in/Opt-out unter „Du“ |
| Sign in with Apple | `NOT_APPLICABLE` | kein Drittanbieter-/Social-Login gefunden; anonyme Supabase-Session plus eigene E-Mail-Sicherung |
| Account-Löschung | `PASS` | in App auffindbar; Live-Test von Account, Profil-Cascade und Refresh-Token-Widerruf bestanden; Website erklärt getrennte Abo-Kündigung |
| Marken-/Namenskonsistenz | `PASS` | „Kandro“ in Website, Legaltexten und Apppfaden konsistent |

## 6. Daten-/Provider-Abgleich: Freigabestatus

| Thema | Status | Begründung |
|---|---|---|
| AI-Einwilligung vor Provideraufruf | `FIXED_VERIFIED` | Lokal: Versionierte ausdrückliche Einwilligung plus serverseitige Prüfung vor OpenRouter/USDA/Open Food Facts sind belegt; die zugehörigen aktuellen Functions/Migrationen sind nicht deployed. |
| AI-Inhaltsrouting | `FIXED_VERIFIED` | Lokal: OpenRouter, Azure-only, kein Fallback, `store:false`, Datensammlung verweigert und ZDR sind im Code belegt; Produktionskonfiguration und -logs müssen nach Deployment erneut geprüft werden. |
| Vollständigkeit der AI-/SDK-Offenlegung | `MANUAL_CONFIRMATION_REQUIRED` | Lokale DE/EN-Datenkarte ergänzt; Produktionskonto-/DPA-/Retention-Nachweis und App-Privacy-Abgleich bleiben offen, siehe WEB-P1-02 |
| Provider-Limitzähler | `FIXED_VERIFIED` | Lokal: Pseudonyme Account-/Netzwerkkennungen und globale Routenaggregate mit weniger als zwei Stunden Aufbewahrung sind implementiert; die dritte Migration und Live-Grenztests stehen aus. |
| Analytics unter 18 | `FIXED_VERIFIED` | Lokal: Standardmäßig opt-out und für Minderjährige ausgeschaltet; Source/Validatoren bestehen, die exakte Release-Binary-/Produktionskonfiguration bleibt nach Deployment nativ zu prüfen. |
| Guardian-Flow technisch | `FIXED_VERIFIED` | Lokal: 14/15-Gate, gehashter 48-h-Token, ausdrückliche Bestätigung, atomare Einmalverwendung und serverseitige Sperre sind belegt; Function/Migration und echter Mailflow sind nicht deployed bzw. live erneut geprüft. |
| Guardian-Flow rechtlich international | `MANUAL_CONFIRMATION_REQUIRED` | Länder-/Altersmatrix fehlt, siehe WEB-P1-04 |
| Wartelisten-Löschung | `FAIL` | Vollständige Zeilenlöschung und automatische Fristen lokal umgesetzt; Deployment/E2E-Beleg offen, siehe WEB-P1-01 |
| App-Privacy-Label-Abgleich | `UNVERIFIED_BLOCKER` | Muss nach finaler Providerdatenkarte und finalem Release-Archiv in App Store Connect bestätigt werden |

## 7. Erforderliche Reihenfolge vor Submission

1. Die exakt drei ausstehenden Migrationen und die zusammengehörigen Functions `nutrition`, `guardian-consent` und `revenuecat-webhook` erst nach gesetzten Server-Secrets kontrolliert deployen; danach die lokalen Webdateien separat veröffentlichen. Vorher kein Produktionsversprechen aus dem lokalen Stand ableiten.
2. Echten DE-/EN-Wartelistenflow von Anmeldung bis Datenbanklöschung protokollieren und den realen App-Start erst beim tatsächlichen Ereignis in `private.waitlist_release_state` setzen.
3. `WEB-P1-02` mit Produktions-Settings/DPAs, Netzwerk-Capture und App-Privacy-Antworten synchronisieren.
4. Impressum einschließlich der verbliebenen Verbraucherschlichtungsaussage fachlich bestätigen.
5. Internationale 14+-Distribution anhand einer Länder-/Storefrontmatrix freigeben oder begrenzen.
6. Supportzustellung/Antwortfähigkeit extern testen.
7. Fehlende Browser-Sicherheitsheader schließen oder als bewusste Hosting-Restentscheidung dokumentieren.
8. Anschließend Validatoren, Live-Crawl, Lighthouse und den vollständigen App-/Website-/App-Privacy-Abgleich wiederholen.

## 8. Evidenz

- `release/app-store-audit/evidence/web/00_WEB_RUNTIME_EVIDENCE.md`
- `release/app-store-audit/evidence/web/01_PRIVACY_CODE_TRACE.md`
- `release/app-store-audit/evidence/web/02_WEB_REMEDIATION_EVIDENCE.md`
- `release/app-store-audit/evidence/web/lighthouse-home-de.json`
- `release/app-store-audit/evidence/web/lighthouse-home-en.json`
- `release/app-store-audit/evidence/web/lighthouse-home-de-after.json`
- `release/app-store-audit/evidence/web/lighthouse-home-en-after.json`
- Screenshots in `release/app-store-audit/evidence/web/`
- ergänzende Account-Lösch-Evidenz: `release/app-store-audit/evidence/network/03_account_deletion_live.log`
- vollständiger lokaler Release-Verify: `release/app-store-audit/evidence/build/26_final_release_verify.log`
- nicht mutierender Remote-Dry-Run mit exakt drei ausstehenden Migrationen: `release/app-store-audit/evidence/network/23_final_supabase_dry_run.log`
