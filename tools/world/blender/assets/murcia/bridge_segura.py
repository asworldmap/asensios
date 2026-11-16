"""Stone bridge over the Segura — three segmental arches.

Original design (not a survey of any real bridge). Runs along Blender Y; the
origin is the centre of the road surface, so the engine places it at deck
height and the piers reach down into the river.
"""

import math

import bmesh
from mathutils import Matrix, Vector

SPEC = {
    "id": "bridge_segura",
    "pack": "murcia",
    "asset_class": "batched",
    "author": "Claude (pipeline reference asset)",
    "seed": 11,
    "tri_budget": 7000,
    "origin": "deck-centre",
    "ground_z": -4.6,
    "ao_distance": 3.0,
    "preview_dir": (1.0, -0.62, 0.3),
    "params": {
        "length": 27.0,
        "width": 5.8,
        "arches": 3,
        "span": 6.6,
        "pier": 1.5,
        "rise": 2.1,
        "crown": 0.85,  # deck surface to the top of the arch opening
        "parapet": 0.72,
        "depth": 4.6,  # deck surface down to the river bed
    },
}

STONE = "#cdb48a"
STONE_DARK = "#8f8c68"  # damp, mossy stone near the water
COPING = "#dfcfa9"


def build(k):
    p = k.params
    L, W = p["length"], p["width"]
    hw = W / 2
    n, span, pier, rise, crown = p["arches"], p["span"], p["pier"], p["rise"], p["crown"]
    depth, par = p["depth"], p["parapet"]
    spring = -(crown + rise)
    half = span / 2
    R = (half * half + rise * rise) / (2 * rise)  # segmental arch radius
    total = n * span + (n - 1) * pier
    y0 = -total / 2
    centres = [y0 + half + i * (span + pier) for i in range(n)]

    def intrados(y):
        """Height of the underside at y, or None where the bridge is solid."""
        for c in centres:
            d = abs(y - c)
            if d <= half:
                return -crown - R + math.sqrt(max(0.0, R * R - d * d))
        return None

    # Slice boundaries: exact at every arch edge so the openings are clean.
    edges = {-L / 2, L / 2}
    for c in centres:
        m = 12
        for i in range(m + 1):
            edges.add(c - half + span * i / m)
    ys = sorted(edges)
    extra = []
    for a, b in zip(ys, ys[1:]):
        gap = b - a
        if gap > 0.9:
            cuts = int(gap // 0.7)
            extra += [a + gap * (i + 1) / (cuts + 1) for i in range(cuts)]
    ys = sorted(ys + extra)

    def bottom(y, towards):
        z = intrados(y + towards * 1e-4)
        if z is not None:
            return z
        inside = y0 - 0.01 <= y <= -y0 + 0.01
        return -depth if inside else -depth * 0.62  # piers go to the bed, abutments into the bank

    def stone_tone(c, nrm, base):
        t = (-c.z - 1.7) / (depth - 1.7)
        col = k.blend(STONE, STONE_DARK, t * 0.9 if t > 0 else 0)
        if nrm.z > 0.6:
            col = k.blend(STONE, COPING, 0.35)
        return col

    # ---- Masonry walls: coursed blocks, one quad per stone ----------------
    course = 0.46
    bm = bmesh.new()
    for a, b in zip(ys, ys[1:]):
        za, zb = bottom(a, +1), bottom(b, -1)
        top = 0.0
        rows = max(1, int(round((top - min(za, zb)) / course)))
        for side in (-1, 1):
            x = side * hw
            for r in range(rows):
                f0, f1 = r / rows, (r + 1) / rows
                v = [
                    bm.verts.new((x, a, za + (top - za) * f0)),
                    bm.verts.new((x, b, zb + (top - zb) * f0)),
                    bm.verts.new((x, b, zb + (top - zb) * f1)),
                    bm.verts.new((x, a, za + (top - za) * f1)),
                ]
                bm.faces.new(v if side < 0 else v[::-1])
        # Underside (arch soffit or the flat base of piers) and the deck.
        bm.faces.new([bm.verts.new(c) for c in ((-hw, a, za), (hw, a, za), (hw, b, zb), (-hw, b, zb))])
        bm.faces.new([bm.verts.new(c) for c in ((-hw, b, 0), (hw, b, 0), (hw, a, 0), (-hw, a, 0))])
    # Vertical faces where a pier or abutment drops below the arch springing.
    for y in ys:
        za, zb = bottom(y, -1), bottom(y, +1)
        if abs(za - zb) > 0.05:
            lo, hi = min(za, zb), max(za, zb)
            rows = max(1, int(round((hi - lo) / course)))
            for r in range(rows):
                z1, z2 = lo + (hi - lo) * r / rows, lo + (hi - lo) * (r + 1) / rows
                v = [bm.verts.new(c) for c in ((-hw, y, z1), (hw, y, z1), (hw, y, z2), (-hw, y, z2))]
                bm.faces.new(v if za < zb else v[::-1])
    for y, flip in ((-L / 2, False), (L / 2, True)):
        zb_ = bottom(y, 1 if not flip else -1)
        v = [bm.verts.new(c) for c in ((-hw, y, zb_), (hw, y, zb_), (hw, y, 0), (-hw, y, 0))]
        bm.faces.new(v[::-1] if flip else v)
    body = k.add(bm, "body", "stone")
    k.paint(body, STONE, jitter=0.085, fn=stone_tone)

    # ---- Voussoirs: the ring of cut stones around each arch ---------------
    ring, proud, count = 0.44, 0.09, 13
    start = math.asin(half / R)
    for c in centres:
        for side in (-1, 1):
            for i in range(count):
                a0 = -start + 2 * start * i / count
                a1 = -start + 2 * start * (i + 1) / count
                key = i == count // 2
                ro = R + ring + (0.14 if key else 0)
                out = hw + proud + (0.04 if key else 0)
                cz = -crown - R
                pts = []
                for x in (side * (hw - 0.05), side * out):
                    for ang, rad in ((a0, R - 0.02), (a1, R - 0.02), (a1, ro), (a0, ro)):
                        pts.append((x, c + math.sin(ang) * rad, cz + math.cos(ang) * rad))
                b2 = bmesh.new()
                vs = [b2.verts.new(q) for q in pts]
                for f in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
                    b2.faces.new([vs[j] for j in f])
                o = k.add(b2, "voussoir", "stone")
                k.paint(o, COPING if key else STONE, jitter=0.1, fn=lambda cc, nn, base: k.blend("#d6bf95", STONE_DARK, max(0.0, (-cc.z - 2.2) / 3.0)))

    # ---- String course, parapets and coping --------------------------------
    for side in (-1, 1):
        k.paint(k.box("string", (0.16, L, 0.16), (side * (hw + 0.05), 0, -0.1), "stone"), COPING, jitter=0.03)
        px = side * (hw - 0.19)
        seg = 1.35
        m = int(L // seg)
        for i in range(m):
            y = -L / 2 + (i + 0.5) * (L / m)
            k.paint(k.box("parapet", (0.38, L / m - 0.03, par), (px, y, par / 2), "stone"), STONE, jitter=0.07)
            k.paint(k.box("coping", (0.52, L / m - 0.02, 0.12), (px, y, par + 0.06), "stone", taper=0.86), COPING, jitter=0.05)
        k.wall((px, -L / 2), (px, L / 2), 0.26)

    # ---- Piers: pilasters above, cutwaters pointing into the current -------
    piers = [y0 + span + i * (span + pier) + pier / 2 for i in range(n - 1)]
    for py in piers:
        for side in (-1, 1):
            k.paint(k.box("pilaster", (0.34, pier * 0.8, crown + rise * 0.55 + par), (side * (hw + 0.12), py, (par - crown - rise * 0.55) / 2), "stone"), STONE, jitter=0.05)
            k.paint(k.box("cap", (0.5, pier * 0.95, 0.14), (side * (hw + 0.14), py, par + 0.07), "stone", taper=0.8), COPING, jitter=0.03)
            # Cutwater: a triangular prism with a sloped cap.
            b2 = bmesh.new()
            base_z, top_z = -depth, spring + 0.25
            nose = side * (hw + 1.5)
            x0 = side * (hw - 0.02)
            ring_pts = lambda z, s: [(x0, py - pier / 2 * s, z), (x0 + (nose - x0) * s, py, z), (x0, py + pier / 2 * s, z)]
            lo = [b2.verts.new(q) for q in ring_pts(base_z, 1.0)]
            hi = [b2.verts.new(q) for q in ring_pts(top_z, 1.0)]
            tip = b2.verts.new((x0, py, top_z + 0.95))
            for i in range(2):
                b2.faces.new((lo[i], lo[i + 1], hi[i + 1], hi[i]))
                b2.faces.new((hi[i], hi[i + 1], tip))
            o = k.add(b2, "cutwater", "stone")
            k.paint(o, STONE, jitter=0.07, fn=stone_tone)

    # ---- Lamps on the parapet ends and over the piers ----------------------
    lamp_ys = [-L / 2 + 0.7, L / 2 - 0.7] + piers
    for i, ly in enumerate(sorted(lamp_ys)):
        side = -1 if i % 2 else 1
        x = side * (hw - 0.19)
        z = par + 0.12
        k.paint(k.box("lamp_base", (0.3, 0.3, 0.26), (x, ly, z + 0.13), "stone", taper=0.75), COPING, jitter=0.02)
        k.paint(k.cylinder("lamp_post", 0.045, 2.0, (x, ly, z + 0.26), "metal", seg=8, r_top=0.03, smooth=40), "#3a362f", jitter=0)
        k.paint(k.cylinder("lamp_collar", 0.09, 0.08, (x, ly, z + 2.2), "metal", seg=8), "#3a362f", jitter=0)
        k.paint(k.cylinder("lamp_glass", 0.11, 0.3, (x, ly, z + 2.28), "glow", seg=6, r_top=0.16), "#fff3c4", jitter=0)
        k.paint(k.cylinder("lamp_hat", 0.24, 0.16, (x, ly, z + 2.58), "metal", seg=6, r_top=0.03), "#3a362f", jitter=0)
        k.anchor(f"light_{i:02d}", (x, ly, z + 2.4), kind="lamp")

    k.anchor("deck_start", (0, -L / 2, 0))
    k.anchor("deck_end", (0, L / 2, 0))
    k.finish(ao_strength=0.8, ao_samples=64, ground=True)
