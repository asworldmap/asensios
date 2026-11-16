"""Three-storey town house with a balcony, ochre plaster, blue shutters."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import _house  # noqa: E402

SPEC = {
    "id": "townhouse_b",
    "pack": "murcia",
    "asset_class": "batched",
    "author": "Claude (pipeline reference asset)",
    "seed": 34,
    "tri_budget": 5200,
    "ao_distance": 1.8,
    "preview_dir": (0.7, -1.0, 0.34),
    "params": {"w": 4.6, "d": 4.6, "floors": 3, "plaster": "#e6c79c", "shutters": "#3d6480", "balcony": True, "door": "#3d6480"},
}


def build(k):
    _house.make(k, **k.params)
