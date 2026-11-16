"""The Railway Journey — the art reference for the European chapter.

The train comes out of a tunnel, crosses a stone viaduct over a river valley
and draws into a country junction station, with the mountains behind it all.

The track is the z axis (x = 0, rail top y = 0). The station is at z = 30 on
the +x side; the viaduct runs z = 60..130; the tunnel mouth is at z = 140.
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _scene import Scene  # noqa: E402

from mathutils import Vector  # noqa: E402
from mathutils import noise as mnoise  # noqa: E402

R = random.Random(11)
S = Scene("europe_railway")
PI = math.pi
OFF = Vector((5.3, 1.9, 0))


def smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def height(x, z):
    """Render terrain; also used to stand trees on the ground."""
    roll = 2.2 * mnoise.noise(Vector((x * 0.012, z * 0.012, 0)) + OFF) * smooth((abs(x) - 14) / 30)
    valley = -17.6 * smooth((z - 58) / 22) * smooth((132 - z) / 22)
    side = smooth((abs(x) - 30) / 90) * 10 * (0.6 + 0.4 * mnoise.noise(Vector((x * 0.01, z * 0.01, 4)) + OFF))
    lim = 150 if abs(x) < 9 else 138
    hill = 13 * smooth((z - lim) / 26) * (0.8 + 0.2 * mnoise.noise(Vector((x * 0.03, z * 0.03, 2)) + OFF))
    station = 0.9 * smooth((x - 5.5) / 1.5) * smooth((62 - z) / 8) * smooth((z + 5) / 8) * smooth((40 - x) / 10)
    knoll = 0.0
    bed = -0.55 if abs(x) < 3.2 and z < 150 else 0.0
    return max(valley + roll + side * (1 - smooth((z - 40) / 18) * smooth((150 - z) / 18)) + hill + station + knoll, valley - 1) + (bed if valley > -1 else 0)


# ---- The line -----------------------------------------------------------------------
for i in range(-8, 15):
    S.place("europe/rail_track_straight", 0, 0, i * 10 + 5, note="track tile (10 m)")
for z in (67, 81, 95, 109, 123):
    S.place("europe_v2/viaduct_arch", 0, 0, z, note="viaduct span (14 m); deck top = rail top")
S.place("europe_v2/tunnel_portal", 0, 0, 140, PI, note="mouth faces the viaduct (-z)")
for z in range(-60, 60, 30):
    S.place("europe/catenary_mast", -3.2, 0, z, 0)
S.place("europe/rail_signal", -2.6, 0, 56, PI)
S.place("europe/rail_signal", -2.6, 0, -12, 0)

# ---- The station ----------------------------------------------------------------------
for z in (5, 15, 25, 35, 45, 55):
    S.place("europe/rail_platform", 0, 0, z, note="existing platform edge tile")
for z in (15, 25, 35, 45):
    S.place("europe_v2/platform_paving", 8.87, 0.92, z, note="platform floor up to the station front")
S.place("europe_v2/station_building", 12.5, 0.92, 30, -PI / 2, note="front faces the track (-x); origin at platform level")
S.place("europe_v2/station_canopy", 12.5, 0.92, 30, -PI / 2, note="same transform as the building")
S.place("europe_v2/signal_box", -8.5, 0, 2, PI / 2, note="across the line from the station")
for z in (12, 48):
    S.place("common/park_bench", 6.6, 0.92, z, -PI / 2)
S.place("common/street_lamp", 7.2, 0.92, 8, 0)
S.place("common/street_lamp", 7.2, 0.92, 52, 0)
S.place("europe/road_sign", 6.0, 0.92, 6, -PI / 2, note="station name board")
S.place("common/planter", 6.9, 0.92, 20, 0)
S.place("common/planter", 6.9, 0.92, 40, 0)

# ---- The train: just in off the viaduct -----------------------------------------------
S.place("vehicles/train_cab", 0, 0, 52, PI, note="heading -z into the platform")
for i in (1, 2, 3):
    S.place("vehicles/train_coach", 0, 0, 52 + i * 18.1, PI)

# ---- Country ---------------------------------------------------------------------------
CAM = (-62.0, 0.0, 30.0)


def blocked(x, z):
    """Keep the sight line from the viewpoint to the line clear."""
    return -78 < x < -5 and 16 < z < 140 and not (x < -24 and (62 < z < 78 or 112 < z < 132))


def tree(key, x, z, s=1.0):
    if blocked(x, z):
        return
    S.place(key, x, height(x, z) - 0.15, z, R.random() * 6.28, s * (0.85 + R.random() * 0.35))


for x, z in ((24, 14), (27, 44), (22, 58), (-16, 22), (-20, -14), (30, -8), (-28, 44), (40, 30), (-12, 50)):
    tree("europe_v2/broadleaf_tree", x, z)
for x, z in ((-13, -4), (-15, 9), (19, 4), (21, 50), (-22, 34), (-9, 38), (34, 52), (-36, 20)):
    tree("europe_v2/birch_tree", x, z)
for i in range(70):  # spruce on the valley sides and over the tunnel
    x = (R.random() - 0.5) * 150
    z = R.choice((R.uniform(60, 76), R.uniform(114, 136), R.uniform(140, 185)))
    if abs(x) < 7 and z < 152:
        continue
    tree("europe_v2/spruce_tall", x, z, 0.9)
for i in range(26):
    x = R.choice((-1, 1)) * R.uniform(55, 130)
    tree("europe/conifer" if i % 3 else "europe_v2/spruce_tall", x, R.uniform(-40, 60), 1.2)
tree("europe_v2/broadleaf_tree", -41, -2, 1.1)
S.place("europe_v2/broadleaf_tree", -56, height(-56, 57) - 0.2, 57, 1.0, 1.0, note="frames the view")
S.place("europe_v2/hedgerow", -52, height(-52, 44), 44, 0.9)
S.place("europe_v2/birch_tree", -30, height(-30, 22) - 0.2, 22, 2.0, 1.0)
for x, z, yaw in ((-12, 14, 0.0), (-12, 24, 0.0), (-12, 34, 0.0), (30, 16, 0.1), (46, -20, 1.2)):
    S.place("europe_v2/hedgerow", x, height(x, z), z, yaw)
for x, z in ((-95, 40), (95, 20), (-80, -50), (85, -60), (110, 110), (-110, 120)):
    S.place("europe_v2/meadow_hill", x, height(x, z) - 1.0, z, R.random() * 6, 1.3, note="rolling country")
for x, z, yaw in ((-44, 30, 1.2), (-53, 34, 1.2), (-40, 44, 0.2)):
    S.place("europe_v2/hedgerow", x, height(x, z), z, yaw)

# ---- Mountains --------------------------------------------------------------------------
for i in range(-2, 3):
    S.place("europe_v2/alps_backdrop", i * 250, -6, 420 + abs(i) * 30, PI + i * 0.18, 4.2, note="horizon; scale 4.2")
for i in (-1, 0, 1):
    S.place("europe_v2/alps_backdrop", i * 190 + 60, -4, 290, PI + i * 0.2, 2.6, note="nearer range; scale 2.6")

# ---- Render-only set ---------------------------------------------------------------------


def color(x, z, h):
    n = mnoise.noise(Vector((x * 0.03, z * 0.03, 2)) + OFF)
    if abs(x) < 3.0 and -1.5 < h < 0.2 and z < 150:
        return "#9d927f"
    if h < -15.5:
        return "#7d8a6a"
    if 6 < x < 30 and 0 < z < 60:
        return "#b5ad9c"
    if n > 0.22:
        return "#c2c66e" if math.sin((x + z * 0.6) * 0.9) > 0 else "#d2cc80"
    if n < -0.25:
        return "#5f8f40"
    return "#7fa848" if n > 0 else "#8db552"


S.ground(size=900, height=height, color=color, res=220, y=-0.05)
S.water(0, 95, 900, 11, y=-17.0, color="#4f8f96", rough=0.06)
S.light(sun_dir=(-0.62, 0.48, -0.5), sun_color="#fff0d4", sun_energy=4.8, sky_top="#4a8fc8", sky_horizon="#e4eef2", sky_strength=1.2)
S.haze(density=0.0013, color="#dfeaf0")
S.camera(pos=(-66, 15.5, 20), look=(0, -7.0, 88), lens=24)
S.finish(notes=[
    "Track = z axis, rail top y = 0. Station at z = 30 on +x; viaduct z = 60..130; tunnel mouth at z = 140.",
    "Station building and canopy sit at platform level (y = 0.92); raise the ground behind the station to match.",
    "The valley under the viaduct is 17 m deep with a river at z = 95; tree y values follow the render terrain — re-seat them on the chapter's own heightAt().",
    "Cinematic viewpoint for the train's arrival: camera block (a knoll west of the station looking up the line).",
])
