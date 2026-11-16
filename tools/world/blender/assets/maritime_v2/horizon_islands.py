"""maritime_v2/horizon_islands — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_maritime_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "horizon_islands",
    "pack": "maritime_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2841,
    "tri_budget": _mod.BUDGET.get("horizon_islands", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("horizon_islands", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("horizon_islands", 2.2),
    "meta": dict({"kit": "maritime_v2"}, **getattr(_mod, "META", {}).get("horizon_islands", {})),
}


def build(k):
    _mod.BUILDERS["horizon_islands"](k)
