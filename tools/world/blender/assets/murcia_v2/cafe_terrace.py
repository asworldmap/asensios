"""murcia_v2/cafe_terrace — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_murcia_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "cafe_terrace",
    "pack": "murcia_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2240,
    "tri_budget": _mod.BUDGET.get("cafe_terrace", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("cafe_terrace", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("cafe_terrace", 2.2),
    "meta": dict({"kit": "murcia_v2"}, **getattr(_mod, "META", {}).get("cafe_terrace", {})),
}


def build(k):
    _mod.BUILDERS["cafe_terrace"](k)
