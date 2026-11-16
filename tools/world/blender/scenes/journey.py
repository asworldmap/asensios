"""The Journey Director — five transitions that turn six stages into one trip.

This file is the single source of truth for the transitions. It

  1. declares every sequence (cameras, splice, sound cues, loading moment),
  2. rebuilds each splice in Blender from existing assets and renders a small
     verification still per key frame      -> docs/world/journey/<frame>.webp
  3. writes the data the web agent implements -> public/world/journey/sequences.json

Run:  python tools/world/blender/scenes/journey.py [--no-render] [--only t03]

Cameras are given in the space the engine can resolve at runtime:
  vehicle   local to the player's vehicle root (x left, y up, z forward)
  asset     local to one stamped asset (e.g. the station building)
  set       local to the transition's own small set (origin = its anchor point)
World coordinates of the playable chapters are NOT used: they belong to the web
branch and can only be confirmed there.
"""

import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from _scene import REPO, SRC, Scene  # noqa: E402

PI = math.pi
ARGV = sys.argv
ONLY = ARGV[ARGV.index("--only") + 1] if "--only" in ARGV else None
RENDER = "--no-render" not in ARGV
OUT_IMG = os.path.join(REPO, "docs", "world", "journey")
OUT_JSON = os.path.join(REPO, "public", "world", "journey", "sequences.json")
DEFAULT_FOV = 46  # the engine's camera


def world(origin, yaw, local):
    """Asset- or vehicle-local point -> set space (game axes, yaw about +y)."""
    x, y, z = local
    c, s = math.cos(yaw), math.sin(yaw)
    return (origin[0] + x * c + z * s, origin[1] + y, origin[2] - x * s + z * c)


def r3(p):
    return [round(v, 2) for v in p]


def lens(fov):
    return 10.125 / math.tan(math.radians(fov) / 2)


def fresh(name):
    return Scene(name)


def reopen(name, drop=()):
    """Open one of the five reference scenes as it was rendered, minus `drop` prefixes."""
    bpy.ops.wm.open_mainfile(filepath=os.path.join(SRC, "scenes", name + ".blend"))
    S = Scene.__new__(Scene)
    S.name, S.sc, S.layout, S.cache = name, bpy.context.scene, [], {}
    for o in list(S.sc.collection.objects):
        if o.instance_type == "COLLECTION" and any(o.name.startswith(d) for d in drop):
            bpy.data.objects.remove(o)
    return S


def still(S, frame, pos, look, fov):
    if not RENDER:
        return
    S.camera(pos, look, lens=lens(fov))
    sc = S.sc
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 20
    sc.cycles.volume_bounces = 0
    sc.cycles.max_bounces = 3
    sc.view_settings.view_transform = "Standard"
    sc.render.resolution_x, sc.render.resolution_y = 800, 450
    sc.render.image_settings.file_format = "WEBP"
    sc.render.image_settings.quality = 80
    os.makedirs(OUT_IMG, exist_ok=True)
    sc.render.filepath = os.path.join(OUT_IMG, frame + ".webp")
    bpy.ops.render.render(write_still=True)
    print("[journey] frame", frame)


def key(t, space, pos, look, fov=DEFAULT_FOV, ease="inOutSine", frame=None, note=None, ref=None):
    k = {"t": t, "space": space, "position": r3(pos), "look_at": r3(look), "fov": fov, "ease": ease}
    if ref:
        k["relative_to"] = ref
    if frame:
        k["verified_frame"] = f"docs/world/journey/{frame}.webp"
    if note:
        k["note"] = note
    return k


SEQ = []

# =====================================================================================
# 01  BICYCLE -> TRAIN      the wheel
# =====================================================================================
# Set: a country halt at the edge of the huerta. Track = z axis, the train stands
# heading -z, platform on +x. The lane the bicycle arrives on runs along x = -4.5.
T1_CAB = ((0, 0, -6), PI)
T1_WHEEL = world(*T1_CAB, (0, 0.46, 3.25))          # the cab's leading wheelset hub
T1_BIKE = ((-4.5, 0, T1_WHEEL[2] - 0.54), PI)       # rear hub lands exactly in front of it
T1_SET = [
    *[("europe/rail_track_straight", (0, 0, z), 0, 1) for z in range(-40, 41, 10)],
    *[("europe/rail_platform", (0, 0, z), 0, 1) for z in (-10, 0, 10)],
    ("europe/station_shelter", (4.6, 0.92, 0), 0, 1),
    ("common/street_lamp", (5.2, 0.92, -9), 0, 1),
    ("vehicles/train_cab", T1_CAB[0], T1_CAB[1], 1),
    ("vehicles/train_coach", (0, 0, 12.1), PI, 1),
    ("vehicles/city_bike", T1_BIKE[0], T1_BIKE[1], 1),
    ("murcia/stone_wall", (-7.2, 0, -14), 0, 1), ("murcia/stone_wall", (-7.2, 0, -4), 0, 1), ("murcia/stone_wall", (-7.2, 0, 8), 0, 1),
    ("murcia/palm_tree", (9.5, 0, -7), 1.0, 1.1), ("murcia/palm_tree", (10.5, 0, 9), 4.0, 1.2),
    ("murcia_v2/orange_tree", (-9.5, 0, 3), 2.0, 1.0), ("murcia/lemon_tree", (-11, 0, -9), 0.5, 1.0), ("murcia_v2/olive_tree", (13, 0, -16), 3.0, 1.1),
    ("murcia_v2/prickly_pear", (-8.3, 0, -20), 1.0, 1.0),
    ("murcia_v2/sierra_backdrop", (190, -2, -20), -PI / 2 * 0.9, 1.8), ("murcia_v2/sierra_backdrop", (170, -2, 120), -PI / 2 * 1.2, 1.8),
]
T1_A1 = ((T1_BIKE[0][0] - 3.95, 0.3, T1_WHEEL[2]), (0, 0.3, T1_WHEEL[2]))
T1_A2 = ((T1_WHEEL[0] - 5.05 - 0.72, 0.3, T1_WHEEL[2]), (0, 0.3, T1_WHEEL[2]))
T1_B0_LOCAL = ((5.77, 0.3, 3.25), (0, 0.3, 3.25))  # same shot, local to vehicles/train_cab

