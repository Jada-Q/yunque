# 星球居民二人 — listener(井星·坐姿倾听) / wiper(拭星·跪姿擦拭)
# 原点=底部中心, 前 -Y(blender) → glTF +Z；与 traveler 同工艺
import bpy, math, os

PROJ = '/Users/jada/Desktop/Projects/yunque'

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def M(name, hexcol):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    r, g, bl = (int(hexcol[i:i+2], 16) / 255 for i in (0, 2, 4))
    b.inputs['Base Color'].default_value = (r**2.2, g**2.2, bl**2.2, 1)
    b.inputs['Roughness'].default_value = 0.9
    return m

def add(op, mat, **kw):
    op(**kw)
    o = bpy.context.active_object
    o.data.materials.append(mat)
    return o

def finish(name, cam=(2.6, -2.8, 1.5), look=(0, 0, 0.6)):
    bpy.ops.export_scene.gltf(filepath=os.path.join(PROJ, 'public/models/%s.glb' % name),
                              export_format='GLB', export_apply=True)
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

# ============ 倾听者 listener（坐在石凳上，微微侧头） ============
reset()
ROBE = M('robe', '3a4763')     # 深青长袍
SCARF = M('scarf', '8fa8b8')   # 浅青围巾
SKIN = M('skin', 'd9c4a8')
HAIR = M('hair', '2c2824')
STONE = M('stone', '55606e')

# 石凳
add(bpy.ops.mesh.primitive_cylinder_add, STONE, vertices=9, radius=0.34, depth=0.34, location=(0, 0, 0.17))
# 下身(坐姿长袍裙——扁圆鼓形盖住石凳)
low = add(bpy.ops.mesh.primitive_uv_sphere_add, ROBE, segments=10, ring_count=8, radius=0.36, location=(0, -0.02, 0.42))
low.scale = (1.0, 1.05, 0.62)
# 小腿×2 垂在前面 + 布鞋
for sx in (-0.14, 0.14):
    leg = add(bpy.ops.mesh.primitive_cylinder_add, ROBE, vertices=7, radius=0.075, depth=0.36, location=(sx, -0.28, 0.2))
    leg.rotation_euler = (math.radians(12), 0, 0)
    add(bpy.ops.mesh.primitive_cube_add, HAIR, size=1, location=(sx, -0.36, 0.045)).scale = (0.11, 0.17, 0.07)
# 躯干(微微前倾的锥台)
torso = add(bpy.ops.mesh.primitive_cone_add, ROBE, vertices=10, radius1=0.30, radius2=0.20, depth=0.55, location=(0, -0.02, 0.84))
torso.rotation_euler = (math.radians(-5), 0, 0)
# 手臂×2 搭在膝上(上臂垂+前臂前伸)
for sx in (-0.26, 0.26):
    ua = add(bpy.ops.mesh.primitive_cylinder_add, ROBE, vertices=7, radius=0.06, depth=0.3, location=(sx, -0.03, 0.82))
    ua.rotation_euler = (math.radians(15), 0, math.radians(10 if sx > 0 else -10))
    fa = add(bpy.ops.mesh.primitive_cylinder_add, ROBE, vertices=7, radius=0.05, depth=0.3, location=(sx * 0.85, -0.2, 0.63))
    fa.rotation_euler = (math.radians(75), 0, 0)
    add(bpy.ops.mesh.primitive_uv_sphere_add, SKIN, segments=7, ring_count=5, radius=0.06, location=(sx * 0.8, -0.33, 0.6))
# 围巾(颈圈+垂带)
sc_ring = add(bpy.ops.mesh.primitive_torus_add, SCARF, major_radius=0.15, minor_radius=0.05, location=(0, -0.02, 1.12))
sc_ring.rotation_euler = (math.radians(8), 0, 0)
tail = add(bpy.ops.mesh.primitive_cube_add, SCARF, size=1, location=(0.1, 0.14, 0.98))
tail.scale = (0.08, 0.05, 0.2)
tail.rotation_euler = (0, math.radians(-8), 0)
# 头(侧头倾听 —— 向右歪 12°) + 短发
head = add(bpy.ops.mesh.primitive_uv_sphere_add, SKIN, segments=10, ring_count=8, radius=0.21, location=(0.02, -0.02, 1.36))
head.rotation_euler = (0, math.radians(12), 0)
hair = add(bpy.ops.mesh.primitive_uv_sphere_add, HAIR, segments=10, ring_count=6, radius=0.22, location=(0.03, 0.02, 1.40))
hair.scale = (1, 1, 0.75)
hair.rotation_euler = (0, math.radians(12), 0)
# 耳朵一只(朝向井的那侧，倾听的记号)
ear = add(bpy.ops.mesh.primitive_uv_sphere_add, SKIN, segments=6, ring_count=4, radius=0.05, location=(0.22, -0.02, 1.36))
finish('listener', cam=(2.3, -2.5, 1.35), look=(0, 0, 0.7))

