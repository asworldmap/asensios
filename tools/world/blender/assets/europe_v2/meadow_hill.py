"""europe_v2/meadow_hill — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_europe_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "meadow_hill",
    "pack": "europe_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2176,
    "tri_budget": _mod.BUDGET.get("meadow_hill", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("meadow_hill", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("meadow_hill", 2.2),
    "meta": dict({"kit": "europe_v2"}, **getattr(_mod, "META", {}).get("meadow_hill", {})),
}


def build(k):
    _mod.BUILDERS["meadow_hill"](k)