if ONLY in (None, "t01"):
    S = fresh("t01")
    for a, p, yaw, sc_ in T1_SET:
        S.place(a, *p, yaw, sc_)
    S.ground(size=520, height=lambda x, z: -0.55 if abs(x) < 2.6 else 0.0, color=lambda x, z, h: "#bfa67c" if -6.4 < x < -2.6 else "#9d927f" if abs(x) < 2.4 else "#cdb78a" if x < 0 else "#c4b184", res=260, y=-0.05)
    S.light(sun_dir=(-0.72, 0.34, -0.6), sun_color="#ffdcae", sun_energy=5.0, sky_top="#5f9fc9", sky_horizon="#f8e2b8", sky_strength=1.25)
    S.haze(density=0.0011, color="#f6e4c0")
    still(S, "t01_a1_bike_wheel", *T1_A1, 15)
    for o in [o for o in S.sc.collection.objects if o.name.startswith("city_bike")]:
        bpy.data.objects.remove(o)
    still(S, "t01_a2_train_wheel", *T1_A2, 15)
    S = reopen("europe_railway")
    cab = ((0, 0, 52), PI)
    still(S, "t01_b0_train_wheel_europe", world(*cab, T1_B0_LOCAL[0]), world(*cab, T1_B0_LOCAL[1]), 15)

SEQ.append({
    "id": "t01_bicycle_to_train",
    "title": "The wheel",
    "from": {"chapter": "murcia", "vehicle": "bicycle"}, "to": {"chapter": "europe", "vehicle": "train"},
    "idea": "The lane ends beside a country halt. The camera comes down to where the bicycle wheel meets the ground; behind it, on the same axis, a steel wheel rests on its rail. The small wheel leaves, the big one starts to turn.",
    "constraint": "The existing train carries its wheels inside the bogie frame: only the lower half of each wheel shows. The match is therefore the contact point (rubber on earth → steel on rail), not a full circle.",
    "duration_s": 9.0,
    "assets": sorted({a for a, *_ in T1_SET}),
    "references": {"layouts": ["murcia_arrival", "europe_railway"], "frames": ["t01_a1_bike_wheel", "t01_a2_train_wheel", "t01_b0_train_wheel_europe"]},
    "set": {"anchor": "end of the Murcia route; track = local z, lane at x = -4.5, platform on +x. World position to be chosen in chapters/murcia.js.",
            "placements": [{"asset": a, "position": r3(p), "yaw": round(y, 4), "scale": s} for a, p, y, s in T1_SET if a != "vehicles/city_bike"],
            "player_stop": {"position": r3(T1_BIKE[0]), "yaw": round(T1_BIKE[1], 4), "note": "rear hub lines up with the cab's leading wheel"}},
    "camera": [
        key(0.0, "vehicle", (1.6, 1.3, -4.2), (0, 0.7, 1.5), 46, note="bicycle chase eases low and to the lane side as the rider coasts the last 12 m"),
        key(3.2, "set", *T1_A1, 15, frame="t01_a1_bike_wheel", note="rear wheel fills 70% of frame height, hub on the vertical axis, ground line at 30% from the bottom; the bogie and its wheel sit directly behind; rider brakes to a stop"),
        key(4.6, "set", *T1_A1, 15, ease="linear", note="hold: the wheel ticks to rest (freewheel), bell once"),
        key(6.0, "set", *T1_A2, 15, frame="t01_a2_train_wheel", note="push in 3.4 m; the bicycle is wheeled out of frame toward the platform; the steel wheel sits where the rubber one was, rail on the same line as the ground"),
        key(6.0, "vehicle", *T1_B0_LOCAL, 15, ease="cut", frame="t01_b0_train_wheel_europe", ref="vehicles/train_cab", note="SPLICE: identical framing on the playable train (camera on the side away from the platform)"),
        key(7.2, "vehicle", *T1_B0_LOCAL, 15, ease="linear", note="the wheel starts to turn; track the hub"),
        key(9.0, "vehicle", (7.5, 3.4, -9.0), (0, 2.0, 5.0), 46, note="pull back and rise into the train's own chase camera; hand over"),
    ],
    "splice": {"type": "match_cut_held_frame", "at_s": 6.0, "match": "wheel on the vertical axis, contact line 30% from the bottom, wheel diameter ~70% of frame height on both sides",
               "load": "preload europe assets from t=0; at 6.0 hold the last rendered frame as an overlay, loadChapter('europe'), place camera on the B key, cross-fade overlay out over 0.6 s"},
    "light": {"out": "murcia golden hour", "in": "europe clear afternoon", "bridge": "lerp sun colour and fog over the 0.6 s cross-fade; both keys are side-lit close-ups so only the warmth changes"},
    "sound": [
        {"at": 0.0, "cue": "bike_roll", "action": "continue", "note": "gain follows speed down to 0 by 3.4"},
        {"at": 2.6, "cue": "station_amb", "action": "fade_in", "fade": 2.0},
        {"at": 3.4, "cue": "bike_freewheel", "action": "oneshot", "note": "ticks slowing over 1.2 s"},
        {"at": 4.4, "cue": "bike_bell", "action": "oneshot"},
        {"at": 6.0, "cue": "train_brake_release", "action": "oneshot", "note": "short air hiss on the cut"},
        {"at": 7.2, "cue": "train_roll", "action": "fade_in", "fade": 1.6, "note": "first rail joint 'clack-clack' lands at 8.0"},
        {"at": 8.0, "cue": "station_amb", "action": "fade_out", "fade": 1.5},
    ],
    "next": {"chapter": "europe", "start": "route t = 0, train stationary then accelerating; story mode"},
    "reduced_motion": "No camera travel: cut from the bicycle chase to key 3.2, 0.4 s cross-fade to the B key at 7.2, then the normal chapter intro. Sounds: bell and one rail clack only.",
    "no_webgl": "Text bridge in the existing fallback list between stages 1 and 2 (i18n key suggested: world.bridge.t01).",
})

