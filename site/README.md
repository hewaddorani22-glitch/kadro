# getkandro.com

Statische Website. Kein Build, keine Abhängigkeiten — die Dateien sind das
Deployment.

**Live:** https://hewaddorani22-glitch.github.io/kadro/
**Ziel:** https://getkandro.com (wartet nur noch auf DNS, siehe unten)

Jeder Push auf `main`, der `site/` berührt, deployt automatisch über
`.github/workflows/pages.yml`. Nichts manuell hochladen.

## Warum es die Seite geben muss

App Store Connect verlangt zwei öffentlich erreichbare URLs als Pflichtfelder,
und die App verweist im Datenschutz und in den Bedingungen darauf:

| Seite | Zweck |
|---|---|
| `/privacy` | Privacy Policy URL in App Store Connect, Pflichtfeld |
| `/support` | Support URL in App Store Connect, Pflichtfeld, muss echten Kontakt enthalten |
| `/terms` | EULA-Verweis auf der Paywall |
| `/impressum` | § 5 DDG, Pflicht für gewerbliche Anbieter in Deutschland |

## Die Rechtstexte nicht von Hand bearbeiten

`/privacy`, `/terms`, `/sources` und ihre englischen Gegenstücke unter `/en/`
werden aus den Wörterbüchern der App erzeugt:

```
src/i18n/legal.de.ts  →  site/privacy|terms|sources/index.html
src/i18n/legal.en.ts  →  site/en/privacy|terms|sources/index.html
```

Text ändern heißt: die `.ts`-Datei ändern und `npm run site:legal` laufen
lassen. `npm run verify` bricht ab, wenn die HTML-Dateien nicht mehr zur App
passen — lokal und in der CI.

Die Anbieterangaben kommen aus `EXPO_PUBLIC_LEGAL_*`. Sie stehen deshalb auch
im CI-Workflow: nach § 5 DDG sind sie ohnehin öffentlich und stehen im
Impressum, und ohne sie könnten die Seiten nicht erzeugt werden.

Vorher stand hier „ändere beide von Hand". Das hat nicht funktioniert: die
Website sprach von „Account-ID", die App von „Supabase-IDs", und § 4 hatte in
beiden eine andere Überschrift. Genau so eine Abweichung fällt im Review auf.

## Zweisprachigkeit

Deutsch liegt in der Wurzel, Englisch unter `/en/`. Jede übersetzte Seite trägt
`canonical` plus `hreflang` für `de`, `en` und `x-default` (Standard ist die
deutsche Seite). `npm run validate:site` prüft, dass jeder interne Link
auflöst und die Sprachpaare aufeinander zeigen.

Das Impressum bleibt bewusst nur auf Deutsch — § 5 DDG ist deutsches Recht und
die Pflichtangaben sind an die deutschen Begriffe gebunden.

## Domain anschließen — der einzige offene Schritt

### 1. DNS beim Registrar von `getkandro.com` setzen

Vier `A`-Records für die nackte Domain (`@` beziehungsweise leerer Name):

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

Optional zusätzlich vier `AAAA`-Records für IPv6:

```
2606:50c0:8000::153
2606:50c0:8001::153
2606:50c0:8002::153
2606:50c0:8003::153
```

Und ein `CNAME` für `www`:

```
www  ->  hewaddorani22-glitch.github.io
```

### 2. Domain in GitHub eintragen

Sobald die Records gesetzt sind (Verbreitung dauert meist Minuten, im
Extremfall Stunden):

```bash
gh api -X PUT repos/hewaddorani22-glitch/kadro/pages -f cname=getkandro.com
```

Danach HTTPS erzwingen — GitHub stellt das Zertifikat automatisch aus, das
kann einige Minuten dauern:

```bash
gh api -X PUT repos/hewaddorani22-glitch/kadro/pages -F https_enforced=true
```

### 3. Prüfen

```bash
curl -sI https://getkandro.com/privacy | head -1
```

Muss `HTTP/2 200` liefern. Erst dann die URLs in App Store Connect eintragen —
Apple prüft sie beim Einreichen.

## Reihenfolge beachten

Die Domain ist bewusst **noch nicht** in GitHub hinterlegt. Wäre sie es, würde
Pages die github.io-Adresse auf `getkandro.com` umleiten — und solange dort
kein DNS zeigt, wäre die Seite überhaupt nicht erreichbar, genau während man
sie prüfen will.
