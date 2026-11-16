"""chile/rock_outcrop — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_chile_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "rock_outcrop",
    "pack": "chile",
    "asset_class": "batched",
    "author": "Claude (environment kits)",
    "seed": 120,
    "tri_budget": _mod.BUDGET.get("rock_outcrop", 2500),
    "meta": {"kit": "chile", "instancing": "batched: stamp into chapter batches or use an InstancedMesh"},
}


def build(k):
    _mod.BUILDERS["rock_outcrop"](k)