# =====================================================================================
# 02  TRAIN -> BUS      through the station
# =====================================================================================
ST = ((12.5, 0.92, 30), -PI / 2)           # europe_v2/station_building in europe_railway
T2_COACH = ((0, 0, 30), PI)
T2_CAB = ((0, 0, 11.9), PI)
T2_BUS = ((30.0, 0.62, 27.0), 0.0)
T2_A1L = ((-1.75, 2.7, 1.5), (-9.0, 2.3, 0.2))
T2_A1 = (world(*T2_COACH, T2_A1L[0]), world(*T2_COACH, T2_A1L[1]))
T2_A2L = ((0, 1.58, 6.6), (0, 1.25, 3.6))       # station-local: on the platform, facing the door
T2_B0L = ((0, 1.58, -4.6), (-1.6, 1.3, -17.5))  # station-local: leaving by the street door
T2_BUS_L = (-3.0, -0.3, -17.5)                  # bus origin, station-local; yaw +pi/2 relative
T2_B1 = (world(*T2_BUS, (-0.94, 2.42, 0.5)), world(*ST, (0, 6.0, -3.7)))

if ONLY in (None, "t02"):
    S = reopen("europe_railway", drop=("train_",))
    S.place("vehicles/train_cab", *T2_CAB[0], T2_CAB[1])
    S.place("vehicles/train_coach", *T2_COACH[0], T2_COACH[1])
    S.place("vehicles/coach_bus", *T2_BUS[0], T2_BUS[1])
    still(S, "t02_a1_seat_to_platform", *T2_A1, 50)
    still(S, "t02_a2_station_door", world(*ST, T2_A2L[0]), world(*ST, T2_A2L[1]), 40)
    still(S, "t02_b0_street_door_bus", world(*ST, T2_B0L[0]), world(*ST, T2_B0L[1]), 40)
    still(S, "t02_b1_bus_window_clock", *T2_B1, 50)

SEQ.append({
    "id": "t02_train_to_bus",
    "title": "Through the station",
    "from": {"chapter": "europe", "vehicle": "train"}, "to": {"chapter": "europe-bus", "vehicle": "bus"},
    "idea": "The train stops. We get off with everyone else, cross the platform, walk through the station — in by the platform door, out by the street door — and the coach is waiting. One building, two faces, one clock.",
    "duration_s": 12.0,
    "assets": ["europe_v2/station_building", "europe_v2/station_canopy", "europe_v2/platform_paving", "europe/rail_platform", "vehicles/train_cab", "vehicles/train_coach", "vehicles/coach_bus", "common/park_bench", "common/street_lamp"],
    "references": {"layouts": ["europe_railway"], "frames": ["t02_a1_seat_to_platform", "t02_a2_station_door", "t02_b0_street_door_bus", "t02_b1_bus_window_clock"]},
    "set": {"anchor": "europe_v2/station_building. OUT side: stamped at the end of the rail route as in layouts/europe_railway.json. IN side: the same building stamped at the start of the bus route, street face (-z local) toward the road.",
            "bus_start_station_local": {"position": r3(T2_BUS_L), "yaw_relative": round(PI / 2, 4), "note": "bus door faces the station; 13 m forecourt"}},
    "camera": [
        key(0.0, "vehicle", (0, 2.55, 0), (-9, 2.3, 4), 50, ref="vehicles/train_coach", note="inside the coach (seat_view) as the platform slides in; train brakes to 0 by 2.5. Interior view not verified in Blender (the body is closed there) — if the engine cannot see out from seat_view, start on the 3.0 key instead"),
        key(3.0, "vehicle", *T2_A1L, 50, ref="vehicles/train_coach", frame="t02_a1_seat_to_platform", note="stopped: the camera slips out through the window line to the platform side; station door and name board under the canopy; doors open (PART_door_*)"),
        key(5.0, "asset", *T2_A2L, 40, ref="europe_v2/station_building", note="walking pace across the platform, head height 1.6 m, slight bob (2 cm)"),
        key(6.2, "asset", (0, 1.58, 4.0), (0, 1.3, 0), 40, ref="europe_v2/station_building", frame="t02_a2_station_door", note="the doorway fills the frame: natural dark"),
        key(6.2, "asset", (0, 1.58, -3.9), (-1.2, 1.3, -17.5), 40, ease="cut", ref="europe_v2/station_building", note="SPLICE inside the dark of the hall"),
        key(7.6, "asset", *T2_B0L, 40, ref="europe_v2/station_building", frame="t02_b0_street_door_bus", note="out of the street door: the coach framed in the opening, door open, people boarding"),
        key(9.6, "vehicle", (-2.6, 1.7, 4.6), (-0.9, 2.2, 1.0), 46, ref="vehicles/coach_bus", note="up the step"),
        key(11.0, "vehicle", (-0.94, 2.42, 0.5), (-12, 5.0, 3.0), 50, ref="vehicles/coach_bus", frame="t02_b1_bus_window_clock", note="seated (passenger_view): the station and its clock in the window as the bus pulls out"),
        key(12.0, "vehicle", (0, 4.2, -12.5), (0, 2.0, 6.0), 46, ref="vehicles/coach_bus", note="hand over to the bus chase camera"),
    ],
    "splice": {"type": "dark_doorway", "at_s": 6.2, "match": "the station doorway at frame centre; black for 0.5–1.4 s is motivated by the interior",
               "load": "preload europe-bus assets from t=0; at 6.2 the screen is the dark hall: loadChapter('europe-bus') here; fade up to key 7.6. If loading runs long, hold the black with station_amb playing."},
    "light": {"out": "europe clear afternoon", "in": "same sun, same sky", "bridge": "none needed — keep the europe atmosphere for the first 20 s of the bus chapter, then drift to its own"},
    "sound": [
        {"at": 0.0, "cue": "train_roll", "action": "continue", "note": "pitch and gain fall with speed"},
        {"at": 1.0, "cue": "train_brake", "action": "oneshot", "note": "1.8 s squeal ending exactly at standstill (2.5)"},
        {"at": 2.2, "cue": "station_amb", "action": "fade_in", "fade": 1.0},
        {"at": 3.0, "cue": "door_hiss", "action": "oneshot"},
        {"at": 3.4, "cue": "station_chime", "action": "oneshot"},
        {"at": 5.0, "cue": "footsteps", "action": "loop", "note": "4 steps on stone, then 3 on timber floor inside (duller)"},
        {"at": 6.2, "cue": "station_amb", "action": "duck", "note": "low-pass to 600 Hz while indoors, open again at 7.6"},
        {"at": 7.2, "cue": "bus_idle", "action": "fade_in", "fade": 1.2},
        {"at": 9.8, "cue": "door_hiss", "action": "oneshot"},
        {"at": 10.4, "cue": "bus_engine", "action": "crossfade_from", "from": "bus_idle", "fade": 0.8},
        {"at": 10.6, "cue": "station_amb", "action": "fade_out", "fade": 1.4},
    ],
    "next": {"chapter": "europe-bus", "start": "route t = 0 at the station forecourt; story mode"},
    "reduced_motion": "Three stills, 0.4 s cross-fades: key 3.0 → key 7.6 → key 12.0. No walk, no head bob.",
    "no_webgl": "Text bridge between stages 2 and 3 (world.bridge.t02).",
})

