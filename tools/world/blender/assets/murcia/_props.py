"""Murcia kit additions: huerta and old-town props."""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from ptw import parts as P  # noqa: E402
from ptw.parts import g  # noqa: E402


def palm_tree(k):
    r = k.rng
    h = 6.2 + r.random() * 1.2
    lean = (r.random() - 0.5) * 0.9
    pts = [g(lean * t * t, h * t, 0) for t in (0, 0.25, 0.5, 0.75, 1.0)]
    tr = k.tube("trunk", pts, 0.26, "wood", seg=8, r_end=0.17, cap=False)
    k.paint(tr, "#8a6a45", jitter=0.06, fn=lambda c, n_, base: k.blend("#6f5236", "#a08058", 0.5 + 0.5 * math.sin(c.z * 11)))
    top = g(lean, h, 0)
    sway = lambda co: min(1.0, 0.35 + ((co - top).length / 3.2) * 0.65)
    k.paint(k.sphere("crown", 0.42, top, "wood", subdiv=1, smooth=60), "#6b4a2e", jitter=0.05)
    for i in range(11):
        a = i / 11 * math.tau + r.random() * 0.2
        droop = 0.9 + r.random() * 0.5
        L = 2.9 + r.random() * 0.5
        rib = [top + g(math.cos(a) * L * t, 0.9 * math.sin(t * 2.0) * 0.9 - droop * t * t, math.sin(a) * L * t) for t in (0, 0.3, 0.6, 0.85, 1.0)]
        # A frond is a ribbon: two sheets hanging either side of the rib.
        side = g(-math.sin(a), 0, math.cos(a))
        for sgn in (-1, 1):
            rows = [[q, q + side * sgn * (0.55 * math.sin(math.pi * min(1.0, 0.12 + 0.88 * t))) + g(0, -0.22, 0)] for q, t in zip(rib, (0, 0.3, 0.6, 0.85, 1.0))]
            o = k.loft("frond", rows, "foliage", closed=False, cap=(False, False), smooth=40)
            o.data.materials[0].use_backface_culling = False
            k.paint(o, "#4f7c3e", jitter=0.07, per_vertex=True, sway=sway, fn=lambda c, n_, base: k.blend("#3a6332", "#7fae48", min(1.0, max(0.0, 0.5 + n_.z * 0.5))))
    for i in range(5):
        a = i / 5 * math.tau
        k.paint(k.sphere("dates", 0.16, top + g(math.cos(a) * 0.4, -0.45, math.sin(a) * 0.4), "foliage", subdiv=1, smooth=60), "#d9a441", jitter=0.06, per_vertex=True, sway=lambda co: 0.3)
    k.collider(0, 0, 0.32)
    k.finish(ao_strength=0.6, ao_samples=32)


def stone_wall(k):
    """4 m of dry-stone field wall. Tile along z."""
    r = k.rng
    L = 4.0
    tones = ["#cdb48a", "#bfa67c", "#d8c39a", "#b59b72"]
    for course in range(3):
        z = -L / 2
        while z < L / 2 - 0.05:
            w = min(0.42 + r.random() * 0.4, L / 2 - z)
            hgt = 0.26 + r.random() * 0.06
            o = k.bbox("stone", (0.44 + r.random() * 0.08, w - 0.02, hgt), g((r.random() - 0.5) * 0.05, 0.14 + course * 0.28, z + w / 2), "stone", bevel=0.05, seg=1)
            k.paint(o, tones[r.randrange(4)], jitter=0.06)
            z += w
    k.wall((0, L / 2), (0, -L / 2), 0.28)
    k.anchor("next", g(0, 0, L / 2))
    k.finish(ao_strength=0.75, ao_samples=32)


def fountain(k):
    k.paint(k.cylinder("basin", 2.2, 0.55, g(0, 0, 0), "stone", seg=16, r_top=2.3), "#cdb48a", jitter=0.05)
    k.paint(k.cylinder("water", 2.0, 0.04, g(0, 0.5, 0), "paint", seg=16), "#6fb0a4", jitter=0.02)
    k.paint(k.cylinder("rim", 2.38, 0.1, g(0, 0.55, 0), "stone", seg=16), "#dccaa4", jitter=0.04)
    k.paint(k.cylinder("stem", 0.3, 1.3, g(0, 0.5, 0), "stone", seg=10, r_top=0.2), "#cdb48a", jitter=0.04)
    k.paint(k.cylinder("bowl", 0.35, 0.3, g(0, 1.8, 0), "stone", seg=12, r_top=1.0), "#dccaa4", jitter=0.04)
    k.paint(k.cylinder("bowl_water", 0.9, 0.03, g(0, 2.08, 0), "paint", seg=12), "#6fb0a4", jitter=0.02)
    k.paint(k.cylinder("finial", 0.12, 0.6, g(0, 2.05, 0), "stone", seg=8, r_top=0.03), "#cdb48a", jitter=0.03)
    k.anchor("water", g(0, 2.6, 0), kind="emitter")
    k.collider(0, 0, 2.4)
    k.finish(ao_strength=0.7, ao_samples=32)


def orange_crate(k):
    """A market crate of oranges — the huerta's other fruit."""
    k.paint(k.bbox("crate", (0.62, 0.42, 0.26), g(0, 0.13, 0), "wood", bevel=0.015, seg=1), "#b98f5e", jitter=0.06)
    r = k.rng
    for i in range(9):
        x, z = -0.2 + (i % 3) * 0.2, -0.12 + (i // 3) * 0.12
        o = k.sphere("orange", 0.085, g(x + (r.random() - 0.5) * 0.03, 0.3 + (r.random() * 0.03), z), "foliage", subdiv=1, smooth=70)
        k.paint(o, "#e58a2b", jitter=0.06, per_vertex=True, sway=lambda co: 0.0)
    k.collider(0, 0, 0.4)
    k.finish(ao_strength=0.7, ao_samples=24)


BUILDERS = {f.__name__: f for f in (palm_tree, stone_wall, fountain, orange_crate)}
BUDGET = {"palm_tree": 1500}
