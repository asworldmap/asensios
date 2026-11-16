"""Huerta farmhouse: one storey, wide, with a vine pergola."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import _house  # noqa: E402

SPEC = {
    "id": "farmhouse",
    "pack": "murcia",
    "asset_class": "batched",
    "author": "Claude (pipeline reference asset)",
    "seed": 63,
    "tri_budget": 5200,
    "ao_distance": 1.8,
    "preview_dir": (0.7, -1.0, 0.34),
    "params": {"w": 7.0, "d": 4.6, "floors": 1, "plaster": "#f4ead6", "shutters": "#3f6b55", "porch": True},
}


def build(k):
    _house.make(k, **k.params)
