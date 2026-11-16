"""europe_v2/signal_box — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_europe_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "signal_box",
    "pack": "europe_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2081,
    "tri_budget": _mod.BUDGET.get("signal_box", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("signal_box", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("signal_box", 2.2),
    "meta": dict({"kit": "europe_v2"}, **getattr(_mod, "META", {}).get("signal_box", {})),
}


def build(k):
    _mod.BUILDERS["signal_box"](k)
