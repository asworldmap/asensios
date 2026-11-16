"""murcia/palm_tree — built by _props.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_murcia_props", os.path.join(os.path.dirname(__file__), "_props.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "palm_tree",
    "pack": "murcia",
    "asset_class": "batched",
    "author": "Claude (environment kits)",
    "seed": 127,
    "tri_budget": _mod.BUDGET.get("palm_tree", 2500),
    "meta": {"kit": "murcia", "instancing": "batched: stamp into chapter batches or use an InstancedMesh"},
}


def build(k):
    _mod.BUILDERS["palm_tree"](k)
