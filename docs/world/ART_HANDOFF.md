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

Budget note: the reference scene is about 190 k triangles before shadows. Use the
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
