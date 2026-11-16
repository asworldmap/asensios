# Pedal the World — journey director

Branch `claude/pedal-the-world-journey`, cut from the art branch at `3478d70`. It adds
five transitions that join the six stages into one trip. No engine file, chapter,
vehicle, test or existing asset is touched.

**One journey, in this order** (it replaces the earlier one — `japan` and `asia` swap):

| # | Chapter id | Vehicle | Leaves by |
|---|---|---|---|
| 1 | `murcia` | bicycle | t01 · the wheel |
| 2 | `europe` | train | t02 · through the station |
| 3 | `europe-bus` | bus | t03 · the horizon |
| 4 | `japan` | ship | t04 · two lights |
| 5 | `asia` | airplane (departure toward Chile) | t05 · through the cloud |
| 6 | `chile` | bicycle | — the journey closes here |

The thread is hospitality: at every hand-over somebody is waiting — on the platform, at
the bus door, on the pier, at the lookout. That is staged with the engine's people on
existing `boarding` / `seat` / `poi` anchors, not with text.

## What is in this branch

| File | What it is |
|---|---|
| `public/world/journey/sequences.json` | **the deliverable**: order, camera keys, splices, loading moments, sound cues, reduced-motion and no-WebGL behaviour for the five transitions |
| `tools/world/blender/scenes/journey.py` | the generator: declares the sequences, rebuilds each splice in Blender from existing assets, renders the stills, writes the JSON. Edit here, never the JSON |
| `docs/world/journey/*.webp` | 14 small verification stills (800 × 450, one per verified key). Proof of framing, not final art |
| `public/world/assets/journey/cloud_bank.glb`, `cloud_sea.glb` | the only new assets (t05). Contract v1, `batched`, 107 assets in the manifest now |

Everything else comes from the existing library and the five layouts in
`public/world/layouts/` (see `ART_HANDOFF.md` for those).

## The five transitions

Each is one shape handed from one vehicle to the next. Frames named below are in
`docs/world/journey/`.

**t01 · bicycle → train · the wheel · 9 s.** The lane ends beside a country halt (a
small set of existing Murcia and rail pieces, listed in `set.placements`). The camera
drops to where the bicycle's rear wheel meets the ground (`t01_a1`); directly behind it a
train wheel rests on its rail. The bicycle is wheeled away, the camera pushes in 3.4 m
(`t01_a2`) and the same framing on the playable train is the first frame of Europe
(`t01_b0`). *Limit found while verifying:* the train's wheels sit inside the bogie frame
and only their lower half shows, so the match is the contact point, not a full circle.

**t02 · train → bus · through the station · 12 s.** The train stops; the camera leaves
by the window line (`t02_a1`), crosses the platform to the station door (`t02_a2`), and
comes out of the street door to find the coach waiting (`t02_b0`). Seated, the last thing
in the window is the station clock from the other side (`t02_b1`). The dark of the hall
is the splice. Needs `europe_v2/station_building` stamped at the end of the rail route
**and** at the start of the bus route (street face to the road; bus pose given
station-local).

**t03 · bus → ship · the horizon · 11 s.** An ellipsis, and it says so. The camera stops
following the bus and cranes up until the road runs to a clean horizon (`t03_a1`). On
the held frame one hairline is drawn along the horizon, dashed over its middle third —
the jump. The same line is then the sea, and the road's place in the frame is taken by
the ship's deck (`t03_b0`). No map, no globe. The sea stage is a plan, not a memory:
captions must not use the past tense (`stage_tense` in the JSON).

**t04 · ship → plane · two lights · 10 s.** From the ship's seaward rail the camera
turns to the lighthouse (`t04_a1`). Day falls, the lamp sweeps, and on its flash the
frame becomes a control tower at dawn with the aircraft below it (`t04_b0`): tower where
the lighthouse stood, beacon where the lamp was, horizon on the same line. The flash
carries a night — port and airport are never in one frame.

