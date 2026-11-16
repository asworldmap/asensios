"""Europe v2 — "The Railway Journey".

The landscape a train deserves: a station with a face, a stone viaduct, a tunnel
mouth, rolling meadow, real woodland and a wall of mountains. Generic Central
European character; no real station or place is reproduced.

Rail pieces follow the existing kit: rail top is y = 0, platforms are 0.92 m
above it, the track centre-line is x = 0 and pieces tile along z.
"""

import math
import os
import sys

import bmesh
from mathutils import Vector
from mathutils import noise as mnoise

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
import artlib as A  # noqa: E402
from ptw import parts as P  # noqa: E402
from ptw.parts import g  # noqa: E402

SLATE = ["#5d6b72", "#52606a", "#6a7880", "#4a5760", "#667279"]
BRICK = "#a8553d"
RENDER = "#efe6d2"
LEAF_OAK = ("#27492a", "#4a7a35", "#86ac4c")
LEAF_BIRCH = ("#5a8a3a", "#9ac255", "#d0e088")
SPRUCE = ("#16301f", "#2c5636", "#4f7f4c")
MEADOW = ("#6f9a42", "#9cbf55", "#c9d87a")


def slate_roof(k, w, d, y0, rise, ov=0.5, ox=0.0, oz=0.0, ridge="x"):
    """Steep slate roof: flat lapped courses instead of barrel tiles."""
    r = k.rng
    span, run = (w, d) if ridge == "x" else (d, w)
    half = run / 2
    P3 = (lambda a, b, y: g(ox + a, y, oz + b)) if ridge == "x" else (lambda a, b, y: g(ox + b, y, oz + a))
    rows = max(4, int(math.hypot(half + ov, rise) / 0.42))
    cols = max(4, int((span + 2 * ov) / 0.75))
    for side in (-1, 1):
        bm = bmesh.new()
        for q in range(rows):
            t0, t1 = q / rows, (q + 1) / rows
            for c in range(cols):
                a0 = -span / 2 - ov + (span + 2 * ov) * c / cols
                a1 = a0 + (span + 2 * ov) / cols
                y_top = lambda t: y0 + rise - (rise + ov * rise / half) * t
                lap = 0.05
                pts = [P3(a0, side * (half + ov) * t0, y_top(t0) + lap), P3(a1, side * (half + ov) * t0, y_top(t0) + lap), P3(a1, side * (half + ov) * t1, y_top(t1)), P3(a0, side * (half + ov) * t1, y_top(t1))]
                bm.faces.new([bm.verts.new(p) for p in pts])
        o = k.add(bm, "slates", "stone")
        o.data.materials[0].use_backface_culling = False
        k.paint(o, SLATE[0], jitter=0.07, fn=lambda c, n_, base: k.blend(SLATE[r.randrange(len(SLATE))], SLATE[0], 0.3))
    k.paint(k.tube("ridge", [P3(-span / 2 - ov, 0, y0 + rise + 0.06), P3(span / 2 + ov, 0, y0 + rise + 0.06)], 0.1, "metal", seg=5), "#3f4a50", jitter=0)
    bm = bmesh.new()
    for s in (-1, 1):
        vs = [bm.verts.new(P3(s * span / 2, -half, y0)), bm.verts.new(P3(s * span / 2, half, y0)), bm.verts.new(P3(s * span / 2, 0, y0 + rise))]
        bm.faces.new(vs)
    return k.add(bm, "gable", "plaster")


def arched_window(k, put, yaw, u, y0, w=1.1, h=2.4, glass="#2f4450", trim=BRICK):
    """Tall round-headed window in a brick surround — the station's motif."""
    P.panel(k, "glass", w, h - w / 2, put(u, y0 + (h - w / 2) / 2, -0.02), "window", glass, yaw=yaw, depth=0.05, bevel=0.0)
    A.arch_void(k, put, yaw, u, y0 + h - w / 2 - 0.02, w, y0 + h - w / 2, color=glass, out=0.0, seg=8)
    A.arch_ring(k, put, yaw, u, y0 + h - w / 2, w / 2, depth=0.14, n=5, color=trim, ring=0.2, proud=0.06, name="brick_arch")
    for s in (-1, 1):
        P.panel(k, "jamb", 0.2, h - w / 2, put(u + s * (w / 2 + 0.1), y0 + (h - w / 2) / 2, 0.03), "stone", trim, yaw=yaw, depth=0.06, bevel=0.0, jitter=0.07)
    P.panel(k, "mullion", 0.05, h - w / 2, put(u, y0 + (h - w / 2) / 2, 0.01), "wood", "#efe6d2", yaw=yaw, depth=0.04, bevel=0.0)
    P.panel(k, "sill", w + 0.5, 0.1, put(u, y0 - 0.05, 0.08), "stone", A.STONE_LIGHT, yaw=yaw, depth=0.2, bevel=0.0, jitter=0.04)


