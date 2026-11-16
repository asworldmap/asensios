"""Chile v2 — "Between the Andes and the valley".

The arrival into Chile's central valley: an enormous snow wall, dry folded
foothills, a pale city basin in the haze, and in the foreground the valley
itself — vines, poplar windbreaks, an adobe farmhouse, thorn trees — seen
from a roadside lookout. Landscape types, not real places or monuments.
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

DRY = ("#8a7350", "#b09a6c", "#cdb98a")
SCRUB = ("#4f5a34", "#74803f", "#9aa256")
VINE = ("#2f5a2c", "#5c8a36", "#a3b84e")
POPLAR = ("#2c5a2e", "#5a8f3c", "#a8c257")
HAZE = "#d9cdbd"


def _range(k, name, L, layers, paint, depth=10.0, rows=8, n=46, smooth=14):
    r = k.rng
    off = Vector((r.random() * 30, r.random() * 30, 0))
    for li, (z, hmax, fade, rough) in enumerate(layers):
        bm = bmesh.new()
        crest = []
        for i in range(n + 1):
            t = i / n
            x = -L / 2 + L * t
            env = 0.35 + 0.65 * math.sin(t * math.pi) ** 0.45
            big = abs(mnoise.noise(Vector((x * 0.035 + li * 7, li * 2.0, 0)) + off))
            small = abs(mnoise.noise(Vector((x * 0.16, li * 1.0, 3)) + off))
            crest.append((x, max(1.0, hmax * env * (0.5 + 0.38 * big + rough * small))))
        grid = []
        for q in range(rows + 1):
            f = q / rows
            row = []
            for x, h in crest:
                spur = mnoise.noise(Vector((x * 0.13, li * 4.0, 5)) + off)  # ribs running down the face
                zz = z + depth * (1 - f) ** 1.2 + 2.6 * spur * math.sin(f * math.pi)
                row.append(bm.verts.new(g(x + 1.4 * spur * (1 - f), -1.0 + (h + 1.0) * f ** 1.15, zz)))
            grid.append(row)
        for q in range(rows):
            for i in range(n):
                bm.faces.new((grid[q][i], grid[q][i + 1], grid[q + 1][i + 1], grid[q + 1][i]))
        o = k.add(bm, name, "earth", smooth=smooth)
        hz = k.blend(HAZE, HAZE, 1)
        k.paint(o, "#8f8a80", jitter=0.025, per_vertex=True, fn=lambda c, n_, base, hmax=hmax, fade=fade: tuple(a + (b - a) * fade for a, b in zip(paint(c, n_, hmax, off), hz)))


def cordillera_backdrop(k):
    """The Andes as a wall: 78 m of it in two ranges, dry brown foot, violet
    rock, heavy snow. Scale 8–12 and stand it 700–1200 m out — it should fill
    a third of the sky."""

    def paint(c, n_, hmax, off):
        hh = c.z / hmax
        snow = hh + 0.12 * mnoise.noise(Vector((c.x * 0.25, c.z * 0.3, 0)) + off) + (n_.z - 0.35) * 0.3
        if snow > 0.54:
            return k.blend("#b9c8dc", "#ffffff", min(1.0, max(0.0, n_.z * 0.8 + 0.45)))
        if hh < 0.25:
            return k.blend(DRY[0], DRY[1], n_.z * 0.5 + 0.5)
        return k.blend("#5a5266", "#8f8794", n_.z * 0.5 + 0.5)

    _range(k, "cordillera", 78.0, ((0.0, 26.0, 0.0, 0.2), (-13.0, 38.0, 0.35, 0.3)), paint)
    k.anchor("next", g(62, 0, 0))
    k.finish(ao=False)


def foothill_ridge(k):
    """Precordillera: a dry, folded ridge 78 m long and 17 m high, ochre with
    olive scrub in the gullies. Scale 2–4, 150–400 m out, between valley and snow."""

    def paint(c, n_, hmax, off):
        gully = mnoise.noise(Vector((c.x * 0.13, 0.0, 5)) + off)
        scrub = mnoise.noise(Vector((c.x * 0.6, c.z * 0.6, 2)) + off)
        if gully < -0.12 or scrub > 0.38:
            return k.blend(SCRUB[0], SCRUB[1], n_.z * 0.5 + 0.5)
        return k.blend(DRY[0], DRY[2], min(1.0, max(0.0, n_.z * 0.7 + 0.3)))

    _range(k, "ridge", 78.0, ((0.0, 17.0, 0.0, 0.12),), paint, depth=16.0, rows=9, smooth=30)
    k.anchor("next", g(62, 0, 0))
    k.finish(ao=False)


def city_basin_backdrop(k):
    """A city lying in the valley haze under the mountains: 78 m of low pale
    blocks with a loose cluster of taller towers. Generic — no real building.
    Scale 5–8, 400–700 m out, in front of the foothills."""
    r = k.rng
    for li, (z, col, hmax) in enumerate(((0.0, "#b9ab98", 3.2), (-5.0, "#c4b8a6", 4.5), (-10.0, "#cfc5b6", 6.0))):
        x = -39.0
        while x < 37.0:
            w = 1.6 + r.random() * 3.2
            centre = math.exp(-((x + 6) / 13.0) ** 2)
            h = 0.8 + r.random() * hmax * 0.5 + (hmax * 2.6 * centre * r.random() ** 1.5 if li else 0)
            b = k.box("block", (w, 2.4, h), g(x + w / 2, h / 2 - 0.3, z), "stone")
            k.paint(b, col, jitter=0.03, fn=lambda c, n_, base, col=col: k.blend(HAZE, col, min(1.0, 0.55 + c.z / 14.0)))
            x += w + 0.15 + r.random() * 0.9
    for i in range(16):  # street trees as dark dots along the front edge
        A.clump(k, g(-38 + r.random() * 76, 0.5, 1.8 + r.random()), 0.7 + r.random() * 0.5, tones=("#55654a", "#6f8058", "#8f9c6c"), subdiv=1, scale=(1.3, 1, 0.7), noise=0.1, sway=lambda co: 0.0)
    k.finish(ao=False, ground=False)


def vineyard_rows(k):
    """20 x 20 m of vineyard on trellis: nine rows of vines with end posts and
    wires over raked ochre earth. Tile on next_x / next_z; rows run along z."""
    r = k.rng
    k.paint(k.box("earth", (20.0, 20.0, 0.3), g(0, -0.13, 0), "earth"), DRY[1], jitter=0.03)
    sway = lambda co: min(1.0, max(0.0, (co.z - 0.5) / 1.3)) * 0.45
    for i in range(9):
        x = -8.8 + i * 2.2
        k.paint(k.box("furrow", (0.9, 20.0, 0.05), g(x, 0.03, 0), "earth"), DRY[0], jitter=0.04)
        for z in (-9.6, 0.0, 9.6):
            k.paint(k.box("post", (0.09, 0.09, 1.7), g(x, 0.85, z), "wood"), "#7a6650", jitter=0.06)
        for y in (0.9, 1.5):
            k.paint(k.tube("wire", [g(x, y, -9.6), g(x, y, 9.6)], 0.012, "metal", seg=3, cap=False), "#8f979c", jitter=0)
        z = -9.2
        while z < 9.2:
            ln = 1.5 + r.random() * 0.8
            A.clump(k, g(x + (r.random() - 0.5) * 0.15, 1.2 + r.random() * 0.15, z + ln / 2), 0.62, tones=VINE, sway=sway, subdiv=1, scale=(0.75, ln / 1.0, 1.0), noise=0.22, freq=2.0, name="vine")
            z += ln + 0.1
    k.anchor("next_x", g(20, 0, 0))
    k.anchor("next_z", g(0, 0, 20))
    k.finish(ao_strength=0.7, ao_samples=32)


def poplar_row(k):
    """A windbreak of five tall poplars, 16 m long: the vertical accent of the
    central valley, planted along roads and field edges. Runs along z."""
    r = k.rng
    for i in range(5):
        z = -6.4 + i * 3.2 + (r.random() - 0.5) * 0.6
        x = (r.random() - 0.5) * 0.5
        h = 14.0 + r.random() * 4.0
        A.trunk(k, [g(x, -0.3, z), g(x, h * 0.3, z)], 0.24, 0.12, bark=("#5a5248", "#8a8274"), seg=6)
        n, seg = 9, 8
        ph = r.random() * 6
        rings = []
        for q in range(n + 1):
            t = q / n
            rad = (0.25 + 1.25 * math.sin(min(1.0, t * 1.25) * math.pi) ** 0.7 * (1 - t * 0.35)) * (0.9 + r.random() * 0.2)
            y = 1.6 + (h - 1.6) * t
            rings.append([g(x + math.cos(a) * rad * (1 + 0.22 * math.sin(a * 3 + q * 1.7 + ph)), y, z + math.sin(a) * rad * (1 + 0.22 * math.cos(a * 2 + q + ph))) for a in [j / seg * math.tau for j in range(seg)]])
        rings[-1] = [g(x, h + 0.4, z) + (p - g(x, h + 0.4, z)) * 0.15 for p in rings[-1]]
        o = k.loft("crown", rings, "foliage", cap=(True, True), smooth=70)
        k.paint(o, POPLAR[1], jitter=0.07, per_vertex=True, sway=lambda co, h=h: min(1.0, max(0.0, co.z / h) ** 1.5 * 0.7),
                fn=lambda c, n_, base: k.blend(POPLAR[0], POPLAR[2], min(1.0, max(0.0, 0.4 + n_.z * 0.5 + n_.x * 0.25 + 0.2 * mnoise.noise(Vector((c.x, c.y, c.z * 0.6)))))))
        k.collider(x, -z, 0.35)
    k.anchor("next", g(0, 0, 16))
    k.finish(ao_strength=0.7, ao_samples=48)


def espino_tree(k):
    """Espino: the small flat-topped thorn tree of the dry central hills —
    twisted dark trunk, a thin layered crown."""
    r = k.rng
    tones = ("#3f4a2c", "#6a7a3c", "#9aa456")
    sway = lambda co: min(1.0, max(0.0, (co.z - 1.5) / 2.5) * 0.4)
    A.trunk(k, [g(0, -0.2, 0), g(0.25, 0.9, 0.1), g(-0.1, 1.9, 0)], 0.2, 0.13, bark=("#2f2a24", "#5a5044"), seg=6)
    for i in range(5):
        a = i / 5 * math.tau + r.random()
        reach = 1.5 + r.random() * 0.9
        tip = g(math.cos(a) * reach, 3.0 + r.random() * 0.5, math.sin(a) * reach)
        A.trunk(k, [g(-0.1, 1.8, 0), g(math.cos(a) * reach * 0.5, 2.5, math.sin(a) * reach * 0.5), tip], 0.09, 0.03, bark=("#2f2a24", "#5a5044"), seg=4, name="branch")
        A.clump(k, tip + Vector((0, 0, 0.25)), 1.0 + r.random() * 0.4, tones=tones, sway=sway, subdiv=2, scale=(1.35, 1.35, 0.32), noise=0.25, freq=2.0)
    A.clump(k, g(0, 3.7, 0), 1.3, tones=tones, sway=sway, subdiv=2, scale=(1.4, 1.4, 0.3), noise=0.25, freq=2.0)
    k.collider(0, 0, 0.35)
    k.finish(ao_strength=0.7, ao_samples=32)


def adobe_house(k):
    """A central-valley farmhouse: long, low, thick whitewashed adobe under a
    clay-tile roof that runs out over a timber-posted corridor along the
    front (+z). One storey, 14 x 6 m."""
    W, D, Hh = 14.0, 6.0, 3.3
    col = "#efe4cf"
    A.shell(k, W, D, Hh, col, seed=8.0, cell=0.9, grime=1.2)
    k.paint(k.box("dado", (W + 0.06, D + 0.06, 0.9), g(0, 0.45, 0), "plaster"), "#a8553d", jitter=0.06)
    rise = A.tile_roof(k, W, D + 3.2, Hh + 0.05, rise=2.3, oz=1.0, courses=2, tile=0.46)
    A.gable_walls(k, W, D, Hh, rise * 0.85, col, seed=8.0)
    fs = A.faces_of(W, D)
    yaw, put, _ = fs["front"]
    A.door(k, put, yaw, 0.0, w=1.3, h=2.3, color="#3f6a5a", arch=False, step=False)
    for u in (-4.6, -2.3, 2.3, 4.6):
        A.window(k, put, yaw, u, 1.0, w=0.95, h=1.4, shutters="#3f6a5a", pots=False, detail=1)
    yawb, putb, _ = fs["back"]
    for u in (-4.0, 0.0, 4.0):
        A.window(k, putb, yawb, u, 1.1, w=0.9, h=1.2, shutters=None, pots=False, detail=0)
    k.paint(k.box("corridor_floor", (W + 0.4, 2.6, 0.2), g(0, 0.1, D / 2 + 1.3), "stone"), "#b8866a", jitter=0.06)
    for i in range(6):
        x = -W / 2 + 0.3 + i * (W - 0.6) / 5
        k.paint(k.bbox("post", (0.2, 0.2, 2.75), g(x, 0.2 + 1.37, D / 2 + 2.4), "wood", bevel=0.03, seg=1), A.WOOD, jitter=0.07)
        k.paint(k.box("post_base", (0.36, 0.36, 0.3), g(x, 0.35, D / 2 + 2.4), "stone"), A.STONE, jitter=0.06)
        k.paint(k.box("bracket", (0.9, 0.14, 0.14), g(x, 2.9, D / 2 + 2.4), "wood"), A.WOOD, jitter=0.07)
        k.collider(x, -(D / 2 + 2.4), 0.16)
    k.paint(k.box("plate", (W + 0.2, 0.18, 0.2), g(0, 3.05, D / 2 + 2.4), "wood"), A.WOOD, jitter=0.07)
    # Life on the corridor: a bench, clay jars, a hanging plant.
    k.paint(k.box("bench", (2.2, 0.45, 0.08), g(-3.4, 0.65, D / 2 + 0.5), "wood"), A.WOOD_LIGHT, jitter=0.06)
    for x in (-4.3, -2.5):
        k.paint(k.box("bench_leg", (0.08, 0.4, 0.45), g(x, 0.42, D / 2 + 0.5), "wood"), A.WOOD, jitter=0.06)
    for x, s in ((3.4, 1.0), (4.2, 0.75), (5.5, 0.9)):
        k.paint(k.sphere("jar", 0.36 * s, g(x, 0.2 + 0.38 * s, D / 2 + 0.6), "terracotta", subdiv=2, scale=(1, 1, 1.25), smooth=60), "#b5673f", jitter=0.06)
    A.flower_pot(k, (1.4, 0.2, D / 2 + 0.45), r=0.24, flower="#d8452f")
    k.paint(k.box("chimney", (0.7, 0.7, 1.6), g(-4.5, Hh + 1.7, -1.0), "plaster"), col, jitter=0.05)
    k.anchor("door", g(0, 0.2, D / 2 + 1.2), kind="poi")
    k.anchor("label_sign", g(*put(2.3, 2.75, 0.08)), kind="label")
    k.anchor("seat", g(-3.4, 0.7, D / 2 + 0.5), kind="seat", facing="+z")
    for a, b in (((-W / 2, -D / 2), (W / 2, -D / 2)), ((-W / 2, D / 2), (W / 2, D / 2)), ((-W / 2, -D / 2), (-W / 2, D / 2)), ((W / 2, -D / 2), (W / 2, D / 2))):
        k.wall((a[0], -a[1]), (b[0], -b[1]), 0.25)
    k.finish(ao_strength=0.85, ao_samples=64)


def lookout_terrace(k):
    """Roadside mirador: a half-round stone terrace with a parapet, timber
    rail, an orientation board and a bench. The open side (+z) faces the view;
    the flat side (-z) meets the road."""
    Rr = 6.0
    seg = 14
    arc = [(math.cos(a) * Rr, math.sin(a) * Rr) for a in [math.pi * i / seg for i in range(seg + 1)]]
    bm = bmesh.new()
    top = [bm.verts.new(g(x, 0.0, z)) for x, z in arc]
    bot = [bm.verts.new(g(x * 1.08, -3.0, z * 1.08)) for x, z in arc]
    bm.faces.new(top[::-1])
    for i in range(seg):
        bm.faces.new((top[i], top[i + 1], bot[i + 1], bot[i]))
    o = k.add(bm, "terrace", "stone", smooth=0)
    k.paint(o, A.STONE, jitter=0.08, fn=lambda c, n_, base: k.blend("#cbb98f", A.STONE, 1.0 if n_.z < 0.5 else 0.0))
    for i in range(seg):
        (x0, z0), (x1, z1) = arc[i], arc[i + 1]
        mx, mz = (x0 + x1) / 2 * 0.97, (z0 + z1) / 2 * 0.97
        ln = math.hypot(x1 - x0, z1 - z0)
        yaw = math.atan2(x1 - x0, z1 - z0)
        b = k.box("parapet", (0.45, ln + 0.05, 0.75), g(mx, 0.375, mz), "stone", rot_z=yaw)
        k.paint(b, A.STONE, jitter=0.1, fn=A.stone_tone(k))
        k.wall((x0 * 0.97, -z0 * 0.97), (x1 * 0.97, -z1 * 0.97), 0.25)
    P.railing(k, [(x * 0.97, 0.75, z * 0.97) for x, z in arc], h=0.4, post=2.2, color=A.WOOD, rails=1)
    # Orientation board on a stone plinth, tilted toward the reader.
    k.paint(k.bbox("plinth", (1.9, 0.6, 0.85), g(0, 0.42, 4.1), "stone", bevel=0.05, seg=1), A.STONE, jitter=0.08, fn=A.stone_tone(k))
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in (g(-0.85, 0.87, 3.8), g(0.85, 0.87, 3.8), g(0.85, 1.12, 4.38), g(-0.85, 1.12, 4.38))]
    bm.faces.new(vs)
    board = k.add(bm, "board", "paint")
    board.data.materials[0].use_backface_culling = False
    k.paint(board, "#f1ead8", jitter=0.02)
    k.anchor("label_board", g(0, 1.0, 4.1), kind="label", width=1.6, height=0.6, note="orientation / project panel, tilted 23 deg")
    for y, zz, hh in ((0.45, 1.2, 0.07), (0.8, 0.98, 0.3)):
        k.paint(k.box("bench", (2.2, 0.45 if hh < 0.1 else 0.06, hh), g(-2.6, y, zz), "wood"), A.WOOD_LIGHT, jitter=0.06)
    for x in (-3.5, -1.7):
        k.paint(k.box("bench_leg", (0.1, 0.4, 0.45), g(x, 0.22, 1.2), "stone"), A.STONE, jitter=0.05)
    A.paving(k, 11.0, 5.2, 0.02, cell=0.8, oz=2.7, tones=("#cdbb93", "#c2b088", "#d6c69f", "#b9a67d")) if False else None
    k.anchor("view", g(0, 1.65, 3.2), kind="camera", note="looks along +z")
    k.anchor("seat", g(-2.6, 0.5, 1.2), kind="seat", facing="+z")
    k.anchor("poi", g(0, 0, 2.0), kind="poi")
    k.finish(ao_strength=0.8, ao_samples=48, ground=False)


BUILDERS = {f.__name__: f for f in (cordillera_backdrop, foothill_ridge, city_basin_backdrop, vineyard_rows, poplar_row, espino_tree, adobe_house, lookout_terrace)}
BUDGET = {"cordillera_backdrop": 1800, "foothill_ridge": 1000, "city_basin_backdrop": 1600, "vineyard_rows": 3600, "poplar_row": 1400, "espino_tree": 1400, "adobe_house": 6500, "lookout_terrace": 1600}
GROUND = {"cordillera_backdrop": -1.0, "foothill_ridge": -1.0, "city_basin_backdrop": -0.3, "lookout_terrace": -3.0, "vineyard_rows": -0.28}
META = {"vineyard_rows": {"tile": 20.0, "rows": "along z"}}
