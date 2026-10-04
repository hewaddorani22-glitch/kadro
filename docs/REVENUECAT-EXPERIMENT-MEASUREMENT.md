# Freiwillige RevenueCat-Auswertung des Zugangstests

Lokaler Implementierungsstand vom 04.10.2026; kein Nachweis einer Aktivierung, eines ausgelieferten Builds oder bereits eingegangener RevenueCat-Daten.

## Einwilligung und Datenumfang

Der eigene Schalter „A/B-Variante mit RevenueCat auswerten“ ist standardmäßig aus und unter Datenschutz im Profil sowie auf der Paywall erreichbar. Damit können auch gesperrte B-Teilnehmer entscheiden und widerrufen. Der bestehende PostHog-Schalter wird weder gelesen noch übernommen. Dieser zusätzliche Zweck verknüpft die ursprüngliche Variante mit der bereits für Abos verwendeten Supabase-Konto-ID bei RevenueCat; er ist keine anonyme PostHog-Auswertung.

Nur diese drei benutzerdefinierten Attribute dürfen geschrieben werden:

| Schlüssel | Erlaubter Inhalt |
| --- | --- |
| `kandro_experiment` | `paywall_access_v1` |
| `kandro_variant` | ursprüngliche Servervariante `A` oder `B` |
| `kandro_measurement_consent` | `rc_experiment_v1` |

Es werden keine Mahlzeiten, Fotos, Texte, Körperdaten, Alterswerte, Ausschlussgründe, Store-Belege oder Transaktionskennungen ergänzt. Die lokale Einwilligung ist versioniert und kontogebunden; sie gilt nicht automatisch für ein anderes Konto. Bestätigte Minderjährigkeit schaltet sie aus. Accountlöschung entfernt lokale Messzustimmungen; der vorhandene Backend-Löschpfad löscht den verknüpften RevenueCat-Kunden.

## Herkunftsfilter

Erst nach der zusätzlichen Zustimmung und bei einer geeigneten öffentlichen A/B-Zuordnung ruft das bestehende Expo-Modul `KandroWidgets` lesend `AppTransaction.shared` auf. Apple kann hierfür eine Netzwerkverbindung benötigen; dies steht im Einwilligungstext. Kandro versendet dafür selbst weder einen Receipt noch einen HTTP-Aufruf. Die Brücke liefert nur `production`, `test` oder `unknown` an JavaScript.

Positiv ist ausschließlich ein von StoreKit als `.verified` eingestuftes `AppTransaction` mit Bundle-ID `com.hewaddorani.kandro` und Umgebung `.production`. Debug, Simulator, Sandbox und Xcode werden ausgeschlossen. Eine fehlende Brücke in alten Binaries, iOS vor 16, unbestätigte Signatur, abweichende Bundle-ID, unbekannte Umgebung, Fehler oder mehr als fünf Sekunden Wartezeit führen zu `unknown` und keinem Export. Es werden keine Gerätehashes oder Fingerprints ausgelesen. Diese Prüfung ist ausschließlich ein Messfilter und hat keine Wirkung auf Kaufrechte, Kontingente oder App-Zugang.

`native-store`, ein Release-Binary, Expo `APP_STORE` oder das funktionale Access-Feld `environment: production` beweisen allein keine Herkunft außerhalb TestFlight. Zusätzlich werden serverseitige QA-Zuordnungen sowie `local`, `testflight` und `review` ausgeschlossen. Ein bisher exportierter Teilnehmer, der später QA oder anderweitig ungeeignet wird, erhält eine Löschanforderung für die eigenen Messattribute.

Die separate Migration `20261004150033_preserve_paywall_qa_measurement_source.sql` bewahrt `source: qa` und die QA-Umgebung auch nach Ablauf der QA-Zeit. Nur der noch aktive QA-Eintrag beeinflusst weiterhin Variante und Zugang. Abgelaufene QA-Rechte werden dadurch nicht verlängert. Der bestehende Clientvertrag bleibt unverändert.

Zusätzlich muss `appAccess` die Zuordnung im laufenden Prozess gerade erfolgreich vom Server für denselben Kontoinhaber gelesen haben. Ein separater flüchtiger Marker wird vor jeder Aktualisierung, beim Offline-Fallback und beim Identitätswechsel geschlossen. Ein alter gecachter öffentlicher B-Datensatz erhält weiterhin seinen bisherigen Zugangsschutz, erlaubt allein aber keinen Export. Widerruf und Löschanforderungen hängen nicht von diesem Mess-Frischemarker ab.

