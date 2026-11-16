"""Build Pedal the World assets: .blend source + .glb + preview + manifest entry.

Inside Blender (Windows example, from the repository folder):

    "C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe" -b -P tools/world/blender/build.py -- murcia/bridge_segura

With the bpy Python module:

    python tools/world/blender/build.py murcia/bridge_segura

Arguments:
    <pack>/<id> ...   one or more assets            --all       every asset
    --seed N          override the asset's seed     --no-preview skip the render
    --samples N       preview samples (default 96)  --list      list assets and exit

Outputs (paths are part of the asset contract):
    assets-src/world/<pack>/<id>.blend      editable source
    public/world/assets/<pack>/<id>.glb     what the game loads
    docs/world/previews/<pack>/<id>.webp    Cycles preview
    public/world/assets/manifest.json       one entry per asset
"""

import hashlib
import importlib.util
import json
import math
import os
import sys
import time

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)

from ptw import CONTRACT_VERSION, Kit, hex_to_linear  # noqa: E402

ASSETS = os.path.join(HERE, "assets")
SRC_OUT = os.path.join(REPO, "assets-src", "world")
GLB_OUT = os.path.join(REPO, "public", "world", "assets")
PREVIEW_OUT = os.path.join(REPO, "docs", "world", "previews")
MANIFEST = os.path.join(GLB_OUT, "manifest.json")


def discover():
    found = []
    for pack in sorted(os.listdir(ASSETS)):
        d = os.path.join(ASSETS, pack)
        if not os.path.isdir(d) or pack.startswith("_"):
            continue
        for f in sorted(os.listdir(d)):
            if f.endswith(".py") and not f.startswith("_"):
                found.append(f"{pack}/{f[:-3]}")
    return found


