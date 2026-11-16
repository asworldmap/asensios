"""Europe kit: railway, station, road and forest pieces. All modular, all batched.

Rail pieces are 10 m long and centred, so they tile along z. Track gauge and
rail-top height (y = 0) match the train.
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from ptw import parts as P  # noqa: E402
from ptw.parts import g  # noqa: E402

GAUGE = 1.435
RAIL_TOP = 0.0  # rail top is the origin plane; ballast sits below it
MODULE = 10.0


def rail_track_straight(k):
    y_bal = -0.34
    sec = [(-2.3, -0.75), (-1.55, y_bal), (1.55, y_bal), (2.3, -0.75)]
    o = k.loft("ballast", [[g(x, y, z) for x, y in sec] for z in (-MODULE / 2, MODULE / 2)], "earth", closed=False, cap=(False, False), smooth=0)
    k.paint(o, "#9d927f", jitter=0.06)
    n = 16
    for i in range(n):
        z = -MODULE / 2 + (i + 0.5) * MODULE / n
        k.paint(k.box("sleeper", (2.5, 0.24, 0.16), g(0, y_bal + 0.07, z), "wood"), "#6b513a", jitter=0.1)
    prof = [(-0.07, -0.17), (0.07, -0.17), (0.07, -0.14), (0.018, -0.12), (0.018, -0.045), (0.036, -0.03), (0.036, 0.0), (-0.036, 0.0), (-0.036, -0.03), (-0.018, -0.045), (-0.018, -0.12), (-0.07, -0.14)]
    for s in (-1, 1):
        r = k.loft("rail", [[g(s * (GAUGE / 2 + 0.036) + x, y, z) for x, y in prof] for z in (-MODULE / 2, MODULE / 2)], "metal", smooth=0)
        k.paint(r, "#5d5850", jitter=0.0, fn=lambda c, n_, base: k.blend("#5d5850", "#c9c4b8", 1.0 if n_.z > 0.9 else 0.0))
    k.anchor("next", g(0, 0, MODULE / 2))
    k.finish(ao_strength=0.7, ao_samples=32)


def rail_platform(k):
    h = 0.92  # platform height above rail top
    x0 = GAUGE / 2 + 0.95  # platform edge, clear of the train
    w = 4.2
    k.paint(k.bbox("slab", (w, MODULE, h + 0.75), g(x0 + w / 2, (h - 0.75) / 2, 0), "stone", bevel=0.04, seg=1), "#cfc4ad", jitter=0.03)
    for i in range(10):
        z = -MODULE / 2 + (i + 0.5)
        k.paint(k.box("paver", (w - 0.9, 0.96, 0.02), g(x0 + 0.7 + (w - 0.9) / 2, h + 0.005, z), "stone"), "#d9cfb8", jitter=0.07)
    k.paint(k.box("edge", (0.3, MODULE, 0.025), g(x0 + 0.15, h + 0.008, 0), "stone"), "#efe6d2", jitter=0)
    k.paint(k.box("tactile", (0.32, MODULE, 0.03), g(x0 + 0.55, h + 0.01, 0), "paint"), P.MUSTARD, jitter=0.03)
    k.wall((x0 + w, MODULE / 2), (x0 + w, -MODULE / 2), 0.15)
    k.anchor("boarding", g(x0 + 1.4, h, 0), kind="boarding")
    k.anchor("next", g(0, 0, MODULE / 2))
    k.finish(ao_strength=0.7, ao_samples=32)


def station_shelter(k):
    """Stands on a platform: origin at platform level, open side faces +x (the track is at -x)."""
    for z in (-2.4, 2.4):
        k.paint(k.bbox("post", (0.12, 0.12, 2.6), g(0.9, 1.3, z), "metal", bevel=0.02, seg=1), P.GREEN, jitter=0)
        k.paint(k.tube("brace", [g(0.9, 2.2, z), g(-0.4, 2.65, z)], 0.035, "metal", seg=5), P.GREEN, jitter=0)
    roof = k.bbox("roof", (2.9, 5.8, 0.1), g(-0.1, 2.72, 0), "paint", bevel=0.04, seg=1)
    k.paint(roof, P.CREAM, jitter=0.02, fn=lambda c, n_, base: k.blend(P.TERRACOTTA, P.TERRACOTTA, 1) if n_.z > 0.5 else k.blend(P.CREAM, P.CREAM, 1))
    P.panel(k, "back", 4.9, 1.5, (1.0, 1.55, 0), "window", P.GLASS_DARK, yaw=0, depth=0.04, bevel=0.02)
    k.paint(k.bbox("bench", (0.45, 3.2, 0.07), g(0.6, 0.48, 0), "wood", bevel=0.02, seg=1), P.DECK_WOOD, jitter=0.05)
    for z in (-1.3, 1.3):
        k.paint(k.bbox("bench_leg", (0.36, 0.08, 0.46), g(0.6, 0.23, z), "metal", bevel=0.02, seg=1), P.GREEN, jitter=0)
    k.paint(k.bbox("sign", (0.06, 1.9, 0.42), g(-1.2, 2.38, 0), "paint", bevel=0.02, seg=1), P.GREEN, jitter=0)  # blank: the engine writes the name
    k.anchor("sign", g(-1.24, 2.38, 0), kind="label")
    P.lamp(k, (-0.2, 2.62, 0), 0.1, name="lamp")
    k.anchor("light_00", g(-0.2, 2.5, 0), kind="lamp")
    k.collider(0.9, 2.4, 0.15)
    k.collider(0.9, -2.4, 0.15)
    k.finish(ao_strength=0.7, ao_samples=32)


def rail_signal(k):
    k.paint(k.bbox("base", (0.5, 0.5, 0.3), g(0, -0.2, 0), "stone", bevel=0.03, seg=1), "#b9b3a6", jitter=0.03)
    k.paint(k.tube("mast", [g(0, -0.05, 0), g(0, 4.6, 0)], 0.07, "metal", seg=8), "#d9d4c8", jitter=0)
    k.paint(k.bbox("head", (0.42, 0.2, 1.15), g(0, 4.2, 0.12), "metal", bevel=0.06), P.INK, jitter=0)
    for i, col in enumerate(("#3fbf16", P.MUSTARD, "#e24a3c")):
        y = 3.85 + i * 0.35
        k.paint(k.tube("hood", [g(0, y + 0.03, 0.22), g(0, y + 0.07, 0.4)], 0.13, "metal", seg=8, cap=False), P.INK, jitter=0)
        k.paint(k.tube("aspect", [g(0, y, 0.22), g(0, y, 0.24)], 0.09, "glow", seg=10), col, jitter=0)
        k.anchor(f"aspect_{('green', 'amber', 'red')[i]}", g(0, y, 0.26), kind="signal")
    for i in range(9):
        k.paint(k.tube("rung", [g(-0.16, 0.5 + i * 0.4, -0.12), g(0.16, 0.5 + i * 0.4, -0.12)], 0.012, "metal", seg=4), "#d9d4c8", jitter=0)
    for s in (-1, 1):
        k.paint(k.tube("ladder", [g(s * 0.16, 0.2, -0.12), g(s * 0.16, 3.9, -0.12)], 0.016, "metal", seg=4), "#d9d4c8", jitter=0)
    k.collider(0, 0, 0.3)
    k.finish(ao_strength=0.6, ao_samples=32)


def catenary_mast(k):
    """Overhead-line mast for one track; the wire anchor is where a pantograph runs."""
    x = 3.1
    k.paint(k.tube("mast", [g(x, -0.6, 0), g(x, 6.6, 0)], 0.11, "metal", seg=8, r_end=0.08), "#8f958e", jitter=0)
    k.paint(k.tube("arm", [g(x, 6.0, 0), g(0.1, 5.9, 0)], 0.04, "metal", seg=6), "#8f958e", jitter=0)
    k.paint(k.tube("stay", [g(x, 6.55, 0), g(1.2, 5.95, 0)], 0.022, "metal", seg=4), "#8f958e", jitter=0)
    k.paint(k.tube("dropper", [g(0.1, 5.9, 0), g(0.0, 5.3, 0)], 0.022, "metal", seg=4), "#8f958e", jitter=0)
    k.paint(k.tube("insulator", [g(x - 0.5, 6.0, 0), g(x - 0.9, 5.98, 0)], 0.06, "metal", seg=8), P.TERRACOTTA, jitter=0)
    k.anchor("wire", g(0, 5.3, 0), kind="wire")
    k.collider(x, 0, 0.2)
    k.finish(ao_strength=0.5, ao_samples=24)


def conifer(k):
    r = k.rng
    h = 7.5 + r.random() * 1.5
    k.paint(k.tube("trunk", [g(0, -0.2, 0), g(0, h * 0.55, 0)], 0.2, "wood", seg=6, r_end=0.07, cap=False), "#5a4030", jitter=0.08)
    tiers = 6
    sway = lambda co: min(1.0, max(0.0, co.z / h) * 0.7)
    for i in range(tiers):
        t = i / (tiers - 1)
        y0 = 1.3 + t * (h - 2.6)
        rad = 2.3 * (1 - t) ** 0.8 + 0.35
        o = k.cylinder("tier", rad, 2.4 - t * 0.6, g(0, y0, 0), "foliage", seg=9, r_top=0.08)
        # Ragged skirts: push alternate rim vertices out and down.
        for vi, v in enumerate(o.data.vertices):
            if v.co.z < y0 + 0.1 and (abs(v.co.x) + abs(v.co.y)) > 0.01:
                f = 1.0 + (0.16 if vi % 2 else -0.08) + (r.random() - 0.5) * 0.12
                v.co.x *= f
                v.co.y *= f
                v.co.z -= 0.25 if vi % 2 else 0.0
        k.shade(o, 60)
        k.paint(o, "#2f5a36", jitter=0.06, per_vertex=True, sway=sway, fn=lambda c, n_, base: k.blend("#1f3f27", "#3f7446", min(1.0, max(0.0, n_.z * 0.6 + 0.55))))
    k.collider(0, 0, 0.35)
    k.finish(ao_strength=0.65, ao_samples=32)


def road_guardrail(k):
    L = 4.0
    prof = [(0.0, 0.0), (0.045, 0.06), (0.0, 0.12), (0.045, 0.18), (0.0, 0.24), (-0.02, 0.24), (-0.02, 0.0)]
    o = k.loft("beam", [[g(x, 0.48 + y, z) for x, y in prof] for z in (-L / 2, L / 2)], "metal", smooth=0)
    k.paint(o, "#b9b3a6", jitter=0.02)
    for z in (-1.5, 0.0, 1.5):
        k.paint(k.bbox("post", (0.08, 0.1, 0.85), g(-0.07, 0.3, z), "metal", bevel=0.01, seg=1), "#8f958e", jitter=0)
    k.wall((0, L / 2), (0, -L / 2), 0.12)
    k.anchor("next", g(0, 0, L / 2))
    k.finish(ao_strength=0.5, ao_samples=24)


def road_sign(k):
    """A blank warning triangle and a blank round sign on one post. No text: the engine labels them."""
    k.paint(k.tube("post", [g(0, -0.3, 0), g(0, 2.9, 0)], 0.035, "metal", seg=6), "#b9b3a6", jitter=0)
    tri = [g(math.sin(a) * 0.5, 2.35 + math.cos(a) * 0.5, 0.045) for a in (0, math.tau / 3, 2 * math.tau / 3)]
    k.paint(k.loft("tri_border", [[p_ for p_ in tri], [g(math.sin(a) * 0.5, 2.35 + math.cos(a) * 0.5, 0.03) for a in (0, math.tau / 3, 2 * math.tau / 3)]], "paint", smooth=0), "#c9463d", jitter=0)
    tri2 = [g(math.sin(a) * 0.36, 2.35 + math.cos(a) * 0.36, 0.05) for a in (0, math.tau / 3, 2 * math.tau / 3)]
    k.paint(k.loft("tri_face", [tri2, [g(math.sin(a) * 0.36, 2.35 + math.cos(a) * 0.36, 0.046) for a in (0, math.tau / 3, 2 * math.tau / 3)]], "paint", smooth=0), P.CREAM, jitter=0)
    k.paint(k.tube("disc", [g(0, 1.45, 0.03), g(0, 1.45, 0.05)], 0.33, "paint", seg=16), "#3d6480", jitter=0)
    k.paint(k.tube("disc_face", [g(0, 1.45, 0.05), g(0, 1.45, 0.056)], 0.26, "paint", seg=16), P.CREAM, jitter=0)
    k.anchor("label_top", g(0, 2.3, 0.06), kind="label")
    k.anchor("label_bottom", g(0, 1.45, 0.06), kind="label")
    k.collider(0, 0, 0.12)
    k.finish(ao_strength=0.4, ao_samples=24)


BUILDERS = {f.__name__: f for f in (rail_track_straight, rail_platform, station_shelter, rail_signal, catenary_mast, conifer, road_guardrail, road_sign)}
BUDGET = {"conifer": 900}
