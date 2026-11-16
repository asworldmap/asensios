"""Shared vehicle parts and the common palette.

Every vehicle is assembled from these, which is what keeps five machines
looking like they belong to one world: the same cream and deep green, the same
terracotta accent, the same wheel and window language, the same soft edges.

All helpers take and return GAME-space coordinates (x = the vehicle's left,
y = up, z = forward) and convert through g(); Blender space is (x, -z, y).
"""

import math

import bmesh
from mathutils import Vector

# ---- Palette shared by all vehicles ------------------------------------
CREAM = "#efe6d2"
CREAM_SHADE = "#d9cdb2"
GREEN = "#27512f"
GREEN_LIGHT = "#3f7a48"
SIGNAL = "#3fbf16"
TERRACOTTA = "#b5573a"
MUSTARD = "#d9a441"
INK = "#2f2b27"
STEEL = "#b9b3a6"
STEEL_DARK = "#6f6a62"
RUBBER = "#26211c"
GLASS_DARK = "#33403f"
DECK_WOOD = "#b98f5e"
LAMP = "#fff3c4"
TAIL = "#c9463d"


def g(x, y, z):
    """Game space -> Blender space."""
    return Vector((x, -z, y))


def body_section(w, y0, y1, r_bot=0.25, r_top=0.6, stations=(), seg=5, tumble=0.0):
    """Cross-section of a carriage / bus / cabin: a rounded rectangle.

    Returns [(x, y)] counter-clockwise from bottom centre-right. `stations`
    are extra heights on the straight sides, so paint bands and window lines
    land on real edges. `tumble` leans the upper sides inwards (metres).
    """
    hw = w / 2
    pts = []
    for i in range(seg + 1):  # bottom right corner
        a = -math.pi / 2 + (math.pi / 2) * i / seg
        pts.append((hw - r_bot + math.cos(a) * r_bot, y0 + r_bot + math.sin(a) * r_bot))
    side = sorted(s for s in stations if y0 + r_bot < s < y1 - r_top)
    top_y = y1 - r_top
    lean = lambda y: tumble * max(0.0, (y - (y0 + r_bot)) / max(1e-6, top_y - (y0 + r_bot)))
    for s in side:
        pts.append((hw - lean(s), s))
    for i in range(seg + 1):  # top right corner
        a = (math.pi / 2) * i / seg
        pts.append((hw - tumble - r_top + math.cos(a) * r_top, top_y + math.sin(a) * r_top))
    left = [(-x, y) for x, y in reversed(pts)]
    return pts + left


def scale_section(sec, sx=1.0, sy=1.0, y_pivot=0.0, dy=0.0):
    return [(x * sx, y_pivot + (y - y_pivot) * sy + dy) for x, y in sec]


def ring(sec, z):
    return [g(x, y, z) for x, y in sec]


def circle_section(r, n=20, cx=0.0, cy=0.0, sx=1.0, sy=1.0):
    return [(cx + math.cos(i / n * math.tau - math.pi / 2) * r * sx, cy + math.sin(i / n * math.tau - math.pi / 2) * r * sy) for i in range(n)]


def road_wheel(k, centre, r, width, node, hub=STEEL, seg=20, side=1, twin=False):
    """Tyre, rim and hub for a road vehicle. Axle = game x. `side` = outer face sign."""
    cx, cy, cz = centre
    offs = [0.0] if not twin else [-width * 0.55, width * 0.55]
    for o in offs:
        prof = [(-width / 2, r * 0.62), (-width / 2, r * 0.9), (-width * 0.36, r), (width * 0.36, r), (width / 2, r * 0.9), (width / 2, r * 0.62)]
        bm = bmesh.new()
        rows = []
        for i in range(seg):
            a = i / seg * math.tau
            rows.append([bm.verts.new(g(cx + o + px, cy + math.sin(a) * pr, cz + math.cos(a) * pr)) for px, pr in prof])
        for i in range(seg):
            for j in range(len(prof) - 1):
                bm.faces.new((rows[i][j], rows[(i + 1) % seg][j], rows[(i + 1) % seg][j + 1], rows[i][j + 1]))
        tyre = k.add(bm, "tyre", "rubber", smooth=50, parent=node)
        k.paint(tyre, RUBBER, jitter=0.0)
        # Dished rim with a hub cap on the outer face.
        for face in (-1, 1):
            x = cx + o + face * width * 0.42
            bm = bmesh.new()
            c = bm.verts.new(g(x + face * (0.02 if face == side else -0.05), cy, cz))
            rim = [bm.verts.new(g(x, cy + math.sin(i / seg * math.tau) * r * 0.64, cz + math.cos(i / seg * math.tau) * r * 0.64)) for i in range(seg)]
            for i in range(seg):
                f = (c, rim[i], rim[(i + 1) % seg])
                bm.faces.new(f if face < 0 else f[::-1])
            disc = k.add(bm, "rim", "metal", smooth=30, parent=node)
            k.paint(disc, hub, jitter=0.0, fn=lambda cc, nn, base: k.blend(STEEL_DARK, hub, 0.35 + 0.65 * min(1.0, (Vector((0, cc.y + cz, cc.z - cy)).length) / (r * 0.6))))
    k.paint(k.tube("hubcap", [g(cx + side * (width * 0.42 + 0.01), cy, cz), g(cx + side * (width * 0.42 + 0.05), cy, cz)], r * 0.2, "metal", seg=10, r_end=r * 0.13, parent=node), STEEL, jitter=0)


