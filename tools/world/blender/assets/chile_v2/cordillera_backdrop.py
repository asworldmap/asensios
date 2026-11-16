"""chile_v2/cordillera_backdrop — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_chile_v2_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {
    "id": "cordillera_backdrop",
    "pack": "chile_v2",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": 2870,
    "tri_budget": _mod.BUDGET.get("cordillera_backdrop", 2500),
    "ground_z": getattr(_mod, "GROUND", {}).get("cordillera_backdrop", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {}).get("cordillera_backdrop", 2.2),
    "meta": dict({"kit": "chile_v2"}, **getattr(_mod, "META", {}).get("cordillera_backdrop", {})),
}


def build(k):
    _mod.BUILDERS["cordillera_backdrop"](k)
