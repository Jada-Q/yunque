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

# ============ 人物 ============
reset()
m_bone, m_rust, m_dark, m_brass, m_skin = M('bone', BONE), M('rust', RUST), M('dark', DARK), M('brass', BRASS), M('skin', SKIN)

# 躯干：短袍(上宽下摆微张)
add(bpy.ops.mesh.primitive_cone_add, m_bone, vertices=10, radius1=0.34, radius2=0.26, depth=0.62, location=(0, 0, 0.72))
# 下摆
add(bpy.ops.mesh.primitive_cone_add, m_bone, vertices=10, radius1=0.38, radius2=0.34, depth=0.18, location=(0, 0, 0.32))
# 束带
add(bpy.ops.mesh.primitive_cylinder_add, m_rust, vertices=10, radius=0.30, depth=0.10, location=(0, 0, 0.62))
# 铜扣
add(bpy.ops.mesh.primitive_cube_add, m_brass, size=0.09, location=(0, -0.30, 0.62))
# 腿
for sx in (-0.12, 0.12):
    add(bpy.ops.mesh.primitive_cylinder_add, m_dark, vertices=8, radius=0.075, depth=0.26, location=(sx, 0, 0.13))
    add(bpy.ops.mesh.primitive_cube_add, m_dark, size=0.16, location=(sx, -0.04, 0.045))
# 手臂(贴身短袖筒)
for sx in (-0.36, 0.36):
    a = add(bpy.ops.mesh.primitive_cylinder_add, m_bone, vertices=8, radius=0.075, depth=0.42, location=(sx, 0, 0.82))
    a.rotation_euler = (0, math.radians(14 if sx > 0 else -14), 0)
    add(bpy.ops.mesh.primitive_uv_sphere_add, m_skin, segments=8, ring_count=6, radius=0.07, location=(sx * 1.1, 0, 0.58))
# 头
add(bpy.ops.mesh.primitive_uv_sphere_add, m_skin, segments=10, ring_count=8, radius=0.24, location=(0, 0, 1.22))
# 飞行帽(盖到耳)
add(bpy.ops.mesh.primitive_uv_sphere_add, m_dark, segments=10, ring_count=6, radius=0.255, location=(0, 0, 1.26))
bpy.context.active_object.scale = (1, 1, 0.82)
# 护目镜：镜带 + 双镜片
band = add(bpy.ops.mesh.primitive_cylinder_add, m_rust, vertices=12, radius=0.252, depth=0.07, location=(0, 0, 1.28))
band.scale = (1, 1, 1)
for sx in (-0.10, 0.10):
    g = add(bpy.ops.mesh.primitive_cylinder_add, m_brass, vertices=10, radius=0.07, depth=0.05, location=(sx, -0.235, 1.28))
    g.rotation_euler = (math.radians(90), 0, 0)
# 背包卷(折叠翼)：斜背的圆筒 + 两道绑带
pack = add(bpy.ops.mesh.primitive_cylinder_add, m_rust, vertices=10, radius=0.10, depth=0.72, location=(0, 0.33, 0.88))
pack.rotation_euler = (0, math.radians(90), math.radians(10))
for sx in (-0.2, 0.22):
    ring = add(bpy.ops.mesh.primitive_torus_add, m_dark, major_radius=0.107, minor_radius=0.018, location=(sx, 0.33, 0.88 + sx * math.tan(math.radians(10))))
    ring.rotation_euler = (0, math.radians(90), math.radians(10))

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
