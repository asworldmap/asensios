"""Hash of everything that determines an asset's output (pure Python, no bpy).

Used by build.py to stamp the manifest and by build_all.py to decide whether an
asset is already up to date.
"""

import hashlib
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def source_hash(script):
    h = hashlib.sha256()
    files = [script]
    for base in (os.path.join(HERE, "ptw"), os.path.dirname(script)):
        for root, _, names in os.walk(base):
            if "__pycache__" in root:
                continue
            for f in sorted(names):
                if f.endswith(".py") and (os.path.basename(root) == "ptw" or f.startswith("_")):
                    files.append(os.path.join(root, f))
    for f in sorted(set(files)):
        with open(f, "rb") as fh:
            h.update(fh.read().replace(b"\r\n", b"\n"))
    return h.hexdigest()[:16]
