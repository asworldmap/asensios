"""chile/andes_peak — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_chile_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "andes_peak",
    "pack": "chile",
    "asset_class": "batched",
    "ground_z": -1.5,  # the piece extends below its origin plane
    "author": "Claude (environment kits)",
    "seed": 119,
    "tri_budget": _mod.BUDGET.get("andes_peak", 2500),
    "meta": {"kit": "chile", "instancing": "batched: stamp into chapter batches or use an InstancedMesh"},
}


def build(k):
    _mod.BUILDERS["andes_peak"](k)
