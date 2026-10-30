"""Generate the OfflineMask mark as hand-inked brush strokes.

Same brush as the personal P?! mark on wotdafong.dev: a centerline is sampled,
a variable-width profile is offset along the normals, and the outline is
emitted as one filled SVG path. Nothing is traced from a font or a drawing;
every stroke is a short function below, so the mark can be regenerated.

All geometry lives in a 0 0 100 100 box. `sketches()` returns the candidate
marks drawn on the sketch sheet; `build_mark()` returns the chosen one.
"""

import math

COBALT = "#3453b6"
INK = "#262a25"
PAPER = "#f7f5ee"


# ---------------------------------------------------------------------------
# Brush
def _normals(pts):
    n = len(pts)
    out = []
    for i, (x, y) in enumerate(pts):
        if i == 0:
            dx, dy = pts[1][0] - x, pts[1][1] - y
        elif i == n - 1:
            dx, dy = x - pts[i - 1][0], y - pts[i - 1][1]
        else:
            dx, dy = pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1]
        ln = math.hypot(dx, dy) or 1
        out.append((dx / ln, dy / ln, -dy / ln, dx / ln))
    return out


def _cap(p, ux, uy, nx, ny, w, squash=1.0):
    """Semicircle from +normal, through forward, to -normal."""
    return [
        (p[0] + (nx * math.cos(a) + ux * math.sin(a) * squash) * w,
         p[1] + (ny * math.cos(a) + uy * math.sin(a) * squash) * w)
        for a in [math.pi * k / 12 for k in range(13)]
    ]


def brush(pts, width, start="taper", end="round", taper_len=0.1):
    """Offset a centerline into a filled outline.

    width: function t -> half-width. start/end: "taper" (pen touching down or
    lifting), "round" (ink pooling), "flat" (stroke cut, used where strokes fuse).
    """
    n = len(pts)
    nrm = _normals(pts)
    left, right = [], []
    for i, (x, y) in enumerate(pts):
        t = i / (n - 1)
        w = width(t)
        if start == "taper" and t < taper_len:
            w *= 0.25 + 0.75 * (t / taper_len)
        if end == "taper" and t > 1 - taper_len:
            w *= 0.25 + 0.75 * ((1 - t) / taper_len)
        ux, uy, nx, ny = nrm[i]
        left.append((x + nx * w, y + ny * w))
        right.append((x - nx * w, y - ny * w))
    ux, uy, nx, ny = nrm[-1]
    end_cap = _cap(pts[-1], ux, uy, nx, ny, width(1.0)) if end == "round" else []
    ux, uy, nx, ny = nrm[0]
    start_cap = _cap(pts[0], -ux, -uy, -nx, -ny, width(0.0)) if start == "round" else []
    return left + end_cap + right[::-1] + start_cap


def to_path(outline):
    d = "M%.2f %.2f" % outline[0]
    for p in outline[1:]:
        d += " L%.2f %.2f" % p
    return d + " Z"


def wobble(t, amp=0.1):
    """Tiny deterministic hand tremor so edges are not machine-straight."""
    return amp * math.sin(t * 17.0) + amp * 0.6 * math.sin(t * 6.3 + 1.0)


# ---------------------------------------------------------------------------
# Centerlines
def polyline(points, radius=5.0, per=48):
    """Sample a polyline, rounding every interior corner with `radius`."""
    pts = []
    m = len(points)
    for i in range(m - 1):
        (x0, y0), (x1, y1) = points[i], points[i + 1]
        seg = math.hypot(x1 - x0, y1 - y0)
        a = radius / seg if i > 0 else 0.0
        b = 1 - radius / seg if i < m - 2 else 1.0
        for k in range(per):
            t = a + (b - a) * k / (per - 1)
            pts.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
        if i < m - 2:
            (x2, y2) = points[i + 2]
            seg2 = math.hypot(x2 - x1, y2 - y1)
            c = radius / seg2
            p0 = pts[-1]
            p2 = (x1 + (x2 - x1) * c, y1 + (y2 - y1) * c)
            for k in range(1, 13):
                u = k / 12
                mu = 1 - u
                pts.append((mu * mu * p0[0] + 2 * mu * u * x1 + u * u * p2[0],
                            mu * mu * p0[1] + 2 * mu * u * y1 + u * u * p2[1]))
    return pts


