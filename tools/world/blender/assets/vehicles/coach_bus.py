"""Intercity coach — the road vehicle for the Europe chapter.

Original design. High-deck body with real glazing (M_glass) and a simplified
interior you can read from outside. Front wheels hang from steering pivots;
every wheel is its own node, so it can be driven, not just displayed.
"""

import math
import os
import sys

import bmesh

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from ptw import parts as P  # noqa: E402
from ptw.parts import g  # noqa: E402

L, W = 12.2, 2.55
Y0, Y1 = 0.36, 3.56
FLOOR = 1.22
WR, WW = 0.5, 0.3
AX_F, AX_R = 3.75, -3.35
TRACK = 1.04
WIN0, WIN1 = 1.72, 2.72

SPEC = {
    "id": "coach_bus",
    "pack": "vehicles",
    "asset_class": "hero",
    "author": "Claude (vehicle factory)",
    "seed": 8,
    "tri_budget": 16000,
    "ao_distance": 0.8,
    "preview_dir": (-0.85, -1.0, 0.32),
    "meta": {"chapter": "europe", "vehicle": "bus", "length": L, "width": W, "height": Y1, "wheelbase": AX_F - AX_R, "track": TRACK * 2, "wheel_radius": WR, "origin": "ground, body centre", "door_side": "-x (right-hand traffic)"},
}


