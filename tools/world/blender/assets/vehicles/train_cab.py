"""Regional train — cab car (driving end with nose, pantograph)."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import _train  # noqa: E402

SPEC = {
    "id": "train_cab",
    "pack": "vehicles",
    "asset_class": "hero",
    "author": "Claude (vehicle factory)",
    "seed": 5,
    "tri_budget": 14000,
    "ao_distance": 0.9,
    "preview_dir": (0.9, -1.0, 0.3),
    "meta": {"chapter": "europe", "vehicle": "train", "length": 17.2, "width": 2.86, "height": 3.92, "coupling_pitch": 17.92, "origin": "rail top, car centre", "gauge": 1.435, "wheel_radius": 0.46},
}


def build(k):
    _train.make(k, cab=True)
