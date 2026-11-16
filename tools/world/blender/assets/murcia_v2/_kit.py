"""Murcia v2 — "Mediterranean Arrival".

A second, richer layer for the Murcia chapter: a plaza with a church, arcaded
houses, a bandstand, a café and a market; the trees of the south-east (olive,
orange, cypress, prickly pear, bougainvillea, river reeds); the huerta's water
(waterwheel, irrigation channel, crop rows) and a sierra to close the horizon.

An artistic interpretation of Murcia, not a survey: no real building is copied.
Front of every building is +z (game); origin on the ground at the footprint centre.
"""

import math
import os
import sys

import bmesh
from mathutils import Vector
from mathutils import noise as mnoise

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
import artlib as A  # noqa: E402
from ptw import parts as P  # noqa: E402
from ptw.parts import g  # noqa: E402

FH = 3.0  # storey height


def _walls(k, w, d, ox=0.0, oz=0.0, r=0.22):
    hw, hd = w / 2, d / 2
    c = [(ox - hw, oz - hd), (ox + hw, oz - hd), (ox + hw, oz + hd), (ox - hw, oz + hd)]
    for i in range(4):
        a, b = c[i], c[(i + 1) % 4]
        k.wall((a[0], -a[1]), (b[0], -b[1]), r)


# ------------------------------------------------------------------ plaza
def church(k):
    """Parish church for the plaza: curved baroque gable, stone portal, bell
    tower with a blue-tiled dome (the glazed domes of the Spanish south-east)."""
    W, D, H = 9.0, 13.0, 8.2
    body = PLASTER = A.PLASTER["cream"]
    A.shell(k, W, D, H, body, oz=-D / 2, seed=1.0, cell=0.95)
    A.plinth(k, W, D, 0.8, oz=-D / 2)
    rise = A.tile_roof(k, W, D, H, oz=-D / 2, ridge="z", courses=2, ov=0.35, tile=0.46)
    A.gable_walls(k, W, D, H, rise, body, oz=-D / 2, ridge="z", seed=1.0)
    yaw, put = math.pi / 2, A.face(math.pi / 2, 0, 0)

    # Façade: a screen wall taller than the nave, its top a baroque curve.
    bm = bmesh.new()
    prof = []
    n = 18
    for i in range(n + 1):
        u = -W / 2 - 0.3 + (W + 0.6) * i / n
        t = abs(u) / (W / 2 + 0.3)
        y = H + 3.6 - 2.6 * t**1.6 + 0.55 * math.cos(t * math.pi * 3) * (1 - t)
        prof.append((u, y))
    for (u0, y0), (u1, y1) in zip(prof, prof[1:]):
        rows = 7
        for q in range(rows):
            a0, a1 = q / rows, (q + 1) / rows
            for out, flip in ((0.32, False), (-0.02, True)):
                vs = [bm.verts.new(g(*put(u, yy, out))) for u, yy in ((u0, y0 * a0), (u1, y1 * a0), (u1, y1 * a1), (u0, y0 * a1))]
                bm.faces.new(vs[::-1] if flip else vs)
        bm.faces.new([bm.verts.new(g(*put(u, yy, out))) for u, yy, out in ((u0, y0, 0.32), (u1, y1, 0.32), (u1, y1, -0.02), (u0, y0, -0.02))])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    fac = k.add(bm, "facade", "plaster", smooth=25)
    k.paint(fac, body, jitter=0.0, fn=A.plaster_paint(k, body, H + 3.6, 2.0, 0.9), per_vertex=True)
    # Coping stones along the curve, and finials.
    for (u0, y0), (u1, y1) in zip(prof, prof[1:]):
        k.paint(k.tube("coping", [g(*put(u0, y0 + 0.06, 0.15)), g(*put(u1, y1 + 0.06, 0.15))], 0.2, "stone", seg=4, cap=False), A.STONE_LIGHT, jitter=0.06)
    for u in (-W / 2 - 0.1, W / 2 + 0.1, 0.0):
        yy = H + 1.0 if u else H + 4.15
        k.paint(k.cylinder("finial_base", 0.26, 0.5, g(*put(u, yy, 0.15)), "stone", seg=8, r_top=0.16), A.STONE_LIGHT, jitter=0.04)
        k.paint(k.sphere("finial", 0.22, g(*put(u, yy + 0.7, 0.15)), "stone", subdiv=2, smooth=60), A.STONE_LIGHT, jitter=0.03)
    # Giant pilasters and an entablature tie the front together.
    for u in (-3.9, -1.75, 1.75, 3.9):
        P.panel(k, "pilaster", 0.62, H - 0.4, put(u, (H - 0.4) / 2 + 0.6, 0.38), "stone", A.STONE, yaw=yaw, depth=0.16, bevel=0.03, jitter=0.05)
        P.panel(k, "capital", 0.82, 0.3, put(u, H + 0.35, 0.4), "stone", A.STONE_LIGHT, yaw=yaw, depth=0.24, bevel=0.05, jitter=0.04)
        P.panel(k, "pilaster_base", 0.8, 0.5, put(u, 0.55, 0.4), "stone", A.STONE_LIGHT, yaw=yaw, depth=0.24, bevel=0.05, jitter=0.04)
    P.panel(k, "entablature", W + 0.7, 0.42, put(0, H + 0.72, 0.42), "stone", A.STONE_LIGHT, yaw=yaw, depth=0.3, bevel=0.06, jitter=0.04)
    # Portal: big studded doors in a stone arch, a niche and a round window above.
    front = A.face(yaw, 0, 0.32)
    A.door(k, front, yaw, 0.0, w=2.3, h=3.7, color="#5a3c24")
    for u in (-1.75, 1.75):
        k.paint(k.cylinder("column", 0.2, 3.9, g(*front(u * 0.86, 0.5, 0.3)), "stone", seg=10), A.STONE_LIGHT, jitter=0.04)
    P.panel(k, "portal_lintel", 4.0, 0.34, front(0, 5.3, 0.22), "stone", A.STONE_LIGHT, yaw=yaw, depth=0.5, bevel=0.07, jitter=0.04)
    A.arch_ring(k, front, yaw, 0.0, 6.35, 0.55, depth=0.3, n=9, ring=0.2, proud=0.1, name="niche")
    A.arch_void(k, front, yaw, 0.0, 5.55, 1.1, 6.35, color="#6f5a42", out=-0.12)
    k.paint(k.tube("oculus_ring", [g(*front(math.cos(a) * 0.95, 9.0 + math.sin(a) * 0.95, 0.06)) for a in [i / 16 * math.tau for i in range(17)]], 0.14, "stone", seg=6, cap=False), A.STONE_LIGHT, jitter=0.05)
    k.paint(k.tube("oculus", [g(*front(0, 9.0, -0.02)), g(*front(0, 9.0, 0.03))], 0.9, "window", seg=16), "#2f4a5a", jitter=0)
    for a in (0, math.pi / 4, math.pi / 2, 3 * math.pi / 4):
        k.paint(k.tube("tracery", [g(*front(-math.cos(a) * 0.9, 9.0 - math.sin(a) * 0.9, 0.05)), g(*front(math.cos(a) * 0.9, 9.0 + math.sin(a) * 0.9, 0.05))], 0.035, "stone", seg=4), A.STONE_LIGHT, jitter=0)
    for i in range(4):
        P.panel(k, "church_step", 4.6 + (3 - i) * 0.7, 0.16, front(0, 0.08 + i * 0.0, 0.35 + (3 - i) * 0.34), "stone", A.STONE, yaw=yaw, depth=0.34, bevel=0.03, jitter=0.05) if i == 3 else None
    for i in range(3):
        P.panel(k, "church_step", 4.4 + i * 0.8, 0.17, front(0, 0.45 - i * 0.17, 0.4 + i * 0.36), "stone", A.STONE, yaw=yaw, depth=0.4, bevel=0.03, jitter=0.05)
    # Side windows of the nave.
    for name in ("left", "right"):
        fy, fput, _ = A.faces_of(W, D, 0, -D / 2)[name]
        for u in (-3.6, 0.0, 3.6):
            A.arch_ring(k, fput, fy, u, 5.6, 0.5, depth=0.2, n=7, ring=0.18, proud=0.06)
            P.panel(k, "nave_window", 1.0, 1.9, fput(u, 4.7, -0.02), "window", "#2f4a5a", yaw=fy, depth=0.05, bevel=0.0)
            P.panel(k, "buttress", 0.8, H - 1.2, fput(u + 1.8, (H - 1.2) / 2, 0.2), "stone", A.STONE, yaw=fy, depth=0.5, bevel=0.06, jitter=0.05)

    _walls(k, W, D, 0, -D / 2)
    k.anchor("tower_site", g(-W / 2 - 1.5, 0, -2.0), kind="placement")
    k.anchor("door", g(0, 0, 2.2), kind="boarding")
    k.anchor("light_00", g(1.9, 3.4, 0.9), kind="lamp")
    k.anchor("plaza_side", g(0, 0, 8.0))
    k.finish(ao_strength=0.85, ao_samples=64)


