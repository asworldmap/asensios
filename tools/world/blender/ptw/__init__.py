"""Pedal the World — Blender asset kit.

A small, dependency-free layer over ``bpy`` that every asset script uses, so
all assets obey docs/world/ASSET_CONTRACT.md without each script re-deriving
the rules: units, axes, surface palette, vertex-colour painting, baked ambient
occlusion, colliders, anchors, export, preview render and manifest metadata.

Works inside Blender (``blender -b -P build.py -- ...``) and with the ``bpy``
Python module. Written against Blender 4.2 LTS – 5.x; version differences are
absorbed here, not in asset scripts.
"""

from .kit import Kit, SURFACES, CONTRACT_VERSION, GLASS_ALPHA, hex_to_linear  # noqa: F401
