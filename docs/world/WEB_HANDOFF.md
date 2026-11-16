# Pedal the World — handoff to the web agent

State of branch `claude/pedal-the-world-engine` (derived from `claude/pedal-the-world`).
Nothing here is merged or deployed. Read `ASSET_CONTRACT.md` for the rules; this file
is what exists and what is left.

## 1. What exists

44 assets, all built by script, all passing the contract validator, all re-imported
into Blender as a check (`BUILD_REPORT.md`). Total 4.3 MB of GLB (vehicles 2.5 MB).

**Vehicles** (`hero`, `public/world/assets/vehicles/`):

| Chapter | Asset | Tris | Size | Size in metres (L × W × H) |
|---|---|---|---|---|
| Murcia | `city_bike` (with rider) | 5 028 | 210 kB | 1.8 × 0.6 × 1.8 |
| Europe | `train_cab` | 5 928 | 325 kB | 17.2 × 2.86 × 3.92 |
| Europe | `train_coach` | 5 308 | 293 kB | 17.2 × 2.86 × 3.92 |
| Europe | `coach_bus` | 9 962 | 593 kB | 12.2 × 2.55 × 3.56 |
| Asia | `airliner` | 4 700 | 282 kB | 36 long, 34 span, 11.6 tall |
| Asia (Japan, sea) | `passenger_ship` | 13 936 | 773 kB | 62 × 10.5, decks at 4.4 / 7.15 / 9.8 |

**Kits** (`batched`, triangles in brackets):

- `murcia/`: bridge_segura (3616), townhouse_a/b/c (2436/3312/2272), farmhouse (2620),
  lemon_tree (1248), lemon_tree_far (260), palm_tree (360), stone_wall (924),
  fountain (332), orange_crate (224)
- `europe/`: rail_track_straight (286), rail_platform (188), station_shelter (472),
  rail_signal (468), catenary_mast (100), conifer (204), road_guardrail (156), road_sign (156)
- `asia/`: terminal_bay (452), jet_bridge (604), baggage_cart (1024), runway_light (136),
  bamboo_clump (1260)
- `maritime/`: quay_section (296), harbour_light (636), mooring_buoy (216), deck_chair (236),
  life_ring_stand (232), cargo_crate (188)
- `chile/`: andes_peak (270), rock_outcrop (400), araucaria (1182), tussock_grass (192)
- `common/`: street_lamp (136), park_bench (412), planter (272), signpost (152)

## 2. Where things are

| | |
|---|---|
| Game files | `public/world/assets/<pack>/<id>.glb` |
| Per-asset manifest (rig, anchors, meta) | `public/world/assets/<pack>/<id>.json` |
| Index of everything | `public/world/assets/manifest.json` |
| Editable Blender sources | `assets-src/world/<pack>/<id>.blend` |
| Generators | `tools/world/blender/assets/<pack>/` (`_*.py` are shared builders) |
| Kit | `tools/world/blender/ptw/` (`kit.py`, `parts.py`) |
| Previews | `docs/world/previews/<pack>/<id>.webp` |

## 3. Regenerating

```
pip install bpy                                    # Blender 5.3 as a Python module
python tools/world/blender/build_all.py            # builds only what changed
python tools/world/blender/build_all.py --force vehicles/airliner
node tools/world/validate.mjs
```

On Windows with a normal Blender install, add
`--blender "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe"`.
Open any `.blend` in `assets-src/` to inspect or hand-edit, but a hand edit is lost on
the next rebuild — change the script instead. Seeds are fixed; output is deterministic.

## 4. Scale, axes, pivots

1 unit = 1 m. glTF/Three.js: +Y up, **vehicles face +Z**, +X is the vehicle's left.
Root node = asset id, identity transform. Origin per vehicle: bike, bus, airliner on
the ground under the body; train on the rail top; ship on the waterline amidships.
Every animated part is a node `PART_<name>` whose origin is the pivot; exact pivots
(game space), axes and limits are in each `<id>.json` under `rig`.

## 5. Animatable parts

`[x]` = rotate about the node's X (axles), `[y]` vertical axis, `[z]` longitudinal,
`[hinge]` = rotate about the vector in `rig[].hinge`.

- **city_bike**: wheel_front, wheel_rear `[x]`; steer `[hinge]` (wheel_front is its
  child); crank `[x]`; pedal_l/r and shoe_l/r (placed by the engine); torso, head.
  Arms and legs are *not* in the asset: `src/world/vehicles/bicycle.js` draws them with
  two-bone IK. This one is already integrated and animated.
- **train_cab / train_coach**: bogie_front, bogie_rear `[y]`; wheelset_front1/2,
  wheelset_rear1/2 `[x]` (children of the bogies, radius 0.46); door_l1, l2, r1, r2
  slide `[z]` (`travel` 1.25 m, direction in `opens`); pantograph `[x]` (cab only).
  Couple cars at `ANCHOR_coupler_front/rear`; pitch 17.92 m. A train = cab + n coaches
  + a second cab rotated 180°.
- **coach_bus**: steer_fl, steer_fr `[y]` (±38°) with wheel_fl, wheel_fr `[x]` as
  children; wheel_rl, wheel_rr `[x]` (twin); door_front, door_mid `[y]` on the −X side;
  steering_wheel `[z]`. Wheelbase 7.1 m, track 2.08 m, wheel radius 0.5.
