#!/usr/bin/env python3
"""Compose the Kandro App Store screenshots from real simulator captures.

Every phone screen is an unedited iPhone 17 Pro Max capture (1320 x 2868) of the
release app, except where frames.json names an `overlay` (a meal photo placed
into the app's own photo slot). Headlines are rendered in SF Pro by headless
Chrome so typography matches iOS. Output: app-store/screenshots/<locale>/.
"""
from __future__ import annotations

import html
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CAPTURES = HERE / "captures"
OUT = ROOT / "app-store" / "screenshots"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
W, H = 1320, 2868

THEMES = {
    "moss": {"bg": "radial-gradient(120% 80% at 20% 0%, #3B4F2E 0%, #26351F 45%, #182214 100%)", "ink": "#F7F5EE", "sub": "rgba(247,245,238,0.74)", "eyebrow": "#BBDC8E", "pill": "rgba(187,220,142,0.14)"},
    "cream": {"bg": "linear-gradient(180deg, #F7F5EF 0%, #EEEBE2 100%)", "ink": "#14150F", "sub": "#5E6157", "eyebrow": "#3F5233", "pill": "rgba(63,82,51,0.08)"},
    "pistachio": {"bg": "linear-gradient(180deg, #DDEDC4 0%, #C9E2A3 100%)", "ink": "#14150F", "sub": "#3E4636", "eyebrow": "#26351F", "pill": "rgba(38,53,31,0.10)"},
}

CAMERA = """<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#3F5233" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>"""

MIC = """<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3F5233" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>"""

LOGO = """<svg width="44" height="44" viewBox="0 0 100 100"><circle cx="50" cy="16" r="9" fill="#BBDC8E"/><path d="M27 33 A32 32 0 1 0 73 33" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/></svg>"""


