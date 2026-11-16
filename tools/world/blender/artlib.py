"""Art library for the v2 ("cinematic") packs.

Builds on the ptw kit without changing it. Everything here exists to get rid of
the three things that made the first world look simple: flat walls, box
silhouettes and ball trees. So: walls that are gridded and painted per vertex
(stains, damp, bleaching survive export because they are vertex colour), roofs
laid tile by tile in overlapping courses, openings with real relief (surrounds,
sills, shutters, blinds, balconies), arches made of cut stones, awnings, and
foliage built from many lit clumps instead of one sphere.

All coordinates are GAME space (x left, y up, z forward); g() converts.
"""

import math
import os
import sys

import bmesh
from mathutils import Matrix, Vector
from mathutils import noise as mnoise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ptw import parts as P  # noqa: E402
from ptw.parts import g  # noqa: E402

# ---- Palette: one world, five countries -----------------------------------
PLASTER = {"lime": "#f3ead6", "cream": "#efdcb8", "ochre": "#e2bd84", "rose": "#dba98e", "sienna": "#cf8f5e", "sage": "#c9cdb0", "sky": "#c5d3d6"}
ROOF = ["#b5573a", "#a94f35", "#c0623f", "#b86a48", "#9c4a34", "#c9774f", "#ad5a3e"]
STONE = "#cdb48a"
STONE_LIGHT = "#e0cfa8"
STONE_DARK = "#a8946c"
WOOD = "#6b4a2e"
WOOD_LIGHT = "#9a744a"
IRON = "#2f2c28"
LEAF = ("#2c5429", "#4d8136", "#8db44c")  # shade, body, sunlit
OLIVE = ("#4a5a3c", "#7f9069", "#b9c3a0")
PINE = ("#1f3f27", "#35643b", "#5a8a4a")
BLIND = "#3f6b55"


def face(yaw, ox=0.0, oz=0.0):
    """A wall plane. Returns put(u, y, out) -> game xyz; u runs along the wall."""
    nx, nz = math.cos(yaw), math.sin(yaw)
    tx, tz = -nz, nx
    return lambda u, y, out=0.0: (ox + tx * u + nx * out, y, oz + tz * u + nz * out)


def faces_of(w, d, ox=0.0, oz=0.0):
    """The four walls of a w × d footprint: front (+z), back, left (+x), right."""
    return {
        "front": (math.pi / 2, face(math.pi / 2, ox, oz + d / 2), w),
        "back": (-math.pi / 2, face(-math.pi / 2, ox, oz - d / 2), w),
        "left": (0.0, face(0.0, ox + w / 2, oz), d),
        "right": (math.pi, face(math.pi, ox - w / 2, oz), d),
    }


def plaster_paint(k, color, h, seed=0.0, grime=1.0):
    """Weathered lime wash, painted per vertex: damp at the foot, bleached at the
    top, drifting stains, and faint vertical streaks where rain runs down."""
    off = Vector((seed * 13.7 + 3.1, seed * 7.3 + 1.7, seed * 3.9))
    dark = k.blend(color, "#8f7a5c", 0.55)
    base = k.blend(color, color, 1)

    def fn(c, n_, b):
        col = base
        if c.z < 1.1:
            t = (1.1 - c.z) / 1.1
            col = tuple(a + (d_ - a) * t * 0.55 * grime for a, d_ in zip(col, dark))
        stain = mnoise.noise(Vector((c.x * 0.55, c.y * 0.55, c.z * 0.3)) + off)
        streak = mnoise.noise(Vector((c.x * 2.6 + c.y * 2.6, 0.0, c.z * 0.22)) + off)
        kk = 1.0 - max(0.0, stain - 0.05) * 0.38 * grime - max(0.0, streak - 0.25) * 0.22 * grime
        kk += max(0.0, (c.z - (h - 1.2)) / 1.2) * 0.05
        return tuple(max(0.0, min(1.0, a * kk)) for a in col)

    return fn


