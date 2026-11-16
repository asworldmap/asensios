import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils import noise as mnoise

CONTRACT_VERSION = 1

# Surface library. An asset may only use these material names. The engine maps
# each one to its own shader, so the look stays coherent across asset packs and
# across day and night. (base colour is a default; assets paint their own.)
#   name: (default sRGB hex, roughness, metallic)
SURFACES = {
    "stone": ("#cdb48a", 0.92, 0.0),
    "plaster": ("#efe2c8", 0.95, 0.0),
    "terracotta": ("#b5573a", 0.85, 0.0),
    "wood": ("#7a5a3a", 0.8, 0.0),
    "earth": ("#c9ac7c", 1.0, 0.0),
    "foliage": ("#4f7f3a", 0.9, 0.0),
    "metal": ("#4a4640", 0.45, 0.8),
    "paint": ("#3fbf16", 0.5, 0.1),
    "rubber": ("#2a231d", 0.9, 0.0),
    "cloth": ("#f4ecd9", 0.95, 0.0),
    "skin": ("#d7a27c", 0.75, 0.0),
    "window": ("#3d4a4a", 0.25, 0.0),  # engine lights these at night
    "glow": ("#fff3c4", 0.5, 0.0),  # engine renders these unlit
}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear(h):
    h = h.lstrip("#")
    return tuple(srgb_to_linear(int(h[i : i + 2], 16) / 255.0) for i in (0, 2, 4))


def _mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


