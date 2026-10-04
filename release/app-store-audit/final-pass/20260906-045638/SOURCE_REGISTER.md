# Primärquellenregister

Abrufdatum aller folgenden Quellen: **2026-09-06**. Bezieht sich auf den tatsächlichen Kandro-Datenweg; keine pauschale Übertragung jeder Regel auf jede App. Keine kompletten Richtlinien kopiert. JS-/Abrufgrenzen sind ausdrücklich vermerkt.

| Quelle | Relevanter Abschnitt / Bedeutung / Grenze |
|---|---|
| [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) | 2.1 Vollständigkeit, 3.1.2 Abos, 5.1 Datenschutz; insbesondere 5.1.2(i) externe KI/ausdrückliche Zustimmung. 4.8 nicht allein wegen eigener E-Mail-Anmeldung ausgelöst. Keine Annahmegarantie. |
| [Apple Upcoming Requirements](https://developer.apple.com/news/upcoming-requirements/) | Seit 28.04.2026 Xcode 26 / iOS-26-SDK für Upload; aktualisierte Altersfragen; EU-DSA-Verifizierung. Archiv/SDK-Version getrennt vom Deployment Target prüfen. |
| [Apple DSA Trader Requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/) | Händleridentität und EU-Verfügbarkeit; aktuelle konkrete Kontoanzeige ist „In Prüfung“. |
| [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/) | Erhebung/Verknüpfung/Zwecke einschließlich Drittanbieter; rein flüchtige Echtzeitverarbeitung getrennt von Aufbewahrung. Optionaler Opt-in allein befreit nicht automatisch von Deklaration. |
| [Apple User Privacy and Data Use](https://developer.apple.com/app-store/user-privacy-and-data-use/) | Tracking/ATT anhand tatsächlicher Zwecke und Zusammenführung beurteilen, nicht allein SDK-Namen. |
| [Apple Third-party SDK Requirements](https://developer.apple.com/support/third-party-SDK-requirements/) | Native SDKs, Signaturen, Privacy-Manifeste; Binary-Nachweis erforderlich. |
| [Apple Privacy Manifest Files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files) | Abruf lieferte nur JS-Dokumentationshülle. Keine vollständige Inhaltsprüfung behauptet; Archivprüfung separat. |
| [Apple Account Deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/) | In-App-Löschmöglichkeit, auch für automatisch angelegte Accounts; Apple-Abokündigung getrennt erklären. |
| [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/) | Allgemeine Referenz; Abruf nur Hülle. Kein vollständiger HIG-/VoiceOver-/Dynamic-Type-Nachweis. |
| [Apple Localization](https://developer.apple.com/localization/) | Lokalisierung über Stringübersetzung hinaus; Storefront bleibt vom Geräte-Locale getrennt. |
| [Apple erste IAP/Abos einreichen](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase) | Erste Abonnementgruppe/-produkte zusammen mit neuer App-Version prüfen lassen; noch keine Review-Aktion ausgeführt. |
| [Expo SDK 54 Localization](https://docs.expo.dev/versions/v54.0.0/sdk/localization/) | getLocales ist geordnete Sprachpräferenz, regionCode separat; iOS-Locale-Werte innerhalb laufender App statisch. Grundlage des Resolver-Fixes. |
| [Expo Localization Guide](https://docs.expo.dev/guides/localization/) | App-/native Lokalisierung und bevorzugte Sprache. SDK-spezifische Details aus v54. |
| [Expo EAS Build](https://docs.expo.dev/build/introduction/) | Native Cloud-Builds; erfolgreicher Webexport beweist kein iOS-Archiv. |
| [Expo Build Configuration](https://docs.expo.dev/build/eas-json/) | Standard-Resource-Class medium. Bestehendes Produktionsprofil ohne Large-Override. |
| [Expo Usage Pricing](https://docs.expo.dev/billing/usage-based-pricing/) | iOS medium 2 USD pro Build vor Credits/Steuern laut Preistabelle. Ein Build unter freigegebenem 5-EUR-Rahmen; kein neuer Tarif gekauft. Tatsächliche Rechnung nicht eingesehen. |
| [RevenueCat Apple Sandbox](https://www.revenuecat.com/docs/test-and-launch/sandbox/apple-app-store) | Native Sandbox-Kauf-/Restore-Prüfung. Simulator-/StoreKit-Konfiguration und echter aktiver Entitlement-Nachweis getrennt. |
| [OpenRouter Data Collection](https://openrouter.ai/docs/guides/privacy/data-collection) | Content-Retention und Metadaten unterscheiden; Konfiguration ist kein auditierter Löschbeleg. |
| [OpenRouter ZDR](https://openrouter.ai/docs/guides/features/zdr) | ZDR-Routing und Providerbedingungen; Kandro setzt ZDR, Azure-only, keine Fallbacks. |
| [GPT-4.1 mini Modell/Preise](https://openrouter.ai/openai/gpt-4.1-mini) | Azure 0.40 USD/M Input, 1.60 USD/M Output am Abruf. Vier kleine JPEG-Requests; konservativ 100k Input +2k Output je Request = 0.1728 USD Oberabschätzung, keine gemessene Rechnung. |
| [Open Food Facts Produkt 7622210022776](https://world.openfoodfacts.org/api/v2/product/7622210022776.json?fields=code,product_name,brands,quantity,nutriments,last_modified_t,countries_tags) | Primär-Datensatz Milka LU 87g; 513 kcal/100g, P6.4/C62.5/F25.5. Gateway DE/EN stimmt überein. Community-Datensatz ist nicht das gewogene Nutzerprodukt. |
| [Milka LU Hersteller NL](https://www.milka.com/nl/producten/milka-lu-87g-41745/) | 87g-Variante 512 kcal, P6.2/C63/F26 pro100g. Kleine Abweichung zum OFF-Datensatz; Barcode/Verpackung des konkreten Produkts nötig. |
| [DSGVO amtlich](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng) | Art.8 Minderjährige, Art.9 besondere Kategorien, Art.13 Information, Kapitel V Transfers als Prüfbedarf. Keine länderübergreifende Rechtsfreigabe aus technischem Consent abgeleitet. |
| [UK Data Protection Act §9](https://www.legislation.gov.uk/ukpga/2018/12/section/9) | Abruf nicht erfolgreich. UK-Alters-/Gesundheitsdatenfreigabe UNVERIFIED. |
| [FTC Mobile Health App Tool](https://www.ftc.gov/business-guidance/resources/mobile-health-apps-interactive-tool) | Prüfschema für FTC/HBNR/COPPA und weitere Anwendbarkeit. Wellness-Bezeichnung allein schließt Pflichten nicht aus; kein automatisches HIPAA-Urteil. |
| [PDPC Children’s Personal Data](https://www.pdpc.gov.sg/media-events/advisory-guidelines-on-the-pdpa-for-childrens-personal-data-in-the-digital-environment-now-available) | Offizielle Bekanntmachung verfügbar; vollständige Guidelines/Vertragsfähigkeit für SG nicht abschließend geprüft. |
| [ANPD Kinder-/Jugenddaten](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-enunciado-sobre-o-tratamento-de-dados-pessoais-de-criancas-e-adolescentes) | Offizielles Suchergebnis verfügbar, Volltextabruf fehlgeschlagen. BR-Rechtsfreigabe nicht behauptet. |

Eigene Live-Quellen: App Store Connect App 6808622187 (Version, Abos, Datenschutz, DSA), EAS Build-ID im Release-Register, Supabase Function-/Migrations-Readback, `EVIDENCE/website-live.json`. Diese Kontoanzeigen sind Punktaufnahmen und werden nicht durch historische Chats ersetzt.