def line(p0, p1, n=70, lean=0.0, bow=0.0):
    """Straight-ish stroke. `lean` drifts the end sideways, `bow` bends the middle."""
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy) or 1
    nx, ny = -dy / ln, dx / ln
    pts = []
    for i in range(n):
        t = i / (n - 1)
        s = bow * math.sin(math.pi * t) + lean * (t - 0.5) + 0.25 * math.sin(t * 5.0)
        pts.append((x0 + dx * t + nx * s, y0 + dy * t + ny * s))
    return pts


def arc(cx, cy, r, a0, a1, n=120, egg=0.05):
    pts = []
    for i in range(n):
        t = i / (n - 1)
        a = math.radians(a0 + (a1 - a0) * t)
        rr = r * (1 + egg * math.sin(a - math.radians(30)))
        pts.append((cx + rr * math.cos(a), cy - rr * math.sin(a)))
    return pts


def rotate(d_or_pts, deg, cx=50.0, cy=50.0):
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    return [((x - cx) * ca - (y - cy) * sa + cx, (x - cx) * sa + (y - cy) * ca + cy) for x, y in d_or_pts]


def dot(cx, cy, r):
    pts = []
    for k in range(40):
        a = 2 * math.pi * k / 40
        rr = r * (1 + 0.05 * math.sin(3 * a + 0.6) + 0.03 * math.cos(5 * a))
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return to_path(pts)


# ---------------------------------------------------------------------------
# Shared strokes
def dash(x0=35.0, x1=65.0, y=50.0, weight=1.0, tilt=-4.0):
    """The cobalt dash: the hidden value. A brush swipe, heavy where the pen
    lands on the left, easing off to the right; tilted -4 deg like the brand's
    sticker."""
    pts = rotate(line((x0, y), (x1, y), n=60, bow=0.35), tilt, (x0 + x1) / 2, y)
    w = lambda t: (5.1 - 1.2 * t ** 1.3 + wobble(t, 0.05)) * weight
    return to_path(brush(pts, w, start="round", end="round"))


def bracket(side="left", weight=1.0, tip_x=39.5, spine_x=23.0, top=14.0, bottom=86.0):
    """One bracket in a single stroke: tip in, down the spine, tip out.
    Thin where the pen enters and leaves, heavy down the spine."""
    pts = polyline([(tip_x, top), (spine_x, top), (spine_x, bottom), (tip_x, bottom)], radius=4.5)
    if side == "right":
        pts = [(100 - x, y) for x, y in pts]

    def w(t):
        # arms: 2.6 -> corners: 4.3 -> spine swells to 5.2 at mid-height
        if t < 0.2:
            v = 2.6 + 1.7 * (t / 0.2) ** 0.8
        elif t < 0.8:
            u = (t - 0.2) / 0.6
            v = 4.3 + 0.9 * math.sin(math.pi * u) ** 0.9
        else:
            v = 2.6 + 1.7 * ((1 - t) / 0.2) ** 0.8
        return (v + wobble(t, 0.09)) * weight

    return to_path(brush(pts, w, start="round", end="round"))


# ---------------------------------------------------------------------------
# Sketch candidates (FIG. 01 .. 06). Each returns {"ink": [paths], "accent": [paths]}.
def sketch_alias(weight=1.0):
    """[—]  Two brush brackets around a cobalt dash: an alias token with the
    value hidden. The accepted concept (decision 0053), redrawn with the brush."""
    return {"ink": [bracket("left", weight), bracket("right", weight)],
            "accent": [dash(38.5, 61.5, 50.5, weight)]}


