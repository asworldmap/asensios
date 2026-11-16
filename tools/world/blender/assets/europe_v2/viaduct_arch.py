"""europe_v2/viaduct_arch — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_europe_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "viaduct_arch",
    "pack": "europe_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2280,
    "tri_budget": _mod.BUDGET.get("viaduct_arch", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("viaduct_arch", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("viaduct_arch", 2.2),
    "meta": dict({"kit": "europe_v2"}, **getattr(_mod, "META", {}).get("viaduct_arch", {})),
}


def build(k):
    _mod.BUILDERS["viaduct_arch"](k)
