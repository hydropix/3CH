"""3CH logo: a die-head mascot on a hot pink paint splat, with a neon glow.

Everything is drawn as flat shapes into a "pink" mask at 4x supersampling, then
downscaled; the glow is a blurred copy of that mask. Only two colours: black and
PINK (the glow is PINK at lower intensity).

Needs Python 3 with numpy and Pillow, the Windows fonts Impact and Ink Free, and
ffmpeg on PATH for the GIF.

Usage (from app/):
    python scripts/make-logo.py        -> build/icon.png, build/icon.ico, renderer/logo.png
    python scripts/make-logo.py gif    -> also ../docs/logo.gif (README header)
"""
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

PINK = (255, 46, 122)          # #FF2E7A
APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(os.path.dirname(APP), 'docs')
FONTS = 'C:/Windows/Fonts/'
SS = 4                          # supersampling factor


# --------------------------------------------------------------------------
# Drawing helper: a "pen" working in abstract units with its own frame
# (translation + rotation), drawing on an L-mode mask (255 = pink, 0 = black).
# --------------------------------------------------------------------------
class Pen:
    def __init__(self, img, s, tx=0.0, ty=0.0, ang=0.0):
        self.img = img
        self.d = ImageDraw.Draw(img)
        self.s = s                  # px per unit
        self.tx, self.ty = tx, ty   # origin in px
        self.ang = ang              # radians

    def P(self, x, y):
        c, s = math.cos(self.ang), math.sin(self.ang)
        return (self.tx + self.s * (x * c - y * s), self.ty + self.s * (x * s + y * c))

    def sub(self, x, y, ang_deg=0.0):
        X, Y = self.P(x, y)
        return Pen(self.img, self.s, X, Y, self.ang + math.radians(ang_deg))

    def poly(self, pts, fill=255):
        self.d.polygon([self.P(x, y) for x, y in pts], fill=fill)

    def circle(self, x, y, r, fill=255):
        X, Y = self.P(x, y)
        R = r * self.s
        self.d.ellipse([X - R, Y - R, X + R, Y + R], fill=fill)

    def ellipse(self, x, y, rx, ry, rot=0.0, fill=255, n=64):
        a = math.radians(rot)
        pts = []
        for i in range(n):
            t = 2 * math.pi * i / n
            ex, ey = rx * math.cos(t), ry * math.sin(t)
            pts.append((x + ex * math.cos(a) - ey * math.sin(a), y + ex * math.sin(a) + ey * math.cos(a)))
        self.poly(pts, fill)

    def line(self, pts, w, fill=255):
        """Polyline with round caps and joins."""
        W = max(1, int(round(w * self.s)))
        for a, b in zip(pts, pts[1:]):
            self.d.line([self.P(*a), self.P(*b)], fill=fill, width=W)
        for p in pts:
            self.circle(p[0], p[1], w / 2, fill)

    def text(self, txt, x, y, size, font, fill=255, rot=0.0, anchor='mm', skew=0.0):
        """Text centred on (x, y), rotated with the frame plus `rot` degrees."""
        f = ImageFont.truetype(FONTS + font, max(4, int(size * self.s)))
        bb = f.getbbox(txt, anchor='lt')
        w, h = bb[2] + 8, bb[3] + 8
        pad = int(max(w, h) * 0.6)
        layer = Image.new('L', (w + 2 * pad, h + 2 * pad), 0)
        ImageDraw.Draw(layer).text((pad + 4, pad + 4), txt, font=f, fill=255, anchor='lt')
        if skew:
            layer = layer.transform(layer.size, Image.AFFINE, (1, skew, -skew * layer.size[1] / 2, 0, 1, 0),
                                    resample=Image.BICUBIC)
        total = -(math.degrees(self.ang) + rot)
        layer = layer.rotate(total, resample=Image.BICUBIC, center=(pad + 4 + w / 2 - 4, pad + 4 + h / 2 - 4))
        X, Y = self.P(x, y)
        cx, cy = pad + 4 + (w - 8) / 2, pad + 4 + (h - 8) / 2
        self.img.paste(fill, (int(X - cx), int(Y - cy)), mask=layer)


