# Finaler Live-URL-Abgleich

**Zeitpunkt:** 5. September 2026, Europe/Berlin
**Methode:** redirect-folgende HTTPS-GET-Anfragen ohne Authentifizierung
**Deployment im Audit:** keines

## Erreichbarkeit

| URL | HTTP | Ergebnis |
| --- | ---: | --- |
| `https://getkandro.com/` | 200 | erreichbar |
| `https://getkandro.com/en/` | 200 | erreichbar |
| `https://getkandro.com/privacy/` | 200 | erreichbar |
| `https://getkandro.com/en/privacy/` | 200 | erreichbar |
| `https://getkandro.com/terms/` | 200 | erreichbar |
| `https://getkandro.com/en/terms/` | 200 | erreichbar |
| `https://getkandro.com/support/` | 200 | erreichbar |
| `https://getkandro.com/en/support/` | 200 | erreichbar |
| `https://getkandro.com/impressum/` | 200 | erreichbar |
| `https://getkandro.com/unsubscribe/` | 404 | lokaler Remediation-Pfad nicht live |
| `https://getkandro.com/en/unsubscribe/` | 404 | lokaler Remediation-Pfad nicht live |

## Quellstand gegen Live-Stand

Die Erreichbarkeit der bestehenden Seiten beweist keine inhaltliche Gleichheit.
Ein byteweiser SHA-256-Vergleich ergab:

| Seite | lokaler SHA-256 | Live-SHA-256 | Gleich |
| --- | --- | --- | --- |
| DE Privacy | `d529fdd8056214f9a84146f415fdd31fa745f277ecac72b3138177f48aa11616` | `c12251a0a1b0021e347d2e153c3de3a12e1327cf2f9fcb31b9eebbe61e1e354f` | nein |
| EN Privacy | `2100f5a83d8b65908384c0ff42150e94813d3019ed24d5b46ea1c01807b5e51e` | `fc9197f97f89d380fc9cd1190e34f317736ec74549fb5ef612e22fed37386145` | nein |

Zusätzlich wurden die neuen lokalen Hinweise auf kurzlebige, pseudonyme
Provider-Limit-Zähler in beiden Live-Privacy-Seiten nicht gefunden. Das ist
mit den 404-Antworten der beiden Abmeldeseiten ein reproduzierbarer Beleg,
dass die lokalen Web-/Privacy-Korrekturen noch nicht veröffentlicht sind.

## Gate

**Status: `FAIL`.** Die vorhandenen Support-, Privacy- und Terms-URLs sind
öffentlich erreichbar. Vor Einreichung müssen jedoch Backend und Website in
kontrollierter Reihenfolge ausgerollt und danach derselbe Live-Test sowie der
DE-/EN-Wartelisten-/Abmelde-E2E-Test wiederholt werden.
