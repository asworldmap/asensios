"""Maritime v2 — "The Ocean Journey".

A small working port and the coast around it, as a stage for the existing ship.
Deliberately generic: timber, white paint, signal red, pines on rock. No real
port, no national symbols.

Levels follow the existing kit: y = 0 is the WATERLINE, quay and pier decks are
at y = 1.6 (same as maritime/quay_section).
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

DECK = 1.6
TIMBER = ("#6f5a45", "#8d7458", "#a48a6a")
WHITE = "#f1ede2"
RED = "#b8432f"
NAVY = "#27405a"
ROCK = ("#55524c", "#7a756b", "#a09a8c")
PINE = ("#1f3b2a", "#3a6240", "#6f9458")


def plank_deck(k, w, l, y, ox=0.0, oz=0.0, along="x", board=0.34):
    """Deck boards laid across the walking direction, each its own tone, with gaps."""
    r = k.rng
    n = int((l if along == "x" else w) / board)
    for i in range(n):
        t = -((l if along == "x" else w) / 2) + (i + 0.5) * board
        size = (w, board - 0.03, 0.07) if along == "x" else (board - 0.03, l, 0.07)
        at = g(ox, y - 0.035, oz + t) if along == "x" else g(ox + t, y - 0.035, oz)
        k.paint(k.box("board", size, at, "wood"), TIMBER[r.randrange(3)], jitter=0.05)


def pile(k, x, z, top, r=0.19, depth=-3.0, cap=True):
    o = k.cylinder("pile", r, top - depth, g(x, depth, z), "wood", seg=7, r_top=r * 0.9)
    k.paint(o, TIMBER[0], jitter=0.06, fn=lambda c, n_, base: k.blend("#2f3a2c", TIMBER[0], min(1.0, max(0.0, (c.z - 0.1) / 0.8))))
    if cap:
        k.paint(k.cylinder("pile_cap", r * 1.15, 0.06, g(x, top, z), "metal", seg=7), "#4a4a46", jitter=0.03)


def rock(k, at, r, name="rock", tones=ROCK, squash=0.7):
    rr = k.rng
    o = k.sphere(name, r, at, "stone", subdiv=1, scale=(1.0 + rr.random() * 0.4, 0.8 + rr.random() * 0.4, squash), noise=0.3, freq=1.3, smooth=25)
    k.paint(o, tones[1], jitter=0.07, fn=lambda c, n_, base: k.blend("#2f3a30", k_hex(k, tones, n_.z), min(1.0, max(0.0, (c.z + 0.2) / 0.9))))
    return o


def k_hex(k, tones, nz):
    return tones[2] if nz > 0.55 else tones[1] if nz > -0.1 else tones[0]


def lighthouse(k):
    """A harbour light: tapered white tower with a red band, gallery and a
    glazed lantern under a copper-green cap, on a rock-set stone drum."""
    k.paint(k.cylinder("drum", 3.4, 1.8, g(0, 0, 0), "stone", seg=16, r_top=3.1), A.STONE, jitter=0.08, fn=A.stone_tone(k))
    n, seg = 20, 16
    Hh = 15.0
    rings = []
    for q in range(n + 1):
        y = 1.8 + Hh * q / n
        rad = 2.3 - 0.85 * (q / n) ** 0.8
        rings.append([g(math.cos(a) * rad, y, math.sin(a) * rad) for a in [i / seg * math.tau for i in range(seg)]])
    tower = k.loft("tower", rings, "plaster", cap=(False, True), smooth=60)

    def paint(c, n_, base):
        h = (c.z - 1.8) / Hh
        col = RED if 0.42 < h < 0.62 else WHITE
        streak = 0.5 + 0.5 * mnoise.noise(Vector((math.atan2(c.y, c.x) * 3, c.z * 0.25, 0)))
        return k.blend("#b9b3a2" if col == WHITE else "#8f3525", col, 0.55 + 0.45 * streak)

    k.paint(tower, WHITE, jitter=0.015, per_vertex=True, fn=paint)
    yaw, put = math.pi / 2, A.face(math.pi / 2, 0, 2.28)
    A.door(k, put, yaw, 0.0, w=1.0, h=2.1, color=NAVY, arch=True, step=False)
    for i, (y, a) in enumerate(((6.0, 0.5), (10.0, 2.4), (13.5, 4.3))):
        rad = 2.3 - 0.85 * ((y - 1.8) / Hh) ** 0.8
        P.panel(k, "slit", 0.45, 0.9, (math.cos(a) * rad, y, math.sin(a) * rad), "window", "#2b3a44", yaw=math.pi / 2 - a + math.pi / 2 if False else -a, depth=0.08, bevel=0.0)
    yg = 1.8 + Hh
    k.paint(k.cylinder("gallery", 2.25, 0.22, g(0, yg, 0), "stone", seg=16, r_top=2.35), A.STONE_LIGHT, jitter=0.04)
    ring = [(math.cos(a) * 2.2, yg + 0.22, math.sin(a) * 2.2) for a in [i / 12 * math.tau for i in range(13)]]
    P.railing(k, ring, h=1.0, post=1.15, color=A.IRON)
    k.paint(k.cylinder("lantern_base", 1.25, 0.7, g(0, yg + 0.22, 0), "paint", seg=12), WHITE, jitter=0.02)
    k.paint(k.cylinder("lantern_glass", 1.15, 1.7, g(0, yg + 0.92, 0), "window", seg=12), "#9fd0dc", jitter=0)
    for i in range(12):
        a = i / 12 * math.tau
        k.paint(k.tube("astragal", [g(math.cos(a) * 1.17, yg + 0.92, math.sin(a) * 1.17), g(math.cos(a) * 1.17, yg + 2.62, math.sin(a) * 1.17)], 0.03, "metal", seg=4), A.IRON, jitter=0)
    k.paint(k.sphere("lamp", 0.42, g(0, yg + 1.75, 0), "glow", subdiv=2, smooth=60), "#fff2b8", jitter=0)
    k.paint(k.cylinder("cap", 1.45, 1.1, g(0, yg + 2.62, 0), "metal", seg=12, r_top=0.12), "#4f8a78", jitter=0.05)
    k.paint(k.sphere("finial", 0.16, g(0, yg + 3.85, 0), "metal", subdiv=1, smooth=60), "#4f8a78", jitter=0)
    r = k.rng
    for i in range(11):
        a = i / 11 * math.tau + r.random() * 0.3
        rock(k, g(math.cos(a) * (3.9 + r.random()), -0.2 + r.random() * 0.5, math.sin(a) * (3.9 + r.random())), 1.0 + r.random() * 0.7)
    k.collider(0, 0, 3.5)
    k.anchor("light", g(0, yg + 1.75, 0), kind="lamp", note="rotating beam / flash source")
    k.anchor("door", g(0, 1.8, 3.4), kind="poi")
    k.finish(ao_strength=0.8, ao_samples=64, ground=False)


def pier_section(k):
    """10 m of timber pier, 4 m wide, deck at y = 1.6 on braced piles. Runs
    along z; tile on ANCHOR_next. One side railed, the other open for mooring."""
    W, L = 4.0, 10.0
    plank_deck(k, W, L, DECK)
    for z in (-3.75, -1.25, 1.25, 3.75):
        for sx in (-1, 1):
            pile(k, sx * (W / 2 - 0.15), z, DECK + (0.55 if sx > 0 and z in (-3.75, 1.25) else -0.07), cap=sx > 0 and z in (-3.75, 1.25))
        k.paint(k.box("bearer", (W + 0.3, 0.2, 0.24), g(0, DECK - 0.2, z), "wood"), TIMBER[0], jitter=0.05)
        k.paint(k.tube("brace", [g(-W / 2 + 0.15, 0.25, z), g(W / 2 - 0.15, DECK - 0.35, z)], 0.06, "wood", seg=4), TIMBER[0], jitter=0.05)
    for sx in (-1, 1):
        k.paint(k.box("stringer", (0.16, L, 0.26), g(sx * (W / 2 - 0.08), DECK - 0.2, 0), "wood"), TIMBER[1], jitter=0.05)
        k.paint(k.box("kerb", (0.18, L, 0.14), g(sx * (W / 2 - 0.1), DECK + 0.07, 0), "wood"), TIMBER[2], jitter=0.05)
    P.railing(k, [(-W / 2 + 0.1, DECK + 0.14, -L / 2), (-W / 2 + 0.1, DECK + 0.14, L / 2)], h=1.0, post=1.66, color=WHITE)
    for z in (-2.5, 2.5):  # tyre fenders on the mooring side
        k.paint(k.cylinder("fender", 0.42, 0.24, g(W / 2 + 0.02, 0.9, z), "rubber", seg=10, axis="x"), "#26262a", jitter=0.03)
        k.paint(k.tube("fender_rope", [g(W / 2 + 0.1, 1.3, z), g(W / 2 - 0.1, DECK + 0.1, z)], 0.02, "cloth", seg=3), "#c9b98f", jitter=0)
    k.paint(k.tube("rope_coil", [g(0.9 + math.cos(a) * 0.3, DECK + 0.05, 3.2 + math.sin(a) * 0.3) for a in [i / 10 * math.tau for i in range(11)]], 0.05, "cloth", seg=4), "#c9b98f", jitter=0.04)
    k.wall((-W / 2 + 0.1, L / 2), (-W / 2 + 0.1, -L / 2), 0.12)
    k.anchor("next", g(0, 0, L))
    k.anchor("surface", g(0, DECK, 0), kind="walk", width=W, length=L)
    k.anchor("mooring", g(W / 2, DECK, -3.75), kind="mooring")
    k.finish(ao_strength=0.75, ao_samples=48, ground=False)


def pier_head(k):
    """The end of the pier: a wider timber platform with a small beacon, a
    bench looking out to sea, a ladder and a life-ring post."""
    W, L = 8.0, 8.0
    plank_deck(k, W, L, DECK)
    for x in (-3.6, -1.2, 1.2, 3.6):
        for z in (-3.6, 0.0, 3.6):
            tall = abs(x) > 3 and abs(z) > 3
            pile(k, x, z, DECK + (0.6 if tall else -0.07), cap=tall)
    for z in (-3.6, 0.0, 3.6):
        k.paint(k.box("bearer", (W + 0.3, 0.2, 0.24), g(0, DECK - 0.2, z), "wood"), TIMBER[0], jitter=0.05)
    for a, b in (((-3.9, -3.9), (-3.9, 3.9)), ((-3.9, 3.9), (3.9, 3.9))):
        P.railing(k, [(a[0], DECK, a[1]), (b[0], DECK, b[1])], h=1.0, post=1.56, color=WHITE)
        k.wall((a[0], -a[1]), (b[0], -b[1]), 0.12)
    # Beacon: a short red lattice post with a lamp.
    for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        k.paint(k.tube("leg", [g(-2.6 + sx * 0.4, DECK, 2.6 + sz * 0.4), g(-2.6 + sx * 0.12, DECK + 4.2, 2.6 + sz * 0.12)], 0.05, "metal", seg=4), RED, jitter=0.03)
    for y in (1.2, 2.4, 3.6):
        s = 0.4 - 0.28 * y / 4.2
        k.paint(k.tube("tie", [g(-2.6 + a * s, DECK + y, 2.6 + b * s) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1), (-1, -1))], 0.03, "metal", seg=3), RED, jitter=0.03)
    k.paint(k.cylinder("beacon_top", 0.32, 0.12, g(-2.6, DECK + 4.2, 2.6), "metal", seg=8), RED, jitter=0)
    k.paint(k.sphere("beacon", 0.24, g(-2.6, DECK + 4.55, 2.6), "glow", subdiv=2, smooth=60), "#ff6a4a", jitter=0)
    k.anchor("light", g(-2.6, DECK + 4.55, 2.6), kind="lamp", color="#ff5a3c")
    # Bench facing the open sea (+z).
    for y, zz, hh in ((DECK + 0.45, 2.2, 0.06), (DECK + 0.8, 1.98, 0.3)):
        k.paint(k.box("bench", (2.0, 0.42 if hh < 0.1 else 0.06, hh), g(1.4, y, zz), "wood"), TIMBER[2], jitter=0.05)
    for x in (0.55, 2.25):
        k.paint(k.box("bench_leg", (0.07, 0.4, 0.45), g(x, DECK + 0.22, 2.2), "metal"), A.IRON, jitter=0)
    k.anchor("seat", g(1.4, DECK + 0.48, 2.2), kind="seat", facing="+z")
    # Ladder down to the water and a life ring.
    for sx in (-0.25, 0.25):
        k.paint(k.tube("ladder", [g(4.08, -0.6, -1.5 + sx), g(4.08, DECK + 0.9, -1.5 + sx), g(3.7, DECK + 0.9, -1.5 + sx)], 0.03, "metal", seg=4), A.IRON, jitter=0)
    for i in range(6):
        k.paint(k.tube("rung", [g(4.08, -0.3 + i * 0.36, -1.75), g(4.08, -0.3 + i * 0.36, -1.25)], 0.022, "metal", seg=3), A.IRON, jitter=0)
    k.paint(k.box("ring_post", (0.1, 0.1, 1.5), g(3.6, DECK + 0.75, 1.2), "wood"), WHITE, jitter=0.02)
    k.paint(k.tube("life_ring", [g(3.52, DECK + 1.15 + math.sin(a) * 0.3, 1.2 + math.cos(a) * 0.3) for a in [i / 10 * math.tau for i in range(11)]], 0.07, "paint", seg=5), "#e8562f", jitter=0.03)
    k.anchor("view", g(0, DECK + 1.6, 3.0), kind="camera", note="looking out to sea (+z)")
    k.anchor("surface", g(0, DECK, 0), kind="walk", width=W, length=L)
    k.finish(ao_strength=0.75, ao_samples=48, ground=False)


def harbour_office(k):
    """Harbour master's office and ticket hall: weatherboarded, white, navy
    trim, a slate roof with a small lookout turret and signal mast. Sits on
    the quay; origin at quay level."""
    W, D, Hh = 11.0, 6.5, 3.6
    A.shell(k, W, D, Hh, WHITE, seed=9.0, cell=0.9, grime=0.7)
    fs = A.faces_of(W, D)
    for name, (yaw, put, fw) in fs.items():
        for i in range(int(Hh / 0.6)):  # weatherboard shadow lines
            P.panel(k, "board_line", fw, 0.03, put(0, 0.5 + i * 0.6, 0.012), "paint", "#cfc9ba", yaw=yaw, depth=0.03, bevel=0.0)
        for s in (-1, 1):
            P.panel(k, "corner", 0.22, Hh, put(s * (fw / 2 - 0.11), Hh / 2, 0.03), "paint", NAVY, yaw=yaw, depth=0.06, bevel=0.0)
    yaw, put, _ = fs["front"]
    A.door(k, put, yaw, 0.0, w=1.5, h=2.4, color=NAVY, arch=False, step=True)
    for u in (-3.6, -1.9, 1.9, 3.6):
        A.window(k, put, yaw, u, 1.0, w=1.0, h=1.5, shutters=None, pots=False, frame=NAVY, detail=1)
    yawb, putb, _ = fs["back"]
    for u in (-3.0, 0.0, 3.0):
        A.window(k, putb, yawb, u, 1.0, w=1.0, h=1.5, shutters=None, pots=False, frame=NAVY, detail=0)
    A.awning(k, put, yaw, 0.0, 2.9, 2.6, drop=0.4, reach=1.2, colors=(NAVY, WHITE))
    P.panel(k, "sign", 3.4, 0.5, put(-3.0, 3.1, 0.05), "paint", NAVY, yaw=yaw, depth=0.05, bevel=0.02)
    k.anchor("label_sign", g(*put(-3.0, 3.1, 0.1)), kind="label", width=3.2, height=0.4)
    P.panel(k, "timetable", 1.2, 1.5, put(2.75, 1.7, 0.05), "paint", "#f6f1e2", yaw=yaw, depth=0.04, bevel=0.02)
    k.anchor("label_timetable", g(*put(2.75, 1.7, 0.1)), kind="label", width=1.1, height=1.4)
    # Slate hipped look via a gable roof plus turret.
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "europe_v2"))
    gab = _slate(k, W, D, Hh, 2.2)
    k.paint(gab, WHITE, jitter=0.03)
    A.cornice(k, W, D, Hh - 0.08, color=NAVY, proj=0.12)
    A.shell(k, 2.6, 2.6, 2.4, WHITE, y0=Hh + 1.2, seed=3.0, cell=0.9, name="turret", grime=0.4)
    for name, (yaw2, put2, fw) in A.faces_of(2.6, 2.6).items():
        P.panel(k, "lookout", 2.0, 1.0, put2(0, Hh + 2.75, 0.02), "window", "#33464f", yaw=yaw2, depth=0.05, bevel=0.0)
        P.panel(k, "lookout_bar", 0.06, 1.0, put2(0, Hh + 2.75, 0.04), "paint", NAVY, yaw=yaw2, depth=0.04, bevel=0.0)
    k.paint(k.cylinder("turret_roof", 2.1, 1.3, g(0, Hh + 3.6, 0), "stone", seg=4, r_top=0.05), "#52606a", jitter=0.05).rotation_euler[2] = math.pi / 4
    k.paint(k.tube("mast", [g(0, Hh + 4.8, 0), g(0, Hh + 9.0, 0)], 0.06, "metal", seg=5), WHITE, jitter=0)
    k.paint(k.tube("yard", [g(-1.5, Hh + 7.8, 0), g(1.5, Hh + 7.8, 0)], 0.035, "metal", seg=4), WHITE, jitter=0)
    for i, (x, col) in enumerate(((-1.2, RED), (-0.6, "#f2c94c"), (0.6, NAVY), (1.2, WHITE))):
        bm = bmesh.new()
        vs = [bm.verts.new(v) for v in (g(x - 0.2, Hh + 7.75, 0), g(x + 0.2, Hh + 7.75, 0), g(x + 0.2, Hh + 7.3, 0.02), g(x - 0.2, Hh + 7.3, 0.02))]
        bm.faces.new(vs)
        f = k.add(bm, "signal_flag", "cloth")
        f.data.materials[0].use_backface_culling = False
        k.paint(f, col, jitter=0.02, sway=lambda co: 0.8)
    k.anchor("flag", g(0, Hh + 9.0, 0), kind="flag")
    for a, b in (((-W / 2, -D / 2), (W / 2, -D / 2)), ((-W / 2, D / 2), (W / 2, D / 2)), ((-W / 2, -D / 2), (-W / 2, D / 2)), ((W / 2, -D / 2), (W / 2, D / 2))):
        k.wall((a[0], -a[1]), (b[0], -b[1]), 0.2)
    k.anchor("door", g(0, 0, D / 2 + 1.0), kind="poi")
    k.finish(ao_strength=0.85, ao_samples=64)


def _slate(k, w, d, y0, rise):
    import importlib.util
    spec = importlib.util.spec_from_file_location("europe_v2_kit", os.path.join(os.path.dirname(__file__), "..", "europe_v2", "_kit.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m.slate_roof(k, w, d, y0, rise, ov=0.5)


def breakwater(k):
    """20 m of rubble-mound breakwater: tumbled armour stone with a concrete
    walkway on the crest (y = 1.6). Runs along z; tile on ANCHOR_next."""
    r = k.rng
    L = 20.0
    for i in range(46):
        z = -L / 2 + r.random() * L
        side = r.choice((-1, 1))
        t = r.random()
        x = side * (1.6 + t * 3.6)
        y = 1.2 - t * 2.4 + r.random() * 0.3
        rock(k, g(x, y, z), 0.95 + r.random() * 0.75)
    core = k.box("core", (6.0, L, 3.4), g(0, -0.6, 0), "stone", taper=0.5)
    k.paint(core, ROCK[0], jitter=0.05)
    k.paint(k.box("walk", (2.4, L, 0.3), g(0, DECK - 0.15, 0), "stone"), "#b7b2a4", jitter=0.04)
    for z in (-7.5, -2.5, 2.5, 7.5):
        k.paint(k.box("joint", (2.42, 0.05, 0.31), g(0, DECK - 0.15, z), "stone"), "#8f8a7e", jitter=0)
    k.wall((-3.6, L / 2), (-3.6, -L / 2), 0.4)
    k.wall((3.6, L / 2), (3.6, -L / 2), 0.4)
    k.anchor("next", g(0, 0, L))
    k.anchor("surface", g(0, DECK, 0), kind="walk", width=2.4, length=L)
    k.finish(ao_strength=0.8, ao_samples=48, ground=False)


def fishing_boat(k):
    """A small inshore boat at its mooring: clinker-look hull, wheelhouse,
    mast with a riding light, nets and floats aft. Set dressing, not a vehicle.
    Waterline at y = 0, bow toward +z."""
    L = 8.4
    stations = [(-L / 2, 0.75, 0.95), (-L / 2 + 0.6, 1.25, 0.9), (-1.5, 1.5, 0.85), (1.2, 1.45, 0.9), (3.0, 1.0, 1.05), (L / 2 - 0.25, 0.3, 1.25), (L / 2, 0.04, 1.3)]
    rings = []
    for z, hw, sheer in stations:
        rings.append([g(-hw, sheer, z), g(-hw * 0.92, 0.25, z), g(-hw * 0.55, -0.45, z), g(0, -0.7, z), g(hw * 0.55, -0.45, z), g(hw * 0.92, 0.25, z), g(hw, sheer, z)])
    hull = k.loft("hull", rings, "paint", cap=(True, True), closed=False, smooth=50)
    hull.data.materials[0].use_backface_culling = False
    k.paint(hull, NAVY, jitter=0.03, per_vertex=True, fn=lambda c, n_, base: k.blend("#7a3528", NAVY, 1.0) if c.z > 0.12 else k.blend("#7a3528", "#7a3528", 1))
    deck_pts = [g(-hw * 0.96, sheer - 0.12, z) for z, hw, sheer in stations] + [g(hw * 0.96, sheer - 0.12, z) for z, hw, sheer in reversed(stations)]
    bm = bmesh.new()
    bm.faces.new([bm.verts.new(p) for p in deck_pts])
    dk = k.add(bm, "deck", "wood")
    dk.data.materials[0].use_backface_culling = False
    k.paint(dk, TIMBER[2], jitter=0.05)
    for s in (-1, 1):
        k.paint(k.tube("rubrail", [g(s * hw * 1.01, sheer, z) for z, hw, sheer in stations], 0.05, "paint", seg=4), WHITE, jitter=0)
    A.shell(k, 1.7, 1.9, 1.75, WHITE, oz=-0.9, y0=0.78, seed=2.0, cell=0.9, name="wheelhouse", grime=0.5)
    for name, (yaw, put, fw) in A.faces_of(1.7, 1.9, 0, -0.9).items():
        P.panel(k, "wh_glass", fw - 0.4, 0.6, put(0, 2.0, 0.02), "window", "#2f4450", yaw=yaw, depth=0.04, bevel=0.0)
    k.paint(k.bbox("wh_roof", (2.0, 2.2, 0.1), g(0, 2.58, -0.9), "paint", bevel=0.03, seg=1), RED, jitter=0.03)
    k.paint(k.tube("mast", [g(0, 2.6, -0.4), g(0, 5.4, -0.4)], 0.05, "metal", seg=5), WHITE, jitter=0)
    k.paint(k.tube("boom", [g(0, 3.4, -0.4), g(0, 4.3, -3.4)], 0.04, "metal", seg=4), WHITE, jitter=0)
    k.paint(k.sphere("riding_light", 0.1, g(0, 5.45, -0.4), "glow", subdiv=1, smooth=60), "#fff2b8", jitter=0)
    k.anchor("light", g(0, 5.45, -0.4), kind="lamp")
    r = k.rng
    net = k.sphere("net_heap", 0.75, g(0.1, 0.95, -3.0), "cloth", subdiv=2, scale=(1.2, 1.0, 0.45), noise=0.3, smooth=60)
    k.paint(net, "#3f6f6a", jitter=0.08)
    for i in range(7):
        k.paint(k.sphere("float", 0.14, g(-0.6 + r.random() * 1.3, 1.15 + r.random() * 0.15, -3.5 + r.random()), "paint", subdiv=1, smooth=60), "#f08a2e" if i % 2 else "#f2c94c", jitter=0.03)
    for x in (-0.55, 0.55):
        k.paint(k.box("crate", (0.6, 0.45, 0.35), g(x, 1.05, 1.5), "wood"), "#4f86a8" if x < 0 else TIMBER[1], jitter=0.05)
    k.paint(k.cylinder("fender", 0.16, 0.5, g(1.52, 0.45, 0.2), "rubber", seg=7), "#e8e2d0", jitter=0.03)
    k.collider(0, 2.0, 1.4)
    k.collider(0, -2.0, 1.4)
    k.anchor("bob", g(0, 0, 0), kind="float", note="rock gently about z, +-2 deg, 3 s period")
    k.finish(ao_strength=0.8, ao_samples=48, ground=False)


def dock_clutter(k):
    """What a working quay is covered in: stacked pots, a net drying on a
    rack, fish boxes, a barrel, coiled rope, a hand cart."""
    r = k.rng
    for i, (x, z, y) in enumerate(((-1.6, -0.6, 0), (-0.9, -0.6, 0), (-1.25, -0.6, 0.5), (-1.6, 0.15, 0), (-0.9, 0.15, 0))):
        pot = k.cylinder("pot", 0.3, 0.68, g(x - 0.34, y + 0.3, z), "wood", seg=8, axis="x")
        k.paint(pot, TIMBER[1], jitter=0.07)
        k.paint(k.box("pot_base", (0.72, 0.62, 0.05), g(x, y + 0.03, z), "wood"), TIMBER[0], jitter=0.05)
    for x in (0.6, 2.8):
        for z in (-0.5, 0.5):
            k.paint(k.tube("rack_leg", [g(x, 0, z * 0.9), g(x, 1.9, z * 0.2)], 0.04, "wood", seg=4), TIMBER[0], jitter=0.05)
    k.paint(k.tube("rack_bar", [g(0.4, 1.9, 0), g(3.0, 1.9, 0)], 0.04, "wood", seg=4), TIMBER[0], jitter=0.05)
    bm = bmesh.new()
    n = 10
    rows = [[bm.verts.new(g(0.6 + 2.2 * i / n, 1.9 - abs(s) * 1.55 + 0.12 * math.sin(i * 1.3), s * (0.12 + 0.45 * abs(s)))) for i in range(n + 1)] for s in (-1, -0.5, 0, 0.5, 1)]
    for a, b in zip(rows, rows[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
    net = k.add(bm, "net", "cloth", smooth=60)
    net.data.materials[0].use_backface_culling = False
    k.paint(net, "#3f6f6a", jitter=0.1, per_vertex=True, sway=lambda co: min(1.0, max(0.0, (1.9 - co.z) / 1.6)) * 0.7)
    for i in range(5):
        k.paint(k.bbox("fish_box", (0.75, 0.5, 0.24), g(1.0 + (i % 2) * 0.82, 0.12 + (i // 2) * 0.25, 1.5 + (i % 3) * 0.04), "paint", bevel=0.02, seg=1), ("#4f86a8", "#e8e2d0", "#e0703a")[i % 3], jitter=0.04)
    k.paint(k.cylinder("barrel", 0.36, 0.95, g(-1.5, 0, 1.5), "wood", seg=10, r_top=0.33), TIMBER[1], jitter=0.06)
    for y in (0.15, 0.8):
        k.paint(k.cylinder("hoop", 0.375, 0.05, g(-1.5, y, 1.5), "metal", seg=10), A.IRON, jitter=0)
    for j in range(3):
        k.paint(k.tube("coil", [g(-0.3 + math.cos(a) * 0.36, 0.06 + j * 0.09, 1.6 + math.sin(a) * 0.36) for a in [i / 10 * math.tau for i in range(11)]], 0.05, "cloth", seg=4), "#c9b98f", jitter=0.04)
    k.collider(-1.25, 0.2, 0.9)
    k.collider(1.7, 0.0, 1.2)
    k.finish(ao_strength=0.8, ao_samples=48)


def gangway(k):
    """Passenger gangway from the quay up to the ship: 9 m, rising 2.8 m, with
    canvas side screens. Origin at the quay foot; climbs toward +x."""
    L, rise, W = 9.0, 2.8, 1.3
    a, b = (0.0, 0.0, 0.0), (L, rise, 0.0)
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in (g(0, 0.05, -W / 2), g(0, 0.05, W / 2), g(L, rise + 0.05, W / 2), g(L, rise + 0.05, -W / 2))]
    bm.faces.new(vs)
    tread = k.add(bm, "tread", "metal")
    tread.data.materials[0].use_backface_culling = False
    k.paint(tread, "#8f9498", jitter=0.03)
    for i in range(18):
        t = (i + 0.5) / 18
        k.paint(k.box("cleat", (0.06, W - 0.1, 0.04), g(L * t, rise * t + 0.08, 0), "metal"), "#6f7478", jitter=0)
    for s in (-1, 1):
        k.paint(k.tube("beam", [g(0, -0.08, s * W / 2), g(L, rise - 0.08, s * W / 2)], 0.08, "metal", seg=4), WHITE, jitter=0)
        P.railing(k, [(0, 0.05, s * W / 2), (L, rise + 0.05, s * W / 2)], h=1.05, post=1.5, color=WHITE)
        bm = bmesh.new()
        vs = [bm.verts.new(v) for v in (g(0.3, 0.2, s * (W / 2 + 0.03)), g(L - 0.3, rise + 0.2, s * (W / 2 + 0.03)), g(L - 0.3, rise + 0.95, s * (W / 2 + 0.03)), g(0.3, 0.95, s * (W / 2 + 0.03)))]
        bm.faces.new(vs)
        scr = k.add(bm, "screen", "cloth")
        scr.data.materials[0].use_backface_culling = False
        k.paint(scr, NAVY, jitter=0.03)
    for z in (-0.5, 0.5):
        k.paint(k.cylinder("roller", 0.14, 0.2, g(0.15, 0.0, z - 0.1), "rubber", seg=8, axis="y"), "#26262a", jitter=0)
    k.wall((0, W / 2), (L, W / 2), 0.08)
    k.wall((0, -W / 2), (L, -W / 2), 0.08)
    k.anchor("foot", g(0, 0, 0), kind="boarding")
    k.anchor("head", g(L, rise, 0), kind="boarding", note="meets the ship's gangway_foot")
    k.finish(ao_strength=0.7, ao_samples=32)


def coast_headland(k):
    """A rocky headland, 60 m long and 22 m high, with wind-bent pines on top.
    Stand it across the bay (100–250 m, scale 1–3) to close the harbour view.
    Waterline at y = 0."""
    r = k.rng
    off = Vector((r.random() * 20, r.random() * 20, 0))
    nx, nz = 30, 12
    bm = bmesh.new()
    grid = []
    for j in range(nz + 1):
        row = []
        for i in range(nx + 1):
            u, v = i / nx, j / nz
            x, z = -30 + 60 * u, -11 + 22 * v
            env = math.sin(u * math.pi) ** 0.6 * math.sin(v * math.pi) ** 0.5 * (0.55 + 0.45 * u)
            h = 22 * env * (0.7 + 0.5 * mnoise.noise(Vector((x * 0.07, z * 0.09, 0)) + off)) - 1.5
            row.append(bm.verts.new(g(x + 1.2 * mnoise.noise(Vector((x * 0.2, z * 0.2, 3)) + off), h, z)))
        grid.append(row)
    for j in range(nz):
        for i in range(nx):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    o = k.add(bm, "headland", "stone", smooth=22)

    def paint(c, n_, base):
        if c.z < 0.8:
            return k.blend("#2c3a34", "#55524c", max(0.0, c.z / 0.8))
        if n_.z > 0.78:
            return k.blend("#5f7f45", "#8fa35a", 0.5 + 0.5 * mnoise.noise(Vector((c.x * 0.3, c.y * 0.3, 1))))
        strata = 0.5 + 0.5 * math.sin(c.z * 1.7 + c.x * 0.12)
        return k.blend("#6a655c", "#a89f8c", strata)

    k.paint(o, ROCK[1], jitter=0.04, per_vertex=True, fn=paint)
    for i in range(9):
        u = 0.35 + r.random() * 0.55
        x, z = -30 + 60 * u, (r.random() - 0.5) * 6
        env = math.sin(u * math.pi) ** 0.6 * (0.55 + 0.45 * u)
        y = 22 * env * 0.72 - 2.2
        lean = 0.8 + r.random() * 0.8
        hh = 3.5 + r.random() * 2.5
        A.trunk(k, [g(x, y, z), g(x + lean * 0.4, y + hh * 0.6, z), g(x + lean, y + hh, z)], 0.2, 0.08, bark=("#4a372a", "#7a5f48"), seg=5)
        for q in range(3):
            A.clump(k, g(x + lean + (q - 1) * 1.2 + 0.5, y + hh + 0.3 - abs(q - 1) * 0.4, z + (r.random() - 0.5)), 1.3 + r.random() * 0.5, tones=PINE, subdiv=2, scale=(1.5, 1.2, 0.45), noise=0.2, sway=lambda co: 0.35)
    for i in range(8):
        rock(k, g(-32 + r.random() * 64, -0.3 + r.random() * 0.6, -13 - r.random() * 4 if i % 2 else 12 + r.random() * 4), 1.4 + r.random() * 1.6)
    k.anchor("summit", g(8, 16, 0))
    k.finish(ao=False, ground=False)


def horizon_islands(k):
    """Far islands as two pale silhouettes, 78 m long: the thing that makes a
    sea horizon read as distance. Scale 4–8, 500–900 m out, waterline y = 0."""
    r = k.rng
    off = Vector((r.random() * 20, r.random() * 20, 0))
    for li, (z, hmax, col, x0, ln) in enumerate(((0.0, 11.0, "#6f8798", -39, 46), (-8.0, 16.0, "#8da2b2", -10, 49))):
        n = 36
        bm = bmesh.new()
        lo, hi = [], []
        for i in range(n + 1):
            t = i / n
            x = x0 + ln * t
            h = hmax * math.sin(t * math.pi) ** 0.7 * (0.55 + 0.45 * abs(mnoise.noise(Vector((x * 0.05, li * 3.0, 0)) + off))) + 0.2
            lo.append(bm.verts.new(g(x, -0.5, z + 5)))
            hi.append(bm.verts.new(g(x, h, z)))
        back = [bm.verts.new(g(v.co.x, -0.5, z - 5)) for v in hi]
        for i in range(n):
            bm.faces.new((lo[i], lo[i + 1], hi[i + 1], hi[i]))
            bm.faces.new((hi[i], hi[i + 1], back[i + 1], back[i]))
        o = k.add(bm, "island", "earth", smooth=40)
        k.paint(o, col, jitter=0.015, per_vertex=True, fn=lambda c, n_, base, col=col: k.blend("#c6d3da", col, min(1.0, max(0.0, c.z / 6.0 + 0.35))))
    k.finish(ao=False, ground=False)


def deck_bench(k):
    """Slatted teak deck bench with cast ends and a life-jacket locker under it."""
    for i in range(5):
        k.paint(k.box("slat", (1.9, 0.085, 0.035), g(0, 0.46, -0.2 + i * 0.1), "wood"), TIMBER[2], jitter=0.05)
    for i in range(4):
        k.paint(k.box("back_slat", (1.9, 0.03, 0.085), g(0, 0.62 + i * 0.11, -0.27 - i * 0.02), "wood"), TIMBER[2], jitter=0.05)
    for x in (-0.9, 0.9):
        k.paint(k.tube("end", [g(x, 0, 0.25), g(x, 0.44, 0.22), g(x, 0.44, -0.24), g(x, 1.0, -0.36)], 0.035, "metal", seg=4), WHITE, jitter=0)
        k.paint(k.tube("end_back", [g(x, 0, -0.3), g(x, 0.44, -0.24)], 0.035, "metal", seg=4), WHITE, jitter=0)
        k.paint(k.tube("arm", [g(x, 0.44, 0.22), g(x, 0.68, 0.2), g(x, 0.68, -0.28)], 0.03, "metal", seg=4), WHITE, jitter=0)
    k.paint(k.bbox("locker", (1.5, 0.42, 0.3), g(0, 0.17, -0.02), "paint", bevel=0.02, seg=1), WHITE, jitter=0.02)
    P.panel(k, "locker_mark", 0.5, 0.14, (0, 0.17, 0.2), "paint", "#e8562f", yaw=math.pi / 2, depth=0.02, bevel=0.0)
    k.collider(0, 0, 0.6)
    k.anchor("seat", g(0, 0.48, 0), kind="seat", facing="+z")
    k.finish(ao_strength=0.75, ao_samples=32)


def deck_vent(k):
    """Cowl ventilator: the swan-necked trumpet that says 'ship' on any deck."""
    k.paint(k.cylinder("base", 0.34, 0.12, g(0, 0, 0), "metal", seg=12), WHITE, jitter=0)
    pts = [g(0, 0.1, 0), g(0, 1.15, 0), g(0, 1.5, 0.12), g(0, 1.72, 0.42)]
    k.paint(k.tube("neck", pts, 0.24, "paint", seg=12, cap=False), WHITE, jitter=0.02)
    rings = []
    for q, (z, y, rad) in enumerate(((0.42, 1.72, 0.25), (0.62, 1.78, 0.4), (0.74, 1.8, 0.52))):
        rings.append([g(math.cos(a) * rad, y + math.sin(a) * rad, z) for a in [i / 12 * math.tau for i in range(12)]])
    cowl = k.loft("cowl", rings, "paint", cap=(False, False), smooth=60)
    cowl.data.materials[0].use_backface_culling = False
    k.paint(cowl, WHITE, jitter=0.02, per_vertex=True, fn=lambda c, n_, base: k.blend(RED, WHITE, 0.0 if n_.y > 0.15 else 1.0))
    k.paint(k.tube("mouth", [g(0, 1.79, 0.6), g(0, 1.8, 0.7)], 0.38, "paint", seg=12), RED, jitter=0.03)
    k.collider(0, 0, 0.4)
    k.finish(ao_strength=0.75, ao_samples=32)


BUILDERS = {f.__name__: f for f in (lighthouse, pier_section, pier_head, harbour_office, breakwater, fishing_boat, dock_clutter, gangway, coast_headland, horizon_islands, deck_bench, deck_vent)}
BUDGET = {"lighthouse": 3200, "pier_section": 2600, "pier_head": 3600, "harbour_office": 6500, "breakwater": 3200, "fishing_boat": 2600, "dock_clutter": 2200, "gangway": 1800, "coast_headland": 3600, "horizon_islands": 500, "deck_bench": 700, "deck_vent": 500}
GROUND = {"lighthouse": -0.6, "pier_section": -3.0, "pier_head": -3.0, "breakwater": -2.3, "fishing_boat": -0.7, "coast_headland": -1.5, "horizon_islands": -0.5}
META = {"pier_section": {"deck_y": 1.6, "waterline_y": 0.0, "tile": 10.0}, "gangway": {"length": 9.0, "rise": 2.8}}