**t05 · plane → Chile · through the cloud · 16 s.** Above a cloud floor (`t05_a1`) the
aircraft sinks until white fills the frame. It thins onto the Andes (`t05_b0`); the
camera lets the aircraft go and glides down to the roadside lookout, where the bicycle
is standing at the parapet (`t05_b1`). The stage-1 bell rings once. `chile` already uses
the bicycle, so this is simply the chapter's start pose.

## How to implement (engine side)

Nothing below exists yet; all of it fits the current interfaces.

1. **Order.** In `chapters/index.js` set `japan.order = 4`, `asia.order = 5`. `JOURNEY`
   sorts by `order`, so the map and "continue" follow.
2. **A sequence player** (new module, e.g. `src/world/journey.js`) that fetches
   `/world/journey/sequences.json` and, given a sequence id, drives `cam.pos / cam.look /
   cam.fov` (the values `game.js` copies to the camera each frame) from the `camera`
   keys. Resolve `space`:
   - `vehicle` / `asset`: multiply by the object's world matrix (`vehicle.object`, or the
     stamped asset's transform — the chapter knows where it stamped it);
   - `layout`: add the offset and yaw the chapter stamped that layout with;
   - `set`: the transition's own anchor (see each `set.anchor`).
   Interpolate position and look-at with the key's `ease`; `"cut"` means jump.
3. **Hook it into `travelToChapter(id)`**: when the pair (current → id) has a sequence,
   play its OUT keys before the swap and its IN keys after `loadChapter(id)`, instead of
   `emit('fade', 'chapter')`. Keep the plain fade for map jumps and non-adjacent travel.
4. **The splice is the loading screen.** At `splice.at_s` copy the canvas to an overlay
   (`renderer.domElement.toDataURL()` or a 2D canvas over the WebGL one), run
   `loadChapter`, set the camera to the first IN key, call `fx.snapCamera()`, then fade
   the overlay out. Preload the next chapter's keys with `assets.load()` when the
   sequence starts so the hold is short. t02 uses black, t04 a warm flash, t05 white —
   colours are in each `splice.load`.
5. **During a sequence**: `emit('cine', true)`, input locked (`st.lock`), skippable after
   1.5 s (jump to the last key).
6. **Light.** Lerp `world.atmosphere` values (sun colour, fog colour) across the splice
   as each `light.bridge` says; fog colour always equals the sky's horizon colour.
7. **Sound.** `sound_palette` describes each cue as a WebAudio recipe in the style of the
   existing `tone()`; no audio files exist. Give every looping cue its own gain node and
   implement `fade_in / fade_out / duck / crossfade_from` as gain ramps. Respect the
   existing `sound` toggle.
8. **Reduced motion** (`calm`): use each sequence's `reduced_motion` — stills and short
   cross-fades, no travel.
9. **No WebGL**: one line of bridge copy between stages in the existing fallback; the
   suggested i18n keys are placeholders for the narrative review to fill.
10. **Sets to stamp**: the t01 halt at the end of Murcia; the station at both ends of
    t02; the t05 cloudscape relative to the aircraft; the bicycle's start pose at the
    Chile lookout. Positions are local to their anchors — world positions belong to the
    chapters and can only be fixed there.

## What is and is not verified

- Verified in Blender: the composition of 14 keys (the frames), built from the real
  assets at real scale; every asset named in the JSON exists; the two new assets pass
  the contract.
- Not verified: anything in the web engine. In-between camera motion, timing, loading
  time, sound and the light lerps are specified, not run. Durations are targets.
- The view from inside the train (`seat_view`) is black in Blender because the body is
  closed; t02 starts outside the window line for that reason. If the engine can see out
  from inside, the first key may be used as written.
- Clouds are plain white geometry; they need to be drawn unlit (or emissive-lifted) and
  with fog to read as cloud in the engine.
- Which stages are memories and which are plans is not decided here. Only the sea stage
  is marked future, as briefed; no anecdote or fact is introduced by these sequences.