# =====================================================================================
# 03  BUS -> SHIP      the horizon (an honest ellipsis)
# =====================================================================================
T3_BUS = ((-1.75, 0, 86), 0.0)
T3_A1 = ((0, 15.0, 6), (0, 3.0, 306))            # crane shot down the road, pitch -2.3 deg
T3_SHIP = ((0, 0, 0), 0.0)
T3_B0 = ((0, 21.0, -58), (0, 9.0, 242))          # same pitch, over the stern, down the keel line
T3_ROAD = [
    *[("europe/road_guardrail", (sx * 4.2, 0, z), 0, 1) for sx in (-1, 1) for z in range(2, 122, 4)],
    ("europe/road_sign", (5.4, 0, 30), PI, 1),
    *[("europe/conifer", (sx * (9 + (i * 7) % 11), 0, 14 + i * 13), i, 1.0 + (i % 3) * 0.2) for i in range(9) for sx in (-1, 1)],
    ("europe_v2/broadleaf_tree", (-14, 0, 40), 1.0, 1.0), ("europe_v2/broadleaf_tree", (16, 0, 74), 2.0, 1.1),
    ("europe_v2/meadow_hill", (-70, -1, 90), 0.4, 1.3), ("europe_v2/meadow_hill", (76, -1, 60), 2.0, 1.4), ("europe_v2/meadow_hill", (-95, -1, 190), 1.0, 1.5), ("europe_v2/meadow_hill", (100, -1, 210), 3.0, 1.5),
    ("europe_v2/alps_backdrop", (-330, -6, 380), PI - 0.9, 3.4), ("europe_v2/alps_backdrop", (340, -6, 380), PI + 0.9, 3.4),
]
T3_SEA = [("vehicles/passenger_ship", T3_SHIP[0], 0.0, 1), ("maritime_v2/deck_bench", (-3.2, 4.4, 14), PI / 2, 1), ("maritime_v2/deck_vent", (0, 9.8, -8), 0, 1),
          ("maritime_v2/horizon_islands", (-260, 0, 760), PI + 0.2, 6.5), ("maritime_v2/horizon_islands", (330, 0, 820), PI - 0.25, 7.0)]

if ONLY in (None, "t03"):
    S = fresh("t03a")
    for a, p, yaw, sc_ in T3_ROAD:
        S.place(a, *p, yaw, sc_)
    S.place("vehicles/coach_bus", *T3_BUS[0], T3_BUS[1])
    S.ground(size=1600, color=lambda x, z, h: "#6f6c68" if abs(x) < 3.6 else "#8db552" if (int(x / 40) + int(z / 55)) % 2 else "#a9bf5e", res=400, y=-0.05)
    S.light(sun_dir=(-0.55, 0.3, 0.6), sun_color="#ffe6c0", sun_energy=4.6, sky_top="#4a8fc8", sky_horizon="#eef0e6", sky_strength=1.2)
    S.haze(density=0.0016, color="#e9eee8")
    still(S, "t03_a1_road_to_horizon", *T3_A1, 40)
    S = fresh("t03b")
    for a, p, yaw, sc_ in T3_SEA:
        S.place(a, *p, yaw, sc_)
    W = S.water(0, 0, 3000, 3000, y=0.0, color="#17586c", rough=0.1)
    nt = W.data.materials[0].node_tree
    next(n for n in nt.nodes if n.type == "TEX_NOISE").inputs["Scale"].default_value = 900.0
    next(n for n in nt.nodes if n.type == "BUMP").inputs["Strength"].default_value = 0.35
    S.light(sun_dir=(-0.55, 0.26, 0.62), sun_color="#ffdcb2", sun_energy=4.6, sky_top="#5b9ccb", sky_horizon="#f6dcc0", sky_strength=1.15)
    S.haze(density=0.0011, color="#f1e2d2")
    still(S, "t03_b0_ship_to_horizon", *T3_B0, 40)

