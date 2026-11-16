"""Between the Andes and the valley — the art reference for the Chilean chapter.

Late afternoon at a roadside lookout. Below: vineyards, poplar windbreaks and
adobe farmhouses on the valley floor. Beyond: a pale city in the basin haze,
the dry folded foothills, and above everything the snow wall of the Andes
catching the last sun.

The lookout is the origin, open side toward +z (east, the mountains). The road
runs along x behind it. The valley floor is 42 m below, from z = 75 onward.
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _scene import Scene  # noqa: E402

from mathutils import Vector  # noqa: E402
from mathutils import noise as mnoise  # noqa: E402

R = random.Random(41)
S = Scene("chile_arrival")
PI = math.pi
OFF = Vector((7.1, 3.3, 0))
FLOOR = -42.0


def smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def height(x, z):
    slope = FLOOR * smooth((z - 5) / 70)
    bumps = 2.5 * mnoise.noise(Vector((x * 0.03, z * 0.03, 0)) + OFF) * smooth((z - 8) / 20) * smooth((80 - z) / 30)
    back = 3 * smooth((-z - 12) / 40) * (0.7 + 0.3 * mnoise.noise(Vector((x * 0.02, 0, 3)) + OFF))
    return slope + bumps + back


# ---- The lookout ------------------------------------------------------------------------
S.place("chile_v2/lookout_terrace", 0, 0, 0, 0, note="open side faces the view (+z)")
S.place("vehicles/coach_bus", 11.5, 0, -6.5, PI / 2 + 0.06, note="existing coach, pulled in beside the lookout")
for x, z, s in ((12, 7, 1.0), (-17, 12, 1.2), (20, 14, 1.2)):
    S.place("chile/rock_outcrop", x, height(x, z), z, R.random() * 6, s)
for i in range(22):
    x, z = (R.random() - 0.5) * 60, 7 + R.random() * 26
    S.place("chile/tussock_grass", x, height(x, z), z, R.random() * 6, 0.9 + R.random() * 0.6)
for x, z in ((-16, 14), (19, 20), (-26, 30), (9, 30), (30, 38), (-12, 44), (-36, 52), (22, 56), (-48, 22), (44, 14)):
    S.place("chile_v2/espino_tree", x, height(x, z) - 0.1, z, R.random() * 6, 0.9 + R.random() * 0.5, note="dry hillside")

# ---- The valley floor ----------------------------------------------------------------------
for i in range(-4, 5):
    for j in range(0, 6):
        if (i, j) in ((1, 1), (-2, 3), (2, 4)):
            continue  # farmyards
        S.place("chile_v2/vineyard_rows", i * 21.5, FLOOR, 96 + j * 21.5, 0 if (i + j) % 3 else PI / 2, note="vineyard tile (20 m) with a track between blocks")
for (x, z, yaw) in ((21.5, 117.5, 0.2), (-43, 160.5, -0.3), (43, 182, 0.1)):
    S.place("chile_v2/adobe_house", x, FLOOR, z, PI + yaw, note="farmhouse; corridor faces the lookout")
    S.place("chile_v2/poplar_row", x + 11, FLOOR, z, 0.1)
for x, z, yaw in ((-98, 110, 0), (-98, 150, 0), (98, 120, 0), (98, 170, 0), (-40, 228, PI / 2), (0, 228, PI / 2), (50, 230, PI / 2), (-70, 84, PI / 2), (64, 84, PI / 2), (-120, 200, 0.3), (130, 230, -0.2)):
    S.place("chile_v2/poplar_row", x, FLOOR, z, yaw, 1.0 + R.random() * 0.25, note="windbreak")

# ---- City, foothills, cordillera ---------------------------------------------------------------
for i in range(-2, 3):
    S.place("chile_v2/city_basin_backdrop", i * 250 + 30, FLOOR, 520 + abs(i) * 15, PI + i * 0.05, 3.4, note="city in the haze; scale 3.4")
for i in range(-2, 3):
    S.place("chile_v2/foothill_ridge", i * 420 + 60, FLOOR - 4, 860 + abs(i) * 20, PI + i * 0.12, 6.5, note="precordillera; scale 6.5")
for i, (x, z) in enumerate(((-260, 380), (300, 420))):
    S.place("chile_v2/foothill_ridge", x, FLOOR - 4, z, PI / 2 * (1 if x < 0 else -1) + 0.3, 2.6, note="side ridge closing the valley")
for i in range(-2, 3):
    S.place("chile_v2/cordillera_backdrop", i * 860, FLOOR - 10, 1250 + abs(i) * 60, PI + i * 0.14, 14.0, note="the Andes; scale 14")

# ---- Render-only set ------------------------------------------------------------------------------


def color(x, z, h):
    n = mnoise.noise(Vector((x * 0.04, z * 0.04, 2)) + OFF)
    if -9.5 < z < -3.5:
        return "#6f6a64"  # the road
    if h > FLOOR + 1.5:
        return "#b59f70" if n > 0 else "#c2ad7e"
    if z < 250 and abs(x) < 110:
        return "#b8a476"
    m = mnoise.noise(Vector((x * 0.012, z * 0.012, 6)) + OFF)
    return "#9fb060" if m > 0.15 else "#cdb984" if m < -0.15 else "#b3ae6c"


S.ground(size=3000, height=height, color=color, res=300, y=-0.05)
S.light(sun_dir=(0.42, 0.3, -0.86), sun_color="#ffd2a0", sun_energy=5.0, sky_top="#5f97c9", sky_horizon="#f3dcc6", sky_strength=1.15)
S.haze(density=0.0009, color="#ecdcc6")
S.camera(pos=(-3.0, 3.5, -4.5), look=(6, -8, 400), lens=26)
S.finish(notes=[
    "Lookout = origin, view toward +z. Road along x at z = -6.5. Valley floor 42 m below from z = 75.",
    "Backdrops in order of depth: city (scale 3.4 at 520 m), precordillera (6.5 at 860 m), Andes (14 at 1250 m).",
    "If the far plane is shorter, bring all three in proportionally and scale by the same factor.",
    "Evening sun from behind the viewer: the snow should be the brightest, warmest thing in frame.",
])
