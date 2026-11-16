"""maritime/life_ring_stand — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_maritime_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "life_ring_stand",
    "pack": "maritime",
    "asset_class": "batched",
    "author": "Claude (environment kits)",
    "seed": 117,
    "tri_budget": _mod.BUDGET.get("life_ring_stand", 2500),
    "meta": {"kit": "maritime", "instancing": "batched: stamp into chapter batches or use an InstancedMesh"},
}


def build(k):
    _mod.BUILDERS["life_ring_stand"](k)
