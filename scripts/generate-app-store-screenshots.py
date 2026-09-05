#!/usr/bin/env python3
"""Generate the localized Kandro App Store screenshot set.

The output is deliberately deterministic: ImageGen supplies only the meal photo.
Every marketing line, number and app UI element is drawn here so localization and
nutrition claims cannot drift between renders.
"""

from __future__ import annotations

from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "app-store" / "screenshots"
PREVIEWS = ROOT / "app-store" / "previews"
MEAL_PHOTO = ROOT / "app-store" / "assets" / "scan-meal-chicken-bowl.png"

W, H = 1320, 2868

CANVAS = "#F5F3EE"
SURFACE = "#FFFFFF"
INK = "#14150F"
MUTED = "#6E7066"
LINE = "#E4E2D9"
PISTACHIO = "#BBDC8E"
PISTACHIO_SOFT = "#EAF3DA"
MOSS = "#3F5233"
MOSS_DARK = "#26351F"
AMBER = "#C89B4B"
ATTENTION_SOFT = "#F4E8D3"

FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size=size)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def place_rounded(base: Image.Image, item: Image.Image, box: tuple[int, int, int, int], radius: int) -> None:
    x1, y1, x2, y2 = box
    target = item.convert("RGB").resize((x2 - x1, y2 - y1), Image.Resampling.LANCZOS)
    base.paste(target, (x1, y1), rounded_mask(target.size, radius))


def add_shadow(base: Image.Image, box: tuple[int, int, int, int], radius: int, blur: int = 42, opacity: int = 62) -> None:
    x1, y1, x2, y2 = box
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle((x1, y1 + 24, x2, y2 + 24), radius=radius, fill=(20, 28, 15, opacity))
    base.paste(layer.filter(ImageFilter.GaussianBlur(blur)), (0, 0), layer.filter(ImageFilter.GaussianBlur(blur)))


def fit_font(draw: ImageDraw.ImageDraw, text: str, max_width: int, start: int, bold: bool = True, minimum: int = 50) -> ImageFont.FreeTypeFont:
    size = start
    while size > minimum:
        candidate = font(size, bold)
        if draw.textbbox((0, 0), text, font=candidate)[2] <= max_width:
            return candidate
        size -= 2
    return font(minimum, bold)


def draw_wrapped(draw: ImageDraw.ImageDraw, text: str, xy: tuple[int, int], max_width: int, size: int, fill: str, bold: bool = False, spacing: int = 14) -> int:
    words = text.split()
    lines: list[str] = []
    current = ""
    f = font(size, bold)
    for word in words:
        trial = f"{current} {word}".strip()
        if current and draw.textbbox((0, 0), trial, font=f)[2] > max_width:
            lines.append(current)
            current = word
        else:
            current = trial
    if current:
        lines.append(current)
    x, y = xy
    line_height = size + spacing
    for idx, line in enumerate(lines):
        draw.text((x, y + idx * line_height), line, font=f, fill=fill)
    return y + len(lines) * line_height


def draw_brand(draw: ImageDraw.ImageDraw, x: int, y: int, foreground: str) -> None:
    # The Kandro mark is an almost-complete circle with a deliberate opening
    # around twelve o'clock and the pistachio dot sitting inside that opening.
    draw.arc((x, y, x + 54, y + 54), 310, 590, fill=foreground, width=7)
    draw.ellipse((x + 23, y - 1, x + 33, y + 9), fill=PISTACHIO)
    draw.text((x + 72, y + 1), "KANDRO", font=font(24, True), fill=foreground)


def draw_header(base: Image.Image, eyebrow: str, title_lines: list[str], subtitle: str, foreground: str, muted: str) -> int:
    d = ImageDraw.Draw(base)
    draw_brand(d, 92, 78, foreground)
    d.text((92, 180), eyebrow, font=font(27, True), fill=PISTACHIO if foreground != INK else MOSS, stroke_width=0)
    y = 245
    for line in title_lines:
        f = fit_font(d, line, W - 184, 104, True, 68)
        d.text((88, y), line, font=f, fill=foreground, spacing=0)
        y += int(f.size * 1.02)
    y += 34
    return draw_wrapped(d, subtitle, (92, y), W - 184, 42, muted, False, 14)


