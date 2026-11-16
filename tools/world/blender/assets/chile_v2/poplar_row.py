"""chile_v2/poplar_row — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_chile_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "poplar_row",
    "pack": "chile_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 1973,
    "tri_budget": _mod.BUDGET.get("poplar_row", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("poplar_row", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("poplar_row", 2.2),
    "meta": dict({"kit": "chile_v2"}, **getattr(_mod, "META", {}).get("poplar_row", {})),
}


def build(k):
    _mod.BUILDERS["poplar_row"](k)
