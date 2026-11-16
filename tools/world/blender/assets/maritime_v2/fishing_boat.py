"""maritime_v2/fishing_boat — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_maritime_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "fishing_boat",
    "pack": "maritime_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2480,
    "tri_budget": _mod.BUDGET.get("fishing_boat", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("fishing_boat", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("fishing_boat", 2.2),
    "meta": dict({"kit": "maritime_v2"}, **getattr(_mod, "META", {}).get("fishing_boat", {})),
}


def build(k):
    _mod.BUILDERS["fishing_boat"](k)