def phone_shell(base: Image.Image, top: int = 880, height: int = 2140) -> tuple[Image.Image, tuple[int, int, int, int]]:
    outer = (145, top, 1175, top + height)
    add_shadow(base, outer, radius=132)
    d = ImageDraw.Draw(base)
    d.rounded_rectangle(outer, radius=132, fill=SURFACE, outline="#E0DED5", width=3)
    inner = (181, top + 38, 1139, top + height - 38)
    d.rounded_rectangle(inner, radius=100, fill=CANVAS)
    screen = Image.new("RGB", (inner[2] - inner[0], inner[3] - inner[1]), CANVAS)
    return screen, inner


def finish_phone(base: Image.Image, screen: Image.Image, inner: tuple[int, int, int, int]) -> None:
    base.paste(screen, (inner[0], inner[1]), rounded_mask(screen.size, 100))


def small_label(d: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fill: str = MUTED) -> None:
    d.text(xy, text.upper(), font=font(22, True), fill=fill)


def draw_today(screen: Image.Image, locale: str) -> None:
    d = ImageDraw.Draw(screen)
    de = locale == "de-DE"
    date = "Do., 3. September" if de else "Thu 3 September"
    greeting = "Guten Abend, Leon" if de else "Good evening, Leon"
    d.text((66, 72), date, font=font(28, True), fill=MUTED)
    d.ellipse((790, 52, 864, 126), fill=INK)
    d.text((827, 89), "L", font=font(29, True), fill=SURFACE, anchor="mm")
    d.text((66, 170), greeting, font=fit_font(d, greeting, 810, 46, True), fill=INK)

    d.rounded_rectangle((66, 278, 892, 1036), radius=34, fill=SURFACE, outline=LINE, width=3)
    small_label(d, (300, 322), "DEIN TAG BISHER" if de else "YOUR DAY SO FAR")
    d.text((479, 380), "WEITER AUF KURS" if de else "STILL ON TRACK", font=font(31, True), fill=INK, anchor="mm")
    d.arc((250, 454, 708, 912), 0, 360, fill=LINE, width=42)
    d.arc((250, 454, 708, 912), 275, 552, fill=MOSS, width=42)
    d.text((479, 641), "2.095" if de else "2,095", font=font(88, True), fill=INK, anchor="mm")
    d.text((479, 713), "kcal übrig" if de else "kcal left", font=font(30), fill=MUTED, anchor="mm")
    d.ellipse((388, 760, 406, 778), fill=MOSS)
    d.text((420, 765), "Im Plan" if de else "On track", font=font(25, True), fill=MOSS, anchor="lm")
    d.text((479, 964), "1.065 gegessen · 3.160 Ziel" if de else "1,065 eaten · 3,160 goal", font=font(27), fill=MUTED, anchor="mm")

    macros = [
        ("Protein", "86", "von 140 g" if de else "of 140 g", 0.61),
        ("Kohlenh." if de else "Carbs", "121", "von 515 g" if de else "of 515 g", 0.24),
        ("Fett" if de else "Fat", "23", "von 60 g" if de else "of 60 g", 0.38),
    ]
    for i, (label, value, detail, progress) in enumerate(macros):
        x = 66 + i * 282
        d.rounded_rectangle((x, 1086, x + 258, 1360), radius=30, fill=PISTACHIO_SOFT if i == 0 else SURFACE, outline=MOSS if i == 0 else LINE, width=3)
        d.text((x + 28, 1122), label, font=font(27, True), fill=MUTED)
        d.text((x + 28, 1172), value, font=font(43, True), fill=INK)
        d.text((x + 28, 1228), detail, font=font(23), fill=MUTED)
        d.rounded_rectangle((x + 28, 1301, x + 222, 1317), radius=8, fill=LINE)
        d.rounded_rectangle((x + 28, 1301, x + 28 + int(194 * progress), 1317), radius=8, fill=MOSS)

    d.rounded_rectangle((66, 1415, 892, 1808), radius=34, fill=PISTACHIO_SOFT, outline=PISTACHIO, width=3)
    small_label(d, (108, 1465), "DEIN NÄCHSTER ZUG" if de else "YOUR NEXT MOVE")
    d.text((108, 1512), "Nächste Mahlzeit" if de else "Next meal", font=font(43, True), fill=INK)
    small_label(d, (108, 1612), "ZIEL" if de else "TARGET")
    d.text((108, 1653), "500–600 kcal", font=font(36, True), fill=INK)
    small_label(d, (515, 1612), "PROTEIN")
    d.text((515, 1653), "25–35 g", font=font(36, True), fill=INK)


