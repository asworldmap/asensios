"""maritime/quay_section — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_maritime_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "quay_section",
    "pack": "maritime",
    "asset_class": "batched",
    "ground_z": -3.0,  # the piece extends below its origin plane
    "author": "Claude (environment kits)",
    "seed": 113,
    "tri_budget": _mod.BUDGET.get("quay_section", 2500),
    "meta": {"kit": "maritime", "instancing": "batched: stamp into chapter batches or use an InstancedMesh"},
}


def build(k):
    _mod.BUILDERS["quay_section"](k)