Apple dokumentiert die [asynchrone verifizierte App-Transaktion und mögliche Netzwerknutzung](https://developer.apple.com/documentation/storekit/apptransaction/shared) sowie die [signierende Umgebung](https://developer.apple.com/documentation/storekit/apptransaction/environment). Der [offizielle WWDC25-Beitrag](https://developer.apple.com/videos/play/wwdc2025/241/) erläutert die StoreKit-Signaturprüfung. Der lokal installierte SDK-Vertrag steht in `node_modules/react-native-purchases/dist/purchases.d.ts`: `setAttributes` schreibt Attribute; ein leerer String löscht einen Schlüssel.

## Zuordnung, Widerruf und Kontowechsel

Der Messpfad liest die funktionale Serverzuordnung und führt keine Randomisierung aus. Eine lokal gemerkte ursprüngliche Variante kann nicht durch eine später abweichende Variante ersetzt werden. Kauf, Kündigung, Restore und App-Abbruch ändern diese Gruppe nicht. Die Messkomponente liegt außerhalb des Zugangs-Routenschutzes und hängt nicht von einem Paywall-View oder Kaufereignis ab.

Widerruf schließt den Speichergate synchron, auch bei einem Schreibfehler. Eine laufende Apple-Prüfung darf im Betriebssystem fertiglaufen, ihre verspätete Antwort kann jedoch keine Attribute mehr auslösen und blockiert die Löschanforderung nicht. Nur die drei eigenen Attributschlüssel werden mit dem vom SDK dokumentierten Leerstring gelöscht. Eine ausstehende Löschung bleibt lokal gespeichert und wird für dasselbe Konto beim nächsten möglichen Abgleich wiederholt. Der nächste Nutzer erhält weder die Zustimmung noch die ausstehenden Daten seines Vorgängers.

RC-Konfiguration, `logIn`, lokales `logOut` und Attributschreiben teilen eine serielle Identitätswarteschlange. Der optionale Writer erstellt keine Supabase-Identität und führt selbst keinen Login aus. Er prüft aktuelle Supabase-ID, RC-AppUserID und den noch gültigen Consent-/Lifecycle-Zustand unmittelbar vor jedem SDK-Aufruf. Der SDK-Aufruf bestätigt nur lokale SDK-Annahme: tatsächliche Serverzustellung, Löschung im RevenueCat-Konto und Aufnahme in Auswertungen sind dadurch noch nicht belegt.

## Auswertung und Gates

Die ursprüngliche funktionale Serverzuordnung bleibt der Maßstab für den vollständigen Intent-to-treat-Nenner. Nutzer, die nach Zuteilung abbrechen, bleiben in ihrer ursprünglichen Gruppe. RC-Attribute bilden ausschließlich die freiwillig eingewilligte, herkunftsgeprüfte Messkohorte ab. Fehlende Zustimmung, iOS-15-Geräte, unbekannte Herkunft, Netzfehler und Zustellverluste fehlen dort. Diese Teilmenge ist weder „alle Downloads“ noch automatisch repräsentativ; anonym Ausgeschlossene sind keine Kontrollgruppe. Profil- und Paywall-Einwilligungen können unterschiedliche Auswahlmuster erzeugen. Keine Conversion-, Umsatz- oder Überlegenheitsaussage aus bloßen SDK-Aufrufen ableiten.

Die wiederhergestellte konservative Einschlussregel wird durch den funktionalen Serverpfad bestimmt; dieser Adapter fügt keine neue Kohorte hinzu. Historisch bereits zugeteilte Konten dürfen nicht neu ausgelost werden. Eine spätere Kontoverknüpfung darf weder frühere Rechte ändern noch eine neue Zuteilung erzeugen.

Lokale Nachweise:

- `node scripts/validate-revenuecat-experiment.mjs`: führt die echten TS-Policy-, Consent-, Lifecycle- und SDK-Adaptermodule mit lokalen SDK-/Storage-Grenzen aus; prüft Default-off, getrennte Einwilligung, öffentliche A/B-Filter, QA/Unknown, stabile ITT-Variante, Account-Races, Widerruf/Retry, Minderjährigkeit und Löschung. Führt außerdem sieben Zweige der echten Swift-Klassifikationspolicy aus. Keine Live-Provideraufrufe.
- `node scripts/validate-revenuecat-native-origin.mjs`: compiliert den exakten StoreKit-Closure für `arm64-apple-ios15.1`, ohne `DEBUG` oder Simulatorzweig, ausschließlich Typecheck und ohne Ausführung. Dies ersetzt nicht den kompletten Expo-/Host-Build.
- `node scripts/validate-paywall-access.mjs`: prüft mit dem echten `appAccess`-Modul zusätzlich Live-Antwort, sofortiges Schließen vor Refresh, erhaltenen B-Cache ohne Messfreigabe und verworfene Antworten nach Identitätswechsel.
- `scripts/validate-paywall-qa-source-postgres.py`: eigene lokale PostgreSQL-Clone-Datenbank mit acht synthetischen Fällen; fünf Gruppen bestanden. Dauerhafte QA-Messquelle, unveränderte Access-Felder/Zuordnungen, abgelaufener Override, Kaufvorrang und eingeschränkte Funktionsrechte sind geprüft. Kein Hosted-Nachweis.

Der komplette native Host-/Widgetbuild einschließlich neuem Swift-Helfer ist inzwischen bestanden; die QA-Quellenmigration ist mit exakt rückgelesener Funktionsdefinition bereitgestellt. Die aktuelle vollständige Suite und Nachweise stehen im [Growth-Folgebericht](qa/GROWTH-FOLLOWUP-2026-10-04.md). Dies bestätigt keine native Bedienung oder erfolgreiche Apple-Verifikation: der Simulator-Systemstart blockiert vor dem Appstart.

Noch separat zu bestätigen: tatsächlicher TestFlight-Negativfall; tatsächlicher öffentlicher StoreKit-Positivfall nach Auslieferung; freiwilliger Widerruf einschließlich bestätigter RevenueCat-Zustellung. Vor einem neuen Binary bleiben alte Builds ohne Bridge für diesen zusätzlichen Export gesperrt. Aktualisierte Einwilligungs-/Rechtstexte und Review-Metadaten gehören zum gemeinsamen Release-Gate. Keine dieser Prüfungen erteilt Build-, Upload-, Review- oder Veröffentlichungsfreigabe.