def rounded_square(half, r, n=16):
    pts = []
    for cx, cy, a0 in ((half - r, half - r, 0), (-half + r, half - r, 90),
                       (-half + r, -half + r, 180), (half - r, -half + r, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def blur_threshold(img, radius, level=128):
    b = img.filter(ImageFilter.GaussianBlur(radius))
    a = np.asarray(b)
    return Image.fromarray(np.where(a >= level, 255, 0).astype(np.uint8))


# --------------------------------------------------------------------------
# The mascot, in a 1000 x 1000 unit box.
# --------------------------------------------------------------------------
CX, CY = 500, 515          # splat centre
HEAD = (500, 490, -9)      # head centre + tilt (degrees)
HALF = 215                 # head half-size

# splash arms: (angle deg, reach, angular width deg, tip radius)
ARMS = [
    (-52, 470, 7, 44),
    (-14, 410, 9, 30),
    (22, 455, 5, 30),
    (48, 395, 10, 26),
    (138, 480, 6, 46),
    (172, 410, 10, 30),
    (205, 455, 5, 26),
    (238, 420, 9, 34),
    (272, 470, 6, 38),
    (300, 400, 9, 24),
]
# separate droplets: (angle deg, distance, rx, ry)
DROPS = [(-36, 480, 16, 13), (4, 462, 10, 9), (35, 486, 14, 12), (65, 450, 9, 8),
         (155, 486, 12, 11), (188, 470, 17, 14), (222, 482, 9, 8), (255, 470, 13, 11),
         (-70, 486, 9, 8), (318, 476, 15, 13)]
# small black holes in the pink: (angle deg, distance, r)
HOLES = [(152, 0.5, 22), (-52, 0.42, 16), (-58, 0.8, 7), (18, 0.55, 10), (240, 0.5, 14), (100, 0.5, 9), (300, 0.62, 8)]
# paint running off the splat's bottom edge: (x, length, width)
RUNS = [(430, 78, 20), (585, 120, 24), (655, 44, 15)]


def base_radius(th):
    r = 322 * (1 + 0.05 * math.sin(2 * th + 0.3) + 0.045 * math.sin(3 * th + 1.1)
               + 0.035 * math.sin(5 * th + 2.3) + 0.02 * math.sin(9 * th + 0.4))
    for a, reach, w, tip in ARMS:
        d = (th - math.radians(a) + math.pi) % (2 * math.pi) - math.pi
        r += (reach - tip - r) * math.exp(-(d / math.radians(w)) ** 2)
    return r


def draw_splat(pen, detail=True, p=None):
    p = p or {}
    tmp = Image.new('L', pen.img.size, 0)
    tp = Pen(tmp, pen.s, pen.tx, pen.ty, pen.ang)
    pts = []
    n = 900
    for i in range(n):
        th = 2 * math.pi * i / n
        r = base_radius(th)
        pts.append((CX + r * math.cos(th), CY + r * math.sin(th)))
    tp.poly(pts)
    for a, reach, w, tip in ARMS:
        t = math.radians(a)
        tp.circle(CX + (reach - tip) * math.cos(t), CY + (reach - tip) * math.sin(t), tip)
    tmp = blur_threshold(tmp, 16 * pen.s)
    pen.img.paste(255, (0, 0), mask=tmp)
    if detail:
        a = np.asarray(tmp)
        for i, (x, L, w) in enumerate(RUNS):
            X = int(pen.P(x, 0)[0])
            ys = np.nonzero(a[:, X] > 128)[0]
            if len(ys) == 0:
                continue
            y0 = (ys.max() - pen.ty) / pen.s - 10
            if i == 1:                  # the long run grows, and in the GIF drops a bead
                L = L * (1 + 0.35 * p.get('run', 0.0))
                if p.get('run_drop') is not None:
                    pen.ellipse(x, y0 + L * 1.35 + w * 0.3 + p['run_drop'], w * 0.62, w * 0.72)
            elif i == 0:
                L = L * (1 + 0.12 * p.get('grow', 0.0))
            drip(pen, x, y0, L, w)
        for a, dist, rx, ry in DROPS:
            t = math.radians(a)
            pen.ellipse(CX + dist * math.cos(t), CY + dist * math.sin(t), rx, ry, rot=a)


def draw_holes(pen, scale=1.0):
    """Black spots in the pink, placed at a fraction f of the ring between head and edge."""
    for a, f, r in HOLES:
        t = math.radians(a)
        c = max(abs(math.cos(t - math.radians(HEAD[2]))), abs(math.sin(t - math.radians(HEAD[2]))))
        hd = HALF / c * 0.93 + 8
        dist = hd + f * (base_radius(t) - hd)
        pen.ellipse(CX + dist * math.cos(t), CY + dist * math.sin(t), r * scale, r * 0.78 * scale,
                    rot=a + 90, fill=0)


def drip(pen, x, y0, length, w, fill=255):
    """A paint drip hanging from (x, y0): flared root, straight run, round bulb."""
    if length <= 0:
        return
    f = min(length * 0.45, 1.6 * w)
    right, left = [], []
    n = 24
    for i in range(n + 1):
        t = -w + (length + w) * i / n
        half = w / 2 * (1 + 0.9 * max(0.0, 1 - max(t, 0) / f) ** 2)
        right.append((x + half, y0 + t))
        left.append((x - half, y0 + t))
    pen.poly(right + left[::-1], fill)
    pen.circle(x, y0 + length, w * 0.62, fill)


def mouth_curves(w, top, dip, curl, n=48):
    upper, lower = [], []
    for i in range(n + 1):
        u = -w + 2 * w * i / n
        k = (u / w) ** 2
        upper.append((u, top - curl * k))
        lower.append((u, top + dip * (1 - k) ** 0.8 - curl * k))
    return upper, lower


def draw_face(head, p):
    bold = p.get('bold', False)
    grow = p.get('grow', 0.0)
    blink = p.get('blink', 0.0)     # 0 = X eyes, 1 = O eyes
    ex, ey = (100, -86) if bold else (94, -86)
    arm = 50 if bold else 50
    sw = 54 if bold else 36
    for sx in (-1, 1):
        x = sx * ex
        if blink < 0.5:
            head.line([(x - arm, ey - arm), (x + arm, ey + arm)], sw)
            head.line([(x - arm, ey + arm), (x + arm, ey - arm)], sw)
        else:
            head.circle(x, ey, arm + sw * 0.3)
            head.circle(x, ey, arm + sw * 0.3 - sw * 0.95, fill=0)
    if not bold:
        # the eyes leak: one drip from the left X's centre, small ones off the leg tips
        drip(head, -ex, ey + 24, 58 + 8 * grow, 13)
        drip(head, ex + 2, ey + 24, 30 + 6 * grow, 11)

    # grin
    if bold:
        w, top, dip, curl = 150, 66, 92, 34
        upper, lower = mouth_curves(w, top, dip, curl)
        head.poly(upper + lower[::-1])
        for u in (-50, 50):
            k = (u / w) ** 2
            head.line([(u, top - curl * k - 6), (u, top - curl * k + 34)], 26, fill=0)
        return
    w, top, dip, curl = 150, 50, 100, 40
    lip = 17
    upper, lower = mouth_curves(w, top, dip, curl)
    head.poly(upper + lower[::-1])
    wi = w - lip * 1.6
    ui, li = mouth_curves(wi, top + lip * 0.75, dip - lip * 1.9, curl * (wi / w) ** 2)
    head.poly(ui + li[::-1], fill=0)
    # a row of blocky teeth hanging from the upper lip, slightly uneven
    n = 7
    gap = 9
    heights = [0.34, 0.5, 0.56, 0.6, 0.54, 0.5, 0.36]
    for i in range(n):
        ua = -wi + 2 * wi * i / n + gap / 2
        ub = -wi + 2 * wi * (i + 1) / n - gap / 2
        pts_top = []
        for j in range(9):
            u = ua + (ub - ua) * j / 8
            k = (u / wi) ** 2
            pts_top.append((u, top + lip * 0.75 - curl * (wi / w) ** 2 * k - 3))
        um = (ua + ub) / 2
        km = (um / wi) ** 2
        inner_h = (dip - lip * 1.9) * (1 - km) ** 0.8
        yb = top + lip * 0.75 - curl * (wi / w) ** 2 * km + inner_h * heights[i]
        head.poly(pts_top + [(ub, yb), (ua, yb)])
    # the big drip, off the lower lip
    drip(head, 46, top + dip * (1 - (46 / w) ** 2) ** 0.8 - curl * (46 / w) ** 2 - 6, 40 + 14 * grow, 15)


def draw_graffiti(head, pen):
    """Thin hand-scrawled pink details on the black head."""
    w = 6.5
    # tally marks on the cheek: four strokes and a slash (speed painting minutes)
    x0, y0 = -192, 122
    for i in range(4):
        x = x0 + i * 15
        head.line([(x, y0 + (i % 2) * 3), (x + 3, y0 + 42)], w)
    head.line([(x0 - 9, y0 + 32), (x0 + 56, y0 + 8)], w)
    # pip (the die is still a die) + a tiny star doodle
    head.circle(166, -174, 19)
    star = []
    for i in range(10):
        a = math.radians(-90 + 36 * i + 8)
        r = 20 if i % 2 == 0 else 8
        star.append((-164 + r * math.cos(a), -172 + r * math.sin(a)))
    for i in range(10):
        head.line([star[i], star[(i + 1) % 10]], 4.5)
    # scrawled tag on the chin
    head.text('3ch!', 138, 176, 40, 'Inkfree.ttf', rot=-6)


def mascot_mask(size_px, p=None, ox=0, oy=0, canvas=None):
    """Draw the pink mask of the mascot in a size_px box at (ox, oy) of canvas."""
    p = p or {}
    detail = not p.get('bold', False)
    img = canvas if canvas is not None else Image.new('L', (size_px, size_px), 0)
    pen = Pen(img, size_px / 1000.0, ox, oy)
    draw_splat(pen, detail, p)
    if detail:
        draw_holes(pen)
    head = pen.sub(HEAD[0], HEAD[1], HEAD[2])
    head.poly(rounded_square(HALF, 72), fill=0)
    draw_face(head, p)
    if detail:
        draw_graffiti(head, pen)
    return img, head


def head_mask(size_px, ox=0, oy=0, canvas_size=None):
    img = Image.new('L', canvas_size or (size_px, size_px), 0)
    pen = Pen(img, size_px / 1000.0, ox, oy)
    pen.sub(HEAD[0], HEAD[1], HEAD[2]).poly(rounded_square(HALF, 72))
    return img


# --------------------------------------------------------------------------
# Compositing: mask -> pink on black with a neon glow.
# --------------------------------------------------------------------------
def neon(mask_ss, out_size, glow=1.0, head_ss=None, calm_full=None, bright=1.0):
    m = mask_ss.resize(out_size, Image.LANCZOS)
    a = np.asarray(m).astype(np.float32) / 255.0
    W = max(out_size)
    g1 = np.asarray(m.filter(ImageFilter.GaussianBlur(W * 0.045))).astype(np.float32) / 255.0
    g2 = np.asarray(m.filter(ImageFilter.GaussianBlur(W * 0.012))).astype(np.float32) / 255.0
    g = (0.55 * g1 + 0.35 * g2) * glow
    if head_ss is not None:
        h = np.asarray(head_ss.resize(out_size, Image.LANCZOS)).astype(np.float32) / 255.0
        g = g * (1 - 0.6 * h) if calm_full is None else g * (1 - h)
    inten = np.clip(a * bright + g * (1 - a), 0, 1)
    rgb = np.stack([inten * c for c in PINK], axis=-1)
    return Image.fromarray(np.clip(rgb + 0.5, 0, 255).astype(np.uint8), 'RGB')


def icon(size=1024, p=None, glow=1.0, bright=1.0):
    """App icon: black rounded tile on the 824/1024 macOS grid, transparent outside."""
    p = p or {}
    S = size * SS
    tile_px = int(S * p.get('tile', 824 / 1024))
    toff = (S - tile_px) // 2
    inner = int(tile_px * p.get('zoom', 1.0))
    off = (S - inner) // 2
    mask = Image.new('L', (S, S), 0)
    mascot_mask(inner, p, off, off, mask)
    tile = Image.new('L', (S, S), 0)
    r = tile_px * 190 / 824
    ImageDraw.Draw(tile).rounded_rectangle([toff, toff, toff + tile_px, toff + tile_px], radius=r, fill=255)
    if not p.get('noclip'):
        mask = ImageChops.multiply(mask, tile)
    hm = head_mask(inner, off, off, (S, S))
    rgb = neon(mask, (size, size), glow, hm, bright=bright)
    alpha = tile.resize((size, size), Image.LANCZOS)
    rgb.putalpha(alpha)
    return rgb


# --------------------------------------------------------------------------
# Wordmark: "3CH" as a pink sticker with drips.
# --------------------------------------------------------------------------
LETTERS = [  # char, tilt deg, vertical bump, drips as (x fraction of the glyph, length, width)
    ('3', -5, 0.00, [(0.3, 0.13, 0.034), (0.7, 0.06, 0.024)]),
    ('C', 3, -0.025, [(0.55, 0.22, 0.038)]),
    ('H', -2, 0.01, [(0.14, 0.08, 0.026), (0.86, 0.17, 0.034)]),
]


def letters_mask(W, H, box, p=None):
    """Pink mask of the '3CH' sticker lettering inside box=(x0, y0, x1, y1) px.
    Returns (mask, region) where region covers the whole sticker (to calm the glow)."""
    p = p or {}
    grow = p.get('grow', 0.0)
    x0, y0, x1, y1 = box
    h = y1 - y0
    font = ImageFont.truetype(FONTS + 'impact.ttf', int(h * 1.02))
    gap = (x1 - x0) * 0.035
    widths = [font.getbbox(c[0], anchor='lt')[2] for c in LETTERS]
    scale = ((x1 - x0) - gap * 2) / sum(widths)
    if scale < 1:
        font = ImageFont.truetype(FONTS + 'impact.ttf', int(h * 1.02 * scale))
        widths = [font.getbbox(c[0], anchor='lt')[2] for c in LETTERS]
    total = sum(widths) + gap * 2
    x = x0 + ((x1 - x0) - total) / 2
    letters = Image.new('L', (W, H), 0)
    pen = Pen(letters, 1.0)
    for (ch, rot, dy, drips), w in zip(LETTERS, widths):
        bb = font.getbbox(ch, anchor='lt')
        lay = Image.new('L', (bb[2] + 40, bb[3] + 40), 0)
        ImageDraw.Draw(lay).text((20, 20), ch, font=font, fill=255, anchor='lt')
        lay = lay.rotate(rot, resample=Image.BICUBIC, expand=True)
        cy = y0 + h * (0.5 + dy)
        glyph = Image.new('L', (W, H), 0)
        glyph.paste(255, (int(x + w / 2 - lay.size[0] / 2), int(cy - lay.size[1] / 2)), mask=lay)
        ga = np.asarray(glyph)
        for fx, L, wd in drips:          # drips hang from the glyph's lowest pixel in that column
            xx = int(x + fx * w)
            ys = np.nonzero(ga[:, xx] > 128)[0]
            if len(ys):
                drip(Pen(glyph, 1.0), xx, ys.max() - 4, L * h * (1 + 0.35 * grow), wd * h)
        letters = ImageChops.lighter(letters, glyph)
        x += w + gap
    # sticker cut-line: a thin pink contour around a black gap
    outer = blur_threshold(letters, h * 0.05, 18)
    inner = blur_threshold(letters, h * 0.04, 34)
    contour = ImageChops.subtract(outer, inner)
    return ImageChops.lighter(letters, contour), outer


def crown(pen, x, y, s, w=5, rot=0.0):
    """Scribbled three-point crown doodle centred on (x, y)."""
    c = pen.sub(x, y, rot)
    pts = [(-1, 0.45), (-1.05, -0.5), (-0.5, 0.05), (0, -0.75), (0.5, 0.05), (1.05, -0.5), (1, 0.45), (-1, 0.45)]
    c.line([(px * s, py * s) for px, py in pts], w)
    for px, py in ((-1.05, -0.5), (0, -0.75), (1.05, -0.5)):
        c.circle(px * s, py * s - w * 1.6, w * 1.1)


def wordmark(W=1600, H=600, p=None, glow=1.0, bright=1.0):
    p = p or {}
    S = SS
    mask = Image.new('L', (W * S, H * S), 0)
    msize = int(560 * S)
    mox, moy = int(40 * S), int(20 * S)
    mascot_mask(msize, p, mox, moy, mask)
    lm, region = letters_mask(W * S, H * S, (660 * S, 130 * S, 1530 * S, 420 * S), p)
    mask = ImageChops.lighter(mask, lm)
    pen = Pen(mask, S)
    # tagline + graffiti on the black
    pen.text('kilogeneratormorphic', 1095, 530, 44, 'Inkfree.ttf', rot=-2)
    pen.line([(872, 558), (1330, 550)], 3)
    crown(pen, 792, 104, 32, 5, rot=-14)
    x0, y0 = 1410, 44
    for i in range(4):
        pen.line([(x0 + i * 14, y0 + (i % 2) * 2), (x0 + i * 14 + 3, y0 + 40)], 5)
    pen.line([(x0 - 8, y0 + 32), (x0 + 52, y0 + 8)], 5)
    for i in range(3):
        pen.line([(x0 + 72 + i * 14, y0 + 1), (x0 + 72 + i * 14 + 2, y0 + 40)], 5)
    hm = head_mask(msize, mox, moy, (W * S, H * S))
    calm = ImageChops.lighter(hm.point(lambda v: int(v * 0.6)), region.point(lambda v: int(v * 0.75)))
    return neon(mask, (W, H), glow, calm, calm_full=True, bright=bright)


# --------------------------------------------------------------------------
# Animation: 3 s seamless loop. The long run under the splat grows and drops a
# bead, the other drips breathe, the eyes blink X -> O once, the neon flickers.
# --------------------------------------------------------------------------
GIF_T, GIF_FPS = 3.0, 20


def anim(t):
    T = GIF_T
    p = {'grow': 0.5 - 0.5 * math.cos(2 * math.pi * t / T), 'noclip': True}
    detach = 2.3
    if t < detach:
        p['run'] = (t / detach) ** 1.6
    else:
        p['run'] = 0.0
        dt = t - detach
        p['run_drop'] = 0.5 * 2600 * dt * dt   # units/s^2, off the frame before the loop ends
    glow, bright = 1.0 + 0.04 * math.sin(2 * math.pi * 3 * t / T), 1.0
    for t0, g, b in ((0.60, 0.25, 0.82), (0.65, 0.55, 0.92), (0.75, 0.3, 0.85), (2.00, 0.6, 0.94)):
        if abs(t - t0) < 0.5 / GIF_FPS:
            glow, bright = g, b
    if 1.40 <= t < 1.55:
        p['blink'] = 1.0
    return p, glow, bright


def make_gif(out, W=640, H=240):
    """README header: the animated wordmark lockup."""
    tmp = os.path.join(DOCS, '_frames')
    os.makedirs(tmp, exist_ok=True)
    n = int(GIF_T * GIF_FPS)
    for i in range(n):
        p, glow, bright = anim(i / GIF_FPS)
        frame = wordmark(1600, 600, p, glow, bright).resize((W, H), Image.LANCZOS)
        frame.save(os.path.join(tmp, 'f%03d.png' % i))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(GIF_FPS), '-i',
                    os.path.join(tmp, 'f%03d.png'), '-vf',
                    'split[a][b];[a]palettegen=max_colors=128:stats_mode=full[p];'
                    '[b][p]paletteuse=dither=bayer:bayer_scale=4',
                    '-loop', '0', out], check=True)
    for i in range(n):
        os.remove(os.path.join(tmp, 'f%03d.png' % i))
    os.rmdir(tmp)
    print('wrote', out, os.path.getsize(out) // 1024, 'KB')


def on_alpha(rgb):
    """Pink on black -> pink with alpha, so the mark sits on any dark background."""
    a = rgb.getchannel('R')
    out = Image.new('RGBA', rgb.size, PINK + (0,))
    out.putalpha(a)
    return out


# small-size variant (<= 48 px): no graffiti/drips, bolder features, bigger head, fuller tile
SMALL = {'bold': True, 'zoom': 1.42, 'tile': 0.94}


def main():
    build = os.path.join(APP, 'build')
    ic = icon(1024)
    ic.save(os.path.join(build, 'icon.png'))
    # Windows .ico: the simplified face for taskbar sizes, the full mascot above.
    small = icon(1024, SMALL, glow=0.55)
    sizes = [16, 24, 32, 48, 64, 128, 256]
    frames = [(small if s <= 48 else ic).resize((s, s), Image.LANCZOS) for s in sizes]
    frames[-1].save(os.path.join(build, 'icon.ico'), format='ICO',
                    sizes=[(s, s) for s in sizes], append_images=frames[:-1])
    # Top bar mark in the app: the mascot without its tile.
    mark = icon(1024, {'noclip': True})
    mark = Image.merge('RGB', mark.split()[:3])
    on_alpha(mark).resize((160, 160), Image.LANCZOS).save(os.path.join(APP, 'renderer', 'logo.png'))
    print('wrote build/icon.png, build/icon.ico, renderer/logo.png')
    if 'gif' in sys.argv[1:]:
        make_gif(os.path.join(DOCS, 'logo.gif'))


if __name__ == '__main__':
    main()