def sketch_struck(weight=1.0):
    """A line of handwriting with the middle swiped out in cobalt."""
    pts = [(18 + 64 * i / 119, 51 + 6.5 * math.sin(i / 119 * math.pi * 5.0) + 0.6 * math.sin(i * 0.4)) for i in range(120)]
    w = lambda t: (2.4 + 0.5 * math.sin(math.pi * t) + wobble(t, 0.1)) * weight
    bar = rotate(line((31, 50), (69, 50), n=60, bow=0.4), -4, 50, 50)
    wb = lambda t: (7.2 - 1.0 * t + wobble(t, 0.1)) * weight
    return {"ink": [to_path(brush(pts, w, "taper", "taper"))],
            "accent": [to_path(brush(bar, wb, "round", "round"))]}


def sketch_bubble(weight=1.0):
    """A speech bubble (what you send to the AI) with the value swiped inside."""
    pts = polyline([(23, 90), (30, 70), (70, 70), (82, 70), (82, 22), (18, 22), (18, 70), (26, 70)], radius=7)
    w = lambda t: (3.0 + 1.0 * math.sin(math.pi * t) + wobble(t)) * weight
    return {"ink": [to_path(brush(pts, w, "taper", "round"))],
            "accent": [dash(35, 65, 46, weight)]}


def sketch_ring(weight=1.0):
    """An open ink loop (nothing leaves the machine) around the cobalt dash."""
    pts = arc(50, 50, 34, 112, -246, n=150, egg=0.04)
    w = lambda t: (2.6 + 2.4 * math.sin(math.pi * t * 0.9) ** 0.8 + wobble(t)) * weight
    return {"ink": [to_path(brush(pts, w, "taper", "round"))],
            "accent": [dash(36, 64, 50.5, weight)]}


def sketch_eye(weight=1.0):
    """A closed eye: the lid is one brush arc, the cobalt dash is the line it no
    longer sees."""
    lid = arc(50, 30, 33, 196, 344, n=120, egg=0.0)
    w = lambda t: (2.4 + 2.6 * math.sin(math.pi * t) ** 0.9 + wobble(t)) * weight
    lashes = []
    for x, a in ((26, 24), (50, 0), (74, -24)):
        y = 30 + 33 * math.sin(math.radians(90 - a)) * 0.98
        d = math.radians(90 - a)
        lx, ly = x + 0 * math.cos(d), y
        pts = line((lx, ly + 2), (lx - 7 * math.sin(math.radians(a)), ly + 11), n=24)
        lashes.append(to_path(brush(pts, lambda t: (2.2 - 1.0 * t) * weight, "flat", "taper")))
    return {"ink": [to_path(brush(lid, w, "taper", "taper"))] + lashes,
            "accent": [dash(36, 64, 80, weight)]}


def sketch_mbar(weight=1.0):
    """A brush M for Mask with its middle hidden by the cobalt bar."""
    pts = polyline([(22, 86), (22, 18), (50, 60), (78, 18), (78, 86)], radius=3.5)
    w = lambda t: (3.4 + 1.6 * math.sin(math.pi * t * 2) ** 2 + wobble(t)) * weight
    bar = rotate(line((28, 52), (72, 52), n=60, bow=0.4), -4, 50, 52)
    wb = lambda t: (6.4 - 0.8 * t + wobble(t, 0.1)) * weight
    return {"ink": [to_path(brush(pts, w, "taper", "taper"))],
            "accent": [to_path(brush(bar, wb, "round", "round"))]}


SKETCHES = [
    ("01", "ALIAS", "[—] two brush brackets, the value swiped out", sketch_alias),
    ("02", "STRUCK", "handwriting with the middle swiped out", sketch_struck),
    ("03", "BUBBLE", "what you send to the AI, with the value hidden", sketch_bubble),
    ("04", "RING", "an open loop: nothing leaves the machine", sketch_ring),
    ("05", "CLOSED EYE", "the lid is one stroke; the dash is what it no longer sees", sketch_eye),
    ("06", "M-BAR", "a brush M for Mask, its middle hidden", sketch_mbar),
]


