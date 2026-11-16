"""Asia v2 — "Arrival".

A modern airport at first light: the set for the existing airliner's arrival.
Kept deliberately contemporary and neutral — an airport is the same honest
architecture everywhere — with a hazy generic skyline and one broad shade
tree. No national symbols, no real buildings.
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

CONCRETE = "#c9c6bd"
CONCRETE_DARK = "#a9a69c"
GLASS = "#2c4a5a"
WHITE = "#f0eee8"
STEEL = "#8f979c"
YELLOW = "#f2c230"
ORANGE = "#e8662a"


def control_tower(k):
    """Control tower, 31 m: fluted concrete shaft flaring to a glazed cab with
    outward-leaning windows, walkway, roof radar and beacon."""
    seg = 12
    prof = [(0.0, 3.4), (2.0, 2.9), (8.0, 2.5), (18.0, 2.4), (21.5, 2.9), (23.5, 4.3)]
    rings = [[g(math.cos(a) * rad * (1.0 if i % 2 else 0.93), y, math.sin(a) * rad * (1.0 if i % 2 else 0.93)) for i, a in enumerate([j / (seg * 2) * math.tau for j in range(seg * 2)])] for y, rad in prof]
    shaft = k.loft("shaft", rings, "stone", cap=(False, True), smooth=25)
    k.paint(shaft, CONCRETE, jitter=0.02, per_vertex=True, fn=lambda c, n_, base: k.blend("#9a968b", CONCRETE, 0.45 + 0.55 * (0.5 + 0.5 * mnoise.noise(Vector((math.atan2(c.y, c.x) * 4, c.z * 0.18, 0))))))
    for y in (5.0, 9.0, 13.0, 17.0):
        P.panel(k, "slot", 0.5, 1.6, (0, y, 2.52), "window", GLASS, yaw=math.pi / 2, depth=0.08, bevel=0.0)
    k.paint(k.cylinder("walkway", 5.0, 0.25, g(0, 23.5, 0), "stone", seg=16), CONCRETE_DARK, jitter=0.03)
    ring = [(math.cos(a) * 4.85, 23.75, math.sin(a) * 4.85) for a in [i / 16 * math.tau for i in range(17)]]
    P.railing(k, ring, h=1.0, post=1.9, color=STEEL)
    n = 12
    lo = [g(math.cos(a) * 3.5, 23.75, math.sin(a) * 3.5) for a in [i / n * math.tau for i in range(n)]]
    mid = [g(math.cos(a) * 3.6, 24.7, math.sin(a) * 3.6) for a in [i / n * math.tau for i in range(n)]]
    hi = [g(math.cos(a) * 4.3, 27.3, math.sin(a) * 4.3) for a in [i / n * math.tau for i in range(n)]]
    k.paint(k.loft("cab_sill", [lo, mid], "paint", cap=(False, False), smooth=0), WHITE, jitter=0.02)
    k.paint(k.loft("cab_glass", [mid, hi], "window", cap=(False, False), smooth=0), "#3f6f84", jitter=0.03)
    for i in range(n):
        k.paint(k.tube("mullion", [mid[i], hi[i]], 0.05, "metal", seg=4), WHITE, jitter=0)
    k.paint(k.cylinder("cab_roof", 4.7, 0.45, g(0, 27.3, 0), "paint", seg=n, r_top=4.4), WHITE, jitter=0.02)
    k.paint(k.cylinder("plant", 1.6, 1.0, g(0, 27.75, 0), "metal", seg=8), STEEL, jitter=0.03)
    k.paint(k.tube("mast", [g(0, 28.7, 0), g(0, 32.4, 0)], 0.06, "metal", seg=5), WHITE, jitter=0)
    k.paint(k.bbox("radar", (2.6, 0.2, 0.8), g(0, 29.6, 0), "metal", bevel=0.05, seg=1), ORANGE, jitter=0.02)
    k.paint(k.sphere("beacon", 0.2, g(0, 32.5, 0), "glow", subdiv=1, smooth=60), "#ff5a4a", jitter=0)
    for a in (0.8, 2.6, 4.4):
        k.paint(k.tube("aerial", [g(math.cos(a) * 3.6, 27.7, math.sin(a) * 3.6), g(math.cos(a) * 3.6, 30.0, math.sin(a) * 3.6)], 0.03, "metal", seg=3), STEEL, jitter=0)
    A.shell(k, 12.0, 8.0, 4.2, WHITE, oz=-5.0, seed=4.0, cell=1.2, name="base_block", grime=0.5)
    for name, (yaw, put, fw) in A.faces_of(12.0, 8.0, 0, -5.0).items():
        if name != "front":
            P.panel(k, "ribbon", fw - 1.2, 1.1, put(0, 2.6, 0.02), "window", GLASS, yaw=yaw, depth=0.05, bevel=0.0)
    k.paint(k.bbox("base_roof", (12.5, 8.5, 0.3), g(0, 4.35, -5.0), "stone", bevel=0.06, seg=1), CONCRETE_DARK, jitter=0.03)
    k.collider(0, 0, 3.6)
    k.wall((-6, 9), (6, 9), 0.3)
    k.anchor("beacon", g(0, 32.5, 0), kind="lamp", color="#ff5a4a")
    k.anchor("cab_view", g(0, 25.6, 0), kind="camera")
    k.anchor("radar", g(0, 29.6, 0), kind="spin", note="rotate about y, 12 rpm, if loaded un-batched")
    k.finish(ao_strength=0.8, ao_samples=64)


def terminal_hall(k):
    """Arrivals hall, 40 x 16 m: a long wave roof on raking columns over a full
    glass front. Glass side faces +z (the apron or the forecourt)."""
    W, D = 40.0, 16.0
    nx, nz = 20, 10
    bm = bmesh.new()

    def roof_y(x, z):
        t = (z + D / 2 + 2) / (D + 5)
        return 6.2 + 4.2 * math.sin(t * math.pi * 0.85) ** 1.3 + 0.5 * math.sin(x * 0.32)

    grid = [[bm.verts.new(g(-W / 2 - 1 + (W + 2) * i / nx, roof_y(-W / 2 + W * i / nx, z), z)) for i in range(nx + 1)] for z in [-D / 2 - 2 + (D + 5) * j / nz for j in range(nz + 1)]]
    for j in range(nz):
        for i in range(nx):
            bm.faces.new((grid[j][i], grid[j + 1][i], grid[j + 1][i + 1], grid[j][i + 1]))
    roof = k.add(bm, "roof", "metal", smooth=60)
    roof.data.materials[0].use_backface_culling = False
    k.paint(roof, WHITE, jitter=0.015, per_vertex=True, fn=lambda c, n_, base: k.blend("#b9c2c6", WHITE, 0.5 + 0.5 * math.sin(c.x * 3.14)))
    k.paint(k.tube("roof_edge", [g(-W / 2 - 1 + (W + 2) * i / nx, roof_y(-W / 2 + W * i / nx, D / 2 + 3) - 0.05, D / 2 + 3) for i in range(nx + 1)], 0.16, "metal", seg=5), STEEL, jitter=0)
    A.shell(k, W, D, 6.0, WHITE, seed=5.0, cell=2.0, grime=0.4)
    bays = 10
    bw = W / bays
    for i in range(bays):
        x = -W / 2 + (i + 0.5) * bw
        top = roof_y(x, D / 2) - 0.25
        P.panel(k, "glass", bw - 0.16, top - 0.5, (x, 0.5 + (top - 0.5) / 2, D / 2 + 0.03), "window", GLASS if i % 2 else "#35586a", yaw=math.pi / 2, depth=0.06, bevel=0.0)
        P.panel(k, "transom", bw, 0.1, (x, 3.3, D / 2 + 0.08), "metal", WHITE, yaw=math.pi / 2, depth=0.08, bevel=0.0)
    for i in range(bays + 1):
        x = -W / 2 + i * bw
        top = roof_y(x, D / 2 + 2.6)
        k.paint(k.tube("column", [g(x, 0, D / 2 + 1.2), g(x, top - 0.1, D / 2 + 2.6)], 0.16, "metal", seg=7, r_end=0.1), WHITE, jitter=0)
        k.paint(k.tube("mullion", [g(x, 0.2, D / 2 + 0.08), g(x, roof_y(x, D / 2) - 0.2, D / 2 + 0.08)], 0.06, "metal", seg=4), WHITE, jitter=0)
        k.collider(x, -(D / 2 + 1.2), 0.2)
    for x in (-10.0, 10.0):
        P.panel(k, "door_frame", 3.2, 2.7, (x, 1.35, D / 2 + 0.1), "metal", STEEL, yaw=math.pi / 2, depth=0.1, bevel=0.02)
        P.panel(k, "door_glass", 2.9, 2.4, (x, 1.25, D / 2 + 0.16), "glow", "#ffe9b8", yaw=math.pi / 2, depth=0.03, bevel=0.0)
        k.anchor(f"door_{'a' if x < 0 else 'b'}", g(x, 0, D / 2 + 1.5), kind="poi")
    P.panel(k, "sign", 9.0, 1.0, (0, 5.0, D / 2 + 0.14), "paint", "#1f3a4a", yaw=math.pi / 2, depth=0.08, bevel=0.03)
    k.anchor("label_sign", g(0, 5.0, D / 2 + 0.22), kind="label", width=8.6, height=0.8)
    k.paint(k.box("plinth", (W + 0.3, D + 0.3, 0.5), g(0, 0.25, 0), "stone"), CONCRETE_DARK, jitter=0.03)
    for a, b in (((-W / 2, -D / 2), (W / 2, -D / 2)), ((-W / 2, D / 2), (W / 2, D / 2)), ((-W / 2, -D / 2), (-W / 2, D / 2)), ((W / 2, -D / 2), (W / 2, D / 2))):
        k.wall((a[0], -a[1]), (b[0], -b[1]), 0.25)
    k.finish(ao_strength=0.8, ao_samples=64)


def apron_tile(k):
    """20 x 20 m of apron: cast concrete bays with dark joints, tyre marks and
    a yellow lead-in line along z. Sink 3 cm; tile on next_x / next_z."""
    A.paving(k, 20.0, 20.0, 0.0, cell=5.0, tones=("#b9b7ae", "#b0aea5", "#c1bfb6", "#a9a79e"))
    k.paint(k.box("lead_in", (0.3, 20.0, 0.012), g(0, 0.075, 0), "paint"), YELLOW, jitter=0.03)
    for z in (-7.5, 2.5):
        k.paint(k.box("stop_bar", (2.4, 0.3, 0.012), g(0, 0.075, z), "paint"), YELLOW, jitter=0.03)
    r = k.rng
    for i in range(5):
        x = (r.random() - 0.5) * 14
        k.paint(k.box("tyre_mark", (0.28, 5 + r.random() * 8, 0.01), g(x, 0.072, (r.random() - 0.5) * 6), "rubber"), "#a5a39a", jitter=0.02)
    k.anchor("next_x", g(20, 0, 0))
    k.anchor("next_z", g(0, 0, 20))
    k.finish(ao=False)


def _wheel(k, x, y, z, r=0.42, w=0.3):
    k.paint(k.cylinder("tyre", r, w, g(x - w / 2, y, z), "rubber", seg=10, axis="x"), "#26262a", jitter=0.03)
    k.paint(k.cylinder("hub", r * 0.5, w + 0.02, g(x - w / 2 - 0.01, y, z), "metal", seg=8, axis="x"), "#c9c6bd", jitter=0)


def airstairs(k):
    """Mobile passenger stairs on a truck chassis: top landing at 3.55 m, the
    same sill as the jet bridge. Stairs climb toward +x; park the landing
    against the aircraft door."""
    k.paint(k.bbox("chassis", (6.4, 2.0, 0.5), g(-0.4, 0.75, 0), "paint", bevel=0.06, seg=1), WHITE, jitter=0.02)
    k.paint(k.bbox("cab", (1.5, 1.9, 1.3), g(-2.9, 1.6, 0), "paint", bevel=0.12, seg=2), WHITE, jitter=0.02)
    P.panel(k, "windscreen", 1.6, 0.7, (-3.67, 1.85, 0), "window", GLASS, yaw=math.pi, depth=0.04, bevel=0.0)
    for x in (-2.6, 1.6):
        for z in (-0.95, 0.95):
            _wheel(k, x, 0.42, z)
    for z in (-0.9, 0.9):
        k.paint(k.box("skirt", (6.4, 0.06, 0.14), g(-0.4, 0.5, z), "paint"), ORANGE, jitter=0.02)
    P.stairs(k, (-2.0, 1.0, 0), (2.6, 3.55, 0), 1.3, 14, color=STEEL)
    for z in (-0.72, 0.72):
        P.railing(k, [(-2.0, 1.0, z), (2.6, 3.55, z), (4.0, 3.55, z)], h=1.05, post=1.2, color=WHITE)
        bm = bmesh.new()
        vs = [bm.verts.new(v) for v in (g(-1.9, 1.1, z), g(2.6, 3.6, z), g(4.0, 3.6, z), g(4.0, 4.5, z), g(2.6, 4.5, z), g(-1.9, 2.0, z))]
        bm.faces.new(vs)
        side = k.add(bm, "side_panel", "paint")
        side.data.materials[0].use_backface_culling = False
        k.paint(side, WHITE, jitter=0.02, fn=lambda c, n_, base: k.blend(ORANGE, WHITE, 0.0 if (c.z - c.x * 0.55) < 2.0 and (c.z - c.x * 0.55) > 1.75 else 1.0))
    k.paint(k.box("landing", (1.4, 1.5, 0.08), g(3.3, 3.51, 0), "metal"), STEEL, jitter=0.03)
    for z in (-0.6, 0.6):
        k.paint(k.tube("prop", [g(3.2, 0.9, z), g(3.5, 3.45, z)], 0.07, "metal", seg=5), STEEL, jitter=0)
    k.paint(k.sphere("beacon", 0.1, g(-2.9, 2.32, 0), "glow", subdiv=1, smooth=60), "#ffb02e", jitter=0)
    k.collider(-2.0, 0, 1.2)
    k.collider(0.5, 0, 1.2)
    k.collider(3.0, 0, 1.0)
    k.anchor("top", g(4.0, 3.55, 0), kind="boarding", note="meets the airliner's door_front (sill 3.55 m)")
    k.anchor("foot", g(-2.3, 0, 0), kind="boarding")
    k.finish(ao_strength=0.8, ao_samples=48)


def pushback_tug(k):
    """Aircraft tug: a low, heavy slab on four big wheels with a small offset
    cab, tow bar and amber beacon. Nose toward +z."""
    body = k.bbox("body", (2.5, 4.8, 0.75), g(0, 0.85, 0), "paint", bevel=0.14, seg=2)
    k.paint(body, WHITE, jitter=0.02, per_vertex=True, fn=lambda c, n_, base: k.blend(YELLOW, WHITE, 0.0 if c.z < 0.72 else 1.0))
    k.paint(k.bbox("cab", (1.2, 1.3, 0.85), g(-0.55, 1.62, -0.6), "paint", bevel=0.1, seg=2), WHITE, jitter=0.02)
    for name, (yaw, put, fw) in A.faces_of(1.2, 1.3, -0.55, -0.6).items():
        P.panel(k, "cab_glass", fw - 0.25, 0.45, put(0, 1.72, 0.01), "window", GLASS, yaw=yaw, depth=0.03, bevel=0.0)
    for x in (-1.2, 1.2):
        for z in (-1.5, 1.5):
            _wheel(k, x + (0.18 if x > 0 else -0.18) + 0.18, 0.55, z, r=0.55, w=0.36)
    k.paint(k.tube("tow_bar", [g(0, 0.5, 2.4), g(0, 0.5, 5.6)], 0.06, "metal", seg=5), ORANGE, jitter=0)
    k.paint(k.box("hitch", (0.3, 0.3, 0.2), g(0, 0.5, 2.45), "metal"), STEEL, jitter=0)
    k.paint(k.sphere("beacon", 0.11, g(-0.55, 2.12, -0.6), "glow", subdiv=1, smooth=60), "#ffb02e", jitter=0)
    for x in (-0.9, 0.9):
        k.paint(k.sphere("lamp", 0.1, g(x, 0.95, 2.38), "glow", subdiv=1, smooth=60), "#fff2c8", jitter=0)
    k.anchor("beacon", g(-0.55, 2.12, -0.6), kind="lamp", color="#ffb02e")
    k.anchor("tow", g(0, 0.5, 5.6), kind="placement", note="tow bar end: aircraft nose wheel")
    k.collider(0, 1.2, 1.5)
    k.collider(0, -1.2, 1.5)
    k.finish(ao_strength=0.8, ao_samples=48)


def windsock(k):
    """Windsock on a hinged mast: orange and white, swaying."""
    k.paint(k.tube("mast", [g(0, 0, 0), g(0, 6.2, 0)], 0.07, "metal", seg=6, r_end=0.045), WHITE, jitter=0)
    k.paint(k.cylinder("foot", 0.35, 0.12, g(0, 0, 0), "stone", seg=8), CONCRETE, jitter=0.03)
    for i in range(3):
        k.paint(k.cylinder("band", 0.075, 0.5, g(0, 1.0 + i * 1.6, 0), "paint", seg=6), ORANGE, jitter=0)
    n = 5
    rings = [[g(0.15 + q * 0.55, 6.0 - q * 0.09 + math.sin(a) * (0.42 - q * 0.05), math.cos(a) * (0.42 - q * 0.05)) for a in [i / 8 * math.tau for i in range(8)]] for q in range(n + 1)]
    sock = k.loft("sock", rings, "cloth", cap=(False, False), smooth=60)
    sock.data.materials[0].use_backface_culling = False
    k.paint(sock, ORANGE, jitter=0.02, sway=lambda co: min(1.0, max(0.0, co.x / 2.9)), fn=lambda c, n_, base: k.blend(WHITE, ORANGE, 1.0 if int((c.x - 0.15) / 0.55 + 0.01) % 2 == 0 else 0.0))
    k.paint(k.sphere("lamp", 0.07, g(0, 6.3, 0), "glow", subdiv=1, smooth=60), "#ff5a4a", jitter=0)
    k.collider(0, 0, 0.3)
    k.finish(ao=False)


def rain_tree(k):
    """A broad umbrella-crowned shade tree, 20 m across — the tree of airport
    avenues and car parks across the warm half of the continent."""
    r = k.rng
    tones = ("#1f4a2c", "#3f7a3a", "#86b04e")
    sway = lambda co: min(1.0, max(0.0, (co.z - 4.0) / 6.0) * 0.5 + 0.06)
    A.trunk(k, [g(0, -0.3, 0), g(0.15, 2.4, 0.1), g(0, 4.6, 0)], 0.65, 0.42, bark=("#3a3028", "#6a5a4a"), seg=8)
    k.paint(k.sphere("buttress", 1.0, g(0, 0.1, 0), "wood", subdiv=2, scale=(1, 1, 0.45), noise=0.3, smooth=60), "#44392f", jitter=0.08)
    for i in range(7):
        a = i / 7 * math.tau + r.random() * 0.4
        reach = 6.0 + r.random() * 2.5
        tip = g(math.cos(a) * reach, 8.2 + r.random() * 0.8, math.sin(a) * reach)
        A.trunk(k, [g(0, 4.2, 0), g(math.cos(a) * reach * 0.4, 6.6, math.sin(a) * reach * 0.4), tip], 0.26, 0.07, bark=("#3a3028", "#6a5a4a"), seg=5, name="bough")
        for q in range(3):
            f = 0.55 + q * 0.3
            at = g(math.cos(a) * reach * f + (r.random() - 0.5) * 1.5, 8.6 + (1 - abs(f - 0.8)) * 1.2 + r.random() * 0.5, math.sin(a) * reach * f + (r.random() - 0.5) * 1.5)
            A.clump(k, at, 2.2 + r.random() * 0.8, tones=tones, sway=sway, subdiv=2, scale=(1.4, 1.4, 0.42), noise=0.2, freq=1.2)
    A.clump(k, g(0, 10.2, 0), 3.6, tones=tones, sway=sway, subdiv=3, scale=(1.5, 1.5, 0.4), noise=0.18, freq=1.0)
    k.collider(0, 0, 0.9)
    k.anchor("shade", g(0, 0, 0), kind="placement", radius=9.0)
    k.finish(ao_strength=0.75, ao_samples=48)


def skyline_backdrop(k):
    """A far modern skyline, 78 m of it, in three hazy depths. Generic slabs,
    setbacks and a few masts — no recognisable building. Scale 5–8, 600–1000 m out."""
    r = k.rng
    for li, (z, col, hmin, hmax, n) in enumerate(((0.0, "#7d909f", 5, 17, 20), (-6.0, "#94a6b3", 9, 28, 15), (-12.0, "#aebcc6", 12, 36, 9))):
        x = -38.0
        while x < 36.0:
            w = 2.2 + r.random() * 3.6
            h = hmin + (hmax - hmin) * r.random() ** (1.6 if li else 1.0)
            b = k.box("block", (w, 3.0, h), g(x + w / 2, h / 2 - 0.5, z), "stone")
            k.paint(b, col, jitter=0.02, fn=lambda c, n_, base, col=col: k.blend("#c9d3d9", col, min(1.0, 0.45 + c.z / 30.0)))
            if h > hmax * 0.6 and r.random() < 0.6:
                k.paint(k.box("setback", (w * 0.55, 2.0, h * 0.18), g(x + w / 2, h * 1.09 - 0.5, z), "stone"), col, jitter=0.02)
                if r.random() < 0.5:
                    k.paint(k.tube("mast", [g(x + w / 2, h * 1.18 - 0.5, z), g(x + w / 2, h * 1.18 + 3.5, z)], 0.07, "metal", seg=3), col, jitter=0)
            if li == 0 and r.random() < 0.5:
                for q in range(int(h / 1.6)):
                    P.panel(k, "lit", w * 0.7, 0.18, (x + w / 2, 1.0 + q * 1.6, z + 1.52), "glow", "#ffe2a8", yaw=math.pi / 2, depth=0.02, bevel=0.0)
            x += w + 0.3 + r.random() * 1.6 * (li + 1) / 2
    k.finish(ao=False, ground=False)


BUILDERS = {f.__name__: f for f in (control_tower, terminal_hall, apron_tile, airstairs, pushback_tug, windsock, rain_tree, skyline_backdrop)}
BUDGET = {"control_tower": 3200, "terminal_hall": 4200, "apron_tile": 800, "airstairs": 2600, "pushback_tug": 1800, "windsock": 500, "rain_tree": 3600, "skyline_backdrop": 2600}
GROUND = {"skyline_backdrop": -0.5}
META = {"airstairs": {"sill": 3.55}, "apron_tile": {"tile": 20.0}}
