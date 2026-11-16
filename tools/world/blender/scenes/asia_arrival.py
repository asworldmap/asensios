"""Arrival — the art reference for the Asian chapter.

First light on a remote stand. The airliner has just shut down; the stairs are
at the door, the tug is waiting, the terminal glows behind and a hazy skyline
stands on the horizon. A modern airport, deliberately without borrowed symbols.

The aircraft is at the origin, nose toward +z. The terminal is at z = -62.
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _scene import Scene  # noqa: E402

from mathutils import Vector  # noqa: E402
from mathutils import noise as mnoise  # noqa: E402

R = random.Random(31)
S = Scene("asia_arrival")
PI = math.pi

# ---- Apron -------------------------------------------------------------------------
for i in range(-3, 4):
    for j in range(-2, 4):
        S.place("asia_v2/apron_tile", i * 20, -0.03, j * 20, note="apron tile (20 m)")

# ---- The stand ------------------------------------------------------------------------
S.place("vehicles/airliner", 0, 0, 0, 0, note="existing aircraft; nose +z")
S.place("asia_v2/airstairs", 7.1, 0, 13.9, PI, note="top landing at the aircraft's door_front")
S.place("asia_v2/pushback_tug", 0.3, 0, 27.0, PI, note="tow bar toward the nose wheel")
S.place("asia/baggage_cart", 9.5, 0, -1.0, 0.25)
S.place("asia/baggage_cart", 10.6, 0, -8.2, 0.2)
S.place("asia/baggage_cart", 15.5, 0, 6.0, 1.3)
for z in range(-30, 61, 15):
    for x in (-34, 34):
        S.place("asia/runway_light", x, 0, z, 0)
S.place("asia_v2/windsock", 44, 0, 34, 0.4)

# ---- Terminal and tower ------------------------------------------------------------------
S.place("asia_v2/terminal_hall", -21, 0, -62, 0, note="glass front faces the apron (+z)")
S.place("asia_v2/terminal_hall", 21, 0, -62, 0)
S.place("asia_v2/control_tower", -50, 0, -86, 0, note="tower; base block toward the terminal")
for x in (-36, -26, -16, 6, 16, 26, 36):
    S.place("asia/terminal_bay", x, 0, -49.5, -PI / 2, note="existing gate bay against the hall")
S.place("asia/jet_bridge", -26, 0, -46, -PI / 2)
S.place("asia/jet_bridge", 26, 0, -46, -PI / 2)

# ---- Landside green and the city -------------------------------------------------------------
for x, z in ((-78, -50), (-84, -22), (-80, 8), (-86, 36), (82, -20), (86, 12), (80, 44), (-60, -88), (0, -92), (60, -90)):
    S.place("asia_v2/rain_tree", x, 0, z, R.random() * 6, 0.9 + R.random() * 0.3)
for x, z in ((-70, -30), (-73, 22), (74, -2), (72, 30)):
    S.place("asia/bamboo_clump", x, 0, z, R.random() * 6, 1.2)
for i in range(-3, 4):
    S.place("asia_v2/skyline_backdrop", i * 330, 0, -900 - abs(i) * 30, i * 0.12, 6.5, note="far skyline; scale 6.5")
for i in (-1, 0, 1):
    S.place("asia_v2/skyline_backdrop", i * 300 + 120, 0, -640, PI + i * 0.1, 4.0, note="nearer district; scale 4")

# ---- Render-only set --------------------------------------------------------------------------
OFF = Vector((4.4, 0.6, 0))


def color(x, z, h):
    n = mnoise.noise(Vector((x * 0.05, z * 0.05, 1)) + OFF)
    if abs(x) < 70 and -75 < z < 70:
        return "#b3b1a8"
    return "#6f9450" if n > 0 else "#7fa258"


S.ground(size=2400, height=None, color=color, res=200, y=-0.06)
S.light(sun_dir=(-0.8, 0.17, -0.42), sun_color="#ffc88e", sun_energy=4.6, sky_top="#6f9fc6", sky_horizon="#ffd8ae", sky_strength=1.1)
S.haze(density=0.0016, color="#ffe3c4")
S.camera(pos=(21.0, 1.7, 38.0), look=(-1.0, 6.5, 0.0), lens=27)
S.finish(notes=[
    "Aircraft at the origin, nose +z. Airstairs on its +x side at door_front; terminal 62 m behind the tail.",
    "Dawn: sun very low behind the terminal (rim light on the fuselage). Warm, humid haze.",
    "Skyline is generic and far: scale 6.5 at ~900 m, scale 4 at ~640 m; let fog take most of it.",
])
