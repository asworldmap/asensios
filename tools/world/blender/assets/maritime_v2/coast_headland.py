"""maritime_v2/coast_headland — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_maritime_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "coast_headland",
    "pack": "maritime_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2669,
    "tri_budget": _mod.BUDGET.get("coast_headland", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("coast_headland", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("coast_headland", 2.2),
    "meta": dict({"kit": "maritime_v2"}, **getattr(_mod, "META", {}).get("coast_headland", {})),
}


def build(k):
    _mod.BUILDERS["coast_headland"](k)