def shell(k, w, d, h, color, ox=0.0, oz=0.0, y0=0.0, cell=0.62, seed=0.0, grime=1.0, name="walls", surface="plaster"):
    """Four gridded walls. The grid is what lets the paint and the baked
    occlusion vary smoothly across a wall instead of one flat colour per face."""
    bm = bmesh.new()
    hw, hd = w / 2, d / 2
    corners = [(-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd)]
    rows = max(1, round(h / cell))
    for i in range(4):
        a, b = Vector(corners[i]), Vector(corners[(i + 1) % 4])
        n = max(1, round((b - a).length / cell))
        for j in range(n):
            p0, p1 = a.lerp(b, j / n), a.lerp(b, (j + 1) / n)
            for q in range(rows):
                z0, z1 = y0 + h * q / rows, y0 + h * (q + 1) / rows
                bm.faces.new([bm.verts.new(g(ox + p.x, z, oz + p.y)) for p, z in ((p0, z0), (p1, z0), (p1, z1), (p0, z1))])
    bm.faces.new([bm.verts.new(g(ox + x, y0 + h, oz + z)) for x, z in corners])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    o = k.add(bm, name, surface, smooth=20)
    k.paint(o, color, jitter=0.0, fn=plaster_paint(k, color, y0 + h, seed, grime), per_vertex=True)
    return o


def stone_tone(k, a=STONE, b=STONE_DARK):
    return lambda c, n_, base: k.blend(b, a, max(0.0, min(1.0, 0.55 + n_.z * 0.45)))


def plinth(k, w, d, h=0.6, ox=0.0, oz=0.0, color=STONE):
    o = k.bbox("plinth", (w + 0.16, d + 0.16, h), g(ox, h / 2, oz), "stone", bevel=0.04, seg=1)
    k.paint(o, color, jitter=0.07)


def cornice(k, w, d, y, ox=0.0, oz=0.0, color=STONE_LIGHT, proj=0.22):
    """A stepped moulding under the eaves: the line that finishes a façade."""
    k.paint(k.bbox("cornice", (w + proj * 2, d + proj * 2, 0.16), g(ox, y + 0.08, oz), "plaster", bevel=0.05, seg=2), color, jitter=0.03)
    k.paint(k.bbox("cornice_low", (w + proj, d + proj, 0.14), g(ox, y - 0.07, oz), "plaster", bevel=0.03, seg=1), color, jitter=0.03)


def tile_roof(k, w, d, y0, rise=None, ov=0.42, ox=0.0, oz=0.0, ridge="x", courses=3, seed=0, tile=0.34):
    """Barrel-tile gable roof laid in overlapping courses, each tile its own
    colour, with a ridge of half-round caps. `ridge` = axis the ridge runs along."""
    r = k.rng
    span, run = (w, d) if ridge == "x" else (d, w)
    rise = run * 0.27 if rise is None else rise
    half = run / 2
    eave_y = y0 - ov * rise / half

    def P3(a, b, y):  # a along the ridge, b across it
        return g(ox + a, y, oz + b) if ridge == "x" else g(ox + b, y, oz + a)

    for side in (-1, 1):
        a0, a1 = -span / 2 - ov, span / 2 + ov
        top = [P3(a0, 0, y0 + rise + 0.03), P3(a1, 0, y0 + rise + 0.03), P3(a1, side * (half + ov), eave_y), P3(a0, side * (half + ov), eave_y)]
        bm = bmesh.new()
        vt = [bm.verts.new(v) for v in top]
        vb = [bm.verts.new(v - Vector((0, 0, 0.14))) for v in top]
        flip = (side < 0) == (ridge == "x")
        bm.faces.new(vt if flip else vt[::-1])
        bm.faces.new(vb[::-1] if flip else vb)
        for i in range(4):
            j = (i + 1) % 4
            f = (vt[i], vb[i], vb[j], vt[j])
            bm.faces.new(f if flip else f[::-1])
        k.paint(k.add(bm, "roof_deck", "terracotta"), "#7d3f2c", jitter=0.03)
        count = max(3, int((a1 - a0) / tile))
        for i in range(count):
            a = a0 + (i + 0.5) * (a1 - a0) / count
            for c in range(courses):
                t0, t1 = c / courses, (c + 1) / courses + 0.04
                lift = 0.035 + (r.random() - 0.5) * 0.012
                p0 = P3(a, side * (half + ov) * t0, y0 + rise + (eave_y - y0 - rise) * t0 + lift + 0.02)
                p1 = P3(a + (r.random() - 0.5) * 0.02, side * (half + ov) * min(1.02, t1), y0 + rise + (eave_y - y0 - rise) * min(1.02, t1) + lift - 0.012)
                o = k.tube("tile", [p0, p1], 0.118 * tile / 0.34, "terracotta", seg=5, r_end=0.102 * tile / 0.34, cap=(c == courses - 1), smooth=60)
                col = ROOF[r.randrange(len(ROOF))]
                moss = r.random() < 0.06
                k.paint(o, "#8f8a5c" if moss else col, jitter=0.05, fn=lambda cc, nn, base: tuple(a_ * (0.8 + 0.2 * max(0.0, nn.z)) for a_ in base))
        k.paint(k.box("fascia", (span + ov * 2, 0.07, 0.15) if ridge == "x" else (0.07, span + ov * 2, 0.15), P3(0, side * (half + ov - 0.03), eave_y - 0.1), "wood"), WOOD, jitter=0.04)
    n = max(2, int((span + ov * 2) / (0.42 * tile / 0.34)))
    for i in range(n):
        a = -span / 2 - ov + (i + 0.5) * (span + ov * 2) / n
        o = k.tube("ridge_cap", [P3(a - 0.23, 0, y0 + rise + 0.1), P3(a + 0.23, 0, y0 + rise + 0.115)], 0.15, "terracotta", seg=6, r_end=0.135, smooth=60)
        k.paint(o, ROOF[r.randrange(len(ROOF))], jitter=0.05)
    return rise


