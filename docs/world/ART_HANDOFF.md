# Pedal the World — art handoff (cinematic packs)

Branch `claude/pedal-the-world-art`, cut from `4c24012`. It only **adds**: new asset
packs, reference scenes, layouts and one helper library. No engine file, no existing
asset and no existing script is modified. Rules and loading are unchanged — see
`ASSET_CONTRACT.md` and `WEB_HANDOFF.md`; this file covers only what is new.

## Merging this branch

- New folders only: `tools/world/blender/assets/*_v2/`, `tools/world/blender/scenes/`,
  `tools/world/blender/artlib.py`, `tools/world/blender/new_pack_stubs.py`,
  `assets-src/world/*_v2/`, `assets-src/world/scenes/`, `public/world/assets/*_v2/`,
  `public/world/layouts/`, `docs/world/previews/*_v2/`, `docs/world/scenes/`.
- Three shared generated files change and will conflict if the web branch also rebuilt
  assets: `public/world/assets/manifest.json` (take the **union** of `assets`),
  `docs/world/BUILD_REPORT.md` and `docs/world/build-report.json` (regenerate with
  `python tools/world/blender/build_all.py`, which skips everything up to date).
- `artlib.py` is not part of an asset's `source_hash`. After editing it, rebuild the v2
  packs with `build_all.py --pack <pack> --force`.

## How to use a layout

Every reference scene writes `public/world/layouts/<scene>.json`:

```
{ "placements": [ { "asset": "murcia_v2/church", "position": [x, y, z], "yaw": r, "scale": s, "note": … }, … ],
  "camera": { "position", "look_at", "lens_mm" }, "sun_direction": [x, y, z] }
```

Game space (x left, y up, z forward, metres, yaw in radians about +y) — the numbers go
straight into the existing loader:

```js
await assets.load([...new Set(layout.placements.map((p) => p.asset))]);
for (const p of layout.placements) {
  const [x, y, z] = p.position;                       // relative to the scene origin
  stamp(p.asset, ox + x, oz + z, p.yaw, { y: heightAt(ox + x, oz + z) + y, scale: p.scale });
}
```

`y` in a layout is an offset above the ground (floor tiles are sunk 2–5 cm so they do not
z-fight with terrain). Treat a layout as a starting composition: move the origin, drop
entries that collide with the route, keep the relationships.

The matching `.blend` (`assets-src/world/scenes/`) and render (`docs/world/scenes/`) are
the art reference. Their ground, sky, haze and sun are render-only.

## Murcia v2 — "Mediterranean Arrival"

Reference: `docs/world/scenes/murcia_arrival.webp`, layout `murcia_arrival.json`
(119 placements; plaza centre at the origin, church to the north facing +z, huerta to
the south). 21 new assets in `murcia_v2/`, all `batched`, all inside contract limits.

