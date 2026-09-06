# 云阙旅人 + 三角翼 — Blender 5.x headless
# 产出: public/models/traveler.glb (人物+背包卷) / public/models/wing.glb (展开翼)
# 朝向: Blender -Y 为前 → glTF +Z 为前(与游戏 player.rotation.y 约定一致)
import bpy, math, os

PROJ = '/Users/jada/Desktop/Projects/yunque'

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def M(name, hexcol):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    r = int(hexcol[0:2], 16) / 255
    g = int(hexcol[2:4], 16) / 255
    b = int(hexcol[4:6], 16) / 255
    bsdf.inputs['Base Color'].default_value = (r**2.2, g**2.2, b**2.2, 1)
    bsdf.inputs['Roughness'].default_value = 0.9
    return m

BONE   = 'ded5c2'  # 骨白短袍
RUST   = 'b25a2e'  # 铁锈橙
DARK   = '3a3430'  # 深裤靴/帽
BRASS  = 'c8a05a'  # 铜扣/护目镜圈
SKIN   = 'd9c4a8'

def add(obj_op, mat, **kw):
    obj_op(**kw)
    o = bpy.context.active_object
    o.data.materials.append(mat)
    return o

def tris_total():
    n = 0
    for o in bpy.data.objects:
        if o.type == 'MESH':
            o.data.calc_loop_triangles()
            n += len(o.data.loop_triangles)
    return n

def export(path):
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True)

def render(path, dist=3.2, h=1.4, look=(0, 0, 0.7)):
    cam_data = bpy.data.cameras.new('c')
    cam = bpy.data.objects.new('c', cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (dist * 0.75, -dist, h)
    tgt = bpy.data.objects.new('tgt', None)
    tgt.location = look
    bpy.context.collection.objects.link(tgt)
    con = cam.constraints.new('TRACK_TO')
    con.target = tgt
    con.track_axis = 'TRACK_NEGATIVE_Z'
    con.up_axis = 'UP_Y'
    bpy.context.scene.camera = cam
    sun_d = bpy.data.lights.new('s', 'SUN')
    sun_d.energy = 3
    sun = bpy.data.objects.new('s', sun_d)
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(50), math.radians(-20), 0)
    sc = bpy.context.scene
    sc.render.resolution_x = sc.render.resolution_y = 640
    sc.render.filepath = path
    try:
        sc.render.engine = 'BLENDER_EEVEE_NEXT'
    except Exception:
        sc.render.engine = 'BLENDER_WORKBENCH'
        sc.display.shading.light = 'STUDIO'
        sc.display.shading.color_type = 'MATERIAL'
    bpy.ops.render.render(write_still=True)
    if sc.render.engine == 'BLENDER_WORKBENCH':
        pass

# ============ 人物（小王子式可爱比例：大头、短身、围巾飘带、点眼睛） ============
reset()
m_bone, m_rust, m_dark, m_brass, m_skin = M('bone', BONE), M('rust', RUST), M('dark', DARK), M('brass', BRASS), M('skin', SKIN)
m_hair = M('hair', '6b4a33')
m_eye = M('eye', '2c2420')

# 腿×2 + 圆头小靴
for sx in (-0.10, 0.10):
    add(bpy.ops.mesh.primitive_cylinder_add, m_dark, vertices=8, radius=0.052, depth=0.3, location=(sx, 0, 0.24))
    b = add(bpy.ops.mesh.primitive_uv_sphere_add, m_dark, segments=8, ring_count=6, radius=0.085, location=(sx, -0.03, 0.09))
    b.scale = (1, 1.25, 0.75)
# 短身圆袍（下摆微张）
body = add(bpy.ops.mesh.primitive_cone_add, m_bone, vertices=12, radius1=0.28, radius2=0.19, depth=0.44, location=(0, 0, 0.60))
hem = add(bpy.ops.mesh.primitive_torus_add, m_bone, major_radius=0.265, minor_radius=0.032, location=(0, 0, 0.39))
# 腰带+铜扣
add(bpy.ops.mesh.primitive_cylinder_add, m_dark, vertices=12, radius=0.245, depth=0.06, location=(0, 0, 0.52))
add(bpy.ops.mesh.primitive_cube_add, m_brass, size=0.07, location=(0, -0.24, 0.52))
# 手臂×2（微张开）+ 圆手
for sx in (-1, 1):
    a = add(bpy.ops.mesh.primitive_cylinder_add, m_bone, vertices=8, radius=0.05, depth=0.3, location=(sx * 0.27, 0, 0.63))
    a.rotation_euler = (0, sx * math.radians(7), 0)
    add(bpy.ops.mesh.primitive_uv_sphere_add, m_skin, segments=8, ring_count=6, radius=0.062, location=(sx * 0.295, 0, 0.45))
