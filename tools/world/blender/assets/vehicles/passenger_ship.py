"""Passenger ship — the vessel for the Japan / maritime chapter.

An original small liner, not a model of any real ship: a place where young
people from many countries could plausibly spend weeks at sea. Built to be
seen from the outside in wide shots and walked on: three open decks, stairs
between them, railings everywhere a visitor could fall off.

Origin: on the waterline, amidships. +z is the bow.
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from ptw import parts as P  # noqa: E402
from ptw.parts import g  # noqa: E402

LEN = 62.0
DECK = 4.4  # main deck above the waterline
BOAT = 7.15  # boat deck
BRIDGE = 9.8  # bridge deck
TOP = 12.3  # wheelhouse roof

# (z, half-beam at the deck, deck height, draft, bow flare)
STATIONS = [(-31.0, 3.5, 4.7, 0.9, 0.0), (-29.0, 4.4, 4.55, 2.2, 0.0), (-24.0, 5.05, 4.4, 3.0, 0.0), (-12.0, 5.25, 4.4, 3.2, 0.0), (4.0, 5.25, 4.4, 3.2, 0.0), (14.0, 5.0, 4.4, 3.2, 0.02), (21.0, 4.0, 4.55, 3.1, 0.08), (26.0, 2.55, 4.85, 2.9, 0.2), (29.2, 1.15, 5.25, 2.4, 0.45), (30.6, 0.4, 5.55, 1.6, 0.8), (31.2, 0.1, 5.7, 0.4, 1.0)]

SPEC = {
    "id": "passenger_ship",
    "pack": "vehicles",
    "asset_class": "hero",
    "author": "Claude (vehicle factory)",
    "seed": 37,
    "tri_budget": 20000,
    "ao_distance": 2.5,
    "ground_z": -3.2,
    "preview_dir": (0.85, -1.0, 0.34),
    "meta": {
        "chapter": "asia (Japan, maritime)", "vehicle": "ship", "length": LEN, "beam": 10.5, "draft": 3.2,
        "origin": "waterline, amidships", "waterline_y": 0.0,
        "decks": [
            {"name": "main", "y": DECK, "z": [-29.5, 29.0], "half_width": 5.0, "note": "walk-around promenade; deckhouse occupies x ±4.0, z -20..13"},
            {"name": "boat", "y": BOAT, "z": [-20.0, 13.0], "half_width": 4.0, "note": "open deck around the upper house (x ±3.3, z -15..9); lifeboats outboard"},
            {"name": "bridge", "y": BRIDGE, "z": [-15.0, 9.5], "half_width": 3.3, "note": "wheelhouse z 2..9.5 with wings to x ±4.7"},
        ],
        "colliders": "2D, describe the main deck: deckhouse walls. Railings are visual; clamp walkers to each deck's half_width.",
    },
}


def lerp(a, b, t):
    return a + (b - a) * t


def at_z(z):
    """Interpolated (half-beam, deck height, draft, flare) at z."""
    for a, b in zip(STATIONS, STATIONS[1:]):
        if a[0] <= z <= b[0]:
            t = (z - a[0]) / (b[0] - a[0])
            return tuple(lerp(a[i], b[i], t) for i in range(1, 5))
    return STATIONS[0][1:] if z < STATIONS[0][0] else STATIONS[-1][1:]


def hull_section(b, yd, d, fl):
    half = [(0.0, -d), (b * 0.5, -d), (b * 0.9, -d * 0.5), (b * 0.975, 0.0), (b * 0.985, 0.4), (b * (0.99 + fl * 0.55), yd - 0.75), (b * (1.0 + fl), yd)]
    return half + [(-x, y) for x, y in reversed(half)]


def build(k):
    # ---- Hull ---------------------------------------------------------------
    zs = [s[0] for s in STATIONS]
    dense = []
    for a, b in zip(zs, zs[1:]):
        n = max(1, int((b - a) / 4))
        dense += [lerp(a, b, i / n) for i in range(n)]
    dense.append(zs[-1])
    hull = k.loft("hull", [P.ring(hull_section(*at_z(z)), z) for z in dense], "paint", smooth=50)

    def hull_paint(c, n_, base):
        y = c.z
        if n_.z > 0.8 and y > 3.5:
            return k.blend(P.DECK_WOOD, "#a57c4f", 0.5 + 0.5 * math.sin(c.x * 9.0))  # planking
        if y < 0.02:
            return k.blend(P.TERRACOTTA, "#8e4530", 0.3)
        if y < 0.42:
            return k.blend(P.CREAM, P.CREAM, 1)
        _, yd, _, _ = at_z(-c.y)
        return k.blend(P.CREAM, P.CREAM, 1) if y > yd - 0.8 else k.blend(P.GREEN, P.GREEN, 1)

    k.paint(hull, P.GREEN, jitter=0.012, fn=hull_paint)

    # Portholes along the hull.
    for i in range(22):
        z = -24 + i * 2.15
        b, yd, _, fl = at_z(z)
        for s in (-1, 1):
            x = s * b * (0.99 + fl * 0.3)
            k.paint(k.tube("porthole", [g(x - s * 0.02, 2.45, z), g(x + s * 0.035, 2.45, z)], 0.2, "window", seg=10), P.GLASS_DARK, jitter=0)
            k.paint(k.tube("porthole_rim", [g(x - s * 0.02, 2.45, z), g(x + s * 0.02, 2.45, z)], 0.25, "metal", seg=10), "#c9a94e", jitter=0)

    # ---- Deckhouses -----------------------------------------------------------
    def house(z0, z1, half, y0, y1, color=P.CREAM, bevel=0.35):
        o = k.bbox("house", (half * 2, z1 - z0, y1 - y0), g(0, (y0 + y1) / 2, (z0 + z1) / 2), "paint", bevel=bevel, seg=3)
        k.paint(o, color, jitter=0.012, fn=lambda c, n_, base: k.blend(P.DECK_WOOD, "#a57c4f", 0.5 + 0.5 * math.sin(c.x * 9.0)) if n_.z > 0.9 else k.blend(color, color, 1))
        return o

    house(-20, 13, 4.0, DECK - 0.05, BOAT)
    house(-15, 9, 3.3, BOAT - 0.05, BRIDGE)
    house(2, 9.5, 3.6, BRIDGE - 0.05, TOP, bevel=0.3)
    # Bridge wings: the wheelhouse reaches out over the sides.
    for s in (-1, 1):
        k.paint(k.bbox("wing", (1.5, 3.2, 0.25), g(s * 4.2, BRIDGE + 0.05, 6.6), "paint", bevel=0.08), P.CREAM, jitter=0.01)
        P.railing(k, [(s * 3.6, BRIDGE + 0.17, 5.05), (s * 4.9, BRIDGE + 0.17, 5.05), (s * 4.9, BRIDGE + 0.17, 8.15), (s * 3.6, BRIDGE + 0.17, 8.15)], h=1.05, post=1.3)

    # Windows.
    P.window_band(k, -18.5, 11.5, 4.0, DECK + 1.55, 0.95, 1.9)
    P.window_band(k, -13.5, 1.0, 3.3, BOAT + 1.5, 0.9, 1.8)
    P.window_band(k, 2.5, 9.0, 3.6, BRIDGE + 1.5, 0.95, 1.3)
    for i in range(5):
        x = (i - 2) * 1.32
        P.panel(k, "bridge_window", 1.14, 1.0, (x, BRIDGE + 1.5, 9.5), "window", P.GLASS_DARK, yaw=math.pi / 2, depth=0.05, bevel=0.05)
    for i in range(4):
        x = (i - 1.5) * 1.7
        P.panel(k, "lounge_window", 1.4, 1.1, (x, DECK + 1.55, 13.0), "window", P.GLASS_DARK, yaw=math.pi / 2, depth=0.05, bevel=0.06)
        P.panel(k, "aft_window", 1.4, 1.1, (x, DECK + 1.55, -20.0), "window", P.GLASS_DARK, yaw=-math.pi / 2, depth=0.05, bevel=0.06)
    # Doors onto the promenade.
    for s, side in ((1, "l"), (-1, "r")):
        for di, z in enumerate((-9.0, 7.0)):
            node = k.node(f"PART_door_{side}{di + 1}", g(s * 4.0, DECK + 1.0, z + 0.45), role="door", axis="y", limit_deg=100, swings="out")
            P.panel(k, "door", 0.9, 2.0, (s * 4.01, DECK + 1.02, z), "paint", P.GREEN, yaw=0 if s > 0 else math.pi, depth=0.06, parent=node, bevel=0.04)
            k.paint(k.tube("door_port", [g(s * 4.03, DECK + 1.5, z), g(s * 4.06, DECK + 1.5, z)], 0.16, "window", seg=10, parent=node), P.GLASS_DARK, jitter=0)

    # ---- Funnel, masts, radar ----------------------------------------------------
    fz = -6.0
    fr = []
    for i, (y, sx, sz, dz) in enumerate(((BRIDGE - 0.1, 1.5, 2.3, 0.0), (BRIDGE + 1.6, 1.42, 2.15, -0.35), (BRIDGE + 3.3, 1.3, 1.95, -0.75), (BRIDGE + 4.3, 1.24, 1.85, -1.0))):
        fr.append([g(math.cos(a) * sx, y, fz + dz + math.sin(a) * sz) for a in [j / 18 * math.tau for j in range(18)]])
    fun = k.loft("funnel", fr, "paint", smooth=60)
    k.paint(fun, P.CREAM, jitter=0.012, fn=lambda c, n_, base: k.blend(P.INK, P.INK, 1) if c.z > BRIDGE + 3.5 else (k.blend(P.TERRACOTTA, P.TERRACOTTA, 1) if c.z > BRIDGE + 2.0 else k.blend(P.CREAM, P.CREAM, 1)))
    k.paint(k.tube("mast", [g(0, TOP, 6.0), g(0, TOP + 5.2, 5.6)], 0.11, "metal", seg=8, r_end=0.05), P.CREAM, jitter=0)
    k.paint(k.tube("yard", [g(-2.2, TOP + 3.6, 5.72), g(2.2, TOP + 3.6, 5.72)], 0.045, "metal", seg=6), P.CREAM, jitter=0)
    radar = k.node("PART_radar", g(0, TOP + 1.3, 6.4), role="radar", axis="y")
    k.paint(k.tube("radar_post", [g(0, TOP, 6.4), g(0, TOP + 1.3, 6.4)], 0.07, "metal", seg=6), P.CREAM, jitter=0)
    k.paint(k.bbox("radar_bar", (2.4, 0.16, 0.22), g(0, TOP + 1.4, 6.4), "metal", bevel=0.05, parent=radar), P.CREAM, jitter=0)
    k.paint(k.sphere("masthead_light", 0.1, g(0, TOP + 5.25, 5.6), "glow", subdiv=1, smooth=60), "#fff3c4", jitter=0)
    for s in (-1, 1):
        k.paint(k.sphere("sidelight", 0.11, g(s * 4.9, BRIDGE + 1.3, 8.0), "glow", subdiv=1, smooth=60), "#e24a3c" if s > 0 else "#3fbf16", jitter=0)
    k.paint(k.tube("aft_mast", [g(0, BRIDGE, -13.5), g(0, BRIDGE + 4.2, -13.9)], 0.08, "metal", seg=6, r_end=0.04), P.CREAM, jitter=0)

    # ---- Railings on every open deck -----------------------------------------------
    for s in (-1, 1):
        edge = []
        for z in [-30.4, -28, -24, -18, -12, -6, 0, 6, 12, 17, 21, 24.5, 27.5, 29.6]:
            b, yd, _, fl = at_z(z)
            edge.append((s * (b * (1 + fl) - 0.16), yd, z))
        P.railing(k, edge, h=1.1, post=1.6)
        P.railing(k, [(s * 3.9, BOAT, -19.8), (s * 3.9, BOAT, 12.8)], h=1.05, post=1.8)
        P.railing(k, [(s * 3.2, BRIDGE, -14.8), (s * 3.2, BRIDGE, 1.9)], h=1.05, post=1.8)
    b, yd, _, _ = at_z(-30.4)
    P.railing(k, [(-(b - 0.16), yd, -30.4), (b - 0.16, yd, -30.4)], h=1.1, post=1.4)
    P.railing(k, [(-3.9, BOAT, -19.8), (3.9, BOAT, -19.8)], h=1.05, post=1.6)
    P.railing(k, [(-3.9, BOAT, 12.8), (3.9, BOAT, 12.8)], h=1.05, post=1.6)
    P.railing(k, [(-3.2, BRIDGE, -14.8), (3.2, BRIDGE, -14.8)], h=1.05, post=1.6)

    # ---- Stairs between decks --------------------------------------------------------
    for s in (-1, 1):
        P.stairs(k, (s * 4.55, DECK, -15.5), (s * 4.55, BOAT, -19.3), 0.85, 11, parent=None)
        P.stairs(k, (s * 3.62, BOAT, 0.0), (s * 3.62, BRIDGE, -3.6), 0.6, 10, parent=None)

    # ---- Lifeboats on davits -----------------------------------------------------------
    for s in (-1, 1):
        for z in (-11.5, -3.5):
            lb = [P.ring(P.circle_section(r_, 10, s * 4.9, BOAT + 1.55, 1.0, 0.8), zz) for zz, r_ in ((z - 2.6, 0.12), (z - 2.1, 0.6), (z, 0.82), (z + 2.1, 0.6), (z + 2.6, 0.12))]
            o = k.loft("lifeboat", lb, "paint", smooth=60)
            k.paint(o, P.TERRACOTTA, jitter=0.01, fn=lambda c, n_, base: k.blend(P.CREAM, P.CREAM, 1) if c.z > BOAT + 1.7 else k.blend(P.TERRACOTTA, P.TERRACOTTA, 1))
            for dz in (-1.7, 1.7):
                k.paint(k.tube("davit", [g(s * 3.75, BOAT, z + dz), g(s * 3.9, BOAT + 2.5, z + dz), g(s * 4.9, BOAT + 2.75, z + dz), g(s * 4.9, BOAT + 2.3, z + dz)], 0.06, "metal", seg=6), P.CREAM, jitter=0)

    # ---- Foredeck and afterdeck ------------------------------------------------------------
    k.paint(k.bbox("hatch", (3.4, 3.6, 0.5), g(0, DECK + 0.25, 18.2), "paint", bevel=0.1), P.CREAM_SHADE, jitter=0.01)
    k.paint(k.tube("capstan", [g(0, 4.9, 26.2), g(0, 5.75, 26.2)], 0.36, "metal", seg=12, r_end=0.26), P.STEEL_DARK, jitter=0)
    k.paint(k.bbox("windlass", (2.0, 0.9, 0.7), g(0, 5.2, 24.6), "metal", bevel=0.12), P.STEEL_DARK, jitter=0.02)
    k.paint(k.tube("jackstaff", [g(0, 5.7, 30.6), g(0, 8.3, 30.9)], 0.04, "metal", seg=5), P.CREAM, jitter=0)
    for s in (-1, 1):
        for z in (23.0, -27.0, -22.5, 15.5):
            bb_, yd, _, _ = at_z(z)
            for dz in (-0.28, 0.28):
                k.paint(k.tube("bollard", [g(s * (bb_ - 0.75), yd, z + dz), g(s * (bb_ - 0.75), yd + 0.42, z + dz)], 0.12, "metal", seg=8, r_end=0.15), P.INK, jitter=0)
        k.paint(k.bbox("bench", (0.5, 2.2, 0.1), g(s * 2.6, DECK + 0.48, -25.0), "wood", bevel=0.03), P.DECK_WOOD, jitter=0.04)
        k.paint(k.bbox("bench_leg", (0.4, 1.8, 0.4), g(s * 2.6, DECK + 0.22, -25.0), "metal", bevel=0.03), P.CREAM_SHADE, jitter=0.02)
        k.paint(k.tube("anchor_pipe", [g(s * 1.05, 4.6, 29.3), g(s * 1.3, 3.7, 29.6)], 0.2, "metal", seg=8), P.INK, jitter=0)
    flag = k.node("PART_flag", g(0, DECK + 3.0, -30.2), role="flag", axis="y")
    k.paint(k.tube("flagstaff", [g(0, 4.7, -30.2), g(0, DECK + 3.2, -30.6)], 0.035, "metal", seg=5), P.CREAM, jitter=0)
    fl = k.box("flag_cloth", (0.02, 1.5, 0.9), g(0, DECK + 2.6, -31.35), "cloth", parent=flag)
    k.paint(fl, P.CREAM, jitter=0.0)

    # Gangway, stowed against the side; swings down to the quay.
    gw = k.node("PART_gangway", g(5.3, DECK, 9.0), role="gangway", axis="z", limit_deg=40)
    k.paint(k.bbox("gangway", (1.1, 5.0, 0.12), g(5.9, DECK + 0.05, 9.0), "metal", bevel=0.03, parent=gw), P.STEEL, jitter=0.02)
    P.railing(k, [(5.4, DECK + 0.1, 6.6), (5.4, DECK + 0.1, 11.4)], h=1.0, post=1.2, color=P.STEEL, parent=gw)
    P.railing(k, [(6.4, DECK + 0.1, 6.6), (6.4, DECK + 0.1, 11.4)], h=1.0, post=1.2, color=P.STEEL, parent=gw)

    # ---- Under the water: rudder and propeller -----------------------------------------------
    rud = k.node("PART_rudder", g(0, -0.4, -29.6), role="rudder", axis="y", limit_deg=35)
    k.paint(k.bbox("rudder", (0.22, 1.7, 2.5), g(0, -1.55, -30.3), "paint", bevel=0.08, parent=rud), "#8e4530", jitter=0.01)
    prop = k.node("PART_propeller", g(0, -2.2, -28.6), role="propeller", axis="z")
    k.paint(k.tube("prop_hub", [g(0, -2.2, -28.1), g(0, -2.2, -28.95)], 0.24, "metal", seg=10, r_end=0.1, parent=prop), "#c9a94e", jitter=0)
    import mathutils

    for i in range(4):
        a = i / 4 * math.tau
        o = k.bbox("prop_blade", (0.75, 0.1, 1.15), g(0, -2.2 + 0.72, -28.6), "metal", bevel=0.04, parent=prop)
        piv = g(0, -2.2, -28.6)
        o.data.transform(mathutils.Matrix.Translation(piv) @ mathutils.Matrix.Rotation(a, 4, "Y") @ mathutils.Matrix.Rotation(0.5, 4, "Z") @ mathutils.Matrix.Translation(-piv))
        k.paint(o, "#c9a94e", jitter=0.02)

    # ---- Integration data ------------------------------------------------------------------------
    for a, b in (((-4.0, -20), (-4.0, 13)), ((4.0, -20), (4.0, 13)), ((-4.0, 13), (4.0, 13)), ((-4.0, -20), (4.0, -20))):
        k.wall((a[0], -a[1]), (b[0], -b[1]), 0.15)
    k.anchor("deck_spawn", g(0, DECK, 20.5))
    k.anchor("bow", g(0, 5.6, 29.5))
    k.anchor("stern", g(0, DECK, -27.5))
    k.anchor("bridge_view", g(0, BRIDGE + 1.6, 8.6))
    k.anchor("boat_deck", g(3.6, BOAT, -17.0))
    k.anchor("gangway_foot", g(9.5, 1.2, 9.0), kind="boarding")
    k.anchor("chase", g(34, 16, -50))
    k.finish(ao_strength=0.55, ao_samples=40, ground=False)
