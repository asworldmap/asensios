"""europe/catenary_mast — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_europe_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "catenary_mast",
    "pack": "europe",
    "asset_class": "batched",
    "ground_z": -0.6,  # the piece extends below its origin plane
    "author": "Claude (environment kits)",
    "seed": 104,
    "tri_budget": _mod.BUDGET.get("catenary_mast", 2500),
    "meta": {"kit": "europe", "instancing": "batched: stamp into chapter batches or use an InstancedMesh"},
}


def build(k):
    _mod.BUILDERS["catenary_mast"](k)
