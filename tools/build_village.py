# ============================================================================
# build_village.py — the Aegean village for "Scrolls of the Philosopher"
# ----------------------------------------------------------------------------
# Run headless, from the repo root:
#
#   "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --python tools/build_village.py
#   ... -- --only philosopher            (or village, props; comma-separated)
#
# Authors every piece procedurally (metres, flat Principled colours, no
# textures), saves tools/blender/dl-village.blend and exports three GLBs to
# public/dl-game/:  village.glb (terrain, plaza, houses, colonnade, sea wall,
# lamps, bust), props.glb (SM_Cypress, SM_Olive, SM_Scroll — instanced by the
# game) and philosopher.glb (refs/character.glb re-exported with its meshes
# joined per animated node and material, hierarchy preserved).
#
# The WORLD PLAN mirrors src/.../game/world/layout.js exactly. That file is in
# the three.js frame (+X east, +Y up, +Z south); Blender is Z-up, so every
# world coordinate goes through B(x, y, z) = (x, -z, y). Change a number in
# layout.js and here together, then rebuild.
#
# Modelled on the Portara kit builder (blender/build_kit.py in the Unreal
# project): one def per piece, a Builder wrapping bmesh, a palette dict, a
# piece() registry, one export loop. Palette RGB values are that kit's, so the
# two worlds share a look; M_Parchment and M_Vermilion are the philosopher's
# own colours so his scroll and the pickups match.
# ============================================================================
import bpy, bmesh, math, os, sys, random
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, 'public', 'dl-game')
BLEND = os.path.join(HERE, 'blender', 'dl-village.blend')
CHAR_SRC = r"C:\Users\james\Documents\Unreal Projects\Portara2 5.8 - 2\refs\character.glb"
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.dirname(BLEND), exist_ok=True)
random.seed(7)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ONLY = None
if '--only' in argv:
    ONLY = set(argv[argv.index('--only') + 1].split(','))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0

# ----------------------------------------------------------------------------- world plan (mirror of layout.js)
WALL_T = 0.45
HOUSES = {
    'window': dict(c=(-16.5, 0), size=(11, 4.6, 11), door=dict(side='+x', w=1.8, h=2.7, at=0), wall='M_Stucco_Cream'),
    'eyes':   dict(c=(0, -20),   size=(13, 10.5, 13), door=dict(side='+z', w=2.2, h=3.2, at=0), wall='M_Stucco_Ochre'),
    'door':   dict(c=(19, -3),   size=(20, 5, 9),   door=dict(side='-x', w=1.8, h=2.7, at=0), exit=dict(side='+x', w=1.8, h=2.7, at=0), wall='M_Sandstone'),
}
PLAZA_R, PLAZA_LIP = 9.0, 0.12
TERRACE_Z, TERRACE_Y, TERRACE_ZEND = -30.0, 3.2, -48.0
STAIR = dict(x0=-15.0, x1=-9.0, z0=-25.5, z1=-30.0)
SEA_Z, SEA_Y, SEA_PARAPET = 13.0, -2.4, 1.0
HILL_Z, HILL_SLOPE = -46.0, 0.35
BOUNDS = dict(x0=-30.0, x1=31.5, z0=-44.0, z1=12.4)
LAMPS = [(10.6 * math.cos(math.radians(22.5 + 45 * i)), 10.6 * math.sin(math.radians(22.5 + 45 * i)), 2.6) for i in range(8)]
BUST = dict(x=4.5, z=6.0, h=1.1)
COLONNADE = dict(z=-36.0, xs=[-14, -10, -6, -2, 2, 6, 10, 14], h=5.5, r=0.42)

def B(x, y, z):
    """three.js (x, y, z) → Blender (x, -z, y)."""
    return (x, -z, y)

