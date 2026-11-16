"""Mediterranean Arrival — the art reference for Murcia (and for the whole game).

The rider comes in from the huerta at golden hour: irrigation channel and
crops in the foreground, the plaza opening ahead, the church closing the view,
the sierra behind. Everything placed here is a built asset; the layout file is
what the web agent places in the chapter.

Plaza centre is the origin. +z is south (toward the huerta), the church is north.
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _scene import Scene  # noqa: E402

from mathutils import Vector  # noqa: E402
from mathutils import noise as mnoise  # noqa: E402

R = random.Random(7)
S = Scene("murcia_arrival")
PI = math.pi

# ---- Plaza floor: 3 x 3 paving tiles -------------------------------------------
for i in (-1, 0, 1):
    for j in (-1, 0, 1):
        S.place("murcia_v2/plaza_paving", i * 10, -0.04, j * 10, note="plaza floor tile")

# ---- North side: church and tower close the square ------------------------------
S.place("murcia_v2/church", 1.5, 0, -15.5, 0, note="front faces the plaza (+z)")
S.place("murcia_v2/church_tower", 1.5 - 6.0, 0, -17.5, 0, note="at the church's ANCHOR_tower_site")
for x in (9.5, 12.5):
    S.place("murcia_v2/cypress_tall", x, 0, -17.5 - (x - 9.5) * 0.6, R.random() * 6, 0.9 + R.random() * 0.25)

# ---- West side (x > 0 is the rider's left): arcade and shop -----------------------
S.place("murcia_v2/arcade_house", 19.0, 0, -4.0, -PI / 2, note="arcade faces the plaza")
S.place("murcia_v2/shop_house", 18.0, 0, 7.5, -PI / 2)
S.place("murcia/townhouse_b", 19.5, 0, -13.5, -PI / 2)
S.place("murcia_v2/cafe_terrace", 10.5, 0, -3.5, -PI / 2, note="in front of the arcade")
S.place("murcia_v2/laundry_line", 18.6, 0, 2.2, PI / 2, 0.9)

# ---- East side: houses and the market -------------------------------------------------
S.place("murcia/townhouse_c", -19.0, 0, -11.0, PI / 2)
S.place("murcia/townhouse_a", -19.5, 0, -3.0, PI / 2)
S.place("murcia_v2/shop_house", -18.5, 0, 6.0, PI / 2)
S.place("murcia_v2/market_stall", -11.5, 0, -6.5, PI / 2 + 0.25)
S.place("murcia_v2/market_stall", -11.0, 0, -1.5, PI / 2 - 0.1)
S.place("maritime/cargo_crate", -9.6, 0, -4.2, 0.4, 0.55)
S.place("murcia/orange_crate", -9.8, 0, -8.6, 1.1, 1.3)

# ---- The middle of the square ---------------------------------------------------------
S.place("murcia_v2/bandstand", -1.5, 0, -1.5, 0, note="story point: Murcia Welcomes You")
S.place("murcia_v2/fountain_plaza", 6.0, 0, 7.0, 0.3)
S.place("murcia_v2/notice_board", -6.5, 0, 9.5, 0.5, note="story point stand (label_face)")
S.place("murcia_v2/bougainvillea_pergola", -9.5, 0, 11.5, 0.15)
for x, z in ((-12.5, 12.8), (12.6, 12.4), (12.8, -11.0), (-13.0, -12.2), (0.5, 13.2)):
    S.place("murcia_v2/orange_tree", x, 0, z, R.random() * 6, 0.9 + R.random() * 0.2)
for x, z, yaw in ((3.0, 12.6, PI), (-3.2, 12.9, PI), (9.5, 10.5, -PI * 0.75)):
    S.place("common/park_bench", x, 0, z, yaw)
for x, z in ((14.2, 14.2), (-14.2, 14.2), (-14.0, -8.0), (13.6, 1.5), (6.5, -9.5)):
    S.place("common/street_lamp", x, 0, z, math.atan2(-x, -z))
for x, z in ((8.7, 12.3), (-5.5, 13.5)):
    S.place("common/planter", x, 0, z, 0, 1.0)

# ---- South: the huerta arrives at the edge of town -----------------------------------------
for i in range(-3, 4):
    S.place("murcia_v2/acequia", i * 10, -0.05, 21.0, PI / 2, note="irrigation channel, tiles along x")
for i, x in enumerate((-34, -24, -14, 14, 24, 34)):
    for j, z in enumerate((29, 39, 49)):
        S.place("murcia_v2/huerta_rows", x, -0.02, z, 0 if (i + j) % 2 else PI / 2)
S.place("murcia_v2/noria", -27.0, 0, 20.0, PI / 2, note="wheel in the channel; aqueduct runs east")
for x, z in ((-8, 27), (8.5, 28.5), (-10.5, 36), (10, 38), (-13, 45), (12.5, 47), (-41, 24), (41, 25), (30, 22.5)):
    S.place("murcia_v2/olive_tree" if (x + z) % 3 else "murcia/lemon_tree", x, 0, z, R.random() * 6, 0.9 + R.random() * 0.3)
for x, z in ((5.2, 23.5), (-5.6, 24.2), (-12, 23.8), (22, 23.6), (-36, 22.8)):
    S.place("murcia_v2/prickly_pear", x, 0, z, R.random() * 6, 0.8 + R.random() * 0.4)
for x in (-18, -9.5, 11, 19.5, 33):
    S.place("murcia_v2/river_reeds", x, 0, 19.6 + R.random() * 0.5, R.random() * 6, 0.8 + R.random() * 0.3)
for z in (26, 34, 42, 50):
    S.place("murcia/stone_wall", 3.4, 0, z, 0)
    S.place("murcia/stone_wall", -3.4, 0, z + 2, 0)
S.place("murcia/farmhouse", 24.0, 0, 33.0, -PI * 0.6)
for x, z in ((-22, 14.5), (23, 15.5), (-30, 9), (30, -22), (-29, -24)):
    S.place("murcia/palm_tree", x, 0, z, R.random() * 6, 1.0 + R.random() * 0.25)

# ---- Beyond the town: more roofs, then the sierra -----------------------------------------------
for x, z, yaw, key in ((-31, -9, PI / 2, "murcia/townhouse_b"), (31, -14, -PI / 2, "murcia/townhouse_a"), (-30, 3, PI / 2, "murcia/townhouse_a"), (30, 2, -PI / 2, "murcia/townhouse_c"),
                       (14, -30, 0, "murcia/townhouse_b"), (-12, -31, 0, "murcia/townhouse_c"), (25, -31, 0, "murcia_v2/shop_house"), (-26, -33, 0.2, "murcia/townhouse_a")):
    S.place(key, x, 0, z, yaw)
for i in range(-2, 3):
    S.place("murcia_v2/sierra_backdrop", i * 92, -2.0, -190 - abs(i) * 16, (i * -0.2), 1.9, note="horizon; scale 1.9")
S.place("murcia_v2/sierra_backdrop", -190, -2, -60, PI / 2 * 0.8, 1.7)
S.place("murcia_v2/sierra_backdrop", 190, -2, -60, -PI / 2 * 0.8, 1.7)

# ---- The rider --------------------------------------------------------------------------------------
S.place("vehicles/city_bike", 0.6, 0.0, 24.5, PI + 0.12, note="hero; heading into the plaza")

# ---- Render-only set: ground, light, camera --------------------------------------------------------------
OFF = Vector((3.1, 7.7, 0))


def height(x, z):
    d = math.hypot(x, z)
    far = max(0.0, (d - 55) / 80)
    return far * far * 5 * (0.6 + 0.4 * mnoise.noise(Vector((x * 0.02, z * 0.02, 0)) + OFF)) + 0.25 * mnoise.noise(Vector((x * 0.07, z * 0.07, 1)) + OFF) * min(1.0, max(0.0, (d - 20) / 20))


def color(x, z, h):
    n = mnoise.noise(Vector((x * 0.05, z * 0.05, 2)) + OFF)
    if abs(x) < 2.6 and z > 14:
        return "#bfa67c" if n > 0 else "#c9b189"  # the lane
    if z > 17 and abs(z) < 75:
        return "#8ea552" if n > 0.1 else "#9fb05c"  # huerta
    if h > 5:
        return "#b9a06f"
    return "#cdb78a" if n > 0 else "#d6c193"


S.ground(size=520, height=height, color=color, res=150, y=-0.05)
S.light(sun_dir=(0.7, 0.36, 0.62), sun_color="#ffdcae", sun_energy=5.2, sky_top="#5f9fc9", sky_horizon="#f8e2b8", sky_strength=1.25)
S.haze(density=0.0011, color="#f6e4c0")
S.camera(pos=(-2.4, 2.5, 40.5), look=(0.8, 4.3, -6.0), lens=30)
S.finish(notes=[
    "Plaza centre = origin; +z = south (huerta); church to the north facing +z.",
    "Golden hour: sun low in the south-west (direction to sun in sun_direction).",
    "y offsets of -0.02..-0.05 sink floor tiles so they do not z-fight with terrain.",
])