SEQ.append({
    "id": "t03_bus_to_ship",
    "title": "The horizon",
    "from": {"chapter": "europe-bus", "vehicle": "bus"}, "to": {"chapter": "japan", "vehicle": "ship"},
    "idea": "The road runs to the horizon and the camera lets the bus go, rising until only the line between land and sky is left. A thin route line crosses the frame — a jump in the story, drawn as one. When the picture returns the line is the sea, and the road down the middle of the frame is a ship's deck.",
    "honesty": "This is an ellipsis, not a route: the bus does not drive to Japan. The overlay must say so in its own way (a broken line, a date gap). The sea stage is an aspiration, not a memory — see `stage_tense`.",
    "duration_s": 11.0,
    "assets": sorted({a for a, *_ in T3_ROAD + T3_SEA} | {"vehicles/coach_bus"}),
    "references": {"layouts": ["europe_railway", "port_departure"], "frames": ["t03_a1_road_to_horizon", "t03_b0_ship_to_horizon"]},
    "set": {"anchor": "OUT: the last straight of the bus route (needs >= 300 m of clear view ahead and no backdrop inside +-12 deg of the road axis; use the chapter's own road). IN: open water, the ship at the origin heading +z.",
            "in_placements": [{"asset": a, "position": r3(p), "yaw": round(y, 4), "scale": s} for a, p, y, s in T3_SEA if not a.startswith("vehicles/")]},
    "camera": [
        key(0.0, "vehicle", (0, 4.2, -12.5), (0, 2.0, 6.0), 46, ref="vehicles/coach_bus", note="bus chase"),
        key(2.0, "vehicle", (1.75, 6.0, -20), (1.75, 2.0, 40), 42, ref="vehicles/coach_bus", note="drift to the road's centre line and stop following: from here the camera is fixed in the world and the bus drives away"),
        key(5.0, "set", *T3_A1, 40, frame="t03_a1_road_to_horizon", note="crane to 15 m; pitch -2.3 deg puts the horizon at 44% of frame height; road centre line on the vertical axis; bus is a dot"),
        key(5.0, "set", *T3_A1, 40, ease="linear", note="HOLD 3.0 s under the route overlay (see overlay)"),
        key(8.0, "set", *T3_B0, 40, ease="cut", frame="t03_b0_ship_to_horizon", note="SPLICE: same pitch, same horizon height; the keel line replaces the road"),
        key(9.2, "set", *T3_B0, 40, ease="linear", note="hold; the ship's horn answers"),
        key(11.0, "vehicle", (0, 6.3, 16.0), (0, 5.6, 60), 46, ref="vehicles/passenger_ship", note="descend to the fore deck (deck_spawn + eye height) and hand over"),
    ],
    "overlay": {"at_s": 5.4, "duration_s": 2.4, "what": "one hairline (2 px, cream #f1ede2, 80% opacity) drawn left to right along the horizon across the full width, broken into dashes over its middle third; two small labels in the game's signage type at its ends. No map, no globe, no country outlines.",
                "labels": "left: the stage just left; right: the stage to come, marked as future. Copy comes from the narrative review (keys suggested: world.bridge.t03.from / .to)."},
    "splice": {"type": "horizon_hold", "at_s": 8.0, "match": "horizon at 44% of frame height on both sides; vanishing point at frame centre",
               "load": "preload japan assets from t=2; at 5.0 hold the frame as an overlay (the route line animates on top of it) and loadChapter('japan') underneath; reveal with a 0.8 s cross-fade at 8.0"},
    "light": {"out": "europe afternoon, cool haze", "in": "sea, early morning, warm haze", "bridge": "during the hold tint the held frame toward #f1e2d2 (the sea's horizon colour) so the two skies meet at the line"},
    "sound": [
        {"at": 0.0, "cue": "bus_engine", "action": "continue"},
        {"at": 2.0, "cue": "bus_engine", "action": "fade_out", "fade": 3.5, "note": "with a slow pitch fall (doppler of something leaving)"},
        {"at": 3.0, "cue": "wind", "action": "fade_in", "fade": 2.5},
        {"at": 5.4, "cue": "route_tick", "action": "oneshot", "note": "a soft tick per dash of the route line; nothing melodic"},
        {"at": 7.2, "cue": "sea_wash", "action": "fade_in", "fade": 1.6, "note": "the water arrives before the picture"},
        {"at": 8.4, "cue": "ship_horn", "action": "oneshot"},
        {"at": 9.0, "cue": "ship_engine", "action": "fade_in", "fade": 2.0},
    ],
    "next": {"chapter": "japan", "start": "at sea on the fore deck or the bridge, whichever the chapter opens on; story mode"},
    "reduced_motion": "No crane: cut to key 5.0, show the route line fully drawn (no animation) for 2 s, cross-fade to key 9.2.",
    "no_webgl": "Text bridge between stages 3 and 4 that states the jump and the future tense (world.bridge.t03).",
})

# =====================================================================================
# 04  SHIP -> PLANE      the two lights
# =====================================================================================
LH = (-64, 0, -68)            # maritime_v2/lighthouse in port_departure
TW = (-50, 0, -86)            # asia_v2/control_tower in asia_arrival


def offset_axis(pos, target, off_deg, reach=200.0, rise=14.0):
    """Look point that keeps `target` off_deg to the left of the camera axis."""
    b = math.atan2(target[0] - pos[0], -(target[2] - pos[2])) + math.radians(off_deg)
    return (pos[0] + reach * math.sin(b), pos[1] + rise, pos[2] - reach * math.cos(b))


T4_SHIP = ((-7.0, 0, -4), 0.0)
T4_A_LOCAL = (-5.0, 6.1, 18.0)                  # port-side rail of the fore deck, eye height
T4_A_POS = world(*T4_SHIP, T4_A_LOCAL)
T4_A1 = (T4_A_POS, offset_axis(T4_A_POS, LH, 12))
d_a = math.hypot(LH[0] - T4_A_POS[0], LH[2] - T4_A_POS[2])
d_b = d_a * 32.5 / 18.55      # so the tower's beacon sits where the lighthouse lamp sat
T4_B_POS = (TW[0] + d_b * 0.384, 9.0, TW[2] + d_b * 0.9233)
T4_B0 = (T4_B_POS, offset_axis(T4_B_POS, TW, 12))

if ONLY in (None, "t04"):
    S = reopen("port_departure")
    still(S, "t04_a1_lighthouse", *T4_A1, 30)
    S = reopen("asia_arrival")
    still(S, "t04_b0_control_tower", *T4_B0, 30)

