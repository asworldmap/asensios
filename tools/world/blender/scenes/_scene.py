"""Reference scenes: compose built assets, light them, render, and write the layout.

A scene script declares a LAYOUT (asset key, game-space position, yaw, scale),
a camera and a mood. This module turns that into three things:

    assets-src/world/scenes/<name>.blend     editable Blender scene
    docs/world/scenes/<name>.webp            Cycles render (the art reference)
    public/world/layouts/<name>.json         the same layout for the web agent

The layout file is the integration contract: every entry can be passed to the
engine's asset library as-is. Ground, sky and lighting in the .blend are for the
render only — the web engine has its own.

Run:  python tools/world/blender/scenes/<name>.py  [--samples N] [--size W] [--no-render]
"""

import json
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
sys.path.insert(0, os.path.join(HERE, ".."))
from ptw.kit import hex_to_linear  # noqa: E402

SRC = os.path.join(REPO, "assets-src", "world")


def g(x, y, z):
    return Vector((x, -z, y))


class Scene:
    def __init__(self, name):
        self.name = name
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.sc = bpy.context.scene
        self.sc.unit_settings.system = "METRIC"
        self.layout = []
        self.cache = {}

    # ---------------------------------------------------------------- assets
    def place(self, key, x, y, z, yaw=0.0, scale=1.0, note=None):
        """Put an asset in the scene. Coordinates and yaw are GAME space."""
        pack, aid = key.split("/")
        if key not in self.cache:
            path = os.path.join(SRC, pack, aid + ".blend")
            with bpy.data.libraries.load(path, link=False) as (src, dst):
                dst.objects = list(src.objects)
            objs = [o for o in dst.objects if o is not None]
            col = bpy.data.collections.new("src_" + key.replace("/", "_"))
            for o in objs:
                col.objects.link(o)
            self.cache[key] = (col, next(o for o in objs if o.name.split(".")[0] == aid and o.type == "EMPTY" and o.parent is None))
        col, root = self.cache[key]
        inst = bpy.data.objects.new(f"{aid}_{len(self.layout):03d}", None)
        inst.instance_type = "COLLECTION"
        inst.instance_collection = col
        inst.location = g(x, y, z)
        inst.rotation_euler = (0, 0, yaw)
        inst.scale = (scale, scale, scale)
        self.sc.collection.objects.link(inst)
        e = {"asset": key, "position": [round(x, 3), round(y, 3), round(z, 3)], "yaw": round(yaw, 4), "scale": round(scale, 3)}
        if note:
            e["note"] = note
        self.layout.append(e)
        return inst

    # ------------------------------------------------------- render-only set
    def ground(self, size=400, height=None, color=None, res=120, y=0.0):
        """A painted terrain for the render. height(x, z) and color(x, z, h) are game space."""
        bm_verts, faces, cols = [], [], []
        n = res
        for j in range(n + 1):
            for i in range(n + 1):
                x = -size / 2 + size * i / n
                z = -size / 2 + size * j / n
                h = height(x, z) if height else 0.0
                bm_verts.append(g(x, y + h, z))
                cols.append(hex_to_linear(color(x, z, h)) if color else hex_to_linear("#cbb486"))
        for j in range(n):
            for i in range(n):
                a = j * (n + 1) + i
                faces.append((a, a + n + 1, a + n + 2, a + 1))
        me = bpy.data.meshes.new("ground")
        me.from_pydata(bm_verts, [], faces)
        att = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
        att.data.foreach_set("color", [c for col in cols for c in (*col, 1.0)])
        for p in me.polygons:
            p.use_smooth = True
        ob = bpy.data.objects.new("ground", me)
        self.sc.collection.objects.link(ob)
        ob.data.materials.append(self._vcol_material("ground_mat", 1.0))
        return ob

    def water(self, x, z, w, d, y=0.0, color="#3f8f88", rough=0.08):
        bpy.ops.mesh.primitive_plane_add(size=1, location=g(x, y, z))
        ob = bpy.context.object
        ob.scale = (w, d, 1)
        m = bpy.data.materials.new("water")
        m.use_nodes = True
        b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        b.inputs["Base Color"].default_value = (*hex_to_linear(color), 1)
        b.inputs["Roughness"].default_value = rough
        # Ripples: a noise bump, so the sky breaks up on the surface.
        nt = m.node_tree
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = 3.5
        tex.inputs["Detail"].default_value = 6.0
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.22
        nt.links.new(tex.outputs[0], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
        ob.data.materials.append(m)
        return ob

    def _vcol_material(self, name, rough):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        b.inputs["Roughness"].default_value = rough
        a = nt.nodes.new("ShaderNodeVertexColor")
        a.layer_name = "Col"
        nt.links.new(a.outputs["Color"], b.inputs["Base Color"])
        return m

    def light(self, sun_dir=(-0.6, 0.45, 0.5), sun_color="#ffe2b4", sun_energy=4.2, sky_top="#7fb1c9", sky_horizon="#f1dcb8", sky_strength=1.0, sun_angle=2.5):
        """A warm key and a graded sky. sun_dir is the direction TO the sun, game space."""
        d = g(*sun_dir).normalized()
        sun_data = bpy.data.lights.new("sun", "SUN")
        sun_data.energy = sun_energy
        sun_data.angle = math.radians(sun_angle)
        sun_data.color = hex_to_linear(sun_color)
        sun = bpy.data.objects.new("sun", sun_data)
        sun.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        self.sc.collection.objects.link(sun)
        world = bpy.data.worlds.new("world")
        self.sc.world = world
        world.use_nodes = True
        nt = world.node_tree
        bg = next(n for n in nt.nodes if n.type == "BACKGROUND")
        geo = nt.nodes.new("ShaderNodeNewGeometry") if False else None
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        nt.links.new(tc.outputs["Generated"], sep.inputs[0])
        nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
        ramp.color_ramp.elements[0].position = 0.0
        ramp.color_ramp.elements[0].color = (*hex_to_linear(sky_horizon), 1)
        ramp.color_ramp.elements[1].position = 0.42
        ramp.color_ramp.elements[1].color = (*hex_to_linear(sky_top), 1)
        nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
        bg.inputs["Strength"].default_value = sky_strength
        del geo
        self.sun_dir = sun_dir

    def camera(self, pos, look, lens=35, fstop=None, focus=None):
        cam_data = bpy.data.cameras.new("camera")
        cam_data.lens = lens
        cam_data.clip_end = 2000
        cam = bpy.data.objects.new("camera", cam_data)
        cam.location = g(*pos)
        cam.rotation_euler = (g(*look) - g(*pos)).to_track_quat("-Z", "Y").to_euler()
        if fstop:
            cam_data.dof.use_dof = True
            cam_data.dof.aperture_fstop = fstop
            cam_data.dof.focus_distance = (g(*(focus or look)) - g(*pos)).length
        self.sc.collection.objects.link(cam)
        self.sc.camera = cam
        self.cam = {"position": list(pos), "look_at": list(look), "lens_mm": lens}

    def haze(self, density=0.004, color="#f1dcb8"):
        """Aerial perspective for the render: a thin volume over the whole scene."""
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 60))
        box = bpy.context.object
        box.scale = (900, 900, 140)
        m = bpy.data.materials.new("haze")
        m.use_nodes = True
        nt = m.node_tree
        for n in list(nt.nodes):
            if n.type != "OUTPUT_MATERIAL":
                nt.nodes.remove(n)
        out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
        vol = nt.nodes.new("ShaderNodeVolumeScatter")
        vol.inputs["Color"].default_value = (*hex_to_linear(color), 1)
        vol.inputs["Density"].default_value = density
        nt.links.new(vol.outputs[0], out.inputs["Volume"])
        box.data.materials.append(m)
        box.name = "haze"

    # ------------------------------------------------------------------ out
    def finish(self, argv=None, samples=160, size=1600, notes=None, extra=None):
        argv = sys.argv if argv is None else argv
        if "--samples" in argv:
            samples = int(argv[argv.index("--samples") + 1])
        if "--size" in argv:
            size = int(argv[argv.index("--size") + 1])
        blend = os.path.join(SRC, "scenes", self.name + ".blend")
        img = os.path.join(REPO, "docs", "world", "scenes", self.name + ".webp")
        lay = os.path.join(REPO, "public", "world", "layouts", self.name + ".json")
        for p in (blend, img, lay):
            os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(lay, "w", encoding="utf8") as f:
            json.dump({"scene": self.name, "space": "game: x left, y up, z forward (metres); yaw in radians about +y", "camera": getattr(self, "cam", None),
                       "sun_direction": list(getattr(self, "sun_dir", [])), "notes": notes or [], "extra": extra or {}, "placements": self.layout}, f, indent=1)
            f.write("\n")
        sc = self.sc
        sc.render.engine = "CYCLES"
        sc.cycles.device = "CPU"
        sc.cycles.samples = samples
        sc.cycles.volume_bounces = 0
        sc.cycles.max_bounces = 4
        try:
            sc.cycles.use_denoising = False
        except Exception:
            pass
        # Standard transform: the render shows the same colours the game will.
        sc.view_settings.view_transform = "Standard"
        sc.render.resolution_x = size
        sc.render.resolution_y = int(size * 9 / 16)
        sc.render.image_settings.file_format = "WEBP"
        sc.render.image_settings.quality = 88
        sc.render.filepath = img
        if "--no-render" not in argv:
            bpy.ops.render.render(write_still=True)
        bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
        print(f"[scene] {self.name}: {len(self.layout)} placements -> {os.path.relpath(lay, REPO)}")
