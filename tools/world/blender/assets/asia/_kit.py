"""Asia kit: airport pieces and neutral vegetation.

Deliberately generic. Nothing here claims to be a particular airport, city or
country; those decisions wait for verified references.
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from ptw import parts as P  # noqa: E402
from ptw.parts import g  # noqa: E402


def terminal_bay(k):
    """One 10 m bay of a glazed terminal hall. Tile along z; the apron is at +x."""
    L, D, H = 10.0, 9.0, 7.2
    k.paint(k.bbox("floor", (D, L, 0.3), g(-D / 2, 0.15, 0), "stone", bevel=0.02, seg=1), "#d6d0c2", jitter=0.03)
    for z in (-L / 2 + 0.2, L / 2 - 0.2):
        k.paint(k.tube("column", [g(-0.35, 0.3, z), g(-0.35, H - 0.3, z)], 0.2, "metal", seg=10), P.CREAM, jitter=0)
        k.paint(k.tube("strut", [g(-0.35, H - 2.2, z), g(1.9, H + 0.25, z)], 0.07, "metal", seg=6), P.CREAM, jitter=0)
    # A wing-like roof that lifts toward the apron.
    sec = [(-D - 0.4, H - 1.5), (-D * 0.5, H - 0.55), (0.0, H), (2.3, H + 0.45), (2.3, H + 0.2), (0.0, H - 0.28), (-D * 0.5, H - 0.85), (-D - 0.4, H - 1.8)]
    roof = k.loft("roof", [[g(x, y, z) for x, y in sec] for z in (-L / 2, L / 2)], "paint", smooth=35)
    k.paint(roof, P.CREAM, jitter=0.02, fn=lambda c, n_, base: k.blend(P.STEEL, P.CREAM, 0.4) if n_.z > 0.3 else k.blend(P.CREAM_SHADE, P.CREAM_SHADE, 1))
    for i in range(4):
        z = -L / 2 + (i + 0.5) * L / 4
        P.panel(k, "glazing", L / 4 - 0.14, H - 1.5, (0.0, 0.3 + (H - 1.5) / 2 + 0.2, z), "window", "#4a6866", yaw=0, depth=0.05, bevel=0.0)
        k.paint(k.bbox("mullion", (0.09, 0.09, H - 1.3), g(0.02, 0.3 + (H - 1.3) / 2, z - L / 8), "metal", bevel=0.01, seg=1), P.CREAM, jitter=0)
    k.paint(k.bbox("back_wall", (0.3, L, H - 1.9), g(-D, (H - 1.9) / 2, 0), "plaster", bevel=0.02, seg=1), "#e9e2d2", jitter=0.03)
    k.wall((0.0, L / 2), (0.0, -L / 2), 0.2)
    k.wall((-D, L / 2), (-D, -L / 2), 0.2)
    k.anchor("gate", g(0.3, 0.3, 0), kind="boarding")
    k.anchor("next", g(0, 0, L / 2))
    k.finish(ao_strength=0.7, ao_samples=32)


def jet_bridge(k):
    """Boarding bridge: fixed tunnel on a rotunda, cab at the aircraft end (+x). Door sill at y = 3.55."""
    y = 3.55
    sec = P.body_section(2.6, y - 0.15, y + 2.5, r_bot=0.1, r_top=0.25, stations=(y + 0.8, y + 1.9), seg=2)
    tun = k.loft("tunnel", [[g(x_along, yy, xx) for xx, yy in sec] for x_along in (1.2, 13.5)], "paint", smooth=35)
    k.paint(tun, P.CREAM, jitter=0.02, fn=lambda c, n_, base: k.blend(P.GLASS_DARK, P.GLASS_DARK, 1) if (y + 0.8 < c.z < y + 1.9 and abs(n_.y) > 0.6) else k.blend(P.CREAM, P.CREAM, 1))
    k.paint(k.cylinder("rotunda", 1.9, 2.9, g(0, y - 0.2, 0), "paint", seg=14), P.CREAM, jitter=0.02)
    k.paint(k.cylinder("rotunda_roof", 2.05, 0.2, g(0, y + 2.7, 0), "metal", seg=14, r_top=1.6), P.STEEL, jitter=0)
    k.paint(k.tube("rotunda_column", [g(0, 0, 0), g(0, y - 0.2, 0)], 0.42, "metal", seg=10), P.CREAM_SHADE, jitter=0)
    k.paint(k.bbox("cab", (2.6, 3.2, 2.8), g(14.6, y + 1.2, 0), "paint", bevel=0.2), P.CREAM, jitter=0.02)
    k.paint(k.bbox("hood", (0.5, 2.9, 2.5), g(16.1, y + 1.15, 0), "rubber", bevel=0.18), P.INK, jitter=0.02)
    for z in (-1.2, 1.2):
        k.paint(k.tube("leg", [g(11.5, 0.5, z), g(11.5, y - 0.1, z)], 0.14, "metal", seg=8), P.STEEL_DARK, jitter=0)
        k.paint(k.tube("bogie_wheel", [g(11.5, 0.42, z - 0.16), g(11.5, 0.42, z + 0.16)], 0.42, "rubber", seg=12), P.RUBBER, jitter=0)
    k.paint(k.bbox("leg_beam", (0.3, 2.9, 0.3), g(11.5, 0.9, 0), "metal", bevel=0.05, seg=1), P.MUSTARD, jitter=0)
    k.anchor("aircraft_door", g(16.4, y, 0), kind="boarding")
    k.anchor("terminal_door", g(-1.9, y, 0), kind="boarding")
    k.collider(0, 0, 0.6)
    k.collider(11.5, 0, 1.4)
    k.finish(ao_strength=0.65, ao_samples=32)


def baggage_cart(k):
    for i in range(2):
        z = -1.9 + i * 3.4
        k.paint(k.bbox("bed", (1.5, 2.9, 0.12), g(0, 0.55, z), "metal", bevel=0.03, seg=1), P.STEEL_DARK, jitter=0.02)
        for sx in (-0.72, 0.72):
            for dz in (-1.4, 1.4):
                k.paint(k.tube("stanchion", [g(sx, 0.6, z + dz), g(sx, 1.75, z + dz)], 0.03, "metal", seg=5), P.MUSTARD, jitter=0)
            k.paint(k.tube("top_rail", [g(sx, 1.75, z - 1.4), g(sx, 1.75, z + 1.4)], 0.03, "metal", seg=5), P.MUSTARD, jitter=0)
        for sx in (-0.7, 0.7):
            for dz in (-1.0, 1.0):
                k.paint(k.tube("wheel", [g(sx - 0.06, 0.24, z + dz), g(sx + 0.06, 0.24, z + dz)], 0.24, "rubber", seg=10), P.RUBBER, jitter=0)
        cols = [P.TERRACOTTA, "#3d6480", P.GREEN, "#6f6a62", P.MUSTARD, "#7a5a8a"]
        for j in range(5):
            w, d, h = 0.5 + k.rng.random() * 0.3, 0.6 + k.rng.random() * 0.25, 0.28 + k.rng.random() * 0.25
            k.paint(k.bbox("case", (w, d, h), g(-0.35 + (j % 2) * 0.7, 0.62 + h / 2 + (j // 2) * 0.42, z - 0.8 + (j % 3) * 0.75), "cloth", bevel=0.05, seg=1), cols[(i * 3 + j) % len(cols)], jitter=0.04)
    k.paint(k.tube("towbar", [g(0, 0.5, -0.5), g(0, 0.5, 0.2)], 0.035, "metal", seg=5), P.STEEL_DARK, jitter=0)
    k.wall((0, 3.2), (0, -3.4), 0.85)
    k.finish(ao_strength=0.7, ao_samples=32)


def runway_light(k):
    k.paint(k.cylinder("base", 0.16, 0.08, g(0, 0, 0), "metal", seg=10), P.MUSTARD, jitter=0)
    k.paint(k.tube("stem", [g(0, 0.08, 0), g(0, 0.34, 0)], 0.035, "metal", seg=6), P.STEEL, jitter=0)
    k.paint(k.sphere("lens", 0.09, g(0, 0.42, 0), "glow", subdiv=2, smooth=70), "#fff3c4", jitter=0)
    k.anchor("light_00", g(0, 0.42, 0), kind="lamp")
    k.finish(ao=False)


def bamboo_clump(k):
    r = k.rng
    sway = lambda co: min(1.0, max(0.0, (co.z - 1.0) / 6.0))
    for i in range(9):
        a = r.random() * math.tau
        d = r.random() * 0.7
        x, z = math.cos(a) * d, math.sin(a) * d
        h = 5.0 + r.random() * 2.6
        lean = (math.cos(a) * 0.9 * r.random(), math.sin(a) * 0.9 * r.random())
        pts = [g(x + lean[0] * (t**2), h * t, z + lean[1] * (t**2)) for t in (0, 0.25, 0.5, 0.75, 1.0)]
        o = k.tube("culm", pts, 0.055, "foliage", seg=5, r_end=0.02, cap=False)
        k.paint(o, "#7f9a4a", jitter=0.05, per_vertex=True, sway=sway, fn=lambda c, n_, base: k.blend("#93a956", "#5f7f3a", 0.5 + 0.5 * math.sin(c.z * 9)))
        for j in range(5):
            t = 0.45 + j * 0.12
            px, pz = x + lean[0] * t * t, z + lean[1] * t * t
            leaf = k.sphere("leaves", 0.5 + r.random() * 0.25, g(px + (r.random() - 0.5) * 0.7, h * t, pz + (r.random() - 0.5) * 0.7), "foliage", subdiv=1, scale=(1.3, 1.3, 0.42), noise=0.2, smooth=70)
            k.paint(leaf, "#5c8c40", jitter=0.08, per_vertex=True, sway=sway, fn=lambda c, n_, base: k.blend("#3f6b3a", "#86b04a", n_.z * 0.5 + 0.5))
    k.collider(0, 0, 0.8)
    k.finish(ao_strength=0.6, ao_samples=32)


BUILDERS = {f.__name__: f for f in (terminal_bay, jet_bridge, baggage_cart, runway_light, bamboo_clump)}
BUDGET = {"bamboo_clump": 2400}
