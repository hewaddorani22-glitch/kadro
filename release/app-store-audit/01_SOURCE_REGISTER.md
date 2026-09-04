# 01 – Apple-Quellenregister für das Kandro App-Store-Release-Gate

**Stichtag:** 4. September 2026
**Abrufdatum aller unten aufgeführten Quellen:** 4. September 2026
**Quellenstandard:** ausschließlich öffentlich erreichbare Primärquellen von Apple (`developer.apple.com`)
**Geltungsbereich:** iOS-App Kandro, App Store Connect, TestFlight und produktionsnaher Review-Build

Dieses Register dokumentiert Apples aktuelle Anforderungen. Es bewertet **nicht**, ob der vorhandene Kandro-Code sie bereits erfüllt. Ein `PASS` darf erst vergeben werden, wenn die jeweilige Anforderung am finalen Archiv, in App Store Connect und auf einem realen Gerät nachgewiesen ist.

## Lesart und Priorität

- **APPLE_P0:** harter Upload-, Submission- oder sehr wahrscheinlicher Review-Blocker.
- **APPLE_P1:** erheblicher Review-, Datenschutz-, Funktions- oder Produktseiten-Risiko; vor Einreichung schließen.
- **CONDITIONAL:** nur dann verpflichtend, wenn die genannte Funktion im finalen Build vorhanden oder in einer Region gesetzlich betroffen ist.
- **HIG_QUALITY:** Apples Design- und Accessibility-Leitlinie. Nicht jeder einzelne HIG-Satz ist automatisch ein formaler Ablehnungsgrund, aber erhebliche Abweichungen können Qualität, Bedienbarkeit und Review beeinflussen.

## APL-001 – App Review Guidelines