| Asset | Tris | Footprint (m) | Height | Use |
|---|---|---|---|---|
| `church` | 6 520 | 9 × 13 (front at z = 0, body behind) | 12.3 | closes the plaza; `ANCHOR_tower_site`, `door`, `plaza_side` |
| `church_tower` | 3 242 | 3.5 × 3.5 | 21 | at the church's tower site, or alone as a landmark; `ANCHOR_bell` |
| `arcade_house` | 7 217 | 10.5 × 6.5 | 11.5 | plaza side; arcade, balconies, blinds; `label_sign`, 2 lamps |
| `shop_house` | 5 540 | 6.4 × 5.4 | 8.3 | shop + awning + bougainvillea; `label_sign` |
| `bandstand` | 2 096 | ⌀ 7.2 | 6.6 | plaza centre; `ANCHOR_stage` (kind `poi`), `audience` |
| `cafe_terrace` | 2 216 | 8 × 5 | 2.6 | in front of an arcade; `label_board`, `seat` |
| `market_stall` | 2 187 | 3.7 × 2.6 | 2.6 | `label_price`, `customer` |
| `fountain_plaza` | 644 | ⌀ 5.5 | 3.7 | `ANCHOR_water` (emitter), `pool` |
| `plaza_paving` | 3 022 | 10 × 10 tile | 0.04 | plaza floor; tiles on `next_x` / `next_z` |
| `notice_board` | 484 | 2 × 0.5 | 2.6 | stand for a project card; `label_face` is 1.5 × 1.0 m |
| `laundry_line` | 340 | 5 long | 2.5 | between houses; the washing sways |
| `bougainvillea_pergola` | ~2 900 | 4.4 × 3 | 3.3 | shade with a bench; `seat`, `shade` |
| `olive_tree` | 1 366 | ⌀ 5 crown | 4.4 | dry ground, lane sides |
| `orange_tree` | ~1 500 | ⌀ 3 crown | 4 | plaza trees |
| `cypress_tall` | ~1 000 | ⌀ 1.6 | 9–10.5 | beside the church, cemeteries, hilltops |
| `prickly_pear` | 2 220 | ⌀ 2 | 2.2 | dry banks, walls |
| `river_reeds` | 1 240 | ⌀ 2 | 3–4 | along the river and channels |
| `noria` | 2 796 | wheel ⌀ 7.4, aqueduct 8.4 long | 7.6 | huerta landmark; `ANCHOR_hub`, `pour`, `view` |
| `acequia` | 580 | 1.8 × 10 tile | 1.5 | irrigation channel with sluice; tiles on `next` |
| `huerta_rows` | 2 508 | 10 × 10 tile | 0.6 | crop plots |
| `sierra_backdrop` | 1 200 | 78 long, 24 deep | 28 | horizon; scale 1.5–2.5, 150–200 m out |

Triangle counts marked ~ changed in the last refinement; exact values are in each
asset's `.json`.

### Inserting it in the Murcia chapter

The chapter (`chapters/murcia.js`) already has a plaza disc of radius 11 at `plaza`, a
procedural tower at `tower`, procedural palms, cypresses and pines, and a ring of old
town houses. Suggested replacement, in order of visual return:

1. **Plaza**: enlarge the plaza pad to radius ~16 and stamp the central part of the
   layout around `plaza` (everything within 20 m of the origin). Rotate the whole layout
   so its +z (the open side) faces the route as it arrives from the bridge.
2. **Tower**: delete the procedural tower/nave block and use `church` + `church_tower`.
   The bell logic only needs the new position (`ANCHOR_bell`); pigeons can stay.
3. **MWY story point**: move the ring of people to stand around `bandstand`
   (`ANCHOR_audience`), or put them on it (`ANCHOR_stage`).
4. **Story easels**: `notice_board` can replace the timber easels; draw the photo on
   `ANCHOR_label_face` (1.5 × 1.0 m).
5. **Vegetation**: replace procedural `cypress()` with `cypress_tall`, add `olive_tree`
   and `prickly_pear` on the dry north bank and hills, `orange_tree` in the plaza,
   `river_reeds` along both banks instead of the cone reeds.
6. **Huerta**: one `noria` beside the river on the south bank with a run of `acequia`
   leading away from it; `huerta_rows` plots in the gaps between lemon rows near the road.
7. **Horizon**: replace the ring of `sierras` icospheres with 6–8 `sierra_backdrop`
   pieces at radius 150–190 m, scale 1.7–2.0, each rotated to face the centre.

Budget note: the reference scene is about 218 k triangles before shadows. Use the
far lemon tree and keep `plaza_paving` to the visible square; drop `huerta_rows` first
on mobile tiers.

### Engine extensions these assets would benefit from (not implemented, not required)

- **Wheel spin for `noria`**: the wheel is part of one batched mesh. To turn it, either
  load it un-batched and rotate the whole asset's wheel sub-mesh, or accept it static
  (it reads well static). A hero-class variant with `PART_wheel` is a small follow-up.
- **Label anchors** (`kind: "label"`): shop signs, the notice board, the café board and
  the market stall expose a point and facing where text or a photo can be drawn.
- **Water anchors** (`kind: "water"` / `"emitter"`): fountain and channel surfaces are
  modelled flat in teal; the river shader could be reused on them.

