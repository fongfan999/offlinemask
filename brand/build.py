"""Assemble the OfflineMask brand kit: sketch sheet, mark files, tiles, favicon,
preview sheet and the path module the app imports.

Geometry comes from make_mark.py; this file only lays things out. Run from the
repository root:

    python3 brand/build.py && sh brand/png.sh

The wordmark on the sheets is live SVG text in the system sans (the UI's own
stack); the shipped mark files contain no text and embed no fonts.
"""

import os

from make_mark import (COBALT, INK, PAPER, GX0, GX1, GY0, GY1, RGX0, RGX1, RGY0, RGY1,
                       build_mark, build_restore, sketches, sketches2)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PAPER_DARK, INK_DARK, COBALT_DARK = "#151713", "#ebeae2", "#93a9ff"
MUTED, MUTED_DARK, LINE = "#595d54", "#a8ab9f", "#d9d6cb"
SANS = "'Inter Display', Inter, -apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace"

M = build_mark(1.0)
R = build_restore(1.0)
EXT = {id(M): (GX0, GX1, GY0, GY1), id(R): (RGX0, RGX1, RGY0, RGY1)}


def mark(x, y, s, ink, accent, m=M, rotate=0.0):
    """Two colours: cobalt band, ink eyes. One colour: the band with the eyes
    cut out, so the background shows through."""
    rot = f" rotate({rotate} 50 50)" if rotate else ""
    if ink == accent:
        body = f'<path d="{m["band"]} {" ".join(m["holes"] + m["eyes"])}" fill-rule="evenodd" fill="{ink}"/>'
    else:
        body = f'<path d="{m["band"]}" fill="{accent}"/>' + "".join(f'<path d="{d}" fill="{ink}"/>' for d in m["holes"] + m["eyes"])
    return f'<g transform="translate({x:.2f} {y:.2f}) scale({s / 100:.4f}){rot}">{body}</g>'


def svg(w, h, body, label="OfflineMask", title=None):
    t = f"<title>{title}</title>\n" if title else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'role="img" aria-label="{label}">\n{t}{body}\n</svg>\n')


def write(path, content):
    with open(os.path.join(ROOT, path), "w") as f:
        f.write(content)


def text(x, y, s, size, fill, weight=650, family=SANS, anchor="start", spacing=None, italic=False):
    ls = f' letter-spacing="{spacing}"' if spacing is not None else ""
    st = ' font-style="italic"' if italic else ""
    return (f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" font-weight="{weight}"'
            f' fill="{fill}" text-anchor="{anchor}"{ls}{st}>{s}</text>')


def wordmark_text(x, y, size, ink, accent):
    """Offline in ink, Mask in cobalt, one text run so kerning holds."""
    return (f'<text x="{x}" y="{y}" font-family="{SANS}" font-size="{size}" font-weight="650" '
            f'letter-spacing="{-size * 0.022:.2f}" fill="{ink}">Offline<tspan fill="{accent}">Mask</tspan></text>')


# ---------------------------------------------------------------------------
# 1. Mark files: a 100-box with the glyph centred by its extents.
def mark_file(ink, accent, title, m=M):
    x0, x1, y0, y1 = EXT[id(m)]
    body = f'<g transform="translate({-x0 + (100 - (x1 - x0)) / 2:.2f} {-y0 + (100 - (y1 - y0)) / 2:.2f})">' + mark(0, 0, 100, ink, accent, m=m) + "</g>"
    return svg(100, 100, body, title=title)


write("brand/mark-ink.svg", mark_file(INK, COBALT, "OfflineMask mark — a brush swipe with two eye holes"))
write("brand/mark-paper.svg", mark_file(INK_DARK, COBALT_DARK, "OfflineMask mark on dark"))
write("brand/mark-mono-black.svg", mark_file("#000", "#000", "OfflineMask mark, single colour"))
write("brand/mark-mono-white.svg", mark_file("#fff", "#fff", "OfflineMask mark, single colour"))
write("brand/mark-restore-ink.svg", mark_file(INK, COBALT, "OfflineMask restore mark — the mask's eyes, open", R))
write("brand/mark-restore-paper.svg", mark_file(INK_DARK, COBALT_DARK, "OfflineMask restore mark on dark", R))
write("brand/mark-restore-mono-black.svg", mark_file("#000", "#000", "OfflineMask restore mark, single colour", R))
write("brand/mark-restore-mono-white.svg", mark_file("#fff", "#fff", "OfflineMask restore mark, single colour", R))


# 2. Tiles. The glyph is centred by its extents, not its box.
def tile_body(size, radius_ratio, bg, ink, accent, glyph, x=0, y=0, m=M):
    r = size * radius_ratio
    g = size * glyph
    x0, x1, y0, y1 = EXT[id(m)]
    gx = x + (size - g * (x0 + x1) / 100) / 2
    gy = y + (size - g * (y0 + y1) / 100) / 2
    return f'<rect x="{x}" y="{y}" width="{size}" height="{size}" rx="{r:.1f}" fill="{bg}"/>' + mark(gx, gy, g, ink, accent, m=m)