def sketches(weight=1.0):
    return [(fig, name, note, fn(weight)) for fig, name, note, fn in SKETCHES]


# ---------------------------------------------------------------------------
# Round 2: brand-new ideas, nothing kept from the bracket mark.
def band(x0=14.0, x1=86.0, y=64.0, weight=1.0, tilt=-4.0, half=8.0):
    """A wide cobalt swipe: the mask itself."""
    pts = rotate(line((x0, y), (x1, y), n=70, bow=0.4), tilt, (x0 + x1) / 2, y)
    w = lambda t: (half - 0.12 * half * t ** 1.3 + wobble(t, 0.05)) * weight
    return to_path(brush(pts, w, start="round", end="round"))


def sketch_ninja(weight=1.0):
    """Two ink eyes above a cobalt band: a face with everything but the eyes
    covered. What matters stays readable; what identifies is covered."""
    return {"ink": [dot(36, 40, 5.2 * weight), dot(64, 39, 5.0 * weight)],
            "accent": [band(16, 84, 62, weight)]}


def sketch_hood(weight=1.0):
    """The same face with a brush hood over it."""
    hood = arc(50, 50, 36, 168, 12, n=120, egg=0.03)
    w = lambda t: (2.8 + 2.4 * math.sin(math.pi * t) ** 0.9 + wobble(t)) * weight
    return {"ink": [to_path(brush(hood, w, "taper", "taper")), dot(37, 46, 4.6 * weight), dot(63, 45, 4.4 * weight)],
            "accent": [band(20, 80, 66, weight, half=7.0)]}


def sketch_anon(weight=1.0):
    """A head drawn in one loop, a cobalt bar across the eyes: identity withheld."""
    head = arc(50, 44, 30, 118, -230, n=150, egg=0.04)
    w = lambda t: (2.6 + 2.2 * math.sin(math.pi * t * 0.9) ** 0.8 + wobble(t)) * weight
    return {"ink": [to_path(brush(head, w, "taper", "round"))],
            "accent": [band(14, 86, 42, weight, half=6.5)]}


def sketch_at(weight=1.0):
    """An @ whose inner a is swiped out: your identity, hidden before it is sent."""
    pts = []
    n = 150
    for i in range(n):
        t = i / (n - 1)
        a = math.radians(-20 + 330 * t)  # from lower right, counter-clockwise over the top
        r = 33 + 2.5 * t
        pts.append((49 + r * math.cos(a), 50 - r * math.sin(a)))
    # the tail flicks out at the bottom right
    tail = line(pts[-1], (pts[-1][0] + 9, pts[-1][1] + 9), n=16)
    pts = pts + tail[1:]
    w = lambda t: (2.6 + 2.4 * math.sin(math.pi * t) ** 0.8 + wobble(t)) * weight
    return {"ink": [to_path(brush(pts, w, "taper", "taper"))],
            "accent": [dash(36, 62, 51, weight)]}


def sketch_slashed_o(weight=1.0):
    """An O for Offline with a cobalt swipe through it: nothing gets out."""
    ring = arc(50, 50, 33, 100, -256, n=150, egg=0.04)
    w = lambda t: (3.0 + 2.4 * math.sin(math.pi * t * 0.9) ** 0.8 + wobble(t)) * weight
    pts = line((30, 76), (70, 24), n=60, bow=0.3)
    ws = lambda t: (5.4 - 1.2 * t ** 1.3 + wobble(t, 0.05)) * weight
    return {"ink": [to_path(brush(ring, w, "taper", "round"))],
            "accent": [to_path(brush(pts, ws, "round", "round"))]}


