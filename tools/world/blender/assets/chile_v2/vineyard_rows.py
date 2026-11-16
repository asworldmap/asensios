"""chile_v2/vineyard_rows — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_chile_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "vineyard_rows",
    "pack": "chile_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2300,
    "tri_budget": _mod.BUDGET.get("vineyard_rows", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("vineyard_rows", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("vineyard_rows", 2.2),
    "meta": dict({"kit": "chile_v2"}, **getattr(_mod, "META", {}).get("vineyard_rows", {})),
}


def build(k):
    _mod.BUILDERS["vineyard_rows"](k)
