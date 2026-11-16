"""Passenger aircraft — the Asia chapter's vehicle.

Original design, no airline markings. A narrow-body twin sized for the web:
lofted fuselage, swept wings with winglets, separate control surfaces, fans
that spin, and landing gear on retract pivots, so flight, approach and landing
shots are all possible from one asset.
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from ptw import parts as P  # noqa: E402
from ptw.parts import g  # noqa: E402

R = 1.95  # fuselage radius
CY = 3.55  # fuselage centreline height with the gear down
LEN = 36.0
SPAN = 34.0

SPEC = {
    "id": "airliner",
    "pack": "vehicles",
    "asset_class": "hero",
    "author": "Claude (vehicle factory)",
    "seed": 12,
    "tri_budget": 16000,
    "ao_distance": 2.0,
    "preview_dir": (0.8, -1.0, 0.36),
    "meta": {"chapter": "asia", "vehicle": "airplane", "length": LEN, "wingspan": SPAN, "height": 11.6, "origin": "ground under the wing, gear down", "centreline_y": CY, "cruise_pose": "retract PART_gear_* and lift the root by 0", "port": "+x (red light)", "starboard": "-x (green light)"},
}

# (z, radius scale, centreline offset): nose at +z, tail at -z.
FUSE = [(18.0, 0.07, -0.42), (17.6, 0.3, -0.36), (16.9, 0.56, -0.24), (15.8, 0.8, -0.1), (14.2, 0.95, -0.02), (12.5, 1.0, 0), (6, 1.0, 0), (0, 1.0, 0), (-6, 1.0, 0), (-9.5, 0.93, 0.12), (-12.5, 0.74, 0.42), (-15.2, 0.47, 0.82), (-17.2, 0.24, 1.12), (-18.0, 0.1, 1.22)]


def airfoil(chord, thick=0.12, camber=0.02):
    xs = [0.0, 0.025, 0.09, 0.22, 0.42, 0.68, 1.0]
    yt = lambda x: 5 * thick * (0.2969 * math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x**3 - 0.1036 * x**4)
    up = [(x * chord, (yt(x) + camber * math.sin(math.pi * x)) * chord) for x in xs]
    lo = [(x * chord, (-yt(x) * 0.75 + camber * math.sin(math.pi * x)) * chord) for x in reversed(xs[1:-1])]
    return up + lo  # (distance back from the leading edge, height)


def wing_ring(x, y, z_le, chord, thick=0.12):
    return [g(x, y + h, z_le - d) for d, h in airfoil(chord, thick)]


def build(k):
    # ---- Fuselage -------------------------------------------------------------
    n = 20
    rings = [P.ring(P.circle_section(R * s, n, 0, CY + dy), z) for z, s, dy in FUSE]
    fus = k.loft("fuselage", rings, "paint", smooth=60)

    def livery(c, n_, base):
        y, z = c.z, -c.y
        rel = (y - CY) / R
        if z > 15.0 and 0.08 < rel < 0.5 and -n_.y > 0.25 and abs(c.x) < 1.5:
            return k.blend(P.GLASS_DARK, "#51625f", 0.4)  # flight deck
        if z > 16.6 and rel < 0.2:
            return k.blend(P.STEEL_DARK, P.INK, 0.4)  # radome
        if rel < -0.55:
            return k.blend(P.CREAM_SHADE, P.STEEL, 0.5)  # belly
        if -0.3 < rel < -0.16:
            return k.blend(P.TERRACOTTA, P.TERRACOTTA, 1)  # cheat line
        if -0.55 <= rel <= -0.3:
            return k.blend(P.GREEN, P.GREEN, 1)
        return k.blend(P.CREAM, "#f7f1e2", 0.5)

    k.paint(fus, P.CREAM, jitter=0.01, fn=livery)

    # Cabin windows and doors.
    for i in range(26):
        z = 12.9 - i * 0.88
        if 2.4 > z > -2.4 and i % 9 == 4:
            continue
        for s in (-1, 1):
            P.panel(k, "window", 0.3, 0.42, (s * (R - 0.012), CY + 0.42, z), "window", P.GLASS_DARK, yaw=0 if s > 0 else math.pi, depth=0.04, bevel=0.0)
    for tag, z in (("front", 13.9), ("rear", -9.2)):
        for s, side in ((1, "l"), (-1, "r")):
            rr = R * (1.0 if z > 0 else 0.94)
            node = k.node(f"PART_door_{tag}_{side}", g(s * rr, CY + 0.2, z + 0.45), role="door", axis="y", limit_deg=105, swings="out")
            P.panel(k, "door", 0.9, 1.85, (s * (rr - 0.03), CY + 0.2, z), "paint", P.CREAM_SHADE, yaw=0 if s > 0 else math.pi, depth=0.07, parent=node, bevel=0.06)
            P.panel(k, "door_window", 0.22, 0.3, (s * (rr + 0.012), CY + 0.62, z), "window", P.GLASS_DARK, yaw=0 if s > 0 else math.pi, depth=0.03, parent=node, bevel=0.0)
    k.anchor("door_front", g(R + 1.0, CY - 1.0, 13.9), kind="boarding")

    # ---- Wings ------------------------------------------------------------------
    root = dict(x=1.55, y=CY - 1.15, z=3.6, c=6.4)
    mid = dict(x=7.0, y=CY - 0.55, z=0.3, c=3.9)
    tip = dict(x=SPAN / 2 - 0.5, y=CY + 0.45, z=-5.6, c=1.7)
    for s, side in ((1, "l"), (-1, "r")):
        rings = [wing_ring(s * q["x"], q["y"], q["z"], q["c"], 0.13 if q is root else 0.1) for q in (dict(root, x=0.4), root, mid, tip)]
        rings.append(wing_ring(s * (tip["x"] + 0.45), tip["y"] + 0.75, tip["z"] - 0.5, 1.15, 0.09))
        rings.append(wing_ring(s * (tip["x"] + 0.62), tip["y"] + 1.95, tip["z"] - 1.25, 0.55, 0.09))
        w = k.loft("wing", rings if s > 0 else [r[::-1] for r in rings], "paint", smooth=55)
        k.paint(w, P.CREAM, jitter=0.012, fn=lambda c, n_, base: k.blend(P.GREEN, P.GREEN, 1) if c.z > tip["y"] + 0.95 else (k.blend(P.CREAM_SHADE, P.STEEL, 0.5) if n_.z < -0.3 else k.blend(P.CREAM, P.CREAM, 1)))

        # Control surfaces: thin wedges on the trailing edge, hinged along the span.
        def surface(name, a, b, f0, f1, depth, role):
            pa = lambda q, f: (s * (q["x"] + (b["x"] - a["x"]) * 0), 0)
            x0, x1 = a["x"] + (b["x"] - a["x"]) * f0, a["x"] + (b["x"] - a["x"]) * f1
            lerp = lambda k_, f: a[k_] + (b[k_] - a[k_]) * f
            hinge0 = (s * x0, lerp("y", f0) + 0.02, lerp("z", f0) - lerp("c", f0) * (1 - depth))
            hinge1 = (s * x1, lerp("y", f1) + 0.02, lerp("z", f1) - lerp("c", f1) * (1 - depth))
            hv = [hinge1[i] - hinge0[i] for i in range(3)]
            ln = math.sqrt(sum(v * v for v in hv))
            node = k.node(f"PART_{name}_{side}", g(*hinge0), role=role, axis="hinge", hinge=[round(v / ln, 4) for v in hv], limit_deg=25 if role != "flap" else 35)
            rr = []
            for h, f in ((hinge0, f0), (hinge1, f1)):
                c = lerp("c", f) * depth
                rr.append([g(h[0], h[1] + 0.07, h[2]), g(h[0], h[1] + 0.01, h[2] - c - 0.05), g(h[0], h[1] - 0.06, h[2])])
            o = k.loft(name, rr if s > 0 else rr[::-1], "paint", parent=node, smooth=0)
            k.paint(o, P.CREAM_SHADE, jitter=0.01)
            del pa

        surface("flap", root, mid, 0.12, 0.95, 0.24, "flap")
        surface("aileron", mid, tip, 0.45, 0.95, 0.26, "aileron")

        # Engine: nacelle, pylon, a fan that spins.
        ex, ey, ez = s * 5.5, CY - 2.05, 3.5
        nac = [(ez + 0.5, 0.82), (ez + 0.3, 0.98), (ez - 0.6, 1.08), (ez - 2.0, 1.02), (ez - 3.2, 0.78), (ez - 3.9, 0.55)]
        o = k.loft("nacelle", [P.ring(P.circle_section(r_, 16, ex, ey), z) for z, r_ in nac], "paint", cap=(False, True), smooth=60)
        o.data.materials[0].use_backface_culling = False
        k.paint(o, P.CREAM, jitter=0.01, fn=lambda c, n_, base: k.blend(P.STEEL, P.STEEL, 1) if -c.y > ez + 0.22 else (k.blend(P.GREEN, P.GREEN, 1) if -c.y > ez - 0.75 else k.blend(P.CREAM, P.CREAM, 1)))
        k.paint(k.tube("intake", [g(ex, ey, ez + 0.1), g(ex, ey, ez - 0.2)], 0.86, "metal", seg=16), P.INK, jitter=0)
        fan = k.node(f"PART_fan_{side}", g(ex, ey, ez + 0.12), role="fan", axis="z")
        for b in range(12):
            a = b / 12 * math.tau
            blade = k.box("blade", (0.16, 0.03, 0.78), g(ex + math.cos(a) * 0.44, ey + math.sin(a) * 0.44, ez + 0.14), "metal", parent=fan)
            import mathutils

            blade.data.transform(mathutils.Matrix.Translation(g(ex, ey, ez + 0.14)) @ mathutils.Matrix.Rotation(a - math.pi / 2, 4, "Y") @ mathutils.Matrix.Translation(-g(ex, ey, ez + 0.14)) @ mathutils.Matrix.Translation(g(ex, ey + 0.44, ez + 0.14) - g(ex + math.cos(a) * 0.44, ey + math.sin(a) * 0.44, ez + 0.14)))
            k.paint(blade, P.STEEL_DARK, jitter=0.03)
        k.paint(k.sphere("spinner", 0.2, g(ex, ey, ez + 0.2), "metal", subdiv=2, scale=(1, 1.5, 1), smooth=70, parent=fan), P.STEEL, jitter=0)
        k.paint(k.bbox("pylon", (0.22, 2.9, 0.75), g(ex, ey + 1.15, ez - 1.5), "paint", bevel=0.08), P.CREAM, jitter=0.01)

        # Tailplane with elevator.
        t0 = dict(x=0.5, y=CY + 1.0, z=-13.2, c=3.6)
        t1 = dict(x=6.4, y=CY + 1.45, z=-16.3, c=1.4)
        rr = [wing_ring(s * q["x"], q["y"], q["z"], q["c"], 0.1) for q in (t0, t1)]
        k.paint(k.loft("tailplane", rr if s > 0 else [r[::-1] for r in rr], "paint", smooth=55), P.CREAM, jitter=0.012)
        surface("elevator", t0, t1, 0.1, 0.96, 0.3, "elevator")

        # Main gear: strut and twin wheels on a retract pivot.
        gx, gz = s * 2.75, -1.6
        gear = k.node(f"PART_gear_main_{side}", g(gx, CY - 1.55, gz), role="landing_gear", axis="z", limit_deg=84, retracts="inboard")
        k.paint(k.tube("strut", [g(gx, CY - 1.55, gz), g(gx, 0.6, gz)], 0.11, "metal", seg=8, parent=gear), P.STEEL, jitter=0)
        k.paint(k.tube("brace", [g(gx - s * 0.7, CY - 1.6, gz), g(gx, 1.2, gz)], 0.05, "metal", seg=6, parent=gear), P.STEEL_DARK, jitter=0)
        k.paint(k.bbox("gear_door", (0.05, 1.3, 1.5), g(gx + s * 0.45, CY - 2.2, gz), "paint", bevel=0.02, parent=gear), P.CREAM_SHADE, jitter=0)
        wn = k.node(f"PART_wheel_main_{side}", g(gx, 0.56, gz), parent=gear, role="wheel", axis="x", radius=0.56, twin=True)
        P.road_wheel(k, (gx, 0.56, gz), 0.56, 0.3, wn, side=s, twin=True, seg=16)

        # Navigation lights: red to port (+x), green to starboard.
        k.paint(k.sphere("navlight", 0.09, g(s * (tip["x"] + 0.5), tip["y"] + 0.8, tip["z"] - 0.2), "glow", subdiv=1, smooth=60), "#e24a3c" if s > 0 else "#3fbf16", jitter=0)

    # ---- Fin and rudder ---------------------------------------------------------
    f0 = dict(y=CY + 1.4, z=-11.2, c=6.2)
    f1 = dict(y=CY + 7.9, z=-15.9, c=2.4)
    fin_ring = lambda q, th: [g(h, q["y"], q["z"] - d) for d, h in airfoil(q["c"], th, 0)]
    fin = k.loft("fin", [fin_ring(f0, 0.11), fin_ring(f1, 0.1)], "paint", smooth=55)
    k.paint(fin, P.GREEN, jitter=0.012, fn=lambda c, n_, base: k.blend(P.TERRACOTTA, P.TERRACOTTA, 1) if c.z > CY + 5.9 else (k.blend(P.GREEN, P.GREEN, 1) if c.z > CY + 2.6 else k.blend(P.CREAM, P.CREAM, 1)))
    h0 = (0, f0["y"] + 0.3, f0["z"] - f0["c"] * 0.7)
    h1 = (0, f1["y"] - 0.1, f1["z"] - f1["c"] * 0.7)
    hv = [h1[i] - h0[i] for i in range(3)]
    ln = math.sqrt(sum(v * v for v in hv))
    rud = k.node("PART_rudder", g(*h0), role="rudder", axis="hinge", hinge=[round(v / ln, 4) for v in hv], limit_deg=25)
    rr = [[g(0.1, h[1], h[2]), g(0.0, h[1], h[2] - c * 0.3 - 0.05), g(-0.1, h[1], h[2])] for h, c in ((h0, f0["c"]), (h1, f1["c"]))]
    k.paint(k.loft("rudder", rr, "paint", parent=rud, smooth=0), P.GREEN_LIGHT, jitter=0.01)
    k.paint(k.sphere("beacon", 0.1, g(0, CY + R + 0.05, 2.0), "glow", subdiv=1, smooth=60), "#e24a3c", jitter=0)
    k.paint(k.sphere("tail_light", 0.08, g(0, CY + 1.22, -18.02), "glow", subdiv=1, smooth=60), "#fff3c4", jitter=0)

    # ---- Nose gear -----------------------------------------------------------------
    nz = 13.6
    ng = k.node("PART_gear_nose", g(0, CY - 1.75, nz), role="landing_gear", axis="x", limit_deg=95, retracts="forward")
    k.paint(k.tube("strut", [g(0, CY - 1.75, nz), g(0, 0.45, nz)], 0.085, "metal", seg=8, parent=ng), P.STEEL, jitter=0)
    P.lamp(k, (0, 1.55, nz + 0.1), 0.09, parent=ng, name="landing_light", anchor="landing_light")
    wn = k.node("PART_wheel_nose", g(0, 0.42, nz), parent=ng, role="wheel", axis="x", radius=0.42, twin=True)
    P.road_wheel(k, (0, 0.42, nz), 0.42, 0.2, wn, side=1, twin=True, seg=14)

    k.anchor("cockpit_view", g(0, CY + 0.55, 15.6))
    k.anchor("window_view", g(-R + 0.4, CY + 0.42, 6.0))
    k.anchor("chase", g(0, CY + 6, -34))
    k.finish(ao_strength=0.5, ao_samples=40, ground=False)