def sketch_quote(weight=1.0):
    """Quotation marks around a cobalt dash: what you paste, with the value hidden."""
    def comma(cx, cy, flip=False):
        pts = [(cx + 0.9 * math.sin(math.radians(a)) * 6, cy + (1 - math.cos(math.radians(a))) * 11) for a in range(0, 100, 5)]
        if flip:
            pts = [(2 * cx - x, y) for x, y in pts]
        return to_path(brush(pts, lambda t: (4.6 - 3.2 * t ** 0.8) * weight, "round", "taper"))
    return {"ink": [comma(20, 30), comma(30, 30), comma(80, 30, True), comma(70, 30, True)],
            "accent": [dash(36, 64, 60, weight)]}


SKETCHES2 = [
    ("07", "NINJA", "two eyes above a cobalt band: everything that identifies is covered", sketch_ninja),
    ("08", "HOOD", "the same face with a brush hood", sketch_hood),
    ("09", "ANON", "a head in one loop, a bar across the eyes", sketch_anon),
    ("10", "AT", "an @ with its inner a swiped out", sketch_at),
    ("11", "SLASHED O", "an O for Offline, swiped through: nothing gets out", sketch_slashed_o),
    ("12", "QUOTE", "quotation marks around the hidden value", sketch_quote),
]


def sketches2(weight=1.0):
    return [(fig, name, note, fn(weight)) for fig, name, note, fn in SKETCHES2]


# ---------------------------------------------------------------------------
# The mark: FIG. 07, the mask. A wide cobalt swipe, the thing that hides, with
# two eye holes: whoever is behind it still sees, and what matters stays
# readable. On paper the eyes are ink; on a tile or in single colour the holes
# show the background (even-odd fill).
def swipe(x0=8.0, x1=92.0, y=50.0, half=16.0, tilt=-4.0, bow=0.4, weight=1.0):
    pts = rotate(line((x0, y), (x1, y), n=80, bow=bow), tilt, (x0 + x1) / 2, y)
    w = lambda t: (half - 0.1 * half * t ** 1.4 + wobble(t, 0.06)) * weight
    return to_path(brush(pts, w, start="round", end="round"))


EYES = ((33.0, 50.0, 6.6), (67.0, 48.0, 6.4))

# Glyph extents in the 100-box (weight 1.0).
GX0, GX1, GY0, GY1 = 6.0, 94.0, 30.0, 70.0


def build_mark(weight=1.0):
    """Return {"band", "holes", "eyes"} for the chosen mark: both eyes are holes."""
    return {"band": swipe(weight=weight), "holes": [dot(x, y, r * weight) for x, y, r in EYES], "cuts": [], "strokes": []}


# The restore mark: the mask, off. The same swipe and eyes with a brush slash
# through it, the way an eye-off or mute icon is drawn: "mask off" is unmask.
# "cuts" are always knocked out of the band (the gap around the slash), "holes"
# are the eyes (ink dots on paper, holes in single colour), "strokes" are ink
# only in two-colour use; in single colour the gap alone carries the slash.
RGX0, RGX1, RGY0, RGY1 = 6.0, 94.0, 20.0, 80.0


def _slash(w0, w1, weight=1.0):
    pts = line((30, 79), (70, 21), n=50, bow=0.3)
    return to_path(brush(pts, lambda t: (w0 + (w1 - w0) * t + wobble(t, 0.05)) * weight, start="round", end="round"))


def build_restore(weight=1.0):
    """Return {"band", "holes", "cuts", "strokes"} for the mask with a slash."""
    m = build_mark(weight)
    return {"band": m["band"], "holes": m["holes"],
            "cuts": [_slash(7.4, 6.8, weight)], "strokes": [_slash(4.0, 3.4, weight)]}


def sketch_mask(weight=1.0):
    m = build_mark(weight)
    return {"ink": m["holes"], "accent": [m["band"]], "mono": m["band"] + " " + " ".join(m["holes"])}


