"""Shared builder for Mediterranean houses (town houses and the huerta farmhouse).

Front faces -Y (contract: asset forward). Origin at ground centre.
"""

import math

import bmesh
from mathutils import Vector
from mathutils import noise as mnoise

ROOF = ["#b5573a", "#a94f35", "#c0623f", "#b86a48", "#9c4a34", "#c9774f"]
STONE = "#cdb48a"
STONE_LIGHT = "#dccaa4"
WOOD = "#6b4a2e"
IRON = "#33302b"


def make(k, w=5.2, d=4.4, floors=2, plaster="#f2e7d1", shutters="#3f6b55", door="#6b4a2e", balcony=False, porch=False, chimney=True, pots=True):
    r = k.rng
    fh = 2.7
    h = floors * fh
    hw, hd = w / 2, d / 2
    rise = d * 0.27
    ov = 0.38
    off = Vector((r.random() * 40, r.random() * 40, 0))

    def plaster_tone(c, n, base):
        # Lime wash that has seen weather: damp near the ground, bleached up high,
        # with soft irregular stains. All painted, no texture.
        col = base
        if c.z < 0.9:
            col = k.blend(plaster, "#bfa884", (0.9 - c.z) / 0.9 * 0.6)
        stain = mnoise.noise(Vector((c.x * 0.7, c.y * 0.7, c.z * 0.35)) + off)
        if stain > 0.15:
            col = tuple(a * (1 - (stain - 0.15) * 0.42) for a in col)
        if c.z > h - 0.5:
            col = tuple(min(1.0, a * 1.04) for a in col)
        return col

    # ---- Walls: one closed shell, gridded so the paint has something to hold
    bm = bmesh.new()
    corners = [(-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd)]
    cell = 0.85
    for i in range(4):
        a, b = Vector(corners[i]), Vector(corners[(i + 1) % 4])
        n = max(1, round((b - a).length / cell))
        rows = max(1, round(h / 0.7))
        gable = i in (1, 3)
        for j in range(n):
            p0, p1 = a.lerp(b, j / n), a.lerp(b, (j + 1) / n)
            for q in range(rows):
                z0, z1 = h * q / rows, h * (q + 1) / rows
                bm.faces.new([bm.verts.new(v) for v in ((p0.x, p0.y, z0), (p1.x, p1.y, z0), (p1.x, p1.y, z1), (p0.x, p0.y, z1))])
            if gable:
                ya, yb = p0.y, p1.y
                za, zb = h + rise * (1 - abs(ya) / hd), h + rise * (1 - abs(yb) / hd)
                vs = [(p0.x, ya, h), (p1.x, yb, h), (p1.x, yb, zb), (p0.x, ya, za)]
                vs = [v for idx, v in enumerate(vs) if not (idx >= 2 and abs(v[2] - h) < 1e-6)]
                if len(vs) >= 3:
                    bm.faces.new([bm.verts.new(v) for v in vs])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    walls = k.add(bm, "walls", "plaster")
    k.paint(walls, plaster, jitter=0.035, fn=plaster_tone)

    # Stone plinth and corner stones.
    k.paint(k.box("plinth", (w + 0.14, d + 0.14, 0.55), (0, 0, 0.275), "stone"), STONE, jitter=0.06)
    for cx, cy in corners:
        for q in range(int(h / 0.55)):
            if q % 2 == 0 and q > 0:
                sx, sy = (1 if cx > 0 else -1), (1 if cy > 0 else -1)
                k.paint(k.box("quoin", (0.36, 0.36, 0.4), (cx - sx * 0.15, cy - sy * 0.15, q * 0.55 + 0.2), "stone"), STONE_LIGHT, jitter=0.07)

    # ---- Roof: slab, barrel tiles running down the slope, ridge ---------
    eave_z = h - ov * rise / hd
    for side in (-1, 1):
        ridge = Vector((0, 0, h + rise + 0.04))
        eave = Vector((0, side * (hd + ov), eave_z))
        bm = bmesh.new()
        x0, x1 = -hw - ov, hw + ov
        top = [(x0, ridge.y, ridge.z), (x1, ridge.y, ridge.z), (x1, eave.y, eave.z), (x0, eave.y, eave.z)]
        bot = [(x, y, z - 0.12) for x, y, z in top]
        vt = [bm.verts.new(v) for v in top]
        vb = [bm.verts.new(v) for v in bot]
        bm.faces.new(vt if side < 0 else vt[::-1])
        bm.faces.new(vb[::-1] if side < 0 else vb)
        for i in range(4):
            j = (i + 1) % 4
            f = (vt[i], vb[i], vb[j], vt[j])
            bm.faces.new(f if side < 0 else f[::-1])
        slab = k.add(bm, "roof_slab", "terracotta")
        k.paint(slab, "#8a4530", jitter=0.03)
        count = int((x1 - x0) / 0.36)
        for i in range(count):
            x = x0 + (i + 0.5) * (x1 - x0) / count
            lift = Vector((0, 0, 0.02))
            rib = k.tube("tile", [Vector((x, ridge.y, ridge.z)) + lift, Vector((x, eave.y * 1.01, eave.z)) + lift], 0.115, "terracotta", seg=6, cap=True, smooth=60)
            col = ROOF[r.randrange(len(ROOF))]
            k.paint(rib, col, jitter=0.06, fn=lambda c, n, base: tuple(a * (0.86 + 0.14 * max(0.0, n.z)) for a in base))
    k.paint(k.tube("ridge", [(-hw - ov - 0.05, 0, h + rise + 0.1), (hw + ov + 0.05, 0, h + rise + 0.1)], 0.15, "terracotta", seg=7, smooth=60), ROOF[0], jitter=0.04)
    for side in (-1, 1):
        k.paint(k.box("fascia", (w + 2 * ov, 0.08, 0.16), (0, side * (hd + ov - 0.02), eave_z - 0.1), "wood"), WOOD, jitter=0.04)

    # ---- Openings --------------------------------------------------------
    def window(x, y, z, face, tall=False, shut=True):
        """face: unit (nx, ny) of the wall the window sits on."""
        nx, ny = face
        tx, ty = -ny, nx  # along the wall
        ww, wh = (0.82, 1.9) if tall else (0.82, 1.15)
        P = lambda a, o, zz: (x + tx * a + nx * o, y + ty * a + ny * o, zz)
        rot = math.atan2(ty, tx)
        k.paint(k.box("glass", (ww, 0.05, wh), P(0, 0.0, z), "window", rot_z=rot), "#3d4a4a", jitter=0)
        for s in (-1, 1):
            k.paint(k.box("frame", (0.07, 0.1, wh + 0.1), P(s * (ww / 2 + 0.02), 0.03, z), "wood", rot_z=rot), "#efe6d2", jitter=0.02)
        k.paint(k.box("frame", (ww + 0.12, 0.1, 0.07), P(0, 0.03, z + wh / 2 + 0.02), "wood", rot_z=rot), "#efe6d2", jitter=0.02)
        k.paint(k.box("mullion", (0.045, 0.07, wh), P(0, 0.02, z), "wood", rot_z=rot), "#efe6d2", jitter=0.02)
        if not tall:
            k.paint(k.box("sill", (ww + 0.3, 0.2, 0.08), P(0, 0.08, z - wh / 2 - 0.04), "stone", rot_z=rot), STONE_LIGHT, jitter=0.04)
        k.paint(k.box("lintel", (ww + 0.34, 0.07, 0.16), P(0, 0.02, z + wh / 2 + 0.13), "stone", rot_z=rot), STONE_LIGHT, jitter=0.04)
        if shut:
            ajar = r.random() < 0.3
            for s in (-1, 1):
                a = s * (ww / 2 + 0.24)
                sh = k.box("shutter", (0.42, 0.05, wh + 0.04), P(a, 0.06 + (0.07 if ajar and s > 0 else 0), z), "wood", rot_z=rot + (s * 0.28 if ajar and s > 0 else 0))
                k.paint(sh, shutters, jitter=0.08, fn=lambda c, n, base: tuple(a_ * (0.9 + 0.1 * math.sin(c.z * 26)) for a_ in base))
        return P

    front, back, left, right = (0, -1), (0, 1), (-1, 0), (1, 0)
    cols = max(2, int(w // 1.9))
    xs = [(i - (cols - 1) / 2) * (w / cols) for i in range(cols)]
    door_i = cols // 2 if cols % 2 else 0
    for f in range(floors):
        zc = f * fh + 1.55
        for i, x in enumerate(xs):
            if f == 0 and i == door_i:
                # Door with a stone surround and a step.
                k.paint(k.box("door", (1.0, 0.07, 2.1), (x, -hd - 0.01, 1.05), "wood"), door, jitter=0.06, fn=lambda c, n, base: tuple(a * (0.9 + 0.1 * math.sin(c.x * 30)) for a in base))
                for s in (-1, 1):
                    k.paint(k.box("jamb", (0.2, 0.16, 2.2), (x + s * 0.6, -hd - 0.04, 1.1), "stone"), STONE_LIGHT, jitter=0.05)
                k.paint(k.box("arch", (1.5, 0.18, 0.26), (x, -hd - 0.05, 2.3), "stone", taper=0.92), STONE_LIGHT, jitter=0.05)
                k.paint(k.box("step", (1.5, 0.5, 0.16), (x, -hd - 0.28, 0.08), "stone"), STONE, jitter=0.05)
                k.paint(k.sphere("knob", 0.045, (x + 0.34, -hd - 0.07, 1.05), "metal", subdiv=1), "#b99a4a", jitter=0)
                k.anchor("door", (x, -hd - 0.6, 0))
                continue
            tall = balcony and f == 1 and i == door_i
            window(x, -hd, zc + (0.3 if tall else 0), front, tall=tall)
            if tall:
                # Balcony: slab, iron railing, geraniums.
                k.paint(k.box("balcony", (1.9, 0.75, 0.12), (x, -hd - 0.36, f * fh + 0.84), "stone"), STONE_LIGHT, jitter=0.04)
                for s in (-1, 1):
                    k.paint(k.box("corbel", (0.12, 0.5, 0.22), (x + s * 0.7, -hd - 0.24, f * fh + 0.68), "stone", taper=0.7), STONE, jitter=0.04)
                zr = f * fh + 0.9
                rail = [(x - 0.92, -hd - 0.02, zr + 0.9), (x - 0.92, -hd - 0.7, zr + 0.9), (x + 0.92, -hd - 0.7, zr + 0.9), (x + 0.92, -hd - 0.02, zr + 0.9)]
                k.paint(k.tube("rail", rail, 0.025, "metal", seg=5), IRON, jitter=0)
                for j in range(9):
                    bx = x - 0.92 + j * (1.84 / 8)
                    k.paint(k.box("bar", (0.025, 0.025, 0.9), (bx, -hd - 0.7, zr + 0.45), "metal"), IRON, jitter=0)
                for s in (-1, 1):
                    k.paint(k.box("bar", (0.025, 0.025, 0.9), (x + s * 0.92, -hd - 0.36, zr + 0.45), "metal"), IRON, jitter=0)
                if pots:
                    for s in (-0.6, 0.0, 0.6):
                        k.paint(k.cylinder("pot", 0.1, 0.18, (x + s, -hd - 0.6, zr), "terracotta", seg=7, r_top=0.13), "#b86a48", jitter=0.05)
                        fl = k.sphere("flowers", 0.2, (x + s, -hd - 0.6, zr + 0.32), "foliage", subdiv=1, noise=0.15, smooth=70)
                        k.paint(fl, "#c9463d" if s else "#e08a9a", jitter=0.12, fn=lambda c, n, base: base if n.z > -0.1 else k.blend("#3f6b3a", "#3f6b3a", 1), sway=lambda co: 0.5, per_vertex=True)
        if w > 4.4:
            window(0, hd, zc, back, shut=f > 0)
        window(-hw, 0.2, zc, left, shut=False)
        if f > 0 or d > 4:
            window(hw, -0.3, zc, right, shut=f > 0)

    if pots and not balcony:
        x = xs[-1] if door_i != cols - 1 else xs[0]
        k.paint(k.cylinder("pot", 0.2, 0.36, (x + 0.75, -hd - 0.38, 0), "terracotta", seg=8, r_top=0.26), "#b86a48", jitter=0.05)
        fl = k.sphere("bush", 0.36, (x + 0.75, -hd - 0.38, 0.62), "foliage", subdiv=2, noise=0.15, smooth=75)
        k.paint(fl, "#4f8238", jitter=0.1, sway=lambda co: 0.5, per_vertex=True)

    if chimney:
        cx, cy = hw * 0.45, hd * 0.35
        cz = h + rise * (1 - cy / hd)
        k.paint(k.box("chimney", (0.55, 0.55, 1.3), (cx, cy, cz + 0.4), "plaster"), plaster, jitter=0.04)
        k.paint(k.box("chimney_cap", (0.75, 0.75, 0.1), (cx, cy, cz + 1.1), "terracotta"), ROOF[1], jitter=0.04)
        k.paint(k.box("chimney_top", (0.4, 0.4, 0.2), (cx, cy, cz + 1.25), "terracotta", taper=0.6), ROOF[4], jitter=0.04)

    if porch:
        # A pergola with a vine — shade for the huerta at midday.
        py = -hd - 2.0
        for s in (-1, 1):
            k.paint(k.box("post", (0.14, 0.14, 2.4), (s * (hw - 0.3), py, 1.2), "wood"), WOOD, jitter=0.06)
            k.paint(k.box("beam", (0.1, 2.2, 0.14), (s * (hw - 0.3), -hd - 1.0, 2.45), "wood"), WOOD, jitter=0.06)
        for i in range(6):
            x = -hw + 0.3 + i * (w - 0.6) / 5
            k.paint(k.box("lath", (0.07, 2.3, 0.08), (x, -hd - 1.0, 2.56), "wood"), WOOD, jitter=0.08)
        for i in range(7):
            pos = (-hw + 0.5 + r.random() * (w - 1), -hd - 0.4 - r.random() * 1.5, 2.72)
            v = k.sphere("vine", 0.5 + r.random() * 0.25, pos, "foliage", subdiv=2, scale=(1.2, 1.1, 0.42), noise=0.16, smooth=75)
            k.paint(v, "#5c8c40", jitter=0.1, fn=lambda c, n, base: k.blend("#35602f", "#7fae48", n.z * 0.5 + 0.5), sway=lambda co: 0.45, per_vertex=True)
        k.collider(-(hw - 0.3), py, 0.16)
        k.collider(hw - 0.3, py, 0.16)

    # Wall lamp beside the door.
    lx = xs[door_i] + 0.95
    k.paint(k.box("lamp_arm", (0.04, 0.3, 0.04), (lx, -hd - 0.15, 2.45), "metal"), IRON, jitter=0)
    k.paint(k.cylinder("lamp", 0.07, 0.2, (lx, -hd - 0.3, 2.2), "glow", seg=6, r_top=0.11), "#fff3c4", jitter=0)
    k.paint(k.cylinder("lamp_hat", 0.16, 0.08, (lx, -hd - 0.3, 2.4), "metal", seg=6, r_top=0.02), IRON, jitter=0)
    k.anchor("light_00", (lx, -hd - 0.3, 2.25), kind="lamp")

    for i in range(4):
        k.wall(corners[i], corners[(i + 1) % 4], 0.22)
    k.finish(ao_strength=0.78, ao_samples=64)
