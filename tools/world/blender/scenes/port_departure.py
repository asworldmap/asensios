"""The Ocean Journey — the art reference for the sea chapter.

Early light in a small port. The ship lies alongside the quay with her gangway
down; a timber pier, moored boats, a breakwater with its light, a headland
across the bay and far islands on the horizon. Seen from the pier head.

The quay face runs along z at x = 0; open water is -x, land is +x. Waterline
y = 0, quay and pier decks y = 1.6. The ship lies at x = -7, bow toward +z.
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _scene import Scene  # noqa: E402

from mathutils import Vector  # noqa: E402
from mathutils import noise as mnoise  # noqa: E402

R = random.Random(23)
S = Scene("port_departure")
PI = math.pi
DECK = 1.6

# ---- Quay and ship ------------------------------------------------------------------
for i in range(-6, 7):
    S.place("maritime/quay_section", 0, 0, i * 10, note="existing quay tile; face at x = 0")
S.place("vehicles/passenger_ship", -7.0, 0, -4, 0, note="alongside, bow +z")
S.place("maritime_v2/gangway", 2.0, DECK, 6, PI, note="foot on the quay, head at the ship's 4.4 m deck")
for z in (-35, -15, 20, 40):
    S.place("maritime/harbour_light", 6.5, DECK, z, 0)
S.place("maritime_v2/harbour_office", 17, DECK, 2, -PI / 2, note="front faces the quay (-x)")
S.place("maritime_v2/harbour_office", 19, DECK, -34, -PI / 2 + 0.12)
S.place("maritime_v2/dock_clutter", 4.5, DECK, 22, 0.3)
S.place("maritime_v2/dock_clutter", 5.5, DECK, -22, 2.4)
S.place("maritime_v2/dock_clutter", 9.0, DECK, 44, 1.2)
for x, z, s in ((3.5, 14, 1.0), (4.8, 14.6, 1.0), (4.1, 14.2, 1.0), (3.2, -10, 1.0), (7.5, 30, 1.0)):
    S.place("maritime/cargo_crate", x, DECK + (1.2 if (x, z) == (4.1, 14.2) else 0), z, R.random() * 3, s)
for z in (-28, 34):
    S.place("maritime/life_ring_stand", 1.2, DECK, z, -PI / 2)
for z in (10, -4):
    S.place("common/park_bench", 9.5, DECK, z, -PI / 2)
S.place("common/signpost", 8.5, DECK, 9, 0)

# ---- The pier (leaves the quay at z = 62, runs out to -x) ---------------------------------
for i in range(4):
    S.place("maritime_v2/pier_section", -5 - i * 10, 0, 62, -PI / 2, note="pier tile; local +z runs seaward")
S.place("maritime_v2/pier_head", -44, 0, 62, -PI / 2, note="bench and beacon face the open sea")
S.place("maritime_v2/fishing_boat", -14, 0, 56.6, PI / 2 + 0.06, note="moored on the pier's south side")
S.place("maritime_v2/fishing_boat", -27, 0, 67.4, -PI / 2 - 0.1)
S.place("maritime_v2/fishing_boat", -3.2, 0, 47, 0.08, 0.9)
S.place("maritime_v2/fishing_boat", -25, 0, 43, PI + 0.9, note="heading out")
S.place("maritime/mooring_buoy", -30, 0, 40, 0)
S.place("maritime/mooring_buoy", -46, 0, 20, 1.0)
S.place("maritime_v2/deck_bench", -8, DECK, 62.9, PI, note="also at home on the ship's decks")

# ---- Breakwater and light ------------------------------------------------------------------
for i in range(4):
    S.place("maritime_v2/breakwater", 2 - i * 20, 0, -80 + i * 4, PI / 2 + 0.2, note="rubble mole sheltering the berth")
S.place("maritime_v2/lighthouse", -64, 0, -68, 0.6, note="at the mole end")

# ---- Ship's deck dressing (complementary pieces, shown on the boat deck) ----------------------
for z in (-14, -6, 10):
    S.place("maritime_v2/deck_vent", -7, 9.8, z, 0, note="on the ship's upper deck (y = 9.8)")
S.place("maritime_v2/deck_bench", -10.2, 7.15, 4, PI / 2, note="promenade deck (y = 7.15)")

# ---- The coast --------------------------------------------------------------------------------
S.place("maritime_v2/coast_headland", -210, 0, -230, 0.35, 2.2, note="headland across the bay")
S.place("maritime_v2/coast_headland", -60, 0, -300, 0.1, 2.6)
for x, z, yaw, sc in ((66, -70, PI / 2 + 0.2, 1.5), (72, 0, PI / 2, 1.6), (64, 70, PI / 2 - 0.2, 1.4), (70, 140, PI / 2 + 0.4, 1.6), (120, -150, PI / 2, 2.4)):
    S.place("maritime_v2/coast_headland", x, 0, z, yaw, sc, note="wooded rise behind the port")
for x, z, yaw, s in ((-640, -260, 0.3, 6.5), (-700, 80, -0.25, 7.5), (-560, -520, 0.7, 5.5)):
    S.place("maritime_v2/horizon_islands", x, 0, z, PI / 2 + yaw, s, note="far islands; scale 5.5–7.5")
for i in range(14):
    x, z = 26 + R.random() * 30, -70 + R.random() * 150
    S.place("europe/conifer", x, DECK + (x - 20) * 0.12, z, R.random() * 6, 0.9 + R.random() * 0.5)

# ---- Render-only set ----------------------------------------------------------------------------
OFF = Vector((2.2, 8.1, 0))


def height(x, z):
    shore = 5.5 + 3.0 * mnoise.noise(Vector((z * 0.03, 0, 0)) + OFF) * (1 if abs(z) > 66 else 0)
    t = min(1.0, max(0.0, (x - shore + 3) / 3.0))
    inland = max(0.0, x - 20) * 0.12
    return -6 + (DECK + 6 + inland) * t * t * (3 - 2 * t)


def color(x, z, h):
    if h < 0.3:
        return "#3d4a44"
    if h < DECK - 0.05:
        return "#7c766a"
    n = mnoise.noise(Vector((x * 0.08, z * 0.08, 1)) + OFF)
    if x < 30:
        return "#b3ad9f" if n > 0 else "#a9a395"
    return "#7f9a55" if n > 0 else "#6f8c4c"


S.ground(size=900, height=height, color=color, res=260, y=-0.02)
W = S.water(-200, 0, 1900, 1900, y=0.0, color="#17586c", rough=0.1)
nt = W.data.materials[0].node_tree
next(n for n in nt.nodes if n.type == "TEX_NOISE").inputs["Scale"].default_value = 700.0
next(n for n in nt.nodes if n.type == "BUMP").inputs["Strength"].default_value = 0.3
S.light(sun_dir=(-0.55, 0.26, 0.62), sun_color="#ffdcb2", sun_energy=4.6, sky_top="#5b9ccb", sky_horizon="#f6dcc0", sky_strength=1.15)
S.haze(density=0.0011, color="#f1e2d2")
S.camera(pos=(-47.0, DECK + 2.5, 67.0), look=(-22, 6.5, 0), lens=24)
S.finish(notes=[
    "Quay face = z axis at x = 0; water is -x, land +x. Waterline y = 0; quay and pier decks y = 1.6.",
    "Ship (existing vehicles/passenger_ship) lies at x = -7, bow +z. Gangway head meets her 4.4 m deck.",
    "Camera = the pier head 'view' anchor: the departure shot. Reverse it for the arrival.",
    "Water, sky, haze are render-only; see ART_HANDOFF.md 'Ocean technique' for the web version.",
])
