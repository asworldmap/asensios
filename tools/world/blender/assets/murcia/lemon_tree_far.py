"""Lemon tree, distance version: same silhouette family, a fifth of the triangles."""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import _tree  # noqa: E402

SPEC = {
    "id": "lemon_tree_far",
    "pack": "murcia",
    "asset_class": "batched",
    "author": "Claude (pipeline reference asset)",
    "seed": 9,
    "tri_budget": 520,
    "ao_distance": 1.6,
    "preview_dir": (0.8, -1.0, 0.28),
}


def build(k):
    _tree.make(k, detail=1)
