"""chile/araucaria — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_chile_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "araucaria",
    "pack": "chile",
    "asset_class": "batched",
    "author": "Claude (environment kits)",
    "seed": 121,
    "tri_budget": _mod.BUDGET.get("araucaria", 2500),
    "meta": {"kit": "chile", "instancing": "batched: stamp into chapter batches or use an InstancedMesh"},
}


def build(k):
    _mod.BUILDERS["araucaria"](k)