def gable_walls(k, w, d, y0, rise, color, ox=0.0, oz=0.0, ridge="x", seed=0.0):
    """The triangular wall ends under a gable roof."""
    span, run = (w, d) if ridge == "x" else (d, w)
    bm = bmesh.new()
    for s in (-1, 1):
        pts = [(s * span / 2, -run / 2, y0), (s * span / 2, run / 2, y0), (s * span / 2, 0, y0 + rise)]
        vs = [bm.verts.new(g(ox + a, y, oz + b) if ridge == "x" else g(ox + b, y, oz + a)) for a, b, y in pts]
        bm.faces.new(vs)
    o = k.add(bm, "gable", "plaster")
    k.paint(o, color, jitter=0.0, fn=plaster_paint(k, color, y0 + rise, seed, 0.6), per_vertex=True)


def surround(k, put, yaw, u, y, w, h, color=STONE_LIGHT, t=0.13, proud=0.05, sill=True, head="flat"):
    """Raised moulding round an opening — the relief that stops a wall being a box."""
    for s in (-1, 1):
        P.panel(k, "jamb", t, h + t, put(u + s * (w / 2 + t / 2), y, proud / 2), "plaster", color, yaw=yaw, depth=proud, bevel=0.0, jitter=0.03)
    P.panel(k, "head", w + t * 2 + (0.12 if head == "hood" else 0), t + (0.05 if head == "hood" else 0), put(u, y + h / 2 + t / 2, proud / 2 + (0.02 if head == "hood" else 0)), "plaster", color, yaw=yaw, depth=proud + (0.06 if head == "hood" else 0), bevel=0.0, jitter=0.03)
    if sill:
        P.panel(k, "sill", w + t * 2 + 0.16, 0.09, put(u, y - h / 2 - 0.045, 0.09), "stone", STONE_LIGHT, yaw=yaw, depth=0.2, bevel=0.0, jitter=0.04)


def louvres(k, color):
    return lambda c, n_, base: tuple(a * (0.86 + 0.14 * math.sin(c.z * 34)) for a in k.blend(color, color, 1))


