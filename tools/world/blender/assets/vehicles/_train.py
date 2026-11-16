"""Shared builder for the regional train: a cab car and a reusable coach.

Original design. One body section, lofted; the cab car tapers it into a nose.
Cars couple at ANCHOR_coupler_front / ANCHOR_coupler_rear, so a train of any
length is the cab car, n coaches, and a second cab car turned round.
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from ptw import parts as P  # noqa: E402
from ptw.parts import g  # noqa: E402

L = 17.2  # body length
W = 2.86
Y0, Y1 = 0.82, 3.92
FLOOR = 1.08
WHEEL_R = 0.46
BOGIE_Z = 5.7
STATIONS = (1.24, 1.36, 2.02, 2.98, 3.3)


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def nose_sy(t):
    """Roof height along the nose: level, then a raked windscreen, then the snout."""
    return 1 - 0.5 * ease((t - 0.1) / 0.68)


def nose_sx(t):
    return 1 - 0.3 * ease(t) ** 1.3


def make(k, cab=True):
    sec = P.body_section(W, Y0, Y1, r_bot=0.16, r_top=0.62, stations=STATIONS, seg=4, tumble=0.07)
    nose_len = 3.7 if cab else 0.0
    rings = []
    n = 12
    z_back, z_front = -L / 2, L / 2 - nose_len
    rings.append(P.ring(P.scale_section(sec, 0.9, 0.93, Y0), z_back - 0.02))
    for i in range(n + 1):
        rings.append(P.ring(sec, z_back + 0.35 + (z_front - z_back - (0.35 if not cab else 0.0) - 0.35) * i / n))
    if cab:
        # The nose: the section narrows and its roof comes down in a long curve.
        steps = 9
        for i in range(1, steps + 1):
            t = i / steps
            rings.append(P.ring(P.scale_section(sec, nose_sx(t), nose_sy(t), Y0), z_front + nose_len * (1 - (1 - t) ** 1.25)))
    else:
        rings.append(P.ring(P.scale_section(sec, 0.9, 0.93, Y0), L / 2 + 0.02))
    body = k.loft("body", rings, "paint", smooth=48)

    nose0 = z_front

    def livery(c, n_, base):
        y = c.z
        z = -c.y
        t = 0.0
        if cab and z > nose0:
            t = 1 - (1 - min(1.0, (z - nose0) / nose_len)) ** (1 / 1.25)
        top = Y0 + (Y1 - Y0) * nose_sy(t)
        rel = (y - Y0) / max(0.1, top - Y0)  # 0 at the sill, 1 at the roof line
        if cab and t > 0.05:
            half = W / 2 * nose_sx(t)
            if 0.2 < t < 0.76 and rel > 0.55 and abs(c.x) < half * 0.86:
                return k.blend(P.GLASS_DARK, "#51625f", max(0.0, n_.z) * 0.6)  # windscreen
            if 0.05 < t < 0.24 and 0.5 < rel < 0.8 and abs(n_.x) > 0.7:
                return k.blend(P.GLASS_DARK, P.GLASS_DARK, 1)  # cab side window
            if rel < 0.26 and t > 0.5:
                return k.blend(P.TERRACOTTA, P.TERRACOTTA, 1)  # chin
        if n_.z > 0.72 and rel > 0.8:
            return k.blend(P.STEEL, P.CREAM_SHADE, 0.35)  # roof
        if rel < 0.135:
            return k.blend(P.GREEN, P.GREEN, 1)
        if rel < 0.175:
            return k.blend(P.TERRACOTTA, P.TERRACOTTA, 1)
        if 0.39 < rel < 0.7 and t < 0.02:
            return k.blend(P.GREEN, P.GREEN, 1)  # the band the windows sit in
        return k.blend(P.CREAM, P.CREAM, 1)

    k.paint(body, P.CREAM, jitter=0.012, fn=livery)

    # ---- Windows and doors ------------------------------------------------
    xw = W / 2 - 0.045
    yw, hw = 2.5, 0.86
    door_z = [-5.1, 5.1 if not cab else 3.6]
    spans = [(-L / 2 + 0.9, door_z[0] - 0.95), (door_z[0] + 0.95, door_z[1] - 0.95)]
    if not cab:
        spans.append((door_z[1] + 0.95, L / 2 - 0.9))
    for a, b in spans:
        if b - a > 1.2:
            P.window_band(k, a, b, xw, yw, hw, 1.55)
    for di, dz in enumerate(door_z):
        for s, tag in ((1, "l"), (-1, "r")):
            node = k.node(f"PART_door_{tag}{di + 1}", g(s * (W / 2), 2.0, dz), role="door", axis="z", travel=1.25, opens=-1 if di == 0 else 1)
            yaw = 0 if s > 0 else math.pi
            P.panel(k, "door", 1.32, 2.12, (s * (W / 2 - 0.02), 2.06, dz), "paint", P.GREEN, yaw=yaw, depth=0.06, parent=node, bevel=0.03)
            P.panel(k, "door_glass", 0.86, 0.95, (s * (W / 2 + 0.005), 2.5, dz), "window", P.GLASS_DARK, yaw=yaw, depth=0.03, parent=node, bevel=0.05)
            P.panel(k, "door_stripe", 1.32, 0.09, (s * (W / 2 + 0.005), 1.3, dz), "paint", P.MUSTARD, yaw=yaw, depth=0.03, parent=node, bevel=0.0)
            k.paint(k.bbox("step", (0.22, 1.3, 0.05), g(s * (W / 2 + 0.06), FLOOR - 0.12, dz), "metal", bevel=0.015), P.STEEL_DARK, jitter=0)

    # ---- Running gear -----------------------------------------------------
    for tag, bz in (("front", BOGIE_Z if not cab else BOGIE_Z - 1.2), ("rear", -BOGIE_Z)):
        bogie = k.node(f"PART_bogie_{tag}", g(0, 0.55, bz), role="bogie", axis="y", limit_deg=12)
        k.paint(k.bbox("bogie_frame", (2.2, 3.1, 0.3), g(0, 0.58, bz), "metal", bevel=0.08, parent=bogie), P.INK, jitter=0.02)
        for sx in (-1, 1):
            k.paint(k.bbox("bogie_side", (0.16, 3.3, 0.42), g(sx * 1.05, 0.52, bz), "metal", bevel=0.06, parent=bogie), P.STEEL_DARK, jitter=0.02)
            k.paint(k.tube("damper", [g(sx * 1.16, 0.5, bz - 0.3), g(sx * 1.16, 0.95, bz + 0.3)], 0.05, "metal", seg=6, parent=bogie), P.MUSTARD, jitter=0)
        for wi, wz in enumerate((-1.25, 1.25)):
            ws = k.node(f"PART_wheelset_{tag}{wi + 1}", g(0, WHEEL_R, bz + wz), parent=bogie, role="wheel", axis="x", radius=WHEEL_R)
            P.rail_wheelset(k, (0, WHEEL_R, bz + wz), ws, r=WHEEL_R)
    for z, ln in ((-1.6, 3.4), (1.9, 2.2)):
        k.paint(k.bbox("underframe", (2.2, ln, 0.55), g(0, 0.62, z), "metal", bevel=0.07), P.INK, jitter=0.03)

    # ---- Roof ---------------------------------------------------------------
    for z in (-4.2, 2.2) if not cab else (-4.6,):
        k.paint(k.bbox("hvac", (1.7, 2.6, 0.26), g(0, Y1 + 0.08, z), "metal", bevel=0.09), P.STEEL, jitter=0.02)
        k.paint(k.bbox("hvac_grille", (1.2, 1.6, 0.05), g(0, Y1 + 0.22, z), "metal", bevel=0.01), P.STEEL_DARK, jitter=0)
    if cab:
        panto = k.node("PART_pantograph", g(0, Y1 + 0.12, -0.6), role="pantograph", axis="x", limit_deg=38)
        k.paint(k.bbox("panto_base", (1.3, 1.6, 0.12), g(0, Y1 + 0.1, -0.6), "metal", bevel=0.03, parent=panto), P.STEEL_DARK, jitter=0)
        elbow = (0, Y1 + 0.72, -1.5)
        head = (0, Y1 + 1.32, -0.55)
        for sx in (-0.32, 0.32):
            k.paint(k.tube("panto_arm", [g(sx, Y1 + 0.16, -0.6), g(sx * 0.6, *elbow[1:]), g(sx * 0.4, *head[1:])], 0.03, "metal", seg=5, parent=panto), P.STEEL_DARK, jitter=0)
        k.paint(k.tube("panto_head", [g(-0.85, head[1], head[2]), g(0.85, head[1], head[2])], 0.035, "metal", seg=5, parent=panto), P.INK, jitter=0)
        for sx in (-0.5, 0.5):
            k.paint(k.tube("insulator", [g(sx, Y1 + 0.02, 0.9), g(sx, Y1 + 0.34, 0.9)], 0.07, "metal", seg=8, r_end=0.04), P.TERRACOTTA, jitter=0)

    # ---- Ends: lamps, couplers, gangways ------------------------------------
    front_z = L / 2
    if cab:
        for sx in (-0.52, 0.52):
            P.lamp(k, (sx, 1.52, front_z - 0.02), 0.13, anchor=f"headlight_{'l' if sx > 0 else 'r'}")
            P.lamp(k, (sx * 1.42, 1.5, front_z - 0.26), 0.07, color=P.TAIL, name="marker")
        P.lamp(k, (0, 2.2, front_z - 0.02), 0.09, name="toplamp")
    else:
        k.paint(k.bbox("gangway", (1.7, 0.36, 2.3), g(0, 2.2, front_z + 0.12), "rubber", bevel=0.1), P.INK, jitter=0.02)
    k.paint(k.bbox("gangway", (1.7, 0.36, 2.3), g(0, 2.2, -L / 2 - 0.12), "rubber", bevel=0.1), P.INK, jitter=0.02)
    for sx in (-0.75, 0.75):
        P.lamp(k, (sx, 1.5, -L / 2 - 0.02), 0.08, color=P.TAIL, facing=-1, name="tail")
    for z, f in ((front_z + (0.0 if cab else 0.1), 1), (-L / 2 - 0.1, -1)):
        k.paint(k.tube("coupler", [g(0, 0.95, z - f * 0.2), g(0, 0.95, z + f * 0.34)], 0.11, "metal", seg=8, r_end=0.15), P.STEEL_DARK, jitter=0)
    k.anchor("coupler_front", g(0, 0.95, front_z + 0.36))
    k.anchor("coupler_rear", g(0, 0.95, -L / 2 - 0.36))
    k.anchor("cab_view" if cab else "seat_view", g(0, 2.55, front_z - 2.6 if cab else 0))
    k.finish(ao_strength=0.6, ao_samples=40, ground=False)