def app_icon():
    # macOS-style: 824 px squircle centred in 1024 with a 100 px margin, 22% radius.
    body = "<!-- macOS-style tile: 824 px squircle centred with a 100 px margin, 22% corner radius. -->\n"
    body += tile_body(824, 0.22, COBALT, PAPER, PAPER, 0.84, 100, 100)
    return svg(1024, 1024, body, title="OfflineMask app icon — cobalt tile, paper mark")


write("brand/tile-cobalt.svg", app_icon())
write("public/favicon.svg", svg(48, 48, tile_body(48, 0.22, COBALT, PAPER, PAPER, 0.84), title="OfflineMask"))


# 3. Path module for the app (sidebar tile, lock page, pill).
module = (
    "// Generated by brand/build.py from brand/make_mark.py. Do not edit by hand.\n"
    "// The OfflineMask mark in a 0 0 100 100 box: a brush swipe with two eye holes.\n"
    "// Drawn in one colour with fill-rule evenodd, the holes show the background.\n"
    "export const markViewBox = \"0 0 100 100\";\n"
    f"export const markBand =\n  \"{M['band']}\";\n"
    f"export const markEyes = [\n  \"{M['holes'][0]}\",\n  \"{M['holes'][1]}\",\n];\n"
    "// The restore mark: the mask's two eyes, open and calm. Two lids in one path\n"
    "// and two eyes; nothing overlaps, so the same even-odd path fills them all.\n"
    f"export const restoreBand =\n  \"{R['band']}\";\n"
    f"export const restoreEyes = [\n  \"{R['eyes'][0]}\",\n  \"{R['eyes'][1]}\",\n];\n"
)
write("src/components/brand-paths.ts", module)


# ---------------------------------------------------------------------------
# 4. Sketch sheet: the candidates, each at 100 px and at 16/24/32 px, with notes.
def sketch_cell(x, y, fig, name, note, m, ink, accent, muted):
    out = [text(x, y + 14, f"FIG. {fig} / {name}", 11, muted, 500, MONO, spacing=1.2)]
    # big drawing on a faint dot grid
    out.append(f'<rect x="{x}" y="{y + 26}" width="200" height="160" rx="6" fill="none" stroke="{LINE}"/>')
    g = f'<g transform="translate({x + 40} {y + 46}) scale(1.2)">'
    g += "".join(f'<path d="{d}" fill="{ink}"/>' for d in m["ink"])
    g += "".join(f'<path d="{d}" fill="{accent}"/>' for d in m["accent"])
    out.append(g + "</g>")
    # small sizes in cobalt tiles, as they will appear in the sidebar and dock
    sx = x + 214
    for s in (16, 24, 32, 48):
        body = tile_body(s, 0.22, COBALT, PAPER, PAPER, 0.8)
        inner = f'<g transform="translate({sx} {y + 26 + (160 - s) / 2 - 10})">'
        # redraw from the candidate paths rather than the chosen mark
        gl = s * 0.8
        r = s * 0.22
        inner += f'<rect width="{s}" height="{s}" rx="{r:.1f}" fill="{COBALT}"/>'
        inner += f'<g transform="translate({(s - gl) / 2:.2f} {(s - gl) / 2:.2f}) scale({gl / 100:.4f})">'
        if "mono" in m:
            inner += f'<path d="{m["mono"]}" fill-rule="evenodd" fill="{PAPER}"/>'
        else:
            inner += "".join(f'<path d="{d}" fill="{PAPER}"/>' for d in m["ink"] + m["accent"])
        inner += "</g></g>"
        out.append(inner)
        out.append(text(sx + s / 2, y + 26 + (160 - s) / 2 - 10 + s + 14, str(s), 9, muted, 500, MONO, anchor="middle"))
        sx += s + 14
    out.append(text(x, y + 206, note, 12, muted, 400, SANS, italic=True))
    return "\n".join(out)


def sketch_sheet(items, title, footer, dark=False):
    bg, ink, accent, muted = (PAPER_DARK, INK_DARK, COBALT_DARK, MUTED_DARK) if dark else (PAPER, INK, COBALT, MUTED)
    W, H = 1260, 700
    out = [f'<rect width="{W}" height="{H}" fill="{bg}"/>']
    out.append(text(40, 46, title, 11, muted, 500, MONO, spacing=1.4))
    out.append(text(W - 40, 46, "ONE BRUSH, SIX IDEAS", 11, muted, 500, MONO, spacing=1.4, anchor="end"))
    out.append(f'<line x1="40" y1="60" x2="{W - 40}" y2="60" stroke="{LINE}"/>')
    for i, (fig, name, note, m) in enumerate(items):
        col, row = i % 3, i // 3
        out.append(sketch_cell(40 + col * 400, 84 + row * 270, fig, name, note, m, ink, accent, muted))
    out.append(f'<line x1="40" y1="{H - 56}" x2="{W - 40}" y2="{H - 56}" stroke="{LINE}"/>')
    out.append(text(40, H - 30, footer, 12, muted, 400, SANS, italic=True))
    return svg(W, H, "\n".join(out), label="OfflineMask logo sketches")