SEQ.append({
    "id": "t04_ship_to_plane",
    "title": "Two lights",
    "from": {"chapter": "japan", "vehicle": "ship"}, "to": {"chapter": "asia", "vehicle": "airplane"},
    "idea": "The ship is alongside. From her rail the camera turns away from the quay to the lighthouse and the sea's horizon; the lamp turns, the day goes. When the light comes round again it is a control tower's beacon, the horizon is a runway's, and an aircraft is waiting nose-on.",
    "honesty": "Port and airport are not neighbours: the cut carries a night. Do not show both in one frame.",
    "duration_s": 10.0,
    "assets": ["maritime_v2/lighthouse", "maritime_v2/breakwater", "maritime_v2/pier_head", "maritime_v2/pier_section", "vehicles/passenger_ship", "asia_v2/control_tower", "asia_v2/terminal_hall", "asia_v2/apron_tile", "asia_v2/pushback_tug", "vehicles/airliner"],
    "references": {"layouts": ["port_departure", "asia_arrival"], "frames": ["t04_a1_lighthouse", "t04_b0_control_tower"]},
    "set": {"anchor": "OUT: layouts/port_departure.json as stamped in the sea chapter, the ship berthed at its layout pose (camera on her fore deck). IN: layouts/asia_arrival.json (aircraft at the layout origin, nose +z).",
            "rule": f"the tower camera stands {d_b:.0f} m from the tower and the deck camera {d_a:.0f} m from the lighthouse — the ratio of the two lamp heights (32.5 / 18.55) — so both towers have the same size on screen; camera heights 9.0 m and 6.1 m put both lamps within 0.6 deg of each other"},
    "camera": [
        key(0.0, "vehicle", (0, 11.4, 8.6), (-6, 6.0, 60), 46, ref="vehicles/passenger_ship", note="from the bridge as she comes alongside (bridge_view); engines to stop"),
        key(2.0, "vehicle", T4_A_LOCAL, (-40, 8.0, -20), 40, ref="vehicles/passenger_ship", note="down to the fore-deck rail on the seaward side, turning away from the quay"),
        key(4.0, "layout", *T4_A1, 30, ref="port_departure", frame="t04_a1_lighthouse", note="ship berthed as in the layout (x = -7, bow +z): lighthouse 12 deg left of axis, lamp 3.3 deg above it, horizon at 63% from the top"),
        key(6.0, "layout", *T4_A1, 30, ease="linear", ref="port_departure", note="HOLD while the light falls to dusk and the lamp sweeps once (flash at 5.6)"),
        key(6.0, "layout", *T4_B0, 30, ease="cut", ref="asia_arrival", frame="t04_b0_control_tower", note="SPLICE on the lamp flash: beacon on the same pixel, horizon on the same line; aircraft nose-on at centre"),
        key(8.0, "layout", *T4_B0, 30, ease="linear", ref="asia_arrival", note="dawn comes up; apron lights go out one by one"),
        key(10.0, "layout", (21.0, 1.7, 38.0), (-1.0, 6.5, 0.0), 46, ref="asia_arrival", note="crane down from 9 m to the asia_arrival layout camera, then hand over to the chapter"),
    ],
    "splice": {"type": "light_flash_match", "at_s": 6.0, "match": "lamp/beacon position, horizon height, vertical tower silhouette",
               "load": "preload asia assets from t=0; at 5.6 the lamp flash blooms to a warm white overlay (#fff2c8, 0.25 s up) — hold it, loadChapter('asia'), 0.5 s down onto key B. The flash is the loading mask."},
    "light": {"out": "port morning → dusk in 2 s (sun elevation 15° → 2°, sky to #6c7fa6 / horizon #f1b98c)", "in": "asia dawn (same horizon colour, sun returning)", "bridge": "the shared horizon colour #f1b98c on both sides of the flash"},
    "sound": [
        {"at": 0.0, "cue": "sea_wash", "action": "continue"},
        {"at": 0.0, "cue": "ship_engine", "action": "fade_out", "fade": 2.5},
        {"at": 1.5, "cue": "harbour_amb", "action": "fade_in", "fade": 1.5, "note": "rigging taps, a mooring creak"},
        {"at": 4.2, "cue": "ship_horn", "action": "oneshot", "note": "one long farewell note, far away"},
        {"at": 5.6, "cue": "sea_wash", "action": "fade_out", "fade": 1.2, "note": "into near silence on the flash"},
        {"at": 6.4, "cue": "apron_amb", "action": "fade_in", "fade": 1.5, "note": "wide, quiet air; a distant APU whine"},
        {"at": 8.6, "cue": "cabin_chime", "action": "oneshot"},
        {"at": 9.0, "cue": "jet_idle", "action": "fade_in", "fade": 1.5},
    ],
    "next": {"chapter": "asia", "start": "aircraft at the stand; story mode. This stage is now the departure toward Chile (order 5)."},
    "reduced_motion": "Two stills: key 4.0 and key 8.0, 0.6 s cross-fade, no flash (use a plain fade through #f1b98c).",
    "no_webgl": "Text bridge between stages 4 and 5 (world.bridge.t04).",
})

# =====================================================================================
# 05  PLANE -> CHILE      through the cloud, back to the bicycle
# =====================================================================================
T5_PLANE = ((0, 0, 0), 0.0)
T5_A1 = (world(*T5_PLANE, (9.0, 7.5, -30.0)), world(*T5_PLANE, (0, 2.5, 8.0)))
T5_CLOUDS = [("journey/cloud_sea", (i * 520, -95, j * 520 + 300), (i + j) * 1.57, 7.0) for i in (-2, -1, 0, 1, 2) for j in (-1, 0, 1, 2)] + [
    ("journey/cloud_bank", (-70, -30, 120), 0.4, 4.0), ("journey/cloud_bank", (110, -18, 260), 2.0, 5.5), ("journey/cloud_bank", (-180, 5, 420), 1.0, 7.0),
    ("journey/cloud_bank", (30, -55, 60), 3.0, 3.0), ("journey/cloud_bank", (240, 20, 600), 5.0, 8.0), ("journey/cloud_bank", (-320, -10, 700), 4.0, 8.0),
]
T5_B0 = ((-40, 250, -640), (20, 90, 900))        # chile_arrival layout space: out of the cloud, the wall ahead
T5_BIKE = ((2.3, 0.0, 1.3), -0.25)               # on the lookout terrace, facing the view
T5_B1 = ((3.4, 2.0, -7.0), (0.5, 0.0, 300))

