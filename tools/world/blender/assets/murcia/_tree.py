"""Shared builder for the huerta lemon tree (near and far versions)."""

import math

from mathutils import Vector

BARK = "#6b4a2e"
BARK_LIGHT = "#8a6a48"
LEAF_DARK = "#2f5a2c"
LEAF = "#4f8238"
LEAF_SUN = "#86b04a"
LEMON = "#f4d326"


def make(k, detail=2):
    """detail 2 = full tree beside the road, 1 = lighter tree for the distance."""
    r = k.rng
    height = 2.5 + r.random() * 0.25
    fork = 1.05 + r.random() * 0.15
    lean = Vector(((r.random() - 0.5) * 0.3, (r.random() - 0.5) * 0.3, 0))

    def bark(c, n, base):
        return k.blend(BARK, BARK_LIGHT, 0.5 + n.x * 0.5)

    top = Vector((lean.x, lean.y, fork))
    trunk = k.tube("trunk", [(0, 0, -0.15), (lean.x * 0.3, lean.y * 0.3, fork * 0.5), top], 0.17, "wood", seg=7 if detail > 1 else 5, r_end=0.11, cap=False)
    k.paint(trunk, BARK, jitter=0.1, fn=bark)

    centre = top + Vector((0, 0, 0.95))
    rx = 1.42 + r.random() * 0.2
    rz = 1.08 + r.random() * 0.12

    def leaf(c, n, base):
        # Painted light: sunlit crown, deep green underside.
        up = n.z * 0.5 + 0.5
        col = k.blend(LEAF_DARK, LEAF, min(1.0, up * 1.3))
        if n.z > 0.35:
            sun = k.blend(LEAF, LEAF_SUN, 1.0)
            t = min(1.0, (n.z - 0.35) * 1.25)
            col = tuple(a + (b - a) * t for a, b in zip(col, sun))
        return col

    def sway(co):
        return min(1.0, max(0.0, (co.z - fork * 0.8) / 1.7) * 0.7 + (Vector((co.x, co.y, 0)).length / 2.3) * 0.35)

    # Branches reach just far enough to be seen under the crown.
    for i in range(4 if detail > 1 else 0):
        a = i / 4 * math.tau + r.random() * 0.7
        tip = top + Vector((math.cos(a) * 0.8, math.sin(a) * 0.8, 0.5 + r.random() * 0.2))
        k.paint(k.tube("branch", [top, top + (tip - top) * 0.5 + Vector((0, 0, 0.1)), tip], 0.08, "wood", seg=5, r_end=0.035, cap=False), BARK, jitter=0.1, fn=bark)

    crown = k.sphere("crown", 1.0, centre, "foliage", subdiv=3 if detail > 1 else 2, scale=(rx, rx * (0.92 + r.random() * 0.12), rz), noise=0.13, freq=1.5, smooth=80)
    k.paint(crown, LEAF, jitter=0.07, fn=leaf, sway=sway, per_vertex=True)

    # Smaller clumps break the outline so no two trees share a silhouette.
    clumps = 7 if detail > 1 else 2
    for i in range(clumps):
        a = i / clumps * math.tau + r.random() * 0.5
        el = -0.15 + r.random() * 0.75
        d = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
        pos = centre + Vector((d.x * rx * 0.86, d.y * rx * 0.86, d.z * rz * 0.86))
        o = k.sphere("clump", 0.46 + r.random() * 0.2, pos, "foliage", subdiv=2 if detail > 1 else 1, scale=(1, 1, 0.8), noise=0.12, freq=1.8, smooth=80)
        k.paint(o, LEAF, jitter=0.07, fn=leaf, sway=sway, per_vertex=True)

    # Lemons sit on the surface of the crown, where they catch the light.
    lemons = 13 if detail > 1 else 6
    for i in range(lemons):
        a = i / lemons * math.tau + r.random() * 0.4
        el = -0.55 + r.random() * 0.95
        d = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
        pos = centre + Vector((d.x * rx * 1.02, d.y * rx * 1.02, d.z * rz * 1.02))
        o = k.sphere("lemon", 0.105, pos, "foliage", subdiv=1, scale=(0.84, 0.84, 1.18), smooth=70 if detail > 1 else 0)
        k.paint(o, LEMON, jitter=0, fn=lambda c, n, base: k.blend("#d2a915", LEMON, min(1.0, n.z * 0.6 + 0.7)), sway=sway, per_vertex=True)

    k.collider(0, 0, 0.42)
    k.anchor("canopy", tuple(centre))
    k.finish(ao_strength=0.7, ao_samples=48)