def church_tower(k):
    """Bell tower for the church: belfry arches on all four sides, a bronze
    bell, an octagonal drum and a blue-tiled dome. Stands at the church's
    ANCHOR_tower_site (or alone, as a landmark)."""
    body = A.PLASTER["cream"]
    # ---- Bell tower ---------------------------------------------------------
    tx, tz, tw = 0.0, 0.0, 3.5
    th = 15.5
    A.shell(k, tw, tw, th, body, ox=tx, oz=tz, seed=3.0, cell=0.6, name="tower")
    A.plinth(k, tw, tw, 0.9, ox=tx, oz=tz)
    for yy in (6.0, 10.6):
        A.cornice(k, tw, tw, yy, ox=tx, oz=tz, proj=0.16)
    A.cornice(k, tw, tw, th, ox=tx, oz=tz, proj=0.32)
    for name, (fy, fput, fw) in A.faces_of(tw, tw, tx, tz).items():
        A.arch_ring(k, fput, fy, 0, 13.4, 0.6, depth=0.5, n=9, ring=0.22, proud=0.07)
        A.arch_void(k, fput, fy, 0, 11.4, 1.2, 13.4, color="#2a2420", out=-0.3)
        P.panel(k, "belfry_sill", 1.7, 0.16, fput(0, 11.35, 0.1), "stone", A.STONE_LIGHT, yaw=fy, depth=0.3, bevel=0.03)
        for s in (-1, 1):
            P.panel(k, "quoin", 0.5, th - 1.0, fput(s * (tw / 2 - 0.25), th / 2 + 0.4, 0.03), "stone", A.STONE, yaw=fy, depth=0.07, bevel=0.0, jitter=0.07)
        if name in ("front", "left"):
            A.window(k, fput, fy, 0, 8.3, w=0.7, h=1.3, shutters=None, pots=False)
            k.paint(k.tube("clock", [g(*fput(0, 4.6, 0.0)), g(*fput(0, 4.6, 0.06))], 0.62, "stone", seg=16), A.STONE_LIGHT, jitter=0) if name == "front" else None
    k.paint(k.sphere("bell", 0.5, g(tx, 12.75, tz), "metal", subdiv=2, scale=(1, 1, 1.15), smooth=60), "#a8843a", jitter=0.03)
    k.paint(k.tube("bell_yoke", [g(tx - 0.9, 13.45, tz), g(tx + 0.9, 13.45, tz)], 0.09, "wood", seg=6), A.WOOD, jitter=0)
    k.anchor("bell", g(tx, 12.8, tz), kind="sound")
    # Octagonal drum, blue-tiled dome, lantern, cross.
    k.paint(k.cylinder("drum", 1.5, 1.5, g(tx, th + 0.15, tz), "plaster", seg=8), body, jitter=0.03)
    k.paint(k.cylinder("drum_cornice", 1.72, 0.18, g(tx, th + 1.6, tz), "stone", seg=8), A.STONE_LIGHT, jitter=0.03)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1.0)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.02], context="VERTS")
    for v in bm.verts:
        v.co = Vector((v.co.x * 1.6, v.co.y * 1.6, v.co.z * 1.85)) + g(tx, th + 1.75, tz)
    dome = k.add(bm, "dome", "terracotta", smooth=70)
    c0 = g(tx, 0, tz)
    k.paint(dome, "#2f6f9a", jitter=0.05, fn=lambda c, n_, base: k.blend("#e9e4d2", "#2f6f9a", 0.0 if int((math.atan2(c.y - c0.y, c.x - c0.x) / math.tau + 1) * 16) % 4 == 0 else 1.0) if True else base)
    k.paint(k.cylinder("lantern", 0.32, 0.7, g(tx, th + 3.5, tz), "plaster", seg=8), body, jitter=0.03)
    k.paint(k.cylinder("lantern_cap", 0.44, 0.5, g(tx, th + 4.2, tz), "terracotta", seg=8, r_top=0.04), "#2f6f9a", jitter=0.04)
    k.paint(k.tube("cross_v", [g(tx, th + 4.6, tz), g(tx, th + 5.7, tz)], 0.035, "metal", seg=4), A.IRON, jitter=0)
    k.paint(k.tube("cross_h", [g(tx - 0.3, th + 5.35, tz), g(tx + 0.3, th + 5.35, tz)], 0.035, "metal", seg=4), A.IRON, jitter=0)
    k.paint(k.sphere("weather_ball", 0.1, g(tx, th + 4.75, tz), "metal", subdiv=1, smooth=60), "#b99a4a", jitter=0)

    _walls(k, tw, tw, tx, tz)
    k.anchor("light_00", g(0, 3.0, tw / 2 + 0.5), kind="lamp")
    k.finish(ao_strength=0.85, ao_samples=64)


def _house(k, w, d, floors, color, seed, ox=0.0, oz=0.0, blind=None, shutters=A.BLIND, ridge="x", roof=True, cell=0.62):
    h = floors * FH
    A.shell(k, w, d, h, color, ox=ox, oz=oz, seed=seed, cell=cell)
    A.plinth(k, w, d, 0.55, ox=ox, oz=oz)
    A.cornice(k, w, d, h - 0.12, ox=ox, oz=oz)
    if roof:
        rise = A.tile_roof(k, w, d, h + 0.05, ox=ox, oz=oz, ridge=ridge, courses=2, tile=0.34 if w < 8 else 0.42)
        A.gable_walls(k, w, d, h, rise, color, ox=ox, oz=oz, ridge=ridge, seed=seed)
    return h


def arcade_house(k):
    """Three-storey house on a stone arcade (soportales): shade at street level,
    balconies and half-lowered blinds above. The plaza's defining building."""
    W, D = 10.5, 6.5
    color = A.PLASTER["ochre"]
    h = _house(k, W, D, 3, color, 5.0, blind=A.BLIND, cell=0.95)
    fs = A.faces_of(W, D)
    yaw, put, _ = fs["front"]
    # Arcade: three arches standing proud of the wall, deep shadow behind.
    bays = 3
    bw = W / bays
    for i in range(bays + 1):
        u = -W / 2 + i * bw
        P.panel(k, "pier", 0.62, 2.3, put(u if 0 < i < bays else u + (0.31 if i == 0 else -0.31), 1.15, 0.2), "stone", A.STONE, yaw=yaw, depth=0.55, bevel=0.05, jitter=0.06)
        P.panel(k, "impost", 0.8, 0.16, put(u if 0 < i < bays else u + (0.31 if i == 0 else -0.31), 2.36, 0.22), "stone", A.STONE_LIGHT, yaw=yaw, depth=0.66, bevel=0.03, jitter=0.04)
    for i in range(bays):
        u = -W / 2 + (i + 0.5) * bw
        rad = bw / 2 - 0.36
        A.arch_ring(k, put, yaw, u, 2.44, rad, depth=0.5, n=11, ring=0.3, proud=0.47)
        A.arch_void(k, put, yaw, u, 0.0, rad * 2, 2.44, color="#4a3e30", out=0.02)
        if i == 1:
            P.panel(k, "shop_door", 1.3, 2.3, put(u, 1.15, 0.05), "wood", "#3f6b55", yaw=yaw, depth=0.06, bevel=0.02, jitter=0.05)
            P.panel(k, "shop_door_glass", 0.9, 1.1, put(u, 1.55, 0.09), "window", "#33403f", yaw=yaw, depth=0.03, bevel=0.03)
        else:
            P.panel(k, "shop_window", rad * 1.5, 1.5, put(u, 1.35, 0.05), "window", "#3d4a4a", yaw=yaw, depth=0.05, bevel=0.03)
            P.panel(k, "shop_sill", rad * 1.6, 0.6, put(u, 0.3, 0.07), "wood", "#3f6b55", yaw=yaw, depth=0.08, bevel=0.02, jitter=0.05)
    P.panel(k, "string_course", W + 0.2, 0.2, put(0, 3.42, 0.3), "stone", A.STONE_LIGHT, yaw=yaw, depth=0.62, bevel=0.04, jitter=0.03)
    A.awning(k, put, yaw, -W / 2 + bw / 2, 3.2, bw - 1.0, drop=0.6, reach=1.5, colors=("#b5573a", "#f3ead6"))
    # Upper floors.
    for f in (1, 2):
        for i in range(bays):
            u = -W / 2 + (i + 0.5) * bw
            A.window(k, put, yaw, u - 0.0, f * FH + 1.5, w=1.0, balcony=(f == 1), blind=A.BLIND if (i + f) % 2 else None, shutters=None if (i + f) % 2 else "#5a4636", head="hood")
    for name in ("left", "right", "back"):
        fy, fput, fw = fs[name]
        for f in range(3):
            for u in ((0.0,) if name != "back" else (-3.2, 3.2)):
                if f == 0 and name != "back":
                    continue
                A.window(k, fput, fy, u, f * FH + 1.55, w=0.85, h=1.25, shutters="#5a4636" if name != "back" else None, pots=False, detail=0)
    P.panel(k, "sign", 1.5, 0.42, put(-W / 2 + bw * 1.5, 3.05, 0.5), "wood", "#27512f", yaw=yaw, depth=0.06, bevel=0.03)
    k.anchor("label_sign", g(*put(-W / 2 + bw * 1.5, 3.05, 0.55)), kind="label")
    k.anchor("door", g(*put(0, 0, 1.4)), kind="boarding")
    k.anchor("light_00", g(*put(bw / 2, 2.9, 0.75)), kind="lamp")
    k.anchor("light_01", g(*put(-bw / 2, 2.9, 0.75)), kind="lamp")
    k.paint(k.sphere("lantern", 0.13, g(*put(bw / 2, 2.95, 0.72)), "glow", subdiv=1, smooth=60), "#fff3c4", jitter=0)
    k.paint(k.sphere("lantern", 0.13, g(*put(-bw / 2, 2.95, 0.72)), "glow", subdiv=1, smooth=60), "#fff3c4", jitter=0)
    _walls(k, W, D)
    k.finish(ao_strength=0.85, ao_samples=64)


