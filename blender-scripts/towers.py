# 云阙浮塔三型 — Blender 5.x headless
# tower-a 环塔(锥身+层环) / tower-b 叠舱塔(方芯+侧舱) / tower-c 细钎塔(细身+长针)
# 原点=底部中心，高度 60-80m，供远景实例化
import bpy, math, os

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

def export_render(name, cam_h, cam_d):
    path = os.path.join(PROJ, 'public/models/%s.glb' % name)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True)
    cam_data = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (cam_d * 0.7, -cam_d, cam_h)
    tgt = bpy.data.objects.new('t', None); tgt.location = (0, 0, cam_h * 0.8)
    bpy.context.collection.objects.link(tgt)
    con = cam.constraints.new('TRACK_TO'); con.target = tgt
    con.track_axis = 'TRACK_NEGATIVE_Z'; con.up_axis = 'UP_Y'
    bpy.context.scene.camera = cam
    sd = bpy.data.lights.new('s', 'SUN'); sd.energy = 3
    sun = bpy.data.objects.new('s', sd); bpy.context.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(55), math.radians(-25), 0)
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

BODY  = '3a4763'   # 深蓝灰塔身
DARK  = '2c3850'   # 更深的舱体
BRASS = 'c8a05a'
WIN   = 'ffb066'   # 发光窗

def windows(mat_win, rf, zs, n=6):
    # rf: 半径或 (z)->半径 的函数，窗贴着塔壁
    for z in zs:
        r = rf(z) if callable(rf) else rf
        for i in range(n):
            a = i / n * math.pi * 2 + z * 0.3
            w = add(bpy.ops.mesh.primitive_cube_add, mat_win, size=1, location=(math.cos(a) * r, math.sin(a) * r, z))
            w.scale = (0.35, 0.12, 0.5)
            w.rotation_euler = (0, 0, a)

# ---- Tower A 环塔 ----
reset()
mb, md, mbr, mw = M('b', BODY), M('d', DARK), M('br', BRASS, 3), M('w', WIN, 4)
add(bpy.ops.mesh.primitive_cone_add, mb, vertices=10, radius1=5.5, radius2=2.2, depth=62, location=(0, 0, 31))
add(bpy.ops.mesh.primitive_cone_add, md, vertices=10, radius1=7.5, radius2=5.2, depth=6, location=(0, 0, 3))  # 基座裙
for z, r in ((16, 7.8), (30, 6.6), (44, 5.4), (56, 4.4)):
    disc = add(bpy.ops.mesh.primitive_cylinder_add, md, vertices=12, radius=r, depth=1.1, location=(0, 0, z))
    add(bpy.ops.mesh.primitive_cylinder_add, mb, vertices=12, radius=r * 0.7, depth=0.5, location=(0, 0, z + 0.8))
add(bpy.ops.mesh.primitive_cylinder_add, mb, vertices=8, radius=0.5, depth=14, location=(0, 0, 69))
add(bpy.ops.mesh.primitive_uv_sphere_add, mbr, segments=8, ring_count=6, radius=0.9, location=(0, 0, 77))
windows(mw, lambda z: 5.5 + (2.2 - 5.5) * z / 62 + 0.08, (12, 24, 38, 50), 5)
export_render('tower-a', 40, 55)

# ---- Tower B 叠舱塔 ----
reset()
mb, md, mbr, mw = M('b', BODY), M('d', DARK), M('br', BRASS, 3), M('w', WIN, 4)
core = add(bpy.ops.mesh.primitive_cube_add, mb, size=1, location=(0, 0, 32))
core.scale = (4.2, 4.2, 64)
add(bpy.ops.mesh.primitive_cube_add, md, size=1, location=(0, 0, 2)).scale = (6.5, 6.5, 4)
import random
random.seed(7)
for z in range(10, 62, 7):
    for _ in range(2):
        a = random.random() * math.pi * 2
        s = 2.2 + random.random() * 2.6
        pod = add(bpy.ops.mesh.primitive_cube_add, md if random.random() < 0.6 else mb, size=1,
                  location=(math.cos(a) * 3.6, math.sin(a) * 3.6, z + random.random() * 3))
        pod.scale = (s, s * 0.8, s * 0.7)
add(bpy.ops.mesh.primitive_cube_add, md, size=1, location=(0, 0, 66)).scale = (5.5, 5.5, 3.5)
add(bpy.ops.mesh.primitive_cylinder_add, mb, vertices=8, radius=0.35, depth=10, location=(0, 0, 72))
add(bpy.ops.mesh.primitive_uv_sphere_add, mbr, segments=8, ring_count=6, radius=0.7, location=(0, 0, 77.5))
windows(mw, 2.15, (18, 34, 48), 4)
export_render('tower-b', 40, 55)

# ---- Tower C 细钎塔 ----
reset()
mb, md, mbr, mw = M('b', BODY), M('d', DARK), M('br', BRASS, 3), M('w', WIN, 4)
add(bpy.ops.mesh.primitive_cone_add, mb, vertices=8, radius1=2.4, radius2=1.1, depth=52, location=(0, 0, 26))
add(bpy.ops.mesh.primitive_cone_add, md, vertices=8, radius1=3.8, radius2=2.3, depth=4, location=(0, 0, 2))
for z, r in ((20, 3.6), (38, 2.9)):
    add(bpy.ops.mesh.primitive_cylinder_add, md, vertices=10, radius=r, depth=0.9, location=(0, 0, z))
cage = add(bpy.ops.mesh.primitive_cylinder_add, md, vertices=8, radius=1.8, depth=5, location=(0, 0, 50))
add(bpy.ops.mesh.primitive_cone_add, mb, vertices=8, radius1=0.5, radius2=0.02, depth=26, location=(0, 0, 65))
add(bpy.ops.mesh.primitive_uv_sphere_add, mbr, segments=8, ring_count=6, radius=0.55, location=(0, 0, 79))
windows(mw, lambda z: 2.4 + (1.1 - 2.4) * z / 52 + 0.07, (14, 30, 49), 3)
export_render('tower-c', 42, 50)
print('DONE')