def station_building(k):
    """A country junction station: tall central block with a clock gable, two
    low wings, steep slate roofs, brick-arched windows and a cast-iron canopy
    over the platform. Front (+z) is the platform side; y = 0 is PLATFORM level
    (0.92 m above rail top)."""
    CW, CD, CH = 9.0, 7.0, 7.4
    WW, WH = 7.0, 4.2
    A.shell(k, CW, CD, CH, RENDER, seed=2.0, cell=1.1)
    for s in (-1, 1):
        A.shell(k, WW, CD - 1.0, WH, RENDER, ox=s * (CW / 2 + WW / 2), seed=3.0 + s, cell=1.1, name="wing")
        gw = slate_roof(k, WW, CD - 1.0, WH, 2.4, ox=s * (CW / 2 + WW / 2))
        k.paint(gw, RENDER, jitter=0.0, fn=A.plaster_paint(k, RENDER, WH + 2.4, 4.0, 0.6), per_vertex=True)
        A.cornice(k, WW, CD - 1.0, WH - 0.1, ox=s * (CW / 2 + WW / 2), color=BRICK, proj=0.14)
    gc = slate_roof(k, CW, CD, CH, 3.6, ridge="z")
    k.paint(gc, RENDER, jitter=0.0, fn=A.plaster_paint(k, RENDER, CH + 3.6, 5.0, 0.6), per_vertex=True)
    A.cornice(k, CW, CD, CH - 0.1, color=BRICK, proj=0.16)
    A.plinth(k, CW + 2 * WW, CD - 0.6, 0.7, color="#9a8f80")
    fs = A.faces_of(CW, CD)
    for name in ("front", "back"):
        yaw, put, _ = fs[name]
        for u in (-3.0, 0.0, 3.0):
            if u == 0.0:
                A.door(k, put, yaw, 0.0, w=1.7, h=2.9, color="#27512f")
            else:
                arched_window(k, put, yaw, u, 0.9)
            arched_window(k, put, yaw, u, 4.3, w=1.0, h=2.2)
        for s in (-1, 1):
            P.panel(k, "quoin", 0.5, CH, put(s * (CW / 2 - 0.25), CH / 2, 0.03), "stone", BRICK, yaw=yaw, depth=0.07, bevel=0.0, jitter=0.08)
        # Clock in the gable.
        k.paint(k.tube("clock_rim", [g(*put(0, CH + 1.5, 0.02)), g(*put(0, CH + 1.5, 0.12))], 0.78, "stone", seg=20), BRICK, jitter=0.03)
        k.paint(k.tube("clock_face", [g(*put(0, CH + 1.5, 0.12)), g(*put(0, CH + 1.5, 0.15))], 0.64, "plaster", seg=20), "#f6f1e2", jitter=0)
        for ang, ln in ((0.6, 0.42), (2.3, 0.3)):
            k.paint(k.tube("hand", [g(*put(0, CH + 1.5, 0.17)), g(*put(math.sin(ang) * ln, CH + 1.5 + math.cos(ang) * ln, 0.17))], 0.025, "metal", seg=4), A.IRON, jitter=0)
        k.anchor(f"clock_{name}", g(*put(0, CH + 1.5, 0.2)), kind="label")
    for s in (-1, 1):
        wf = A.faces_of(WW, CD - 1.0, s * (CW / 2 + WW / 2), 0)
        for name, us in (("front", (-2.0, 0.0, 2.0)), ("back", (0.0,))):
            yaw, put, _ = wf[name]
            for u in us:
                arched_window(k, put, yaw, u, 0.9, w=1.0, h=2.3)
        yaw, put, _ = wf["left" if s > 0 else "right"]
        arched_window(k, put, yaw, 0.0, 0.9, w=1.0, h=2.3)
    for cx in (-CW / 2 - WW / 2 - 1.5, CW / 2 + WW / 2 + 1.5, 0.0):
        k.paint(k.box("chimney", (0.6, 0.6, 1.9), g(cx, (WH if cx else CH) + 3.0, -1.2 if cx else -2.0), "stone"), BRICK, jitter=0.07)
        k.paint(k.box("chimney_cap", (0.78, 0.78, 0.14), g(cx, (WH if cx else CH) + 4.0, -1.2 if cx else -2.0), "stone"), A.STONE_LIGHT, jitter=0.04)
    z0, reach = CD / 2 - 0.5, 4.4
    P.panel(k, "name_board", 3.2, 0.5, (0, 3.0, CD / 2 + 0.06), "paint", "#27512f", yaw=math.pi / 2, depth=0.06, bevel=0.03)
    k.anchor("label_name", g(0, 3.0, CD / 2 + 0.12), kind="label", width=3.0, height=0.4)
    k.anchor("platform_edge", g(0, 0, z0 + reach + 1.8), kind="placement", note="track centre-line is 2.4 m beyond this, 0.92 m lower")
    k.anchor("door", g(0, 0, CD / 2 + 1.2), kind="boarding")
    hw = CW / 2 + WW
    for a, b in (((-hw, -CD / 2), (hw, -CD / 2)), ((-hw, CD / 2), (hw, CD / 2)), ((-hw, -CD / 2), (-hw, CD / 2)), ((hw, -CD / 2), (hw, CD / 2))):
        k.wall((a[0], -a[1]), (b[0], -b[1]), 0.2)
    k.finish(ao_strength=0.85, ao_samples=64)


