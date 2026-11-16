"""common/signpost — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_common_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "signpost",
    "pack": "common",
    "asset_class": "batched",
    "author": "Claude (environment kits)",
    "seed": 126,
    "tri_budget": _mod.BUDGET.get("signpost", 2500),
    "meta": {"kit": "common", "instancing": "batched: stamp into chapter batches or use an InstancedMesh"},
}


def build(k):
    _mod.BUILDERS["signpost"](k)
