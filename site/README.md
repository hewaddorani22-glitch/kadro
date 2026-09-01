# getkandro.com

Statische Website. Kein Build, keine Abhängigkeiten — die Dateien sind das
Deployment.

## Warum es sie geben muss

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

## Deployen

Beliebiger Static-Host. Ordner `site/` als Root, kein Build-Command.

**Cloudflare Pages / Netlify** lesen `_redirects`, sodass `/privacy` ohne
`.html` funktioniert.

**Vercel** liest `vercel.json` mit `cleanUrls`.

**GitHub Pages** kann keine Extension-losen URLs. Dort entweder die
`.html`-Endungen in den Links behalten oder einen der beiden Hosts oben nutzen.

## DNS

Beim Registrar von `getkandro.com` auf den Host zeigen:

- `A`/`ALIAS` für `getkandro.com` → Host-Adresse
- `CNAME` für `www` → `getkandro.com`

Danach prüfen, dass **https** greift — Apple akzeptiert keine reine
http-Adresse, und `npm run validate:release` verlangt ebenfalls `https://`.

## Nach dem Deploy prüfen

```bash
curl -sI https://getkandro.com/privacy | head -1
curl -sI https://getkandro.com/support | head -1
```

Beide müssen `200` liefern, nicht `301` auf eine Fehlerseite.