# ----------------------------------------------------------------------------- materials
PALETTE = {
    'M_Marble':        ((0.92, 0.90, 0.85), 0.35),
    'M_Stucco_Cream':  ((0.88, 0.80, 0.66), 0.85),
    'M_Stucco_Ochre':  ((0.80, 0.60, 0.36), 0.85),
    'M_Sandstone':     ((0.78, 0.68, 0.50), 0.8),
    'M_Terracotta':    ((0.70, 0.33, 0.18), 0.75),
    'M_Paving':        ((0.80, 0.76, 0.68), 0.7),
    'M_Paving_Radial': ((0.84, 0.80, 0.72), 0.7),
    'M_Timber':        ((0.42, 0.28, 0.16), 0.8),
    'M_Cypress':       ((0.10, 0.22, 0.10), 0.9),
    'M_Olive':         ((0.42, 0.50, 0.33), 0.9),
    'M_Bark':          ((0.40, 0.33, 0.25), 0.9),
    'M_Rubble':        ((0.70, 0.66, 0.58), 0.9),
    'M_Grass':         ((0.45, 0.48, 0.24), 0.95),
    'M_Rock':          ((0.62, 0.56, 0.46), 0.9),
    'M_Marker':        ((1.00, 0.75, 0.10), 0.3),
    # the philosopher's own colours (refs/character.glb), for the scroll pickups
    'M_Parchment':     ((0.823, 0.753, 0.604), 0.75),
    'M_Vermilion':     ((0.807, 0.023, 0.001), 0.74),
    'M_Iron':          ((0.16, 0.15, 0.15), 0.6),
}
MATS = {}
for name, (rgb, rough) in PALETTE.items():
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    MATS[name] = m

COLLECTIONS = {}
def collection(name):
    if name not in COLLECTIONS:
        col = bpy.data.collections.new(name)
        scene.collection.children.link(col)
        COLLECTIONS[name] = col
    return COLLECTIONS[name]