def window(k, put, yaw, u, y, w=0.9, h=1.35, shutters=BLIND, blind=None, balcony=False, pots=True, head="flat", glass="#33403f", frame="#efe6d2", detail=1):
    """A Mediterranean window: deep-set glass, frame, surround, then shutters, a
    half-lowered roller blind hung out over the rail, or a balcony with geraniums."""
    r = k.rng
    tall = balcony
    if tall:
        h, y = 2.15, y + 0.28
    P.panel(k, "glass", w, h, put(u, y, -0.02), "window", glass, yaw=yaw, depth=0.05, bevel=0.0)
    for s in (-1, 1) if detail else ():
        P.panel(k, "frame", 0.06, h, put(u + s * (w / 2 - 0.03), y, 0.015), "wood", frame, yaw=yaw, depth=0.05, bevel=0.0)
    if detail:
        P.panel(k, "frame_top", w, 0.06, put(u, y + h / 2 - 0.03, 0.015), "wood", frame, yaw=yaw, depth=0.05, bevel=0.0)
    P.panel(k, "mullion", 0.045, h, put(u, y, 0.018), "wood", frame, yaw=yaw, depth=0.045, bevel=0.0)
    if detail:
        P.panel(k, "transom", w, 0.04, put(u, y + h * 0.18, 0.018), "wood", frame, yaw=yaw, depth=0.045, bevel=0.0)
    surround(k, put, yaw, u, y, w, h, sill=not tall, head=head)
    if blind:
        drop = h * (0.35 + r.random() * 0.4)
        o = P.panel(k, "blind", w + 0.04, drop, put(u, y + h / 2 - drop / 2, 0.1 + drop * 0.07), "cloth", blind, yaw=yaw, depth=0.03, bevel=0.0, fn=louvres(k, blind))
        del o
        P.panel(k, "blind_box", w + 0.1, 0.12, put(u, y + h / 2 + 0.02, 0.09), "wood", "#d9cdb2", yaw=yaw, depth=0.12, bevel=0.02)
    elif shutters:
        ajar = r.random() < 0.35
        for s in (-1, 1):
            op = ajar and s > 0
            P.panel(k, "shutter", w / 2 + 0.02, h + 0.04, put(u + s * (w * 0.75 + 0.03) - (0.08 * s if op else 0), y, 0.07 + (0.1 if op else 0)), "wood", shutters,
                    yaw=yaw + (s * 0.5 if op else 0), depth=0.045, bevel=0.0, fn=louvres(k, shutters))
    if balcony:
        yb = y - h / 2 - 0.02
        bw = w + 0.9
        P.panel(k, "balcony_slab", bw, 0.11, put(u, yb - 0.055, 0.36), "stone", STONE_LIGHT, yaw=yaw, depth=0.72, bevel=0.025, jitter=0.03)
        for s in (-1, 1):
            P.panel(k, "corbel", 0.14, 0.26, put(u + s * (bw / 2 - 0.2), yb - 0.24, 0.2), "stone", STONE, yaw=yaw, depth=0.4, bevel=0.05, jitter=0.03)
        rail = [put(u - bw / 2 + 0.03, yb, 0.03), put(u - bw / 2 + 0.03, yb, 0.68), put(u + bw / 2 - 0.03, yb, 0.68), put(u + bw / 2 - 0.03, yb, 0.03)]
        P.railing(k, rail, h=0.95, post=0.26, r=0.014, color=IRON, rails=1)
        k.paint(k.tube("rail_low", [g(*q) for q in [(p[0], p[1] + 0.12, p[2]) for p in rail]], 0.012, "metal", seg=4, cap=False), IRON, jitter=0)
        if pots:
            for i in range(3):
                q = put(u - bw / 2 + 0.3 + i * (bw - 0.6) / 2, yb, 0.52)
                flower_pot(k, q, 0.11, ("#c9463d", "#e08a9a", "#d9a441")[(i + int(u * 3)) % 3])
    elif pots and r.random() < 0.4:
        flower_pot(k, put(u + 0.18, y - h / 2, 0.14), 0.09, "#c9463d")


def flower_pot(k, at, r=0.12, flower="#c9463d", bush=0.0):
    x, y, z = at
    k.paint(k.cylinder("pot", r * 0.8, r * 1.5, g(x, y, z), "terracotta", seg=7, r_top=r), "#b86a48", jitter=0.05)
    o = k.sphere("flowers", r * (1.7 + bush), g(x, y + r * 2.5 + bush * r, z), "foliage", subdiv=1, noise=0.18, smooth=70)
    k.paint(o, flower, jitter=0.1, per_vertex=True, sway=lambda co: 0.5, fn=lambda c, n_, base: k.blend("#3f6b3a", flower, 1.0 if n_.z > -0.15 else 0.0))


def arch_ring(k, put, yaw, u, y_spring, radius, depth=0.3, n=11, color=STONE_LIGHT, ring=0.3, proud=0.07, name="voussoir"):
    """A round arch of cut stones in the plane of a wall, with a keystone."""
    for i in range(n):
        a0, a1 = math.pi * i / n, math.pi * (i + 1) / n
        key = i == n // 2
        ro = radius + ring + (0.1 if key else 0)
        pts = []
        for out in (-depth + proud, proud + (0.03 if key else 0)):
            for a, rad in ((a0, radius), (a1, radius), (a1, ro), (a0, ro)):
                pts.append(g(*put(u + math.cos(a) * rad, y_spring + math.sin(a) * rad, out)))
        bm = bmesh.new()
        vs = [bm.verts.new(q) for q in pts]
        for f in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
            bm.faces.new([vs[j] for j in f])
        k.paint(k.add(bm, name, "stone"), STONE_LIGHT if key else color, jitter=0.09)


