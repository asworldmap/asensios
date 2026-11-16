"""maritime_v2/pier_head — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_maritime_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "pier_head",
    "pack": "maritime_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2148,
    "tri_budget": _mod.BUDGET.get("pier_head", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("pier_head", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("pier_head", 2.2),
    "meta": dict({"kit": "maritime_v2"}, **getattr(_mod, "META", {}).get("pier_head", {})),
}


def build(k):
    _mod.BUILDERS["pier_head"](k)