def load_module(ref):
    path = os.path.join(ASSETS, *ref.split("/")) + ".py"
    spec = importlib.util.spec_from_file_location("ptw_asset_" + ref.replace("/", "_"), path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod, path


def export_glb(path):
    """Export with only the options the contract needs, tolerant of Blender versions."""
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    want = dict(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_vertex_color="NAME",
        export_vertex_color_name="Col",
        export_all_vertex_colors=False,
        export_active_vertex_color_when_no_material=True,
        export_image_format="AUTO",
        export_animations=True,
        use_selection=False,
    )
    bpy.ops.export_scene.gltf(**{k: v for k, v in want.items() if k in props or k == "filepath"})


def render_preview(path, kit, samples):
    sc = bpy.context.scene
    st = kit.stats()
    lo, hi = Vector(st["bounds_blender"][0]), Vector(st["bounds_blender"][1])
    centre = (lo + hi) / 2
    radius = max((hi - lo).length / 2, 0.5)

    temp = []
    cam_data = bpy.data.cameras.new("preview_cam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("preview_cam", cam_data)
    sc.collection.objects.link(cam)
    temp.append(cam)
    direction = Vector(kit.spec.get("preview_dir", (0.82, -1.0, 0.5))).normalized()
    fov = 2 * math.atan(18 / 50)  # vertical-ish, 36 mm sensor
    cam.location = centre + direction * (radius / math.tan(fov / 2) * 1.08)
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam

    sun_data = bpy.data.lights.new("preview_sun", "SUN")
    sun_data.energy = 3.4
    sun_data.angle = math.radians(3)
    sun_data.color = (1.0, 0.94, 0.84)
    sun = bpy.data.objects.new("preview_sun", sun_data)
    sun.rotation_euler = (math.radians(52), 0, math.radians(-38))
    sc.collection.objects.link(sun)
    temp.append(sun)

    world = sc.world or bpy.data.worlds.new("World")
    sc.world = world
    world.use_nodes = True
    bg = next((n for n in world.node_tree.nodes if n.type == "BACKGROUND"), None)
    if bg:
        bg.inputs[0].default_value = (*hex_to_linear("#dfe6e2"), 1)
        bg.inputs[1].default_value = 0.9

    ground_mat = bpy.data.materials.new("preview_ground")
    ground_mat.use_nodes = True
    b = next(n for n in ground_mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*hex_to_linear("#e5d6bb"), 1)
    b.inputs["Roughness"].default_value = 1.0
    bpy.ops.mesh.primitive_plane_add(size=600, location=(0, 0, float(kit.spec.get("ground_z", 0.0)) - 0.002))
    plane = bpy.context.object
    plane.data.materials.append(ground_mat)
    temp.append(plane)

    sc.render.engine = "CYCLES"
    sc.cycles.samples = samples
    try:
        sc.cycles.use_denoising = False
    except Exception:
        pass
    sc.view_settings.view_transform = "Standard"
    sc.render.resolution_x = 1200
    sc.render.resolution_y = 900
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "WEBP"
    sc.render.image_settings.quality = 86
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)

    for o in temp:
        bpy.data.objects.remove(o, do_unlink=True)
    sc.camera = None


def describe(obj):
    return {k[4:]: (list(v) if hasattr(v, "__len__") and not isinstance(v, str) else v) for k, v in obj.items() if k.startswith("ptw_")}


def build(ref, seed=None, preview=True, samples=96):
    t0 = time.time()
    mod, script = load_module(ref)
    spec = dict(mod.SPEC)
    pack, asset_id = ref.split("/")
    assert spec["id"] == asset_id and spec["pack"] == pack, f"SPEC id/pack must match the path {ref}"
    kit = Kit(spec, seed=seed)
    mod.build(kit)
    if not hasattr(kit, "meshes"):
        kit.finish()
    st = kit.stats()

    blend = os.path.join(SRC_OUT, pack, asset_id + ".blend")
    glb = os.path.join(GLB_OUT, pack, asset_id + ".glb")
    prev = os.path.join(PREVIEW_OUT, pack, asset_id + ".webp")
    for p in (blend, glb, prev):
        os.makedirs(os.path.dirname(p), exist_ok=True)

    export_glb(glb)
    if preview:
        render_preview(prev, kit, samples)
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)

    with open(glb, "rb") as f:
        data = f.read()
    lo, hi = st["bounds_blender"]
    entry = {
        "id": asset_id,
        "pack": pack,
        "class": kit.asset_class,
        "contract": CONTRACT_VERSION,
        "file": f"{pack}/{asset_id}.glb",
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "triangles": st["triangles"],
        "tri_budget": spec.get("tri_budget"),
        "materials": st["materials"],
        # Game space (glTF, +Y up): x = blender x, y = blender z, z = -blender y.
        "bounds": [[lo[0], lo[2], -hi[1]], [hi[0], hi[2], -lo[1]]],
        "origin": spec.get("origin", "ground-centre"),
        "seed": kit.seed,
        "params": kit.params,
        "colliders": len(kit.colliders),
        "anchors": sorted(a.name[7:] for a in kit.anchors),
        "parts": sorted(kit.nodes.keys()),
        "source": {"script": os.path.relpath(script, REPO).replace(os.sep, "/"), "blend": os.path.relpath(blend, REPO).replace(os.sep, "/")},
        "preview": os.path.relpath(prev, REPO).replace(os.sep, "/") if preview else None,
        "license": spec.get("license", "Original work for asensios.com — generated by the script in `source`. All rights reserved by the site owner."),
        "author": spec.get("author", "unknown"),
        "blender": bpy.app.version_string,
    }
    manifest = {"contract": CONTRACT_VERSION, "assets": {}}
    if os.path.exists(MANIFEST):
        with open(MANIFEST, encoding="utf8") as f:
            manifest = json.load(f)
    manifest["contract"] = CONTRACT_VERSION
    manifest["assets"][f"{pack}/{asset_id}"] = entry
    manifest["assets"] = dict(sorted(manifest["assets"].items()))
    with open(MANIFEST, "w", encoding="utf8") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print(f"[ptw] {ref}: {st['triangles']} tris, {len(data) / 1024:.1f} kB, {time.time() - t0:.1f}s")
    return entry


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    refs, seed, preview, samples = [], None, True, 96
    it = iter(argv)
    for a in it:
        if a == "--all":
            refs = discover()
        elif a == "--list":
            print("\n".join(discover()))
            return
        elif a == "--seed":
            seed = int(next(it))
        elif a == "--samples":
            samples = int(next(it))
        elif a == "--no-preview":
            preview = False
        elif not a.startswith("-"):
            refs.append(a.replace("\\", "/").removesuffix(".py"))
    if not refs:
        print(__doc__)
        return
    for ref in refs:
        build(ref, seed=seed, preview=preview, samples=samples)


if __name__ == "__main__":
    main()