def draw_scan(screen: Image.Image, locale: str, meal_photo: Image.Image) -> None:
    d = ImageDraw.Draw(screen)
    de = locale == "de-DE"
    place_rounded(screen, meal_photo, (52, 52, 906, 570), 48)
    d.rounded_rectangle((74, 468, 340, 536), radius=34, fill=PISTACHIO_SOFT)
    d.ellipse((98, 489, 116, 507), fill=MOSS)
    d.text((132, 500), "Hohe Sicherheit" if de else "High confidence", font=font(24, True), fill=MOSS, anchor="lm")

    d.text((52, 636), "Hähnchen-Reis-Bowl" if de else "Chicken rice bowl", font=fit_font(d, "Hähnchen-Reis-Bowl" if de else "Chicken rice bowl", 854, 52, True), fill=INK)
    d.text((52, 720), "~632 kcal", font=font(78, True), fill=INK)
    d.text((52, 812), "Schätzung · vor dem Speichern prüfen" if de else "Estimate · review before saving", font=font(27), fill=MUTED)

    macros = [("Protein", "49 g"), ("Kohlenh." if de else "Carbs", "67 g"), ("Fett" if de else "Fat", "17 g")]
    for i, (label, value) in enumerate(macros):
        x = 52 + i * 290
        d.rounded_rectangle((x, 880, x + 270, 1055), radius=27, fill=SURFACE, outline=LINE, width=2)
        d.text((x + 26, 918), label, font=font(24, True), fill=MUTED)
        d.text((x + 26, 965), value, font=font(38, True), fill=INK)

    d.text((52, 1118), "Zutaten" if de else "Ingredients", font=font(38, True), fill=INK)
    d.text((848, 1122), "Bearbeiten" if de else "Edit", font=font(25, True), fill=MOSS, anchor="ra")
    rows = [
        ("Hähnchenbrust" if de else "Chicken breast", "180 g", "297 kcal"),
        ("Gekochter Reis" if de else "Cooked rice", "210 g", "271 kcal"),
        ("Brokkoli & Paprika" if de else "Broccoli & peppers", "145 g", "47 kcal"),
        ("Sauce" if de else "Sauce", "18 g", "17 kcal"),
    ]
    for i, (name, grams, kcal) in enumerate(rows):
        y = 1184 + i * 139
        d.rounded_rectangle((52, y, 906, y + 114), radius=24, fill=SURFACE, outline=LINE, width=2)
        d.text((78, y + 28), name, font=font(27, True), fill=INK)
        d.text((78, y + 67), f"{grams} · {kcal}", font=font(22), fill=MUTED)
        d.ellipse((840, y + 40, 872, y + 72), fill=PISTACHIO)
        d.line((848, y + 56, 854, y + 63), fill=MOSS, width=3)
        d.line((854, y + 63, 865, y + 49), fill=MOSS, width=3)

    d.rounded_rectangle((52, 1768, 906, 1908), radius=28, fill=ATTENTION_SOFT)
    d.text((82, 1802), "Öl oder Sauce können verdeckt sein." if de else "Oil or sauce may be hidden.", font=font(27, True), fill=INK)
    d.text((82, 1845), "Du behältst vor dem Speichern die Kontrolle." if de else "You stay in control before saving.", font=font(22), fill=MUTED)


