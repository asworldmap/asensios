"""Orchestrator: build every asset that needs building, validate, report.

    python tools/world/blender/build_all.py                 everything that is out of date
    python tools/world/blender/build_all.py --pack vehicles one pack
    python tools/world/blender/build_all.py vehicles/airliner   one asset (repeatable)
    python tools/world/blender/build_all.py --force         rebuild even if up to date
    python tools/world/blender/build_all.py --no-preview    skip the Cycles previews
    python tools/world/blender/build_all.py --blender "C:\\Program Files\\Blender Foundation\\Blender 5.3\\blender.exe"

Without --blender it uses the Python that runs this script, which must have
the `bpy` module (pip install bpy). With --blender it drives a normal Blender.

Each asset is built in its own process: one failure is logged and the run
moves on. An asset is skipped when its .glb matches the manifest and neither
its script nor the shared kit has changed since. Results:

    docs/world/BUILD_REPORT.md          human-readable summary
    docs/world/build-report.json        the same, for machines
    tools/world/blender/logs/*.log      full output of each build (not committed)
"""

import hashlib
import json
import os
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
from srchash import source_hash  # noqa: E402

ASSETS = os.path.join(HERE, "assets")
OUT = os.path.join(REPO, "public", "world", "assets")
MANIFEST = os.path.join(OUT, "manifest.json")
LOGS = os.path.join(HERE, "logs")


def discover():
    refs = []
    for pack in sorted(os.listdir(ASSETS)):
        d = os.path.join(ASSETS, pack)
        if os.path.isdir(d) and not pack.startswith("_"):
            refs += [f"{pack}/{f[:-3]}" for f in sorted(os.listdir(d)) if f.endswith(".py") and not f.startswith("_")]
    return refs


def manifest():
    if not os.path.exists(MANIFEST):
        return {}
    with open(MANIFEST, encoding="utf8") as f:
        return json.load(f).get("assets", {})


def up_to_date(ref, entry):
    if not entry:
        return False
    glb = os.path.join(OUT, entry["file"])
    script = os.path.join(ASSETS, *ref.split("/")) + ".py"
    if not os.path.exists(glb) or not os.path.exists(os.path.join(REPO, entry["source"]["blend"])):
        return False
    with open(glb, "rb") as f:
        if hashlib.sha256(f.read()).hexdigest() != entry.get("sha256"):
            return False
    return entry.get("source_hash") == source_hash(script)


def validate(refs):
    node = shutil.which("node")
    if not node:
        return None
    r = subprocess.run([node, os.path.join(REPO, "tools", "world", "validate.mjs"), "--json", *refs], capture_output=True, text=True)
    try:
        return {x["key"]: x for x in json.loads(r.stdout)["results"]}
    except Exception:
        return None


def main():
    argv = sys.argv[1:]
    force = "--force" in argv
    blender = argv[argv.index("--blender") + 1] if "--blender" in argv else None
    pack = argv[argv.index("--pack") + 1] if "--pack" in argv else None
    skip_next = False
    wanted, passthrough = [], []
    for i, a in enumerate(argv):
        if skip_next:
            skip_next = False
            continue
        if a in ("--blender", "--pack"):
            skip_next = True
        elif a in ("--samples", "--size"):
            passthrough += [a, argv[i + 1]]
            skip_next = True
        elif a == "--no-preview":
            passthrough.append(a)
        elif not a.startswith("-"):
            wanted.append(a.replace("\\", "/").removesuffix(".py"))
    refs = wanted or [r for r in discover() if not pack or r.startswith(pack + "/")]
    os.makedirs(LOGS, exist_ok=True)

    results = []
    for ref in refs:
        before = manifest().get(ref)
        if not force and up_to_date(ref, before):
            results.append({"ref": ref, "status": "skipped", "seconds": 0})
            print(f"[skip ] {ref} (up to date)")
            continue
        cmd = [blender, "-b", "-P", os.path.join(HERE, "build.py"), "--", ref, *passthrough] if blender else [sys.executable, os.path.join(HERE, "build.py"), ref, *passthrough]
        t0 = time.time()
        log = os.path.join(LOGS, ref.replace("/", "__") + ".log")
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
            out = r.stdout + "\n" + r.stderr
            code = r.returncode
        except Exception as exc:  # timeout, missing Blender…
            out, code = str(exc), 1
        with open(log, "w", encoding="utf8") as f:
            f.write(out)
        after = manifest().get(ref)
        ok = code == 0 and after is not None and up_to_date(ref, after)
        err = ""
        if not ok:
            lines = [ln for ln in out.splitlines() if ln.strip()]
            err = next((ln for ln in reversed(lines) if "Error" in ln or "error" in ln), lines[-1] if lines else "no output")
        results.append({"ref": ref, "status": "built" if ok else "FAILED", "seconds": round(time.time() - t0, 1), "error": err})
        print(f"[{'built' if ok else 'FAIL '}] {ref} ({time.time() - t0:.0f}s) {err}")

    checks = validate([r["ref"] for r in results]) or {}
    man = manifest()
    rows = []
    for r in results:
        e = man.get(r["ref"], {})
        v = checks.get(r["ref"])
        r.update({
            "contract": None if v is None else ("pass" if not v["errors"] else "fail"),
            "errors": [] if v is None else v["errors"],
            "warnings": [] if v is None else v["warnings"],
            "class": e.get("class"), "triangles": e.get("triangles"), "bytes": e.get("bytes"),
            "materials": len(e.get("materials", [])), "parts": len(e.get("rig", [])),
            "colliders": e.get("colliders"), "anchors": len(e.get("anchors", [])),
            "import_check": e.get("import_check"), "blender": e.get("blender"),
        })
        rows.append(r)

    failed = [r for r in rows if r["status"] == "FAILED" or r["contract"] == "fail"]
    with open(os.path.join(REPO, "docs", "world", "build-report.json"), "w", encoding="utf8") as f:
        json.dump({"ok": not failed, "results": rows}, f, indent=2)
        f.write("\n")
    md = ["# Asset build report", "", "Generated by `tools/world/blender/build_all.py`. Do not edit by hand.", "",
          f"{len(rows) - len(failed)}/{len(rows)} assets OK.", "",
          "| Asset | Build | Contract | Class | Triangles | Size | Materials | Parts | Colliders | Anchors | Re-import |", "|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        ic = r["import_check"] or {}
        imp = "error" if "error" in ic else (f"{ic.get('meshes')} meshes" if ic else "–")
        size = f"{r['bytes'] / 1024:.0f} kB" if r["bytes"] else "–"
        md.append(f"| `{r['ref']}` | {r['status']} | {r['contract'] or 'not run'} | {r['class'] or '–'} | {r['triangles'] or '–'} | {size} | {r['materials']} | {r['parts']} | {r['colliders']} | {r['anchors']} | {imp} |")
    notes = [(r["ref"], m) for r in rows for m in ([r.get("error")] if r.get("error") else []) + r["errors"]]
    if notes:
        md += ["", "## Errors", ""] + [f"- `{ref}`: {m}" for ref, m in notes]
    with open(os.path.join(REPO, "docs", "world", "BUILD_REPORT.md"), "w", encoding="utf8") as f:
        f.write("\n".join(md) + "\n")
    print(f"\n{len(rows) - len(failed)}/{len(rows)} OK — docs/world/BUILD_REPORT.md")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
