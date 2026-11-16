"""journey/cloud_sea — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_journey_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "cloud_sea",
    "pack": "journey",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 1823,
    "tri_budget": _mod.BUDGET.get("cloud_sea", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("cloud_sea", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("cloud_sea", 2.2),
    "meta": dict({"kit": "journey"}, **getattr(_mod, "META", {}).get("cloud_sea", {})),
}


def build(k):
    _mod.BUILDERS["cloud_sea"](k)
