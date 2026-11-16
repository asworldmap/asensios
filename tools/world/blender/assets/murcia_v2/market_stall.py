"""murcia_v2/market_stall — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_murcia_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "market_stall",
    "pack": "murcia_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2287,
    "tri_budget": _mod.BUDGET.get("market_stall", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("market_stall", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("market_stall", 2.2),
    "meta": dict({"kit": "murcia_v2"}, **getattr(_mod, "META", {}).get("market_stall", {})),
}


def build(k):
    _mod.BUILDERS["market_stall"](k)
