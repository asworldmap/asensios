"""Lemon tree for the huerta — the full version, used beside the road."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import _tree  # noqa: E402

SPEC = {
    "id": "lemon_tree",
    "pack": "murcia",
    "asset_class": "batched",
    "author": "Claude (pipeline reference asset)",
    "seed": 4,
    "tri_budget": 1600,
    "ao_distance": 1.6,
    "preview_dir": (0.8, -1.0, 0.28),
}


def build(k):
    _tree.make(k, detail=2)
