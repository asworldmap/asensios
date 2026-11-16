"""Narrow rose-plaster town house with a balcony."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import _house  # noqa: E402

SPEC = {
    "id": "townhouse_c",
    "pack": "murcia",
    "asset_class": "batched",
    "author": "Claude (pipeline reference asset)",
    "seed": 52,
    "tri_budget": 5200,
    "ao_distance": 1.8,
    "preview_dir": (0.7, -1.0, 0.34),
    "params": {"w": 4.0, "d": 4.2, "floors": 2, "plaster": "#dcae94", "shutters": "#5a4636", "balcony": True, "chimney": False},
}


def build(k):
    _house.make(k, **k.params)
