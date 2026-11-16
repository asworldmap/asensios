"""chile_v2/foothill_ridge — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_chile_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "foothill_ridge",
    "pack": "chile_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2363,
    "tri_budget": _mod.BUDGET.get("foothill_ridge", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("foothill_ridge", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("foothill_ridge", 2.2),
    "meta": dict({"kit": "chile_v2"}, **getattr(_mod, "META", {}).get("foothill_ridge", {})),
}


def build(k):
    _mod.BUILDERS["foothill_ridge"](k)
