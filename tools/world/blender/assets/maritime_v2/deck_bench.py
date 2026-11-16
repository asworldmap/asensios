"""maritime_v2/deck_bench — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_maritime_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "deck_bench",
    "pack": "maritime_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2233,
    "tri_budget": _mod.BUDGET.get("deck_bench", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("deck_bench", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("deck_bench", 2.2),
    "meta": dict({"kit": "maritime_v2"}, **getattr(_mod, "META", {}).get("deck_bench", {})),
}


def build(k):
    _mod.BUILDERS["deck_bench"](k)