if ONLY in (None, "t05"):
    S = fresh("t05a")
    S.place("vehicles/airliner", *T5_PLANE[0], 0.0)
    for a, p, yaw, sc_ in T5_CLOUDS:
        S.place(a, *p, yaw, sc_)
    S.light(sun_dir=(0.42, 0.34, -0.84), sun_color="#ffe2bc", sun_energy=4.6, sky_top="#3f7fc0", sky_horizon="#e9eef2", sky_strength=1.3)
    S.haze(density=0.0006, color="#eef2f5")
    still(S, "t05_a1_above_the_cloud", *T5_A1, 46)
    S = reopen("chile_arrival")
    S.place("vehicles/city_bike", *T5_BIKE[0], T5_BIKE[1])
    S.place("vehicles/airliner", -10, 215, -520, 0.03)
    for a, p, yaw, sc_ in (("journey/cloud_bank", (-150, 200, -520), 0.5, 6.0), ("journey/cloud_bank", (120, 235, -470), 2.2, 5.0), ("journey/cloud_bank", (-300, 150, -200), 1.2, 8.0), ("journey/cloud_bank", (330, 170, -100), 4.0, 8.0)):
        S.place(a, *p, yaw, sc_)
    still(S, "t05_b0_the_andes_appear", *T5_B0, 46)
    still(S, "t05_b1_lookout_bicycle", *T5_B1, 42)

SEQ.append({
    "id": "t05_plane_to_chile",
    "title": "Through the cloud",
    "from": {"chapter": "asia", "vehicle": "airplane"}, "to": {"chapter": "chile", "vehicle": "bicycle"},
    "idea": "Above a floor of cloud the aircraft sinks until the white takes the frame. It opens on the wall of the Andes in evening light. The camera leaves the aircraft, comes down across the valley to a roadside lookout — and a bicycle is leaning there, the same one. The bell rings once. The rider is home in the world.",
    "duration_s": 16.0,
    "assets": ["vehicles/airliner", "journey/cloud_sea", "journey/cloud_bank", "chile_v2/cordillera_backdrop", "chile_v2/foothill_ridge", "chile_v2/city_basin_backdrop", "chile_v2/vineyard_rows", "chile_v2/poplar_row", "chile_v2/adobe_house", "chile_v2/lookout_terrace", "vehicles/city_bike"],
    "references": {"layouts": ["asia_arrival", "chile_arrival"], "frames": ["t05_a1_above_the_cloud", "t05_b0_the_andes_appear", "t05_b1_lookout_bicycle"]},
    "set": {"anchor": "OUT: cloudscape relative to the aircraft (end of the flight chapter, any altitude). IN: layouts/chile_arrival.json; the lookout is its origin, the view is +z.",
            "out_placements_vehicle_relative": [{"asset": a, "position": r3(p), "yaw": round(y, 4), "scale": s} for a, p, y, s in T5_CLOUDS],
            "bicycle_at_lookout": {"position": r3(T5_BIKE[0]), "yaw": round(T5_BIKE[1], 4), "note": "this is the player's bicycle: the chile chapter (vehicle 'bicycle') starts here, standing still"}},
    "camera": [
        key(0.0, "vehicle", (0, 9.55, -34), (0, 3.0, 10), 46, ref="vehicles/airliner", note="the aircraft's chase anchor, level flight over the cloud floor"),
        key(3.0, "vehicle", (9.0, 7.5, -30.0), (0, 2.5, 8.0), 46, ref="vehicles/airliner", frame="t05_a1_above_the_cloud", note="ease off the wing; the aircraft starts down (2 m/s) toward the deck"),
        key(6.0, "vehicle", (9.0, 5.0, -26.0), (0, 2.5, 8.0), 46, ref="vehicles/airliner", note="cloud tops rise through frame; white-out complete at 6.0"),
        key(6.0, "layout", *T5_B0, 46, ease="cut", ref="chile_arrival", note="SPLICE inside the white"),
        key(8.0, "layout", *T5_B0, 46, ease="linear", ref="chile_arrival", frame="t05_b0_the_andes_appear", note="the white thins: the snow wall first, then the valley; the aircraft small ahead, continuing its descent out of frame right"),
        key(13.0, "layout", (-8.0, 14.0, -30.0), (2.0, 2.0, 120), 44, ref="chile_arrival", ease="inOutCubic", note="one long descending glide across the valley edge to the road behind the lookout — the camera lets the aircraft go"),
        key(15.0, "layout", *T5_B1, 42, ref="chile_arrival", frame="t05_b1_lookout_bicycle", note="settle behind the bicycle at the parapet: the first image of the game, seen again"),
        key(16.0, "layout", *T5_B1, 42, ease="linear", ref="chile_arrival", note="hold one second in stillness; bell; hand over to the bicycle chase camera"),
    ],
    "splice": {"type": "white_out", "at_s": 6.0, "match": "full-frame cloud white (#f4f6f8) on both sides",
               "load": "preload chile assets from t=0; the white overlay is the loading mask: loadChapter('chile') at 6.0, thin the overlay over 2 s from 6.6. Scene fog colour = the overlay colour while it thins."},
    "light": {"out": "high daylight above cloud (cool, hard)", "in": "chile evening (warm, long)", "bridge": "warm the white overlay from #f4f6f8 to #f6e6d2 while it thins, so the Andes are born already in evening light"},
    "sound": [
        {"at": 0.0, "cue": "jet_cruise", "action": "continue"},
        {"at": 3.0, "cue": "cabin_chime", "action": "oneshot"},
        {"at": 3.2, "cue": "jet_cruise", "action": "pitch_down", "note": "engines back to descent power over 2 s"},
        {"at": 5.4, "cue": "jet_cruise", "action": "duck", "note": "muffle (low-pass 500 Hz) inside the cloud"},
        {"at": 7.0, "cue": "wind", "action": "fade_in", "fade": 2.0},
        {"at": 8.0, "cue": "jet_cruise", "action": "fade_out", "fade": 5.0, "note": "the aircraft leaves; do not cut it"},
        {"at": 12.0, "cue": "chile_amb", "action": "fade_in", "fade": 3.0, "note": "dry wind in poplars, far below a dog, nothing else"},
        {"at": 15.4, "cue": "bike_bell", "action": "oneshot", "note": "the same bell as stage 1, once, unanswered"},
    ],
    "next": {"chapter": "chile", "start": "bicycle standing at the lookout; first input starts the ride. The closing card of the journey belongs to the end of this chapter, not to the transition."},
    "reduced_motion": "Three stills with 0.6 s cross-fades: key 3.0 → key 8.0 → key 15.0. Bell kept.",
    "no_webgl": "Text bridge between stages 5 and 6 (world.bridge.t05); the fallback's last line may echo the first stage's.",
})