# ----------------------------------------------------------------------------- bmesh builder
class Builder:
    """Accumulates geometry for one exported object; material slots by name."""
    def __init__(self, name, col='village'):
        self.name = name
        self.col = col
        self.bm = bmesh.new()
        self.slots = []

    def mi(self, matname):
        if matname not in self.slots:
            self.slots.append(matname)
        return self.slots.index(matname)

    def _tag(self, verts, matname, smooth=False):
        idx = self.mi(matname)
        faces = {f for v in verts for f in v.link_faces}
        for f in faces:
            f.material_index = idx
            f.smooth = smooth
        return faces

    # -- Blender-frame primitives -------------------------------------------
    def box(self, cx, cy, cz, sx, sy, sz, mat, rot_z=0.0):
        r = bmesh.ops.create_cube(self.bm, size=1.0)
        vs = r['verts']
        bmesh.ops.scale(self.bm, vec=(sx, sy, sz), verts=vs)
        if rot_z:
            bmesh.ops.rotate(self.bm, cent=(0, 0, 0), matrix=Matrix.Rotation(rot_z, 3, 'Z'), verts=vs)
        bmesh.ops.translate(self.bm, vec=(cx, cy, cz), verts=vs)
        return self._tag(vs, mat)

    def box_b(self, cx, cy, z0, sx, sy, h, mat, rot_z=0.0):
        return self.box(cx, cy, z0 + h / 2.0, sx, sy, h, mat, rot_z)

    def cyl(self, cx, cy, z0, r1, r2, h, mat, seg=24, smooth=True):
        r = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=h)
        vs = r['verts']
        bmesh.ops.translate(self.bm, vec=(cx, cy, z0 + h / 2.0), verts=vs)
        return self._tag(vs, mat, smooth)

    def sphere(self, cx, cy, cz, r, mat, sx=1, sy=1, sz=1, sub=2, smooth=True):
        r_ = bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=r)
        vs = r_['verts']
        bmesh.ops.scale(self.bm, vec=(sx, sy, sz), verts=vs)
        bmesh.ops.translate(self.bm, vec=(cx, cy, cz), verts=vs)
        return self._tag(vs, mat, smooth)

    def lathe(self, profile, cx, cy, z0, mat, seg=32, smooth=True):
        bm = self.bm
        rings = []
        for (r, z) in profile:
            rings.append([bm.verts.new((cx + r * math.cos(2 * math.pi * i / seg), cy + r * math.sin(2 * math.pi * i / seg), z0 + z)) for i in range(seg)])
        faces = []
        for k in range(len(rings) - 1):
            for i in range(seg):
                a, b = rings[k][i], rings[k][(i + 1) % seg]
                c, d = rings[k + 1][(i + 1) % seg], rings[k + 1][i]
                try:
                    faces.append(bm.faces.new((a, b, c, d)))
                except ValueError:
                    pass
        try:
            faces.append(bm.faces.new(rings[0][::-1]))
            faces.append(bm.faces.new(rings[-1]))
        except ValueError:
            pass
        idx = self.mi(mat)
        for f in faces:
            f.material_index = idx
            f.smooth = smooth
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        return faces

    def fluted_column(self, cx, cy, z0, h, r_base=0.42, r_top=0.34, flutes=20, mat='M_Marble'):
        """Doric column after the kit: fluted tapered shaft + echinus + abacus."""
        bm = self.bm
        shaft_h = h - 0.55
        seg = flutes * 2
        rings = []
        for (z, r) in [(0.0, r_base), (shaft_h, r_top)]:
            ring = []
            for i in range(seg):
                a = 2 * math.pi * i / seg
                rr = r * (1.0 if i % 2 == 0 else 0.92)
                ring.append(bm.verts.new((cx + rr * math.cos(a), cy + rr * math.sin(a), z0 + z)))
            rings.append(ring)
        faces = []
        for i in range(seg):
            a, b = rings[0][i], rings[0][(i + 1) % seg]
            c, d = rings[1][(i + 1) % seg], rings[1][i]
            faces.append(bm.faces.new((a, b, c, d)))
        faces.append(bm.faces.new(rings[0][::-1]))
        faces.append(bm.faces.new(rings[1]))
        idx = self.mi(mat)
        for f in faces:
            f.material_index = idx
            f.smooth = True
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        self.cyl(cx, cy, z0 + shaft_h, r_top, r_top * 1.55, 0.3, mat, seg=32)
        self.box_b(cx, cy, z0 + shaft_h + 0.3, r_top * 3.3, r_top * 3.3, 0.25, mat)

    def pyramid(self, cx, cy, z0, half, h, mat):
        bm = self.bm
        base = [bm.verts.new((cx + sx * half, cy + sy * half, z0)) for (sx, sy) in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
        apex = bm.verts.new((cx, cy, z0 + h))
        faces = [bm.faces.new(base[::-1])]
        for i in range(4):
            faces.append(bm.faces.new((base[i], base[(i + 1) % 4], apex)))
        idx = self.mi(mat)
        for f in faces:
            f.material_index = idx
        bmesh.ops.recalc_face_normals(bm, faces=faces)

    # -- three.js-frame helpers ---------------------------------------------
    def box3(self, x0, x1, y0, y1, z0, z1, mat):
        """Axis-aligned box given as three.js extents."""
        cx, cy, cz = B((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
        self.box(cx, cy, cz, x1 - x0, z1 - z0, y1 - y0, mat)

    def cyl3(self, x, z, y0, r1, r2, h, mat, seg=24):
        bx, by, _ = B(x, 0, z)
        self.cyl(bx, by, y0, r1, r2, h, mat, seg=seg)

    def finish(self, smooth_angle=35.0):
        me = bpy.data.meshes.new(self.name)
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-5)
        self.bm.to_mesh(me)
        self.bm.free()
        for s in self.slots:
            me.materials.append(MATS[s])
        ob = bpy.data.objects.new(self.name, me)
        collection(self.col).objects.link(ob)
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        try:
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
        except Exception:
            try:
                bpy.ops.object.shade_smooth()
            except Exception:
                pass
        print(f"built {self.name}: {len(me.polygons)} faces, slots={self.slots}")
        return ob

PIECES = []
def piece(group):
    def deco(fn):
        PIECES.append((group, fn))
        return fn
    return deco

# ----------------------------------------------------------------------------- house geometry (mirror of layout.js)
def house_box(h):
    sx, sy, sz = h['size']
    return dict(x0=h['c'][0] - sx / 2, x1=h['c'][0] + sx / 2, z0=h['c'][1] - sz / 2, z1=h['c'][1] + sz / 2, y1=sy)

def door_span(h, d):
    b = house_box(h)
    cx, cz = h['c']
    if d['side'] == '+x': return dict(x=b['x1'], z=cz + d['at'], axis='z')
    if d['side'] == '-x': return dict(x=b['x0'], z=cz + d['at'], axis='z')
    if d['side'] == '+z': return dict(x=cx + d['at'], z=b['z1'], axis='x')
    return dict(x=cx + d['at'], z=b['z0'], axis='x')

def house_walls(h):
    """Wall boxes split around doorways, with lintels — same rule as layout.js."""
    b = house_box(h)
    t = WALL_T
    doors = [h['door']] + ([h['exit']] if 'exit' in h else [])
    out = []
    def face(side, x0, x1, z0, z1):
        d = next((dd for dd in doors if dd['side'] == side), None)
        if not d:
            out.append(dict(x0=x0, x1=x1, z0=z0, z1=z1, y0=0, y1=b['y1'])); return
        span = door_span(h, d)
        g0 = (span['z'] if span['axis'] == 'z' else span['x']) - d['w'] / 2
        g1 = g0 + d['w']
        if span['axis'] == 'z':
            out.append(dict(x0=x0, x1=x1, z0=z0, z1=g0, y0=0, y1=b['y1']))
            out.append(dict(x0=x0, x1=x1, z0=g1, z1=z1, y0=0, y1=b['y1']))
            out.append(dict(x0=x0, x1=x1, z0=g0, z1=g1, y0=d['h'], y1=b['y1']))
        else:
            out.append(dict(x0=x0, x1=g0, z0=z0, z1=z1, y0=0, y1=b['y1']))
            out.append(dict(x0=g1, x1=x1, z0=z0, z1=z1, y0=0, y1=b['y1']))
            out.append(dict(x0=g0, x1=g1, z0=z0, z1=z1, y0=d['h'], y1=b['y1']))
    face('-x', b['x0'], b['x0'] + t, b['z0'], b['z1'])
    face('+x', b['x1'] - t, b['x1'], b['z0'], b['z1'])
    face('-z', b['x0'] + t, b['x1'] - t, b['z0'], b['z0'] + t)
    face('+z', b['x0'] + t, b['x1'] - t, b['z1'] - t, b['z1'])
    return out

def house_windows(h):
    """Two windows per face without a door, at 62 % of the wall height. layout.js
    repeats this rule to place the glowing panes; keep them identical."""
    b = house_box(h)
    sx, sy, sz = h['size']
    door_sides = {h['door']['side']} | ({h['exit']['side']} if 'exit' in h else set())
    wins = []
    y = sy * 0.62
    for side in ['-x', '+x', '-z', '+z']:
        if side in door_sides:
            continue
        if side in ('-x', '+x'):
            x = b['x0'] if side == '-x' else b['x1']
            for z in (h['c'][1] - sz * 0.28, h['c'][1] + sz * 0.28):
                wins.append(dict(x=x, z=z, y=y, side=side))
        else:
            z = b['z0'] if side == '-z' else b['z1']
            for x in (h['c'][0] - sx * 0.28, h['c'][0] + sx * 0.28):
                wins.append(dict(x=x, z=z, y=y, side=side))
    return wins

def house_shell(name, h):
    b = Builder(name)
    hb = house_box(h)
    wall = h['wall']
    for w in house_walls(h):
        b.box3(w['x0'], w['x1'], w['y0'], w['y1'], w['z0'], w['z1'], wall)
    # floor slab and flat roof with a parapet lip (Naxos style)
    b.box3(hb['x0'], hb['x1'], -0.05, 0.05, hb['z0'], hb['z1'], 'M_Paving')
    b.box3(hb['x0'], hb['x1'], hb['y1'], hb['y1'] + 0.25, hb['z0'], hb['z1'], wall)
    lip, lh = 0.3, 0.55
    b.box3(hb['x0'], hb['x1'], hb['y1'] + 0.25, hb['y1'] + 0.25 + lh, hb['z0'], hb['z0'] + lip, wall)
    b.box3(hb['x0'], hb['x1'], hb['y1'] + 0.25, hb['y1'] + 0.25 + lh, hb['z1'] - lip, hb['z1'], wall)
    b.box3(hb['x0'], hb['x0'] + lip, hb['y1'] + 0.25, hb['y1'] + 0.25 + lh, hb['z0'], hb['z1'], wall)
    b.box3(hb['x1'] - lip, hb['x1'], hb['y1'] + 0.25, hb['y1'] + 0.25 + lh, hb['z0'], hb['z1'], wall)
    # roof lantern: four posts and a terracotta pyramid, open so the light shows
    cx, cz = h['c']
    ry = hb['y1'] + 0.25
    for dx in (-0.5, 0.5):
        for dz in (-0.5, 0.5):
            b.box3(cx + dx - 0.07, cx + dx + 0.07, ry, ry + 1.0, cz + dz - 0.07, cz + dz + 0.07, 'M_Timber')
    bx, by, _ = B(cx, 0, cz)
    b.box(bx, by, ry + 1.0 + 0.06, 1.4, 1.4, 0.12, 'M_Timber')
    b.pyramid(bx, by, ry + 1.12, 0.8, 0.6, 'M_Terracotta')
    # door frames: timber jambs + lintel
    for d in [h['door']] + ([h['exit']] if 'exit' in h else []):
        sp = door_span(h, d)
        jt = 0.12
        if sp['axis'] == 'z':
            x0, x1 = sp['x'] - 0.32, sp['x'] + 0.32
            for zz in (sp['z'] - d['w'] / 2 - jt, sp['z'] + d['w'] / 2):
                b.box3(x0, x1, 0, d['h'] + jt, zz, zz + jt, 'M_Timber')
            b.box3(x0, x1, d['h'], d['h'] + jt, sp['z'] - d['w'] / 2 - jt, sp['z'] + d['w'] / 2 + jt, 'M_Timber')
        else:
            z0, z1 = sp['z'] - 0.32, sp['z'] + 0.32
            for xx in (sp['x'] - d['w'] / 2 - jt, sp['x'] + d['w'] / 2):
                b.box3(xx, xx + jt, 0, d['h'] + jt, z0, z1, 'M_Timber')
            b.box3(sp['x'] - d['w'] / 2 - jt, sp['x'] + d['w'] / 2 + jt, d['h'], d['h'] + jt, z0, z1, 'M_Timber')
    # windows: dark timber recesses (the game lays a glowing pane over each)
    for w in house_windows(h):
        ww, wh, dp = 0.7, 0.9, 0.06
        if w['side'] in ('-x', '+x'):
            x0 = w['x'] - dp if w['side'] == '-x' else w['x'] - dp
            b.box3(x0, x0 + 2 * dp, w['y'] - wh / 2, w['y'] + wh / 2, w['z'] - ww / 2, w['z'] + ww / 2, 'M_Timber')
        else:
            z0 = w['z'] - dp
            b.box3(w['x'] - ww / 2, w['x'] + ww / 2, w['y'] - wh / 2, w['y'] + wh / 2, z0, z0 + 2 * dp, 'M_Timber')
    return b.finish()

@piece('village')
def houses():
    house_shell('SM_House_Window', HOUSES['window'])
    house_shell('SM_House_Eyes', HOUSES['eyes'])
    house_shell('SM_House_Door', HOUSES['door'])

# ----------------------------------------------------------------------------- plaza, stairs, colonnade, sea wall, lamps, bust
@piece('village')
def plaza():
    b = Builder('SM_Plaza')
    b.cyl(0, 0, -0.02, PLAZA_R, PLAZA_R, PLAZA_LIP + 0.02, 'M_Paving_Radial', seg=64, smooth=False)
    # outer step ring
    b.cyl(0, 0, -0.02, PLAZA_R + 0.7, PLAZA_R + 0.7, 0.06, 'M_Paving', seg=64, smooth=False)
    # a low well-head at the centre
    b.cyl(0, 0, PLAZA_LIP, 0.9, 0.85, 0.5, 'M_Marble', seg=24)
    b.cyl(0, 0, PLAZA_LIP + 0.5, 0.95, 0.95, 0.08, 'M_Marble', seg=24)
    b.finish(smooth_angle=20)

@piece('village')
def terrace_stair():
    b = Builder('SM_Stair_Terrace')
    steps = 12
    run = (STAIR['z0'] - STAIR['z1']) / steps
    rise = TERRACE_Y / steps
    for i in range(steps):
        z_hi = STAIR['z0'] - i * run           # nearer the plaza (larger z)
        z_lo = z_hi - run
        y1 = rise * (i + 1)
        b.box3(STAIR['x0'], STAIR['x1'], 0, y1, z_lo, z_hi, 'M_Sandstone')
    # cheeks
    for x in (STAIR['x0'] - 0.45, STAIR['x1']):
        b.box3(x, x + 0.45, 0, TERRACE_Y + 0.4, STAIR['z1'] - 0.2, STAIR['z0'], 'M_Sandstone')
    b.finish(smooth_angle=10)

@piece('village')
def colonnade():
    b = Builder('SM_Colonnade')
    z = COLONNADE['z']
    for x in COLONNADE['xs']:
        bx, by, _ = B(x, 0, z)
        b.box(bx, by, TERRACE_Y + 0.1, 1.2, 1.2, 0.2, 'M_Marble')
        b.fluted_column(bx, by, TERRACE_Y + 0.2, COLONNADE['h'] - 0.2, r_base=COLONNADE['r'], r_top=COLONNADE['r'] * 0.82)
    span = COLONNADE['xs'][-1] - COLONNADE['xs'][0] + 2.2
    b.box3(COLONNADE['xs'][0] - 1.1, COLONNADE['xs'][-1] + 1.1, TERRACE_Y + COLONNADE['h'], TERRACE_Y + COLONNADE['h'] + 0.55, z - 0.7, z + 0.7, 'M_Marble')
    b.box3(COLONNADE['xs'][0] - 1.3, COLONNADE['xs'][-1] + 1.3, TERRACE_Y + COLONNADE['h'] + 0.55, TERRACE_Y + COLONNADE['h'] + 0.75, z - 0.9, z + 0.9, 'M_Marble')
    # a long stylobate step in front, facing the village
    b.box3(COLONNADE['xs'][0] - 1.6, COLONNADE['xs'][-1] + 1.6, TERRACE_Y, TERRACE_Y + 0.22, z + 0.9, z + 2.4, 'M_Marble')
    del span
    b.finish()

@piece('village')
def sea_wall():
    b = Builder('SM_SeaWall')
    x0, x1 = BOUNDS['x0'] - 6, BOUNDS['x1'] + 6
    # the quay face drops to the water, the parapet keeps you off it
    b.box3(x0, x1, SEA_Y - 0.5, 0.05, SEA_Z, SEA_Z + 1.2, 'M_Rock')
    b.box3(x0, x1, 0, SEA_PARAPET, SEA_Z, SEA_Z + 0.6, 'M_Sandstone')
    b.box3(x0, x1, SEA_PARAPET, SEA_PARAPET + 0.12, SEA_Z - 0.1, SEA_Z + 0.7, 'M_Marble')
    # bollards
    for x in range(-24, 25, 8):
        b.cyl3(x, SEA_Z + 0.9, 0, 0.16, 0.13, 0.7, 'M_Iron', seg=10)
    b.finish(smooth_angle=20)

@piece('village')
def lamps():
    b = Builder('SM_Lamps')
    for (x, z, h) in LAMPS:
        b.cyl3(x, z, 0, 0.2, 0.2, 0.25, 'M_Sandstone', seg=8)
        b.cyl3(x, z, 0.25, 0.07, 0.05, h - 0.25, 'M_Iron', seg=8)
        bx, by, _ = B(x, 0, z)
        # cage
        for dx in (-0.16, 0.16):
            for dy in (-0.16, 0.16):
                b.box(bx + dx, by + dy, h + 0.25, 0.03, 0.03, 0.5, 'M_Iron')
        b.box(bx, by, h + 0.53, 0.44, 0.44, 0.05, 'M_Iron')
        b.pyramid(bx, by, h + 0.55, 0.24, 0.16, 'M_Iron')
    b.finish(smooth_angle=20)

@piece('village')
def bust():
    b = Builder('SM_Bust')
    bx, by, _ = B(BUST['x'], 0, BUST['z'])
    b.box(bx, by, 0.55, 0.9, 0.9, 1.1, 'M_Marble')
    b.box(bx, by, 1.14, 1.0, 1.0, 0.08, 'M_Marble')
    # shoulders, neck, head, a hint of a beard — weathered, so low poly on purpose
    b.lathe([(0.34, 0), (0.36, 0.18), (0.14, 0.3), (0.13, 0.42), (0.19, 0.5), (0.22, 0.66), (0.19, 0.8), (0.08, 0.9), (0.0, 0.92)], bx, by, 1.18, 'M_Marble', seg=16)
    b.sphere(bx, by - 0.16, 1.62, 0.1, 'M_Marble', sx=1.2, sz=1.4, sub=1)
    b.finish(smooth_angle=50)

# ----------------------------------------------------------------------------- terrain
def noise(x, y):
    return (math.sin(x * 0.11 + 1.3) * math.cos(y * 0.09 - 0.7) + math.sin(x * 0.05 - y * 0.07) * 0.6) * 0.5

def ground_y(x, z, top=None):
    """Mirror of layout.groundY plus gentle relief outside the town. `top`
    disambiguates the two rows that share a cliff line."""
    if z < TERRACE_Z or (z == TERRACE_Z and top):
        h = TERRACE_Y
        if z < HILL_Z:
            h += (HILL_Z - z) * HILL_SLOPE
        if abs(x) > 24:
            h += noise(x, z) * 1.2 + (abs(x) - 24) * 0.08
        return h
    if z > SEA_Z or (z == SEA_Z and top is False):
        return SEA_Y - (z - SEA_Z) * 0.08
    h = 0.0
    if x < -28: h += (-28 - x) * 0.12
    if x > 32: h += (x - 32) * 0.12
    if abs(x) > 34:
        h += noise(x, z) * 0.9
    return h

def in_town(x, z):
    return -28.5 <= x <= 32.5 and TERRACE_Z < z <= SEA_Z

@piece('village')
def terrain():
    b = Builder('SM_Terrain')
    bm = b.bm
    step = 2.5
    xs = [x for x in frange(-75, 75 + 0.01, step)]
    # rows along z (three.js) with the two cliff lines doubled for vertical faces
    zs = []
    for z in frange(-80, 45 + 0.01, step):
        zs.append((z, None))
    zs += [(TERRACE_Z, False), (TERRACE_Z, True), (SEA_Z, True), (SEA_Z, False)]
    zs = sorted(set(zs), key=lambda p: (p[0], 0 if p[1] in (None, True) and p[0] == TERRACE_Z and p[1] is True else 1))
    # explicit ordering: for the terrace line, upper (True) row belongs to the north (smaller z) side
    def order_key(p):
        z, top = p
        if z == TERRACE_Z:
            return (z, 0 if top is True else 1)   # True first (north side of the line comes first in ascending z? no — see below)
        if z == SEA_Z:
            return (z, 0 if top is True else 1)
        return (z, 0)
    # Rows ascend in z (north → south). At the terrace line the row that reads
    # as terrace-top (True) must come BEFORE the plaza-level row (False).
    # At the sea line the quay-top row (True) comes before the drop (False).
    zs = sorted(set(zs), key=order_key)
    grid = []
    for (z, top) in zs:
        row = []
        for x in xs:
            hz = ground_y(x, z, top)
            bx, by, bz = B(x, hz, z)
            row.append(bm.verts.new((bx, by, bz)))
        grid.append(row)
    i_grass, i_rock, i_town, i_sea = b.mi('M_Grass'), b.mi('M_Rock'), b.mi('M_Sandstone'), b.mi('M_Rock')
    for j in range(len(zs) - 1):
        for i in range(len(xs) - 1):
            v = (grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i])
            if len({id(q) for q in v}) < 4:
                continue
            try:
                f = bm.faces.new(v)
            except ValueError:
                continue
            zsv = [q.co.z for q in v]
            steep = (max(zsv) - min(zsv)) > 1.2
            xm = (xs[i] + xs[i + 1]) / 2
            zm = (zs[j][0] + zs[j + 1][0]) / 2
            if steep:
                f.material_index = i_rock
            elif zm > SEA_Z:
                f.material_index = i_sea
            elif in_town(xm, zm):
                f.material_index = i_town
            else:
                f.material_index = i_grass
            f.smooth = not steep and not in_town(xm, zm)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    # make sure the terrain faces up
    bm.normal_update()
    if sum(f.normal.z for f in bm.faces) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    b.finish(smooth_angle=40)

def frange(a, b, s):
    v = a
    while v <= b:
        yield round(v, 6)
        v += s

# ----------------------------------------------------------------------------- props (instanced by the game)
@piece('props')
def cypress():
    b = Builder('SM_Cypress', col='props')
    b.cyl(0, 0, 0, 0.14, 0.10, 1.2, 'M_Bark', seg=8)
    b.sphere(0, 0, 3.6, 1.0, 'M_Cypress', sx=0.75, sy=0.75, sz=2.9, sub=2)
    b.cyl(0, 0, 5.9, 0.55, 0.02, 2.2, 'M_Cypress', seg=12)
    b.finish()

@piece('props')
def olive():
    b = Builder('SM_Olive', col='props')
    b.lathe([(0.34, 0), (0.28, 0.8), (0.22, 1.7), (0.16, 2.2)], 0, 0, 0, 'M_Bark', seg=10)
    for (dx, dy, dz, r) in [(0, 0, 3.0, 1.7), (1.0, 0.6, 2.7, 1.3), (-0.9, 0.5, 2.8, 1.25), (0.1, -1.0, 2.6, 1.2), (0.3, 0.2, 3.7, 1.1)]:
        b.sphere(dx, dy, dz, r, 'M_Olive', sz=0.7, sub=2)
    b.finish()

@piece('props')
def scroll():
    """A rolled parchment on a pale spindle with a vermilion band — the pickup.
    Lies along local X, origin at its centre, 0.5 m long."""
    b = Builder('SM_Scroll', col='props')
    bm = b.bm
    # parchment roll along X: build along Z then rotate
    faces = b.cyl(0, 0, -0.24, 0.085, 0.085, 0.48, 'M_Parchment', seg=18)
    faces |= b.cyl(0, 0, -0.29, 0.03, 0.03, 0.58, 'M_Marble', seg=10)
    faces |= b.sphere(0, 0, -0.3, 0.045, 'M_Marble', sub=1)
    faces |= b.sphere(0, 0, 0.3, 0.045, 'M_Marble', sub=1)
    faces |= b.cyl(0, 0, -0.04, 0.095, 0.095, 0.08, 'M_Vermilion', seg=18)
    verts = list({v for f in faces for v in f.verts})
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, 'Y'), verts=verts)
    b.finish()