def shop_house(k):
    """Two-storey corner house: a shop under a striped awning, shuttered rooms
    above, a bougainvillea that has taken over one corner."""
    W, D = 6.4, 5.4
    color = A.PLASTER["lime"]
    h = _house(k, W, D, 2, color, 9.0)
    fs = A.faces_of(W, D)
    yaw, put, _ = fs["front"]
    P.panel(k, "shopfront", 3.0, 2.1, put(-1.2, 1.35, 0.02), "window", "#3d4a4a", yaw=yaw, depth=0.06, bevel=0.03)
    A.surround(k, put, yaw, -1.2, 1.35, 3.0, 2.1, color="#3f6b55", t=0.14, sill=False)
    P.panel(k, "stall_riser", 3.3, 0.5, put(-1.2, 0.27, 0.06), "wood", "#3f6b55", yaw=yaw, depth=0.1, bevel=0.02, jitter=0.05)
    A.awning(k, put, yaw, -1.2, 2.95, 3.5, drop=0.65, reach=1.4, colors=("#27512f", "#f3ead6"))
    A.door(k, put, yaw, 2.0, w=1.05, h=2.25, color="#3f6b55", arch=False)
    for u in (-1.9, 0.2, 2.1):
        A.window(k, put, yaw, u, FH + 1.5, w=0.9, shutters=A.BLIND, balcony=(u == 0.2))
    for name in ("left", "right", "back"):
        fy, fput, fw = fs[name]
        for f in range(2):
            for u in (-1.3, 1.3):
                if name == "left" and f == 0:
                    continue
                A.window(k, fput, fy, u, f * FH + 1.55, w=0.8, h=1.2, shutters=A.BLIND if f else None, pots=False, detail=0)
    # Bougainvillea climbing the front-left corner and spilling over the eave.
    r = k.rng
    cx, cz = W / 2 - 0.1, D / 2 + 0.05
    A.trunk(k, [g(cx + 0.25, 0, cz + 0.2), g(cx + 0.1, 2.0, cz + 0.12), g(cx - 0.2, 4.2, cz + 0.15), g(cx - 0.9, 5.9, cz + 0.12)], 0.09, 0.04, seg=5, name="vine")
    tones = ("#7a1f4a", "#c2357a", "#ee7fb2")
    for i in range(13):
        t = i / 12
        pos = g(cx - 1.6 * t * t + (r.random() - 0.5) * 0.9, 2.6 + 3.6 * t + (r.random() - 0.5) * 0.7, cz + 0.25 + r.random() * 0.3)
        A.clump(k, pos, 0.5 + r.random() * 0.35, tones=tones if i % 4 else A.LEAF, subdiv=2, scale=(1.1, 0.7, 0.9), noise=0.18, sway=lambda co: 0.45)
    P.panel(k, "sign", 1.3, 0.38, put(-1.2, 3.25, 0.3), "wood", "#27512f", yaw=yaw, depth=0.05, bevel=0.03)
    k.anchor("label_sign", g(*put(-1.2, 3.25, 0.34)), kind="label")
    k.anchor("door", g(*put(2.0, 0, 1.0)), kind="boarding")
    k.paint(k.sphere("lantern", 0.12, g(*put(1.15, 2.6, 0.3)), "glow", subdiv=1, smooth=60), "#fff3c4", jitter=0)
    k.anchor("light_00", g(*put(1.15, 2.6, 0.35)), kind="lamp")
    _walls(k, W, D)
    k.finish(ao_strength=0.85, ao_samples=64)


def bandstand(k):
    """Octagonal bandstand (templete): where a community gathers. A natural
    home for the Murcia Welcomes You story point."""
    R, H0 = 3.2, 0.9
    k.paint(k.cylinder("base", R + 0.25, H0, g(0, 0, 0), "stone", seg=8), A.STONE, jitter=0.06)
    k.paint(k.cylinder("base_lip", R + 0.4, 0.12, g(0, H0 - 0.02, 0), "stone", seg=8), A.STONE_LIGHT, jitter=0.04)
    k.paint(k.cylinder("deck", R + 0.1, 0.05, g(0, H0 + 0.1, 0), "wood", seg=8), A.WOOD_LIGHT, jitter=0.05)
    band = k.cylinder("tile_band", R + 0.27, 0.42, g(0, 0.3, 0), "terracotta", seg=8)
    k.paint(band, "#2f6f9a", jitter=0.0, fn=lambda c, n_, base: k.blend("#e9e4d2", "#2f6f9a", 1.0 if (int(math.atan2(c.y, c.x) * 14) + int(c.z * 9)) % 2 else 0.0))
    for i in range(5):
        P.panel(k, "step", 2.0 + (4 - i) * 0.3, 0.18, (0, 0.09 + i * 0.18, R + 0.3 + (4 - i) * 0.3), "stone", A.STONE_LIGHT, yaw=math.pi / 2, depth=0.34, bevel=0.03, jitter=0.04)
    top = H0 + 0.12
    for i in range(8):
        a = (i + 0.5) / 8 * math.tau
        x, z = math.cos(a) * (R - 0.2), math.sin(a) * (R - 0.2)
        k.paint(k.tube("column", [g(x, top, z), g(x, top + 3.1, z)], 0.07, "metal", seg=8, r_end=0.055), "#27512f", jitter=0)
        k.paint(k.cylinder("column_foot", 0.13, 0.3, g(x, top, z), "metal", seg=8, r_top=0.08), "#27512f", jitter=0)
        for s in (-1, 1):  # scroll brackets
            a2 = a + s * 0.24
            k.paint(k.tube("bracket", [g(x, top + 2.55, z), g(math.cos(a + s * 0.1) * (R - 0.2), top + 2.95, math.sin(a + s * 0.1) * (R - 0.2)), g(math.cos(a2) * (R - 0.2), top + 3.08, math.sin(a2) * (R - 0.2))], 0.025, "metal", seg=4), "#27512f", jitter=0)
        a_next = (i + 1.5) / 8 * math.tau
        if i != 1:  # leave the stair side open (+z is at a = pi/2)
            P.railing(k, [(x, top, z), (math.cos(a_next) * (R - 0.2), top, math.sin(a_next) * (R - 0.2))], h=0.9, post=0.2, r=0.014, color="#27512f", rails=1)
    # Roof: a shallow pleated cone with a scalloped edge and a finial.
    bm = bmesh.new()
    apex = bm.verts.new(g(0, top + 4.75, 0))
    n = 32
    rim = []
    for i in range(n):
        a = i / n * math.tau
        rr = R + 0.55 + (0.12 if i % 2 else 0)
        rim.append(bm.verts.new(g(math.cos(a) * rr, top + 3.12 - (0.1 if i % 2 else 0), math.sin(a) * rr)))
    for i in range(n):
        bm.faces.new((apex, rim[(i + 1) % n], rim[i]))
    roof = k.add(bm, "roof", "metal", smooth=20)
    roof.data.materials[0].use_backface_culling = False
    k.paint(roof, "#3f7a5a", jitter=0.03, fn=lambda c, n_, base: k.blend("#2f5f48", "#6f9f84", min(1.0, max(0.0, n_.z))))
    k.paint(k.cylinder("eave", R + 0.45, 0.1, g(0, top + 3.06, 0), "metal", seg=16), "#27512f", jitter=0)
    k.paint(k.tube("finial", [g(0, top + 4.7, 0), g(0, top + 5.6, 0)], 0.05, "metal", seg=6, r_end=0.01), "#b99a4a", jitter=0)
    k.paint(k.sphere("finial_ball", 0.13, g(0, top + 5.0, 0), "metal", subdiv=1, smooth=60), "#b99a4a", jitter=0)
    k.paint(k.sphere("lamp", 0.2, g(0, top + 2.9, 0), "glow", subdiv=2, smooth=60), "#fff3c4", jitter=0)
    k.anchor("light_00", g(0, top + 2.9, 0), kind="lamp")
    k.anchor("stage", g(0, top, 0), kind="poi")
    k.anchor("audience", g(0, 0, R + 4.5))
    for i in range(8):
        a = (i + 0.5) / 8 * math.tau
        if i != 1:
            k.collider(math.cos(a) * R, -math.sin(a) * R, 0.9)
    k.finish(ao_strength=0.8, ao_samples=64)


