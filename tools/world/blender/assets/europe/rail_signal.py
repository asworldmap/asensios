"""europe/rail_signal — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_europe_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "rail_signal",
    "pack": "europe",
    "asset_class": "batched",
    "ground_z": -0.35,  # the piece extends below its origin plane
    "author": "Claude (environment kits)",
    "seed": 103,
    "tri_budget": _mod.BUDGET.get("rail_signal", 2500),
    "meta": {"kit": "europe", "instancing": "batched: stamp into chapter batches or use an InstancedMesh"},
}


def build(k):
    _mod.BUILDERS["rail_signal"](k)
