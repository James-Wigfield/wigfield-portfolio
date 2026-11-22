"""Palm Beach EAST ramp venue → venue.glb (headless).

  blender -b --factory-startup --python venue.py -- --layout public/skippers-sim/venue-layout.json --out <glb>

Everything is placed from venue-layout.json (made by tools/skippers-sim/layout.mjs) so the GLB
and the physics agree. No water surface (the game draws water). Plain materials, no bake.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from kit import Builder, args_after_dashdash, export_glb, hexrgb, mat, reset, rng  # noqa: E402

a = args_after_dashdash()
LAYOUT = a[a.index("--layout") + 1]
OUT = a[a.index("--out") + 1]
L = json.load(open(LAYOUT, encoding="utf8"))
R = rng(17)

reset()

# ── palette (Australian coastal, chart-paper friendly) ───────────────────────────────────────
M = {
    "concrete": mat("concrete", hexrgb("#b9b5ab"), 0.9),
    "concrete_wet": mat("concrete_wet", hexrgb("#8d8a82"), 0.6),
    "grip": mat("grip_mesh", hexrgb("#55534f"), 0.8, 0.3),
    "kerb": mat("galv_kerb", hexrgb("#c9ccce"), 0.45, 0.6),
    "deck": mat("jetty_deck_green", hexrgb("#5f7f55"), 0.85),
    "pile": mat("pile_dark", hexrgb("#2f2b27"), 0.85),
    "post": mat("post_black", hexrgb("#1f1f1f"), 0.7),
    "galv": mat("galvanised", hexrgb("#a9adb0"), 0.4, 0.8),
    "lamp": mat("lamp_glow", hexrgb("#fff3cf"), 0.3, 0.0, emit=2.0),
    "rock": mat("rock_limestone", hexrgb("#b59a72"), 0.95),
    "rock2": mat("rock_dark", hexrgb("#7d6a52"), 0.95),
    "weed": mat("rock_weed", hexrgb("#4a4a32"), 0.9),
    "sand": mat("sand", hexrgb("#e6d8b8"), 1.0),
    "sand_wet": mat("sand_wet", hexrgb("#c7b48e"), 0.9),
    "seabed": mat("seabed_sand", hexrgb("#c9bd9a"), 1.0),
    "grass": mat("grass", hexrgb("#7d9a52"), 1.0),
    "scrub": mat("dune_scrub", hexrgb("#6f7f4a"), 1.0),
    "road": mat("asphalt", hexrgb("#4b4c4e"), 0.9),
    "path": mat("path_paving", hexrgb("#cfc6b3"), 0.9),
    "pine": mat("norfolk_pine", hexrgb("#2f4a2c"), 0.9),
    "tree": mat("tree_canopy", hexrgb("#3d5a33"), 0.9),
    "trunk": mat("trunk", hexrgb("#5a4634"), 0.9),
    "hull": mat("hull_white", hexrgb("#f4f4f0"), 0.35),
    "hull_line": mat("boot_stripe_navy", hexrgb("#24364f"), 0.5),
    "deck_boat": mat("boat_deck_grey", hexrgb("#d9d6cf"), 0.7),
    "mast": mat("mast_alu", hexrgb("#c8cbcd"), 0.35, 0.8),
    "canvas": mat("canvas_navy", hexrgb("#2e3f5c"), 0.8),
    "buoy": mat("buoy_yellow", hexrgb("#f2c230"), 0.5),
    "fence": mat("fence_mesh", hexrgb("#9ea3a6"), 0.5, 0.6),
    "barrier": mat("barrier_orange", hexrgb("#e5682a"), 0.6),
    "sign": mat("sign_white", hexrgb("#f2f2ee"), 0.6),
    "sign_red": mat("sign_red", hexrgb("#c0392b"), 0.6),
    "wall": mat("building_render", hexrgb("#e9e3d6"), 0.9),
    "roof": mat("roof_terracotta", hexrgb("#a65a3f"), 0.8),
    "roof2": mat("roof_colorbond", hexrgb("#6d7377"), 0.6),
    "island": mat("distant_land", hexrgb("#8a9a86"), 1.0),
    "island2": mat("distant_land_far", hexrgb("#a7b2a8"), 1.0),
    "industrial": mat("distant_industrial", hexrgb("#c3c6c7"), 1.0),
    "timber": mat("timber_grey", hexrgb("#8c8274"), 0.9),
}

H = math.radians(L["rampHeadingDeg"])
U = Vector((math.sin(H), math.cos(H), 0))
V = Vector((math.cos(H), -math.sin(H), 0))
RW = L["ramp"]["width"]
JW = L["jetty"]["width"]
TOE = L["ramp"]["toeS"]
TOP = L["ramp"]["topS"]
DECK = L["jetty"]["deckHeight"]
JLEN = L["jetty"]["length"]


def P(s, t, z=0.0):
    p = U * s + V * t
    return (p.x, p.y, z)


def ramp_z(s):
    """Ramp surface height at s: 0.12 slope from below water up to s=-40, then 0.03 to the top, then flat."""
    if s >= -40:
        return (TOE - s) * 0.12
    if s >= TOP:
        return (TOE + 40) * 0.12 + (-40 - s) * 0.03
    return (TOE + 40) * 0.12 + (-40 - TOP) * 0.03


TOP_Z = ramp_z(TOP - 1)  # ≈ 2.7 m: land level behind the beach
LAND_Z = 2.2


def deck_z(s):
    if s >= TOE:
        return DECK
    return DECK + (TOE - s) / (TOE + JLEN) * (DECK - L["jetty"]["deckHeightRoot"]) * -1


# ── ramp ──────────────────────────────────────────────────────────────────────────────────────
b = Builder("ramp")
ss = [TOE + 10, TOE + 5, TOE, TOE - 5, TOE - 10, -40, -50, TOP, TOP - 18]
rows = [[P(s, t, ramp_z(s)) for t in (-RW / 2, -JW / 2, JW / 2, RW / 2)] for s in ss]
b.grid(M["concrete"], rows)
# underside skirt so the ramp reads as a slab from the water
for t in (-RW / 2, RW / 2):
    b.grid(M["concrete_wet"], [[P(s, t, ramp_z(s)) for s in ss], [P(s, t, ramp_z(s) - 0.5) for s in ss]])
# grip-mesh pads just above and below the waterline (both lanes)
for t0, t1 in ((-RW / 2 + 0.3, -JW / 2 - 0.3), (JW / 2 + 0.3, RW / 2 - 0.3)):
    s0, s1 = TOE + 6, TOE - 6
    b.grid(M["grip"], [[P(s0, t0, ramp_z(s0) + 0.03), P(s0, t1, ramp_z(s0) + 0.03)], [P(s1, t0, ramp_z(s1) + 0.03), P(s1, t1, ramp_z(s1) + 0.03)]])
# galvanised kerbs on the outer edges
for t in (-RW / 2 + 0.12, RW / 2 - 0.12):
    for i in range(len(ss) - 1):
        s0, s1 = ss[i], ss[i + 1]
        mid = (s0 + s1) / 2
        length = abs(s1 - s0)
        b.box(M["kerb"], P(mid, t, ramp_z(mid) + 0.1), (0.25, length, 0.2), rz=-H, rx=math.atan2(ramp_z(s1) - ramp_z(s0), length) * (-1 if s1 < s0 else 1))
b.finish()

# ── centre jetty: deck, piles, east-edge posts, cleats, light pole ────────────────────────────
b = Builder("jetty_centre")
segs = [0, -5, -10, -15, -20, TOE, -28, -JLEN]
for i in range(len(segs) - 1):
    s0, s1 = segs[i], segs[i + 1]
    z0, z1 = deck_z(s0), deck_z(s1)
    top = [P(s0, -JW / 2, z0), P(s0, JW / 2, z0), P(s1, JW / 2, z1), P(s1, -JW / 2, z1)]
    bot = [(p[0], p[1], p[2] - 0.25) for p in top]
    b.poly(M["deck"], top + bot, [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)])
for s in range(0, int(TOE) - 1, -3):
    for t in (-JW / 2 + 0.1, JW / 2 - 0.1):
        b.cyl(M["pile"], P(s - 0.2, t, -3.0), 0.14, 0.14, 3.0 + deck_z(s) - 0.2, seg=8)
for s in range(-1, int(-JLEN), -3):
    b.box(M["post"], P(s, JW / 2 - 0.08, deck_z(s) + 0.5), (0.12, 0.12, 1.0), rz=-H)  # black posts, east edge (Street View)
# stringers along both sides
for t in (-JW / 2, JW / 2):
    b.box(M["timber"], P(-JLEN / 2, t, DECK - 0.35), (0.15, JLEN, 0.2), rz=-H)
jetty = b.finish()

for c in L["jetty"]["cleats"]:
    s = (Vector((c["x"], c["y"], 0))).dot(U)
    cb = Builder(c["name"])
    z = deck_z(s)
    cb.box(M["galv"], (c["x"], c["y"], z + 0.06), (0.08, 0.32, 0.05), rz=-H)
    cb.box(M["galv"], (c["x"], c["y"], z + 0.02), (0.06, 0.1, 0.06), rz=-H)
    cb.finish(origin=(c["x"], c["y"], z))

lp = L["jetty"]["lightPole"]
b = Builder("jetty_light_pole")
b.cyl(M["galv"], (lp["x"], lp["y"], DECK), 0.09, 0.06, lp["h"] - DECK, seg=10)
b.box(M["galv"], (lp["x"], lp["y"], lp["h"] + 0.05), (0.25, 0.5, 0.12))
b.box(M["lamp"], (lp["x"], lp["y"], lp["h"] - 0.03), (0.2, 0.4, 0.04))
b.finish(origin=(lp["x"], lp["y"], DECK))

# ── rock revetments: boulders scattered over each rock polygon ────────────────────────────────


def inside(poly, x, y):
    c = False
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def boulder_field(name, poly, z_fn, n, rmin=0.5, rmax=1.2, weed_below=0.3):
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    b = Builder(name)
    # core mound so there are no holes between boulders
    cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
    top = [(x + (cx - x) * 0.15, y + (cy - y) * 0.15, z_fn(x, y) - 0.2) for x, y in poly]
    base = [(x, y, -2.0) for x, y in poly]
    k = len(poly)
    faces = [tuple(range(k))[::-1]] + [(i, (i + 1) % k, k + (i + 1) % k, k + i) for i in range(k)]
    b.poly(M["rock2"], top + base, faces)
    placed = 0
    tries = 0
    while placed < n and tries < n * 20:
        tries += 1
        x, y = R.uniform(min(xs), max(xs)), R.uniform(min(ys), max(ys))
        if not inside(poly, x, y):
            continue
        r = R.uniform(rmin, rmax)
        z = z_fn(x, y) - r * 0.35
        m = M["weed"] if z < weed_below else (M["rock"] if R.random() < 0.7 else M["rock2"])
        b.ico(m, (x, y, z), r, scale=(R.uniform(0.9, 1.4), R.uniform(0.8, 1.2), R.uniform(0.55, 0.8)), sub=1, jitter=r * 0.18, rz=R.uniform(0, 6.3), rng=R)
        placed += 1
    return b.finish()


def rock_z(x, y):
    s = Vector((x, y, 0)).dot(U)
    return max(-0.6, min(LAND_Z + 0.3, (TOE - 2 - s) * 0.16 + 0.4))


cols = {c["name"]: c for c in L["colliders"]}
boulder_field("rock_west", cols["rock_west"]["poly"], rock_z, 230)
boulder_field("rock_east", cols["rock_east"]["poly"], rock_z, 200)

# ── beaches, dunes/grass, Esplanade, seabed ──────────────────────────────────────────────────
SHORE_W = [(-460, 35), (-250, 24), (-112, 19), (-78, -2), (-40, -17), (-22, -23)]
SHORE_E = [(3, -40), (30, -50), (80, -59), (212, -88), (338, -125), (470, -146)]


def land_strip(name, line, flank):
    b = Builder(name)
    # offsets measured inland (−y), heights: seabed → waterline → berm → dune top → grass
    ramp_end = len(line) - 1 if flank == "w" else 0

    def off(k, o, z):
        # inland is −y, except the end beside the ramp, which runs parallel to the ramp axis (−U)
        x, y = line[k]
        d = (U.x, U.y) if k == ramp_end else (0.0, 1.0)
        return (x + d[0] * o, y + d[1] * o, z)

    prof = [(+14, -1.1, "sand_wet"), (0, 0.0, "sand"), (-12, 1.0, "sand"), (-22, 1.8, "scrub"), (-30, LAND_Z, "grass"), (-62, LAND_Z + 0.4, "grass")]
    for i in range(len(prof) - 1):
        o0, z0, _ = prof[i]
        o1, z1, mname = prof[i + 1]
        mname = "sand_wet" if i == 0 else mname
        b.grid(M[mname], [[off(k, o0, z0) for k in range(len(line))], [off(k, o1, z1) for k in range(len(line))]])
    # close the end facing the ramp so it doesn't look paper-thin
    k = len(line) - 1 if flank == "w" else 0
    ring = [off(k, 14, -1.1), off(k, 0, 0), off(k, -12, 1.0), off(k, -62, LAND_Z + 0.4)]
    ring += [(ring[-1][0], ring[-1][1], -1.5), (ring[0][0], ring[0][1], -1.5)]
    b.poly(M["sand"], ring, [(0, 1, 2, 3, 4, 5)])
    return b.finish()


land_strip("beach_west_polo", SHORE_W, "w")
land_strip("beach_east_esplanade", SHORE_E, "e")

# land behind the rock walls on both sides of the ramp (fills the gap between beaches and ramp)
b = Builder("ramp_surrounds")
for side in (-1, 1):
    t0, t1 = side * (RW / 2 + 0.05), side * 14.3
    s0, s1 = -46, TOP - 30
    b.grid(M["grass"], [[P(s0, t0, LAND_Z + 0.05), P(s0, t1, LAND_Z + 0.05)], [P(s1, t0, LAND_Z + 0.45), P(s1, t1, LAND_Z + 0.45)]])
    # sand/rubble bed under each rock wall, so there is no hole between the rocks and the beaches
    tb0, tb1 = side * (RW / 2 + 0.05), side * 17.0
    b.grid(M["sand_wet"], [[P(-20, tb0, -0.9), P(-20, tb1, -0.9)], [P(-30, tb0, 0.6), P(-30, tb1, 0.6)], [P(-47, tb0, LAND_Z + 0.05), P(-47, tb1, LAND_Z + 0.05)]])
# turnaround apron at the top of the ramp
b.grid(M["concrete"], [[P(TOP - 18, -14, ramp_z(TOP - 18)), P(TOP - 18, 14, ramp_z(TOP - 18))], [P(TOP - 34, -14, ramp_z(TOP - 18)), P(TOP - 34, 14, ramp_z(TOP - 18))]])
b.finish()

# Esplanade road (measured off the z18 satellite) + footpath on the beach side
ROAD = [(-470, -40), (-250, -55), (-120, -75), (-25, -95), (100, -122), (300, -152), (480, -178)]
b = Builder("esplanade")
z_r = LAND_Z + 0.5
b.grid(M["road"], [[(x, y + 5, z_r) for x, y in ROAD], [(x, y - 5, z_r) for x, y in ROAD]])
b.grid(M["path"], [[(x, y + 9, z_r) for x, y in ROAD], [(x, y + 6.5, z_r) for x, y in ROAD]])
b.grid(M["grass"], [[(x, y - 5, z_r) for x, y in ROAD], [(x, y - 60, z_r) for x, y in ROAD]])
b.grid(M["grass"], [[(x, y + 30, LAND_Z + 0.3) for x, y in ROAD], [(x, y + 5, z_r) for x, y in ROAD]])
b.finish()

# hinterland: suburb-coloured ground running inland from behind the Esplanade buildings
b = Builder("hinterland")
b.grid(M["scrub"], [[(x, y - 59, z_r - 0.02) for x, y in ROAD], [(x * 1.6, y - 900, z_r + 6) for x, y in ROAD]])
b.finish()

# seabed (hide it if the water shader is opaque): shallow sand shelf sloping out
b = Builder("seabed")
xs = list(range(-700, 701, 100))
rows = []
for y in (-30, 0, 40, 100, 200, 350, 600):
    depth = {-30: -1.0, 0: -1.6, 40: -2.6, 100: -3.6, 200: -4.6, 350: -5.5, 600: -7.0}[y]
    rows.append([(x, y - 0.12 * x * (x > 0), depth) for x in xs])
b.grid(M["seabed"], rows)
b.finish()

# ── trees: Norfolk pines along the Esplanade + the big round tree behind the ramp ────────────


def norfolk(b, x, y, h, z0=LAND_Z + 0.4):
    b.cyl(M["trunk"], (x, y, z0), 0.35, 0.18, h * 0.97, seg=7)
    tiers = 7
    for i in range(tiers):
        f = i / (tiers - 1)
        zt = z0 + h * (0.25 + 0.7 * f)
        r = (1 - f) * h * 0.18 + 0.6
        b.cyl(M["pine"], (x, y, zt - 0.4), r, r * 0.35, h * 0.11, seg=8, rz=R.uniform(0, 1))
    b.cyl(M["pine"], (x, y, z0 + h * 0.93), 0.5, 0.05, h * 0.09, seg=6)


for p in L["pines"]:
    b = Builder(p["name"])
    norfolk(b, p["x"], p["y"], p["h"])
    b.finish(origin=(p["x"], p["y"], LAND_Z + 0.4))

# more pines (generic) along the Esplanade, both sides of the ramp
b = Builder("pines_esplanade")
for x in list(range(-430, -40, 34)) + list(range(160, 470, 30)):
    y = min(ROAD, key=lambda q: abs(q[0] - x))[1] + 12 + R.uniform(-3, 3)
    if any(abs(x - p["x"]) < 15 and abs(y - p["y"]) < 15 for p in L["pines"]):
        continue
    norfolk(b, x + R.uniform(-4, 4), y, R.uniform(16, 24))
b.finish()

t1 = next(t for t in L["transits"] if t["id"] == "t1")["back"]
b = Builder(t1["name"])
z0 = LAND_Z + 0.4
b.cyl(M["trunk"], (t1["x"], t1["y"], z0), 0.5, 0.35, t1["h"] * 0.55, seg=7)
for dx, dy, dz, r in ((0, 0, 0.62, 5.0), (2.2, 1.0, 0.75, 3.6), (-2.0, -1.2, 0.72, 3.8), (0.3, -0.5, 0.9, 3.0)):
    b.ico(M["tree"], (t1["x"] + dx, t1["y"] + dy, z0 + t1["h"] * dz), r, scale=(1, 1, 0.8), sub=2, jitter=0.4, rng=R)
b.finish(origin=(t1["x"], t1["y"], z0))

# park trees + scrub west of the ramp (Polo Beach reserve)
b = Builder("park_trees")
for x, y in ((-60, -62), (-85, -70), (-40, -78), (-110, -55), (-150, -60), (25, -80), (45, -95), (-20, -60)):
    b.cyl(M["trunk"], (x, y, LAND_Z + 0.4), 0.35, 0.25, 4, seg=6)
    b.ico(M["tree"], (x, y, LAND_Z + 0.4 + 5.5), R.uniform(3, 4.5), scale=(1, 1, 0.75), sub=1, jitter=0.5, rng=R)
b.finish()

# buildings along the inland side of the Esplanade (backdrop)
b = Builder("esplanade_buildings")
for i, x in enumerate(range(-440, 470, 26)):
    if -40 < x < 10:
        continue
    y = min(ROAD, key=lambda q: abs(q[0] - x))[1] - 22 - R.uniform(0, 10)
    w, d, h = R.uniform(12, 20), R.uniform(10, 16), R.choice((4, 4, 7, 7, 10, 13))
    zb = LAND_Z + 0.5
    b.box(M["wall"], (x, y, zb + h / 2), (w, d, h), rz=-0.2)
    b.cyl(M["roof"] if i % 3 else M["roof2"], (x, y, zb + h), max(w, d) * 0.62, 0.5, 2.2, seg=4, rz=-0.2 + math.pi / 4)
b.finish()

# ── moored boats (static) + a few yellow mooring buoys ───────────────────────────────────────


def moored_boat(m):
    b = Builder(f"moored_{m['name'][8:]}")
    h = math.radians(m["headingDeg"])
    f = Vector((math.sin(h), math.cos(h), 0))
    r = Vector((math.cos(h), -math.sin(h), 0))
    L_ = m["len"]
    B = 3.0 if m["kind"] == "yacht" else 2.1
    c = Vector((m["x"], m["y"], 0))
    fb = 0.9 if m["kind"] == "yacht" else 0.6
    # 5-station hull: bow point, shoulders, stern
    st = [(0.5, 0.0), (0.3, 0.42), (0.0, 0.5), (-0.3, 0.48), (-0.5, 0.42)]
    top, wl = [], []
    for a_, w in st:
        for sgn in ((1,) if w == 0 else (-1, 1)):
            pass
    ring = [(0.5, 0.0)] + [(a_, w) for a_, w in st[1:]] + [(a_, -w) for a_, w in reversed(st[1:])]
    for a_, w in ring:
        p = c + f * (a_ * L_) + r * (w * B)
        top.append((p.x, p.y, fb + (0.15 if a_ > 0.3 else 0)))
        q = c + f * (a_ * L_ * 0.94) + r * (w * B * 0.8)
        wl.append((q.x, q.y, -0.25))
    n = len(ring)
    faces = [tuple(range(n))[::-1], tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    b.poly(M["hull"], top + wl, faces)
    b.poly(M["hull_line"], [(p[0], p[1], p[2] + 0.05) for p in wl], [tuple(range(n))])
    cab = c + f * (-0.05 * L_)
    if m["kind"] == "yacht":
        b.box(M["deck_boat"], (cab.x, cab.y, fb + 0.35), (B * 0.55, L_ * 0.35, 0.6), rz=-h)
        mp = c + f * (0.12 * L_)
        b.cyl(M["mast"], (mp.x, mp.y, fb), 0.07, 0.05, L_ * 1.35, seg=6)
        bp = c + f * (-0.12 * L_)
        b.box(M["canvas"], (bp.x, bp.y, fb + 1.4), (0.25, L_ * 0.48, 0.25), rz=-h)
    else:
        b.box(M["deck_boat"], (cab.x, cab.y, fb + 0.5), (0.8, 0.7, 0.9), rz=-h)
        ob = c + f * (-0.5 * L_)
        b.box(M["post"], (ob.x, ob.y, fb), (0.4, 0.5, 1.0), rz=-h)
    return b.finish(origin=(m["x"], m["y"], 0))


for m in L["moorings"]:
    moored_boat(m)

b = Builder("mooring_buoys")
for m in L["moorings"]:
    h = math.radians(m["headingDeg"])
    p = Vector((m["x"], m["y"], 0)) + Vector((math.sin(h), math.cos(h), 0)) * (m["len"] / 2 + 6)
    b.ico(M["buoy"], (p.x, p.y, 0.1), 0.35, sub=1)
for x, y in ((60, 60), (110, 75), (150, 100), (190, 60), (230, 120), (95, 105), (265, 50)):
    b.ico(M["buoy"], (x, y, 0.1), 0.35, sub=1)
b.finish()

# ── the CLOSED west ramp: groyne, ramp slab, fence + barriers + sign ─────────────────────────
g = cols["closed_groyne_west"]["poly"]
boulder_field("closed_groyne_west", g, lambda x, y: max(-0.5, min(1.8, (5 - y) * 0.08 + 0.5)), 90, 0.5, 1.0)
wr = cols["closed_ramp_west"]["poly"]
b = Builder("closed_ramp_west")
ys = sorted({p[1] for p in wr})
xs = sorted({p[0] for p in wr})
b.grid(M["concrete_wet"], [[(xs[0], ys[-1], -0.6), (xs[-1], ys[-1], -0.6)], [(xs[0], ys[0], 2.2), (xs[-1], ys[0], 2.2)]])
# temporary site fence across the top + along the shore side, orange barriers, sign
fy = -14
for x in range(int(xs[0]) - 2, int(xs[-1]) + 3, 3):
    b.box(M["fence"], (x + 1.5, fy, 1.15 + 1.0), (3.0, 0.05, 2.0))
    b.box(M["post"], (x, fy, 1.15 + 1.0), (0.06, 0.6, 2.05))
for x in range(int(xs[0]), int(xs[-1]) + 1, 4):
    b.box(M["barrier"], (x, fy + 3, 1.3 + 0.5), (1.8, 0.4, 1.0))
b.box(M["sign"], ((xs[0] + xs[-1]) / 2, fy + 0.2, 3.6), (2.4, 0.05, 1.2))
b.box(M["sign_red"], ((xs[0] + xs[-1]) / 2, fy + 0.25, 3.95), (2.4, 0.05, 0.35))
b.finish(origin=((xs[0] + xs[-1]) / 2, fy, 0))

# ── Palm Beach jetty (east, ~114 m, deck ~2.5 m) ─────────────────────────────────────────────
lm = {x["name"]: x for x in L["landmarks"]}
pj = lm["palm_beach_jetty"]
hx, hy = pj["head"]
rx_, ry_ = pj["root"]
d = Vector((hx - rx_, hy - ry_, 0))
Lp = d.length
d.normalize()
ang = math.atan2(d.x, d.y)
b = Builder("palm_beach_jetty")
mid = Vector(((hx + rx_) / 2, (hy + ry_) / 2, 2.5))
b.box(M["timber"], tuple(mid), (3.2, Lp, 0.3), rz=-ang)
for i in range(0, int(Lp), 6):
    p = Vector((rx_, ry_, 0)) + d * i
    for side in (-1.4, 1.4):
        q = p + Vector((d.y, -d.x, 0)) * side
        b.cyl(M["pile"], (q.x, q.y, -4), 0.2, 0.2, 6.4, seg=6)
    b.box(M["galv"], (p.x, p.y, 3.2), (3.2, 0.06, 0.05), rz=-ang)
b.finish()
tr3 = next(t for t in L["transits"] if t["id"] == "t3")["front"]
b = Builder(tr3["name"])
b.cyl(M["galv"], (tr3["x"], tr3["y"], 2.65), 0.08, 0.06, tr3["h"] - 2.65, seg=8)
b.box(M["lamp"], (tr3["x"], tr3["y"], tr3["h"]), (0.35, 0.35, 0.2))
b.finish(origin=(tr3["x"], tr3["y"], 2.65))

# ── distant silhouettes (bearing-true, pulled in to ~2.5 km): Garden Island + NE industrial ──


def ridge(name, b0, b1, radius, peak, m, n=40, seed=3):
    rr = rng(seed)
    bb = Builder(name)
    top, bot = [], []
    for i in range(n + 1):
        brg = math.radians(b0 + (b1 - b0) * i / n)
        f = i / n
        hgt = peak * (0.35 + 0.65 * math.sin(math.pi * f) ** 0.6) * rr.uniform(0.75, 1.05)
        x, y = math.sin(brg) * radius, math.cos(brg) * radius
        top.append((x, y, hgt))
        bot.append((x * 1.02, y * 1.02, -3))
    bb.grid(m, [bot, top])
    return bb.finish()


ridge("garden_island", 300, 350, 2500, 14, M["island"])
ridge("coast_far_north", 352, 365, 2700, 5, M["island2"], 12, 5)
b = Builder("industrial_shore_ne")
for i in range(24):
    brg = math.radians(R.uniform(12, 70))
    rad = 2600 + R.uniform(-80, 80)
    x, y = math.sin(brg) * rad, math.cos(brg) * rad
    w, h = R.uniform(15, 60), R.uniform(6, 22)
    b.box(M["industrial"], (x, y, h / 2), (w, w * 0.6, h), rz=-brg)
for brg, h in ((28, 55), (34, 48), (52, 40)):
    br = math.radians(brg)
    b.cyl(M["industrial"], (math.sin(br) * 2600, math.cos(br) * 2600, 0), 3, 2.2, h, seg=8)
b.grid(M["island2"], [[(math.sin(math.radians(a_)) * 2700, math.cos(math.radians(a_)) * 2700, -3) for a_ in range(5, 95, 10)], [(math.sin(math.radians(a_)) * 2700, math.cos(math.radians(a_)) * 2700, 4) for a_ in range(5, 95, 10)]])
b.finish()

bpy.context.view_layer.update()

# optional: bake ambient occlusion into vertex colours (COLOR_0) on the near, detailed meshes
AO = "--ao" in a
if AO:
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = int(a[a.index("--ao") + 1]) if len(a) > a.index("--ao") + 1 and a[a.index("--ao") + 1].isdigit() else 32
    sc.cycles.device = "CPU"
    sc.world = bpy.data.worlds.new("ao_world")
    sc.world.light_settings.distance = 6.0
    want = [o for o in bpy.data.objects if o.type == "MESH" and (
        o.name.startswith(("rock_", "jetty_", "ramp", "cleat_", "closed_", "norfolk_", "pines_", "big_tree", "park_trees", "beach_", "esplanade_buildings", "moored_")))]
    for o in want:
        if "ao" not in o.data.color_attributes:
            o.data.color_attributes.new("ao", "BYTE_COLOR", "CORNER")
        o.data.color_attributes.active_color = o.data.color_attributes["ao"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in want:
        o.select_set(True)
    bpy.context.view_layer.objects.active = want[0]
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS", margin=0)
    # lift so AO only darkens creases (min 0.55)
    for o in want:
        attr = o.data.color_attributes["ao"]
        for d in attr.data:
            v = 0.55 + 0.45 * d.color[0]
            d.color = (v, v, v, 1.0)
    print(f"AO baked on {len(want)} objects", flush=True)

if AO:
    bpy.ops.export_scene.gltf(
        filepath=str(OUT), export_format="GLB", use_selection=False, export_cameras=False, export_lights=False,
        export_animations=False, export_apply=True, export_yup=True, export_texcoords=False, export_normals=True,
        export_tangents=False, export_materials="EXPORT", export_extras=True, export_vertex_color="ACTIVE")
else:
    export_glb(OUT)
names = sorted(o.name for o in bpy.data.objects)
print("VENUE_NODES " + json.dumps(names), flush=True)