ROUND1 = "Round 1 kept the alias concept of decision 0053; the owner asked for a brand-new mark. See round 2."
ROUND2 = "Chosen: FIG. 07, the mask. The swipe is the product; the eyes make it a character beside P?!. See docs/decisions/0093."
write("brand/sketches-round-1.svg", sketch_sheet(sketches(), "OFFLINEMASK / LOGO SKETCHES / ROUND 1", ROUND1))
write("brand/sketches.svg", sketch_sheet(sketches2(), "OFFLINEMASK / LOGO SKETCHES / ROUND 2", ROUND2))
write("brand/sketches-dark.svg", sketch_sheet(sketches2(), "OFFLINEMASK / LOGO SKETCHES / ROUND 2", ROUND2, dark=True))


# ---------------------------------------------------------------------------
# 5. Preview sheet: wordmark, lockup, mark, tiles, favicon sizes, on cobalt.
def preview_sheet():
    W = 1100
    rows = []
    y = 0

    def row(h, bg, label, body, label_fill):
        nonlocal y
        rows.append(f'<rect x="0" y="{y}" width="{W}" height="{h}" fill="{bg}"/>')
        rows.append(text(32, y + h / 2 + 4, label, 11, label_fill, 500, MONO, spacing=1.2))
        rows.append(f'<g transform="translate(0 {y})">{body}</g>')
        y += h

    def lockup(ink, accent, tile_ink, tile_accent, bg_tile):
        return tile_body(72, 0.22, bg_tile, tile_ink, tile_accent, 0.84, 240, 32) + wordmark_text(332, 94, 64, ink, accent)

    row(140, PAPER, "WORDMARK", wordmark_text(240, 94, 76, INK, COBALT), MUTED)
    row(140, PAPER_DARK, "WORDMARK · DARK", wordmark_text(240, 94, 76, INK_DARK, COBALT_DARK), MUTED_DARK)
    row(136, PAPER, "LOCKUP", lockup(INK, COBALT, PAPER, PAPER, COBALT), MUTED)
    row(136, PAPER_DARK, "LOCKUP · DARK", lockup(INK_DARK, COBALT_DARK, PAPER_DARK, PAPER_DARK, COBALT_DARK), MUTED_DARK)
    row(170, PAPER, "MARK", mark(240, 30, 110, INK, COBALT) + mark(380, 30, 110, COBALT, COBALT) + mark(520, 30, 110, "#000", "#000"), MUTED)
    row(170, PAPER_DARK, "MARK · DARK", mark(240, 30, 110, INK_DARK, COBALT_DARK) + mark(380, 30, 110, "#fff", "#fff"), MUTED_DARK)
    tiles = (tile_body(120, 0.22, COBALT, PAPER, PAPER, 0.84, 240, 24)
             + tile_body(120, 0.22, PAPER, INK, COBALT, 0.84, 388, 24) + f'<rect x="388.5" y="24.5" width="119" height="119" rx="26" fill="none" stroke="{LINE}"/>'
             + tile_body(120, 0.22, INK, PAPER, COBALT_DARK, 0.84, 536, 24)
             + f'<g transform="rotate(-4 744 84)">{tile_body(120, 0.22, COBALT, PAPER, PAPER, 0.84, 684, 24)}</g>')
    row(168, PAPER, "TILES", tiles, MUTED)
    fav = ""
    x = 240
    for s in (16, 32, 48, 64, 180):
        fav += tile_body(s, 0.22, COBALT, PAPER, PAPER, 0.84, x, 190 - s - 24)
        fav += text(x + s / 2, 190, str(s), 10, MUTED, 500, MONO, anchor="middle")
        x += s + 26
    row(220, PAPER, "FAVICON SIZES", fav, MUTED)
    pair = (mark(240, 36, 100, INK, COBALT) + mark(372, 36, 100, INK, COBALT, m=R)
            + tile_body(72, 0.22, COBALT, PAPER, PAPER, 0.84, 540, 50) + tile_body(72, 0.22, COBALT, PAPER, PAPER, 0.84, 628, 50, m=R)
            + f'<g transform="translate(760 70)">{mark(0, 0, 32, INK, INK)}{mark(44, 0, 32, INK, INK, m=R)}</g>'
            + text(240, 166, "MASK · RESTORE", 10, MUTED, 500, MONO, spacing=1.2))
    row(180, PAPER, "ACTIONS", pair, MUTED)
    row(150, COBALT, "ON COBALT", wordmark_text(240, 96, 76, PAPER, PAPER) + mark(700, 20, 110, PAPER, PAPER), "#c9d3f7")
    return svg(W, y, "\n".join(rows), label="OfflineMask brand preview")


write("brand/preview-sheet.svg", preview_sheet())
print("wrote brand files, public/favicon.svg and src/components/brand-paths.ts")
