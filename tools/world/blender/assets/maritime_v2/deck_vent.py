"""maritime_v2/deck_vent — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_maritime_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "deck_vent",
    "pack": "maritime_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2166,
    "tri_budget": _mod.BUDGET.get("deck_vent", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("deck_vent", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("deck_vent", 2.2),
    "meta": dict({"kit": "maritime_v2"}, **getattr(_mod, "META", {}).get("deck_vent", {})),
}


def build(k):
    _mod.BUILDERS["deck_vent"](k)
