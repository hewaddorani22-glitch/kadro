# Build 16: Kernprüfung bestanden und App Review eingereicht

Aktueller Stand am 6. September 2026: Der Eigentümer hat nach Klärung des kostenlosen Buildkontingents die gezielte Kernprüfung und App-Review-Einreichung ausdrücklich erneut beauftragt. Build **1.0.0 (16)** enthält F08 und wurde erfolgreich zu Apple hochgeladen. Apple hat den Build verarbeitet. Am **6. September 2026 um 14:28 MESZ** wurden App1.0.0(16), Abo-Gruppe, Monthly und Annual gemeinsam übermittelt. Alle vier stehen auf **Warten auf Prüfung**. [Übermittlungsdetail](https://appstoreconnect.apple.com/apps/6808622187/distribution/reviewsubmissions/details/6124065d-7d86-4075-bfbe-7a17c5427d8e). Beleg: `EVIDENCE/core-release/apple-review-submission.json`.

## Grundlage der positiven Kernbewertung

- Lebensmittelsuche mit echter BLS-Referenz, Mengenänderung und einmaligem Speichern beobachtet. Banana150g →119kcal; Tagesbilanz korrekt.
- Je drei nächste Mahlzeiten für Zuhause/Supermarkt/Unterwegs, Rezept und Übernahme als gegessen geprüft. Risotto535kcal; Summe1364kcal und Rest1056kcal bleiben nach Prozessneustart erhalten.
- Deutscher Barcodepfad mit Milka LU7622210022776, manuell30g →154kcal; danach1518 gegessen/902 übrig. Kein KI-Aufruf dafür.
- Physische Fotoanalyse, Portionskorrektur, Speichern und Neustart sowie aktive Kaufwiederherstellung nach Konto-Neuanlage vom Eigentümer auf Build15 bestätigt. Keine Behauptung eines vollständigen physischen Build16-Tests.
- F08: DE/EN, normale/maximale Systemschrift, Tarifwahl, Kaufbereich und Rechtslinks lokal nativ nachgeprüft; genau die zwei geprüften Produktänderungen in Build16 übernommen.
- Vollständige Verify-Suite nach letzter Produktänderung bestanden; remote EAS-/Releasekonfiguration erneut erfolgreich. Signatur, Bundle-ID, Version16, Xcode26/iOS26SDK und16Privacy-Manifeste am fertigen IPA geprüft.

Konkrete Belege und Prüfumgebungen: `EVIDENCE/core-release/CORE_TESTS.md`, `EVIDENCE/core-release/build16-package.json`, `EVIDENCE/large-text/RESULT.md`. Ein Hashvergleich ersetzt keinen Verhaltenstest.

## Verbleibende Grenzen

Kein offener schwerwiegender Fehler in den hier ausgeführten Kernabläufen. Das ist eine begrenzte Releasebewertung, keine Garantie für Fehlerfreiheit oder Apple-Genehmigung. Kalorienerfassung erfolgt über Lebensmittel und Portionen; ein separater Modus nur für eine Kalorienzahl wurde nicht gefunden.

Nicht als bestanden ausgegeben: gewogene30-Foto-Referenzserie, sämtliche Storefronts, Erstattung/Aboablauf und alle Monats-/Jahreswechsel, physischer VoiceOver-/Swipe-Pass und alle Offline-/Langzeitfälle. Die umfassendere Coverage bleibt unverändert nachvollziehbar. Diese Entwicklungs-/Nachweisziele werden nach dem aktuellen kostenbewussten Kernauftrag nicht pauschal zu Apple-Einreichungsvoraussetzungen erklärt.

Zwei kleine bestehende P3-Punkte: Barcode-Zurückknopf heißt „Foto wiederholen“; kompakte DE-Makrowerte teilweise mit Dezimalpunkt. Keine falsche Bilanz oder Speicherdopplung in diesen Tests. Kein weiterer Build nur dafür. Transitive npm-Advisories und der historische Build11-Crash ohne Diagnose bleiben separat dokumentiert.

DSA weiterhin **In Prüfung** (frisch beobachtet); Verträge, Bank und Steuerformulare aktiv. Die DSA-Verifizierung betrifft die EU-Veröffentlichung. Manuelle Veröffentlichung bleibt gewählt. Keine umfassende weltweite Rechtsfreigabe behauptet.

## Kosten und Historie

Genau ein zusätzlicher Standardbuild aus dem aktuell angezeigten kostenlosen iOS-Kontingent; keine Tarifänderung, kein zusätzlicher bezahlter KI-Test oder echter Abo-Kauf in diesem Kernpass. Die frühere5-EUR-Anfrage war eine unnötige vorsorgliche Obergrenze, keine nachgewiesene Gebühr.

Früherer NO_GO-Bericht für Build15 unverändert als `EVIDENCE/core-release/before-build16-VERDICT.md` gesichert. Originalchatarchiv und iCloud-Code nicht verändert.
