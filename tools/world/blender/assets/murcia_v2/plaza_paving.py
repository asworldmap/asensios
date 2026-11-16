"""murcia_v2/plaza_paving — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_murcia_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "plaza_paving",
    "pack": "murcia_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2280,
    "tri_budget": _mod.BUDGET.get("plaza_paving", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("plaza_paving", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("plaza_paving", 2.2),
    "meta": dict({"kit": "murcia_v2"}, **getattr(_mod, "META", {}).get("plaza_paving", {})),
}


def build(k):
    _mod.BUILDERS["plaza_paving"](k)