def rail_wheelset(k, centre, node, r=0.46, gauge=1.435):
    """Two flanged wheels on an axle. Axle = game x."""
    cx, cy, cz = centre
    k.paint(k.tube("axle", [g(-gauge / 2 - 0.12, cy, cz), g(gauge / 2 + 0.12, cy, cz)], 0.075, "metal", seg=8, parent=node), STEEL_DARK, jitter=0)
    for s in (-1, 1):
        x = s * gauge / 2
        k.paint(k.tube("wheel", [g(x - s * 0.02, cy, cz), g(x + s * 0.11, cy, cz)], r, "metal", seg=18, parent=node), STEEL_DARK, jitter=0, fn=lambda cc, nn, base: k.blend("#4a4640", STEEL, 1.0 if abs(nn.x) < 0.5 else 0.25))
        k.paint(k.tube("flange", [g(x - s * 0.05, cy, cz), g(x - s * 0.02, cy, cz)], r + 0.035, "metal", seg=18, parent=node), "#4a4640", jitter=0)


def panel(k, name, w, h, at, surface, color, yaw=0.0, depth=0.03, parent=None, bevel=0.012, jitter=0.0, fn=None):
    """A thin plate lying on a body side: windows, doors, hatches, lamps.

    `at` is its centre; yaw = 0 faces +x (the left side), pi faces -x, ±pi/2 face ±z.
    """
    from mathutils import Matrix

    # In Blender space: thickness along X, width along -Y (game z), height Z.
    rot = Matrix.Rotation(-yaw, 4, "Z")
    o = k.bbox(name, (depth, w, h), g(*at), surface, bevel=bevel, seg=1, rot=rot, parent=parent)
    k.paint(o, color, jitter=jitter, fn=fn)
    return o


def window_band(k, z0, z1, x, y, h, pitch, surface="window", color=GLASS_DARK, gap=0.16, parent=None, both=True):
    """A row of windows along a side (and its mirror)."""
    n = max(1, int((z1 - z0) / pitch))
    w = (z1 - z0) / n
    for i in range(n):
        zc = z0 + (i + 0.5) * w
        for s in ((1, -1) if both else (1,)):
            panel(k, "window", w - gap, h, (s * x, y, zc), surface, color, yaw=0 if s > 0 else math.pi, parent=parent, bevel=0.04)


def lamp(k, at, r, color=LAMP, facing=1, parent=None, name="lamp", anchor=None):
    """A round lamp facing ±z, with its bezel."""
    x, y, z = at
    k.paint(k.tube(name + "_bezel", [g(x, y, z - facing * 0.03), g(x, y, z + facing * 0.012)], r * 1.25, "metal", seg=12, parent=parent), STEEL, jitter=0)
    k.paint(k.tube(name, [g(x, y, z + facing * 0.012), g(x, y, z + facing * 0.03)], r, "glow", seg=12, r_end=r * 0.8, parent=parent), color, jitter=0)
    if anchor:
        k.anchor(anchor, g(x, y, z + facing * 0.05), kind="headlight" if color == LAMP else "taillight")


def railing(k, pts, h=1.05, post=1.4, r=0.022, color=CREAM, parent=None, rails=2):
    """Handrail along a polyline (game coords at deck level): posts + rails."""
    P = [Vector(p) for p in pts]
    for lvl in range(1, rails + 1):
        y = h * lvl / rails
        k.paint(k.tube("rail", [g(p.x, p.y + y, p.z) for p in P], r if lvl == rails else r * 0.7, "metal", seg=5, parent=parent), color, jitter=0)
    for a, b in zip(P, P[1:]):
        L = (b - a).length
        n = max(1, int(L / post))
        for i in range(n + 1):
            q = a.lerp(b, i / n)
            k.paint(k.tube("post", [g(q.x, q.y, q.z), g(q.x, q.y + h, q.z)], r * 0.9, "metal", seg=4, cap=False, parent=parent), color, jitter=0)


def seat_rows(k, z0, z1, y, xs, pitch=0.85, color=GREEN_LIGHT, parent=None):
    """Simplified seats, enough to read through a window."""
    n = int((z1 - z0) / pitch)
    for i in range(n):
        z = z0 + (i + 0.5) * pitch
        for x in xs:
            k.paint(k.bbox("seat", (0.46, 0.46, 0.14), g(x, y + 0.42, z), "cloth", bevel=0.05, parent=parent), color, jitter=0.03)
            k.paint(k.bbox("seat_back", (0.46, 0.14, 0.72), g(x, y + 0.8, z - 0.22), "cloth", bevel=0.05, parent=parent), color, jitter=0.03)


def stairs(k, a, b, width, steps, color=STEEL, parent=None):
    """A flight of steps from a to b (game coords), with stringers."""
    A, B = Vector(a), Vector(b)
    d = B - A
    side = Vector((d.z, 0, -d.x)).normalized() * (width / 2) if abs(d.x) + abs(d.z) > 1e-6 else Vector((width / 2, 0, 0))
    for i in range(steps):
        q = A.lerp(B, (i + 0.5) / steps)
        along = Vector((d.x, 0, d.z)).normalized()
        import mathutils

        yaw = math.atan2(along.x, along.z)
        rot = mathutils.Matrix.Rotation(-yaw, 4, "Z")
        o = k.box("step", (width, d.length / steps * 0.9, 0.05), g(q.x, q.y, q.z), "metal", rot=rot, parent=parent)
        k.paint(o, color, jitter=0.02)
    for s in (-1, 1):
        k.paint(k.tube("stringer", [g(*(A + side * s)), g(*(B + side * s))], 0.035, "metal", seg=4, parent=parent), color, jitter=0)