def draw_plan(screen: Image.Image, locale: str) -> None:
    d = ImageDraw.Draw(screen)
    de = locale == "de-DE"
    d.text((52, 72), "Was passt jetzt?" if de else "What fits right now?", font=font(38, True), fill=MUTED)
    d.rounded_rectangle((52, 162, 906, 426), radius=38, fill=PISTACHIO_SOFT, outline=PISTACHIO, width=3)
    small_label(d, (88, 203), "NACH HEUTIGEN MAHLZEITEN" if de else "AFTER TODAY'S MEALS")
    d.text((88, 269), "1.040", font=font(66, True), fill=INK)
    d.text((288, 299), "kcal übrig" if de else "kcal left", font=font(27, True), fill=MUTED, anchor="lm")
    d.text((597, 269), "45 g", font=font(66, True), fill=INK)
    d.text((597, 346), "Protein", font=font(26, True), fill=MUTED)
    d.text((52, 492), "3 Optionen für heute" if de else "3 options for today", font=font(40, True), fill=INK)
    d.text((52, 548), "Ziel · 500–600 kcal · 40–50 g Protein" if de else "Target · 500–600 kcal · 40–50 g protein", font=font(25), fill=MUTED)

    meals = [
        ("01", "Rind-Reis-Pfanne" if de else "Beef rice stir-fry", "20 Min." if de else "20 min", "~550", "~45 g", "~59 g", True),
        ("02", "Hähnchen-Couscous" if de else "Chicken couscous pan", "23 Min." if de else "23 min", "~538", "~43 g", "~60 g", False),
        ("03", "Puten-Reis-Paprika" if de else "Turkey rice peppers", "35 Min." if de else "35 min", "~526", "~46 g", "~55 g", False),
    ]
    for i, (num, name, time, kcal, protein, carbs, selected) in enumerate(meals):
        y = 616 + i * 430
        d.rounded_rectangle((52, y, 906, y + 392), radius=32, fill=SURFACE, outline=MOSS if selected else LINE, width=3)
        d.rounded_rectangle((82, y + 48, 148, y + 114), radius=20, fill=PISTACHIO if selected else CANVAS)
        d.text((115, y + 81), num, font=font(22, True), fill=INK, anchor="mm")
        d.text((174, y + 44), name, font=fit_font(d, name, 545, 32, True, 26), fill=INK)
        d.text((865, y + 50), time, font=font(22, True), fill=MUTED, anchor="ra")
        d.text((174, y + 94), "Proteinreich · in deinen Tag passend" if de else "High protein · matched to your day", font=font(22), fill=MUTED)
        for j, (value, label) in enumerate([(kcal, "kcal"), (protein, "Protein"), (carbs, "Kohlenh." if de else "Carbs")]):
            mx = 84 + j * 250
            d.text((mx, y + 164), value, font=font(38, True), fill=INK)
            d.text((mx, y + 212), label, font=font(21), fill=MUTED)
        if selected:
            d.rounded_rectangle((82, y + 276, 876, y + 352), radius=38, fill=PISTACHIO)
            d.text((479, y + 314), "Das esse ich" if de else "I'll have this", font=font(28, True), fill=INK, anchor="mm")


