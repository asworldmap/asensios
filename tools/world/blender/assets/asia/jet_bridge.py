"""asia/jet_bridge — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_asia_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "jet_bridge",
    "pack": "asia",
    "asset_class": "batched",
    "author": "Claude (environment kits)",
    "seed": 109,
    "tri_budget": _mod.BUDGET.get("jet_bridge", 2500),
    "meta": {"kit": "asia", "instancing": "batched: stamp into chapter batches or use an InstancedMesh"},
}


def build(k):
    _mod.BUILDERS["jet_bridge"](k)