def station_canopy(k):
    """The station's platform canopy: iron columns, curved brackets, lean-to
    roof and a sawtooth timber valance. Same origin as station_building — place
    it at the same position and yaw."""
    CW, CD, WW = 9.0, 7.0, 7.0
    # Platform canopy: iron columns, curved brackets, glazed lean-to roof, timber valance.
    L, reach = CW + 2 * WW - 1.0, 4.4
    z0 = CD / 2 - 0.5
    n = 7
    for i in range(n):
        x = -L / 2 + i * L / (n - 1)
        k.paint(k.tube("col", [g(x, 0, z0 + reach - 0.5), g(x, 3.5, z0 + reach - 0.5)], 0.09, "metal", seg=8, r_end=0.07), "#27512f", jitter=0)
        k.paint(k.cylinder("col_base", 0.16, 0.45, g(x, 0, z0 + reach - 0.5), "metal", seg=8, r_top=0.1), "#27512f", jitter=0)
        k.paint(k.tube("bracket", [g(x, 2.7, z0 + reach - 0.5), g(x, 3.45, z0 + reach - 1.3), g(x, 3.9, z0 + 0.6)], 0.035, "metal", seg=4), "#27512f", jitter=0)
        k.paint(k.tube("rafter", [g(x, 4.25, z0 + 0.4), g(x, 3.55, z0 + reach)], 0.05, "metal", seg=4), "#27512f", jitter=0)
        k.collider(x, -(z0 + reach - 0.5), 0.16)
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in (g(-L / 2 - 0.4, 4.32, z0 + 0.3), g(L / 2 + 0.4, 4.32, z0 + 0.3), g(L / 2 + 0.4, 3.58, z0 + reach + 0.2), g(-L / 2 - 0.4, 3.58, z0 + reach + 0.2))]
    bm.faces.new(vs)
    roof = k.add(bm, "canopy_roof", "stone")
    roof.data.materials[0].use_backface_culling = False
    k.paint(roof, "#7f8f96", jitter=0.03)
    m = 44
    for i in range(m):
        x = -L / 2 - 0.4 + (i + 0.5) * (L + 0.8) / m
        bm = bmesh.new()
        w2 = (L + 0.8) / m / 2 - 0.01
        zz = z0 + reach + 0.22
        vs = [bm.verts.new(v) for v in (g(x - w2, 3.56, zz), g(x + w2, 3.56, zz), g(x + w2, 3.3, zz), g(x, 3.17, zz), g(x - w2, 3.3, zz))]
        bm.faces.new(vs)
        o = k.add(bm, "valance", "wood")
        o.data.materials[0].use_backface_culling = False
        k.paint(o, "#efe6d2" if i % 2 else "#e2d7bf", jitter=0.02)
    for x in (-L / 4, L / 4):
        k.paint(k.sphere("lamp", 0.16, g(x, 3.3, z0 + 2.4), "glow", subdiv=1, smooth=60), "#fff3c4", jitter=0)
        k.anchor(f"light_{'a' if x < 0 else 'b'}", g(x, 3.2, z0 + 2.4), kind="lamp")
    k.anchor("shelter", g(0, 0, z0 + 2.4), kind="placement")
    k.finish(ao_strength=0.8, ao_samples=48)


def platform_paving(k):
    """6 x 10 m of station platform floor between the rail_platform edge and
    the station front. Top is y = 0 = platform level; tile along z."""
    A.paving(k, 6.0, 10.0, 0.0, cell=0.75, tones=("#b9b3a6", "#aaa497", "#c4beb0", "#9f998d"))
    k.paint(k.box("base", (6.0, 10.0, 1.7), g(0, -0.9, 0), "stone"), "#8f8a7e", jitter=0.03)
    k.anchor("next", g(0, 0, 10))
    k.finish(ao=False, ground=False)


