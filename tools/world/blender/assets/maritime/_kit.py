"""Maritime kit: harbour and deck pieces for the sea chapter.

Generic port furniture. It does not depict a specific harbour.
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from ptw import parts as P  # noqa: E402
from ptw.parts import g  # noqa: E402

QUAY_TOP = 1.6  # above the waterline (y = 0)


def quay_section(k):
    """10 m of quay wall. Water is at -x, the quay surface at +x. Tile along z."""
    L, D = 10.0, 8.0
    k.paint(k.bbox("wall", (D, L, QUAY_TOP + 3.0), g(D / 2, (QUAY_TOP - 3.0) / 2, 0), "stone", bevel=0.05, seg=1), "#b9b3a6", jitter=0.03,
            fn=lambda c, n_, base: k.blend("#b9b3a6", "#6f7a62", max(0.0, min(1.0, (0.5 - c.z) / 1.6))))
    k.paint(k.box("coping", (0.7, L, 0.12), g(0.35, QUAY_TOP + 0.03, 0), "stone"), "#d9d4c8", jitter=0.04)
    k.paint(k.box("stripe", (0.18, L, 0.02), g(0.95, QUAY_TOP + 0.012, 0), "paint"), P.MUSTARD, jitter=0.03)
    for z in (-3.3, 0.0, 3.3):
        k.paint(k.tube("fender", [g(-0.22, QUAY_TOP - 1.9, z), g(-0.22, QUAY_TOP - 0.2, z)], 0.24, "rubber", seg=8), P.RUBBER, jitter=0.03)
    for z in (-2.5, 2.5):
        k.paint(k.tube("bollard", [g(0.8, QUAY_TOP, z), g(0.8, QUAY_TOP + 0.5, z)], 0.17, "metal", seg=10, r_end=0.2), P.INK, jitter=0)
        k.paint(k.tube("bollard_cap", [g(0.8, QUAY_TOP + 0.5, z), g(0.8, QUAY_TOP + 0.6, z)], 0.27, "metal", seg=10, r_end=0.2), P.INK, jitter=0)
        k.collider(0.8, -z, 0.3)
        k.anchor(f"mooring_{'a' if z < 0 else 'b'}", g(0.8, QUAY_TOP + 0.45, z), kind="mooring")
    k.anchor("next", g(0, 0, L / 2))
    k.anchor("surface", g(4, QUAY_TOP, 0))
    k.finish(ao_strength=0.6, ao_samples=32)


def harbour_light(k):
    """A small harbour light on a stone base."""
    k.paint(k.cylinder("base", 1.5, 1.2, g(0, 0, 0), "stone", seg=12, r_top=1.35), "#b9b3a6", jitter=0.05)
    body = k.cylinder("tower", 1.0, 6.5, g(0, 1.2, 0), "plaster", seg=14, r_top=0.72)
    k.shade(body, 50)
    k.paint(body, P.CREAM, jitter=0.02, fn=lambda c, n_, base: k.blend(P.TERRACOTTA, P.TERRACOTTA, 1) if 3.4 < c.z < 5.0 else k.blend(P.CREAM, P.CREAM, 1))
    k.paint(k.cylinder("gallery", 1.15, 0.14, g(0, 7.7, 0), "metal", seg=14), P.INK, jitter=0)
    P.railing(k, [(math.cos(a) * 1.08, 7.84, math.sin(a) * 1.08) for a in [i / 10 * math.tau for i in range(11)]], h=0.8, post=0.7, color=P.INK)
    k.paint(k.cylinder("lantern", 0.55, 1.0, g(0, 7.84, 0), "glow", seg=10), "#fff3c4", jitter=0)
    k.paint(k.cylinder("cap", 0.7, 0.6, g(0, 8.84, 0), "metal", seg=10, r_top=0.06), P.GREEN, jitter=0)
    P.panel(k, "door", 0.7, 1.6, (0.0, 2.0, 0.99), "wood", P.GREEN, yaw=math.pi / 2, depth=0.06, bevel=0.03)
    k.anchor("light_00", g(0, 8.3, 0), kind="lamp")
    k.collider(0, 0, 1.5)
    k.finish(ao_strength=0.65, ao_samples=32)


def mooring_buoy(k):
    """Floats: origin on the waterline."""
    b = k.sphere("float", 0.75, g(0, 0.1, 0), "paint", subdiv=2, scale=(1, 1, 0.7), smooth=70)
    k.paint(b, P.TERRACOTTA, jitter=0.02, per_vertex=True, fn=lambda c, n_, base: k.blend("#8e4530", "#c76a48", n_.z * 0.5 + 0.5))
    k.paint(k.tube("post", [g(0, 0.5, 0), g(0, 1.5, 0)], 0.05, "metal", seg=6), P.INK, jitter=0)
    k.paint(k.sphere("topmark", 0.13, g(0, 1.6, 0), "glow", subdiv=1, smooth=60), "#fff3c4", jitter=0)
    k.paint(k.tube("ring", [g(math.cos(a) * 0.5, 0.52, math.sin(a) * 0.5) for a in [i / 12 * math.tau for i in range(13)]], 0.03, "metal", seg=4, cap=False), P.STEEL, jitter=0)
    k.anchor("light_00", g(0, 1.6, 0), kind="lamp")
    k.collider(0, 0, 0.75)
    k.finish(ao_strength=0.5, ao_samples=24, ground=False)


def deck_chair(k):
    for s in (-0.3, 0.3):
        k.paint(k.tube("frame", [g(s, 0.02, -0.55), g(s, 0.34, -0.15), g(s, 0.3, 0.75)], 0.022, "wood", seg=5), P.DECK_WOOD, jitter=0.04)
        k.paint(k.tube("back", [g(s, 0.3, -0.2), g(s, 0.95, -0.62)], 0.022, "wood", seg=5), P.DECK_WOOD, jitter=0.04)
        k.paint(k.tube("leg", [g(s, 0.02, 0.6), g(s, 0.32, 0.45)], 0.022, "wood", seg=5), P.DECK_WOOD, jitter=0.04)
    for i, col in enumerate((P.CREAM, P.GREEN, P.CREAM, P.GREEN, P.CREAM)):
        z0 = -0.15 + i * 0.18
        k.paint(k.box("sling", (0.56, 0.17, 0.02), g(0, 0.33 - i * 0.004, z0 + 0.09), "cloth"), col, jitter=0.02)
        t = (i + 0.5) / 5
        import mathutils

        o = k.box("sling_back", (0.56, 0.02, 0.15), g(0, 0.3 + 0.65 * t, -0.2 - 0.42 * t), "cloth", rot=mathutils.Matrix.Rotation(-0.57, 4, "X"))
        k.paint(o, col, jitter=0.02)
    k.collider(0, 0, 0.45)
    k.finish(ao_strength=0.5, ao_samples=24)


def life_ring_stand(k):
    k.paint(k.tube("post", [g(0, 0, 0), g(0, 1.5, 0)], 0.04, "metal", seg=6), P.CREAM, jitter=0)
    k.paint(k.bbox("board", (0.7, 0.05, 0.75), g(0, 1.2, 0.04), "paint", bevel=0.03, seg=1), P.CREAM, jitter=0)
    ring = [g(math.cos(a) * 0.26, 1.2 + math.sin(a) * 0.26, 0.1) for a in [i / 14 * math.tau for i in range(15)]]
    o = k.tube("ring", ring, 0.06, "paint", seg=6, cap=False)
    k.paint(o, P.TERRACOTTA, jitter=0, fn=lambda c, n_, base: k.blend(P.CREAM, P.TERRACOTTA, 1.0 if (abs(c.x) > 0.09 and abs(c.z - 1.2) > 0.09) else 0.0))
    k.collider(0, 0, 0.2)
    k.finish(ao_strength=0.5, ao_samples=24)


def cargo_crate(k):
    """Stackable crate, 1.2 m. Doubles as the contract's simplest reference asset."""
    k.paint(k.bbox("crate", (1.2, 1.2, 1.2), g(0, 0.6, 0), "wood", bevel=0.03, seg=1), "#b98f5e", jitter=0.05)
    for s in (-1, 1):
        for a in (-0.42, 0, 0.42):
            P.panel(k, "slat", 0.12, 1.16, (s * 0.6, 0.6, a), "wood", "#8a6a45", yaw=0 if s > 0 else math.pi, depth=0.04, bevel=0.0, jitter=0.06)
            P.panel(k, "slat", 0.12, 1.16, (a, 0.6, s * 0.6), "wood", "#8a6a45", yaw=s * math.pi / 2, depth=0.04, bevel=0.0, jitter=0.06)
    k.collider(0, 0, 0.75)
    k.anchor("top", g(0, 1.2, 0))
    k.finish(ao_strength=0.7, ao_samples=24)


BUILDERS = {f.__name__: f for f in (quay_section, harbour_light, mooring_buoy, deck_chair, life_ring_stand, cargo_crate)}
BUDGET = {}
