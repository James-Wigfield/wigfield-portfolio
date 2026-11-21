"""The Python side of tools/memory-rooms/check-contracts.mjs: reads jobs (JSON on stdin), answers with what
the Python mirror makes of each (JSON on stdout), so the Node script can compare it with the JS contract code.

A job: {"kind": "scene" | "building", "value": {...}, "building": {...} | null, "samples": [[x, z], ...]}.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import building_io  # noqa: E402
import scene_io  # noqa: E402


def run(job):
    v = job["value"]
    if job["kind"] == "building":
        errors = building_io.validate_building(v)
        out = {"errors": [p for p, _ in errors]}
        if not errors:
            out["loops"] = {lvl["id"]: building_io.exterior_loops(v, lvl["id"]) for lvl in v["levels"]}
            out["frames"] = {r["id"]: building_io.room_frame(v, r)["origin"] for r in v["rooms"]}
            out["stairs"] = [building_io.stair_footprint(s) for s in v.get("stairs", [])]
            if v.get("geo"):
                out["geo"] = building_io.plan_to_lnglat(v["geo"], [10.0, -5.0])
            out["shells"] = {r["id"]: shell_summary(building_io.room_shell(v, r["id"]), job.get("samples") or [])
                             for r in v["rooms"]}
        return out
    errors = scene_io.validate_scene(v)
    out = {"errors": [p for p, _ in errors]}
    if not errors and v.get("kind") == "interior":
        sh = scene_io.resolve_shell(v, job.get("building"))
        out["shell"] = shell_summary(sh, job.get("samples") or []) if sh else None
    return out


def shell_summary(sh, samples):
    return {
        "kind": sh["kind"], "outline": sh["outline"], "box": sh["box"], "height": sh["height"], "top": sh["top"],
        "walls": [{"id": w["id"], "node": w["node"], "a": w["a"], "b": w["b"], "out": w["out"]} for w in sh["walls"]],
        "openings": [{"wall": o["wall"], "from": o["from"], "to": o["to"], "sill": o["sill"], "head": o["head"]}
                     for o in sh["openings"]],
        "ceiling": [scene_io.ceiling_at(sh, x, z) for x, z in samples],
    }


if __name__ == "__main__":
    jobs = json.load(sys.stdin)
    json.dump([run(j) for j in jobs], sys.stdout)
