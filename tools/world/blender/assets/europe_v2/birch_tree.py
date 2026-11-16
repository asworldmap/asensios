"""europe_v2/birch_tree — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_europe_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "birch_tree",
    "pack": "europe_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2066,
    "tri_budget": _mod.BUDGET.get("birch_tree", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("birch_tree", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("birch_tree", 2.2),
    "meta": dict({"kit": "europe_v2"}, **getattr(_mod, "META", {}).get("birch_tree", {})),
}


def build(k):
    _mod.BUILDERS["birch_tree"](k)