## Europe v2 — "The Railway Journey"

Reference: `docs/world/scenes/europe_railway.webp`, layout `europe_railway.json`
(178 placements). No new train: the scene uses `vehicles/train_cab` + `train_coach` and
the existing `europe/` track, platform, masts and signals. The track is the z axis
(x = 0, rail top y = 0); the layout can be laid along any straight of the route.

| Asset | Tris | Size w × h × d (m) | Use |
|---|---|---|---|
| `station_building` | 6 872 | 24 × 11.5 × 8.2 | junction station: clock gable, slate roofs, brick arches. Origin at **platform level** (0.92 m above rail top), front = +z. `label_name`, `clock_front/back`, `door`, `platform_edge` |
| `station_canopy` | 790 | 22.8 × 4.3 × 4.3 | iron-and-timber platform canopy. **Same position and yaw as the building**; `light_a/b` |
| `platform_paving` | 1 052 | 6 × 1.8 × 10 tile | platform floor between `europe/rail_platform` and the station front; top y = 0, tiles on `next` |
| `signal_box` | 1 504 | 6.6 × 6.6 × 4.6 | lineside cabin with stair; `label_name` |
| `viaduct_arch` | 992 | 6.4 × 18 × 14 tile | one 14 m stone span, deck top = rail top, 17 m tall; tiles on `next`; `foot` marks the valley floor |
| `tunnel_portal` | 1 357 | 30 × 11 × 17.8 | stone mouth, dark modelled bore (9 m) and the hill it enters; track enters along −z; `track_in`, `track_out`, `label_plaque` |
| `meadow_hill` | 1 568 | 60 × 9.9 × 60 | painted field patchwork; overlap several, sink 1 m |
| `broadleaf_tree` | 1 752 | ⌀ 11 × 10.9 | field tree |
| `birch_tree` | 2 952 | ⌀ 5 × 12 | near the station, in groups |
| `spruce_tall` | 2 062 | ⌀ 7.5 × 15–18 | valley sides, above the tunnel |
| `hedgerow` | 884 | 2.6 × 2.5 × 10 tile | field boundaries |
| `alps_backdrop` | 1 232 | 78 × 32 × 24 | snow range in two layers; scale 2.6 at ~290 m and 4.2 at ~420 m |

Placement rules that matter:

- Station: put `rail_platform` tiles along the track, then `platform_paving` at x = 8.87
  (y = 0.92), then building + canopy at x = 12.5 (y = 0.92, yaw −π/2 for a station on the
  +x side). The ground behind the station must be raised to 0.92 or the building floats.
- Viaduct: the chapter terrain needs a valley at least 17 m deep under it
  (`heightAt` ≈ −17 at mid-span); pier feet are buried where the valley is shallower.
  The train simply keeps y = 0 — no engine change.
- Tunnel: the bore is closed and dark, so the train can just be hidden (or the chapter
  cut) once the cab passes `track_out`. Terrain must not rise through the mouth: keep
  ground ≤ 0 within 4 m of the track until 10 m behind the portal.
- Tree `y` values in the layout follow the render terrain; re-seat on `heightAt()`.
- **Cinematic viewpoint for the train's arrival**: the layout's `camera` block (66 m west
  of the line, 15 m up, looking up the valley, 24 mm). A short scripted camera hold here
  as the train leaves the tunnel is the highest-value shot of the chapter.

## Maritime v2 — "The Ocean Journey"

Reference: `docs/world/scenes/port_departure.webp`, layout `port_departure.json`
(79 placements). No new ship: the scene uses `vehicles/passenger_ship` and the existing
`maritime/` quay, lights, buoys and crates. Waterline y = 0; quay and pier decks y = 1.6.