# =====================================================================================
# Shared grammar, sound palette, order
# =====================================================================================
DOC = {
    "version": 1,
    "generated_by": "tools/world/blender/scenes/journey.py",
    "space": "game axes: x left, y up, z forward, metres; yaw in radians about +y; fov = vertical degrees (three.js)",
    "camera_spaces": {
        "vehicle": "local to the root of the asset named in relative_to (the player's vehicle unless stated)",
        "asset": "local to the stamped asset named in relative_to",
        "layout": "the space of public/world/layouts/<relative_to>.json — add the offset and yaw the chapter stamps that layout with",
        "set": "local to this transition's own set (see set.anchor)",
    },
    "order": [
        {"stage": 1, "chapter": "murcia", "vehicle": "bicycle"},
        {"stage": 2, "chapter": "europe", "vehicle": "train"},
        {"stage": 3, "chapter": "europe-bus", "vehicle": "bus"},
        {"stage": 4, "chapter": "japan", "vehicle": "ship", "change": "was order 5"},
        {"stage": 5, "chapter": "asia", "vehicle": "airplane", "change": "was order 4; now reads as the departure toward Chile"},
        {"stage": 6, "chapter": "chile", "vehicle": "bicycle"},
    ],
    "stage_tense": {
        "note": "Which stages are memories and which are plans is the owner's to state; the director only reserves the visual treatment.",
        "japan": "future / aspiration per the owner's brief — never caption it as something that happened. Treatment: the t03 route line is dashed over the jump, and the stage opens in first light.",
        "others": "to be confirmed in the narrative review before any caption uses the past tense",
    },
    "grammar": {
        "letterbox": "use the engine's existing cine bars (emit('cine', true)) for the whole of every transition; input locked (st.lock)",
        "one_idea": "each transition is one shape handed from one vehicle to the next: circle, doorway, horizon, light, white",
        "camera": "one continuous move per side, eased in and out (sine); never more than 2 m/s of camera travel near people, never a roll; hold at least 1 s on the matched frame before and after a splice",
        "splice": "always on a frame the engine can hold as a still (held-frame overlay) — that still is the loading screen",
        "colour": "fog colour = horizon colour of the sky on both sides; bridge by lerping fog, sun colour and sun elevation, never by a black fade (t02's dark hall is motivated darkness, not a fade)",
        "signage": "labels use the palette already in the assets: cream #f1ede2 on navy #27405a or station green #27512f; signal red #b8432f only for one accent per frame",
        "people": "the engine's people stand where anchors of kind 'boarding', 'seat' and 'poi' are: getting off the train, waiting by the bus door, on the pier, at the lookout. Hospitality is shown by who is waiting, not by text.",
        "duration": "9–16 s each, skippable after 1.5 s (skip = jump to the last key and hand over)",
    },
    "sound_palette": {
        "note": "Proposals for WebAudio synthesis in the style of game.js tone(); no audio files exist or are implied. Replace any of them with original or licensed recordings.",
        "bus": "one master gain; every loop cue has its own gain node so fades and ducks are ramps (linearRampToValueAtTime), never starts/stops",
        "cues": {
            "bike_bell": "existing fx.sound('bell') (1560 Hz, two strikes)",
            "bike_roll": "band-passed noise 700–1100 Hz, gain ∝ speed; plus bike_freewheel",
            "bike_freewheel": "clicks (2 ms noise bursts, high-pass 3 kHz) at 14 Hz × speed/5",
            "station_amb": "low-passed noise 300 Hz at low gain + sparse footsteps",
            "station_chime": "two sine notes 660 → 880 Hz, 0.5 s each, soft attack",
            "train_roll": "low-passed noise 220 Hz, gain ∝ speed; double thump (60 Hz sine, 40 ms, twice 90 ms apart) every 25 m of travel",
            "train_brake": "band-passed noise sweeping 3 kHz → 1.2 kHz over 1.8 s, Q 12",
            "train_brake_release": "white noise, high-pass 2 kHz, 0.35 s decay",
            "door_hiss": "white noise, high-pass 2 kHz, 0.5 s, fast attack",
            "footsteps": "30 ms low-passed noise thumps at 1.9 Hz, alternate ±10% pitch",
            "bus_idle": "sawtooth 46 Hz through low-pass 220 Hz with 11 Hz tremolo",
            "bus_engine": "same voice, 55–95 Hz ∝ speed, low-pass 320 Hz",
            "wind": "noise band-pass 400–1200 Hz, centre drifting on a 0.1 Hz LFO",
            "route_tick": "1 ms click through a 2 kHz resonator, very quiet",
            "sea_wash": "low-passed noise 500 Hz, gain on a 0.12 Hz LFO (swell), a second layer at 0.31 Hz for the hull slap",
            "ship_engine": "sine 38 Hz + 76 Hz, slow 2 Hz throb",
            "ship_horn": "two triangle notes 110 + 138 Hz together, 2.2 s, slow attack; (the engine's 'horn' at 311 Hz is the bus/train horn)",
            "harbour_amb": "sea_wash at half gain + random metallic ticks (4 kHz, 20 ms) every 1–3 s",
            "apron_amb": "noise band-pass 1.8 kHz, very low gain, wide",
            "cabin_chime": "two sine notes 880 → 660 Hz, 0.4 s each",
            "jet_idle": "noise band-pass 1.6 kHz Q 2 + sine 120 Hz",
            "jet_cruise": "noise low-pass 900 Hz + sine 140 Hz; 'pitch_down' = both fall 15%",
            "chile_amb": "wind at low gain with a slower LFO; leaf rustle = noise high-pass 3 kHz in 0.4 s swells",
        },
    },
    "new_assets": ["journey/cloud_bank", "journey/cloud_sea"],
    "sequences": SEQ,
}

if ONLY is None:
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf8") as f:
        json.dump(DOC, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print("[journey] wrote", os.path.relpath(OUT_JSON, REPO), "-", len(SEQ), "sequences")