def viaduct_arch(k):
    """One 14 m span of a stone railway viaduct, 17 m tall. Deck top is y = 0
    (rail top sits on it); tile along z for a long crossing."""
    L, W, Hh = 14.0, 5.2, 17.0
    span = 10.4
    R = span / 2
    spring = -3.2 - R
    bm = bmesh.new()
    seg = 16
    zs = [-L / 2, -span / 2] + [-span / 2 + span * i / seg for i in range(1, seg)] + [span / 2, L / 2]

    def under(z):
        return spring + math.sqrt(max(0.0, R * R - z * z)) if abs(z) < R else -Hh

    for a, b in zip(zs, zs[1:]):
        za, zb = under(a + 1e-4), under(b - 1e-4)
        rows = max(1, int((0 - min(za, zb)) / 1.6))
        for sx in (-1, 1):
            taper = lambda y: W / 2 + (0.6 * (-y) / Hh)
            for q in range(rows):
                f0, f1 = q / rows, (q + 1) / rows
                ya0, ya1, yb0, yb1 = za * (1 - f0), za * (1 - f1), zb * (1 - f0), zb * (1 - f1)
                vs = [bm.verts.new(g(sx * taper(y), y, z)) for y, z in ((ya0, a), (yb0, b), (yb1, b), (ya1, a))]
                bm.faces.new(vs if sx < 0 else vs[::-1])
        bm.faces.new([bm.verts.new(g(x, y, z)) for x, y, z in ((-W / 2 - 0.2, za, a), (W / 2 + 0.2, za, a), (W / 2 + 0.2, zb, b), (-W / 2 - 0.2, zb, b))])
        bm.faces.new([bm.verts.new(g(x, 0, z)) for x, z in ((-W / 2, b), (W / 2, b), (W / 2, a), (-W / 2, a))])
    for z in (-L / 2, L / 2):
        bm.faces.new([bm.verts.new(g(x, y, z)) for x, y in ((-W / 2 - 0.6, -Hh), (W / 2 + 0.6, -Hh), (W / 2, 0), (-W / 2, 0))])
    o = k.add(bm, "masonry", "stone", smooth=0)
    k.paint(o, A.STONE, jitter=0.09, fn=lambda c, n_, base: k.blend("#8f8c72", A.STONE, min(1.0, max(0.0, 1.0 + c.z / (Hh * 0.9)))))
    for sx in (-1, 1):
        fput = A.face(0.0 if sx > 0 else math.pi, sx * (W / 2 + 0.25), 0)
        A.arch_ring(k, fput, 0.0 if sx > 0 else math.pi, 0.0, spring, R, depth=0.3, n=17, ring=0.55, proud=0.1)
        k.paint(k.box("string", (0.25, L, 0.3), g(sx * (W / 2 + 0.08), -0.6, 0), "stone"), A.STONE_LIGHT, jitter=0.04)
        k.paint(k.box("parapet", (0.35, L, 1.1), g(sx * (W / 2 - 0.1), 0.35, 0), "stone"), A.STONE, jitter=0.07)
        k.paint(k.box("coping", (0.5, L, 0.12), g(sx * (W / 2 - 0.1), 0.95, 0), "stone"), A.STONE_LIGHT, jitter=0.04)
        k.wall((sx * (W / 2 - 0.1), L / 2), (sx * (W / 2 - 0.1), -L / 2), 0.25)
        for z in (-L / 2 + 0.9, L / 2 - 0.9):
            k.paint(k.bbox("pilaster", (0.5, 1.5, Hh), g(sx * (W / 2 + 0.35), -Hh / 2, z), "stone", bevel=0.06, seg=1), A.STONE, jitter=0.07, fn=A.stone_tone(k))
    k.paint(k.box("ballast", (3.6, L, 0.3), g(0, -0.2, 0), "earth"), "#9d927f", jitter=0.05)
    k.anchor("next", g(0, 0, L))
    k.anchor("foot", g(0, -Hh, 0), kind="placement", note="valley floor under the span")
    k.finish(ao_strength=0.8, ao_samples=64, ground=False)


