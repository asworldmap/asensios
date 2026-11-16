"""murcia/fountain — built by _props.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_murcia_props", os.path.join(os.path.dirname(__file__), "_props.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "fountain",
    "pack": "murcia",
    "asset_class": "batched",
    "author": "Claude (environment kits)",
    "seed": 129,
    "tri_budget": _mod.BUDGET.get("fountain", 2500),
    "meta": {"kit": "murcia", "instancing": "batched: stamp into chapter batches or use an InstancedMesh"},
}


def build(k):
    _mod.BUILDERS["fountain"](k)
