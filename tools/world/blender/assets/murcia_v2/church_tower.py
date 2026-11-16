"""murcia_v2/church_tower — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_murcia_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "church_tower",
    "pack": "murcia_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2297,
    "tri_budget": _mod.BUDGET.get("church_tower", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("church_tower", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("church_tower", 2.2),
    "meta": dict({"kit": "murcia_v2"}, **getattr(_mod, "META", {}).get("church_tower", {})),
}


def build(k):
    _mod.BUILDERS["church_tower"](k)
