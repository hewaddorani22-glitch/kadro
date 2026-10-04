# Kontolöschung, neues Konto und gekündigte Verlängerung

Datum: 6. September 2026. Keine Code-/Produktkonfigurationsänderung, kein Deployment, kein neuer Build, keine Review-Einreichung.

## OWNER_CONFIRMED

Nutzer berichtet: Kandro-Konto mit Pro gelöscht, neues Konto angelegt. Erneuter Kaufversuch meldete bereits laufendes Abo. Danach wurde laut ausdrücklicher Klarstellung die automatische Abo-Verlängerung bei Apple gekündigt (nicht nur der Kaufdialog abgebrochen). Anschließend war Pro im neuen Kandro-Konto sichtbar. Fortsetzung erfolgte nach Bestätigung der TestFlight-Installation von Build 15; konkretes Gerät, Transaktions-ID, Zeitpunkt und Ablaufdatum dieses Ablaufs sind nicht unabhängig bestätigt.

## Einordnung und Grenzen

Apple-Abo und Kandro-Konto sind getrennte Vorgänge. Löschung des RevenueCat-Kunden kündigt das Apple-Abo nicht. Eine abgeschaltete Verlängerung entzieht während der verbleibenden Laufzeit nicht automatisch die Zugriffsrechte. Eine erneute Zuordnung des bestehenden Store-Kaufs zum neuen Konto ist möglich und erklärt das Verhalten plausibel. Ein neuer kostenpflichtiger Kauf, eine konkrete TRANSFER-Transaktion, das Ende der Laufzeit oder erfolgreiche explizite Wiederherstellung sind aus der Schilderung nicht bewiesen. Dies ist kein belegter Gratis-Pro-Fehler und kein vollständiger Kauf-/Restore-/Ablauf-PASS.

## STATIC / UNIT

- `delete-account` entfernt RevenueCat-Kunden und Supabase-Konto; keine Apple-Abo-Kündigung. In-App-Warnung DE/EN vorhanden.
- SDK verwendet aktives kandro_pro-Entitlement. Der Provider bestätigt Pro zusätzlich serverseitig; ein abgebrochener Kauf setzt Pro nicht pauschal auf aktiv.
- Server prüft Apple-App-Store, erlaubtes Produkt/Entitlement und RevenueCat `gives_access`; abgeschaltete Verlängerung ist kein sofortiger Entzug.
- `node scripts/validate-entitlements.mjs`: PASS.
- `node scripts/validate-subscription.mjs`: PASS.
- Direkter Test der echten `activeIosSubscriptionFromV2`-Funktion mit synthetischen Eingaben: aktive Sandbox-Laufzeit mit `auto_renewal_status=will_not_renew` behält korrekte Restlaufzeit; providerbestätigter Ablauf (`gives_access=false`) und Entzug trotz zukünftigen Datums liefern inaktiv. PASS. Kein Zugriff auf persönliche Transaktionen.

## Noch offen

Explizites Wiederherstellen im neuen Konto und serverseitiger Abgleich der konkreten Transaktion inklusive Ablauf. Tatsächlichen Entzug nach Ende der Laufzeit getrennt prüfen. Review-Gesamturteil bleibt CONDITIONAL_NO_GO.

## Quellen

- https://www.revenuecat.com/docs/subscription-guidance/managing-subscriptions
- https://www.revenuecat.com/docs/projects/restore-behavior
- https://www.revenuecat.com/docs/guides/testing-guide/use-cases
- https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields

## Nachtrag: explizite Wiederherstellung bestätigt

Nutzer bestätigt nach der Aufforderung zum vollständigen Neustart und Wiederherstellen die Meldung „Käufe wiederhergestellt – Kandro Pro ist wieder aktiv“. Dieser konkret gemeldete Geräteablauf ist PASS / OWNER_CONFIRMED. Die read-only Serverkontrolle findet genau ein kürzlich geprüftes Konto, erstellt 13:28:48 MESZ, Pro aktiv, zuletzt geprüft 13:33:34 MESZ, gespeichert bis 14:32:11 MESZ. Sandbox-INITIAL_PURCHASE und CANCELLATION wurden um 13:30 MESZ verarbeitet. Das passt zeitlich zum gemeldeten Ablauf; genaue Identität/Originaltransaktion sind nicht unabhängig bestätigt. Siehe `restore-server-observation.json`. Kein Ablauf- oder Doppelabrechnungsnachweis.