def arch_void(k, put, yaw, u, y0, w, y_spring, color="#3a3128", out=-0.25, seg=10):
    """The dark depth behind an arch (a fan of faces, set back from the wall)."""
    bm = bmesh.new()
    r = w / 2
    pts = [put(u - r, y0, out), put(u + r, y0, out)] + [put(u + math.cos(a) * r, y_spring + math.sin(a) * r, out) for a in [math.pi * i / seg for i in range(seg + 1)]]
    bm.faces.new([bm.verts.new(g(*q)) for q in pts])
    bm.faces.new([bm.verts.new(g(*q)) for q in pts][::-1])  # second skin: visible from both sides
    o = k.add(bm, "arch_void", "stone")
    k.paint(o, color, jitter=0.0, per_vertex=True, fn=lambda c, n_, base: k.blend("#1f1a15", color, min(1.0, max(0.0, (c.z - y0) / 2.5))))


def door(k, put, yaw, u, w=1.15, h=2.3, color=WOOD, arch=True, step=True):
    """Panelled door in a stone surround, round-headed, with studs and a step."""
    P.panel(k, "door", w, h, put(u, h / 2, -0.03), "wood", color, yaw=yaw, depth=0.08, bevel=0.0, fn=lambda c, n_, base: tuple(a * (0.88 + 0.12 * math.sin(c.x * 24 + c.y * 24)) for a in k.blend(color, color, 1)))
    for s in (-1, 1):
        for yy in (0.65, 1.55):
            P.panel(k, "door_panel", w * 0.36, 0.62, put(u + s * w * 0.24, yy, 0.02), "wood", color, yaw=yaw, depth=0.05, bevel=0.02, jitter=0.06)
        P.panel(k, "door_jamb", 0.2, h, put(u + s * (w / 2 + 0.1), h / 2, 0.05), "stone", STONE_LIGHT, yaw=yaw, depth=0.16, bevel=0.03, jitter=0.05)
    k.paint(k.sphere("knocker", 0.05, g(*put(u + w * 0.12, 1.15, 0.07)), "metal", subdiv=1, smooth=60), "#b99a4a", jitter=0)
    if arch:
        arch_ring(k, put, yaw, u, h, w / 2, depth=0.22, n=9, ring=0.24, proud=0.13)
        arch_void(k, put, yaw, u, h, w, h, color="#4a3626", out=-0.02, seg=8)
    else:
        P.panel(k, "lintel", w + 0.5, 0.24, put(u, h + 0.12, 0.06), "stone", STONE_LIGHT, yaw=yaw, depth=0.2, bevel=0.03, jitter=0.05)
    if step:
        P.panel(k, "step", w + 0.6, 0.16, put(u, 0.08, 0.3), "stone", STONE, yaw=yaw, depth=0.6, bevel=0.03, jitter=0.05)


def awning(k, put, yaw, u, y, w, drop=0.75, reach=1.25, colors=("#b5573a", "#f3ead6"), stripes=None):
    """Striped canvas awning with a scalloped valance and its two arms."""
    n = stripes or max(4, int(w / 0.32))
    for i in range(n):
        u0, u1 = u - w / 2 + w * i / n, u - w / 2 + w * (i + 1) / n
        col = colors[i % 2]
        bm = bmesh.new()
        top = [put(u0, y, 0.04), put(u1, y, 0.04), put(u1, y - drop, reach), put(u0, y - drop, reach)]
        val = [put(u1, y - drop - 0.2, reach + 0.01), put((u0 + u1) / 2, y - drop - 0.27, reach + 0.01), put(u0, y - drop - 0.2, reach + 0.01)]
        vs = [bm.verts.new(g(*q)) for q in top]
        bm.faces.new(vs)
        bm.faces.new([vs[3], vs[2]] + [bm.verts.new(g(*q)) for q in val])
        o = k.add(bm, "awning", "cloth")
        o.data.materials[0].use_backface_culling = False
        k.paint(o, col, jitter=0.03, per_vertex=True, sway=lambda co: 0.0, fn=lambda c, n_, base: tuple(a * 0.95 for a in k.blend(col, col, 1)))
    for s in (-1, 1):
        k.paint(k.tube("awning_arm", [g(*put(u + s * (w / 2 - 0.05), y - drop - 0.05, 0.03)), g(*put(u + s * (w / 2 - 0.05), y - drop, reach))], 0.016, "metal", seg=4), IRON, jitter=0)


