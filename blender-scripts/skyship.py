# 云阙天舟 — 系泊在巨构旁的空中飞船（主平台）
# 甲板面 y=0；可行走区约 x[-11.5, 9.5] z[-8.5, 8.5]；船艏 -X，船艉 +X 接栈桥
import bpy, math, os
from mathutils import Vector

PROJ = '/Users/jada/Desktop/Projects/yunque'
bpy.ops.wm.read_factory_settings(use_empty=True)

def M(name, hexcol, emissive=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    r, g, bl = (int(hexcol[i:i+2], 16) / 255 for i in (0, 2, 4))
    b.inputs['Base Color'].default_value = (r**2.2, g**2.2, bl**2.2, 1)
    b.inputs['Roughness'].default_value = 0.9
    if emissive > 0:
        b.inputs['Emission Color'].default_value = (r**2.2, g**2.2, bl**2.2, 1)
        b.inputs['Emission Strength'].default_value = emissive
    return m

WOOD  = M('wood', '7a5a40')
DARKW = M('darkw', '4a3a2c')
HULL  = M('hull', '3d3830')
RUST  = M('rust', 'b25a2e')
BRASS = M('brass', 'c8a05a', 3)
GLOW  = M('glow', 'ff8c4d', 6)
WIN   = M('win', 'ffb066', 4)

def add(op, mat, **kw):
    op(**kw)
    o = bpy.context.active_object
    o.data.materials.append(mat)
    return o

def box(mat, cx, cy, cz, sx, sy, sz, rz=0):
    o = add(bpy.ops.mesh.primitive_cube_add, mat, size=1, location=(cx, cy, cz))
    o.scale = (sx, sy, sz)
    if rz: o.rotation_euler = (0, 0, rz)
    return o

# 注意坐标系: Blender Z=上(游戏Y), Blender X=游戏X, Blender Y=游戏-Z(前后)
# 船沿 X 轴: 艏 -X, 艉 +X; 甲板顶面 z=0

import bmesh
def tri_plate(mat, p1, p2, p3, thick, z_top):
    mesh = bpy.data.meshes.new('tri'); obj = bpy.data.objects.new('tri', mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    vv = [bm.verts.new((x, y, z_top)) for x, y in (p1, p2, p3)]
    bm.faces.new(vv)
    bm.to_mesh(mesh); bm.free()
    mesh.materials.append(mat)
    mod = obj.modifiers.new('s', 'SOLIDIFY'); mod.thickness = thick
    return obj

# 主甲板板 (x -12..10, y ±9, 顶面 z0)
box(WOOD, -1, 0, -0.3, 22, 18, 0.6)
# 艏部楔形甲板 (x-12,±9 收到 x-17.5,0)
tri_plate(WOOD, (-12, 9), (-12, -9), (-17.5, 0), 0.6, 0)
# 船腹 (下方鼓腹渐收)
box(HULL, -1, 0, -1.9, 20, 15.6, 2.6)
box(HULL, -1, 0, -3.6, 15, 10.5, 1.6)
keel = add(bpy.ops.mesh.primitive_cone_add, HULL, vertices=4, radius1=4.2, radius2=0.8, depth=13,
           location=(-2.5, 0, -5.2))
keel.rotation_euler = (0, math.radians(90), 0)
keel.scale = (1, 0.55, 0.35)
# 艏腹楔 (略内收, 更深)
tri_plate(HULL, (-11, 7.2), (-11, -7.2), (-16.2, 0), 2.8, -0.6)
# 舷墙 (高1.05 厚0.35; 艉部 y±2 留栈桥缺口)
for sy in (-1, 1):
    box(DARKW, -1, sy * 8.85, 0.5, 22, 0.35, 1.05)          # 两舷
    # 艏部收角舷墙: 沿 (-12,±9)→(-17.5,0) 精确放置
    _dx, _dy = -17.5 - (-12), 0 - sy * 9
    _len = math.hypot(_dx, _dy)
    b = box(DARKW, (-12 + -17.5) / 2, sy * 4.5, 0.5, _len, 0.35, 1.05)
    b.rotation_euler = (0, 0, math.atan2(_dy, _dx))
    box(DARKW, 9.85, sy * 5.55, 0.5, 0.35, 6.9, 1.05)       # 艉舷墙(留中缝)
# 舷墙顶沿
for sy in (-1, 1):
    box(RUST, -1, sy * 8.85, 1.1, 22.2, 0.42, 0.12)
# 铆接束带 (两道横箍)
for x in (-8, 4):
    box(RUST, x, 0, -1.8, 0.5, 16.2, 3.0)
# 艉推进器 ×3 (喷口发光)
for sy in (-5, 0, 5):
    t = add(bpy.ops.mesh.primitive_cylinder_add, HULL, vertices=10, radius=1.0, depth=2.6,
            location=(10.8, sy, -1.9))
    t.rotation_euler = (0, math.radians(90), 0)
    n = add(bpy.ops.mesh.primitive_cylinder_add, GLOW, vertices=10, radius=0.72, depth=0.25,
            location=(12.15, sy, -1.9))
    n.rotation_euler = (0, math.radians(90), 0)
# 侧翼稳定鳍
for sy in (-1, 1):
    f = box(HULL, 5.5, sy * 9.6, -2.4, 5.5, 2.6, 0.35)
    f.rotation_euler = (sy * math.radians(-18), 0, math.radians(12))
# 艉部驾驶舱小屋 (在舷墙外侧艉角, 不占行走区)
box(DARKW, 8.6, 6.6, 1.05, 2.6, 3.4, 2.1)
box(HULL, 8.6, 6.6, 2.25, 2.9, 3.7, 0.3)
w = box(WIN, 7.25, 6.6, 1.25, 0.1, 1.6, 0.7)
# 艏桅 + 铜灯
mast = add(bpy.ops.mesh.primitive_cylinder_add, DARKW, vertices=8, radius=0.12, depth=3.4,
           location=(-16.6, 0, 1.4))
add(bpy.ops.mesh.primitive_uv_sphere_add, BRASS, segments=8, ring_count=6, radius=0.32,
    location=(-16.6, 0, 3.3))
# 甲板板材：两色窄板交替 + 细缝（写实近景）
import random
random.seed(11)
WOOD2 = M('wood2', '6f5138')
_y = -8.6
while _y < 8.6:
    w = 0.52 + random.random() * 0.14
    col = WOOD if random.random() < 0.55 else WOOD2
    box(col, -1, _y + w / 2, 0.035, 21.8, w - 0.05, 0.07)
    _y += w
# 栏杆：立柱 + 圆扶手（两舷 + 艉段；艏收角段只挂扶手）
RAILM = M('railm', '8a6f45')
def handrail(p1, p2, r=0.055):
    from mathutils import Vector as _V
    a, b = _V(p1), _V(p2)
    d = b - a
    mid = (a + b) / 2
    o = add(bpy.ops.mesh.primitive_cylinder_add, RAILM, vertices=8, radius=r, depth=d.length, location=tuple(mid))
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.normalized().to_track_quat('Z', 'Y')
for sy in (-1, 1):
    x = -11.6
    while x <= 9.4:
        add(bpy.ops.mesh.primitive_cylinder_add, DARKW, vertices=6, radius=0.045, depth=0.62,
            location=(x, sy * 8.85, 1.36))
        x += 1.35
    handrail((-11.8, sy * 8.85, 1.72), (9.6, sy * 8.85, 1.72), 0.06)
    # 艏收角扶手
    handrail((-12, sy * 8.85, 1.72), (-17.3, 0.001 * sy, 1.72), 0.055)
    # 艉段
    _z = 0
    for yy in (sy * 2.6, sy * 4.4, sy * 6.2, sy * 7.9):
        add(bpy.ops.mesh.primitive_cylinder_add, DARKW, vertices=6, radius=0.045, depth=0.62,
            location=(9.85, yy, 1.36))
    handrail((9.85, sy * 2.1, 1.72), (9.85, sy * 8.85, 1.72), 0.055)
# 系缆桩 ×4（蘑菇头矮桩）
for bx, by in ((-10.5, 7.6), (-10.5, -7.6), (8.6, 7.6), (8.6, -7.6)):
    add(bpy.ops.mesh.primitive_cylinder_add, DARKW, vertices=8, radius=0.16, depth=0.44, location=(bx, by, 0.22))
    add(bpy.ops.mesh.primitive_cylinder_add, DARKW, vertices=8, radius=0.22, depth=0.1, location=(bx, by, 0.48))
# 缆绳圈（盘在甲板上）
for i, rr in enumerate((0.42, 0.3, 0.19)):
    add(bpy.ops.mesh.primitive_torus_add, RAILM, major_radius=rr, minor_radius=0.05,
        location=(-9.6, 5.9, 0.06 + i * 0.09))
# 舱口格栅
box(DARKW, 3.2, -4.6, 0.09, 2.4, 1.7, 0.12)
for gx in (2.4, 3.0, 3.6, 4.2):
    box(WOOD2, gx, -4.6, 0.17, 0.12, 1.5, 0.05)

n = 0
for o in bpy.data.objects:
    if o.type == 'MESH':
        o.data.calc_loop_triangles(); n += len(o.data.loop_triangles)
print('SHIP_TRIS=%d' % n)

bpy.ops.export_scene.gltf(filepath=os.path.join(PROJ, 'public/models/skyship.glb'),
                          export_format='GLB', export_apply=True)

# 渲染
cam_data = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cam_data)
bpy.context.collection.objects.link(cam)
cam.location = (-30, -26, 12)
tgt = bpy.data.objects.new('t', None); tgt.location = (-2, 0, -1)
bpy.context.collection.objects.link(tgt)
con = cam.constraints.new('TRACK_TO'); con.target = tgt
con.track_axis = 'TRACK_NEGATIVE_Z'; con.up_axis = 'UP_Y'
bpy.context.scene.camera = cam
sd = bpy.data.lights.new('s', 'SUN'); sd.energy = 3
sun = bpy.data.objects.new('s', sd); bpy.context.collection.objects.link(sun)
sun.rotation_euler = (math.radians(55), math.radians(-25), 0)
sc = bpy.context.scene
sc.render.resolution_x = sc.render.resolution_y = 640
sc.render.filepath = os.path.join(PROJ, 'renders/skyship.png')
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'
sc.display.shading.color_type = 'MATERIAL'
bpy.ops.render.render(write_still=True)
print('DONE')
