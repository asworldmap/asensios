"""Two-storey town house, lime-washed, green shutters."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import _house  # noqa: E402

SPEC = {
    "id": "townhouse_a",
    "pack": "murcia",
    "asset_class": "batched",
    "author": "Claude (pipeline reference asset)",
    "seed": 21,
    "tri_budget": 5200,
    "ao_distance": 1.8,
    "preview_dir": (0.7, -1.0, 0.34),
    "params": {"w": 5.2, "d": 4.4, "floors": 2, "plaster": "#f2e7d1", "shutters": "#3f6b55"},
}


def build(k):
    _house.make(k, **k.params)