# ============ 擦拭者 wiper（跪姿前倾，右手执布） ============
reset()
CREAM = M('cream', 'ded5c2')   # 米白衣
APRON = M('apron', 'b25a2e')   # 锈橙围裙
SKIN2 = M('skin2', 'd9c4a8')
SCARF2 = M('scarf2', 'e8ddc4') # 米色头巾
CLOTH = M('cloth', 'f5f0e2')
DARK = M('dark', '3a3430')

# 折叠的小腿(跪垫在身下)×2
for sx in (-0.13, 0.13):
    shin = add(bpy.ops.mesh.primitive_cube_add, DARK, size=1, location=(sx, 0.16, 0.09))
    shin.scale = (0.11, 0.3, 0.09)
# 裙摆(跪姿铺开的锥裙,重心靠后)
skirt = add(bpy.ops.mesh.primitive_cone_add, CREAM, vertices=10, radius1=0.34, radius2=0.2, depth=0.42, location=(0, 0.1, 0.32))
skirt.rotation_euler = (math.radians(-14), 0, 0)
# 围裙片
ap = add(bpy.ops.mesh.primitive_cube_add, APRON, size=1, location=(0, -0.12, 0.36))
ap.scale = (0.2, 0.03, 0.2)
ap.rotation_euler = (math.radians(-22), 0, 0)
# 躯干(明显前倾 35°)
torso2 = add(bpy.ops.mesh.primitive_cone_add, CREAM, vertices=10, radius1=0.26, radius2=0.17, depth=0.5, location=(0, -0.13, 0.66))
torso2.rotation_euler = (math.radians(-35), 0, 0)
# 腰带
belt = add(bpy.ops.mesh.primitive_cylinder_add, APRON, vertices=9, radius=0.24, depth=0.08, location=(0, -0.02, 0.5))
belt.rotation_euler = (math.radians(-30), 0, 0)
# 右臂前伸按着布，左臂撑膝
ra = add(bpy.ops.mesh.primitive_cylinder_add, CREAM, vertices=7, radius=0.055, depth=0.44, location=(0.16, -0.44, 0.42))
ra.rotation_euler = (math.radians(58), 0, math.radians(-8))
add(bpy.ops.mesh.primitive_uv_sphere_add, SKIN2, segments=7, ring_count=5, radius=0.06, location=(0.19, -0.58, 0.24))
cl = add(bpy.ops.mesh.primitive_cube_add, CLOTH, size=1, location=(0.19, -0.64, 0.045))
cl.scale = (0.16, 0.22, 0.05)
la = add(bpy.ops.mesh.primitive_cylinder_add, CREAM, vertices=7, radius=0.055, depth=0.34, location=(-0.2, -0.26, 0.5))
la.rotation_euler = (math.radians(40), 0, math.radians(14))
add(bpy.ops.mesh.primitive_uv_sphere_add, SKIN2, segments=7, ring_count=5, radius=0.055, location=(-0.24, -0.36, 0.36))
# 头(低头看着手里的活) + 三角头巾 + 巾结
head2 = add(bpy.ops.mesh.primitive_uv_sphere_add, SKIN2, segments=10, ring_count=8, radius=0.19, location=(0, -0.34, 0.94))
head2.rotation_euler = (math.radians(-25), 0, 0)
kerchief = add(bpy.ops.mesh.primitive_uv_sphere_add, SCARF2, segments=10, ring_count=6, radius=0.205, location=(0, -0.31, 0.98))
kerchief.scale = (1, 1.05, 0.8)
kerchief.rotation_euler = (math.radians(-25), 0, 0)
knot = add(bpy.ops.mesh.primitive_uv_sphere_add, SCARF2, segments=6, ring_count=4, radius=0.06, location=(0, -0.14, 1.02))
finish('wiper', cam=(2.3, -2.5, 1.2), look=(0, -0.15, 0.5))
print('DONE')
