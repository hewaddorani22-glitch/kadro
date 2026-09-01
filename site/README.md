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

Die Texte auf `/privacy` und `/terms` sind wortgleich mit den Screens in der
App. **Wenn du einen davon änderst, ändere beide** — eine Abweichung zwischen
App und Website fällt im Review auf.

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
