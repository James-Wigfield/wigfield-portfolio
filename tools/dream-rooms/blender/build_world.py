"""Dream Rooms · world.json -> a baked, unlit GLB (+ Cycles stills).

    blender.exe -b --factory-startup --python tools/dream-rooms/blender/build_world.py -- \
        --world <abs world.json> --out <abs dir> [--draft | --full] [--work <abs dream work dir>]
        [--glb-name draft.glb] [--scratch <abs dir>] [--atlas N] [--samples N] [--stills] [--png-copies]

  --draft   512 px atlases, 32 samples, no stills unless --stills (quick 640x400 previews)
  --full    2048 px atlases, 384 samples (adaptive), stills/<module>.webp 1280x800 with volumetric haze
            (bake_export.py runs this mode)

Pipeline (CONTRACTS.md §6): build every module at its world origin (a repeating corridor as three
copies, the middle one exported; seven for its still) -> hidden sourceless light -> auto exposure per
module from its still camera -> stills (full) -> per module: lightmap UVs at ~100 texels/m on cited
surfaces (less on invented / fogged ones), <= 4 atlases, COMBINED bake in context (swap targets and
text surfaces hidden while the shell bakes, then baked themselves with everything visible) written
display-referred through AgX -> unlit materials -> join -> node names + extras -> GLB (WebP).
A fallback world (`fallback: "still"`) renders stills/still-<k>.webp only.
The last line printed is `REPORT {json}` (ids, sizes, timings; never dream words).
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import bpy  # noqa: E402

import common as C  # noqa: E402
from common import BUDGET, WALKER, log  # noqa: E402
import kit  # noqa: E402
from kit import lights, shell  # noqa: E402
from kit.base import ModuleBuild  # noqa: E402

PACK = 0.62  # usable fraction of an atlas after packing


def parse(argv=None):
    p = argparse.ArgumentParser(prog="build_world.py")
    p.add_argument("--world", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--work", default=None)
    p.add_argument("--draft", action="store_true")
    p.add_argument("--full", action="store_true")
    p.add_argument("--glb-name", default=None)
    p.add_argument("--scratch", default=None, help="atlases, exposure probes, PNG copies (default: --out)")
    p.add_argument("--atlas", type=int, default=0)
    p.add_argument("--samples", type=int, default=0)
    p.add_argument("--still-samples", type=int, default=0)
    p.add_argument("--stills", action="store_true", help="draft: also render quick preview stills")
    p.add_argument("--no-stills", action="store_true", help="full: skip the stills")
    p.add_argument("--png-copies", action="store_true", help="also save PNG copies of the stills (scratch)")
    p.add_argument("--webp-quality", type=int, default=0)
    p.add_argument("--save-blend", action="store_true")
    return C.script_args(p, argv)


# ── camera views ─────────────────────────────────────────────────────────────
def _view(at, facing, pitch=0.0, name=None):
    if isinstance(facing, str):
        fvec, yaw = C.FACING_VEC[facing], C.FACING_YAW[facing]
    else:
        fvec, yaw = facing, C.yaw_of(facing)
    return {"pos": (float(at[0]), WALKER["eye"], float(at[2])), "yaw": yaw, "pitch": math.radians(pitch or 0.0),
            "facing": fvec, "name": name}


def _long_facing(m, x, z):
    w, _, d = m["size"]
    if m.get("repeat"):
        return "n"
    if d >= w:
        return "n" if z > d - z else "s"
    return "w" if x > w - x else "e"


def entry_view(world, m):
    """The camera a module's still (and its exposure) uses: a stills[] hint, the spawn, the dissolve's
    arrival, else 1.5 m inside the doorway the route enters by, facing in (along the long axis when
    the room is too shallow to look across)."""
    mid = m["id"]
    w, h, d = m["size"]
    for s in world.get("stills") or []:
        if s["module"] == mid:
            return _view(s["at"], s["facing"], s.get("pitch", 0.0), s["name"])
    sp = world.get("spawn")
    if sp and sp["module"] == mid:
        return _view(sp["at"], sp["facing"])
    for lk in world.get("links") or []:
        if lk.get("kind") == "dissolve" and lk.get("to") == mid:
            at = lk.get("at") or [w / 2, 0, d / 2]
            return _view(at, lk.get("facing") or _long_facing(m, at[0], at[2]))
    doorways = {dw["id"]: dw for dw in world.get("doorways") or []}
    route = world.get("route") or []
    arrive = None
    if mid in route and route.index(mid) > 0:
        prev = route[route.index(mid) - 1]
        for lk in world.get("links") or []:
            if lk.get("kind") not in ("walk", "teleport"):
                continue
            a, b = doorways.get(lk["a"]), doorways.get(lk["b"])
            if not a or not b:
                continue
            if a["module"] == prev and b["module"] == mid:
                arrive = b
            elif not lk.get("oneway") and b["module"] == prev and a["module"] == mid:
                arrive = a
            if arrive:
                break
    if arrive is None:
        arrive = next((dw for dw in doorways.values() if dw["module"] == mid), None)
    if arrive is not None:
        fr = C.doorway_frame(m, arrive)
        depth = w if arrive["wall"] in "ew" else d
        k = min(1.5, depth / 2)
        p = C.add(fr["centre"], C.mul(fr["inward"], k))
        if depth < 4.0:
            return _view(p, _long_facing(m, p[0], p[2]))
        return _view(p, fr["inward"])
    return _view((w / 2, 0, d - min(1.5, d / 2)), "n")


# ── building ─────────────────────────────────────────────────────────────────
def build_module(world, m, opts, copies):
    coll = C.collection(f"mod_{m['id']}")
    view = entry_view(world, m)
    mbs = []
    for k in copies:
        mb = ModuleBuild(world, m, coll, copy=k, opts=opts)
        mb.entry_facing = view["facing"]
        kit.module_kit(m["kit"]).build(mb)
        lights.rig(mb)
        if k == 0:
            for target in sorted(mb.word_targets):
                if target.startswith("wall-"):
                    shell.wall_word_surface(mb, target[5:])
                elif target == "floor":
                    shell.floor_word_surface(mb)
                elif target == "water":
                    shell.water_word_surface(mb)
        mb.finish()
        mbs.append(mb)
    main = next(x for x in mbs if x.copy == 0)
    return {"id": m["id"], "module": m, "coll": coll, "main": main, "copies": mbs, "view": view}


def haze_for(rec, world):
    m = rec["module"]
    o = m["origin"]
    w, h, d = m["size"]
    pad = shell.stub_reach() + 0.5
    z0, z1 = -pad, d + pad
    if m.get("repeat"):
        ks = [mb.copy for mb in rec["copies"]]
        z0, z1 = min(ks) * d - 0.5, (max(ks) + 1) * d + 0.5
    fog = world["look"]["fog"]
    return C.haze_box(rec["coll"], f"haze_{m['id']}", (o[0] - pad, o[1] - 1.6, o[2] + z0),
                      (o[0] + w + pad, o[1] + h + 0.3, o[2] + z1), fog["color"], 0.7 * float(fog["density"]))


def make_camera(rec, name):
    v = rec["view"]
    pos = C.add(tuple(rec["module"]["origin"]), v["pos"])
    return C.camera(rec["coll"], name, pos, v["yaw"], v["pitch"])


# ── bake ─────────────────────────────────────────────────────────────────────
def bins_for(items, max_atlas):
    """items: [(ob, role, weight, orig, texels)] -> [[...]] at most atlasesPerModule bins."""
    ref = BUDGET["atlasPx"]
    cap = ref * ref * PACK
    need = sum(i[4] for i in items)
    n = min(BUDGET["atlasesPerModule"], max(1, math.ceil(need / cap - 1e-9)))
    target = need / n * 1.06
    bins = [[] for _ in range(n)]
    loads = [0.0] * n
    for it in sorted(items, key=lambda i: -i[4]):
        k = next((j for j in range(n) if loads[j] + it[4] <= target), None)
        if k is None:
            k = min(range(n), key=lambda j: loads[j])
        bins[k].append(it)
        loads[k] += it[4]
    out = []
    for b, load in zip(bins, loads):
        if not b:
            continue
        size = int(min(max_atlas, max(128, C.pow2ceil(math.sqrt(load / PACK)))))
        out.append({"items": b, "texels": load, "size": size})
    return out


def is_hidden_in_shell_pass(orig):
    return isinstance(orig, tuple) and orig[0] in ("prop", "surface")


def bake_module(rec, sc, args, scratch, T):
    mb = rec["main"]
    mid = rec["id"]
    tpm = BUDGET["texelsPerMetre"]
    items = []
    for ob, role, w, orig in mb.objects:
        if role == "context":
            continue
        items.append((ob, role, w, orig, C.mesh_area(ob) * (tpm * w) ** 2))
    all_objs = [o for x in rec["copies"] for o in x.objects]
    # a repeating module bakes with ONE neighbour each side (copies further out stay out of the bake)
    far = [ob for x in rec["copies"] if abs(x.copy) >= 2 for (ob, *_r) in x.objects] + \
          [lt for x in rec["copies"] if abs(x.copy) >= 2 for lt in x.lights]
    for ob in far:
        ob.hide_render = True
    hide_a = [ob for (ob, _r, _w, orig) in all_objs if is_hidden_in_shell_pass(orig)]
    bins = bins_for(items, args.atlas_max)
    atlases = []
    for i, B in enumerate(bins):
        t0 = time.perf_counter()
        objs = [it[0] for it in B["items"]]
        weights = {it[0].name: it[2] for it in B["items"]}
        want = 6 if B["size"] >= 1024 else 3
        tpm_real, pack_px, n_islands = C.lightmap_uvs(objs, weights, B["size"], 2 * want + 2)
        t_uv = time.perf_counter() - t0
        # the bake margin may fill at most half the gutter, so it never paints over a neighbour island
        margin = max(1, int((pack_px - 1) // 2))
        img = bpy.data.images.new(f"bake_{mid}_{i}", B["size"], B["size"], alpha=False, float_buffer=True)
        shell_objs = [it[0] for it in B["items"] if it[1] == "shell"]
        sep_objs = [it[0] for it in B["items"] if it[1] != "shell"]
        for ob in hide_a:
            ob.hide_render = True
        tb = time.perf_counter()
        if shell_objs:
            C.bake(shell_objs, img, margin, clear=True)
        t_a = time.perf_counter() - tb
        for ob in hide_a:
            ob.hide_render = False
        tb = time.perf_counter()
        if sep_objs:
            C.bake(sep_objs, img, margin, clear=not shell_objs)
        t_b = time.perf_counter() - tb
        sc.view_settings.exposure = rec["exposure"]
        tex = C.save_display(sc, img, scratch / "atlas" / f"{mid}_{i}.png")
        tex.name = f"atlas_{mid}_{i}"
        bpy.data.images.remove(img)
        dt = round(time.perf_counter() - t0, 2)
        atlases.append({"index": i, "size": B["size"], "objects": len(objs), "texelsPerMetre": round(tpm_real, 1),
                        "islands": n_islands, "marginPx": round(pack_px, 1), "bake_s": dt, "tex": tex,
                        "items": B["items"]})
        log("baked", mid, "atlas", i, B["size"], "px", len(objs), "objects", n_islands, "islands", round(tpm_real), "tpm",
            dt, "s (uv", round(t_uv, 1), "shell", round(t_a, 1), "separate", round(t_b, 1), ")")
    for ob in far:
        ob.hide_render = False
    T[f"bake_{mid}"] = round(sum(a["bake_s"] for a in atlases), 2)
    return atlases


def assign(ob, mat):
    me = ob.data
    me.materials.clear()
    me.materials.append(mat)
    me.polygons.foreach_set("material_index", [0] * len(me.polygons))
    C.keep_only_uv(ob, "lightmap")


def unique_name(ob, name):
    other = bpy.data.objects.get(name)
    if other is not None and other is not ob:
        other.name = "_old_" + name
    ob.name = name
    if ob.data is not None:
        ob.data.name = name


def finalize_module(rec, atlases):
    """Unlit materials, joined shells, node names, extras, parenting (CONTRACTS.md §6)."""
    mid = rec["id"]
    m = rec["module"]
    root = bpy.data.objects.new(f"M_{mid}", None)
    rec["coll"].objects.link(root)
    unique_name(root, f"M_{mid}")
    C.set_extras(root, dr="module", module=mid, id=mid, kit=m["kit"], origin=list(m["origin"]), size=list(m["size"]))
    nodes = {"root": root, "shells": [], "props": [], "surfaces": [], "water": [], "fixtures": [], "doorways": []}
    shell_k = 0
    for A in atlases:
        base = C.unlit_material(f"baked_{mid}_{A['index']}", A["tex"])
        shells = []
        for ob, role, _w, _orig, _t in A["items"]:
            if role == "shell":
                assign(ob, base)
                shells.append(ob)
                continue
            kind = role if isinstance(role, str) else role[0]
            if kind == "prop":
                name, mname, extras = f"P_{mid}__{role[1]}", f"prop_{mid}__{role[1]}", dict(dr="prop", id=role[1])
                bucket = "props"
            elif kind == "surface":
                name, mname = f"S_{mid}__{role[1]}", f"surface_{mid}__{role[1]}"
                extras = dict(dr="surface", id=role[1], w=role[2], h=role[3])
                bucket = "surfaces"
            elif kind == "water":
                name, mname, extras, bucket = f"W_{mid}", f"water_{mid}", dict(dr="water", id="water"), "water"
            elif kind == "fixture":
                name, mname, extras = f"F_{mid}__{role[1]}", f"fixture_{mid}__{role[1]}", dict(dr="fixture", id=role[1])
                bucket = "fixtures"
            else:
                continue
            assign(ob, C.unlit_material(mname, A["tex"]))
            unique_name(ob, name)
            C.set_extras(ob, module=mid, **extras)
            ob.parent = root
            nodes[bucket].append(name)
        if shells:
            C.select_only(shells, shells[0])
            if len(shells) > 1:
                bpy.ops.object.join()
            joined = bpy.context.view_layer.objects.active
            C.keep_only_uv(joined, "lightmap")
            sid = "shell" if shell_k == 0 else f"shell_{shell_k}"
            unique_name(joined, f"M_{mid}__{sid}")
            C.set_extras(joined, dr="shell", module=mid, id=sid, atlas=A["index"])
            joined.parent = root
            nodes["shells"].append(joined.name)
            shell_k += 1
    for dwid, centre, inward in rec["main"].doorway_empties:
        e = bpy.data.objects.new(f"D_{mid}__{dwid}", None)
        e.empty_display_size = 0.3
        rec["coll"].objects.link(e)
        unique_name(e, f"D_{mid}__{dwid}")
        e.matrix_world = C.obj_matrix(C.viewer_matrix(centre, math.atan2(inward[0], inward[2]), 0.0))
        C.set_extras(e, dr="doorway", module=mid, id=dwid)
        e.parent = root
        e.matrix_parent_inverse.identity()
        nodes["doorways"].append(e.name)
    return nodes


def export_glb(roots, path: Path, quality):
    objs = []
    for r in roots:
        objs.append(r)
        objs += list(r.children_recursive)
    C.select_only(objs, roots[0])
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", use_selection=True, export_cameras=False, export_lights=False,
        export_animations=False, export_apply=True, export_yup=True, export_image_format="WEBP",
        export_image_quality=quality, export_texcoords=True, export_normals=False, export_tangents=False,
        export_materials="EXPORT", export_extras=True, export_vertex_color="NONE")
    tris = draws = 0
    for o in objs:
        if o.type == "MESH":
            tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
            draws += max(1, len(o.material_slots))
    return {"bytes": path.stat().st_size, "triangles": tris, "drawCalls": draws, "nodes": len(objs)}


# ── main ─────────────────────────────────────────────────────────────────────
def main(argv=None, force_full=False):
    args = parse(argv)
    full = (args.full or force_full) and not args.draft
    args.atlas_max = args.atlas or (BUDGET["atlasPx"] if full else 512)
    samples = args.samples or (384 if full else 32)
    stills = (full and not args.no_stills) or args.stills
    still_samples = args.still_samples or (256 if full else 48)
    still_res = (1280, 800) if full else (640, 400)
    quality = args.webp_quality or (85 if full else 70)
    out = Path(args.out).resolve()
    scratch = Path(args.scratch).resolve() if args.scratch else out
    out.mkdir(parents=True, exist_ok=True)
    scratch.mkdir(parents=True, exist_ok=True)
    world = json.loads(Path(args.world).read_text(encoding="utf-8"))
    fallback = world.get("fallback") == "still"
    R = {"mode": "full" if full else "draft", "blender": bpy.app.version_string, "samples": samples,
         "atlasMax": args.atlas_max, "modules": {}, "warnings": []}
    T = {}
    t_all = time.perf_counter()

    sc = C.reset_scene()
    R["device"] = C.setup_render(sc, samples, still_res)
    C.dark_world(sc, "#030303", 1.0)
    opts = {"work": args.work}

    t = time.perf_counter()
    recs = []
    for m in world["modules"]:
        copies = [0]
        if m.get("repeat"):
            # the still needs enough copies that the open far end is lost in the haze, never read as a wall
            copies = list(range(-7, 8)) if stills or fallback else [-1, 0, 1]
        rec = build_module(world, m, opts, copies)
        recs.append(rec)
        mb = rec["main"]
        R["modules"][m["id"]] = {"kit": m["kit"], "objects": len(mb.objects), "lights": len(mb.lights),
                                 "surfaces": mb.sign_k, "fixtures": mb.fixture_k,
                                 "lightKind": ((m.get("lights") or {}).get("is")) or "glow"}
        if getattr(mb, "bespoke_outside", 0):
            R["warnings"].append(f"modules.{m['id']}: {mb.bespoke_outside} bespoke vertices outside the box")
    T["build"] = round(time.perf_counter() - t, 2)
    log("built", len(recs), "modules", T["build"], "s")

    # auto exposure per module from its still camera
    t = time.perf_counter()
    for rec in recs:
        rec["cam"] = make_camera(rec, f"cam_{rec['id']}")
        lum = C.measure_luminance(sc, rec["cam"], scratch)
        target = lights.exposure_target(world, rec["module"])
        rec["exposure"] = max(-6.0, min(8.0, math.log2(target / max(lum, 1e-6))))
        R["modules"][rec["id"]]["exposure"] = round(rec["exposure"], 3)
        R["modules"][rec["id"]]["measured"] = round(lum, 5)
    T["exposure"] = round(time.perf_counter() - t, 2)

    def render_stills(names):
        t1 = time.perf_counter()
        sc.cycles.samples = still_samples
        sc.render.resolution_x, sc.render.resolution_y = still_res
        written = []
        hazes = {rec["id"]: haze_for(rec, world) for rec in recs}
        for h in hazes.values():
            h.hide_render = True
        # text surfaces are drawn live by the viewer; in a still they'd only show as a sliver
        quads = [ob for rec in recs for x in rec["copies"] for (ob, _r, _w, orig) in x.objects
                 if isinstance(orig, tuple) and orig[0] == "surface"]
        for ob in quads:
            ob.hide_render = True
        for rec, name in names:
            hazes[rec["id"]].hide_render = False
            sc.view_settings.exposure = rec["exposure"]
            p = C.render_still(sc, rec["cam"], out / "stills" / f"{name}.webp",
                               scratch / "stills-png" / f"{name}.png" if args.png_copies else None)
            hazes[rec["id"]].hide_render = True
            written.append({"name": name, "module": rec["id"], "bytes": p.stat().st_size})
            log("still", name, p.stat().st_size, "bytes")
        for h in hazes.values():
            bpy.data.objects.remove(h, do_unlink=True)
        for ob in quads:
            ob.hide_render = False
        sc.cycles.samples = samples
        T["stills"] = round(time.perf_counter() - t1, 2)
        return written

    if fallback:
        names = []
        hints = world.get("stills") or []
        by_id = {r["id"]: r for r in recs}
        if hints:
            for k, s in enumerate(hints):
                rec = dict(by_id[s["module"]])
                rec["view"] = _view(s["at"], s["facing"], s.get("pitch", 0.0))
                rec["cam"] = make_camera(rec, f"cam_still_{k}")
                names.append((rec, f"still-{k}"))
        else:
            names = [(rec, f"still-{k}") for k, rec in enumerate(recs)]
        R["stills"] = render_stills(names)
        R["fallback"] = "still"
        T["total"] = round(time.perf_counter() - t_all, 2)
        R["timings"] = T
        C.report(R)
        return R

    if stills:
        R["stills"] = render_stills([(rec, rec["id"]) for rec in recs])

    # bake, module by module
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False
    all_nodes = {}
    t = time.perf_counter()
    for rec in recs:
        atlases = bake_module(rec, sc, args, scratch, T)
        R["modules"][rec["id"]]["atlases"] = [{k: v for k, v in a.items() if k not in ("tex", "items")}
                                              for a in atlases]
        all_nodes[rec["id"]] = (rec, atlases)
    T["bake"] = round(time.perf_counter() - t, 2)

    t = time.perf_counter()
    roots = []
    for mid, (rec, atlases) in all_nodes.items():
        nodes = finalize_module(rec, atlases)
        roots.append(nodes["root"])
        R["modules"][mid]["nodes"] = {k: v for k, v in nodes.items() if k != "root"}
    T["finalize"] = round(time.perf_counter() - t, 2)

    t = time.perf_counter()
    glb = out / (args.glb_name or ("world.glb" if full else "draft.glb"))
    R["glb"] = {"path": str(glb), **export_glb(roots, glb, quality)}
    T["export"] = round(time.perf_counter() - t, 2)
    if args.save_blend:
        try:
            bpy.ops.wm.save_as_mainfile(filepath=str(scratch / f"world-{R['mode']}.blend"), compress=True)
        except Exception as e:  # noqa: BLE001
            R["warnings"].append(f"could not save the blend: {type(e).__name__}")
    T["total"] = round(time.perf_counter() - t_all, 2)
    R["timings"] = T
    log("glb", R["glb"]["bytes"], "bytes", R["glb"]["drawCalls"], "draws", R["glb"]["triangles"], "tris",
        T["total"], "s")
    C.report(R)
    return R


def run(argv=None, force_full=False):
    try:
        main(argv, force_full)
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        C.report({"error": f"{type(e).__name__}: {str(e)[:300]}"})
        sys.exit(1)


if __name__ == "__main__":
    run()