| Asset | Tris | Size w × h × d (m) | Use |
|---|---|---|---|
| `lighthouse` | 2 272 | ⌀ 12 × 22 | mole-end light on a rock base; `light` (beam/flash source), `door` |
| `pier_section` | 992 | 4.6 × 5.8 × 10 tile | timber pier on braced piles, one side railed; `next`, `surface`, `mooring` |
| `pier_head` | 1 344 | 8.3 × 9.4 × 7.9 | pier end: beacon, bench, ladder, life ring; `view` (camera), `seat`, `light` |
| `harbour_office` | 2 950 | 12 × 12.6 × 8.2 | harbour master / ticket hall with lookout and signal mast; `label_sign`, `label_timetable`, `flag`, `door` |
| `breakwater` | 992 | 13.5 × 4.4 × 20 tile | rubble mole with walkway at y = 1.6; `next`, `surface` |
| `gangway` | 478 | 9 × 4.1 × 1.5 | quay → ship, rises 2.8 m (1.6 → the ship's 4.4 m deck); `foot`, `head` |
| `fishing_boat` | 640 | 3.2 × 6.2 × 8.5 | moored set dressing; `bob` (rock ±2°, 3 s), `light` |
| `dock_clutter` | 920 | 5.2 × 2 × 2.9 | pots, net rack, fish boxes, barrel |
| `deck_bench` | 284 | 1.9 × 1 × 0.7 | ship decks and pier; `seat` |
| `deck_vent` | 208 | 1 × 2.3 × 1.1 | cowl ventilator for the ship's upper deck (y = 9.8) |
| `coast_headland` | 3 220 | 61 × 19 × 35 | rock headland with pines; scale 1.4–1.6 behind the port, 2.2–2.6 across the bay |
| `horizon_islands` | 288 | 78 × 10 × 18 | pale far islands; scale 5.5–7.5 at 550–750 m |

Arrival and departure are the same layout: departure looks from the pier head back at
the ship (the layout camera); for arrival, put the camera on the ship's `bridge_view`
anchor heading in past the lighthouse with the pier to port.

### Ocean technique for the web (to implement in the engine — nothing here changes it)

The render's water is Cycles-only. What reads as "cinematic sea" there, and how to get
it cheaply in the existing Three.js renderer, in order of value:

1. **One large plane, vertex-displaced in the vertex shader.** Sum of 3–4 Gerstner waves
   (wavelengths ≈ 60, 31, 18, 9 m; steepness 0.10–0.18; directions within ±25° of the
   wind). ~128 × 128 grid following the camera, snapped to the grid spacing so it does
   not swim. Amplitude ≤ 0.5 m in harbour, 1.2 m at sea. Expose the same function in JS
   as `seaHeightAt(x, z, t)` so the ship and `fishing_boat` (`ANCHOR_bob`) can ride it.
2. **Colour from depth and view angle, not a texture.** Deep `#17586c`, shallow
   `#3f9f9a`, mixed by a `depth` vertex attribute or distance from shore; Fresnel
   (`pow(1 − N·V, 4)`) mixes toward the sky's horizon colour. This single term is what
   makes the horizon line disappear into the haze as in the reference.
3. **Sun glitter.** A tight Blinn–Phong highlight (shininess ~200) on normals perturbed
   by two scrolling analytic ripples; no normal map needed.
4. **Foam where it matters only.** A soft white band where `depth < 0.6 m` (quay face,
   breakwater rocks, hull waterline), animated with the wave phase; plus a wake: a
   fading triangle-strip ribbon behind the ship's `stern` anchor.
5. **Horizon.** Extend the plane to the fog distance and let the existing atmosphere fog
   it; `horizon_islands` sit just inside the far plane and should receive full fog.

No reflections, no render targets, no extra passes — it stays inside the current
performance tiers. Low tier: steps 2 and 5 only (flat plane).

## Asia v2 — "Arrival"

Reference: `docs/world/scenes/asia_arrival.webp`, layout `asia_arrival.json`
(99 placements, ~73 k triangles). No new aircraft: `vehicles/airliner` at the origin,
nose +z, with the existing `asia/` bays, jet bridges, carts and lights. The set is a
modern airport on purpose — it is honest for any arrival on the continent and borrows no
symbol from any one country. The skyline is generic slabs; nothing in it is a real
building.

| Asset | Tris | Size w × h × d (m) | Use |
|---|---|---|---|
| `control_tower` | 1 680 | 12.5 × 32.7 × 14.2 | landmark; `beacon` (red flash), `cab_view`, `radar` |
| `terminal_hall` | 1 748 | 42 × 10.9 × 21 | wave-roof hall, glass front = +z; `label_sign` (8.6 × 0.8 m), `door_a/b` (lit) |
| `apron_tile` | 256 | 20 × 20 tile | concrete bays, lead-in line along z; sink 3 cm; `next_x`, `next_z` |
| `airstairs` | 924 | 7.7 × 4.2 × 2.7 | mobile stairs; `top` meets the airliner's `door_front`; `foot` |
| `pushback_tug` | 608 | 3.8 × 1.8 × 8 | at the nose; `tow`, `beacon` (amber flash) |
| `windsock` | 208 | 3.2 × 6.4 | sways with the wind uniform |
| `rain_tree` | 2 252 | ⌀ 25 × 12 | broad shade tree for the landside edge |
| `skyline_backdrop` | 1 396 | 76 × 34 × 15 | three hazy depths; scale 6.5 at ~900 m, 4 at ~640 m |

Placement: airstairs at (7.1, 0, 13.9) yaw π relative to the aircraft; tug at (0.3, 0, 27)
yaw π. The arrival beat that works: camera low on the apron off the nose (layout
`camera`), sun just above the terminal roof behind the tail, warm haze — the aircraft
rim-lit, the city only a silhouette.

## Chile v2 — "Between the Andes and the valley"

Reference: `docs/world/scenes/chile_arrival.webp`, layout `chile_arrival.json`
(122 placements, ~183 k triangles — 51 of them vineyard tiles; halve those on low tiers).
Uses the existing `vehicles/coach_bus`, `chile/rock_outcrop` and `tussock_grass`.

| Asset | Tris | Size w × h × d (m) | Use |
|---|---|---|---|
| `cordillera_backdrop` | 1 472 | 78 × 31 × 23 | the Andes in two ranges; **scale 14 at ~1250 m** |
| `foothill_ridge` | 828 | 78 × 14.6 × 16 | dry folded precordillera; scale 6.5 at ~860 m, 2.6 for side ridges |
| `city_basin_backdrop` | 1 028 | 77 × 9.3 × 15 | pale city in the basin haze; scale 3.4 at ~520 m |
| `vineyard_rows` | 2 312 | 20 × 20 tile | trellised vines, rows along z; lay at 21.5 m pitch to leave tracks |
| `poplar_row` | 840 | 3.4 × 18 × 16 tile | windbreak of five; along roads and field edges |
| `espino_tree` | 584 | ⌀ 7 × 4.4 | thorn tree for dry slopes |
| `adobe_house` | 4 512 | 14.8 × 5.9 × 10.4 | farmhouse with posted corridor on +z; `door`, `seat`, `label_sign` |
| `lookout_terrace` | 673 | 13 × 4.2 × 6.6 | half-round mirador, open to +z; `view` (camera), `label_board` (1.6 × 0.6 m, tilted), `seat`, `poi` |

Depth is the whole composition: four planes (lookout → valley 42 m below → city and
foothills → snow), each paler than the one before. If the engine's far plane is shorter
than 1300 m, bring the three backdrops in by the same factor and scale them by it —
angular size is what must be preserved (the snow wall should reach ~17° above the
horizon). The lookout is a natural story point: `label_board` takes a project panel.

## Lighting used in the references

`sun_direction` in each layout is the direction **to** the sun in game space.

| Scene | Sun (to) | Sun colour | Sky top → horizon | Fog / haze colour |
|---|---|---|---|---|
| Murcia, golden hour | (0.70, 0.36, 0.62) | `#ffdcae` | `#5f9fc9` → `#f8e2b8` | `#f6e4c0`, light |
| Europe, clear afternoon | (−0.62, 0.48, −0.50) | `#fff0d4` | `#4a8fc8` → `#e4eef2` | `#dfeaf0`, light, cool |
| Port, early morning | (−0.55, 0.26, 0.62) | `#ffdcb2` | `#5b9ccb` → `#f6dcc0` | `#f1e2d2`, light |
| Asia, dawn | (−0.80, 0.17, −0.42) | `#ffc88e` | `#6f9fc6` → `#ffd8ae` | `#ffe3c4`, **dense** (humid) |
| Chile, evening | (0.42, 0.30, −0.86) | `#ffd2a0` | `#5f97c9` → `#f3dcc6` | `#ecdcc6`, light, long range |

Rules that carry the look into the engine: keep the sun low (elevation 10–28°) so façades
and trees model; set fog colour to the horizon colour, never grey; every backdrop asset
already has haze painted into its far layers, so do not tint them again — just let fog
take them.

## Which techniques paid for themselves

| Technique | Visual gain | Cost | Verdict |
|---|---|---|---|
| Layered backdrops with haze painted into vertex colour | very high | ~1–1.5 k tris each, no engine work | used in every scene |
| Composition from a fixed viewpoint (layout + camera) | very high | none at runtime | the main deliverable |
| Gridded walls with per-vertex paint (stains, damp, sun-bleach) | high | ~1 k tris per building | all buildings |
| Cycles AO baked into `Col` | high | build time only | everything except backdrops and floors |
| Coursed roofs with per-tile colour | high | 1.5–3 k tris per roof | hero buildings only |
| Multi-clump foliage with `sway` in alpha | high | 0.6–3 k tris per tree | all trees |
| Modular tiles (`next` anchors): viaduct, pier, quay, paving, apron, vines | high | none | wherever a thing repeats |
| Relief on openings (surrounds, sills, arches) | medium | 30–60 tris per window | fronts only (`detail=0` at the back) |
| LODs | medium | doubles assets | **not done** — backdrops and layouts make it unnecessary for now; see below |
| Ambient motion parts (noria wheel, radar, boat bob) | medium | needs engine support | exposed as anchors only |

## Limits and honest caveats

- Everything is `batched` class: vertex colour, no textures, no moving parts. Nothing in
  these packs animates by itself except foliage/cloth sway through the existing shader.
- Renders are Cycles stills. They prove composition, palette and light, not frame rate;
  nothing here has been run in the web engine or on a GPU.
- No LODs. Trees over ~2 k triangles (`birch_tree`, `rain_tree`, `spruce_tall`,
  `broadleaf_tree`) should be used in tens, not hundreds; use the older `europe/conifer`
  and `murcia/lemon_tree` for mass planting.
- Tree and prop heights in layouts follow each scene's render terrain; re-seat with
  `heightAt()`.
- The rider, passengers and crew are not modelled (the engine draws people).
- `airstairs` treads and `deck_vent` are simple close up; fine at play distance.
- Backdrops are one-sided compositions: face their local +z toward the viewer.

## Proposed contract extensions (proposals only — contract v1 is unchanged)

1. `ptw_kind: "spin" | "float"` on anchors (already emitted on `control_tower.radar`,
   `fishing_boat.bob`) → engine-side ambient motion for batched assets loaded un-batched.
2. `ptw_kind: "label"` with `width` / `height` props → a standard way to draw text or a
   project image on signs and boards.
3. A `backdrop` class: exempt from the 80 m size limit, never collides, drawn with fog
   but without shadows. It would let the ranges be single wide meshes instead of scaled.
4. An optional `lod1` file per asset (`<id>.lod1.glb`), ignored by v1 loaders.

## Actions for the web agent

1. Merge note above (manifest = union; regenerate the two reports).
2. Load a layout, stamp it at the chapter's set-piece location, re-seat `y` on terrain.
3. Europe: carve the valley and raise the station pad as described; add the camera hold.
4. Sea: implement the ocean steps (2 and 5 first), expose `seaHeightAt`.
5. Asia / Chile: set far plane and fog so the backdrops hold their angular size.
6. Apply the lighting table per chapter.
7. Optional: label drawing on `kind: "label"` anchors for project story points.
