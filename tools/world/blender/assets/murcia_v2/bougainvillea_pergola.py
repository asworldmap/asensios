"""murcia_v2/bougainvillea_pergola — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_murcia_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "bougainvillea_pergola",
    "pack": "murcia_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 3223,
    "tri_budget": _mod.BUDGET.get("bougainvillea_pergola", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("bougainvillea_pergola", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("bougainvillea_pergola", 2.2),
    "meta": dict({"kit": "murcia_v2"}, **getattr(_mod, "META", {}).get("bougainvillea_pergola", {})),
}


def build(k):
    _mod.BUILDERS["bougainvillea_pergola"](k)