class Kit:
    """One instance per asset build. Holds the seed, the root and the parts."""

    def __init__(self, spec, seed=None, params=None):
        self.spec = spec
        self.id = spec["id"]
        self.pack = spec["pack"]
        self.asset_class = spec.get("asset_class", "batched")
        self.seed = spec.get("seed", 1) if seed is None else seed
        self.params = dict(spec.get("params", {}))
        if params:
            self.params.update(params)
        self.rng = random.Random(self.seed)
        self.parts = []
        self.owner = {}  # mesh part name -> PART node it moves with
        self.nodes = {}
        self.colliders = []
        self.anchors = []
        self.reset_scene()
        self.root = bpy.data.objects.new(self.id, None)
        self.root.empty_display_size = 0.5
        bpy.context.scene.collection.objects.link(self.root)

    # ------------------------------------------------------------- scene
    @staticmethod
    def reset_scene():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        sc = bpy.context.scene
        sc.unit_settings.system = "METRIC"
        sc.unit_settings.scale_length = 1.0
        sc.render.engine = "CYCLES"
        try:
            sc.cycles.device = "CPU"
        except Exception:
            pass

    def material(self, surface):
        if surface not in SURFACES:
            raise ValueError(f"Unknown surface '{surface}'. Allowed: {sorted(SURFACES)}")
        name = f"M_{surface}"
        mat = bpy.data.materials.get(name)
        if mat:
            return mat
        hexc, rough, metal = SURFACES[surface]
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        mat.use_backface_culling = True  # exported as single-sided
        nt = mat.node_tree
        bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
        # Colour lives in the 'Col' vertex-colour attribute; the factor stays white.
        bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
        att = nt.nodes.new("ShaderNodeVertexColor")
        att.layer_name = "Col"
        nt.links.new(att.outputs["Color"], bsdf.inputs["Base Color"])
        if surface == "glow":
            try:
                bsdf.inputs["Emission Color"].default_value = (*hex_to_linear(hexc), 1)
                bsdf.inputs["Emission Strength"].default_value = 2.0
            except KeyError:
                pass
        return mat

    # -------------------------------------------------------------- mesh
    def add(self, bm_or_data, name, surface, smooth=None, parent=None, keep=False):
        """Turn a bmesh (or (verts, faces)) into an object using one surface."""
        mesh = bpy.data.meshes.new(name)
        if isinstance(bm_or_data, bmesh.types.BMesh):
            bmesh.ops.recalc_face_normals(bm_or_data, faces=bm_or_data.faces)
            bm_or_data.to_mesh(mesh)
            bm_or_data.free()
        else:
            verts, faces = bm_or_data
            mesh.from_pydata(verts, [], faces)
            mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        mesh.materials.append(self.material(surface))
        obj["ptw_surface"] = surface
        if smooth is not None:
            self.shade(obj, smooth)
        if not keep:
            self.parts.append(obj)
        if parent is not None:
            self.owner[obj.name] = parent
        return obj

    @staticmethod
    def shade(obj, angle_deg):
        """Smooth shading with hard edges above the given angle (0 = flat)."""
        me = obj.data
        if angle_deg <= 0:
            for p in me.polygons:
                p.use_smooth = False
            return
        for p in me.polygons:
            p.use_smooth = True
        try:
            me.set_sharp_from_angle(angle=math.radians(angle_deg))
        except Exception:
            try:
                me.use_auto_smooth = True
                me.auto_smooth_angle = math.radians(angle_deg)
            except Exception:
                pass

    def box(self, name, size, at=(0, 0, 0), surface="stone", rot_z=0.0, rot=None, taper=1.0, **kw):
        """Axis-aligned box centred on `at` (z is the centre too). `taper` narrows the top."""
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co.x *= size[0]
            v.co.y *= size[1]
            v.co.z *= size[2]
            if taper != 1.0 and v.co.z > 0:
                v.co.x *= taper
                v.co.y *= taper
        m = Matrix.Translation(Vector(at))
        if rot is not None:
            m = m @ rot
        elif rot_z:
            m = m @ Matrix.Rotation(rot_z, 4, "Z")
        bm.transform(m)
        return self.add(bm, name, surface, **kw)

    def cylinder(self, name, r, h, at=(0, 0, 0), surface="stone", seg=12, r_top=None, axis="Z", cap=True, **kw):
        """Cylinder / cone with its base centre at `at`."""
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=cap, segments=seg, radius1=r, radius2=r if r_top is None else r_top, depth=h)
        bm.transform(Matrix.Translation((0, 0, h / 2)))
        if axis == "X":
            bm.transform(Matrix.Rotation(math.radians(90), 4, "Y"))
        elif axis == "Y":
            bm.transform(Matrix.Rotation(math.radians(-90), 4, "X"))
        bm.transform(Matrix.Translation(Vector(at)))
        return self.add(bm, name, surface, **kw)

    def sphere(self, name, r, at=(0, 0, 0), surface="foliage", subdiv=2, scale=(1, 1, 1), noise=0.0, freq=1.4, **kw):
        """Icosphere, optionally lumpy (seeded) — the base of every organic shape."""
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=r)
        off = Vector((self.rng.random() * 50, self.rng.random() * 50, self.rng.random() * 50))
        for v in bm.verts:
            if noise:
                # Coherent lumps (not per-vertex jitter): reads as growth, not damage.
                d = v.co.normalized()
                v.co *= 1.0 + noise * (mnoise.noise(d * freq + off) * 1.6 + mnoise.noise(d * freq * 2.3 + off) * 0.6)
            v.co.x *= scale[0]
            v.co.y *= scale[1]
            v.co.z *= scale[2]
        bm.transform(Matrix.Translation(Vector(at)))
        return self.add(bm, name, surface, **kw)

    def tube(self, name, points, r, surface="metal", seg=8, r_end=None, cap=True, **kw):
        """Swept tube through a polyline of points (frames, branches, rails)."""
        pts = [Vector(p) for p in points]
        bm = bmesh.new()
        rings = []
        n = len(pts)
        prev_n = None
        for i, p in enumerate(pts):
            d = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
            ref = Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((1, 0, 0))
            a = d.cross(ref).normalized()
            if prev_n is not None and a.dot(prev_n) < 0:
                a = -a
            prev_n = a
            b = d.cross(a).normalized()
            rr = r if r_end is None else r + (r_end - r) * (i / max(1, n - 1))
            rings.append([bm.verts.new(p + (a * math.cos(t) + b * math.sin(t)) * rr) for t in [k / seg * math.tau for k in range(seg)]])
        for i in range(n - 1):
            for k in range(seg):
                k2 = (k + 1) % seg
                bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
        if cap:
            bm.faces.new(rings[0][::-1])
            bm.faces.new(rings[-1])
        kw.setdefault("smooth", 50)
        return self.add(bm, name, surface, **kw)

    # ------------------------------------------------------------- paint
    def paint(self, obj, color=None, jitter=0.05, fn=None, sway=None, per_vertex=False):
        """Write the albedo into the 'Col' attribute, one colour per face.

        color  hex string (defaults to the surface colour)
        jitter value variation per face (0..1), seeded
        fn     optional (centre: Vector, normal: Vector, linear_rgb) -> linear_rgb
        sway   optional (vertex co: Vector) -> 0..1, stored as 1 - alpha
        """
        me = obj.data
        base = hex_to_linear(color or SURFACES[obj["ptw_surface"]][0])
        att = me.color_attributes.get("Col") or me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
        cols = [0.0] * (len(me.loops) * 4)
        mw = obj.matrix_world
        if per_vertex:
            # Smooth, painterly colour for organic forms: one colour per vertex,
            # varied by coherent noise instead of per-face steps.
            off = Vector((self.rng.random() * 90, self.rng.random() * 90, self.rng.random() * 90))
            vcol = []
            for v in me.vertices:
                w = mw @ v.co
                c = fn(w, v.normal, base) if fn else base
                if jitter:
                    kk = 1.0 + mnoise.noise(w * 1.7 + off) * 2.2 * jitter
                    c = tuple(max(0.0, min(1.0, ch * kk)) for ch in c)
                a = 1.0 - max(0.0, min(1.0, sway(w))) if sway else 1.0
                vcol.append((c[0], c[1], c[2], a))
            for li, loop in enumerate(me.loops):
                cols[li * 4 : li * 4 + 4] = vcol[loop.vertex_index]
            att.data.foreach_set("color", cols)
            return obj
        for p in me.polygons:
            c = base
            if fn:
                c = fn(mw @ p.center, p.normal, c)
            if jitter:
                k = 1.0 + (self.rng.random() - 0.5) * 2 * jitter
                c = tuple(min(1.0, ch * k) for ch in c)
            for li in p.loop_indices:
                a = 1.0
                if sway:
                    a = 1.0 - max(0.0, min(1.0, sway(mw @ me.vertices[me.loops[li].vertex_index].co)))
                cols[li * 4 : li * 4 + 4] = (c[0], c[1], c[2], a)
        att.data.foreach_set("color", cols)
        return obj

    @staticmethod
    def blend(a_hex, b_hex, t):
        return _mix(hex_to_linear(a_hex), hex_to_linear(b_hex), max(0.0, min(1.0, t)))

    # ---------------------------------------------------------- assembly
    def node(self, name, at=(0, 0, 0), parent=None):
        """A named transform the engine can animate (PART_*)."""
        e = bpy.data.objects.new(name, None)
        e.empty_display_size = 0.15
        bpy.context.scene.collection.objects.link(e)
        self._child_of(e, parent or self.root)
        e.location = at  # world position: the parent inverse absorbs the offset
        self.nodes[name] = e
        bpy.context.view_layer.update()
        return e

    @staticmethod
    def _child_of(obj, parent):
        """Parent while keeping the child's coordinates expressed in asset space."""
        bpy.context.view_layer.update()
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()

    def collider(self, x, y, r):
        """Circle collider on the ground plane (asset-local metres)."""
        e = bpy.data.objects.new(f"COL_circle_{len(self.colliders):02d}", None)
        e.empty_display_type = "CIRCLE"
        e.empty_display_size = r
        e.location = (x, y, 0)
        e["ptw_collider"] = "circle"
        e["ptw_radius"] = float(r)
        e.parent = self.root
        bpy.context.scene.collection.objects.link(e)
        self.colliders.append(e)
        return e

    def wall(self, a, b, r=0.2):
        """Segment collider from a to b (x, y), thickness 2r — walls and parapets."""
        ax, ay = a
        bx, by = b
        e = bpy.data.objects.new(f"COL_segment_{len(self.colliders):02d}", None)
        e.empty_display_type = "SINGLE_ARROW"
        e.location = ((ax + bx) / 2, (ay + by) / 2, 0)
        e["ptw_collider"] = "segment"
        e["ptw_radius"] = float(r)
        e["ptw_a"] = [float(ax), float(ay)]
        e["ptw_b"] = [float(bx), float(by)]
        e.parent = self.root
        bpy.context.scene.collection.objects.link(e)
        self.colliders.append(e)
        return e

    def anchor(self, name, at, **props):
        """A named point the engine can attach things to (lights, markers, riders)."""
        e = bpy.data.objects.new(f"ANCHOR_{name}", None)
        e.empty_display_type = "PLAIN_AXES"
        e.empty_display_size = 0.25
        e.location = at
        e.parent = self.root
        for k, v in props.items():
            e[f"ptw_{k}"] = v
        bpy.context.scene.collection.objects.link(e)
        self.anchors.append(e)
        return e

    @staticmethod
    def _join(objs, name):
        objs = [o for o in objs if o is not None]
        if not objs:
            return None
        target = objs[0]
        if len(objs) > 1:
            with bpy.context.temp_override(active_object=target, object=target, selected_objects=objs, selected_editable_objects=objs):
                bpy.ops.object.join()
        target.name = name
        target.data.name = name
        return target

    def finish(self, ao=True, ao_strength=0.75, ao_samples=48, ground=True):
        """Join loose parts per parent, bake ambient occlusion, parent to the root.

        Parts created with parent=<PART node> stay separate so the engine can
        move them; everything else becomes one mesh named after the asset.
        """
        groups = {}
        for o in self.parts:
            if "Col" not in o.data.color_attributes:
                self.paint(o)
            owner = self.owner.get(o.name)
            groups.setdefault(owner.name if owner else "", []).append((o, owner))
        meshes = []
        for parent_name, pairs in groups.items():
            parent = pairs[0][1]
            name = f"{self.id}_mesh" if not parent_name else f"{parent_name}_mesh"
            m = self._join([o for o, _ in pairs], name)
            self._child_of(m, parent or self.root)
            meshes.append(m)
        self.meshes = meshes
        bpy.context.view_layer.update()
        if ao:
            self._bake_ao(meshes, ao_strength, ao_samples, ground)
        self.root["ptw_id"] = self.id
        self.root["ptw_pack"] = self.pack
        self.root["ptw_class"] = self.asset_class
        self.root["ptw_contract"] = CONTRACT_VERSION
        self.root["ptw_seed"] = int(self.seed)
        return self.root

    def _bake_ao(self, meshes, strength, samples, ground):
        """Cycles ambient occlusion → multiplied into the 'Col' vertex colours."""
        sc = bpy.context.scene
        sc.render.engine = "CYCLES"
        sc.cycles.samples = samples
        sc.render.bake.target = "VERTEX_COLORS"
        if sc.world is None:
            sc.world = bpy.data.worlds.new("World")
        try:
            sc.world.light_settings.distance = float(self.spec.get("ao_distance", 2.5))
        except Exception:
            pass
        plane = None
        if ground:
            bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, float(self.spec.get("ground_z", 0.0)) - 0.001))
            plane = bpy.context.object
        for m in meshes:
            me = m.data
            ao = me.color_attributes.new("AO", "FLOAT_COLOR", "CORNER")
            me.color_attributes.active_color = ao
            bpy.ops.object.select_all(action="DESELECT")
            m.select_set(True)
            bpy.context.view_layer.objects.active = m
            bpy.ops.object.bake(type="AO")
            n = len(me.loops) * 4
            a = [0.0] * n
            c = [0.0] * n
            me.color_attributes["AO"].data.foreach_get("color", a)
            me.color_attributes["Col"].data.foreach_get("color", c)
            for i in range(0, n, 4):
                k = 1.0 - strength + strength * min(1.0, a[i] * 1.15)
                c[i] *= k
                c[i + 1] *= k
                c[i + 2] *= k
            me.color_attributes["Col"].data.foreach_set("color", c)
            me.color_attributes.remove(me.color_attributes["AO"])
            col = me.color_attributes["Col"]
            me.color_attributes.active_color = col
            try:
                me.color_attributes.render_color_index = list(me.color_attributes).index(col)
            except Exception:
                pass
        if plane is not None:
            bpy.data.objects.remove(plane, do_unlink=True)

    # ------------------------------------------------------------- stats
    def stats(self):
        tris = 0
        lo = Vector((1e9, 1e9, 1e9))
        hi = Vector((-1e9, -1e9, -1e9))
        dg = bpy.context.evaluated_depsgraph_get()
        mats = set()
        for o in bpy.context.scene.objects:
            if o.type != "MESH":
                continue
            ev = o.evaluated_get(dg)
            me = ev.to_mesh()
            me.calc_loop_triangles()
            tris += len(me.loop_triangles)
            for v in me.vertices:
                w = o.matrix_world @ v.co
                lo = Vector((min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z)))
                hi = Vector((max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z)))
            mats.update(m.name for m in o.data.materials if m)
            ev.to_mesh_clear()
        return {"triangles": tris, "bounds_blender": [[round(v, 3) for v in lo], [round(v, 3) for v in hi]], "materials": sorted(mats)}