def tunnel_portal(k):
    """A tunnel mouth in dressed stone, set into a wooded bank. The track runs
    in along -z; the dark void is modelled so no engine trick is needed."""
    W, Hh = 5.6, 6.2
    yaw, put = math.pi / 2, A.face(math.pi / 2, 0, 0)
    bm = bmesh.new()
    # Face wall with the horseshoe opening left out: columns of quads either side and above.
    R, sp = 2.5, 2.9
    cols = 20
    for i in range(cols):
        u0, u1 = -7 + 14 * i / cols, -7 + 14 * (i + 1) / cols
        um = (u0 + u1) / 2
        top = Hh + 1.2 - abs(um) * 0.18
        lo = sp + math.sqrt(max(0.0, R * R - um * um)) if abs(um) < R else -0.4
        rows = 4
        for q in range(rows):
            y0, y1 = lo + (top - lo) * q / rows, lo + (top - lo) * (q + 1) / rows
            bm.faces.new([bm.verts.new(g(*put(u, y, 0))) for u, y in ((u0, y0), (u1, y0), (u1, y1), (u0, y1))])
    o = k.add(bm, "face", "stone", smooth=0)
    o.data.materials[0].use_backface_culling = False
    k.paint(o, A.STONE, jitter=0.1, fn=lambda c, n_, base: k.blend("#7f7f66", A.STONE, min(1.0, max(0.0, c.z / 5.0))))
    A.arch_ring(k, put, yaw, 0.0, sp, R, depth=0.6, n=15, ring=0.6, proud=0.14)
    for s in (-1, 1):
        P.panel(k, "jamb", 0.6, sp + 0.4, put(s * (R + 0.3), sp / 2 - 0.2, 0.07), "stone", A.STONE_LIGHT, yaw=yaw, depth=0.7, bevel=0.04, jitter=0.06)
    P.panel(k, "cornice", 13.0, 0.3, put(0, Hh + 0.6, 0.12), "stone", A.STONE_LIGHT, yaw=yaw, depth=0.5, bevel=0.05, jitter=0.04)
    P.panel(k, "plaque", 1.5, 0.6, put(0, Hh - 0.1, 0.06), "stone", A.STONE_LIGHT, yaw=yaw, depth=0.12, bevel=0.03)
    k.anchor("label_plaque", g(*put(0, Hh - 0.1, 0.14)), kind="label")
    # The bore: a dark barrel going 9 m into the hill.
    n = 12
    ring = lambda z, s: [g(-R * s, -0.4, z), g(R * s, -0.4, z)] + [g(math.cos(a) * R * s, sp + math.sin(a) * R * s, z) for a in [math.pi * i / n for i in range(n + 1)]]
    bore = k.loft("bore", [ring(0.0, 1.0), ring(-4.5, 0.97), ring(-9.0, 0.94)], "stone", cap=(False, True), smooth=40)
    bore.data.materials[0].use_backface_culling = False
    k.paint(bore, "#2a2620", jitter=0.0, per_vertex=True, fn=lambda c, n_, base: k.blend("#0d0c0a", "#5a5346", min(1.0, max(0.0, 1.0 + c.y / -4.0)) if False else max(0.0, 1.0 - (c.y / 5.0))))
    # The hill it bores into: an earth mound with meadow on top.
    r = k.rng
    off = Vector((r.random() * 9, r.random() * 9, 0))
    bm = bmesh.new()
    nx, nz = 16, 9
    grid = []
    for j in range(nz + 1):
        row = []
        for i in range(nx + 1):
            x = -15 + 30 * i / nx
            z = -0.35 - 17 * j / nz
            hump = (Hh + 2.4 + 4.0 * (j / nz) ** 0.7) * max(0.0, 1 - (abs(x) / 15) ** 2.2)
            cut = 0.0 if abs(x) > R + 1.2 or j > 0 else 0.0
            y = hump * (0.82 + 0.18 * mnoise.noise(Vector((x * 0.12, z * 0.12, 0)) + off)) - cut
            if j == 0 and abs(x) < 7.0:
                y = max(y, Hh + 1.2 - abs(x) * 0.18)
            row.append(bm.verts.new(g(x, y, z)))
        grid.append(row)
    for j in range(nz):
        for i in range(nx):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    hill = k.add(bm, "hill", "earth", smooth=50)
    hill.data.materials[0].use_backface_culling = False
    k.paint(hill, MEADOW[1], jitter=0.06, per_vertex=True, fn=lambda c, n_, base: k.blend("#8a7a5a", MEADOW[1], min(1.0, max(0.0, n_.z * 1.6 - 0.5))))
    for i in range(7):
        x = -12 + i * 4 + (r.random() - 0.5) * 2
        if abs(x) < 4.5:
            continue
        A.clump(k, g(x, Hh * 0.55 * max(0.2, 1 - (abs(x) / 15) ** 2.2) + 1.5, -1.8 - r.random() * 2), 1.3 + r.random() * 0.6, tones=LEAF_OAK, subdiv=2, sway=lambda co: 0.4)
    k.wall((-7, 0.0), (-R - 0.3, 0.0), 0.4)
    k.wall((R + 0.3, 0.0), (7, 0.0), 0.4)
    k.anchor("track_in", g(0, 0, 0), kind="placement")
    k.anchor("track_out", g(0, 0, -9), kind="placement")
    k.finish(ao_strength=0.85, ao_samples=64)


def meadow_hill(k):
    """A rounded hill, 60 m across and 9 m high, painted as a patchwork of
    meadow, mown strips and a hedge line. Overlap several for rolling country."""
    r = k.rng
    off = Vector((r.random() * 20, r.random() * 20, 0))
    n = 28
    bm = bmesh.new()
    grid = []
    for j in range(n + 1):
        row = []
        for i in range(n + 1):
            x, z = -30 + 60 * i / n, -30 + 60 * j / n
            d = math.hypot(x, z) / 30
            h = 9.0 * max(0.0, 1 - d * d) ** 1.4 * (0.8 + 0.3 * mnoise.noise(Vector((x * 0.05, z * 0.05, 0)) + off)) - 0.3 - 6.0 * max(0.0, d - 0.85)
            row.append(bm.verts.new(g(x, h, z)))
        grid.append(row)
    for j in range(n):
        for i in range(n):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    o = k.add(bm, "hill", "earth", smooth=60)

    def paint(c, n_, base):
        x, z = c.x, -c.y
        field = mnoise.noise(Vector((x * 0.035 + 3, z * 0.035, 0)) + off)
        stripe = math.sin((x * 0.8 + z * 0.5) * 1.1)
        if field > 0.18:
            col = k.blend("#b9c06a", "#d6cf82", 0.5 + 0.5 * stripe)  # hay meadow, mown in strips
        elif field < -0.2:
            col = k.blend(MEADOW[0], "#5f8a3c", 0.5 + 0.5 * stripe * 0.4)
        else:
            col = k.blend(MEADOW[1], MEADOW[2], 0.5 + 0.5 * mnoise.noise(Vector((x * 0.2, z * 0.2, 1))))
        if abs(field - 0.18) < 0.02 or abs(field + 0.2) < 0.02:
            col = k.blend("#3a5a30", "#3a5a30", 1)  # hedge lines between fields
        return col

    k.paint(o, MEADOW[1], jitter=0.03, per_vertex=True, fn=paint)
    k.anchor("summit", g(0, 8.7, 0))
    k.finish(ao=False)