- **airliner**: fan_l/r `[z]`; flap_l/r, aileron_l/r, elevator_l/r, rudder `[hinge]`;
  gear_nose `[x]` (retracts forward, 95°), gear_main_l/r `[z]` (retract inboard, 84°)
  with wheel_nose, wheel_main_l/r `[x]`; door_front_l/r, door_rear_l/r `[y]`.
  File pose is gear down, on the ground. Port (+X) light is red.
- **passenger_ship**: rudder `[y]`, propeller `[z]`, radar `[y]`, flag `[y]`,
  gangway `[z]`, door_l1/l2/r1/r2 `[y]`. Walkable decks and their extents are in
  `meta.decks`; the four `COL_segment` colliders are the main-deck house walls.

Anchors worth knowing: `headlight_*`, `taillight_*`, `driver_view`, `cab_view`,
`cockpit_view`, `bridge_view`, `deck_spawn`, `door_*` / `gangway_foot` (boarding),
`chase` (a good exterior camera), `coupler_*`.

## 6. Which asset for which chapter

| Chapter | Vehicle | Kits |
|---|---|---|
| Murcia | `city_bike` | `murcia/`, `common/` |
| Europe | `train_cab` + `train_coach`; `coach_bus` for the road leg | `europe/`, `common/` |
| Asia | `airliner` | `asia/`, `common/` |
| Japan / sea | `passenger_ship` | `maritime/` |
| Chile | none yet (cinematic arrival; the airliner can serve) | `chile/`, `common/` |

Chapter content (places, dates, what happened where) is **not** in these assets and must
come from verified facts. The kits are generic on purpose.

## 7. Instancing

All `batched` assets can be merged or instanced. The engine already does this:
`assets.stamp(key, batches, matrix, { tint })` in `src/world/assets.js` merges an asset
into a chapter's static/vegetation/window/glow batches and returns its colliders and
anchors in world space. For hundreds of copies of one asset (track, trees, rails) an
`InstancedMesh` per material is the alternative. Modular pieces carry `ANCHOR_next`
(10 m for rail/platform/quay/terminal, 4 m for wall/guardrail). Rail top is y = 0;
platform top is 0.92 m above it; quay top is 1.6 m above the waterline; the jet bridge
sill (3.55 m) matches the airliner door.

## 8. What the web agent has to do

1. **Train**: `src/world/vehicles/train.js` still builds placeholder boxes. Replace the
   model with `train_cab` + `train_coach` instances (`assets.instance(key)` returns
   `{ scene, nodes }`); spin `wheelset_*`, yaw `bogie_*` to the track.
2. **Bus, airliner, ship**: no controller exists. Add `vehicles/<id>.js` implementing
   the interface documented at the top of `src/world/vehicles/index.js`, and register it.
3. **Hero materials**: `assets.js` converts hero materials to Lambert; `M_glass` is
   already made translucent there. The bus interior has not been looked at in-engine.
4. **Chapters**: `src/world/chapters/index.js` lists `europe`, `asia`, `chile` as
   planned. Each is a module returning the `world` object described there.
5. **Murcia**: the new `murcia/palm_tree`, `stone_wall`, `fountain` and `common/*`
   are not placed yet; palms, walls and lamps in `chapters/murcia.js` are still the old
   procedural ones.
6. Keep `tests/world/` green (needs Playwright and `npm run preview`): `desktop.mjs`,
   `mobile-and-fallbacks.mjs`, `assets.mjs`. `npm test` runs the asset validator and its
   negative tests without a browser.

## 9. Validated

- 44/44: built from script, contract validator pass, GLB re-imported into Blender 5.3.
- `tests/world/validate.test.mjs`: the validator rejects 8 kinds of contract violation.
- `tests/world/assets.mjs` (headless Chromium, software GL): all 44 assets load through
  the engine's asset library; every hero asset exposes every `PART_` node its manifest
  lists; the rail lab chapter loads with the train, which accelerates and stays on its
  route; going back to Murcia leaks no geometries or textures; no console errors.
- `tests/world/desktop.mjs` 21/21 and `mobile-and-fallbacks.mjs` 12/12 on this engine:
  story, cards, driving, collisions, lemons, river respawn, map, modes, ES/EN, touch,
  reduced motion, no-WebGL and plain fallbacks.
- Every asset has a Cycles preview that was looked at for gross defects.
- `npm run build` and `npm test` pass.

## 10. Not validated / open problems

- **Only the bike and the first seven Murcia assets are placed in a scene.** The other
  36 load in the engine but have never been seen in-game; expect small placement and
  scale adjustments when they are first used.
- No real-device frame rate has been measured (the build machine has no GPU). Murcia now
  draws about 170 k triangles per pass at full quality, up from about 100 k in the first
  prototype; check a mid-range phone before adding more.
- Before/after screenshots of Murcia were not produced in the end.
- No LOD variants except `lemon_tree_far`. Vehicles have a single level of detail.
- No baked animations: all motion is engine-driven through `PART_*` nodes.
- The ship's colliders describe the main deck only; upper decks need per-deck bounds
  from `meta.decks`.
- GLBs are uncompressed float data. `KHR_mesh_quantization` (no decoder needed) is
  allowed by the validator and would cut size substantially; not applied yet.
- Vehicle liveries are one shared scheme; there are no alternates. Small visual debts:
  the fountain's water reads as stone, the signpost shows two of its three boards.
- `docs/PEDAL-THE-WORLD.md` describes the earlier prototype engine, not this one.
