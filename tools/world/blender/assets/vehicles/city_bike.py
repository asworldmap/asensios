"""City bike and rider — the protagonist.

A hero asset: it stays a scene graph with named PART_* nodes. The engine
spins the wheels, turns the cranks and the fork, places pedals, shoes, torso
and head, and draws the limbs itself (two-bone IK), so no skeleton is needed.

Authored in game coordinates (x right-hand, y up, z forward) through g().
"""

import math

import bmesh
from mathutils import Vector

SPEC = {
    "id": "city_bike",
    "pack": "vehicles",
    "asset_class": "hero",
    "author": "Claude (pipeline reference asset)",
    "seed": 3,
    "tri_budget": 9000,
    "ao_distance": 0.5,
    "preview_dir": (0.75, -1.0, 0.25),
    "params": {"frame": "#3fbf16", "wheel_r": 0.36, "wheelbase": 1.08},
    "meta": {"chapter": "murcia", "vehicle": "bicycle", "length": 1.8, "wheelbase": 1.08, "wheel_radius": 0.36, "origin": "ground, between the wheels", "limbs": "arms and legs are drawn by the engine (two-bone IK), not part of the asset"},
}

STEEL = "#b9b3a6"
DARK = "#2f2b27"
TYRE = "#2a231d"
LEATHER = "#6b4a2e"
CREAM = "#efe6d2"
WICKER = "#b8935a"


def g(x, y, z):
    """Game space -> Blender space."""
    return Vector((x, -z, y))