def broadleaf_tree(k):
    """A big field tree (oak or beech in spirit): spreading boughs, a crown made
    of many masses with sky between them."""
    r = k.rng
    sway = lambda co: min(1.0, max(0.0, (co.z - 3.0) / 8.0) * 0.6 + 0.08)
    A.trunk(k, [g(0, -0.3, 0), g(0.1, 2.0, 0.05), g(-0.05, 4.2, 0)], 0.5, 0.3, bark=("#3f342a", "#6f6050"), seg=8)
    k.paint(k.sphere("root_flare", 0.75, g(0, 0.1, 0), "wood", subdiv=2, scale=(1, 1, 0.5), noise=0.25, smooth=60), "#4a3f33", jitter=0.08)
    tips = []
    for i in range(5):
        a = i / 5 * math.tau + r.random() * 0.5
        reach = 2.8 + r.random() * 1.4
        tip = g(math.cos(a) * reach, 6.0 + r.random() * 1.6, math.sin(a) * reach)
        A.trunk(k, [g(0, 3.6, 0), g(math.cos(a) * reach * 0.45, 5.0, math.sin(a) * reach * 0.45), tip], 0.22, 0.07, bark=("#3f342a", "#6f6050"), seg=6, name="bough")
        tips.append(tip)
    A.clump(k, g(0, 8.3, 0), 2.6, tones=LEAF_OAK, sway=sway, subdiv=3, scale=(1.2, 1.2, 0.85), noise=0.2, freq=1.4)
    for tip in tips:
        A.clump(k, tip + Vector((0, 0, 0.9)), 1.9 + r.random() * 0.5, tones=LEAF_OAK, sway=sway, subdiv=2, scale=(1.15, 1.15, 0.72), noise=0.2)
        for j in range(2):
            a = r.random() * math.tau
            A.clump(k, tip + g(math.cos(a) * 1.5, -0.3 + r.random() * 1.6, math.sin(a) * 1.5), 1.0 + r.random() * 0.4, tones=LEAF_OAK, sway=sway, subdiv=2, scale=(1.1, 1.1, 0.7), noise=0.22)
    k.collider(0, 0, 0.7)
    k.anchor("canopy", g(0, 7.5, 0))
    k.finish(ao_strength=0.75, ao_samples=48)


def birch_tree(k):
    """Birch: white bark with dark scars, a light, hanging crown."""
    r = k.rng
    h = 9.5 + r.random() * 1.5
    lean = (r.random() - 0.5) * 0.9
    sway = lambda co: min(1.0, max(0.0, (co.z - 2.5) / (h - 2.5)) * 0.85 + 0.1)
    pts = [g(lean * t * t, h * t - 0.2, 0.2 * math.sin(t * 3)) for t in (0, 0.25, 0.5, 0.75, 1.0)]
    o = k.tube("trunk", pts, 0.2, "wood", seg=7, r_end=0.04, cap=False)
    k.paint(o, "#eee9dc", jitter=0.03, fn=lambda c, n_, base: k.blend("#2f2a26", "#f2eee2", 0.0 if (mnoise.noise(Vector((c.x * 3, c.y * 3, c.z * 2.2))) > 0.42 or c.z < 0.5) else 1.0))
    for i in range(11):
        t = 0.38 + i * 0.058
        a = i * 2.4
        base = g(lean * t * t, h * t, 0)
        reach = (1.9 - abs(t - 0.6) * 2.2) * (0.8 + r.random() * 0.4)
        tip = base + g(math.cos(a) * reach, 0.5 - reach * 0.35, math.sin(a) * reach)
        k.paint(k.tube("branch", [base, (base + tip) / 2 + Vector((0, 0, 0.35)), tip], 0.045, "wood", seg=4, r_end=0.012, cap=False), "#4a4038", jitter=0.05)
        for q in range(3):
            at = base + (tip - base) * (0.45 + q * 0.3) + Vector(((r.random() - 0.5) * 0.5, (r.random() - 0.5) * 0.5, 0.1 - q * 0.22))
            A.clump(k, at, 0.5 + r.random() * 0.22, tones=LEAF_BIRCH, sway=sway, subdiv=2, scale=(1.25, 1.25, 0.75), noise=0.3, freq=2.6)
    A.clump(k, g(lean, h + 0.2, 0), 0.8, tones=LEAF_BIRCH, sway=sway, subdiv=2, scale=(0.9, 0.9, 1.3), noise=0.22)
    k.collider(0, 0, 0.35)
    k.finish(ao_strength=0.65, ao_samples=48)