def cut_faces(obj, pred):
    """Remove faces whose centre satisfies pred(centre) — used to open the glazing."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    doomed = [f for f in bm.faces if pred(f.calc_center_median())]
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    bm.to_mesh(obj.data)
    bm.free()


def build(k):
    sec = P.body_section(W, Y0, Y1, r_bot=0.14, r_top=0.42, stations=(1.0, 1.5, 1.62, WIN0, WIN1, 3.0), seg=4, tumble=0.05)
    zs = [-L / 2, -L / 2 + 0.35] + [-L / 2 + 0.9 + i * (L - 2.0) / 12 for i in range(13)] + [L / 2 - 0.4, L / 2 - 0.12, L / 2]
    rings = []
    for z in zs:
        e = min(z + L / 2, L / 2 - z)
        s = 1.0 if e > 0.6 else 0.93 + 0.07 * (e / 0.6) ** 0.5
        sy = 1.0 if e > 0.6 else 0.975 + 0.025 * (e / 0.6)
        rings.append(P.ring(P.scale_section(sec, s, sy, Y0), z))
    body = k.loft("body", rings, "paint", smooth=45)
    body.data.materials[0].use_backface_culling = False  # the cabin is seen from inside too
    glaze = lambda c: WIN0 < c.z < WIN1 and abs(c.x) > W * 0.4 and -L / 2 + 0.9 < -c.y < L / 2 - 0.45
    cut_faces(body, glaze)
    cut_faces(body, lambda c: -c.y > L / 2 - 0.05 and 1.62 < c.z < 3.2)  # windscreen opening
    # Wheel arches: open the skirt over each axle so the wheels can be seen (and steer).
    cut_faces(body, lambda c: c.z < 1.0 and abs(c.x) > W * 0.4 and min(abs(-c.y - AX_F), abs(-c.y - AX_R)) < 0.78)

    def livery(c, n_, base):
        y = c.z
        if n_.z > 0.75 and y > 3.2:
            return k.blend(P.CREAM, P.STEEL, 0.25)
        if y < 1.0:
            return k.blend(P.GREEN, P.GREEN, 1)
        if 1.5 < y < 1.62:
            return k.blend(P.TERRACOTTA, P.TERRACOTTA, 1)
        if y > WIN1 and y < 3.0 and abs(n_.x) > 0.6:
            return k.blend(P.GREEN, P.GREEN, 1)
        return k.blend(P.CREAM, P.CREAM, 1)

    k.paint(body, P.CREAM, jitter=0.012, fn=livery)

    # ---- Glazing: pillars, side glass, windscreen ----------------------------
    xw = W / 2 - 0.03
    bays = 8
    z0, z1 = -L / 2 + 0.95, L / 2 - 0.5
    bw = (z1 - z0) / bays
    for i in range(bays + 1):
        z = z0 + i * bw
        for s in (-1, 1):
            P.panel(k, "pillar", 0.13, WIN1 - WIN0 + 0.06, (s * (xw - 0.02), (WIN0 + WIN1) / 2, z), "paint", P.INK, yaw=0 if s > 0 else math.pi, depth=0.07, bevel=0.01)
    for i in range(bays):
        z = z0 + (i + 0.5) * bw
        for s in (-1, 1):
            if s < 0 and (i == bays - 1 or i == 3):
                continue  # doors live here
            P.panel(k, "side_glass", bw - 0.1, WIN1 - WIN0, (s * xw, (WIN0 + WIN1) / 2, z), "glass", "#a9c2bf", yaw=0 if s > 0 else math.pi, depth=0.025, bevel=0.0)
    P.panel(k, "windscreen", W - 0.34, 1.52, (0, 2.42, L / 2 - 0.02), "glass", "#a9c2bf", yaw=math.pi / 2, depth=0.03, bevel=0.0)
    P.panel(k, "destination", W - 0.6, 0.24, (0, 3.31, L / 2 + 0.005), "window", P.INK, yaw=math.pi / 2, depth=0.03, bevel=0.03)
    P.panel(k, "rear_window", W - 0.7, 0.8, (0, 2.3, -L / 2 - 0.005), "window", P.GLASS_DARK, yaw=-math.pi / 2, depth=0.03, bevel=0.08)
    for sx in (-0.42, 0.42):
        k.paint(k.bbox("wiper", (0.03, 0.03, 0.8), g(sx, 2.05, L / 2 + 0.03), "metal", bevel=0.005), P.INK, jitter=0)

    # ---- Doors (right side) --------------------------------------------------
    for tag, i in (("front", bays - 1), ("mid", 3)):
        z = z0 + (i + 0.5) * bw
        node = k.node(f"PART_door_{tag}", g(-W / 2, 1.9, z + bw / 2 - 0.05), role="door", axis="y", limit_deg=88, swings="out")
        P.panel(k, "door", bw - 0.12, 1.3, (-(W / 2 - 0.01), 1.04, z), "paint", P.CREAM, yaw=math.pi, depth=0.05, parent=node, bevel=0.03)
        P.panel(k, "door_glass", bw - 0.12, WIN1 - WIN0 + 0.04, (-(W / 2 - 0.005), (WIN0 + WIN1) / 2, z), "glass", "#a9c2bf", yaw=math.pi, depth=0.025, parent=node, bevel=0.0)
        P.panel(k, "door_split", 0.05, 2.3, (-(W / 2 + 0.012), 1.55, z), "rubber", P.INK, yaw=math.pi, depth=0.02, parent=node, bevel=0.0)
        P.panel(k, "door_kick", bw - 0.12, 0.5, (-(W / 2 + 0.012), 0.66, z), "paint", P.GREEN, yaw=math.pi, depth=0.02, parent=node, bevel=0.0)
        k.anchor(f"door_{tag}", g(-W / 2 - 0.7, 0, z), kind="boarding")

    # ---- Luggage hatches, grille, bumpers, roof pod ---------------------------
    for s in (-1, 1):
        for z in (-2.05, 1.25):
            P.panel(k, "hatch", 1.55, 0.72, (s * (W / 2 - 0.005), 1.08, z), "paint", P.CREAM_SHADE, yaw=0 if s > 0 else math.pi, depth=0.03, bevel=0.03)
        for az in (AX_F, AX_R):
            # Wheel-arch lip: a dark band over the wheel, which stays visible below it.
            P.panel(k, "arch", 1.36, 0.16, (s * (W / 2 + 0.005), WR * 2 + 0.1, az), "rubber", P.INK, yaw=0 if s > 0 else math.pi, depth=0.05, bevel=0.06)
    P.panel(k, "grille", 1.5, 0.3, (0, 0.92, L / 2 + 0.005), "metal", P.INK, yaw=math.pi / 2, depth=0.03, bevel=0.03)
    P.panel(k, "engine_grille", 1.7, 0.5, (0, 1.05, -L / 2 - 0.005), "metal", P.INK, yaw=-math.pi / 2, depth=0.03, bevel=0.03)
    for z, f in ((L / 2 + 0.02, 1), (-L / 2 - 0.02, -1)):
        k.paint(k.bbox("bumper", (W - 0.1, 0.2, 0.3), g(0, 0.5, z), "rubber", bevel=0.08), P.INK, jitter=0.02)
    k.paint(k.bbox("roof_pod", (1.7, 3.2, 0.26), g(0, Y1 + 0.06, -1.2), "paint", bevel=0.1), P.CREAM, jitter=0.01)
    for z in (2.6, -4.6):
        k.paint(k.bbox("roof_hatch", (0.8, 0.8, 0.06), g(0, Y1 + 0.01, z), "metal", bevel=0.02), P.STEEL, jitter=0)

    # ---- Lights and mirrors ----------------------------------------------------
    for sx in (-1, 1):
        P.lamp(k, (sx * 0.98, 0.98, L / 2 + 0.0), 0.12, anchor=f"headlight_{'l' if sx > 0 else 'r'}")
        P.lamp(k, (sx * 0.72, 0.98, L / 2 + 0.0), 0.085, name="fog")
        P.lamp(k, (sx * 1.1, 1.22, L / 2 - 0.02), 0.05, color=P.MUSTARD, name="indicator")
        P.lamp(k, (sx * 1.0, 1.25, -L / 2 - 0.0), 0.1, color=P.TAIL, facing=-1, name="tail", anchor=f"taillight_{'l' if sx > 0 else 'r'}")
        P.lamp(k, (sx * 1.0, 1.52, -L / 2 - 0.0), 0.06, color=P.MUSTARD, facing=-1, name="rear_indicator")
        arm = [g(sx * (W / 2 - 0.12), 3.25, L / 2 - 0.1), g(sx * (W / 2 + 0.28), 3.3, L / 2 + 0.45), g(sx * (W / 2 + 0.3), 2.75, L / 2 + 0.5)]
        k.paint(k.tube("mirror_arm", arm, 0.03, "metal", seg=6), P.INK, jitter=0)
        k.paint(k.bbox("mirror", (0.08, 0.14, 0.42), g(sx * (W / 2 + 0.3), 2.5, L / 2 + 0.5), "paint", bevel=0.04), P.INK, jitter=0)
        k.paint(k.bbox("mirror_face", (0.02, 0.11, 0.34), g(sx * (W / 2 + 0.3), 2.5, L / 2 + 0.42), "window", bevel=0.0), "#8fa5a3", jitter=0)

    # ---- Interior: floor, seats, driver ------------------------------------------
    k.paint(k.box("floor", (W - 0.16, L - 0.5, 0.06), g(0, FLOOR, 0), "cloth"), "#6f6a62", jitter=0.02)
    P.seat_rows(k, -L / 2 + 0.9, L / 2 - 2.3, FLOOR, (-0.94, -0.46, 0.46, 0.94), pitch=0.92)
    k.paint(k.bbox("dash", (W - 0.5, 0.5, 0.42), g(0, FLOOR + 0.55, L / 2 - 0.45), "rubber", bevel=0.12), P.INK, jitter=0.02)
    k.paint(k.bbox("driver_seat", (0.5, 0.5, 0.16), g(0.62, FLOOR + 0.5, L / 2 - 1.25), "cloth", bevel=0.05), P.TERRACOTTA, jitter=0.02)
    k.paint(k.bbox("driver_back", (0.5, 0.14, 0.8), g(0.62, FLOOR + 0.92, L / 2 - 1.5), "cloth", bevel=0.05), P.TERRACOTTA, jitter=0.02)
    wheel = k.node("PART_steering_wheel", g(0.62, FLOOR + 1.0, L / 2 - 0.78), role="steering_wheel", axis="z")
    import bpy  # noqa: F401
    ring_pts = [g(0.62 + math.cos(a) * 0.22, FLOOR + 1.0 + math.sin(a) * 0.2, L / 2 - 0.78 - math.sin(a) * 0.06) for a in [i / 12 * math.tau for i in range(13)]]
    k.paint(k.tube("steering_ring", ring_pts, 0.018, "rubber", seg=5, cap=False, parent=wheel), P.INK, jitter=0)

    # ---- Wheels -----------------------------------------------------------------------
    for sx, tag in ((1, "l"), (-1, "r")):
        pivot = k.node(f"PART_steer_f{tag}", g(sx * TRACK, WR, AX_F), role="steer", axis="y", limit_deg=38)
        wf = k.node(f"PART_wheel_f{tag}", g(sx * TRACK, WR, AX_F), parent=pivot, role="wheel", axis="x", radius=WR)
        P.road_wheel(k, (sx * TRACK, WR, AX_F), WR, WW, wf, side=sx)
        wr = k.node(f"PART_wheel_r{tag}", g(sx * (TRACK - 0.12), WR, AX_R), role="wheel", axis="x", radius=WR, twin=True)
        P.road_wheel(k, (sx * (TRACK - 0.12), WR, AX_R), WR, WW * 0.8, wr, side=sx, twin=True)
    k.paint(k.tube("axle_f", [g(-TRACK, WR, AX_F), g(TRACK, WR, AX_F)], 0.07, "metal", seg=6), P.STEEL_DARK, jitter=0)
    k.paint(k.tube("axle_r", [g(-TRACK, WR, AX_R), g(TRACK, WR, AX_R)], 0.09, "metal", seg=6), P.STEEL_DARK, jitter=0)
    k.paint(k.bbox("chassis", (W - 0.5, L - 1.4, 0.3), g(0, 0.52, 0), "metal", bevel=0.05), P.INK, jitter=0.02)

    k.anchor("driver_view", g(0.62, FLOOR + 1.45, L / 2 - 1.3))
    k.anchor("passenger_view", g(-0.94, FLOOR + 1.2, 0.5))
    for a, b in (((-W / 2, -L / 2), (-W / 2, L / 2)), ((W / 2, -L / 2), (W / 2, L / 2)), ((-W / 2, L / 2), (W / 2, L / 2)), ((-W / 2, -L / 2), (W / 2, -L / 2))):
        k.wall((a[0], -a[1]), (b[0], -b[1]), 0.1)
    k.finish(ao_strength=0.6, ao_samples=40, ground=False)
