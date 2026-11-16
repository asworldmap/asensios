"""Chile kit: Andean landscape pieces.

Landscape only. The araucaria is included because it is Chile's national tree
(Araucaria araucana); everything else is generic mountain scenery. No specific
place or building is depicted — those wait for verified references.
"""

import math
import os
import sys

from mathutils import Vector
from mathutils import noise as mnoise

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from ptw import parts as P  # noqa: E402
from ptw.parts import g  # noqa: E402


def andes_peak(k):
    """Backdrop mountain, ~70 m across and 46 m tall, snow above the line. Place far, scale freely."""
    r = k.rng
    off = Vector((r.random() * 30, r.random() * 30, r.random() * 30))
    rings = []
    levels = 9
    n = 16
    H = 46.0
    for i in range(levels):
        t = i / (levels - 1)
        rad = 35.0 * (1 - t) ** 1.25 + 0.6
        ring = []
        for j in range(n):
            a = j / n * math.tau
            d = Vector((math.cos(a), math.sin(a), t * 2.0))
            rr = rad * (1 + 0.3 * mnoise.noise(d * 1.6 + off) + 0.14 * mnoise.noise(d * 4.1 + off))
            ridge = 1 + 0.16 * math.sin(a * 3 + off.x)
            ring.append(g(math.cos(a) * rr * ridge + 3.0 * t, H * t**0.9 - 1.5, math.sin(a) * rr * ridge - 2.0 * t))
        rings.append(ring)
    o = k.loft("peak", rings, "earth", cap=(False, True), smooth=35)

    def paint(c, n_, base):
        h = c.z / H
        snow = h + 0.12 * mnoise.noise(Vector((c.x, c.y, 0)) * 0.12 + off) + (n_.z - 0.5) * 0.18
        if snow > 0.62:
            return k.blend("#e9eef0", "#ffffff", min(1.0, n_.z + 0.3))
        rock = k.blend("#8d7f73", "#a3907c", n_.z * 0.5 + 0.5)
        return rock if h > 0.25 else k.blend("#9a8a6c", "#8f8f62", 1 - h / 0.25)

    k.paint(o, "#8d7f73", jitter=0.05, fn=paint, per_vertex=True)
    k.finish(ao_strength=0.55, ao_samples=32, ground=False)


def rock_outcrop(k):
    r = k.rng
    for i in range(5):
        s = 0.8 + r.random() * 1.3
        pos = g((r.random() - 0.5) * 2.6, s * 0.35, (r.random() - 0.5) * 2.6)
        o = k.sphere("rock", s, pos, "stone", subdiv=2, scale=(1.0, 0.9, 0.6 + r.random() * 0.3), noise=0.22, freq=1.2, smooth=28)
        k.paint(o, "#9a8d7e", jitter=0.08, fn=lambda c, n_, base: k.blend("#7d7166", "#b3a593", n_.z * 0.5 + 0.5))
    k.collider(0, 0, 1.9)
    k.finish(ao_strength=0.7, ao_samples=32)


def araucaria(k):
    """Monkey-puzzle tree: straight trunk, an umbrella of upswept branches at the top."""
    r = k.rng
    h = 11.0 + r.random() * 2.0
    k.paint(k.tube("trunk", [g(0, -0.2, 0), g(0.1, h * 0.5, 0), g(0, h, 0)], 0.32, "wood", seg=8, r_end=0.12, cap=False), "#5f4a3a", jitter=0.08,
            fn=lambda c, n_, base: k.blend("#4f3d30", "#7a6350", 0.5 + 0.5 * math.sin(c.z * 7)))
    sway = lambda co: min(1.0, max(0.0, (co.z - h * 0.5) / h) * 0.6)
    tiers = 5
    for ti in range(tiers):
        y = h * (0.6 + 0.4 * ti / (tiers - 1))
        reach = 3.6 * (1 - 0.62 * ti / (tiers - 1))
        arms = 7 - ti
        for j in range(arms):
            a = j / arms * math.tau + ti * 0.5 + r.random() * 0.2
            tip = g(math.cos(a) * reach, y + reach * 0.42, math.sin(a) * reach)
            mid = g(math.cos(a) * reach * 0.6, y - 0.1, math.sin(a) * reach * 0.6)
            o = k.tube("branch", [g(0, y, 0), mid, tip], 0.2, "foliage", seg=5, r_end=0.26, cap=True)
            k.paint(o, "#2f5a36", jitter=0.06, per_vertex=True, sway=sway, fn=lambda c, n_, base: k.blend("#1f3f27", "#4a7a45", min(1.0, max(0.0, n_.z * 0.6 + 0.5))))
            tuft = k.sphere("tuft", 0.5, tip, "foliage", subdiv=1, scale=(1, 1, 0.9), noise=0.12, smooth=60)
            k.paint(tuft, "#35643b", jitter=0.06, per_vertex=True, sway=sway)
    k.collider(0, 0, 0.45)
    k.finish(ao_strength=0.6, ao_samples=32)


def tussock_grass(k):
    """A clump of mountain grass (the high Andean steppe is covered in these)."""
    r = k.rng
    sway = lambda co: min(1.0, co.z / 0.9)
    for i in range(16):
        a = r.random() * math.tau
        d = r.random() * 0.3
        lean = 0.25 + r.random() * 0.4
        base = g(math.cos(a) * d, 0, math.sin(a) * d)
        tip = g(math.cos(a) * (d + lean), 0.55 + r.random() * 0.4, math.sin(a) * (d + lean))
        o = k.tube("blade", [base, (base + tip) / 2 + Vector((0, 0, 0.1)), tip], 0.035, "foliage", seg=3, r_end=0.004, cap=False)
        k.paint(o, "#c2b26a", jitter=0.1, per_vertex=True, sway=sway, fn=lambda c, n_, base_: k.blend("#8f8a4a", "#d8c97c", min(1.0, c.z / 0.8)))
    k.finish(ao_strength=0.4, ao_samples=16)


BUILDERS = {f.__name__: f for f in (andes_peak, rock_outcrop, araucaria, tussock_grass)}
BUDGET = {"araucaria": 2600}