def spruce_tall(k):
    """Mountain spruce: drooping tiers of boughs round a straight trunk, each
    tier a ring of separate sprays, not a stack of cones."""
    r = k.rng
    h = 15.0 + r.random() * 3
    sway = lambda co: min(1.0, max(0.0, co.z / h) ** 1.4 * 0.5)
    A.trunk(k, [g(0, -0.3, 0), g(0, h, 0)], 0.3, 0.03, bark=("#3a2c22", "#5f4a3a"), seg=7)
    tiers = 11
    for ti in range(tiers):
        t = ti / (tiers - 1)
        y = 2.2 + t * (h - 2.6)
        reach = 3.4 * (1 - t) ** 0.85 + 0.35
        arms = 8 if t < 0.6 else 6
        for j in range(arms):
            a = j / arms * math.tau + ti * 0.7 + (r.random() - 0.5) * 0.3
            droop = reach * (0.38 - t * 0.2)
            pts = [g(0, y, 0), g(math.cos(a) * reach * 0.5, y - droop * 0.25, math.sin(a) * reach * 0.5), g(math.cos(a) * reach, y - droop, math.sin(a) * reach)]
            o = k.tube("spray", pts, 0.62 * (1 - t * 0.5), "foliage", seg=5, r_end=0.06, cap=True)
            for v in o.data.vertices:  # flatten each bough into a hanging fan
                v.co.z = y + (v.co.z - y) * 1.0 - abs(math.hypot(v.co.x, v.co.y) - reach * 0.5) * 0.0
            k.shade(o, 60)
            k.paint(o, SPRUCE[1], jitter=0.09, per_vertex=True, sway=sway, fn=lambda c, n_, base: k.blend(SPRUCE[0], SPRUCE[2], min(1.0, max(0.0, 0.35 + n_.z * 0.65))))
    A.clump(k, g(0, h + 0.3, 0), 0.4, tones=SPRUCE, sway=sway, subdiv=1, scale=(0.6, 0.6, 2.2), noise=0.1)
    k.collider(0, 0, 0.45)
    k.finish(ao_strength=0.7, ao_samples=48)


def hedgerow(k):
    """10 m of field hedge with a gate post at one end. Tile along z."""
    r = k.rng
    for i in range(9):
        z = -4.6 + i * 1.15
        A.clump(k, g((r.random() - 0.5) * 0.7, 0.6 + r.random() * 0.5, z), 0.6 + r.random() * 0.55, tones=("#27492a", "#4f7a38", "#8aab52"), subdiv=2, scale=(0.85, 1.15, 0.95), noise=0.22, sway=lambda co: min(1.0, co.z / 1.8) * 0.4)
    for i in range(6):
        f = k.sphere("blossom", 0.09, g((r.random() - 0.5) * 1.3, 1.0 + r.random() * 0.7, -4.5 + r.random() * 9), "foliage", subdiv=1, smooth=60)
        k.paint(f, "#f3ead6" if i % 2 else "#e08a9a", jitter=0.05, per_vertex=True, sway=lambda co: 0.4)
    k.paint(k.bbox("post", (0.16, 0.16, 1.4), g(0, 0.7, 5.0), "wood", bevel=0.02, seg=1), A.WOOD, jitter=0.06)
    k.wall((0, 4.8), (0, -4.8), 0.6)
    k.anchor("next", g(0, 0, 10))
    k.finish(ao_strength=0.7, ao_samples=32)


def signal_box(k):
    """Signal cabin: brick base, glazed timber operating floor, slate roof, outside stair."""
    W, D = 5.0, 3.4
    A.shell(k, W, D, 2.6, BRICK, seed=6.0, cell=0.6, surface="stone", grime=0.6)
    A.shell(k, W + 0.3, D + 0.3, 2.3, "#efe6d2", y0=2.6, seed=7.0, cell=0.6, name="cabin", grime=0.4)
    for name, (yaw, put, fw) in A.faces_of(W + 0.3, D + 0.3).items():
        n = 4 if name in ("front", "back") else 3
        for i in range(n):
            u = -fw / 2 + (i + 0.5) * fw / n
            P.panel(k, "glazing", fw / n - 0.14, 1.3, put(u, 3.95, 0.02), "window", "#33464a", yaw=yaw, depth=0.05, bevel=0.0)
            P.panel(k, "glazing_bar", 0.04, 1.3, put(u, 3.95, 0.04), "wood", "#27512f", yaw=yaw, depth=0.04, bevel=0.0)
        P.panel(k, "band", fw, 0.16, put(0, 3.2, 0.04), "wood", "#27512f", yaw=yaw, depth=0.06, bevel=0.0)
    g2 = slate_roof(k, W + 0.3, D + 0.3, 4.9, 1.5, ov=0.45)
    k.paint(g2, "#efe6d2", jitter=0.03)
    yaw, put, _ = A.faces_of(W, D)["front"]
    arched_window(k, put, yaw, -1.2, 0.5, w=0.8, h=1.6)
    P.panel(k, "door", 0.9, 2.0, put(1.2, 1.0, 0.03), "wood", "#27512f", yaw=yaw, depth=0.06, bevel=0.02)
    P.stairs(k, (W / 2 + 0.6, 0, D / 2 - 0.2), (W / 2 + 0.6, 2.6, -D / 2 + 0.2), 0.8, 10, color=A.WOOD_LIGHT)
    P.railing(k, [(W / 2 + 1.0, 0, D / 2 - 0.2), (W / 2 + 1.0, 2.6, -D / 2 + 0.2)], h=0.9, post=0.9, color="#27512f")
    P.panel(k, "name", 1.8, 0.34, put(0, 3.2, 0.1), "paint", "#efe6d2", yaw=yaw, depth=0.04, bevel=0.02)
    k.anchor("label_name", g(*put(0, 3.2, 0.14)), kind="label")
    for a, b in (((-W / 2, -D / 2), (W / 2, -D / 2)), ((-W / 2, D / 2), (W / 2, D / 2)), ((-W / 2, -D / 2), (-W / 2, D / 2)), ((W / 2 + 1.0, -D / 2), (W / 2 + 1.0, D / 2))):
        k.wall((a[0], -a[1]), (b[0], -b[1]), 0.2)
    k.finish(ao_strength=0.85, ao_samples=64)