def build(k):
    p = k.params
    R = p["wheel_r"]
    wb = p["wheelbase"]
    FRAME = p["frame"]
    rear = (0, R, -wb / 2)
    front = (0, R, wb / 2)
    bb = (0, 0.33, -0.08)
    seat_top = (0, 0.86, -0.3)
    head_top = (0, 0.84, 0.34)
    head_bot = (0, 0.66, 0.39)

    steer = k.node("PART_steer", g(*head_top), role="steer", axis="hinge", hinge=[0, 0.9635, -0.2676], limit_deg=32)
    n_rear = k.node("PART_wheel_rear", g(*rear), role="wheel", axis="x", radius=R)
    n_front = k.node("PART_wheel_front", g(*front), parent=steer, role="wheel", axis="x", radius=R)
    crank = k.node("PART_crank", g(*bb), role="crank", axis="x", crank_length=0.17, pedal_x=0.13)

    def tube(name, pts, r, surface, color, parent=None, seg=8, r_end=None, jitter=0.0):
        o = k.tube(name, [g(*q) for q in pts], r, surface, seg=seg, r_end=r_end, parent=parent)
        k.paint(o, color, jitter=jitter)
        return o

    # ---- Wheels ------------------------------------------------------------
    def wheel(centre, node):
        c = g(*centre)
        bm = bmesh.new()
        major, minor, sa, sb = R - 0.045, 0.045, 28, 8
        ring = []
        for i in range(sa):
            a = i / sa * math.tau
            row = []
            for j in range(sb):
                b = j / sb * math.tau
                rad = major + math.cos(b) * minor
                # Axle is game x; the wheel lies in the game y/z plane.
                row.append(bm.verts.new(c + g(math.sin(b) * minor * 0.92, math.sin(a) * rad, math.cos(a) * rad)))
            ring.append(row)
        for i in range(sa):
            for j in range(sb):
                bm.faces.new((ring[i][j], ring[(i + 1) % sa][j], ring[(i + 1) % sa][(j + 1) % sb], ring[i][(j + 1) % sb]))
        tyre = k.add(bm, "tyre", "rubber", smooth=60, parent=node)
        k.paint(tyre, TYRE, jitter=0.0, fn=lambda cc, nn, base: k.blend(TYRE, "#d8cdb4", 1.0 if (abs((cc - c).x) > 0.03 and R - 0.072 < (cc - c).length < R - 0.03) else 0.0))
        # Rim
        bm = bmesh.new()
        rr, rw = R - 0.095, 0.022
        prof = [(-rw, 0.012), (rw, 0.012), (rw * 0.6, -0.012), (-rw * 0.6, -0.012)]
        rows = []
        for i in range(sa):
            a = i / sa * math.tau
            rows.append([bm.verts.new(c + g(px, math.sin(a) * (rr + pr), math.cos(a) * (rr + pr))) for px, pr in prof])
        for i in range(sa):
            for j in range(4):
                bm.faces.new((rows[i][j], rows[(i + 1) % sa][j], rows[(i + 1) % sa][(j + 1) % 4], rows[i][(j + 1) % 4]))
        k.paint(k.add(bm, "rim", "metal", smooth=40, parent=node), STEEL, jitter=0)
        for i in range(14):
            a = i / 14 * math.tau
            side = 0.028 if i % 2 else -0.028
            o = k.tube("spoke", [c + g(side, 0, 0), c + g(0, math.sin(a) * (rr - 0.01), math.cos(a) * (rr - 0.01))], 0.0035, "metal", seg=3, cap=False, parent=node)
            k.paint(o, STEEL, jitter=0)
        k.paint(k.tube("hub", [c + g(-0.045, 0, 0), c + g(0.045, 0, 0)], 0.022, "metal", seg=8, parent=node), STEEL, jitter=0)

    wheel(rear, n_rear)
    wheel(front, n_front)

    # ---- Frame ---------------------------------------------------------------
    tube("seat_tube", [bb, seat_top], 0.019, "paint", FRAME)
    tube("top_tube", [(0, 0.79, -0.27), (0, 0.805, 0.05), (0, 0.795, 0.33)], 0.017, "paint", FRAME)
    tube("down_tube", [bb, (0, 0.5, 0.17), head_bot], 0.021, "paint", FRAME)
    tube("head_tube", [(0, 0.63, 0.398), (0, 0.87, 0.332)], 0.024, "paint", FRAME)
    tube("seat_post", [seat_top, (0, 0.93, -0.325)], 0.012, "metal", STEEL)
    for sx in (-1, 1):
        tube("chain_stay", [(sx * 0.03, bb[1], bb[2]), (sx * 0.055, rear[1], rear[2])], 0.011, "paint", FRAME)
        tube("seat_stay", [(sx * 0.02, 0.77, -0.28), (sx * 0.055, rear[1], rear[2])], 0.009, "paint", FRAME)
        tube("fork", [(sx * 0.045, 0.64, 0.395), (sx * 0.05, 0.5, 0.455), (sx * 0.055, front[1], front[2])], 0.012, "paint", FRAME, parent=steer, r_end=0.009)
        tube("rack_leg", [(sx * 0.07, rear[1], rear[2]), (sx * 0.085, 0.745, -0.72)], 0.006, "metal", DARK)
        tube("rack_rail", [(sx * 0.085, 0.745, -0.36), (sx * 0.085, 0.745, -0.86)], 0.007, "metal", DARK)
        tube("fender_stay_r", [(sx * 0.06, rear[1], rear[2]), (sx * 0.03, 0.47, -0.93)], 0.004, "metal", STEEL, seg=4)
        tube("fender_stay_f", [(sx * 0.06, front[1], front[2]), (sx * 0.03, 0.56, 0.93)], 0.004, "metal", STEEL, seg=4, parent=steer)
    tube("fork_crown", [(-0.05, 0.64, 0.395), (0.05, 0.64, 0.395)], 0.016, "paint", FRAME, parent=steer)
    for z in (-0.42, -0.56, -0.7, -0.84):
        tube("rack_bar", [(-0.085, 0.745, z), (0.085, 0.745, z)], 0.005, "metal", DARK, seg=4)

    # ---- Mudguards: an arc of sheet metal hugging each wheel -----------------
    def fender(centre, a0, a1, parent=None):
        bm = bmesh.new()
        rr = R + 0.028
        n = 14
        rows = []
        for i in range(n + 1):
            a = math.radians(a0 + (a1 - a0) * i / n)
            # a measured from straight up, positive towards the front.
            y, z = centre[1] + math.cos(a) * rr, centre[2] + math.sin(a) * rr
            y2, z2 = centre[1] + math.cos(a) * (rr - 0.02), centre[2] + math.sin(a) * (rr - 0.02)
            rows.append([bm.verts.new(g(-0.034, y2, z2)), bm.verts.new(g(-0.02, y, z)), bm.verts.new(g(0.02, y, z)), bm.verts.new(g(0.034, y2, z2))])
        for i in range(n):
            for j in range(3):
                bm.faces.new((rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]))
        o = k.add(bm, "fender", "paint", smooth=50, parent=parent)
        o.data.materials[0].use_backface_culling = False
        k.paint(o, CREAM, jitter=0.0)

    fender(rear, -118, 62)
    fender(front, -42, 96, parent=steer)

    # ---- Drivetrain ------------------------------------------------------------
    ring_x = -0.052
    bm = bmesh.new()
    teeth = 20
    vo, vi = [], []
    for i in range(teeth * 2):
        a = i / (teeth * 2) * math.tau
        rr = 0.098 if i % 2 else 0.09
        vo.append((math.sin(a) * rr, math.cos(a) * rr))
        vi.append((math.sin(a) * 0.062, math.cos(a) * 0.062))
    for sx in (-0.003, 0.003):
        a_ = [bm.verts.new(g(ring_x + sx, bb[1] + y, bb[2] + z)) for z, y in vo]
        b_ = [bm.verts.new(g(ring_x + sx, bb[1] + y, bb[2] + z)) for z, y in vi]
        for i in range(teeth * 2):
            j = (i + 1) % (teeth * 2)
            f = (a_[i], a_[j], b_[j], b_[i])
            bm.faces.new(f if sx > 0 else f[::-1])
    o = k.add(bm, "chainring", "metal", parent=crank)
    o.data.materials[0].use_backface_culling = True
    k.paint(o, STEEL, jitter=0)
    for i in range(5):
        a = i / 5 * math.tau
        tube("spider", [(ring_x, bb[1], bb[2]), (ring_x, bb[1] + math.cos(a) * 0.066, bb[2] + math.sin(a) * 0.066)], 0.006, "metal", STEEL, parent=crank, seg=4)
    tube("axle", [(-0.075, bb[1], bb[2]), (0.075, bb[1], bb[2])], 0.014, "metal", STEEL, parent=crank)
    CR = 0.17
    for side in (1, -1):
        tube("crank_arm", [(side * 0.072, bb[1], bb[2]), (side * 0.082, bb[1] + side * CR, bb[2])], 0.011, "metal", STEEL, parent=crank, r_end=0.009)
        tube("pedal_pin", [(side * 0.082, bb[1] + side * CR, bb[2]), (side * 0.13, bb[1] + side * CR, bb[2])], 0.006, "metal", STEEL, parent=crank, seg=5)
    tube("cog", [(ring_x - 0.004, rear[1], rear[2]), (ring_x + 0.004, rear[1], rear[2])], 0.04, "metal", STEEL, seg=12)
    # Chain: two straight runs between chainring and cog.
    for s in (1, -1):
        tube("chain", [(ring_x, bb[1] + s * 0.092, bb[2]), (ring_x, rear[1] + s * 0.04, rear[2])], 0.0055, "metal", DARK, seg=4)
    # Chain guard, the mark of a town bike.
    bm = bmesh.new()
    pts = [(bb[1] + 0.125, bb[2] + 0.11), (bb[1] + 0.13, bb[2] - 0.02), (rear[1] + 0.075, rear[2] + 0.03), (rear[1] + 0.02, rear[2] + 0.02), (bb[1] + 0.07, bb[2] - 0.05), (bb[1] + 0.05, bb[2] + 0.11)]
    for sx in (ring_x - 0.02, ring_x - 0.026):
        vs = [bm.verts.new(g(sx, y, z)) for y, z in pts]
        bm.faces.new(vs if sx < ring_x - 0.022 else vs[::-1])
    k.paint(k.add(bm, "chain_guard", "paint"), CREAM, jitter=0)

    # Pedals (the engine keeps them level and puts them on the crank pins).
    for name in ("l", "r"):
        n = k.node(f"PART_pedal_{name}", (0, 0, 0), role="pedal", note="engine places it on the crank pin and keeps it level")
        o = k.box("pedal", (0.095, 0.075, 0.022), (0, 0, 0), "rubber", parent=n)
        k.paint(o, DARK, jitter=0.0, fn=lambda cc, nn, base: k.blend("#d9a441", DARK, 0.0 if abs(nn.y) > 0.9 else 1.0))

    # ---- Saddle, bars, basket, lamp, bell ---------------------------------------
    sad = k.sphere("saddle", 1.0, g(0, 0.945, -0.315), "wood", subdiv=3, scale=(0.085, 0.15, 0.035), smooth=70)
    for v in sad.data.vertices:
        f = (-(v.co.y - g(0, 0, -0.315).y)) / 0.15  # -1 rear .. +1 nose
        v.co.x *= 0.62 + 0.38 * max(-1.0, min(1.0, -f)) if f > 0 else 1.0
    k.paint(sad, LEATHER, jitter=0.03, per_vertex=True, fn=lambda cc, nn, base: k.blend("#4f3622", "#8a6040", nn.z * 0.5 + 0.5))

    tube("stem", [head_top, (0, 0.97, 0.315)], 0.013, "metal", STEEL, parent=steer)
    bar = [(-0.3, 1.0, 0.12), (-0.27, 1.0, 0.24), (-0.12, 0.985, 0.31), (0, 0.975, 0.315), (0.12, 0.985, 0.31), (0.27, 1.0, 0.24), (0.3, 1.0, 0.12)]
    tube("bar", bar, 0.011, "metal", STEEL, parent=steer)
    for sx in (-1, 1):
        tube("grip", [(sx * 0.3, 1.0, 0.105), (sx * 0.292, 1.0, 0.215)], 0.017, "wood", LEATHER, parent=steer)
        k.anchor(f"grip_{'l' if sx > 0 else 'r'}", g(sx * 0.296, 1.0, 0.16) - g(*head_top) + g(*head_top))
    bell = k.sphere("bell", 0.026, g(0.2, 1.02, 0.275), "metal", subdiv=2, scale=(1, 1, 0.7), smooth=70, parent=steer)
    k.paint(bell, "#c9a94e", jitter=0, per_vertex=True, fn=lambda cc, nn, base: k.blend("#8a7030", "#e8d27a", nn.z * 0.5 + 0.5))

    # Wicker basket: tapered, open, painted in woven bands.
    bx, by, bz = 0.0, 0.88, 0.56
    bm = bmesh.new()
    rows = 6
    tw, td, hh = 0.19, 0.13, 0.2  # half width, half depth, height
    loops = []
    for layer, shrink in ((0, 0.0), (1, 0.012)):
        ring_rows = []
        for q in range(rows + 1):
            f = q / rows
            s = 0.8 + 0.2 * f
            y = by - hh / 2 + hh * f
            w_, d_ = tw * s - shrink, td * s - shrink
            ring_rows.append([bm.verts.new(g(bx + cx * w_, y, bz + cz * d_)) for cx, cz in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
        loops.append(ring_rows)
    for layer, ring_rows in enumerate(loops):
        for q in range(rows):
            for i in range(4):
                j = (i + 1) % 4
                f = (ring_rows[q][i], ring_rows[q][j], ring_rows[q + 1][j], ring_rows[q + 1][i])
                bm.faces.new(f if layer == 0 else f[::-1])
    bm.faces.new(loops[0][0][::-1])
    bm.faces.new(loops[1][0])
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((loops[0][rows][i], loops[0][rows][j], loops[1][rows][j], loops[1][rows][i]))
    basket = k.add(bm, "basket", "wood", parent=steer)
    k.paint(basket, WICKER, jitter=0.1, fn=lambda cc, nn, base: k.blend("#9a7645", "#cfa868", 0.5 + 0.5 * math.sin((cc.z - 0.78) * 95)))
    tube("basket_rim", [(bx - tw, by + hh / 2, bz - td), (bx + tw, by + hh / 2, bz - td), (bx + tw, by + hh / 2, bz + td), (bx - tw, by + hh / 2, bz + td), (bx - tw, by + hh / 2, bz - td)], 0.008, "wood", "#8a6a45", parent=steer, seg=5)
    for sx in (-1, 1):
        tube("basket_stay", [(sx * 0.1, by - hh / 2, bz - 0.02), (sx * 0.055, front[1], front[2])], 0.004, "metal", STEEL, parent=steer, seg=4)
    k.anchor("basket", g(bx, by - 0.02, bz))

    k.paint(k.tube("lamp_body", [g(0, 0.71, 0.46), g(0, 0.71, 0.52)], 0.032, "metal", seg=10, r_end=0.04, parent=steer), STEEL, jitter=0)
    k.paint(k.tube("lamp_lens", [g(0, 0.71, 0.52), g(0, 0.71, 0.528)], 0.036, "glow", seg=10, parent=steer), "#fff3c4", jitter=0)
    k.anchor("headlight", g(0, 0.71, 0.53))
    k.paint(k.box("reflector", (0.05, 0.012, 0.03), g(0, 0.7, -0.875), "paint"), "#c9463d", jitter=0)
    k.anchor("pennant", g(0, 0.745, -0.84))

    # ---- Rider -------------------------------------------------------------------
    # Torso: modelled upright from the hip; the engine leans it toward the bars.
    torso = k.node("PART_torso", (0, 0, 0), role="rider_torso", note="origin at the hip, modelled upright; engine aims +Y at the chest")
    body = k.sphere("shirt", 1.0, g(0, 0.26, 0), "cloth", subdiv=3, scale=(0.17, 0.115, 0.31), smooth=75, parent=torso)
    for v in body.data.vertices:
        t = (v.co.z - 0.26) / 0.31
        v.co.x *= 1.0 + 0.2 * max(0.0, t)  # shoulders
        v.co.y *= 1.0 - 0.12 * max(0.0, t)
    k.paint(body, "#f4ecd9", jitter=0.02, per_vertex=True, fn=lambda cc, nn, base: k.blend("#cfc4aa", "#fbf5e6", nn.z * 0.4 + 0.6))
    k.paint(k.tube("collar", [g(0, 0.53, 0.0), g(0, 0.57, 0.005)], 0.062, "skin", seg=10, r_end=0.055, parent=torso), "#d7a27c", jitter=0)
    pack = k.sphere("backpack", 1.0, g(0, 0.3, -0.135), "cloth", subdiv=2, scale=(0.13, 0.075, 0.19), smooth=70, parent=torso)
    k.paint(pack, "#b5573a", jitter=0.03, per_vertex=True, fn=lambda cc, nn, base: k.blend("#8e4530", "#c76a48", nn.z * 0.5 + 0.5))
    k.paint(k.box("pack_pocket", (0.15, 0.035, 0.11), g(0, 0.22, -0.205), "cloth", parent=torso), "#9c4a34", jitter=0)
    for sx in (-1, 1):
        tube("strap", [(sx * 0.085, 0.47, -0.08), (sx * 0.1, 0.5, 0.03), (sx * 0.09, 0.36, 0.105), (sx * 0.085, 0.2, 0.08)], 0.012, "cloth", "#6b4a2e", parent=torso, seg=4)

    head = k.node("PART_head", (0, 0, 0), role="rider_head")
    skull = k.sphere("head", 1.0, g(0, 0.02, 0.005), "skin", subdiv=3, scale=(0.118, 0.13, 0.135), smooth=80, parent=head)
    k.paint(skull, "#d7a27c", jitter=0.0, per_vertex=True, fn=lambda cc, nn, base: k.blend("#b9825e", "#e3b28c", nn.z * 0.4 + 0.6))
    k.paint(k.sphere("nose", 0.022, g(0, 0.005, 0.132), "skin", subdiv=1, smooth=70, parent=head), "#cf9670", jitter=0)
    for sx in (-1, 1):
        k.paint(k.sphere("eye", 0.014, g(sx * 0.045, 0.035, 0.118), "rubber", subdiv=1, smooth=70, parent=head), "#2a231d", jitter=0)
        k.paint(k.sphere("ear", 0.024, g(sx * 0.116, 0.01, 0.0), "skin", subdiv=1, scale=(0.5, 1, 1), smooth=70, parent=head), "#cf9670", jitter=0)
    hair = k.sphere("hair", 1.0, g(0, 0.015, -0.035), "cloth", subdiv=2, scale=(0.122, 0.12, 0.125), smooth=75, parent=head)
    k.paint(hair, "#4a3220", jitter=0.04, per_vertex=True)
    # Helmet: a shell with painted vents and a short peak.
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=8, radius=1.0)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.12], context="VERTS")
    for v in bm.verts:
        v.co.x *= 0.142
        v.co.y *= 0.168
        v.co.z *= 0.125
        v.co += g(0, 0.075, -0.012)
    shell = k.add(bm, "helmet", "paint", smooth=70, parent=head)
    shell.data.materials[0].use_backface_culling = False
    k.paint(shell, "#b5573a", jitter=0.0, fn=lambda cc, nn, base: k.blend("#b5573a", "#5e2c1e", 1.0 if (abs(math.sin(cc.x * 62)) > 0.86 and cc.z > 0.11) else 0.0))
    k.paint(k.box("peak", (0.2, 0.09, 0.014), g(0, 0.075, 0.175), "paint", parent=head), "#9c4a34", jitter=0)
    for sx in (-1, 1):
        tube("chin_strap", [(sx * 0.118, 0.06, 0.02), (sx * 0.09, -0.07, 0.05), (0, -0.115, 0.06)], 0.006, "cloth", "#2f2b27", parent=head, seg=4)

    k.paint(k.sphere("shorts", 1.0, g(0, 0.955, -0.285), "cloth", subdiv=2, scale=(0.155, 0.125, 0.1), smooth=75), "#27512f", jitter=0.02, per_vertex=True)

    for name in ("l", "r"):
        n = k.node(f"PART_shoe_{name}", (0, 0, 0), role="rider_shoe")
        shoe = k.sphere("shoe", 1.0, g(0, 0.0, 0.03), "wood", subdiv=2, scale=(0.05, 0.125, 0.042), smooth=70, parent=n)
        k.paint(shoe, LEATHER, jitter=0, per_vertex=True, fn=lambda cc, nn, base: k.blend("#efe6d2", "#6b4a2e", 0.0 if nn.z < -0.55 else 1.0))

    # Rest pose: parts were modelled around their own origin; park them where
    # they belong so the .blend and the preview read as a bike with a rider.
    rest = {
        "PART_torso": g(0, 0.95, -0.28),
        "PART_head": g(0, 1.64, -0.27),
        "PART_pedal_l": g(0.13, bb[1] + CR, bb[2]),
        "PART_pedal_r": g(-0.13, bb[1] - CR, bb[2]),
        "PART_shoe_l": g(0.13, bb[1] + CR + 0.05, bb[2]),
        "PART_shoe_r": g(-0.13, bb[1] - CR + 0.05, bb[2]),
    }
    import bpy
    from mathutils import Matrix

    for obj in list(k.parts):
        node = k.owner.get(obj.name)
        if node is not None and node.name in rest:
            obj.data.transform(Matrix.Translation(rest[node.name]))
    for name, at in rest.items():
        k.nodes[name].location = at
    bpy.context.view_layer.update()

    k.anchor("hip", g(0, 0.95, -0.28))
    k.anchor("rider_eye", g(0, 1.6, 0.0))
    k.finish(ao_strength=0.55, ao_samples=48, ground=False)
