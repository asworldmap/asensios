"""murcia_v2/shop_house — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_murcia_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "shop_house",
    "pack": "murcia_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2089,
    "tri_budget": _mod.BUDGET.get("shop_house", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("shop_house", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("shop_house", 2.2),
    "meta": dict({"kit": "murcia_v2"}, **getattr(_mod, "META", {}).get("shop_house", {})),
}


def build(k):
    _mod.BUILDERS["shop_house"](k)