def alps_backdrop(k):
    """A mountain wall, 78 m long: dark forested foot, grey rock, snow above.
    Scale 3–5 and stand it 250–400 m out; two layers give real depth."""
    r = k.rng
    off = Vector((r.random() * 20, r.random() * 20, 0))
    L = 78.0
    for li, (z, hmax, fade) in enumerate(((0.0, 30.0, 0.0), (-12.0, 40.0, 0.45))):
        n = 44
        bm = bmesh.new()
        rows = 7
        crest = []
        for i in range(n + 1):
            t = i / n
            x = -L / 2 + L * t
            env = math.sin(t * math.pi) ** 0.5
            jag = abs(mnoise.noise(Vector((x * 0.06 + li * 5, li * 2.0, 0)) + off)) * 0.6 + abs(mnoise.noise(Vector((x * 0.21, li, 3)) + off)) * 0.3
            crest.append((x, max(1.0, hmax * env * (0.42 + jag))))
        grid = []
        for q in range(rows + 1):
            f = q / rows
            grid.append([bm.verts.new(g(x + 1.5 * mnoise.noise(Vector((x * 0.1, f * 4, li)) + off) * (1 - f), -1.0 + (h + 1.0) * f ** 1.25, z + 9.0 * (1 - f) + 2.0 * mnoise.noise(Vector((x * 0.15, f * 3, li + 2)) + off))) for x, h in crest])
        for q in range(rows):
            for i in range(n):
                bm.faces.new((grid[q][i], grid[q][i + 1], grid[q + 1][i + 1], grid[q + 1][i]))
        o = k.add(bm, "range", "earth", smooth=12)

        def paint(c, n_, base, hmax=hmax, fade=fade):
            hh = c.z / hmax
            snow = hh + 0.1 * mnoise.noise(Vector((c.x * 0.3, c.z * 0.3, 0)) + off) + (n_.z - 0.4) * 0.25
            tree = hh + 0.06 * mnoise.noise(Vector((c.x * 0.5, c.z * 0.5, 5)) + off)
            if snow > 0.68:
                col = k.blend("#cfdbe6", "#ffffff", min(1.0, max(0.0, n_.z + 0.4)))
            elif tree < 0.3:
                col = k.blend("#22402e", "#47683f", n_.z * 0.5 + 0.5)
            elif tree < 0.4:
                col = k.blend("#6f8a55", "#8fa468", n_.z * 0.5 + 0.5)
            else:
                col = k.blend("#4f5868", "#8a909c", n_.z * 0.5 + 0.5)
            haze = hex_blend = k.blend("#c9d6dc", "#c9d6dc", 1)
            del hex_blend
            return tuple(a + (b - a) * fade for a, b in zip(col, haze))

        k.paint(o, "#8f9498", jitter=0.03, per_vertex=True, fn=paint)
    k.anchor("next", g(L * 0.8, 0, 0))
    k.finish(ao=False)


BUILDERS = {f.__name__: f for f in (station_building, station_canopy, platform_paving, viaduct_arch, tunnel_portal, meadow_hill, broadleaf_tree, birch_tree, spruce_tall, hedgerow, signal_box, alps_backdrop)}
BUDGET = {"station_building": 7400, "station_canopy": 2400, "platform_paving": 2600, "viaduct_arch": 2200, "tunnel_portal": 2600, "meadow_hill": 1700, "broadleaf_tree": 3200, "birch_tree": 3200, "spruce_tall": 2600, "hedgerow": 1200, "signal_box": 4000, "alps_backdrop": 1400}
GROUND = {"platform_paving": -1.75, "viaduct_arch": -17.0, "tunnel_portal": -0.4, "meadow_hill": -0.3, "alps_backdrop": -1.0}
META = {"station_building": {"origin": "platform level (0.92 m above rail top), building centre", "front": "+z = platform side"}, "viaduct_arch": {"origin": "deck top / rail top, span centre", "tile": 14.0, "height": 17.0}}
