# 云阙生灵：leviathan 云鲸(60m级) + roc 巨鸟(翼展12m, 翅膀独立命名供代码拍动)
# 云鲸: 前 -X; 巨鸟: 前 -Y(blender) → glTF +Z
import bpy, math, os
from mathutils import Vector

PROJ = '/Users/jada/Desktop/Projects/yunque'

def reset():
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

def add(op, mat, **kw):
    op(**kw)
    o = bpy.context.active_object
    o.data.materials.append(mat)
    return o

def finish(name, cam, look):
    bpy.ops.export_scene.gltf(filepath=os.path.join(PROJ, 'public/models/%s.glb' % name),
                              export_format='GLB', export_apply=False)  # 保留节点层级(翅膀要独立)
    cd = bpy.data.cameras.new('c'); co = bpy.data.objects.new('c', cd)
    bpy.context.collection.objects.link(co); co.location = cam
    tgt = bpy.data.objects.new('t', None); tgt.location = look
    bpy.context.collection.objects.link(tgt)
    con = co.constraints.new('TRACK_TO'); con.target = tgt
    con.track_axis = 'TRACK_NEGATIVE_Z'; con.up_axis = 'UP_Y'
    bpy.context.scene.camera = co
    sd = bpy.data.lights.new('s', 'SUN'); sd.energy = 3
    so = bpy.data.objects.new('s', sd); bpy.context.collection.objects.link(so)
    so.rotation_euler = (math.radians(55), math.radians(-25), 0)
    sc = bpy.context.scene
    sc.render.resolution_x = sc.render.resolution_y = 640
    sc.render.filepath = os.path.join(PROJ, 'renders/%s.png' % name)
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'MATERIAL'
    bpy.ops.render.render(write_still=True)
    n = 0
    for o in bpy.data.objects:
        if o.type == 'MESH':
            o.data.calc_loop_triangles(); n += len(o.data.loop_triangles)
    print('%s_TRIS=%d' % (name.upper(), n))

# ============ 云鲸 leviathan（沿 -X 前进；原点=体中心） ============
reset()
BACK = M('back', '2e3a4e')    # 深青背
BELLY = M('belly', '8fa0b4')  # 浅腹
FIN = M('fin', '253043')
LUME = M('lume', '7fd8e8', 5) # 生物光点

# 体节：一串压扁球连成 60m 长躯
segs = [(-24, 3.2), (-16, 5.2), (-6, 6.4), (4, 6.2), (13, 5.0), (20, 3.4), (25, 2.0)]
for x, r in segs:
    b = add(bpy.ops.mesh.primitive_uv_sphere_add, BACK, segments=10, ring_count=8, radius=r, location=(x, 0, 0))
    b.scale = (1.7, 0.95, 0.8)
# 腹带（下侧浅色长条）
belly = add(bpy.ops.mesh.primitive_uv_sphere_add, BELLY, segments=10, ring_count=8, radius=5.6, location=(-3, 0, -1.8))
belly.scale = (4.6, 0.82, 0.55)
# 尾鳍（水平双叶）
for sy in (-1, 1):
    f = add(bpy.ops.mesh.primitive_cone_add, FIN, vertices=3, radius1=4.6, radius2=0, depth=0.5, location=(29.5, sy * 3.4, 0.4))
    f.rotation_euler = (0, 0, math.radians(90 + sy * 38))
    f.scale = (1, 1.8, 1)
# 胸鳍
for sy in (-1, 1):
    f = add(bpy.ops.mesh.primitive_cone_add, FIN, vertices=3, radius1=3.4, radius2=0, depth=0.4, location=(-10, sy * 5.6, -1.6))
    f.rotation_euler = (math.radians(sy * -22), 0, math.radians(90 + sy * 115))
    f.scale = (1, 1.6, 1)
# 背脊棘 4 枚
for i, x in enumerate((-14, -6, 2, 9)):
    s = add(bpy.ops.mesh.primitive_cone_add, FIN, vertices=4, radius1=1.5 - i * 0.15, radius2=0, depth=3.2 - i * 0.4, location=(x, 0, 4.6))
