"""Create the one-file-per-asset stubs for a pack whose builders live in _kit.py.

    python tools/world/blender/new_pack_stubs.py murcia_v2

A pack's `_kit.py` defines BUILDERS = {name: function}, and optionally BUDGET
(triangles), GROUND (preview/AO ground height) and META (extra manifest data)
dicts keyed by asset id. Existing stubs are left alone, so it is safe to re-run
after adding a builder. No Blender needed.
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

TEMPLATE = '''"""{pack}/{aid} — built by _kit.py in this folder (see its docstring)."""

import importlib.util
import os

_spec = importlib.util.spec_from_file_location("ptw_{pack}_kit", os.path.join(os.path.dirname(__file__), "_kit.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

SPEC = {{
    "id": "{aid}",
    "pack": "{pack}",
    "asset_class": "batched",
    "author": "Claude (cinematic packs)",
    "seed": {seed},
    "tri_budget": _mod.BUDGET.get("{aid}", 2500),
    "ground_z": getattr(_mod, "GROUND", {{}}).get("{aid}", 0.0),
    "ao_distance": getattr(_mod, "AO_DISTANCE", {{}}).get("{aid}", 2.2),
    "meta": dict({{"kit": "{pack}"}}, **getattr(_mod, "META", {{}}).get("{aid}", {{}})),
}}


def build(k):
    _mod.BUILDERS["{aid}"](k)
'''


def main():
    pack = sys.argv[1]
    d = os.path.join(HERE, "assets", pack)
    src = open(os.path.join(d, "_kit.py"), encoding="utf8").read()
    block = re.search(r"BUILDERS\s*=\s*\{.*?\(([^)]*)\)\s*\}", src, re.S).group(1)
    names = [n.strip() for n in block.replace("\n", " ").split(",") if n.strip()]
    made = 0
    for i, aid in enumerate(names):
        p = os.path.join(d, aid + ".py")
        if os.path.exists(p):
            continue
        with open(p, "w", encoding="utf8") as f:
            f.write(TEMPLATE.format(pack=pack, aid=aid, seed=sum(map(ord, pack + aid)) % 9000 + 100))
        made += 1
    print(f"{pack}: {made} new stubs, {len(names)} assets")


if __name__ == "__main__":
    main()
