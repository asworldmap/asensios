"""asia_v2/apron_tile — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_asia_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "apron_tile",
    "pack": "asia_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 1846,
    "tri_budget": _mod.BUDGET.get("apron_tile", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("apron_tile", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("apron_tile", 2.2),
    "meta": dict({"kit": "asia_v2"}, **getattr(_mod, "META", {}).get("apron_tile", {})),
}


def build(k):
    _mod.BUILDERS["apron_tile"](k)
