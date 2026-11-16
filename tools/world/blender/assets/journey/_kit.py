"""Journey — the only new pieces the five transitions need: clouds.

Everything else in the transitions is built from the existing library.
"""

import math
import os
import sys

import bmesh
from mathutils import Vector
from mathutils import noise as mnoise

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from ptw.parts import g  # noqa: E402

TOP, MID, BASE = "#ffffff", "#eef1f4", "#b4c0d0"


def _cloud_paint(k, lo, hi):
    def fn(c, n_, base):
        t = min(1.0, max(0.0, (c.z - lo) / (hi - lo)))
        lit = min(1.0, max(0.0, 0.5 + 0.5 * n_.z))
        return k.blend(BASE, k.blend(MID, TOP, lit) if False else TOP, min(1.0, 0.25 + 0.5 * t + 0.35 * lit))
    return fn


def cloud_bank(k):
    """A cumulus mass, 34 m across and 14 m tall, flat underneath. Scale 3-8
    and scatter; it is meant to be flown past and through."""
    r = k.rng
    blobs = [(0, 5.5, 0, 7.0)]
    for i in range(9):
        a = i / 9 * math.tau + r.random() * 0.5
        d = 6.5 + r.random() * 5.5
        blobs.append((math.cos(a) * d * 1.25, 3.2 + r.random() * 3.0, math.sin(a) * d * 0.8, 3.6 + r.random() * 2.6))
    for x, y, z, rad in blobs:
        o = k.sphere("puff", rad, g(x, y, z), "plaster", subdiv=3 if rad > 6 else 2, scale=(1.15, 1.0, 0.78), noise=0.2, freq=0.5, smooth=80)
        for v in o.data.vertices:  # flatten the base
            if v.co.z < 1.2:
                v.co.z = 1.2 + (v.co.z - 1.2) * 0.2
        k.paint(o, MID, jitter=0.0, per_vertex=True, fn=_cloud_paint(k, 0.5, 11.0))
    k.anchor("core", g(0, 5.5, 0), kind="placement", note="fly the camera through here for a white-out")
    k.finish(ao=False, ground=False)


def cloud_sea(k):
    """78 x 78 m of cloud deck seen from above: a rolling white floor. Tile it
    (scale 6-10) under the aircraft; edges dip so tiles overlap without seams."""
    r = k.rng
    off = Vector((r.random() * 40, r.random() * 40, 0))
    n = 38
    bm = bmesh.new()
    grid = []
    for j in range(n + 1):
        row = []
        for i in range(n + 1):
            x, z = -39 + 78 * i / n, -39 + 78 * j / n
            edge = max(abs(x), abs(z)) / 39
            h = 3.2 * mnoise.noise(Vector((x * 0.07, z * 0.07, 0)) + off) + 1.6 * abs(mnoise.noise(Vector((x * 0.19, z * 0.19, 4)) + off)) - 4.0 * max(0.0, edge - 0.8) / 0.2
            row.append(bm.verts.new(g(x, h, z)))
        grid.append(row)
    for j in range(n):
        for i in range(n):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    o = k.add(bm, "deck", "plaster", smooth=80)
    k.paint(o, MID, jitter=0.0, per_vertex=True, fn=_cloud_paint(k, -3.0, 4.0))
    k.anchor("next_x", g(78, 0, 0))
    k.anchor("next_z", g(0, 0, 78))
    k.finish(ao=False, ground=False)


BUILDERS = {f.__name__: f for f in (cloud_bank, cloud_sea)}
BUDGET = {"cloud_bank": 5200, "cloud_sea": 3200}
GROUND = {"cloud_bank": 0.0, "cloud_sea": -5.0}
META = {"cloud_bank": {"render": "unlit or emissive-lifted white; no shadows; fog on"}, "cloud_sea": {"tile": 78.0}}