# 围巾：颈圈 + 一条向后扬起的飘带（在风里）
sc = add(bpy.ops.mesh.primitive_torus_add, m_rust, major_radius=0.14, minor_radius=0.05, location=(0, 0, 0.84))
tail1 = add(bpy.ops.mesh.primitive_cube_add, m_rust, size=1, location=(0.06, 0.24, 0.90))
tail1.scale = (0.09, 0.24, 0.035)
tail1.rotation_euler = (math.radians(18), 0, math.radians(6))
tail2 = add(bpy.ops.mesh.primitive_cube_add, m_rust, size=1, location=(0.10, 0.46, 0.99))
tail2.scale = (0.075, 0.2, 0.03)
tail2.rotation_euler = (math.radians(35), 0, math.radians(10))
# 大头（占身高近半——可爱比例的关键）
head = add(bpy.ops.mesh.primitive_uv_sphere_add, m_skin, segments=14, ring_count=11, radius=0.34, location=(0, 0, 1.18))
# 头发：罩住后脑的半球 + 额前一撮呆毛
hair = add(bpy.ops.mesh.primitive_uv_sphere_add, m_hair, segments=12, ring_count=8, radius=0.375, location=(0, 0.03, 1.25))
hair.scale = (1, 1, 0.86)  # 完整罩住头顶,不再露头皮
fringe = add(bpy.ops.mesh.primitive_uv_sphere_add, m_hair, segments=10, ring_count=6, radius=0.16, location=(0, -0.27, 1.37))
fringe.scale = (1.9, 0.62, 0.62)
tuft = add(bpy.ops.mesh.primitive_cone_add, m_hair, vertices=6, radius1=0.05, radius2=0, depth=0.16, location=(0.02, 0.02, 1.58))
tuft.rotation_euler = (math.radians(-15), 0, math.radians(12))
# 点眼睛×2（有了眼睛才是"人"）
for sx in (-0.115, 0.115):
    add(bpy.ops.mesh.primitive_uv_sphere_add, m_eye, segments=7, ring_count=5, radius=0.032, location=(sx, -0.315, 1.16))
# 腮红两点（欢快感）
m_blush = M('blush', 'd88a6a')
for sx in (-0.21, 0.21):
    bl = add(bpy.ops.mesh.primitive_uv_sphere_add, m_blush, segments=6, ring_count=4, radius=0.035, location=(sx, -0.27, 1.08))
    bl.scale = (1, 0.5, 0.8)
# 背上的小翼包
pack = add(bpy.ops.mesh.primitive_cylinder_add, m_rust, vertices=10, radius=0.085, depth=0.5, location=(0, 0.30, 0.78))
pack.rotation_euler = (0, math.radians(90), math.radians(8))
for sxr in (-0.14, 0.16):
    ring = add(bpy.ops.mesh.primitive_torus_add, m_dark, major_radius=0.09, minor_radius=0.016, location=(sxr, 0.30, 0.78 + sxr * 0.14))
    ring.rotation_euler = (0, math.radians(90), math.radians(8))

print('CHAR_TRIS=%d' % tris_total())
export(os.path.join(PROJ, 'public/models/traveler.glb'))
render(os.path.join(PROJ, 'renders/traveler.png'), dist=2.4, h=1.1, look=(0, 0, 0.72))

# ============ 三角翼(展开态) ============
reset()
m_membrane = M('membrane', 'e8ddc4')
m_frame = M('frame', 'b25a2e')
m_dark2 = M('dark', '3a3430')

# 翼膜：三角后掠，微上反角(自定义网格)
import bmesh
mesh = bpy.data.meshes.new('wing')
obj = bpy.data.objects.new('wing', mesh)
bpy.context.collection.objects.link(obj)
bm = bmesh.new()
span, chord, sweep, dihedral = 1.9, 1.15, 0.75, 0.10
nose = bm.verts.new((0, -chord * 0.55, 0.02))
tail = bm.verts.new((0, chord * 0.60, 0))
tipL = bm.verts.new((-span, sweep, dihedral))
tipR = bm.verts.new((span, sweep, dihedral))
midL = bm.verts.new((-span * 0.5, sweep * 0.15, dihedral * 0.4))
midR = bm.verts.new((span * 0.5, sweep * 0.15, dihedral * 0.4))
bm.faces.new((nose, midL, tipL))
bm.faces.new((nose, tail, midL))
bm.faces.new((tail, tipL, midL))
bm.faces.new((nose, tipR, midR))
bm.faces.new((nose, midR, tail))
bm.faces.new((tail, midR, tipR))
bm.to_mesh(mesh)
bm.free()
mesh.materials.append(m_membrane)
# 双面渲染由引擎处理；加 Solidify 给厚度
solid = obj.modifiers.new('sol', 'SOLIDIFY')
solid.thickness = 0.03

# 骨架：中龙骨 + 两根前缘撑条
k = add(bpy.ops.mesh.primitive_cylinder_add, m_frame, vertices=8, radius=0.035, depth=chord * 1.25, location=(0, 0.05, -0.02))
k.rotation_euler = (math.radians(90), 0, 0)
from mathutils import Vector
nose_p = Vector((0, -chord * 0.55, 0.02))
for sgn in (-1, 1):
    tip_p = Vector((sgn * span, sweep, dihedral))
    d = tip_p - nose_p
    mid = (tip_p + nose_p) / 2
    le = add(bpy.ops.mesh.primitive_cylinder_add, m_frame, vertices=8, radius=0.03, depth=d.length, location=tuple(mid))
    le.rotation_mode = 'QUATERNION'
    le.rotation_quaternion = d.normalized().to_track_quat('Z', 'Y')
# 挂杆(人抓的横杆)
bar = add(bpy.ops.mesh.primitive_cylinder_add, m_dark2, vertices=8, radius=0.03, depth=0.7, location=(0, 0, -0.28))
bar.rotation_euler = (0, math.radians(90), 0)
for s in (-0.3, 0.3):
    strut = add(bpy.ops.mesh.primitive_cylinder_add, m_dark2, vertices=6, radius=0.022, depth=0.32, location=(s, 0, -0.14))

print('WING_TRIS=%d' % tris_total())
export(os.path.join(PROJ, 'public/models/wing.glb'))
render(os.path.join(PROJ, 'renders/wing.png'), dist=3.0, h=1.6, look=(0, 0.2, 0))
print('DONE')
