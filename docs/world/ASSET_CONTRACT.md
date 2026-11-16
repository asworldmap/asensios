# Pedal the World — Asset Contract v1

The stable interface between whoever makes 3D assets and whoever puts them in the
game. If an asset obeys this document and passes `tools/world/validate.mjs`, the web
side can load it without reading how it was made. You do not need to know the rest of
the application to produce assets.

**The validator is the acceptance test.** `node tools/world/validate.mjs` must print
`PASS` for your asset. Rules below marked **[V]** are checked by it.

## 1. Deliverables per asset

| What | Where | Notes |
|---|---|---|
| Generator script | `tools/world/blender/assets/<pack>/<id>.py` | Python + `bpy`, uses the `ptw` kit |
| Editable source | `assets-src/world/<pack>/<id>.blend` | written by the builder |
| Game file | `public/world/assets/<pack>/<id>.glb` | **[V]** single self-contained GLB |
| Asset manifest | `public/world/assets/<pack>/<id>.json` | machine-readable, written by the builder |
| Preview | `docs/world/previews/<pack>/<id>.webp` | Cycles render, written by the builder |
| Index entry | `public/world/assets/manifest.json` | written by the builder |

Never hand-edit a `.glb`, a `.json` or the manifest: the validator compares hashes **[V]**.
`<pack>` and `<id>` are `lower_snake_case`, 2–40 characters **[V]**. Files whose name
starts with `_` are shared helpers, not assets.

Build one asset, or everything that is out of date:

```
python tools/world/blender/build.py <pack>/<id>
python tools/world/blender/build_all.py            # add --blender "<path to blender.exe>" to use a normal Blender
node tools/world/validate.mjs
```

## 2. Units, axes, orientation

- 1 Blender unit = 1 metre. Apply all transforms; every node scale is 1 **[V]**.
- **Blender: Z up, the asset faces −Y.** The exporter converts to glTF/Three.js:
  **Y up, the asset faces +Z**, and +X is the asset's left.
  `game (x, y, z) = blender (x, z, −y)`.
- The `ptw.parts.g(x, y, z)` helper lets a script think in game space.
- The scene has exactly one root: an empty named `<id>` with an identity transform **[V]**.
- Origin = the placement point. Default: on the ground, at the footprint centre.
  Vehicles: ground (or rail top / waterline) under the body centre. Exceptions are
  stated in the asset manifest (`origin`, `meta.origin`).
- Size sanity: 5 cm – 80 m across **[V]**.

## 3. Two classes

| | `batched` | `hero` |
|---|---|---|
| For | scenery, props, buildings, vegetation | vehicles, characters |
| In the engine | merged into the chapter's static meshes, or instanced | kept as a scene graph, parts animated |
| Textures | none **[V]** | ≤ 4, ≤ 1024², PNG/JPEG/WebP, embedded **[V]** |
| Triangles | ≤ 8 000 **[V]** (and ≤ `tri_budget` in its SPEC) | ≤ 20 000 **[V]** |
| File size | ≤ 450 kB **[V]** | ≤ 1.5 MB **[V]** |
| `PART_*` nodes | not allowed **[V]** | yes |
| Animations | not allowed **[V]** | optional, clip names `lower_snake_case` **[V]** |

Guideline budgets inside those limits: small prop ≤ 500, tree ≤ 1 500, building ≤ 4 000.

## 4. Materials and colour

- Only materials from the surface library, named `M_<surface>` **[V]**:
  `stone plaster terracotta wood earth foliage metal paint rubber cloth skin window glow glass`.
- **Colour is vertex colour.** Paint the attribute `Col` (exported as `COLOR_0`); the
  material's base colour stays white. Batched assets must have `COLOR_0` **[V]**.
  The builder bakes ambient occlusion (Cycles) into `Col`, so shading detail costs no
  texture. Values are linear.
- `COLOR_0` alpha is the wind weight: **sway = 1 − alpha**. Leave alpha at 1 for rigid
  things; vegetation on `M_foliage` uses lower alpha toward the tips.
- Special surfaces: `M_window` = glazing the engine lights at night; `M_glow` = lamps,
  rendered unlit; `M_glass` = the only translucent surface, hero assets only **[V]**
  (`alphaMode BLEND`). Everything else is opaque **[V]**.