SKETCHES2.insert(0, ("07", "MASK", "the swipe that hides, with two eye holes: what matters stays readable", sketch_mask))
SKETCHES2[1] = ("08", "NINJA", "two eyes above a cobalt band", sketch_ninja)
del SKETCHES2[2]  # the hood was a variant of 08, not an idea of its own


# ---------------------------------------------------------------------------
# The mascot: the mark given a head. The logo is a ninja's mask, so the mascot
# is the ninja who wears it: the same cobalt swipe and eye dots, tied around a
# round head, with the knot's two tails flying behind. Every candidate returns
# {"head", "band", "eyes", "tails"} in a 0 0 100 100 box: "head" is ink (paper
# in dark), "band" and "tails" cobalt, "eyes" ink on the band.
def blob(cx, cy, rx, ry, squash=0.0, n=60):
    """A hand-drawn closed shape: an ellipse with a little tremor, flattened at
    the bottom by `squash` (a bean sits; a ball rolls)."""
    pts = []
    for k in range(n):
        a = 2 * math.pi * k / n
        rr = 1 + 0.025 * math.sin(3 * a + 0.6) + 0.015 * math.cos(5 * a)
        y = math.sin(a)
        if y > 0:
            y *= 1 - squash * y ** 2
        pts.append((cx + rx * rr * math.cos(a), cy + ry * rr * y))
    return to_path(pts)


def tail(x0, y0, x1, y1, bow, half, weight=1.0):
    pts = line((x0, y0), (x1, y1), n=40, bow=bow)
    return to_path(brush(pts, lambda t: (half * (1 - 0.55 * t) + wobble(t, 0.04)) * weight, "round", "taper", 0.2))


def mascot_ball(weight=1.0):
    """A round head; the mask is tied on, the knot's tails fly behind."""
    return {"head": blob(44, 54, 33, 33),
            "band": swipe(15, 74, 50, half=9.0, weight=weight),
            "eyes": [dot(33, 50.5, 4.6 * weight), dot(53, 49, 4.4 * weight)],
            "tails": [tail(72, 47, 98, 30, -3.5, 4.4, weight), tail(72, 51, 96, 64, 3.0, 3.8, weight)]}


def mascot_bean(weight=1.0):
    """A taller head-and-body bean that sits, so it can stand on a line of text."""
    return {"head": blob(44, 56, 30, 38, squash=0.25),
            "band": swipe(17, 71, 42, half=8.6, weight=weight),
            "eyes": [dot(34, 42.5, 4.4 * weight), dot(53, 41, 4.2 * weight)],
            "tails": [tail(69, 39, 97, 22, -3.5, 4.2, weight), tail(69, 43, 95, 56, 3.0, 3.6, weight)]}


def mascot_wide(weight=1.0):
    """The logo itself, wider than the head: the mask is the face, the head
    peeks out above and below it."""
    return {"head": blob(46, 52, 28, 30),
            "band": swipe(12, 80, 50, half=12.0, weight=weight),
            "eyes": [dot(33, 50.5, 5.4 * weight), dot(58, 48.6, 5.2 * weight)],
            "tails": [tail(78, 46, 98, 30, -3.0, 4.4, weight), tail(78, 52, 97, 66, 2.6, 3.8, weight)]}


MASCOTS = [
    ("M1", "BALL", "a round head, the mask tied on, its tails flying", mascot_ball),
    ("M2", "BEAN", "a head-and-body bean that can sit on a line of text", mascot_bean),
    ("M3", "WIDE", "the logo as the face, the head peeking out around it", mascot_wide),
]


def build_mascot(weight=1.0):
    """The chosen mascot: M2, the bean. It sits on a line of text, which the
    website's slice animation needs, and its band is the mark's own swipe."""
    return mascot_bean(weight)


if __name__ == "__main__":
    for k, v in build_mark().items():
        print(k, str(v)[:80], "...")