def clump(k, at, r, tones=LEAF, sway=None, subdiv=2, scale=(1, 1, 0.8), noise=0.16, freq=1.7, name="leaves"):
    """One lit mass of leaves: dark underneath, sun on top, colour drifting across."""
    o = k.sphere(name, r, at, "foliage", subdiv=subdiv, scale=scale, noise=noise, freq=freq, smooth=80)
    shade, body, sun = tones

    def fn(c, n_, base):
        up = n_.z * 0.5 + 0.5
        col = k.blend(shade, body, min(1.0, up * 1.35))
        if n_.z > 0.3:
            t = min(1.0, (n_.z - 0.3) * 1.3)
            s = k.blend(body, sun, 1.0)
            col = tuple(a + (b - a) * t for a, b in zip(col, s))
        return col

    k.paint(o, body, jitter=0.08, fn=fn, sway=sway or (lambda co: 0.5), per_vertex=True)
    return o


def trunk(k, pts, r0, r1, bark=("#4f3d2c", "#8a6f50"), seg=7, name="trunk"):
    o = k.tube(name, pts, r0, "wood", seg=seg, r_end=r1, cap=False)
    k.paint(o, bark[0], jitter=0.1, fn=lambda c, n_, base: k.blend(bark[0], bark[1], 0.5 + 0.5 * math.sin(c.z * 6.0 + c.x * 9.0 + n_.x * 2.0)))
    return o


def paving(k, w, d, y=0.0, cell=0.6, tones=("#dccba6", "#d2bf98", "#e2d3b1", "#c9b68f"), ox=0.0, oz=0.0, pattern="grid", name="paving"):
    """Stone setts with dark joints: every stone a slightly different colour and
    height, which is all it takes for a floor to stop looking like a floor plane."""
    r = k.rng
    bm = bmesh.new()
    nx, nz = max(1, round(w / cell)), max(1, round(d / cell))
    cols = []
    for i in range(nx):
        for j in range(nz):
            off = (cell / 2 if (pattern == "brick" and j % 2) else 0.0)
            x0 = ox - w / 2 + i * w / nx + off
            z0 = oz - d / 2 + j * d / nz
            x1, z1 = min(ox + w / 2, x0 + w / nx - 0.035), z0 + d / nz - 0.035
            if x1 - x0 < 0.08:
                continue
            h = y + 0.03 + r.random() * 0.012
            ins = 0.03
            lo = [g(x0, y, z0), g(x1, y, z0), g(x1, y, z1), g(x0, y, z1)]
            hi = [g(x0 + ins, h, z0 + ins), g(x1 - ins, h, z0 + ins), g(x1 - ins, h, z1 - ins), g(x0 + ins, h, z1 - ins)]
            vl = [bm.verts.new(v) for v in lo]
            vh = [bm.verts.new(v) for v in hi]
            bm.faces.new(vh[::-1])
            for q in range(4):
                bm.faces.new((vl[q], vl[(q + 1) % 4], vh[(q + 1) % 4], vh[q])[::-1])
            cols.append(tones[(i * 7 + j * 3 + r.randrange(2)) % len(tones)])
    o = k.add(bm, name, "stone")
    idx = {"i": 0}
    tone_at = {}

    def fn(c, n_, base):
        key = (round(c.x / (w / nx) - 0.5), round(c.y / (d / nz) - 0.5))
        if key not in tone_at:
            tone_at[key] = tones[r.randrange(len(tones))]
        col = k.blend(tone_at[key], tone_at[key], 1)
        return col if n_.z > 0.5 else tuple(a * 0.62 for a in col)

    del idx, cols
    k.paint(o, tones[0], jitter=0.05, fn=fn)
    return o


def base_slab(k, w, d, y=-0.25, color="#b9a57f", ox=0.0, oz=0.0, h=0.25):
    """Ground under a set piece (joints show this colour)."""
    k.paint(k.box("base", (w, d, h), g(ox, y + h / 2, oz), "stone"), color, jitter=0.02)


def rot_y(yaw):
    return Matrix.Rotation(-yaw, 4, "Z")