- The engine renders with one lighting model (Lambert); roughness/metallic values are
  exported for tools and previews but do not vary the in-game look. Do not rely on
  Blender shader nodes: only what glTF carries survives.
- Shared palette for vehicles lives in `ptw/parts.py` (cream, deep green, terracotta,
  mustard, steel). Use it so new assets match.
- Backface culling on, except real two-sided sheets (warning otherwise).

## 5. Nodes with meaning

| Prefix | Is | Required data (custom properties → glTF `extras`) |
|---|---|---|
| `PART_<name>` | an animated pivot (empty) with its mesh as a child `PART_<name>_mesh` | `ptw_role`, `ptw_axis`; optional `ptw_radius`, `ptw_limit_deg`, `ptw_travel`, `ptw_hinge` |
| `COL_circle_NN` | circle collider on the ground plane (empty) | `ptw_collider="circle"`, `ptw_radius` **[V]** |
| `COL_segment_NN` | wall collider (empty) | `ptw_collider="segment"`, `ptw_radius`, `ptw_a`, `ptw_b` as `[x, y]` in **Blender** space **[V]** |
| `ANCHOR_<name>` | a named point: lights, boarding points, camera seats, couplers (empty) **[V]** | optional `ptw_kind` (`lamp`, `headlight`, `boarding`, `label`, …) |

Rules for parts:

- The pivot is the node's origin. The engine rotates or slides the node; children follow.
- `ptw_axis` is in game space: `"x"` (wheels: the axle), `"y"` (steering, rudders,
  swing doors), `"z"` (sliding doors, fans, propellers), or `"hinge"` with
  `ptw_hinge = [x, y, z]` for hinges that follow a swept edge (ailerons, the bike's fork).
- Rest pose = the pose in the file: doors closed, gear down, wheels straight.
- Standard roles: `wheel steer bogie door crank pedal pantograph fan flap aileron
  elevator rudder landing_gear propeller radar gangway flag steering_wheel
  rider_torso rider_head rider_shoe`.
- A `ANCHOR_light_NN` with `ptw_kind="lamp"` marks where the engine puts a night light pool.
- No cameras, lights, skins or morph targets in the file **[V]**.

Use the kit and these are written for you: `k.node(name, at, parent, role=, axis=, …)`,
`k.collider(x, y, r)`, `k.wall(a, b, r)`, `k.anchor(name, at, kind=)`.

## 6. The asset manifest (`<id>.json`)

Written by the builder; the same object is the asset's entry in `manifest.json`.

```
id, pack, class, contract, file, bytes, sha256, triangles, tri_budget, materials,
bounds [[min xyz],[max xyz]]   game space
origin, forward, seed, params, meta   meta = vehicle dimensions, decks, chapter…
colliders (count), anchors [names], parts [node names]
rig [ { name, node, pivot [x,y,z] game space, parent?, role, axis, radius?, limit_deg?, … } ]
source { script, blend }, source_hash, preview, license, author, blender
import_check { objects, meshes, vertices }   result of loading the .glb back into Blender
```

## 7. Scripts: the shape of one

```python
SPEC = {"id": "my_asset", "pack": "europe", "asset_class": "batched",
        "author": "…", "seed": 7, "tri_budget": 1500}

def build(k):                      # k is ptw.Kit
    o = k.bbox("body", (1, 2, 1), (0, 0, 0.5), "stone", bevel=0.05)
    k.paint(o, "#cdb48a", jitter=0.05)
    k.collider(0, 0, 0.8)
    k.finish()                     # joins, bakes AO, tags the root
```

Reproducibility: use `k.rng` (seeded from `SPEC["seed"]`) for every random choice; the
same script and seed must give the same asset. Parameters go in `SPEC["params"]`.
Licences: every asset must be original work or carry its licence in `SPEC["license"]`;
do not import third-party models or textures without recording their source.

## 8. Acceptance checklist

1. `python tools/world/blender/build_all.py` reports the asset as `built` or `skipped`.
2. `node tools/world/validate.mjs` prints `PASS` for it, with no errors.
3. `docs/world/BUILD_REPORT.md` shows a re-import mesh count for it.
4. The preview looks like the thing, at the right scale next to a 1.8 m rider.
5. Only files under `tools/world/blender/assets/`, `assets-src/world/`,
   `public/world/assets/` and `docs/world/previews/` changed. The asset agent does not
   edit `src/`.