def draw_log(screen: Image.Image, locale: str) -> None:
    d = ImageDraw.Draw(screen)
    de = locale == "de-DE"
    d.text((52, 72), "Essen erfassen" if de else "Log food", font=font(40, True), fill=INK)
    modes = ["FOTO" if de else "PHOTO", "BARCODE", "SUCHE" if de else "SEARCH", "TEXT"]
    for i, label in enumerate(modes):
        x = 52 + i * 214
        active = i == 2
        d.rounded_rectangle((x, 150, x + 194, 230), radius=40, fill=PISTACHIO if active else SURFACE, outline=MOSS if active else LINE, width=2)
        d.text((x + 97, 190), label, font=font(20, True), fill=INK if active else MUTED, anchor="mm")
    d.rounded_rectangle((52, 286, 906, 392), radius=30, fill=SURFACE, outline=LINE, width=3)
    d.text((88, 339), "Banane" if de else "banana", font=font(29), fill=INK, anchor="lm")
    d.ellipse((842, 318, 868, 344), outline=MUTED, width=3)
    d.line((862, 339, 880, 357), fill=MUTED, width=3)

    results = [
        ("Banane, roh" if de else "Bananas, raw", "89 kcal pro 100 g · 1 g Protein" if de else "89 kcal per 100 g · 1 g protein"),
        ("Banane, überreif" if de else "Banana, overripe", "85 kcal pro 100 g · 1 g Protein" if de else "85 kcal per 100 g · 1 g protein"),
    ]
    d.rounded_rectangle((52, 430, 906, 680), radius=30, fill=SURFACE, outline=LINE, width=2)
    for i, (name, meta) in enumerate(results):
        y = 468 + i * 104
        d.text((82, y), name, font=font(27, True), fill=INK if i == 0 else MUTED)
        d.text((82, y + 40), meta, font=font(21), fill=MUTED)
        if i == 0:
            d.line((82, y + 91, 876, y + 91), fill=LINE, width=2)

    d.rounded_rectangle((52, 742, 906, 1906), radius=42, fill=SURFACE, outline=MOSS, width=3)
    d.rounded_rectangle((390, 774, 568, 786), radius=6, fill=LINE)
    d.text((82, 832), "Banane, roh" if de else "Banana, raw", font=font(43, True), fill=INK)
    d.text((82, 889), "USDA FDC 173944", font=font(22), fill=MUTED)
    d.rounded_rectangle((82, 978, 362, 1140), radius=30, fill=CANVAS, outline=LINE, width=2)
    d.text((222, 1058), "2", font=font(68, True), fill=INK, anchor="mm")
    d.text((402, 1058), "× 1 Banane" if de else "× 1 banana", font=font(36, True), fill=INK, anchor="lm")
    for i, value in enumerate(["0,5" if de else "0.5", "1", "1,5" if de else "1.5", "2", "3"]):
        x = 82 + i * 154
        active = value == "2"
        d.rounded_rectangle((x, 1187, x + 130, 1262), radius=36, fill=PISTACHIO if active else SURFACE, outline=PISTACHIO if active else LINE, width=2)
        d.text((x + 65, 1224), value, font=font(24, True), fill=INK if active else MUTED, anchor="mm")
    portions = [
        ("1 Banane" if de else "1 banana", "126 g"),
        ("1 Scheibe" if de else "1 slice", "6 g"),
        ("Gramm" if de else "Grams", "g"),
    ]
    for i, (label, detail) in enumerate(portions):
        x = 82 + i * 270
        d.rounded_rectangle((x, 1310, x + 244, 1434), radius=27, fill=PISTACHIO_SOFT if i == 0 else SURFACE, outline=MOSS if i == 0 else LINE, width=2)
        d.text((x + 24, 1338), label, font=font(24, True), fill=INK)
        d.text((x + 24, 1380), detail, font=font(22), fill=MUTED)
    d.rounded_rectangle((82, 1488, 876, 1648), radius=30, fill=CANVAS)
    # Match the displayed reference: 89 kcal/100 g, two portions of 126 g.
    banana_kcal = round(89 * 252 / 100)
    d.text((112, 1524), f"~{banana_kcal} kcal", font=font(48, True), fill=INK)
    d.text((112, 1590), "3 g P · 58 g KH · 1 g F · 252 g" if de else "3 g P · 58 g C · 1 g F · 252 g", font=font(24), fill=MUTED)
    d.rounded_rectangle((82, 1692, 876, 1792), radius=50, fill=PISTACHIO)
    d.text((479, 1742), "Hinzufügen" if de else "Add", font=font(30, True), fill=INK, anchor="mm")