def cafe_terrace(k):
    """A café spilling onto the square: tables, bentwood chairs, two parasols,
    a chalkboard. Everyday life, in one piece (about 8 × 5 m)."""
    r = k.rng

    def chair(x, z, yaw):
        c, s = math.cos(yaw), math.sin(yaw)
        Pt = lambda lx, y, lz: g(x + lx * c + lz * s, y, z - lx * s + lz * c)
        k.paint(k.cylinder("seat", 0.2, 0.035, Pt(0, 0.45, 0), "wood", seg=10), "#c9a468", jitter=0.05)
        for lx, lz in ((-0.15, -0.15), (0.15, -0.15), (-0.15, 0.15), (0.15, 0.15)):
            k.paint(k.tube("leg", [Pt(lx * 1.15, 0, lz * 1.15), Pt(lx, 0.45, lz)], 0.014, "metal", seg=4, cap=False), A.IRON, jitter=0)
        k.paint(k.tube("back", [Pt(-0.17, 0.45, -0.17), Pt(-0.2, 0.8, -0.2), Pt(0, 0.92, -0.24), Pt(0.2, 0.8, -0.2), Pt(0.17, 0.45, -0.17)], 0.014, "metal", seg=4, cap=False), A.IRON, jitter=0)
        k.paint(k.tube("back_in", [Pt(-0.08, 0.47, -0.19), Pt(0, 0.8, -0.23), Pt(0.08, 0.47, -0.19)], 0.01, "metal", seg=3, cap=False), A.IRON, jitter=0)

    tables = [(-2.6, 0.2), (0.2, -0.9), (2.7, 0.5), (-0.9, 1.5)]
    for i, (x, z) in enumerate(tables):
        k.paint(k.cylinder("table_top", 0.38, 0.03, g(x, 0.72, z), "stone", seg=14), "#e9e4d6", jitter=0.02)
        k.paint(k.tube("table_leg", [g(x, 0.04, z), g(x, 0.72, z)], 0.025, "metal", seg=6), A.IRON, jitter=0)
        k.paint(k.cylinder("table_foot", 0.22, 0.04, g(x, 0, z), "metal", seg=10, r_top=0.05), A.IRON, jitter=0)
        n = 3 if i % 2 else 2
        for j in range(n):
            a = j / n * math.tau + i
            chair(x + math.cos(a) * 0.62, z + math.sin(a) * 0.62, -a + math.pi / 2 + (r.random() - 0.5) * 0.5)
        k.paint(k.cylinder("cup", 0.035, 0.05, g(x + 0.12, 0.75, z + 0.05), "plaster", seg=8), "#ffffff", jitter=0)
        k.paint(k.cylinder("glass", 0.03, 0.09, g(x - 0.1, 0.75, z - 0.08), "window", seg=8, r_top=0.035), "#c98a3a", jitter=0)
        k.collider(x, -z, 0.75)
    for (x, z), cols in (((-1.5, 0.6), ("#f3ead6", "#b5573a")), ((1.6, -0.1), ("#f3ead6", "#27512f"))):
        k.paint(k.tube("parasol_pole", [g(x, 0, z), g(x, 2.55, z)], 0.025, "wood", seg=6), A.WOOD_LIGHT, jitter=0)
        k.paint(k.cylinder("parasol_base", 0.24, 0.1, g(x, 0, z), "stone", seg=10), "#b9b3a6", jitter=0)
        bm = bmesh.new()
        apex = bm.verts.new(g(x, 2.6, z))
        n = 16
        rim = [bm.verts.new(g(x + math.cos(i / n * math.tau) * 1.7, 2.18 - (0.06 if i % 2 else 0), z + math.sin(i / n * math.tau) * 1.7)) for i in range(n)]
        for i in range(n):
            bm.faces.new((apex, rim[(i + 1) % n], rim[i]))
        o = k.add(bm, "parasol", "cloth", smooth=0)
        o.data.materials[0].use_backface_culling = False
        cx, cz = g(x, 0, z).x, g(x, 0, z).y
        k.paint(o, cols[0], jitter=0.02, fn=lambda c, n_, base, cx=cx, cz=cz, cols=cols: k.blend(cols[0], cols[1], float(int((math.atan2(c.y - cz, c.x - cx) / math.tau + 1) * 8) % 2)))
        k.collider(x, -z, 0.2)
    # Chalkboard and two planters closing the terrace.
    for s in (-1, 1):
        import mathutils

        o = k.bbox("board", (0.6, 0.03, 0.95), g(3.9, 0.5, -1.9 + s * 0.14), "wood", bevel=0.01, seg=1, rot=mathutils.Matrix.Rotation(s * 0.28, 4, "X"))
        k.paint(o, "#2a2a28", jitter=0.0, fn=lambda c, n_, base: k.blend(A.WOOD_LIGHT, "#2a2a28", 1.0 if (abs(c.x - 3.9) < 0.25 and 0.1 < c.z < 0.9) else 0.0))
    for x in (-3.9, 3.9):
        k.paint(k.bbox("planter", (0.5, 1.6, 0.55), g(x, 0.275, 1.9), "wood", bevel=0.03, seg=1), "#3f6b55", jitter=0.04)
        for j in range(3):
            A.clump(k, g(x, 0.85 + (j % 2) * 0.1, 1.3 + j * 0.6), 0.42, subdiv=1, scale=(1, 1, 0.9), sway=lambda co: 0.4)
        k.wall((x, -1.1), (x, -2.7), 0.3)
    k.anchor("label_board", g(3.9, 0.6, -1.7), kind="label")
    k.anchor("seat", g(0.2, 0.47, -0.3))
    k.finish(ao_strength=0.7, ao_samples=48)