def page(frame: dict, locale: str) -> str:
    t = THEMES[frame["theme"]]
    copy = frame[locale]
    shot = (CAPTURES / locale / frame["capture"]).resolve()
    headline = "<br>".join(html.escape(line) for line in copy["headline"])
    chips = "".join(f'<span class="chip">{html.escape(c)}</span>' for c in copy.get("chips", []))
    overlay = ""
    if frame.get("overlay"):
        o = frame["overlay"]
        overlay = f'<img class="overlay" src="{(HERE / o["src"]).resolve().as_uri()}" style="left:{o["x"]}px;top:{o["y"]}px;width:{o["w"]}px;height:{o["h"]}px;border-radius:{o.get("r", 0)}px">'
    # Covers hide demo-only labels; coordinates are capture pixels.
    scale = 958 / W
    covers = "".join(f'<div style="position:absolute;left:{x*scale}px;top:{y*scale}px;width:{w*scale}px;height:{h*scale}px;background:{c.get('color', '#F5F3EE')}"></div>'
                     for c in frame.get("covers", []) for x, y, w, h in [c["rect"]])
    card = ""
    if frame.get("card"):
        c = frame["card"]
        card = (f'<div class="card" style="left:{c["x"]}px;top:{c["y"]}px;width:{c["w"]}px;transform:rotate({c.get("rotate", 0)}deg)">'
                f'<img src="{(HERE / c["src"]).resolve().as_uri()}" style="height:{c["h"]}px">'
                f'<span class="cardtag">{CAMERA}{html.escape(copy.get("cardLabel", ""))}</span></div>')
    bubbles = "".join(f'<div class="bubble" style="top:{2100 + i * 190}px;{"left:96px" if i % 2 == 0 else "right:96px"}">{MIC}{html.escape(b)}</div>'
                      for i, b in enumerate(copy.get("bubbles", [])))
    sheet_html = ""
    if frame.get("sheet"):
        x, y, w, h = copy.get("sheet", frame["sheet"])
        k = 1160 / w
        sheet_html = (f'<div class="sheet" style="top:{frame.get("sheetTop", 860)}px;height:{h * k}px">'
                      f'<img src="{shot.as_uri()}" style="width:{W * k}px;left:{-x * k}px;top:{-y * k}px"></div>')
    crop = frame.get("cropTop", 0)
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:{W}px;height:{H}px;overflow:hidden}}
body{{background:{t['bg']};font-family:-apple-system,'SF Pro Display',system-ui,sans-serif;color:{t['ink']};position:relative;-webkit-font-smoothing:antialiased}}
.top{{position:absolute;left:96px;right:96px;top:150px}}
.brand{{display:inline-flex;align-items:center;gap:16px;padding:14px 26px 14px 18px;border-radius:999px;background:{t['pill']};color:{t['eyebrow']};font-size:30px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase}}
.brand svg{{color:{t['eyebrow']}}}
h1{{margin-top:54px;font-size:{copy.get('size', 124)}px;line-height:1.02;font-weight:800;letter-spacing:-4.2px}}
p{{margin-top:34px;font-size:46px;line-height:1.3;font-weight:500;color:{t['sub']};letter-spacing:-0.4px;max-width:1080px}}
.chips{{margin-top:38px;display:flex;gap:16px;flex-wrap:wrap}}
.chip{{font-size:32px;font-weight:650;padding:14px 26px;border-radius:999px;background:{t['pill']};color:{t['eyebrow']}}}
.phone{{position:absolute;left:50%;top:{frame.get('phoneTop', 900)}px;width:1010px;transform:translateX(-50%);border-radius:150px;padding:26px;background:#0E0F0C;box-shadow:0 60px 140px rgba(10,14,8,0.42),0 0 0 3px rgba(255,255,255,0.08) inset}}
.screen{{position:relative;width:958px;height:{round(958 * H / W)}px;border-radius:126px;overflow:hidden;background:#F4F2EC}}
.screen img.app{{position:absolute;left:0;top:{-crop * 958 / W}px;width:958px}}
.screen .overlay{{position:absolute;object-fit:cover;transform-origin:0 0;transform:scale({958 / W})}}
.card{{position:absolute;padding:16px 16px 0;background:#FFFFFF;border-radius:44px;box-shadow:0 40px 90px rgba(10,14,8,0.45);z-index:5}}
.card img{{display:block;width:100%;object-fit:cover;border-radius:30px}}
.cardtag{{display:flex;align-items:center;gap:12px;justify-content:center;height:84px;font-size:32px;font-weight:700;color:#14150F;letter-spacing:-0.3px}}
.sheet{{position:absolute;left:80px;width:1160px;overflow:hidden;border-radius:76px;box-shadow:0 60px 140px rgba(10,14,8,0.30),0 0 0 2px rgba(20,21,15,0.05)}}
.sheet img{{position:absolute}}
.bubble{{position:absolute;display:flex;align-items:center;gap:18px;padding:30px 40px;border-radius:999px;background:#FFFFFF;font-size:40px;font-weight:600;color:#14150F;letter-spacing:-0.4px;box-shadow:0 24px 60px rgba(10,14,8,0.14)}}
.island{{position:absolute;top:30px;left:50%;transform:translateX(-50%);width:270px;height:80px;border-radius:40px;background:#000}}
</style></head><body>
<div class="top">
  <div class="brand">{LOGO}<span>{html.escape(copy['eyebrow'])}</span></div>
  <h1>{headline}</h1>
  <p>{html.escape(copy['sub'])}</p>
  {f'<div class="chips">{chips}</div>' if chips else ''}
</div>
{sheet_html}{bubbles}<div class="phone" style="{'display:none' if frame.get('sheet') else ''}"><div class="screen"><img class="app" src="{shot.as_uri()}">{overlay}{covers}{'' if crop else '<div class="island"></div>'}</div></div>
{card}
</body></html>"""


def render(locale: str, only: str | None = None) -> None:
    frames = json.loads((HERE / "frames.json").read_text())
    target = OUT / locale
    target.mkdir(parents=True, exist_ok=True)
    for frame in frames:
        if only and frame["id"] != only:
            continue
        with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as handle:
            handle.write(page(frame, locale))
        png = target / f"{frame['id']}.png"
        png.unlink(missing_ok=True)
        chrome = subprocess.Popen([CHROME, "--headless=new", f"--user-data-dir={tempfile.mkdtemp()}", "--no-first-run", "--disable-gpu",
                                   "--hide-scrollbars", "--force-device-scale-factor=1", f"--window-size={W},{H}", f"--screenshot={png}",
                                   "--allow-file-access-from-files", Path(handle.name).as_uri()],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # Headless Chrome on macOS can linger after writing; stop once the file is stable.
        deadline, last = time.time() + 300, -1
        while time.time() < deadline:
            time.sleep(1)
            size = png.stat().st_size if png.exists() else -1
            if size > 0 and size == last:
                break
            last = size
        chrome.kill()
        if not png.exists():
            raise SystemExit(f"render failed: {png}")
        # App Store Connect rejects alpha channels.
        Image.open(png).convert("RGB").save(png, optimize=True)
        print("wrote", png)


if __name__ == "__main__":
    locales = [sys.argv[1]] if len(sys.argv) > 1 else ["de-DE", "en-US"]
    for loc in locales:
        render(loc, sys.argv[2] if len(sys.argv) > 2 else None)