def draw_recipe(screen: Image.Image, locale: str) -> None:
    d = ImageDraw.Draw(screen)
    de = locale == "de-DE"
    d.text((52, 72), "Rezept" if de else "Recipe", font=font(31, True), fill=MUTED)
    small_label(d, (52, 142), "FÜR 1 PORTION" if de else "FOR 1 SERVING")
    title = "Paprika-Hähnchen mit Quinoa" if de else "Pepper chicken with quinoa"
    title_lines = ["Paprika-Hähnchen", "mit Quinoa"] if de else ["Pepper chicken", "with quinoa"]
    y = 202
    for line in title_lines:
        d.text((52, y), line, font=fit_font(d, line, 854, 50, True), fill=INK)
        y += 58
    d.rounded_rectangle((52, 362, 906, 582), radius=34, fill=SURFACE, outline=LINE, width=2)
    d.text((86, 412), "515", font=font(82, True), fill=INK)
    d.text((275, 471), "kcal", font=font(29, True), fill=MUTED, anchor="lm")
    d.text((86, 520), "45 g Protein · 57 g Kohlenh. · 12 g Fett" if de else "45 g Protein · 57 g Carbs · 12 g Fat", font=font(25), fill=MUTED)
    d.text((52, 650), "Zutaten" if de else "Ingredients", font=font(38, True), fill=INK)
    ingredients = [
        ("Hähnchenbrust" if de else "Chicken breast", "110 g"),
        ("Gekochte Quinoa" if de else "Cooked quinoa", "225 g"),
        ("Paprika" if de else "Bell peppers", "135 g"),
        ("Olivenöl" if de else "Olive oil", "3 g"),
        ("Zitronensaft" if de else "Lemon juice", "10 g"),
    ]
    d.rounded_rectangle((52, 716, 906, 1242), radius=34, fill=SURFACE, outline=LINE, width=2)
    for i, (name, amount) in enumerate(ingredients):
        y = 760 + i * 94
        d.text((82, y), name, font=font(27, True), fill=INK)
        d.text((876, y), amount, font=font(27, True), fill=INK, anchor="ra")
        if i < len(ingredients) - 1:
            d.line((82, y + 58, 876, y + 58), fill=LINE, width=2)
    d.text((52, 1320), "Zubereitung" if de else "Method", font=font(38, True), fill=INK)
    steps = [
        "Quinoa nach Packungsangabe kochen." if de else "Cook the quinoa as the pack says.",
        "Hähnchen würfeln und 6 Minuten im Öl braten." if de else "Dice the chicken and fry it in the oil for 6 minutes.",
        "Paprika zugeben und weitere 4 Minuten braten." if de else "Add the pepper and fry for another 4 minutes.",
    ]
    y = 1396
    for i, step in enumerate(steps, 1):
        d.ellipse((52, y, 102, y + 50), fill=PISTACHIO)
        d.text((77, y + 25), str(i), font=font(22, True), fill=INK, anchor="mm")
        y = draw_wrapped(d, step, (130, y + 5), 750, 27, INK, False, 10) + 30


