"""murcia_v2/arcade_house — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_murcia_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "arcade_house",
    "pack": "murcia_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2255,
    "tri_budget": _mod.BUDGET.get("arcade_house", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("arcade_house", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("arcade_house", 2.2),
    "meta": dict({"kit": "murcia_v2"}, **getattr(_mod, "META", {}).get("arcade_house", {})),
}


def build(k):
    _mod.BUILDERS["arcade_house"](k)
