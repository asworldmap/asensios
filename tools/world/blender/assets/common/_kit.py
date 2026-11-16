"""Common kit: street furniture and small props usable in any chapter."""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from ptw import parts as P  # noqa: E402
from ptw.parts import g  # noqa: E402


def street_lamp(k):
    k.paint(k.cylinder("foot", 0.16, 0.5, g(0, 0, 0), "metal", seg=8, r_top=0.08), P.INK, jitter=0)
    k.paint(k.tube("post", [g(0, 0.5, 0), g(0, 3.3, 0)], 0.05, "metal", seg=8, r_end=0.035), P.INK, jitter=0)
    k.paint(k.tube("arm", [g(0, 3.3, 0), g(0, 3.65, 0.18), g(0, 3.6, 0.5)], 0.03, "metal", seg=6), P.INK, jitter=0)
    k.paint(k.cylinder("shade", 0.26, 0.2, g(0, 3.42, 0.5), "metal", seg=8, r_top=0.05), P.INK, jitter=0)
    k.paint(k.cylinder("glass", 0.13, 0.26, g(0, 3.18, 0.5), "glow", seg=6, r_top=0.19), P.LAMP, jitter=0)
    k.anchor("light_00", g(0, 3.3, 0.5), kind="lamp")
    k.collider(0, 0, 0.18)
    k.finish(ao_strength=0.5, ao_samples=24)


def park_bench(k):
    for i in range(4):
        k.paint(k.bbox("slat", (1.8, 0.1, 0.04), g(0, 0.46, -0.16 + i * 0.12), "wood", bevel=0.01, seg=1), P.DECK_WOOD, jitter=0.07)
    for i in range(3):
        import mathutils

        o = k.bbox("back_slat", (1.8, 0.04, 0.1), g(0, 0.62 + i * 0.13, -0.3 - i * 0.03), "wood", bevel=0.01, seg=1, rot=mathutils.Matrix.Rotation(0.22, 4, "X"))
        k.paint(o, P.DECK_WOOD, jitter=0.07)
    for sx in (-0.75, 0.75):
        k.paint(k.tube("leg", [g(sx, 0, 0.2), g(sx, 0.44, 0.18), g(sx, 0.44, -0.26), g(sx, 0.95, -0.38)], 0.03, "metal", seg=5), P.INK, jitter=0)
        k.paint(k.tube("leg_back", [g(sx, 0, -0.3), g(sx, 0.44, -0.26)], 0.03, "metal", seg=5), P.INK, jitter=0)
    k.wall((-0.9, 0.0), (0.9, 0.0), 0.3)
    k.anchor("seat", g(0, 0.5, 0))
    k.finish(ao_strength=0.6, ao_samples=24)


def planter(k):
    k.paint(k.cylinder("pot", 0.55, 0.6, g(0, 0, 0), "terracotta", seg=10, r_top=0.7), "#b86a48", jitter=0.04)
    k.paint(k.cylinder("lip", 0.74, 0.08, g(0, 0.58, 0), "terracotta", seg=10), "#a94f35", jitter=0.03)
    b = k.sphere("bush", 0.75, g(0, 1.1, 0), "foliage", subdiv=2, scale=(1, 1, 0.85), noise=0.14, smooth=75)
    k.paint(b, "#4f8238", jitter=0.08, per_vertex=True, sway=lambda co: 0.45, fn=lambda c, n_, base: k.blend("#2f5a2c", "#86b04a", n_.z * 0.5 + 0.5))
    for i in range(6):
        a = i / 6 * math.tau + 0.3
        f = k.sphere("flower", 0.13, g(math.cos(a) * 0.55, 1.35 + 0.2 * math.sin(i * 2.1), math.sin(a) * 0.55), "foliage", subdiv=1, smooth=60)
        k.paint(f, ("#c9463d", "#e08a9a", "#f4d326")[i % 3], jitter=0.05, per_vertex=True, sway=lambda co: 0.5)
    k.collider(0, 0, 0.7)
    k.finish(ao_strength=0.65, ao_samples=24)


def signpost(k):
    """Three blank finger boards on a post. The engine writes the destinations (ANCHOR_label_*)."""
    k.paint(k.tube("post", [g(0, -0.2, 0), g(0, 3.1, 0)], 0.06, "wood", seg=6), "#6b4a2e", jitter=0.05)
    import mathutils

    for i, (yaw, col) in enumerate(((0.3, P.GREEN), (-1.9, P.TERRACOTTA), (2.6, "#3d6480"))):
        y = 2.75 - i * 0.42
        rot = mathutils.Matrix.Rotation(-yaw, 4, "Z")
        o = k.bbox("board", (0.05, 1.3, 0.3), g(math.cos(yaw) * 0.0 + math.sin(yaw) * 0.7 * 0, y, 0) + rot @ mathutils.Vector((0, -0.72, 0)), "paint", bevel=0.02, seg=1, rot=rot)
        k.paint(o, col, jitter=0.02)
        k.anchor(f"label_{i}", (rot @ mathutils.Vector((0.03, -0.72, 0))) + g(0, y, 0), kind="label", yaw=round(yaw, 3))
    k.collider(0, 0, 0.18)
    k.finish(ao_strength=0.5, ao_samples=24)


BUILDERS = {f.__name__: f for f in (street_lamp, park_bench, planter, signpost)}
BUDGET = {}