- **Titel:** App Review Guidelines
- **URL:** [https://developer.apple.com/app-store/review/guidelines/](https://developer.apple.com/app-store/review/guidelines/)
- **Relevante Abschnitte:** Before You Submit; 1.3 Kids Category; 1.4 Physical Harm; 1.4.1 Medical; 1.5 Developer Information; 1.6 Data Security; 2.1 App Completeness; 2.3 Accurate Metadata; 2.5 Software Requirements; 3.1 Payments; 4.2 Minimum Functionality; 4.8 Login Services; 4.10 Monetizing Built-In Capabilities; 5.1 Privacy; 5.2 Intellectual Property
- **Von Apple ausgewiesener Stand:** **Last Updated: June 8, 2026**
- **Abruf:** 2026-09-04
- **Konkrete Anforderungen und Kandro-Bezug:**
  - **2.1 / Before You Submit – APPLE_P0:** Der eingereichte Build muss vollständig, stabil und auf einem Gerät getestet sein. URLs, Backend und IAP müssen live und funktionsfähig sein. Review Notes müssen nicht offensichtliche Funktionen erklären; falls Login erforderlich ist, braucht Review dauerhaften Vollzugriff, einen Demo-Account oder einen vollständigen Demo-Modus. **Kandro:** Onboarding, Profil, Fotoanalyse, Barcode, Suche, Plan, Verlauf, Account-Löschung, Paywall, Restore und alle Supabase/AI-Endpunkte.
  - **2.3.1–2.3.3 – APPLE_P0/P1:** Beschreibung, Screenshots, Vorschauen, Altersfreigabe und Hinweise müssen den ausgelieferten Build exakt wiedergeben. Screenshots sollen die App in Benutzung zeigen; bezahlpflichtige Funktionen müssen als solche erkennbar sein. **Kandro:** EN/DE-Storetexte, Screenshot-Sets, „AI photo scan“, Pro-Vorteile, Such- und Gesundheitsversprechen.
  - **2.3.6 – APPLE_P0:** Die Altersfreigabe-Fragen müssen ehrlich beantwortet werden. **Kandro:** Kalorien-, Ernährungs-, Gewichts- und Fitnessinhalte sowie In-App-Käufe.
  - **2.3.7:** App-Name höchstens 30 Zeichen; Keywords dürfen nicht irreführend, markenverletzend oder künstlich gestopft sein. **Kandro:** „Kandro Macro & Protein Tracker“ und DE-Lokalisierung vor Speicherung erneut auf App-Store-Zeichenlänge prüfen.
  - **2.5.1:** Nur öffentliche APIs im vorgesehenen Zweck; HealthKit nur für Health/Fitness. **Kandro:** Kamera, HealthKit/Apple Health falls enthalten, In-App Purchase.
  - **2.5.5 – APPLE_P1:** IPv6-only-Netze müssen funktionieren. **Kandro:** Supabase, AI-Gateway, Open Food Facts/USDA-Aufrufe und RevenueCat dürfen keine IPv4-Annahme enthalten.
  - **2.5.14 – APPLE_P0:** Kamera-, Mikrofon-, Bildschirm- oder sonstige Aufzeichnung verlangt ausdrückliche Zustimmung und eine klare sichtbare oder hörbare Indikation. **Kandro:** Essensfoto- und Barcode-Kamera.
  - **3.1.1 – APPLE_P0:** Digitale Funktionen, Kontingente und Abonnements in der iOS-App müssen mit In-App Purchase freigeschaltet werden; wiederherstellbare Käufe brauchen Restore. Außerhalb speziell erlaubter Storefront-/Entitlement-Fälle dürfen keine Kaufbuttons oder Links zu alternativen Zahlwegen führen. **Kandro:** Pro, Fotoanalysen, Freemium-Limits, Paywall, Restore.
  - **3.1.2(a–c) – APPLE_P0:** Auto-Renewable Subscriptions müssen fortlaufenden Wert liefern, mindestens sieben Tage laufen, geräteübergreifend funktionieren, Upgrade/Downgrade sauber behandeln und Leistung sowie Preis klar beschreiben. **Kandro:** monatliches/jährliches Pro, RevenueCat-Entitlement, Cloud-Synchronisierung.
  - **4.2.2:** Die App darf nicht primär eine Marketingseite oder Linksammlung sein. **Kandro:** native nutzbare Kernfunktionen müssen im Review-Build tatsächlich vorhanden sein.
  - **4.8 – CONDITIONAL / APPLE_P0:** Wird ein Drittanbieter-/Social-Login als primärer Accountzugang angeboten, ist zusätzlich eine gleichwertige datensparsame Login-Option erforderlich, die nur Name/E-Mail anfordert, E-Mail-Verbergen erlaubt und Werbeinteraktionen nicht ohne Zustimmung sammelt. Ein ausschließlich eigenes Accountsystem fällt unter Apples genannte Ausnahme. **Kandro:** eigener E-Mail-/Magic-Link-Login löst 4.8 allein nicht aus; bei späterem Google-/Gmail-/Facebook-Login ist typischerweise „Sign in with Apple“ mitzuplanen.
  - **4.10:** Die eingebaute Hardwarefähigkeit Kamera selbst darf nicht monetarisiert werden. **Kandro:** Pro darf die AI-Analyse limitieren, nicht den bloßen Kamera-Zugriff als Systemfähigkeit verkaufen.
  - **5.1.1(i) – APPLE_P0:** Datenschutzrichtlinie in App Store Connect **und** leicht erreichbar in der App; sie muss Datentypen, Erhebung, Nutzung, Drittanbieter, Aufbewahrung/Löschung und Widerruf erklären. **Kandro:** Supabase, OpenRouter/AI-Modellanbieter, PostHog, RevenueCat, Resend sowie Foto-, Mahlzeit-, Körper- und Nutzungsdaten.
  - **5.1.1(ii–iv) – APPLE_P0/P1:** Zustimmung nur für konkrete Zwecke, widerrufbar; vollständige Purpose Strings; Datensparsamkeit; keine Manipulation bei Systemberechtigungen; wo möglich Alternativen. **Kandro:** Kamera erst im Scan-Kontext anfragen und Beschreibung/Suche/Barcode als angemessene Alternativen anbieten.
  - **5.1.1(v) – APPLE_P0:** Unterstützt eine App Account-Erstellung, muss sie Account-Löschung **in der App** anbieten. Apps ohne erhebliche accountbasierte Funktionen sollen ohne Login nutzbar sein. **Kandro:** auch anonyme Supabase-Identitäten und später verknüpfte E-Mail-Accounts vollständig löschen.
  - **5.1.2(i) – APPLE_P0, seit Stand Juni 2026 besonders kritisch:** Apple verlangt eine klare Offenlegung, wo personenbezogene Daten mit Dritten geteilt werden, **einschließlich Drittanbieter-KI**, und **ausdrückliche Zustimmung vor der Weitergabe**. **Kandro:** Essensfoto, Freitext, erkannte Speisen, Körper-/Zielwerte oder Health-Daten dürfen nicht vor dieser Zustimmung an OpenRouter oder den dahinter gewählten Modellanbieter gesendet werden.
  - **5.1.2(ii):** Neue Nutzung bereits erhobener Daten braucht weitere Zustimmung. **Kandro:** Scans nicht nachträglich für Modelltraining, Marketing oder andere Zwecke verwenden, ohne neue Einwilligung.
  - **5.1.2(vi) – APPLE_P0:** Daten aus HealthKit, Kamera und Foto-APIs dürfen nicht für Marketing, Werbung oder nutzungsbasierte Data-Mining-Zwecke verwendet werden. **Kandro:** Scanbilder/-inhalte nicht als PostHog-Payload, Werbezielgruppe oder Marketingprofil nutzen.
  - **5.1.3 – CONDITIONAL / APPLE_P0:** Gesundheits-/Fitnessdaten sind besonders sensibel; keine Werbung/Marketing/Data-Mining, genaue Offenlegung der verwendeten Health-Daten, keine falschen HealthKit-Schreibwerte und keine personenbezogenen HealthKit-Daten in iCloud. **Kandro:** Apple-Health-/Watch-Schritte, Aktivität, Gewicht und daraus berechnete Ziele, falls im Build aktiviert.
  - **5.1.4 / 1.3 – CONDITIONAL:** Bei Minderjährigen gelten zusätzliche Datenschutzgesetze. Apps primär für Kinder unterliegen besonders strengen Analytics-/Werbe- und Parental-Gate-Regeln; „For Kids“ ist nur für die Kids Category. **Kandro:** Jugendliche 14–17 unterstützen heißt nicht automatisch Kids Category, verlangt aber wahrheitsgemäße Altersfreigabe und altersgerechte Datenpraxis.
  - **5.2.1–5.2.2 – APPLE_P0/P1:** Für Inhalte und Dienste Dritter müssen Rechte bzw. Erlaubnis bestehen. **Kandro:** USDA, Open Food Facts, BLS/sonstige Nährwertdaten, Rezepte, Fotos und Marken-/Produktdaten samt Lizenz-/Attributionspflichten.
  - **5.2.5 – APPLE_P1:** Activity-Ring-Darstellungen dürfen Apples Move/Exercise/Stand-Ringen nicht ähneln. **Kandro:** Kalorien-/Makro-Ring visuell und funktional eigenständig halten.

## APL-002 – Upcoming Requirements

- **Titel:** Upcoming Requirements
- **URL:** [https://developer.apple.com/news/upcoming-requirements/](https://developer.apple.com/news/upcoming-requirements/)
- **Relevante Abschnitte:** SDK minimum requirements; Age Rating Updates; Privacy manifest/required-reason deadline; DSA trader requirement
- **Aktualisierungsdatum:** kein einzelnes Seiten-Update ausgewiesen; Apple führt je Requirement ein Wirksamkeitsdatum auf
- **Abruf:** 2026-09-04
- **Konkrete Anforderungen und Kandro-Bezug:**
  - **Seit 28. April 2026 – APPLE_P0:** Uploads zu App Store Connect müssen mit **Xcode 26 oder neuer** und einem **iOS-26-SDK** (bzw. passendem Plattform-SDK) gebaut sein. **Kandro:** finalen EAS/App-Store-Build und Archive-Metadaten prüfen; ein alter TestFlight-Build genügt nicht.
  - **Seit 31. Januar 2026 – APPLE_P0:** Die aktualisierten Altersfreigabe-Fragen müssen beantwortet sein. **Kandro:** neue 4+/9+/13+/16+/18+-Systematik.
  - **Seit 1. Mai 2024 – APPLE_P0:** Für gelistete Required Reason APIs müssen genehmigte Gründe im Privacy Manifest stehen. **Kandro:** App und alle eingebetteten Expo/React-Native/SDK-Bundles im finalen Archiv.
  - **Seit 17. Februar 2025 – DISTRIBUTION_P0 für EU:** Ohne verifizierten DSA-Trader-Status entfernt Apple Apps aus dem EU-Store. **Kandro:** Trader-Status und veröffentlichte Kontaktdaten in App Store Connect müssen abgeschlossen sein, falls Vertrieb in der EU erfolgt.

## APL-003 – Set an app age rating

- **Titel:** Set an app age rating
- **URL:** [https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/)
- **Relevante Abschnitte:** Set an app age rating; Age categories and override; Made for Kids; Override to higher age rating
- **Aktualisierungsdatum:** auf der Seite nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Anforderung:** Altersfreigabe ist eine erforderliche App-Eigenschaft; `Unrated` kann nicht im App Store veröffentlicht werden. Antworten bestimmen globale und regionale Ratings. Eine EULA mit höherem Mindestalter verlangt ein entsprechendes Override. „Made for Kids“ bindet nach Freigabe auch spätere Versionen an die Kids-Regeln.
- **Kandro-Funktion:** Kalorien-/Makrotracking, Gewichtsziele, Ernährungsempfehlungen, KI, IAP und Unterstützung von Teenagern. Antworten sachlich nach vorhandenen Funktionen geben; nicht auf ein gewünschtes Marketing-Rating hin optimieren. **APPLE_P0.**

## APL-004 – Age ratings values and definitions

- **Titel:** Age ratings values and definitions
- **URL:** [https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/)
- **Relevante Abschnitte:** Health or Wellness Topics; Medical or Treatment Information; iOS 26 age values 4+, 9+, 13+, 16+, 18+
- **Aktualisierungsdatum:** auf der Seite nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Anforderung:** Apple nennt Kalorientracking, Diäthinweise und Trainingsempfehlungen ausdrücklich als „Health or Wellness Topics“. Medizinische oder Behandlungsinformationen sind separat nach Häufigkeit anzugeben und können die Einstufung erhöhen.
- **Kandro-Funktion:** Onboarding-Ziel, Kalorien-, Makro- und Proteinziele, „what to eat next“, Gewichtsverlauf. Das Register legt **kein** Rating fest; App Store Connect muss aus ehrlichen Antworten das Rating berechnen. **APPLE_P0.**

## APL-005 – App information reference

- **Titel:** App information
- **URL:** [https://developer.apple.com/help/app-store-connect/reference/app-information/app-information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)
- **Relevante Abschnitte:** Name; Subtitle; Primary language; Bundle ID; Privacy Policy URL; Content Rights; Age Rating; Categories
- **Aktualisierungsdatum:** auf der Seite nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Anforderung:** Name 2–30 Zeichen, Untertitel maximal 30 Zeichen; Bundle ID muss zum Build passen; Privacy Policy URL und Altersfreigabe sind erforderlich; Rechte an Drittinhalten müssen vorhanden sein; Primärsprache dient als Fallback, wenn eine Lokalisierung fehlt.
- **Kandro-Funktion:** EN/DE-Metadaten, App-Name, Bundle Identifier, Datenschutzseite, Nährwert-/Produktdaten, primäre/sekundäre Kategorie. **APPLE_P0/P1.**

## APL-006 – Submit an app / Review submission workflow

- **Titel:** Submit an app
- **URL:** [https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app)
- **Relevante Abschnitte:** Select build; Add for Review; Submit for Review
- **Aktualisierungsdatum:** auf der Seite nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Anforderung:** Erforderliche Metadaten und korrekten Build auswählen. **Add for Review** legt zunächst einen Submission-Entwurf an; erst **Submit for Review** sendet tatsächlich an Apple.
- **Kandro-Funktion:** geplanter Stop vor dem finalen Review. Interne Regel: bis zur ausdrücklichen Freigabe des Eigentümers höchstens den Entwurf vorbereiten, nicht „Submit for Review“ auslösen. **PROCESS_P0.**

## APL-007 – App privacy details on the App Store

- **Titel:** App privacy details on the App Store
- **URL:** [https://developer.apple.com/app-store/app-privacy-details/](https://developer.apple.com/app-store/app-privacy-details/)
- **Relevante Abschnitte:** Answering app privacy questions; Data collection; Types of data; Data use; Data linked to the user; Tracking; FAQs
- **Aktualisierungsdatum:** auf der Seite nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Anforderungen:**
  - Privacy-Nutrition-Label ist für neue Apps und Updates erforderlich und muss **eigene sowie Drittanbieter-Praktiken** abdecken.
  - „Collect“ bedeutet Übertragung vom Gerät und Zugriff/Aufbewahrung länger als für die Echtzeitbearbeitung der Anfrage nötig. Auch Daten nur für App-Funktionalität sind grundsätzlich anzugeben, sofern keine enge Optional-Disclosure-Ausnahme vollständig greift.
  - Identitätsbezug umfasst Verknüpfung über Account, Gerät oder andere Details. Tracking ist die Verbindung mit Drittanbieterdaten für Werbung/-messung oder Weitergabe an Datenbroker.
  - Freitext kann „Other User Content“ sein; gezielt angeforderte Fotos, E-Mail, Gesundheits- oder Fitnessdaten müssen als konkrete Datentypen bewertet werden.
- **Kandro-Funktion:** Supabase-Account/UUID/E-Mail, Essensfotos, Mahlzeittext, Körpermaße, Aktivität, Diagnose-/Nutzungsdaten in PostHog, Kauf-/Entitlement-Daten in RevenueCat sowie an AI/Server übertragene Inhalte. **APPLE_P0.**

## APL-008 – Manage app privacy in App Store Connect

- **Titel:** Manage app privacy
- **URL:** [https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- **Relevante Abschnitte:** Enter a privacy policy URL; Get started with app privacy; Edit and publish responses; Localize privacy policy URLs
- **Aktualisierungsdatum:** auf der Seite nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Anforderung:** Für iOS ist eine Privacy Policy URL erforderlich. Antworten müssen plattformübergreifend vollständig sein, alle Drittanbieter abdecken, aktuell gehalten und in App Store Connect veröffentlicht werden. Privacy-Policy-URLs können lokalisiert werden.
- **Kandro-Funktion:** EN/DE-Datenschutzseiten und endgültige ASC-Antworten nach Analyse des produktiven Archivs, nicht nach Vermutung oder nur anhand des JavaScript-Quellcodes. **APPLE_P0.**

## APL-009 – User privacy and data use / App Tracking Transparency

- **Titel:** User privacy and data use
- **URL:** [https://developer.apple.com/app-store/user-privacy-and-data-use/](https://developer.apple.com/app-store/user-privacy-and-data-use/)
- **Relevante Abschnitte:** App privacy details; Asking permission to track; Tracking definitions
- **Aktualisierungsdatum:** auf der Seite nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Anforderung:** Falls App oder eingebettetes SDK Nutzerdaten app-/websiteübergreifend für zielgerichtete Werbung oder Werbemessung verknüpft oder an einen Datenbroker gibt, ist ATT-Zustimmung vor Tracking/IDFA-Zugriff erforderlich. Drittanbieter-SDKs zählen zur Entwicklerverantwortung.
- **Kandro-Funktion:** PostHog/RevenueCat/weitere SDK-Konfiguration. Wenn ausschließlich First-Party-Produktanalyse ohne Apples Tracking-Definition erfolgt, ist ATT nicht automatisch nötig; dies muss aber aus produktiver Konfiguration und Datenflüssen bewiesen werden. **CONDITIONAL / APPLE_P0.**

## APL-010 – Privacy manifest files

- **Titel:** Privacy manifest files
- **URL:** [https://developer.apple.com/documentation/bundleresources/privacy-manifest-files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- **Relevante Abschnitte:** Overview; `PrivacyInfo.xcprivacy`; Tracking; Collected data; Required reason API categories
- **Aktualisierungsdatum:** auf der Dokumentationsseite nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Anforderung:** Manifest heißt `PrivacyInfo.xcprivacy` und kann Tracking (`NSPrivacyTracking`/Domains), erhobene Datentypen (`NSPrivacyCollectedDataTypes`) und Required Reason APIs (`NSPrivacyAccessedAPITypes`) erklären. Gelistete Drittanbieter-SDKs müssen ein Manifest enthalten; auch andere SDKs brauchen es, wenn sie Required Reason APIs nutzen, Daten sammeln oder Tracking-Domains kontaktieren.
- **Kandro-Funktion:** finale iOS-App, Expo/React Native, Hermes, PostHog, RevenueCat, Supabase und sämtliche transitive native Abhängigkeiten. **APPLE_P0.**

## APL-011 – Describing data use in privacy manifests

- **Titel:** Describing data use in privacy manifests
- **URL:** [https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests](https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests)
- **Relevante Abschnitte:** Describe data your app or third-party SDK collects; identity linkage; tracking; purposes; Xcode privacy report
- **Aktualisierungsdatum:** auf der Dokumentationsseite nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Anforderung:** Für jeden erhobenen Datentyp sind Datentyp, Identitätsverknüpfung, Trackingstatus und Verwendungszwecke korrekt zu deklarieren. Eingebettete SDKs deklarieren ihre Daten in ihrem eigenen Manifest. Apple empfiehlt, aus dem archivierten Build den zusammengefassten Xcode-Privacy-Report zu erzeugen und ihn für die App-Store-Privacy-Antworten zu verwenden.
- **Kandro-Funktion:** endgültige Privacy-Nutrition-Label-Matrix und Nachweis aus dem Release-Archiv. **APPLE_P0.**

## APL-012 – Describing use of required reason API

- **Titel:** Describing use of required reason API
- **URL:** [https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)
- **Relevante Abschnitte:** Required reason API declaration; approved reasons; bundle ownership; anti-fingerprinting
- **Aktualisierungsdatum:** auf der Dokumentationsseite nicht ausgewiesen; Annahmefrist separat bei APL-002: 1. Mai 2024
- **Abruf:** 2026-09-04
- **Konkrete Anforderung:** Jede verwendete gelistete API-Kategorie braucht einen zutreffenden von Apple genehmigten Grund. Der Grund muss zur tatsächlichen Nutzung passen. Fingerprinting ist unabhängig von Tracking-Zustimmung verboten. Jedes executable/dynamische Framework braucht die Deklaration im zugehörigen Bundle.
- **Kandro-Funktion:** Release-IPA/xcarchive einschließlich aller Pods/Frameworks; besonders UserDefaults-, File Timestamp-, Disk Space- oder System-Boot-Time-APIs, falls durch App oder SDK verwendet. **APPLE_P0.**

## APL-013 – Third-party SDK requirements

- **Titel:** Third-party SDK requirements
- **URL:** [https://developer.apple.com/support/third-party-SDK-requirements/](https://developer.apple.com/support/third-party-SDK-requirements/)
- **Relevante Abschnitte:** Privacy manifest and signature requirements; listed SDKs
- **Aktualisierungsdatum:** auf der Seite nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Anforderung:** Der Entwickler bleibt für Code und Datenschutzpraktiken aller SDKs verantwortlich. Beim Hinzufügen/Aktualisieren eines von Apple gelisteten SDKs muss es ein Privacy Manifest enthalten; als Binärabhängigkeit außerdem eine gültige SDK-Signatur. Die Pflicht gilt auch bei umbenannten oder neu verpackten Varianten.
- **Kandro-Funktion:** Apple listet **Hermes** ausdrücklich. Deshalb muss der finale Expo/React-Native-Archivinhalt, nicht nur `package.json`, auf gültiges Hermes-Manifest/Signatur und die übrigen nativen SDKs geprüft werden. **APPLE_P0.**

## APL-014 – Offering account deletion in your app

- **Titel:** Offering account deletion in your app
- **URL:** [https://developer.apple.com/support/offering-account-deletion-in-your-app/](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- **Relevante Abschnitte:** Account deletion requirements; FAQs; Sign in with Apple; subscriptions
- **Von Apple ausgewiesener Wirksamkeitsstand:** Pflicht seit **June 30, 2022**
- **Abruf:** 2026-09-04
- **Konkrete Anforderungen:**
  - Account-Erstellungs-Apps müssen die Löschung in der App **initiierbar** und leicht auffindbar machen; gelöscht werden der ganze Account und verbundene personenbezogene Daten, außer rechtlich notwendiger Aufbewahrung.
  - Ein Web-Abschluss ist zulässig, wenn die App direkt auf die konkrete Löschseite führt. Außer in stark regulierten Branchen soll keine Support-E-Mail oder kein Telefonat erzwungen werden. Reauthentifizierung/Bestätigung ist zulässig, darf aber nicht unnötig erschweren.
  - Automatisch erzeugte Gast-/anonyme Accounts sind nicht ausgenommen.
  - Bei aktiven Abonnements muss erklärt werden, dass Apple-Abrechnung bis Kündigung weiterläuft; Manage-Subscription-Zugang anbieten. Apple verlangt dennoch eine Möglichkeit zur sofortigen Löschung.
  - Bei Sign in with Apple sind Tokens über Apples REST API zu widerrufen.
- **Kandro-Funktion:** anonyme Supabase-Session, E-Mail-Verknüpfung, Nutzerdaten, Scan-/Mahlzeitenhistorie, PostHog-Zuordnung und RevenueCat-Subscriber-ID. **APPLE_P0.**

## APL-015 – Auto-renewable subscriptions

- **Titel:** Auto-renewable subscriptions
- **URL:** [https://developer.apple.com/app-store/subscriptions/](https://developer.apple.com/app-store/subscriptions/)
- **Relevante Abschnitte:** Providing subscription options; ranking and groups; signup screen; pricing; testing; managing subscriptions
- **Aktualisierungsdatum:** auf der Seite nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Anforderungen:** Kaufansicht muss Aboname, Dauer, enthaltene Leistung und vollständigen Verlängerungspreis in lokaler Währung klar zeigen. Der Gesamtpreis der Abrechnungsperiode ist am deutlichsten darzustellen; Monatsäquivalente dürfen untergeordnet sein. Bei Trials müssen Trialdauer und Preis danach klar sein. In App und App-Store-Metadaten müssen Datenschutzrichtlinie und Nutzungsbedingungen verlinkt sein. Restore/Sign-in und Abonnementverwaltung müssen zugänglich sein.
- **Kandro-Funktion:** Pro-Paywall, Monats-/Jahresabo, Trial, Restore, Manage Subscription, EN/DE-Preistext. **APPLE_P0.**

## APL-016 – Offer auto-renewable subscriptions in App Store Connect

- **Titel:** Offer auto-renewable subscriptions
- **URL:** [https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions/](https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions/)
- **Relevante Abschnitte:** Create subscription group; create subscription; levels; submit first subscription
- **Aktualisierungsdatum:** auf der Seite nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Anforderung:** Abos in einer Gruppe und klare Service-Levels konfigurieren; Nutzer kann je Gruppe nur ein Abo gleichzeitig haben. Das **erste** Abo muss zusammen mit einer neuen App-Version in derselben Submission eingereicht und mit Review-Informationen versehen werden.
- **Kandro-Funktion:** App Store Connect-Produkte, RevenueCat Offering/Entitlement und erster App-Review-Entwurf. **APPLE_P0.**

## APL-017 – In-App Purchase / StoreKit

- **Titel:** In-App Purchase
- **URL:** [https://developer.apple.com/documentation/storekit/in-app-purchase](https://developer.apple.com/documentation/storekit/in-app-purchase)
- **Relevante Abschnitte:** Overview; Configure In-App Purchases; Support a store in your app; transaction verification
- **Aktualisierungsdatum:** auf der Dokumentationsseite nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Anforderung:** Digitale Käufe werden in App Store Connect konfiguriert und über StoreKit verarbeitet. Die App muss Transaktionen und aktuelle Entitlements zuverlässig auswerten; Apple-signierte Transaktionen können client- oder serverseitig verifiziert werden. Sandbox-/StoreKit-Tests gehören vor Produktion zum Ablauf.
- **Kandro-Funktion:** RevenueCat muss die Apple-StoreKit-Transaktion repräsentieren; Pro-Zugriff darf nicht nur einem lokalen UI-Flag vertrauen und muss Kauf, Wiederherstellung, Erneuerung, Ablauf, Refund und Gerätewechsel korrekt abbilden. **APPLE_P0.**

## APL-018 – Sign in with Apple und Token-Widerruf

- **Titel:** Sign in with Apple; Token revocation
- **URLs:** [https://developer.apple.com/documentation/signinwithapple](https://developer.apple.com/documentation/signinwithapple) · [https://developer.apple.com/documentation/signinwithapplerestapi/revoke-tokens](https://developer.apple.com/documentation/signinwithapplerestapi/revoke-tokens)
- **Relevante Abschnitte:** Sign in with Apple overview; REST `POST https://appleid.apple.com/auth/revoke`
- **Aktualisierungsdatum:** auf den Dokumentationsseiten nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Anforderung:** Wenn Sign in with Apple implementiert wird, Identität/Autorisierung korrekt behandeln; bei Account-Löschung vorhandene Apple-Tokens widerrufen. Die eigentliche Pflicht zum Angebot bei Social Login ergibt sich aus Guideline 4.8 in APL-001.
- **Kandro-Funktion:** derzeit **CONDITIONAL**. Eigener E-Mail-/Magic-Link-Login allein erzwingt nach 4.8 kein Sign in with Apple. Wird Google/Gmail/Facebook als Primärlogin hinzugefügt, muss 4.8 vor Release neu bewertet werden. **CONDITIONAL / APPLE_P0.**

## APL-019 – Accessibility (Human Interface Guidelines)

- **Titel:** Accessibility
- **URL:** [https://developer.apple.com/design/human-interface-guidelines/accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- **Relevante Abschnitte:** Support personalization; Larger text; Color and effects; VoiceOver; Voice Control; controls/gestures; motion
- **Aktualisierungsdatum:** kein einheitliches Seiten-Update ausgewiesen; jüngster auf der Seite geführter Change-Log-Eintrag: **June 9, 2025**
- **Abruf:** 2026-09-04
- **Konkrete Leitlinien:** Dynamische Schrift und idealerweise mindestens 200 % Textvergrößerung; kleine Texte mit mindestens 4,5:1 und große Texte mit mindestens 3:1 Kontrast; Informationen nicht nur durch Farbe; aussagekräftige Accessibility-Labels/-Reihenfolge; iOS-Ziele standardmäßig 44×44 pt (Mindestgröße 28×28 pt); einfache Gesten und Alternativen; Reduce Motion respektieren; wichtige UI nicht automatisch zeitgesteuert verschwinden lassen.
- **Kandro-Funktion:** Onboarding-Eingaben, Pro-Vorteile, Kamera/Barcode-Controls, Taschenlampe, Charts/Ringe, Dark Mode, Plan/Verlauf, VoiceOver und Schaltflächen. **HIG_QUALITY / APPLE_P1.**
- **Zugriffshinweis:** Die sichtbare HIG-Seite ist JavaScript/DocC-basiert. Der vollständige Text wurde über Apples eigenen DocC-Seiteninhalt/JSON gelesen; kein Drittanbieter-Transkript wurde verwendet.

## APL-020 – Privacy (Human Interface Guidelines)

- **Titel:** Privacy
- **URL:** [https://developer.apple.com/design/human-interface-guidelines/privacy](https://developer.apple.com/design/human-interface-guidelines/privacy)
- **Relevante Abschnitte:** Requesting permission; data minimization; purpose and timing; pre-alerts
- **Aktualisierungsdatum:** auf der Seite nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Leitlinien:** Nur benötigte Daten anfragen, Zweck transparent erklären, Berechtigung möglichst erst beim tatsächlichen Funktionsaufruf anfordern. Falls eine vorbereitende Erklärung vor Apples Systemdialog nötig ist, darf sie nicht mit manipulativen Alternativen oder irreführenden „Allow“-Buttons den Systementscheid vorwegnehmen.
- **Kandro-Funktion:** Kamera beim ersten Foto-/Barcode-Start, HealthKit erst beim Aktivieren von Apple Health, Benachrichtigungen nur im Nutzungskontext. **HIG_QUALITY / APPLE_P1.**

## APL-021 – Camera authorization und `NSCameraUsageDescription`

- **Titel:** Requesting authorization to capture and save media; `NSCameraUsageDescription`
- **URLs:** [https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media](https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media) · [https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription](https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription)
- **Relevante Abschnitte:** Camera permission; authorization status; purpose string; contextual request
- **Aktualisierungsdatum:** auf den Dokumentationsseiten nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Anforderung:** Vor Kamera-Zugriff muss autorisiert werden; `NSCameraUsageDescription` muss den konkreten Nutzen verständlich erklären. Fehlt der Key, beendet iOS die App beim Zugriff. Status vor Session-Setup prüfen und Anfrage sinnvoll beim Feature-Aufruf stellen. Für Foto-Library-Zugriff gelten separate Keys/Rechte.
- **Kandro-Funktion:** Mahlzeitenfoto, Barcode-Erkennung, Taschenlampe/AVCapture-Session, Berechtigung abgelehnt/eingeschränkt und Settings-Fallback. EN/DE-Purpose-Strings müssen zum tatsächlichen Feature passen. **APPLE_P0.**

## APL-022 – Protecting user privacy with HealthKit

- **Titel:** Protecting user privacy
- **URL:** [https://developer.apple.com/documentation/healthkit/protecting-user-privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy)
- **Relevante Abschnitte:** Fine-grained authorization; usage descriptions; health/fitness-only purpose; sharing restrictions
- **Aktualisierungsdatum:** auf der Dokumentationsseite nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Anforderungen:** HealthKit verlangt feingranulare Lese-/Schreibberechtigung. `NSHealthShareUsageDescription` und bei Schreiben `NSHealthUpdateUsageDescription` sind erforderlich; ohne passenden Purpose String kann die App beendet werden. HealthKit nur für klar erkennbare Health/Fitness-Zwecke; keine Werbung; keine Weitergabe an Dritte ohne ausdrückliche Erlaubnis, und der Dritte muss ebenfalls einen Health/Fitness-Dienst anbieten; kein Verkauf der Daten.
- **Kandro-Funktion:** Schritte, Aktivitätskalorien, Training, Gewicht und Apple-Watch-Daten. **CONDITIONAL / APPLE_P0**, sobald HealthKit im finalen Build aktiviert ist. Nicht implementierte Health-Funktionen dürfen weder in Storetext noch Screenshots behauptet werden.

## APL-023 – Authorizing access to health data

- **Titel:** Authorizing access to health data
- **URL:** [https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- **Relevante Abschnitte:** Add capability; customize permission messages; request only needed object types; partial authorization
- **Aktualisierungsdatum:** auf der Dokumentationsseite nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Anforderung:** HealthKit-Capability aktivieren, konkrete Read-/Write-Typen und passende Purpose Strings festlegen, Verfügbarkeit prüfen und mit teilweiser bzw. abgelehnter Freigabe funktionieren.
- **Kandro-Funktion:** optionale automatische Schritte/Watch-Synchronisierung darf die App ohne Health-Zugriff nicht hängen lassen; Zielberechnung muss transparent mit fehlenden Daten umgehen. **CONDITIONAL / APPLE_P1.**

## APL-024 – HealthKit (Human Interface Guidelines)

- **Titel:** HealthKit
- **URL:** [https://developer.apple.com/design/human-interface-guidelines/healthkit](https://developer.apple.com/design/human-interface-guidelines/healthkit)
- **Relevante Abschnitte:** Request access only when needed; explain benefits; privacy policy; system authorization UI; Health icon usage
- **Aktualisierungsdatum:** auf der Seite nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Leitlinien:** Health-Zugriff im Funktionskontext erklären und anfragen, Apples Standarddialog nicht nachbauen, Ablehnung respektieren und auf die systemweite Sharing-Verwaltung verweisen. Apple nennt als legitimes Muster ausdrücklich, dass eine Ernährungs-App Gewicht/Aktivität zur Kalorienziel- und Ernährungsempfehlung nutzt.
- **Kandro-Funktion:** Apple-Health-Opt-in, Profil, Tagesziel/Plan. **CONDITIONAL / HIG_QUALITY.**

## APL-025 – Design safe and age-appropriate experiences

- **Titel:** Design safe and age-appropriate experiences for your apps and games
- **URL:** [https://developer.apple.com/kids/](https://developer.apple.com/kids/)
- **Relevante Abschnitte:** Declared Age Range; age ratings; Kids category; Product page; age assurance
- **Aktualisierungsdatum:** auf der Seite nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Anforderungen:** Altersfreigabe und Produktseite müssen Eltern verständlich über Content, IAP, Datenschutz und relevante Fähigkeiten informieren. Kids-Category-Apps haben zusätzliche Vorgaben wie Altersband, Parental Gates und stark begrenzte Drittanbieter-Datenübertragung. Bestimmte Regionen können Altersnachweis, elterliche Zustimmung bei wesentlichen Änderungen und Reaktion auf widerrufene Zustimmung verlangen.
- **Kandro-Funktion:** geplante Nutzung durch 14–17-Jährige. Kandro sollte nicht versehentlich als Kids-Category-App deklariert werden; gleichwohl müssen regionale Minderjährigenpflichten bewertet und Gesundheits-/Gewichts-Copy altersgerecht sein. **APPLE_P1 / CONDITIONAL.**

## APL-026 – Declared Age Range / age assurance

- **Titel:** Declared Age Range; Age assurance developer Q&A
- **URLs:** [https://developer.apple.com/documentation/declaredagerange](https://developer.apple.com/documentation/declaredagerange) · [https://developer.apple.com/support/age-assurance](https://developer.apple.com/support/age-assurance)
- **Relevante Abschnitte:** Overview; required regulatory features; privacy-preserving age ranges; regional obligations
- **Aktualisierungsdatum:** auf den Seiten nicht ausgewiesen
- **Abruf:** 2026-09-04
- **Konkrete Anforderung:** In betroffenen Regionen kann die App über Apples API feststellen, ob zusätzliche altersbezogene Pflichten gelten. Die API liefert auf Zustimmung hin Altersbereiche/-kategorien statt zwingend ein exaktes Geburtsdatum. Der Entwickler bleibt für die jeweils anwendbaren Gesetze verantwortlich.
- **Kandro-Funktion:** internationales Angebot an Jugendliche. Das ist **nicht pauschal für jede App/Region verpflichtend**; vor weltweiter Distribution ist anhand der Zielregionen, Account-/Community-Funktionen und aktuellen Rechtslage zu entscheiden, ob `requiredRegulatoryFeatures`, elterliche Zustimmung oder Significant-Change-Handling nötig sind. **CONDITIONAL / LEGAL_P1.**

## Quellenübergreifende Apple-Release-Gates

Die folgenden Punkte sind aus den Primärquellen unmittelbar als Nachweisziele abzuleiten. Der tatsächliche Status muss im technischen/operativen Audit separat belegt werden.

### APPLE_P0 – vor Review zwingend belegen

1. **Finales Archiv:** mit Xcode 26+ und iOS-26-SDK gebaut; echter Upload-Build, nicht nur Expo Go/TestFlight-Vorgänger.
2. **Drittanbieter-KI-Einwilligung:** klare Offenlegung des konkreten AI-Empfängers/Verwendungszwecks und ausdrückliches Opt-in **vor** der ersten Datenweitergabe; Ablehnung darf nicht heimlich umgangen werden.
3. **Datenschutz-Konsistenz:** Datenfluss-Inventar, In-App-Datenschutz, EN/DE-Website, App-Store-Privacy-Label und tatsächliche Produktionskonfiguration stimmen für Supabase, AI, PostHog, RevenueCat und Resend überein.
4. **Privacy Manifest / SDK-Supply-Chain:** `PrivacyInfo.xcprivacy`, genehmigte Required Reasons, aggregierter Xcode-Privacy-Report sowie erforderliche Manifeste/Signaturen aller nativen SDKs; Hermes ausdrücklich prüfen.
5. **Account-Löschung:** vollständig, in der App auffindbar und auch für automatisch erzeugte anonyme Supabase-Accounts; Daten/Identitäten bei allen relevanten Diensten berücksichtigen; aktives Apple-Abo erklären und sofortige Löschung trotzdem ermöglichen.
6. **IAP/Subscription:** Pro nur über Apple IAP/StoreKit, Produkt im Review-Entwurf korrekt zugeordnet, Preis/Dauer/Verlängerung/Trial/Leistung klar, Restore und Manage Subscription funktionsfähig, Entitlement über Kauf/Ablauf/Refund/Gerätewechsel korrekt.
7. **Kamera:** konkrete Purpose Strings, Systemberechtigung im Kontext, abgelehnt/eingeschränkt ohne Hänger, Foto- und Barcodepfad auf realem Gerät funktionsfähig.
8. **Altersfreigabe:** neues 2026-Questionnaire vollständig und ehrlich; Health/Wellness-Inhalte und IAP berücksichtigt; `Unrated` ausgeschlossen.
9. **Review-Betrieb:** finaler Build ohne Crash/Blocker, produktive Backends live, Reviewer kann alle Funktionen testen, Review Notes erklären AI, Login, Paywall und Löschung; IAP sichtbar und funktional.
10. **Rechte:** Rechte/Lizenz/Attribution für alle Nährwert-, Produkt-, Rezept-, Bild- und Markeninhalte nachweisen.

### APPLE_P1 – vor Review schließen oder ausdrücklich begründen

1. **HealthKit nur bei echter Fertigstellung:** keine Store-Claims vor Implementierung; bei Aktivierung feingranulare Rechte, Health-Purpose-Strings, kein Marketing/Analytics mit Health-/Kameradaten und korrekter Fallback.
2. **Sign in with Apple nur konditional:** eigener E-Mail-Login verlangt es nicht; jeder zusätzliche Social Login löst eine neue 4.8-Prüfung aus.
3. **Accessibility:** Dynamic Type, VoiceOver, Kontrast, Dark Mode, 44×44-pt-Ziele, keine farbexklusive Bedeutung, Reduce Motion und robuste Eingabe im Onboarding auf echten Geräten testen.
4. **Ring-Design:** Kalorien-/Makro-Ring klar von Apples drei Activity Rings unterscheiden.
5. **Metadaten/Claims:** Screenshots zeigen echte App; AI-/Genauigkeits-/Health-Aussagen sind belegbar; bezahlte Funktionen klar gekennzeichnet; EN/DE vollständig und konsistent.
6. **Teen-/Regionenprüfung:** nicht vorschnell Kids Category wählen, aber Altersfreigabe, Minderjährigen-Datenschutz und mögliche regionale Age-Assurance-Pflichten dokumentiert entscheiden.
7. **IPv6-only und Backend-Resilienz:** Supabase, Gateway, Nutrition APIs, PostHog und RevenueCat unter Reviewbedingungen testen.

## Offene oder technisch eingeschränkte Quellenlage

- Bei vielen Apple-Documentation-, HIG- und App-Store-Connect-Help-Seiten zeigt Apple **kein Veröffentlichungs- oder Aktualisierungsdatum**. Dieses Register erfindet kein Datum aus Suchindex- oder Crawl-Angaben; dort steht bewusst „nicht ausgewiesen“.
- Die HIG- und einige Documentation-Seiten werden clientseitig aus Apples DocC-Daten geladen. Der Inhalt war am Abrufdatum über Apples eigenen Seiteninhalt/DocC-Endpunkt erreichbar. Das ist keine Drittquelle; die Darstellungsform erschwert jedoch eine klassische Seitenzeilen-Zitation.
- Apples öffentliches Material entscheidet nicht, welche Daten Kandro **tatsächlich** an Supabase, OpenRouter, PostHog, RevenueCat oder andere Endpunkte sendet. Das kann nur Code-, Netzwerk- und Archiv-Evidenz klären.
- Apples Altersfreigabe-Seiten erlauben keine belastbare Vorhersage des finalen Kandro-Ratings ohne die tatsächlichen App-Store-Connect-Antworten. Ein gewünschtes Rating wurde daher nicht behauptet.
- Die Declared-Age-Range-/Age-Assurance-Pflicht ist regions- und rechtsabhängig. Apple stellt Werkzeuge und Hinweise bereit, ersetzt aber keine juristische Bewertung der Kandro-Zielmärkte.