# 眼后生物光点两列
import random
random.seed(3)
for sy in (-1, 1):
    for i in range(7):
        x = -18 + i * 6 + random.random() * 2
        z = 0.6 + math.sin(i * 0.9) * 1.2
        add(bpy.ops.mesh.primitive_uv_sphere_add, LUME, segments=6, ring_count=4, radius=0.28, location=(x, sy * (5.4 - abs(x) * 0.09), z))
finish('leviathan', (-40, -55, 22), (0, 0, 0))

# ============ 巨鸟 roc（前 -Y → glTF +Z；wingL/wingR 独立节点供拍动） ============
reset()
BODY = M('body', '2a2f3d')
PALE = M('pale', '9aa8b8')
BEAK = M('beak', 'c8a05a')

body = add(bpy.ops.mesh.primitive_uv_sphere_add, BODY, segments=10, ring_count=8, radius=1.1, location=(0, 0, 0))
body.scale = (0.9, 2.6, 0.8)
head = add(bpy.ops.mesh.primitive_uv_sphere_add, BODY, segments=8, ring_count=6, radius=0.62, location=(0, -2.6, 0.35))
beak = add(bpy.ops.mesh.primitive_cone_add, BEAK, vertices=6, radius1=0.28, radius2=0, depth=1.1, location=(0, -3.5, 0.28))
beak.rotation_euler = (math.radians(-90), 0, 0)
tail = add(bpy.ops.mesh.primitive_cone_add, BODY, vertices=3, radius1=1.2, radius2=0, depth=0.3, location=(0, 3.0, 0.1))
tail.rotation_euler = (0, 0, math.radians(90))
tail.scale = (1, 1.7, 1)
# 翅膀：三角板，翼根在体侧，命名 wingL/wingR
import bmesh
def wing(name, sgn):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    root_f = bm.verts.new((0, -1.2, 0))
    root_b = bm.verts.new((0, 1.0, 0))
    mid = bm.verts.new((sgn * 3.4, -0.2, 0.15))
    tip = bm.verts.new((sgn * 6.2, 0.9, 0.35))
    bm.faces.new((root_f, root_b, mid))
    bm.faces.new((mid, root_b, tip))
    bm.to_mesh(mesh); bm.free()
    mesh.materials.append(PALE)
    mod = obj.modifiers.new('s', 'SOLIDIFY'); mod.thickness = 0.12
    obj.location = (sgn * 0.8, 0, 0.15)
    return obj
wing('wingL', -1)
wing('wingR', 1)
finish('roc', (10, -14, 6), (0, 0, 0))

# ============ 水手 crew（甲板船员；前 -Y → glTF +Z） ============
reset()
NAVY = M('navy', '3a4763')
RUST2 = M('rust2', 'b25a2e')
DARK2 = M('dark2', '2c2824')
SKIN2 = M('skin2', 'd9c4a8')

t = add(bpy.ops.mesh.primitive_cone_add, NAVY, vertices=9, radius1=0.30, radius2=0.24, depth=0.58, location=(0, 0, 0.66))
add(bpy.ops.mesh.primitive_cylinder_add, RUST2, vertices=9, radius=0.27, depth=0.09, location=(0, 0, 0.56))
for sx in (-0.11, 0.11):
    add(bpy.ops.mesh.primitive_cylinder_add, DARK2, vertices=7, radius=0.07, depth=0.24, location=(sx, 0, 0.12))
    add(bpy.ops.mesh.primitive_cube_add, DARK2, size=0.14, location=(sx, -0.03, 0.04))
for sx in (-0.33, 0.33):
    a = add(bpy.ops.mesh.primitive_cylinder_add, NAVY, vertices=7, radius=0.065, depth=0.38, location=(sx, 0, 0.76))
    a.rotation_euler = (0, math.radians(12 if sx > 0 else -12), 0)
add(bpy.ops.mesh.primitive_uv_sphere_add, SKIN2, segments=9, ring_count=7, radius=0.21, location=(0, 0, 1.12))
cap = add(bpy.ops.mesh.primitive_uv_sphere_add, DARK2, segments=9, ring_count=5, radius=0.22, location=(0, 0, 1.17))
cap.scale = (1, 1, 0.62)
finish('crew', (2.4, -2.6, 1.5), (0, 0, 0.65))
print('DONE')