def market_stall(k):
    """A fruit stall under a striped awning: the huerta, sold by the kilo."""
    r = k.rng
    W, D = 3.2, 1.5
    for sx in (-1, 1):
        for sz in (-1, 1):
            k.paint(k.bbox("post", (0.08, 0.08, 2.5 if sz < 0 else 2.15), g(sx * (W / 2), 1.25 if sz < 0 else 1.075, sz * (D / 2)), "wood", bevel=0.01, seg=1), A.WOOD_LIGHT, jitter=0.05)
    k.paint(k.bbox("counter", (W, D * 0.9, 0.08), g(0, 0.9, 0.05), "wood", bevel=0.02, seg=1), A.WOOD_LIGHT, jitter=0.05)
    k.paint(k.bbox("apron", (W, 0.05, 0.8), g(0, 0.48, D / 2 - 0.05), "cloth", bevel=0.0, seg=1), "#27512f", jitter=0.0, fn=lambda c, n_, base: k.blend("#27512f", "#f3ead6", float(int((c.x + 9) * 3.2) % 2)))
    put = A.face(math.pi / 2, 0, -D / 2)
    A.awning(k, put, math.pi / 2, 0, 2.5, W + 0.5, drop=0.42, reach=D + 0.55, colors=("#d9a441", "#f3ead6"))
    fruit = [("#f4d326", 0.07, (0.82, 0.82, 1.15)), ("#e58a2b", 0.08, (1, 1, 1)), ("#c9463d", 0.07, (1, 1, 0.9)), ("#6f9a48", 0.09, (1, 1, 0.8)), ("#7a2f5a", 0.075, (0.9, 0.9, 1.25))]
    for i in range(5):
        x = -W / 2 + 0.36 + i * (W - 0.72) / 4
        import mathutils

        o = k.bbox("crate", (0.56, 0.62, 0.2), g(x, 1.06, 0.2), "wood", bevel=0.015, seg=1, rot=mathutils.Matrix.Rotation(-0.3, 4, "X"))
        k.paint(o, "#b98f5e", jitter=0.07)
        col, rad, sc = fruit[i]
        for j in range(12):
            fx, fz = x - 0.19 + (j % 4) * 0.125, 0.0 + (j // 4) * 0.17
            f = k.sphere("fruit", rad, g(fx + (r.random() - 0.5) * 0.03, 1.2 - fz * 0.3 + r.random() * 0.03, fz + 0.03), "foliage", subdiv=1, scale=sc, smooth=70)
            k.paint(f, col, jitter=0.07, per_vertex=True, sway=lambda co: 0.0)
    for x in (-1.1, 0.3):
        k.paint(k.bbox("floor_crate", (0.6, 0.45, 0.32), g(x, 0.16, D / 2 + 0.5), "wood", bevel=0.015, seg=1), "#b98f5e", jitter=0.07)
        for j in range(8):
            f = k.sphere("fruit", 0.08, g(x - 0.2 + (j % 4) * 0.13, 0.36 + r.random() * 0.03, D / 2 + 0.4 + (j // 4) * 0.2), "foliage", subdiv=1, smooth=70)
            k.paint(f, "#e58a2b" if x < 0 else "#f4d326", jitter=0.07, per_vertex=True, sway=lambda co: 0.0)
    k.paint(k.cylinder("scale_pan", 0.16, 0.03, g(W / 2 - 0.3, 1.0, -0.3), "metal", seg=10), "#b99a4a", jitter=0)
    k.paint(k.tube("scale_arm", [g(W / 2 - 0.3, 1.0, -0.3), g(W / 2 - 0.3, 1.5, -0.3)], 0.015, "metal", seg=4), A.IRON, jitter=0)
    k.wall((-W / 2, D / 2), (W / 2, D / 2), 0.2)
    k.wall((-W / 2, -D / 2), (W / 2, -D / 2), 0.5)
    k.anchor("label_price", g(0, 1.5, D / 2), kind="label")
    k.anchor("customer", g(0, 0, D / 2 + 1.3))
    k.finish(ao_strength=0.75, ao_samples=48)


def fountain_plaza(k):
    """Octagonal fountain with a glazed-tile rim and two bowls. The water is
    modelled (and marked ANCHOR_water) so the engine can animate over it."""
    R = 2.6
    k.paint(k.cylinder("basin", R, 0.62, g(0, 0, 0), "stone", seg=8), A.STONE, jitter=0.06)
    band = k.cylinder("tiles", R + 0.02, 0.3, g(0, 0.18, 0), "terracotta", seg=8)
    k.paint(band, "#2f6f9a", jitter=0.0, fn=lambda c, n_, base: k.blend("#e9e4d2", "#d9a441" if int(c.z * 14) % 2 else "#2f6f9a", 1.0 if (int((math.atan2(c.y, c.x) + 7) * 9) + int(c.z * 14)) % 2 else 0.0))
    k.paint(k.cylinder("rim", R + 0.16, 0.14, g(0, 0.6, 0), "stone", seg=8), A.STONE_LIGHT, jitter=0.04)
    w = k.cylinder("water", R - 0.16, 0.04, g(0, 0.52, 0), "paint", seg=16)
    k.paint(w, "#5fa39a", jitter=0.0, per_vertex=True, fn=lambda c, n_, base: k.blend("#3f8f88", "#9fd0c2", min(1.0, Vector((c.x, c.y, 0)).length / R)))
    prof = [(0.5, 0.5), (0.34, 0.9), (0.24, 1.5), (0.3, 1.75), (1.25, 2.05), (1.3, 2.15), (0.2, 2.2), (0.14, 2.9), (0.7, 3.1), (0.74, 3.18), (0.1, 3.22), (0.06, 3.7)]
    n = 14
    rings = [[g(math.cos(i / n * math.tau) * rr, yy, math.sin(i / n * math.tau) * rr) for i in range(n)] for rr, yy in prof]
    o = k.loft("pedestal", rings, "stone", smooth=50)
    k.paint(o, A.STONE_LIGHT, jitter=0.03, per_vertex=True, fn=lambda c, n_, base: k.blend(A.STONE_DARK, A.STONE_LIGHT, min(1.0, max(0.0, 0.55 + n_.z * 0.5))))
    for rr, yy in ((1.18, 2.13), (0.66, 3.17)):
        k.paint(k.cylinder("bowl_water", rr, 0.02, g(0, yy, 0), "paint", seg=14), "#8cc6b6", jitter=0)
    for i in range(4):
        a = i / 4 * math.tau + 0.4
        k.paint(k.tube("jet", [g(math.cos(a) * 1.2, 2.1, math.sin(a) * 1.2), g(math.cos(a) * 1.55, 1.5, math.sin(a) * 1.55), g(math.cos(a) * 1.7, 0.56, math.sin(a) * 1.7)], 0.03, "paint", seg=4, cap=False), "#cfe8e0", jitter=0)
    k.anchor("water", g(0, 3.7, 0), kind="emitter")
    k.anchor("pool", g(0, 0.56, 0), kind="water")
    k.collider(0, 0, R + 0.2)
    k.finish(ao_strength=0.8, ao_samples=48)


def plaza_paving(k):
    """10 × 10 m of plaza floor: stone setts in a brick bond with a pale border.
    Tile it; top surface is at y ≈ 0.04, so sink it 4 cm or raise the plaza."""
    A.base_slab(k, 10, 10, y=-0.2, h=0.2)
    A.paving(k, 9.0, 9.0, cell=0.62, pattern="brick")
    for i, (w, d, ox, oz) in enumerate(((10, 0.5, 0, 4.75), (10, 0.5, 0, -4.75), (0.5, 9, 4.75, 0), (0.5, 9, -4.75, 0))):
        A.paving(k, w, d, cell=0.5, tones=("#efe4c9", "#e6d6b4", "#f3ead6"), ox=ox, oz=oz, name="border")
    k.anchor("next_x", g(10, 0, 0))
    k.anchor("next_z", g(0, 0, 10))
    k.finish(ao_strength=0.6, ao_samples=32)


def notice_board(k):
    """A tiled notice board on two posts: a stand for a project card or photo.
    ANCHOR_label_face marks where the engine draws the content (1.5 × 1.0 m)."""
    for s in (-1, 1):
        k.paint(k.bbox("post", (0.12, 0.12, 2.3), g(s * 0.9, 1.15, 0), "wood", bevel=0.02, seg=1), A.WOOD, jitter=0.06)
    k.paint(k.bbox("board", (1.9, 0.08, 1.3), g(0, 1.55, 0), "wood", bevel=0.02, seg=1), "#27512f", jitter=0.02)
    k.paint(k.bbox("face", (1.6, 0.02, 1.06), g(0, 1.55, 0.05), "plaster", bevel=0.0, seg=1), "#f3ead6", jitter=0)
    A.tile_roof(k, 2.0, 0.5, 2.32, rise=0.2, ov=0.12, courses=1)
    k.anchor("label_face", g(0, 1.55, 0.07), kind="label", width=1.5, height=1.0)
    k.anchor("light_00", g(0, 2.2, 0.4), kind="lamp")
    k.collider(0, 0, 0.95)
    k.finish(ao_strength=0.7, ao_samples=32)


def laundry_line(k):
    """Washing between two poles — the quickest way to say that people live here."""
    r = k.rng
    L = 5.0
    for s in (-1, 1):
        k.paint(k.tube("pole", [g(s * L / 2, 0, 0), g(s * L / 2, 2.5, 0)], 0.04, "wood", seg=6), A.WOOD_LIGHT, jitter=0.05)
        k.collider(s * L / 2, 0, 0.12)
    sag = lambda t: 2.42 - 0.22 * math.sin(t * math.pi)
    k.paint(k.tube("line", [g(-L / 2 + L * t, sag(t), 0) for t in [i / 10 for i in range(11)]], 0.008, "cloth", seg=3, cap=False), "#e9e4d6", jitter=0)
    items = [("#f3ead6", 1.0, 1.25), ("#c98a6a", 0.5, 0.6), ("#5d8fa0", 0.55, 0.7), ("#f3ead6", 0.45, 0.5), ("#d9a441", 0.6, 0.95), ("#b5573a", 0.4, 0.45)]
    x = -L / 2 + 0.35
    for col, w, h in items:
        t = (x + w / 2 + L / 2) / L
        y = sag(t)
        bm = bmesh.new()
        nx, ny = 4, 5
        vs = [[bm.verts.new(g(x + w * i / nx, y - h * j / ny, 0.05 * math.sin(i * 1.7 + j * 0.9) * (j / ny))) for i in range(nx + 1)] for j in range(ny + 1)]
        for j in range(ny):
            for i in range(nx):
                bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
        o = k.add(bm, "washing", "foliage", smooth=40)  # foliage surface = it moves with the wind
        o.data.materials[0].use_backface_culling = False
        k.paint(o, col, jitter=0.03, per_vertex=True, sway=lambda co, y=y, h=h: min(1.0, max(0.0, (y - co.z) / h)) * 0.9)
        x += w + 0.12 + r.random() * 0.1
    k.finish(ao_strength=0.4, ao_samples=24)


# ------------------------------------------------------------ vegetation
def olive_tree(k):
    """An old olive: a twisted, divided trunk and a broad, broken, silver crown."""
    r = k.rng
    sway = lambda co: min(1.0, max(0.0, (co.z - 1.6) / 3.0) * 0.6 + 0.15)
    boughs = []
    for i in range(3):
        a = i / 3 * math.tau + r.random() * 0.8
        tw = 0.5 + r.random() * 0.4
        pts = [g(math.cos(a) * 0.16, -0.2, math.sin(a) * 0.16), g(math.cos(a + tw) * 0.3, 0.8, math.sin(a + tw) * 0.3), g(math.cos(a + tw * 2) * 0.55, 1.7, math.sin(a + tw * 2) * 0.55), g(math.cos(a + tw * 2.4) * 1.3, 2.6, math.sin(a + tw * 2.4) * 1.3)]
        A.trunk(k, pts, 0.3 - i * 0.03, 0.11, bark=("#4a4034", "#8f8470"), seg=7)
        boughs.append((a + tw * 2.4, pts[-1]))
    k.paint(k.sphere("bole", 0.5, g(0, 0.15, 0), "wood", subdiv=2, scale=(1.15, 1.15, 0.7), noise=0.25, smooth=60), "#5f5446", jitter=0.08)
    for a, tip in boughs:
        for j in range(4):
            a2 = a + (j - 1.5) * 0.55 + (r.random() - 0.5) * 0.3
            d = 0.5 + r.random() * 1.1
            pos = tip + g(math.cos(a2) * d, 0.5 + r.random() * 0.9, math.sin(a2) * d)
            if j < 2:
                A.trunk(k, [tip, (tip + pos) / 2 + g(0, 0.1, 0), pos], 0.08, 0.03, bark=("#4a4034", "#8f8470"), seg=5, name="twig")
            A.clump(k, pos, 0.75 + r.random() * 0.4, tones=A.OLIVE, sway=sway, subdiv=2, scale=(1.25, 1.25, 0.55), noise=0.2)
    A.clump(k, g(0, 3.7, 0), 1.0, tones=A.OLIVE, sway=sway, subdiv=2, scale=(1.3, 1.3, 0.55), noise=0.2)
    k.collider(0, 0, 0.55)
    k.anchor("canopy", g(0, 3.2, 0))
    k.finish(ao_strength=0.75, ao_samples=48)


def orange_tree(k):
    """Orange tree: dense dark crown built from many clumps, fruit catching the light."""
    r = k.rng
    sway = lambda co: min(1.0, max(0.0, (co.z - 1.2) / 2.4) * 0.6 + 0.1)
    A.trunk(k, [g(0, -0.2, 0), g(0.05, 0.7, 0.03), g(-0.04, 1.5, 0)], 0.17, 0.11, seg=7)
    cy = 2.75
    tones = ("#1f4a24", "#3f7a33", "#7fb04a")
    spots = [(0, cy + 0.55, 0, 1.0)]
    for i in range(7):
        a = i / 7 * math.tau + r.random() * 0.4
        spots.append((math.cos(a) * 0.95, cy - 0.25 + r.random() * 0.6, math.sin(a) * 0.95, 0.72 + r.random() * 0.2))
    for i in range(3):
        a = i / 3 * math.tau + 1.0
        A.trunk(k, [g(0, 1.4, 0), g(math.cos(a) * 0.5, 2.0, math.sin(a) * 0.5), g(math.cos(a) * 0.85, 2.5, math.sin(a) * 0.85)], 0.08, 0.035, seg=5, name="branch")
    A.clump(k, g(0, cy + 0.1, 0), 1.25, tones=tones, sway=sway, subdiv=3, scale=(1.05, 1.05, 0.95), noise=0.14, freq=1.5)
    for x, y, z, rad in spots:
        A.clump(k, g(x * 1.12, y, z * 1.12), rad * 0.72, tones=tones, sway=sway, subdiv=2, scale=(1, 1, 0.85), noise=0.14, freq=2.0)
    for i in range(16):
        x, y, z, rad = spots[r.randrange(len(spots))]
        a, el = r.random() * math.tau, -0.4 + r.random() * 1.0
        d = Vector((math.cos(a) * math.cos(el), math.sin(el) * 0.9, math.sin(a) * math.cos(el))) * rad * 0.98
        f = k.sphere("orange", 0.085, g(x + d.x, y + d.y, z + d.z), "foliage", subdiv=1, smooth=70)
        k.paint(f, "#ee8a22", jitter=0.05, per_vertex=True, sway=sway, fn=lambda c, n_, base: k.blend("#c96a14", "#f6a030", min(1.0, n_.z * 0.5 + 0.6)))
    k.collider(0, 0, 0.4)
    k.anchor("canopy", g(0, cy, 0))
    k.finish(ao_strength=0.75, ao_samples=48)


def cypress_tall(k):
    """Mediterranean cypress: a dark flame, never quite straight."""
    r = k.rng
    h = 9.0 + r.random() * 1.5
    lean = (r.random() - 0.5) * 0.5
    sway = lambda co: min(1.0, max(0.0, co.z / h) ** 1.5 * 0.55)
    A.trunk(k, [g(0, -0.2, 0), g(lean * 0.1, 1.0, 0)], 0.16, 0.12, seg=6)
    rings = []
    n, seg = 12, 10
    off = Vector((r.random() * 9, r.random() * 9, r.random() * 9))
    for i in range(n + 1):
        t = i / n
        rad = 1.05 * (math.sin(min(1.0, t * 1.25) * math.pi * 0.5) ** 0.6) * (1 - t) ** 0.62 + 0.03
        y = 0.75 + t * (h - 0.75)
        ring = []
        for j in range(seg):
            a = j / seg * math.tau
            rr = rad * (1 + 0.2 * mnoise.noise(Vector((math.cos(a) * 1.4, math.sin(a) * 1.4, t * 6.0)) + off))
            ring.append(g(lean * t * t + math.cos(a) * rr, y, math.sin(a) * rr))
        rings.append(ring)
    o = k.loft("flame", rings, "foliage", smooth=75)
    shade, body, sun = A.PINE
    k.paint(o, body, jitter=0.1, per_vertex=True, sway=sway, fn=lambda c, n_, base: k.blend(shade, sun, min(1.0, max(0.0, 0.25 + n_.z * 0.6 + n_.x * 0.25))))
    for i in range(5):
        t = 0.15 + i * 0.16
        a = r.random() * math.tau
        A.clump(k, g(lean * t * t + math.cos(a) * 0.55 * (1 - t), 0.9 + t * (h - 1.2), math.sin(a) * 0.55 * (1 - t)), 0.42 * (1 - t * 0.5), tones=A.PINE, sway=sway, subdiv=2, scale=(1, 1, 1.9), noise=0.16)
    k.collider(0, 0, 0.5)
    k.finish(ao_strength=0.7, ao_samples=48)


def prickly_pear(k):
    """Chumbera: paddle cactus with its red fruit. Grows on every dry bank here."""
    r = k.rng
    tones = ("#4a6b3c", "#7f9a55", "#a9bb72")

    def pad(base, a, tilt, size, depth):
        d = Vector((math.cos(a) * math.sin(tilt), math.cos(tilt), math.sin(a) * math.sin(tilt)))
        centre = Vector(base) + d * size * 0.9
        o = k.sphere("pad", size, g(*centre), "foliage", subdiv=2, scale=(1, 1, 1), noise=0.05, smooth=75)
        import mathutils

        gc = g(*centre)
        m = mathutils.Matrix.Translation(gc) @ mathutils.Matrix.Rotation(-a, 4, "Z") @ mathutils.Matrix.Rotation(tilt, 4, "Y") @ mathutils.Matrix.Diagonal((0.2, 0.72, 1.0, 1.0)) @ mathutils.Matrix.Translation(-gc)
        o.data.transform(m)
        k.paint(o, tones[1], jitter=0.07, per_vertex=True, sway=lambda co: 0.0, fn=lambda c, n_, base_: k.blend(tones[0], tones[2], min(1.0, max(0.0, 0.5 + n_.z * 0.6))))
        tip = centre + d * size * 0.95
        if depth > 0:
            for j in range(2 if depth > 1 else r.randrange(1, 3)):
                pad(tip - d * size * 0.15, a + (j - 0.5) * 1.6 + (r.random() - 0.5), tilt * 0.6 + (r.random() - 0.3) * 0.7, size * 0.8, depth - 1)
        else:
            for j in range(r.randrange(0, 4)):
                f = k.sphere("fruit", 0.07, g(*(tip + Vector(((j - 1) * 0.12, 0.02, (r.random() - 0.5) * 0.1)))), "foliage", subdiv=1, scale=(0.8, 0.8, 1.3), smooth=60)
                k.paint(f, "#b83a4a" if j % 2 else "#d98a2a", jitter=0.08, per_vertex=True, sway=lambda co: 0.0)

    for i in range(4):
        a = i / 4 * math.tau + r.random()
        pad((math.cos(a) * 0.25, 0.0, math.sin(a) * 0.25), a, 0.15 + r.random() * 0.35, 0.46 + r.random() * 0.12, 2)
    k.collider(0, 0, 0.9)
    k.finish(ao_strength=0.7, ao_samples=48)


def bougainvillea_pergola(k):
    """A timber pergola carrying a bougainvillea: shade with a roof of magenta."""
    r = k.rng
    W, D, H = 4.4, 3.0, 2.6
    for sx in (-1, 1):
        for sz in (-1, 1):
            k.paint(k.bbox("post", (0.16, 0.16, H), g(sx * W / 2, H / 2, sz * D / 2), "wood", bevel=0.02, seg=1), A.WOOD, jitter=0.06)
            k.paint(k.bbox("post_base", (0.3, 0.3, 0.4), g(sx * W / 2, 0.2, sz * D / 2), "stone", bevel=0.03, seg=1), A.STONE, jitter=0.05)
            k.collider(sx * W / 2, -sz * D / 2, 0.2)
        k.paint(k.bbox("beam", (0.12, D + 0.7, 0.18), g(sx * W / 2, H + 0.09, 0), "wood", bevel=0.02, seg=1), A.WOOD, jitter=0.06)
    for i in range(8):
        x = -W / 2 - 0.3 + i * (W + 0.6) / 7
        k.paint(k.bbox("rafter", (0.07, D + 1.0, 0.12), g(x, H + 0.24, 0), "wood", bevel=0.01, seg=1), A.WOOD_LIGHT, jitter=0.07)
    A.trunk(k, [g(-W / 2 + 0.2, 0, D / 2 - 0.1), g(-W / 2 + 0.12, 1.4, D / 2 - 0.2), g(-W / 2 + 0.3, H + 0.2, D / 2 - 0.4), g(0, H + 0.4, 0)], 0.08, 0.03, seg=5, name="vine")
    tones = ("#7a1f4a", "#c2357a", "#ee7fb2")
    for i in range(18):
        x, z = (r.random() - 0.5) * (W + 0.5), (r.random() - 0.5) * (D + 0.7)
        hang = r.random() < 0.3
        A.clump(k, g(x, H + 0.45 - (0.6 + r.random() * 0.5 if hang else 0.0), z if not hang else math.copysign(D / 2 + 0.25, z)), 0.5 + r.random() * 0.3,
                tones=tones if i % 5 else A.LEAF, subdiv=2, scale=(1.15, 1.15, 0.62 if not hang else 1.15), noise=0.18, sway=lambda co: 0.5)
    k.paint(k.bbox("bench", (2.2, 0.5, 0.08), g(0, 0.46, -D / 2 + 0.4), "wood", bevel=0.02, seg=1), A.WOOD_LIGHT, jitter=0.05)
    for s in (-0.9, 0.9):
        k.paint(k.bbox("bench_leg", (0.1, 0.44, 0.44), g(s, 0.22, -D / 2 + 0.4), "stone", bevel=0.03, seg=1), A.STONE, jitter=0.05)
    k.anchor("seat", g(0, 0.5, -D / 2 + 0.4))
    k.anchor("shade", g(0, 0, 0), kind="poi")
    k.finish(ao_strength=0.75, ao_samples=48)


def river_reeds(k):
    """Giant cane (caña) along the Segura: tall stems, arching leaves, plumes."""
    r = k.rng
    sway = lambda co: min(1.0, max(0.0, co.z / 3.4)) ** 1.3
    for i in range(15):
        a, d = r.random() * math.tau, r.random() * 0.9
        x, z = math.cos(a) * d, math.sin(a) * d
        h = 2.6 + r.random() * 1.4
        lean = (math.cos(a) * 0.5 * r.random(), math.sin(a) * 0.5 * r.random())
        stem = [g(x + lean[0] * t * t, h * t, z + lean[1] * t * t) for t in (0, 0.35, 0.7, 1.0)]
        o = k.tube("cane", stem, 0.03, "foliage", seg=4, r_end=0.012, cap=False)
        k.paint(o, "#9aa85c", jitter=0.06, per_vertex=True, sway=sway, fn=lambda c, n_, base: k.blend("#7f9048", "#c2c27a", min(1.0, c.z / 3.0)))
        for j in range(4):
            t = 0.3 + j * 0.17
            px, pz = x + lean[0] * t * t, z + lean[1] * t * t
            la = a + j * 2.4
            tip = g(px + math.cos(la) * 0.75, h * t - 0.05, pz + math.sin(la) * 0.75)
            mid = g(px + math.cos(la) * 0.4, h * t + 0.22, pz + math.sin(la) * 0.4)
            leaf = k.tube("leaf", [g(px, h * t, pz), mid, tip], 0.03, "foliage", seg=3, r_end=0.004, cap=False)
            k.paint(leaf, "#6f9048", jitter=0.08, per_vertex=True, sway=sway)
        if i % 2 == 0:
            top = stem[-1]
            pl = k.sphere("plume", 0.16, top + Vector((0, 0, 0.25)), "foliage", subdiv=1, scale=(0.7, 0.7, 2.6), noise=0.15, smooth=60)
            k.paint(pl, "#d9cfa8", jitter=0.06, per_vertex=True, sway=lambda co: 1.0)
    k.collider(0, 0, 0.9)
    k.finish(ao_strength=0.6, ao_samples=32)


# ---------------------------------------------------------------- huerta
def noria(k):
    """Waterwheel on a stone aqueduct: how the huerta has lifted water from
    the river for centuries. PART-free: the wheel is one mesh; see ART_HANDOFF
    for the spin extension. Wheel axis = x, hub at ANCHOR_hub."""
    R = 3.6
    hub = (0.0, R + 0.25, 0.0)
    # Piers and the aqueduct that receives the water.
    for sx in (-1, 1):
        k.paint(k.bbox("pier", (0.9, 1.5, hub[1] + 0.4), g(sx * 1.35, (hub[1] + 0.4) / 2 - 0.4, 0), "stone", bevel=0.06, seg=1), A.STONE, jitter=0.07)
        k.paint(k.bbox("pier_cap", (1.05, 1.7, 0.2), g(sx * 1.35, hub[1] + 0.1, 0), "stone", bevel=0.05, seg=1), A.STONE_LIGHT, jitter=0.04)
        k.collider(sx * 1.35, 0, 0.95)
    put = A.face(math.pi, -2.0, -4.2)
    for i in range(3):
        zc = -1.9 - i * 2.6
        f2 = A.face(math.pi, -1.8, zc)
        A.arch_ring(k, f2, math.pi, 0.0, hub[1] - 2.2, 0.95, depth=0.85, n=9, ring=0.26, proud=0.02)
        k.paint(k.bbox("aq_pier", (0.85, 0.6, hub[1] - 1.6), g(-2.2, (hub[1] - 1.6) / 2 - 0.4, zc - 1.3), "stone", bevel=0.05, seg=1), A.STONE, jitter=0.07)
        k.collider(-2.2, -(zc - 1.3), 0.6)
    k.paint(k.bbox("aq_deck", (0.95, 8.4, 1.25), g(-2.2, hub[1] - 0.75, -4.2), "stone", bevel=0.05, seg=1), A.STONE, jitter=0.06, fn=A.stone_tone(k))
    k.paint(k.box("aq_water", (0.5, 8.2, 0.04), g(-2.2, hub[1] - 0.14, -4.2), "paint"), "#6fb0a4", jitter=0.02)
    del put
    # The wheel: two rims, spokes, paddles and buckets.
    n = 20
    for sx in (-0.42, 0.42):
        for rr in (R, R * 0.62):
            pts = [g(sx, hub[1] + math.sin(a) * rr, math.cos(a) * rr) for a in [i / 40 * math.tau for i in range(41)]]
            k.paint(k.tube("rim", pts, 0.06, "wood", seg=4, cap=False), A.WOOD, jitter=0.05)
        for i in range(n // 2):
            a = i / (n // 2) * math.tau
            k.paint(k.tube("spoke", [g(sx, hub[1], 0), g(sx, hub[1] + math.sin(a) * R, math.cos(a) * R)], 0.045, "wood", seg=4, cap=False), A.WOOD_LIGHT, jitter=0.06)
    for i in range(n):
        a = i / n * math.tau
        y, z = hub[1] + math.sin(a) * (R + 0.1), math.cos(a) * (R + 0.1)
        import mathutils

        rot = mathutils.Matrix.Rotation(a, 4, "X")
        o = k.box("paddle", (1.0, 0.06, 0.55), g(0, y, z), "wood", rot=rot)
        k.paint(o, A.WOOD_LIGHT, jitter=0.09)
        b = k.cylinder("bucket", 0.11, 0.3, g(0.62, y - 0.15, z), "terracotta", seg=6, r_top=0.14)
        k.paint(b, "#b86a48", jitter=0.06)
    k.paint(k.tube("axle", [g(-1.9, hub[1], 0), g(1.9, hub[1], 0)], 0.16, "wood", seg=8), A.WOOD, jitter=0.04)
    k.anchor("hub", g(*hub), kind="spin", axis="x")
    k.anchor("pour", g(-1.3, hub[1] + R - 0.3, 0.2), kind="emitter")
    k.anchor("channel_end", g(-2.2, hub[1] - 0.14, -8.4))
    k.anchor("view", g(7.5, 2.2, 6.5))
    k.finish(ao_strength=0.8, ao_samples=64)


def acequia(k):
    """10 m of irrigation channel with a sluice gate. Tile along z."""
    L = 10.0
    sec = [(-0.9, 0.0), (-0.62, 0.34), (-0.4, 0.34), (-0.34, -0.3), (0.34, -0.3), (0.4, 0.34), (0.62, 0.34), (0.9, 0.0)]
    n = 10
    rings = [[g(x + 0.03 * math.sin(i * 1.3 + j), y, -L / 2 + L * i / n) for j, (x, y) in enumerate(sec)] for i in range(n + 1)]
    o = k.loft("channel", rings, "stone", closed=False, cap=(False, False), smooth=25)
    k.paint(o, A.STONE, jitter=0.05, per_vertex=True, fn=lambda c, n_, base: k.blend("#6f7a5a", A.STONE, min(1.0, max(0.0, (c.z + 0.3) / 0.5))))
    w = k.box("water", (0.7, L, 0.03), g(0, 0.08, 0), "paint")
    k.paint(w, "#5fa39a", jitter=0.02)
    for s in (-1, 1):
        k.paint(k.bbox("gate_post", (0.14, 0.16, 1.2), g(s * 0.48, 0.75, 1.5), "stone", bevel=0.02, seg=1), A.STONE_LIGHT, jitter=0.04)
    k.paint(k.bbox("gate", (0.8, 0.05, 0.6), g(0, 0.65, 1.5), "wood", bevel=0.01, seg=1), A.WOOD, jitter=0.06)
    k.paint(k.tube("gate_screw", [g(0, 0.9, 1.5), g(0, 1.55, 1.5)], 0.02, "metal", seg=5), A.IRON, jitter=0)
    k.paint(k.tube("gate_wheel", [g(math.cos(a) * 0.16, 1.55, 1.5 + math.sin(a) * 0.16) for a in [i / 10 * math.tau for i in range(11)]], 0.015, "metal", seg=4, cap=False), A.IRON, jitter=0)
    r = k.rng
    for i in range(10):
        s = 1 if i % 2 else -1
        A.clump(k, g(s * (0.85 + r.random() * 0.3), 0.12, -L / 2 + 0.5 + i * 0.95), 0.22 + r.random() * 0.12, tones=("#4a6b3c", "#7f9a55", "#a9bb72"), subdiv=1, scale=(1, 1, 0.7), sway=lambda co: 0.5)
    k.wall((0, L / 2), (0, -L / 2), 0.5)
    k.anchor("next", g(0, 0, L / 2))
    k.anchor("water", g(0, 0.1, 0), kind="water")
    k.finish(ao_strength=0.7, ao_samples=32)


def huerta_rows(k):
    """10 × 10 m market-garden plot: raised rows of lettuce and artichoke
    between furrows. Tile to make fields."""
    r = k.rng
    A.base_slab(k, 10, 10, y=-0.2, h=0.2, color="#8a6a48")
    rows = 8
    for i in range(rows):
        x = -4.4 + i * (8.8 / (rows - 1))
        sec = [(-0.42, 0.0), (-0.2, 0.2), (0.2, 0.2), (0.42, 0.0)]
        n = 8
        rings = [[g(x + sx + 0.03 * math.sin(j * 1.9 + i), y + 0.02 * math.sin(j + i), -5 + 10 * j / n) for sx, y in sec] for j in range(n + 1)]
        o = k.loft("ridge", rings, "earth", closed=False, cap=(False, False), smooth=40)
        k.paint(o, "#9a7650", jitter=0.06, per_vertex=True, fn=lambda c, n_, base: k.blend("#6f5236", "#a98560", min(1.0, max(0.0, c.z / 0.2))))
        crop = i % 3
        for j in range(11):
            z = -4.6 + j * 0.92 + (r.random() - 0.5) * 0.1
            if crop == 0:
                A.clump(k, g(x, 0.3, z), 0.24, tones=("#5f8a3a", "#9fc45a", "#c9e08a"), subdiv=1, scale=(1, 1, 0.6), sway=lambda co: 0.25, noise=0.2)
            elif crop == 1:
                A.clump(k, g(x, 0.42, z), 0.32, tones=("#4a6b4a", "#7f9a7a", "#aebfa0"), subdiv=1, scale=(1, 1, 1.0), sway=lambda co: 0.35, noise=0.3)
            else:
                for q in range(3):
                    a = q / 3 * math.tau + j
                    lf = k.tube("leaf", [g(x, 0.2, z), g(x + math.cos(a) * 0.12, 0.5, z + math.sin(a) * 0.12), g(x + math.cos(a) * 0.3, 0.62, z + math.sin(a) * 0.3)], 0.03, "foliage", seg=3, r_end=0.004, cap=False)
                    k.paint(lf, "#4f8a3a", jitter=0.1, per_vertex=True, sway=lambda co: min(1.0, co.z / 0.6))
    k.anchor("next_x", g(10, 0, 0))
    k.anchor("next_z", g(0, 0, 10))
    k.finish(ao_strength=0.6, ao_samples=32)


def sierra_backdrop(k):
    """A slice of sierra, 78 m long, three ridges deep. Each ridge is paler than
    the one in front: aerial perspective painted in, so the horizon has depth
    even with the engine's simple fog. Place far, repeat round the valley."""
    r = k.rng
    off = Vector((r.random() * 20, r.random() * 20, 0))
    L = 78.0
    layers = [(0.0, 15.0, "#a8946c", "#c9b792"), (-9.0, 22.0, "#b8ac90", "#d3c8ae"), (-18.0, 28.0, "#c9c4b4", "#dfdccf")]
    for li, (z, hmax, low, high) in enumerate(layers):
        n = 40
        crest = []
        for i in range(n + 1):
            t = i / n
            x = -L / 2 + L * t
            env = math.sin(t * math.pi) ** 0.6
            h = hmax * env * (0.55 + 0.45 * abs(mnoise.noise(Vector((x * 0.035 + li * 9, li * 3.0, 0)) + off)) + 0.12 * mnoise.noise(Vector((x * 0.16, li, 0)) + off))
            crest.append((x, max(0.6, h)))
        bm = bmesh.new()
        rows = 5
        grid = []
        for q in range(rows + 1):
            f = q / rows
            row = []
            for x, h in crest:
                bulge = math.sin(f * math.pi) * 2.2 * (1 + 0.5 * mnoise.noise(Vector((x * 0.08, f * 3, li)) + off))
                row.append(bm.verts.new(g(x, -1.0 + (h + 1.0) * f, z + 6.0 * (1 - f) + bulge * (1 - f))))
            grid.append(row)
        for q in range(rows):
            for i in range(n):
                bm.faces.new((grid[q][i], grid[q][i + 1], grid[q + 1][i + 1], grid[q + 1][i]))
        o = k.add(bm, "ridge", "earth", smooth=45)
        k.paint(o, low, jitter=0.03, per_vertex=True, fn=lambda c, n_, base, low=low, high=high, hmax=hmax: k.blend(low, high, min(1.0, max(0.0, c.z / hmax)) * 0.7 + max(0.0, n_.z) * 0.3))
    k.anchor("next", g(L * 0.82, 0, 0))
    k.finish(ao=False)


BUILDERS = {f.__name__: f for f in (church, church_tower, arcade_house, shop_house, bandstand, cafe_terrace, market_stall, fountain_plaza, plaza_paving, notice_board, laundry_line,
                                    olive_tree, orange_tree, cypress_tall, prickly_pear, bougainvillea_pergola, river_reeds, noria, acequia, huerta_rows, sierra_backdrop)}
BUDGET = {"church": 7400, "church_tower": 5000, "arcade_house": 7400, "shop_house": 7400, "bandstand": 4500, "cafe_terrace": 6000, "market_stall": 5000, "fountain_plaza": 1800, "plaza_paving": 4200,
          "olive_tree": 2400, "orange_tree": 1800, "cypress_tall": 900, "prickly_pear": 2600, "bougainvillea_pergola": 3400, "river_reeds": 1800, "noria": 5000, "huerta_rows": 5500,
          "sierra_backdrop": 1400}
GROUND = {"acequia": -0.3, "huerta_rows": -0.2, "plaza_paving": -0.2, "noria": -0.4, "sierra_backdrop": -1.0}