COPY = {
    "en-US": [
        ("YOUR DAY, WORKED OUT", ["Build muscle.", "Get lean.", "Know what’s next."], "Protein, calories and your next meal — recalculated after every log.", draw_today, MOSS_DARK, SURFACE, "#D6DDCF"),
        ("SNAP. CHECK. MOVE ON.", ["Your meal,", "broken down."], "Review every ingredient and portion before it counts.", draw_scan, "#DCEBBF", INK, MOSS),
        ("IT RE-PLANS. YOU DON’T.", ["Big lunch?", "Dinner adapts."], "Three meals matched to the calories and protein you have left.", draw_plan, CANVAS, INK, MUTED),
        ("LOG IT YOUR WAY", ["Two bananas.", "Not 252 grams."], "Photo, barcode, search or a quick description.", draw_log, "#DDECC0", INK, MOSS),
        ("FROM TARGET TO PLATE", ["Cook what", "actually fits."], "Ingredients, amounts and a simple method — all in one place.", draw_recipe, INK, SURFACE, "#C9CBBF"),
    ],
    "de-DE": [
        ("DEIN TAG, DURCHGERECHNET", ["Muskeln aufbauen.", "Leaner werden.", "Wissen, was passt."], "Protein, Kalorien und die nächste Mahlzeit – nach jedem Essen neu berechnet.", draw_today, MOSS_DARK, SURFACE, "#D6DDCF"),
        ("FOTO. PRÜFEN. WEITER.", ["Deine Mahlzeit,", "klar aufgeteilt."], "Prüfe jede Zutat und Portion, bevor sie zählt.", draw_scan, "#DCEBBF", INK, MOSS),
        ("KANDRO PLANT NEU. DU NICHT.", ["Großes Mittagessen?", "Abendessen passt sich an."], "Drei Mahlzeiten passend zu deinen übrigen Kalorien und deinem Proteinziel.", draw_plan, CANVAS, INK, MUTED),
        ("ERFASSE, WIE DU ISST", ["Zwei Bananen.", "Nicht 252 Gramm."], "Per Foto, Barcode, Suche oder kurzer Beschreibung.", draw_log, "#DDECC0", INK, MOSS),
        ("VOM ZIEL AUF DEN TELLER", ["Koche, was", "wirklich passt."], "Zutaten, Mengen und einfache Zubereitung – alles an einem Ort.", draw_recipe, INK, SURFACE, "#C9CBBF"),
    ],
}


def render(locale: str) -> list[Path]:
    target = OUT / locale
    target.mkdir(parents=True, exist_ok=True)
    meal = Image.open(MEAL_PHOTO).convert("RGB")
    paths: list[Path] = []
    for index, (eyebrow, title, subtitle, renderer, background, foreground, muted) in enumerate(COPY[locale], 1):
        image = Image.new("RGB", (W, H), background)
        header_bottom = draw_header(image, eyebrow, title, subtitle, foreground, muted)
        phone_top = max(860, min(1020, header_bottom + 90))
        screen, inner = phone_shell(image, top=phone_top)
        if renderer is draw_scan:
            renderer(screen, locale, meal)
        else:
            renderer(screen, locale)
        finish_phone(image, screen, inner)
        path = target / f"{index:02d}-{['next','scan','adapt','log','recipe'][index - 1]}.png"
        image.save(path, format="PNG", optimize=True)
        paths.append(path)
    return paths


def contact_sheet(paths: list[Path], locale: str) -> Path:
    thumb_w, thumb_h, gap, pad = 264, 574, 24, 30
    sheet = Image.new("RGB", (pad * 2 + thumb_w * len(paths) + gap * (len(paths) - 1), thumb_h + pad * 2), "#D9D8D2")
    for idx, path in enumerate(paths):
        im = Image.open(path).convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.paste(im, (pad + idx * (thumb_w + gap), pad))
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    out = PREVIEWS / f"{locale}-contact-sheet.jpg"
    sheet.save(out, quality=90, optimize=True)
    return out


def main() -> None:
    if not MEAL_PHOTO.exists():
        raise SystemExit(f"Missing supporting meal image: {MEAL_PHOTO}")
    for locale in COPY:
        generated = render(locale)
        preview = contact_sheet(generated, locale)
        print(f"{locale}: {len(generated)} screenshots -> {generated[0].parent}")
        print(f"preview -> {preview}")


if __name__ == "__main__":
    main()
