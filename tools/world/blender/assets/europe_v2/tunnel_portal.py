"""europe_v2/tunnel_portal — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_europe_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "tunnel_portal",
    "pack": "europe_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2434,
    "tri_budget": _mod.BUDGET.get("tunnel_portal", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("tunnel_portal", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("tunnel_portal", 2.2),
    "meta": dict({"kit": "europe_v2"}, **getattr(_mod, "META", {}).get("tunnel_portal", {})),
}


def build(k):
    _mod.BUILDERS["tunnel_portal"](k)