# ----------------------------------------------------------------------------- the philosopher
def philosopher():
    """Import refs/character.glb, join its 63 meshes per (animated node, material,
    scroll-or-body) so the game draws ~15 meshes instead of 63, keep the empties
    rig → lift → bodyG/legL/legR intact, export as philosopher.glb."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=CHAR_SRC)
    imported = [o for o in bpy.data.objects if o not in before]
    col = collection('philosopher')
    for o in imported:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        col.objects.link(o)
    meshes = [o for o in imported if o.type == 'MESH']
    groups = {}
    for o in meshes:
        parent = o.parent.name if o.parent else 'root'
        mat = o.data.materials[0].name if o.data.materials else 'none'
        part = 'scroll' if 'Scroll' in o.name else 'body'
        groups.setdefault((parent, mat, part), []).append(o)
    joined = []
    for (parent, mat, part), obs in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = obs[0]
        if len(obs) > 1:
            bpy.ops.object.join()
        ob = bpy.context.view_layer.objects.active
        short = mat.split('|')[1].strip().lower().replace(' ', '_') if '|' in mat else mat.lower()
        ob.name = f"{parent}_{part}_{short}"
        ob.data.name = ob.name
        joined.append(ob)
    print('philosopher meshes:', [o.name for o in joined])
    return imported

# ----------------------------------------------------------------------------- build + export
def export_group(col_name, filename):
    col = COLLECTIONS.get(col_name)
    if not col:
        return
    bpy.ops.object.select_all(action='DESELECT')
    objs = list(col.all_objects)
    for o in objs:
        o.select_set(True)
    if objs:
        bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(OUT, filename)
    kwargs = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                  export_materials='EXPORT', export_normals=True, export_texcoords=False, export_animations=False,
                  export_cameras=False, export_lights=False, export_extras=False, export_draco_mesh_compression_enable=False)
    try:
        bpy.ops.export_scene.gltf(**kwargs)
    except TypeError as e:
        print('export option mismatch, retrying minimal:', e)
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True)
    print('EXPORTED', path, os.path.getsize(path), 'bytes')

want = lambda g: ONLY is None or g in ONLY
for group, fn in PIECES:
    if want(group):
        fn()
if want('philosopher'):
    philosopher()

if ONLY is None:
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    print('saved', BLEND)

if want('village'):
    export_group('village', 'village.glb')
if want('props'):
    export_group('props', 'props.glb')
if want('philosopher'):
    export_group('philosopher', 'philosopher.glb')
print('DONE')
