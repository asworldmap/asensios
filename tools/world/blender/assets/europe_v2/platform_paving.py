"""europe_v2/platform_paving — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_europe_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "platform_paving",
    "pack": "europe_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2628,
    "tri_budget": _mod.BUDGET.get("platform_paving", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("platform_paving", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("platform_paving", 2.2),
    "meta": dict({"kit": "europe_v2"}, **getattr(_mod, "META", {}).get("platform_paving", {})),
}


def build(k):
    _mod.BUILDERS["platform_paving"](k)
