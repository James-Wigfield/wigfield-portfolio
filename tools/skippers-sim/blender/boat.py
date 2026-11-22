"""5.5 m centre-console outboard runabout → boat.glb + boat-footprint.json (headless).

  blender -b --factory-startup --python boat.py -- --out <glb> --footprint <json>

Boat frame (Blender): origin = midships, centreline, waterline. X = starboard, Y = forward (bow),
Z = up. glTF (+Y up) gives three.js: bow = -Z, starboard = +X.
Animated nodes: outboard (steer about Z, origin on the swivel axis), outboard/prop (spin about
local Y), wheel (spin about local Y, tilted 30° back), lever (fore/aft about local X).
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from kit import Builder, args_after_dashdash, empty, export_glb, hexrgb, mat, reset  # noqa: E402

a = args_after_dashdash()
OUT = a[a.index("--out") + 1]
FOOT = a[a.index("--footprint") + 1]
reset()

M = {
    "hull": mat("hull_white", hexrgb("#f5f5f1"), 0.3),
    "bottom": mat("antifoul_navy", hexrgb("#1f2c44"), 0.7),
    "stripe": mat("boot_stripe_navy", hexrgb("#24364f"), 0.5),
    "deck": mat("deck_nonskid", hexrgb("#d8d5cc"), 0.85),
    "inner": mat("hull_inner", hexrgb("#ecebe6"), 0.5),
    "cushion": mat("cushion_grey", hexrgb("#8f949a"), 0.8),
    "console": mat("console_white", hexrgb("#f0efea"), 0.4),
    "dash": mat("dash_black", hexrgb("#1d1f22"), 0.6),
    "glass": mat("glass_windscreen", hexrgb("#9fb7c4"), 0.1),
    "steel": mat("stainless", hexrgb("#d2d6d8"), 0.25, 0.9),
    "engine": mat("outboard_grey", hexrgb("#3a3d40"), 0.4),
    "engine_hi": mat("outboard_decal_white", hexrgb("#e8e8e8"), 0.4),
    "prop": mat("prop_alu", hexrgb("#9aa0a4"), 0.3, 0.9),
    "fuel_red": mat("fuel_red", hexrgb("#c0392b"), 0.5),
    "hose": mat("fuel_hose_black", hexrgb("#222222"), 0.6),
    "orange": mat("safety_orange", hexrgb("#f06a1d"), 0.6),
    "yellow": mat("safety_yellow", hexrgb("#f2c230"), 0.5),
    "ext_red": mat("extinguisher_red", hexrgb("#d0312d"), 0.4),
    "rope": mat("rope_blue", hexrgb("#3b6ea5"), 0.9),
    "anchor": mat("anchor_galv", hexrgb("#8f9497"), 0.4, 0.8),
    "rego": mat("rego_sticker", hexrgb("#ffffff"), 0.5),
    "rego_text": mat("rego_text_black", hexrgb("#111111"), 0.5),
    "skin": mat("skin", hexrgb("#d9a77f"), 0.7),
    "shirt_skipper": mat("shirt_skipper", hexrgb("#3a6d8c"), 0.8),
    "shirt_assessor": mat("shirt_assessor", hexrgb("#2f6b3f"), 0.8),
    "shirt_pass": mat("shirt_passenger", hexrgb("#b5523b"), 0.8),
    "pants": mat("pants", hexrgb("#2b2f38"), 0.8),
    "pfd": mat("pfd_red", hexrgb("#d9452b"), 0.7),
    "bucket": mat("bucket_white", hexrgb("#f2f2f2"), 0.5),
    "radio": mat("radio_black", hexrgb("#151515"), 0.5),
}

LOA, BEAM = 5.5, 2.2
SOLE = 0.30  # cockpit floor, above WL
root = bpy.data.objects.new("boat", None)
bpy.context.scene.collection.objects.link(root)

# ── hull: stations (y, half-beam at sheer, chine half-beam, chine z, keel z, sheer z) ─────────
ST = [
    (-2.75, 1.02, 0.92, -0.12, -0.28, 0.78),
    (-1.75, 1.08, 0.97, -0.12, -0.30, 0.80),
    (-0.50, 1.10, 0.98, -0.10, -0.30, 0.84),
    (0.75, 1.06, 0.90, -0.04, -0.26, 0.88),
    (1.75, 0.88, 0.66, 0.08, -0.12, 0.94),
    (2.40, 0.55, 0.32, 0.25, 0.10, 0.99),
    (2.75, 0.06, 0.03, 0.45, 0.40, 1.02),
]
b = Builder("hull")
rings = []
for y, bw, cw, cz, kz, sz in ST:
    rings.append([(-bw, y, sz), (-cw, y, cz), (0, y, kz), (cw, y, cz), (bw, y, sz)])
# topsides (white) and bottom (antifoul) as separate strips so materials split at the chine
top_p = [[r[0], r[1]] for r in rings]
top_s = [[r[3], r[4]] for r in rings]
bot = [[r[1], r[2], r[3]] for r in rings]
b.grid(M["hull"], [[r[4], r[3]] for r in rings])
b.grid(M["hull"], [[r[1], r[0]] for r in rings])
b.grid(M["bottom"], [[r[3], r[2], r[1]] for r in rings])
# boot stripe just above the waterline (thin band, slightly proud of the hull)
for side in (-1, 1):
    pts = []
    for y, bw, cw, cz, kz, sz in ST[:-1]:
        w = cw + (bw - cw) * (0.08 - cz) / max(0.01, sz - cz) + 0.012
        pts.append(((side * w, y, 0.08), (side * w, y, 0.16)))
    b.grid(M["stripe"], [[p[0] for p in pts], [p[1] for p in pts]] if side > 0 else [[p[1] for p in pts], [p[0] for p in pts]])
# transom
r0 = rings[0]
b.poly(M["hull"], r0, [tuple(range(5))])
# gunwale cap + inner topsides down to the sole, sole itself
inner = [(y, bw - 0.07, sz) for y, bw, cw, cz, kz, sz in ST[:-2]]
b.grid(M["inner"], [[(-w - 0.07, y, z) for y, w, z in inner], [(-w, y, z) for y, w, z in inner]])
b.grid(M["inner"], [[(w, y, z) for y, w, z in inner], [(w + 0.07, y, z) for y, w, z in inner]])
b.grid(M["inner"], [[(-w, y, SOLE) for y, w, z in inner], [(-w, y, z) for y, w, z in inner]])
b.grid(M["inner"], [[(w, y, z) for y, w, z in inner], [(w, y, SOLE) for y, w, z in inner]])
b.grid(M["deck"], [[(-w, y, SOLE) for y, w, z in inner], [(w, y, SOLE) for y, w, z in inner]])
# inner face of the transom (splashwell) + a motor-well notch
b.box(M["inner"], (0, -2.70, (SOLE + 0.78) / 2), (2.0, 0.08, 0.78 - SOLE))
# foredeck (closed bow from y=1.75 forward, with an anchor-well hatch)
y5, w5, z5 = ST[4][0], ST[4][1], ST[4][5]
y6, w6, z6 = ST[5][0], ST[5][1], ST[5][5]
y7, w7, z7 = ST[6][0], ST[6][1], ST[6][5]
b.poly(M["deck"], [(-w5, y5, z5), (w5, y5, z5), (w6, y6, z6), (w7, y7, z7), (-w7, y7, z7), (-w6, y6, z6)], [(0, 1, 2, 3, 4, 5)])
b.box(M["inner"], (0, y5, (SOLE + z5) / 2), (2 * w5 - 0.1, 0.06, z5 - SOLE))
b.box(M["dash"], (0, 2.3, z6 + 0.01), (0.45, 0.35, 0.02))  # anchor well hatch
# bow rail (stainless)
for side in (-1, 1):
    for y in (1.3, 2.0):
        w = next(s[1] for s in ST if s[0] >= y) - 0.08
        b.cyl(M["steel"], (side * w, y, 0.92), 0.015, 0.015, 0.45, seg=6)
    b.cyl(M["steel"], (side * 0.75, 1.65, 1.37), 0.018, 0.018, 1.2, seg=6, axis="y", rz=side * 0.25)
# centre console + windscreen + dash, leaning post, cushions
b.box(M["console"], (0, 0.525, SOLE + 0.425), (0.75, 0.65, 0.85))  # console body y 0.2..0.85, top z 1.15
b.box(M["console"], (0, 0.70, SOLE + 0.95), (0.75, 0.3, 0.2))  # upper box y 0.55..0.85, top z 1.35
# sloped dash (black) from the body top-aft edge up to the upper box, + side cheeks
dz0, dz1 = SOLE + 0.85, SOLE + 1.05
b.poly(M["dash"], [(-0.375, 0.2, dz0), (0.375, 0.2, dz0), (0.375, 0.55, dz1), (-0.375, 0.55, dz1)], [(0, 1, 2, 3)])
for x in (-0.375, 0.375):
    b.poly(M["console"], [(x, 0.2, dz0), (x, 0.55, dz0), (x, 0.55, dz1)], [(0, 1, 2)])
b.box(M["glass"], (0, 0.78, SOLE + 1.17), (0.8, 0.02, 0.28), rx=-0.45)  # windscreen
b.box(M["console"], (0, 1.12, SOLE + 0.25), (0.75, 0.45, 0.5))  # front console seat
b.box(M["cushion"], (0, 1.12, SOLE + 0.53), (0.75, 0.45, 0.08))
b.box(M["console"], (0, -0.65, SOLE + 0.35), (0.9, 0.55, 0.7))  # leaning post / esky seat
b.box(M["cushion"], (0, -0.65, SOLE + 0.74), (0.9, 0.55, 0.1))
b.box(M["cushion"], (0, -0.92, SOLE + 1.05), (0.9, 0.08, 0.5))
b.box(M["cushion"], (0, 1.95, 0.99), (1.0, 0.5, 0.06))  # bow cushion
# cleats: bow, both quarters, both mid
for x, y, z in ((0, 2.52, 1.0), (0.85, -2.55, 0.79), (-0.85, -2.55, 0.79), (1.03, -0.1, 0.86), (-1.03, -0.1, 0.86)):
    b.box(M["steel"], (x, y, z + 0.04), (0.05, 0.2, 0.03))
    b.box(M["steel"], (x, y, z + 0.015), (0.04, 0.06, 0.03))
# rego sticker/numbers both sides of the bow (WA: on both sides, forward)
for side in (-1, 1):
    b.box(M["rego"], (side * 0.99, 1.25, 0.6), (0.01, 0.7, 0.16), rz=side * 0.12)
    b.box(M["rego_text"], (side * 1.0, 1.25, 0.6), (0.01, 0.6, 0.09), rz=side * 0.12)
# safety gear: fuel tank + line + bulb, lifejackets, EPIRB, flares, extinguisher, bilge, bucket, anchor, radio
b.box(M["fuel_red"], (0.55, -2.15, SOLE + 0.17), (0.35, 0.5, 0.34))  # portable tank, stbd aft
b.cyl(M["dash"], (0.55, -2.05, SOLE + 0.34), 0.04, 0.04, 0.03, seg=8)  # tank gauge
b.cyl(M["hose"], (0.35, -2.45, SOLE + 0.1), 0.012, 0.012, 0.55, seg=6, axis="x")
b.ico(M["hose"], (0.3, -2.45, SOLE + 0.1), 0.05, scale=(1.6, 1, 1), sub=1)  # primer bulb
b.cyl(M["hose"], (0.05, -2.65, SOLE + 0.3), 0.012, 0.012, 0.6, seg=6, rz=0)
b.box(M["orange"], (0, 1.65, SOLE + 0.35), (0.6, 0.15, 0.5))  # lifejacket bag at the front seat
b.box(M["yellow"], (-0.39, 0.6, SOLE + 0.6), (0.04, 0.1, 0.25))  # EPIRB on console port side
b.cyl(M["orange"], (-0.4, 0.7, SOLE + 0.45), 0.06, 0.06, 0.35, seg=8, axis="y")  # flare canister
b.cyl(M["ext_red"], (0.42, 0.55, SOLE + 0.3), 0.06, 0.06, 0.4, seg=8)  # extinguisher
b.cyl(M["dash"], (-0.35, -2.45, 0.05), 0.07, 0.07, 0.18, seg=8)  # bilge pump in the sump
b.cyl(M["bucket"], (-0.65, -1.75, SOLE), 0.15, 0.12, 0.26, seg=10)  # bucket
b.box(M["anchor"], (0, 2.3, 0.75), (0.25, 0.35, 0.1))  # anchor in the well
b.ico(M["rope"], (0.0, 2.15, 0.7), 0.12, scale=(1.2, 1.2, 0.4), sub=1)
b.box(M["radio"], (-0.2, 0.40, SOLE + 0.97), (0.18, 0.08, 0.07), rx=-0.5)  # VHF/27 MHz in the console
b.cyl(M["steel"], (-0.33, 0.8, SOLE + 1.05), 0.01, 0.01, 1.7, seg=5)  # whip aerial
# coiled lines
for x, y, z in ((0.18, 2.32, 0.99), (0.62, -2.45, SOLE + 0.02), (0.8, -0.05, SOLE + 0.02)):
    b.ico(M["rope"], (x, y, z + 0.04), 0.14, scale=(1, 1, 0.3), sub=1)
hull = b.finish(parent=root)

# ── dash bits that are hotspots but not animated: key + lanyard ───────────────────────────────
b = Builder("dash_key_lanyard")
b.box(M["steel"], (0.24, 0.36, SOLE + 0.95), (0.03, 0.05, 0.03))  # key in the ignition
b.box(M["fuel_red"], (0.15, 0.33, SOLE + 0.93), (0.04, 0.03, 0.03))  # kill-switch clip
b.cyl(M["fuel_red"], (0.15, 0.3, SOLE + 0.62), 0.008, 0.008, 0.3, seg=5)  # coiled lanyard hanging
b.finish(parent=root)

# ── wheel: origin at hub, local Y = spin axis (object tilted 30° back toward the helm) ─────────
HUB = Vector((0.0, 0.30, SOLE + 0.97))  # just proud of the sloped dash
R_ = 0.19
bpy.ops.mesh.primitive_torus_add(major_radius=R_, minor_radius=0.017, major_segments=20, minor_segments=6, location=(0, 0, 0), rotation=(math.pi / 2, 0, 0))
w = bpy.context.active_object
w.name = "wheel"
bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
w.data.materials.append(M["dash"])
b = Builder("wheel_spokes")
for k in range(3):
    ang = math.radians(90 + k * 120)
    b.box(M["steel"], (math.cos(ang) * R_ / 2, 0, math.sin(ang) * R_ / 2), (R_, 0.02, 0.025), ry=-ang)
b.cyl(M["steel"], (0, -0.03, 0), 0.04, 0.04, 0.08, seg=8, axis="y")
sp = b.finish()
# join spokes into wheel
bpy.ops.object.select_all(action="DESELECT")
sp.select_set(True)
w.select_set(True)
bpy.context.view_layer.objects.active = w
bpy.ops.object.join()
w.parent = root
w.location = HUB
w.rotation_euler = (math.radians(-35), 0, 0)  # local +Y points forward-down into the dash; -Y = toward the helmsman (aft-up)

# ── throttle/shift lever: origin at pivot, handle up; forward throttle = negative X rotation ──
b = Builder("lever")
b.box(M["dash"], (0, 0, 0.02), (0.08, 0.14, 0.04))
b.cyl(M["steel"], (0, 0, 0), 0.012, 0.012, 0.2, seg=6)
b.ico(M["dash"], (0, 0, 0.21), 0.035, sub=1)
lev = b.finish(parent=root)
lev.location = (0.41, 0.35, SOLE + 0.7)  # side-mount on the console starboard face

# ── outboard: origin on the swivel (steering) axis at the transom ─────────────────────────────
PIV = Vector((0.0, -2.88, 0.62))
b = Builder("outboard")
b.box(M["dash"], (0, 0.04, 0.05), (0.18, 0.14, 0.35))  # swivel/clamp bracket on the axis
b.box(M["engine"], (0, -0.32, 0.55), (0.48, 0.66, 0.5))  # cowling
b.box(M["engine"], (0, -0.36, 0.85), (0.42, 0.55, 0.14))
b.box(M["engine_hi"], (0, -0.32, 0.55), (0.49, 0.4, 0.06))
b.box(M["engine"], (0, -0.18, 0.15), (0.32, 0.4, 0.3))  # lower cowl
b.box(M["engine"], (0, -0.16, -0.45), (0.14, 0.24, 0.95))  # leg / midsection
b.box(M["engine"], (0, -0.12, -0.92), (0.36, 0.42, 0.03))  # anti-cavitation plate
b.cyl(M["engine"], (0, -0.12, -1.07), 0.08, 0.08, 0.42, seg=10, axis="y")  # gearcase torpedo
b.box(M["engine"], (0, -0.08, -1.22), (0.04, 0.3, 0.18))  # skeg
b.box(M["dash"], (0.072, -0.12, -0.78), (0.005, 0.12, 0.05))  # water intake grilles (both sides)
b.box(M["dash"], (-0.072, -0.12, -0.78), (0.005, 0.12, 0.05))
b.box(M["engine"], (0, 0.18, 0.62), (0.08, 0.35, 0.06))  # tiller/steering arm stub toward the boat
out = b.finish(parent=root)
out.location = PIV
# prop: origin at hub, spins about local Y
b = Builder("prop")
b.cyl(M["prop"], (0, 0, 0), 0.05, 0.04, 0.16, seg=8, axis="y")
for k in range(3):
    ang = k * 2 * math.pi / 3
    b.box(M["prop"], (math.cos(ang) * 0.11, 0, math.sin(ang) * 0.11), (0.16, 0.012, 0.09), ry=-ang, rz=0.35)
prop = b.finish()
prop.parent = out
prop.location = (0, -0.38, -1.07)

# ── people: simple seated/standing low-poly figures ───────────────────────────────────────────


def figure(name, base, shirt, seated, facing=0.0, pfd=False):
    bb = Builder(name)
    x, y, z = base
    c, s_ = math.cos(facing), math.sin(facing)

    def at(dx, dy, dz):
        return (x + dx * c - dy * s_, y + dx * s_ + dy * c, z + dz)

    hip = 0.45 if seated else 0.85
    if seated:
        for sx in (-0.11, 0.11):
            bb.box(M["pants"], at(sx, 0.2, hip - 0.02), (0.13, 0.42, 0.14), rz=facing)
            bb.box(M["pants"], at(sx, 0.4, hip / 2 - 0.05), (0.12, 0.12, hip - 0.1), rz=facing)
    else:
        for sx in (-0.11, 0.11):
            bb.box(M["pants"], at(sx, 0, hip / 2), (0.13, 0.15, hip), rz=facing)
    bb.box(M["pfd"] if pfd else shirt, at(0, 0, hip + 0.3), (0.4, 0.24, 0.6), rz=facing)
    for sx in (-0.25, 0.25):
        bb.box(shirt, at(sx, 0.12, hip + 0.32), (0.09, 0.32, 0.1), rz=facing, rx=0.6)
    bb.ico(M["skin"], at(0, 0.02, hip + 0.75), 0.11, scale=(0.9, 1, 1.1), sub=2)
    return bb.finish(parent=root)


figure("person_skipper", (0, -0.4, SOLE), M["shirt_skipper"], seated=False, pfd=True)
figure("person_assessor", (-0.62, -0.25, SOLE), M["shirt_assessor"], seated=False)
figure("person_passenger", (0, 1.05, SOLE + 0.53 - 0.45), M["shirt_pass"], seated=True, facing=math.pi, pfd=True)

# ── empties: helm eye + hotspots ─────────────────────────────────────────────────────────────
empty("person_skipper_seat", (0, -0.35, SOLE + 1.18), root, 0.1)
HS = {
    "hs_fuel_bulb": (0.3, -2.45, SOLE + 0.1),
    "hs_fuel_line": (0.05, -2.65, SOLE + 0.45),
    "hs_fuel_gauge": (0.55, -2.05, SOLE + 0.36),
    "hs_lanyard": (0.15, 0.31, SOLE + 0.9),
    "hs_key": (0.24, 0.34, SOLE + 0.97),
    "hs_lifejackets": (0, 1.65, SOLE + 0.4),
    "hs_epirb": (-0.42, 0.6, SOLE + 0.6),
    "hs_flares": (-0.46, 0.7, SOLE + 0.45),
    "hs_extinguisher": (0.48, 0.55, SOLE + 0.3),
    "hs_bilge": (-0.35, -2.45, 0.1),
    "hs_bucket": (-0.65, -1.75, SOLE + 0.15),
    "hs_anchor": (0, 2.3, 0.82),
    "hs_radio": (-0.2, 0.38, SOLE + 1.0),
    "hs_rego": (-1.0, 1.25, 0.6),
    "hs_cleat_bow": (0, 2.52, 1.05),
    "hs_cleat_stern": (0.85, -2.55, 0.84),
    "hs_cleat_mid_port": (-1.03, -0.1, 0.91),
    "hs_cleat_mid_stbd": (1.03, -0.1, 0.91),
    "hs_line_bow": (0.18, 2.32, 1.05),
    "hs_line_stern": (0.62, -2.45, SOLE + 0.08),
    "hs_line_spring": (0.8, -0.05, SOLE + 0.08),
}
for n, p in HS.items():
    empty(n, p, root, 0.06)
# hotspots that ride on animated parts
e = empty("hs_lever", (0, 0, 0.21), None, 0.06)
e.parent = lev
e = empty("hs_intakes", (0.08, -0.12, -0.78), None, 0.06)
e.parent = out
e = empty("hs_prop", (0, 0, 0), None, 0.06)
e.parent = prop

bpy.context.view_layer.update()
export_glb(OUT)

# footprint at the sheer (max extent), boat frame x = starboard, y = forward
pts = [(round(bw, 3), round(y, 3)) for y, bw, *_ in ST if y != 0.75]  # 11 points in total
foot = [[x, y] for x, y in pts] + [[-x, y] for x, y in reversed(pts[:-1])]
# drop the near-duplicate bow point pair into a single stem point
foot = [p for p in foot if not (abs(p[0]) < 0.1 and p[1] > 2.7)]
foot.insert(len(pts) - 1, [0.0, 2.75])
foot = [p for i, p in enumerate(foot) if p not in foot[:i]]
# make CCW
area = sum(foot[i][0] * foot[(i + 1) % len(foot)][1] - foot[(i + 1) % len(foot)][0] * foot[i][1] for i in range(len(foot)))
if area < 0:
    foot.reverse()
json.dump({
    "frame": "boat frame: x = starboard, y = forward (bow), metres, origin midships on the centreline at the waterline; three.js: x = x, z = -y",
    "length": LOA, "beam": BEAM, "draftHull": 0.30, "draftLegDown": 1.31, "deckZ": SOLE, "sheerZ": [0.78, 1.02],
    "outboardPivot": [round(PIV.x, 3), round(PIV.y, 3), round(PIV.z, 3)],
    "poly": foot,
}, open(FOOT, "w"), indent=1)
names = sorted(o.name for o in bpy.data.objects)
print("BOAT_NODES " + json.dumps(names), flush=True)
