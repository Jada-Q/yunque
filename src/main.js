// 云阙 — Phase 1 灰盒 vista
// 目标只有一个：验证"站在万米高空悬挑平台上"的体感。成败在相机、雾、尺度，不在模型。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toonify, addOutline, cloudTexture, makeComposer } from './fx.js';

const CFG = {
  playerSpeed: 4.0,
  cam: { offset: [3.5, 3.6, 9.5], fov: 55, lookAhead: [-7, 0.2, -15] },
  platform: { x0: -7, x1: 8, z0: -8, z1: 8, y: 0 },   // 主平台（x1 侧连巨构墙）
  cloudY: -26,
  night: 0x0d1526,
  // 滑翔物理（全部手感参数在此，调参不改逻辑）
  glide: {
    launchSpeed: 10, minSpeed: 6, maxSpeed: 30, baseSpeed: 11,
    pitchRate: 1.2, yawRate: 1.7,
    pitchMin: -0.95, pitchMax: 0.45,
    accelFromDive: 14, drag: 0.55,
    stallSink: 4.5,          // 低速失速下坠
    updraftLift: 7.5,
    camDist: 9, camUp: 3, fovGlide: 68,
  },
};

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(CFG.night);
scene.fog = new THREE.Fog(0x18243c, 60, 320);

const camera = new THREE.PerspectiveCamera(CFG.cam.fov, innerWidth / innerHeight, 0.1, 1200);

// ---------- 天穹与月 ----------
{
  const geo = new THREE.SphereGeometry(950, 24, 16);
  const colors = [];
  const pos = geo.attributes.position;
  const top = new THREE.Color(0x070c1a), horizon = new THREE.Color(0x2a4560);
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / 950, -0.1, 1);
    const c = horizon.clone().lerp(top, Math.pow(Math.max(t, 0), 0.5));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.userData.outline = true;
  dome.renderOrder = -2;
  scene.add(dome);
  const moonMesh = new THREE.Mesh(new THREE.CircleGeometry(26, 24), new THREE.MeshBasicMaterial({ color: 0xe8eef8, fog: false }));
  moonMesh.position.set(-420, 330, -640);
  moonMesh.lookAt(0, 0, 0);
  moonMesh.userData.outline = true;
  scene.add(moonMesh);
}

// 月光（冷）+ 巨构侧的暖光
const moon = new THREE.DirectionalLight(0xbfd0e8, 1.1);
moon.position.set(-40, 60, 30);
moon.castShadow = true;
scene.add(moon, new THREE.AmbientLight(0x2a3550, 1.4));
const structGlow = new THREE.PointLight(0xff9a4d, 60, 60, 1.8);
structGlow.position.set(14, 6, 0);
scene.add(structGlow);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, ...extra });

// ---------- 星空 ----------
{
  const N = 1600, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const v = new THREE.Vector3().randomDirection();
    v.y = Math.abs(v.y) * 0.9 + 0.05; // 只在头顶半球
    v.multiplyScalar(900);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfd8e8, size: 1.6, sizeAttenuation: false, fog: false }));
  scene.add(stars);
}

// ---------- 云海（灰盒：三层大面片 + 近处云团） ----------
{
  // 云海底盘：不受雾、不受光的自亮面（月照云海的底色）
  const layer = (y, color, op, size) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ color, transparent: op < 1, opacity: op, fog: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.userData.outline = true;
    scene.add(m);
    return m;
  };
  layer(CFG.cloudY - 2, 0x8fa3c0, 1.0, 1300);
  layer(CFG.cloudY - 8, 0x64789a, 1.0, 1300);
  // 云片 billboard：柔边贴图，近团 + 全向远脊两波
  const tex = cloudTexture();
  const nearMats = Array.from({ length: 6 }, (_, i) => new THREE.SpriteMaterial({
    map: tex, transparent: true, opacity: 0.92, depthWrite: false,
    rotation: (i - 3) * 0.16, color: 0xeef2f8, fog: true,
  }));
  const farMats = Array.from({ length: 4 }, (_, i) => new THREE.SpriteMaterial({
    map: tex, transparent: true, opacity: 0.88, depthWrite: false,
    rotation: (i - 2) * 0.12, color: 0xaebfd6, fog: false, // 远云堤不受雾：月光云山
  }));
  const addCloud = (mats, x, z, s, yJit = 0) => {
    const sp = new THREE.Sprite(mats[(Math.random() * mats.length) | 0]);
    sp.position.set(x, CFG.cloudY + 2.5 + yJit, z);
    sp.scale.set(s, s * 0.42, 1);
    scene.add(sp);
  };
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, d = 22 + Math.random() * 150;
    addCloud(nearMats, Math.cos(a) * d - 10, Math.sin(a) * d, 16 + Math.random() * 44, Math.random() * 3);
  }
  for (let i = 0; i < 44; i++) {
    const a = Math.random() * Math.PI * 2, d = 240 + Math.random() * 220;
    addCloud(farMats, Math.cos(a) * d, Math.sin(a) * d, 70 + Math.random() * 130, 2 + Math.random() * 10);
  }
}

// ---------- 巨构墙（右侧，x>+8，从云下伸到头顶） ----------
{
  const wallMat = mat(0x5c4433);
  const darkMat = mat(0x3d3028);
  // 主体板块（船坞湾禁区：|z|<26 的墙面整体后退，近景交给天舟与栈桥）
  const dockRecess = (z) => (Math.abs(z) < 26 ? 11 : 0);
  for (let i = 0; i < 34; i++) {
    const w = 6 + Math.random() * 14, h = 10 + Math.random() * 26, d = 8 + Math.random() * 22;
    const bz = -110 + Math.random() * 220;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), Math.random() < 0.5 ? wallMat : darkMat);
    b.position.set(12 + dockRecess(bz) + Math.random() * 14, -70 + Math.random() * 160, bz);
    b.castShadow = true;
    scene.add(b);
  }
  // 竖向长杆（图里那种通天管线）
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3 + Math.random() * 0.5, 0.3 + Math.random() * 0.5, 200, 8), darkMat);
    p.position.set(10.5 + Math.random() * 10, 10, -90 + Math.random() * 180);
    scene.add(p);
  }
  // 亮窗（暖橙小方块，巨构的生命迹象）
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffb066 });
  for (let i = 0; i < 130; i++) {
    const wz = -100 + Math.random() * 200;
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.1), winMat);
    win.position.set(9.6 + (Math.abs(wz) < 26 ? 11 : 0) + Math.random() * 3, -50 + Math.random() * 110, wz);
    win.rotation.y = Math.PI / 2;
    scene.add(win);
  }
  // ---- 增密：管线 / 箱簇 / 天线 / 吊臂 ----
  const gMat = mat(0x4a3a2c), gMat2 = mat(0x32404e);
  for (let i = 0; i < 14; i++) { // 横向管线
    const len = 30 + Math.random() * 110;
    const pz = -60 + Math.random() * 120;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25 + Math.random() * 0.4, 0.25 + Math.random() * 0.4, len, 8), Math.random() < 0.5 ? gMat : gMat2);
    p.rotation.x = Math.PI / 2;
    p.position.set(9 + (Math.abs(pz) < 26 ? 11 : 0) + Math.random() * 6, -55 + Math.random() * 120, pz);
    scene.add(p);
  }
  for (let i = 0; i < 60; i++) { // 小箱簇
    const s = 0.8 + Math.random() * 2.4;
    const bz = -95 + Math.random() * 190;
    const b = new THREE.Mesh(new THREE.BoxGeometry(s, s * (0.6 + Math.random()), s), Math.random() < 0.6 ? gMat : gMat2);
    b.position.set(8.6 + (Math.abs(bz) < 26 ? 11 : 0) + Math.random() * 4, -40 + Math.random() * 95, bz);
    scene.add(b);
  }
  for (let i = 0; i < 10; i++) { // 天线 + 红顶灯
    const h = 6 + Math.random() * 14;
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.15, h, 6), gMat);
    a.position.set(10 + Math.random() * 8, 55 + Math.random() * 25, -90 + Math.random() * 180);
    scene.add(a);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff6a5a }));
    tip.position.copy(a.position); tip.position.y += h / 2 + 0.3;
    scene.add(tip);
  }
  { // 吊臂横过平台上空 + 垂缆 + 吊件
    const armPost = new THREE.Mesh(new THREE.BoxGeometry(1, 16, 1), gMat2);
    armPost.position.set(9, 7, -3); scene.add(armPost);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(15, 0.8, 0.8), gMat2);
    arm.position.set(1.5, 14.6, -3); scene.add(arm);
    for (const ax of [-4.5, -1, 2.5]) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 6.4, 4), gMat);
      cable.position.set(ax, 11.2, -3); scene.add(cable);
    }
    const hook = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), gMat);
    hook.position.set(-1, 7.6, -3); scene.add(hook);
  }
}

// ---------- 悬挑平台（玩家站的地方） ----------
// 过路飞船（氛围层：无碰撞，时不时横穿云海）
const traffic = [];
function resetTraffic(t) {
  t.wait = 7 + Math.random() * 22;          // 下一班间隔
  t.obj.visible = false;
  const lane = Math.random();
  let p0, dir;
  if (lane < 0.55) {                        // 航线族1：z 向横穿（塔群那侧）
    const x = -85 - Math.random() * 190;
    const sgn = Math.random() < 0.5 ? 1 : -1;
    p0 = new THREE.Vector3(x, 0, -sgn * 350);
    dir = new THREE.Vector3(0, 0, sgn);
  } else {                                  // 航线族2：x 向远景斜穿
    const z = (Math.random() < 0.5 ? -1 : 1) * (130 + Math.random() * 170);
    const sgn = Math.random() < 0.5 ? 1 : -1;
    p0 = new THREE.Vector3(-sgn * 350, 0, z);
    dir = new THREE.Vector3(sgn, 0, 0);
  }
  t.obj.rotation.y = Math.atan2(dir.z, -dir.x); // 船艏(-X)对准航向
  t.vel = dir.multiplyScalar(9 + Math.random() * 12);
  t.baseY = -18 + Math.random() * 42;           // 有的贴云面半没在云里，有的在高处
  t.phase = Math.random() * 6;
  t.obj.position.copy(p0);
  t.obj.position.y = t.baseY;
  t.obj.scale.setScalar(0.55 + Math.random() * 0.6);
}

{
  // 天舟：主平台即系泊的空中飞船（Blender 模型，甲板面 y=0；舷墙自带，替代栏杆）
  new GLTFLoader().load('/models/skyship.glb', (g) => {
    g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    toonify(g.scene);
    addOutline(g.scene, 1.015);
    scene.add(g.scene);
    // 三条过路船错峰发班
    for (let i = 0; i < 3; i++) {
      const c = g.scene.clone(true);
      scene.add(c);
      const t = { obj: c, vel: new THREE.Vector3(), wait: 0, baseY: 0, phase: 0 };
      resetTraffic(t);
      t.wait = 4 + i * 10;
      traffic.push(t);
    }
  }, undefined, () => {
    // 兜底：加载失败给一块素甲板，游戏仍可玩
    const deck = new THREE.Mesh(new THREE.BoxGeometry(22, 0.8, 18), mat(0x7a5a40));
    deck.position.set(-1, -0.4, 0);
    scene.add(deck);
  });
  // 栈桥：船艉接巨构
  const gang = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.5, 2.4), mat(0x4a3a2c));
  gang.position.set(14, -0.25, 0);
  gang.receiveShadow = true;
  scene.add(gang);
  for (const gx of [11.5, 16.5]) {
    for (const gz of [-1.1, 1.1]) {
      const gp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6), mat(0x3d3028));
      gp.position.set(gx, 0.45, gz);
      scene.add(gp);
    }
  }
  // 甲板杂件：木箱堆 + 灯柱（暖光）
  const crate = (x, z, s) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat(0x6a5138));
    c.position.set(x, s / 2, z); c.castShadow = true; scene.add(c);
  };
  crate(6.5, -6, 1.2); crate(5.4, -6.4, 0.9); crate(6.2, -4.9, 0.8); crate(6.1, -5.8, 0.7 );
  const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 2.6, 8), mat(0x3d3028));
  lampPost.position.set(-6.2, 1.3, -7.2); scene.add(lampPost);
  const lampHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffc98a }));
  lampHead.position.set(-6.2, 2.75, -7.2); scene.add(lampHead);
  const lampLight = new THREE.PointLight(0xffb066, 18, 14, 1.8);
  lampLight.position.set(-6.2, 2.85, -7.2); scene.add(lampLight);
}

// ---------- 生灵：云鲸 / 巨鸟 / 鸟群 / 船员 ----------
const creatures = {
  lev: null, levState: { wait: 30, active: false, vel: new THREE.Vector3(), phase: 0 },
  roc: null, rocWings: [], flocks: [], crew: [],
};
function resetLev() {
  creatures.levState.wait = 35 + Math.random() * 60;
  creatures.levState.active = false;
  if (creatures.lev) creatures.lev.visible = false;
}
function spawnLev() {
  const L = creatures.levState;
  const sgn = Math.random() < 0.5 ? 1 : -1;
  creatures.lev.position.set(-70 - Math.random() * 160, CFG.cloudY - 2, -sgn * 340);
  const dir = new THREE.Vector3(0, 0, sgn);
  creatures.lev.rotation.y = Math.atan2(dir.z, -dir.x); // 鲸首朝 -X
  L.vel = dir.multiplyScalar(5 + Math.random() * 3);
  L.phase = Math.random() * 6;
  L.active = true;
  creatures.lev.scale.setScalar(0.8 + Math.random() * 0.5);
  creatures.lev.visible = true;
}
{
  const gl2 = new GLTFLoader();
  gl2.load('/models/leviathan.glb', g => {
    toonify(g.scene); addOutline(g.scene, 1.02);
    g.scene.visible = false;
    creatures.lev = g.scene;
    scene.add(g.scene);
  }, undefined, () => {});
  gl2.load('/models/roc.glb', g => {
    toonify(g.scene); addOutline(g.scene, 1.04);
    creatures.roc = g.scene;
    creatures.rocWings = [g.scene.getObjectByName('wingL'), g.scene.getObjectByName('wingR')].filter(Boolean);
    scene.add(g.scene);
  }, undefined, () => {});
  gl2.load('/models/crew.glb', g => {
    toonify(g.scene); addOutline(g.scene, 1.03);
    const routes = [ // 甲板巡走路线 [起点, 终点]
      { a: [-8, 6.5], b: [6, 6.5] },
      { a: [3, -6.8], b: [-9, -6.8] },
      { a: [8.5, -3], b: [8.5, 3] },  // 艉部栈桥口值守
    ];
    routes.forEach((r, i) => {
      const c = g.scene.clone(true);
      c.position.set(r.a[0], 0, r.a[1]);
      scene.add(c);
      creatures.crew.push({ obj: c, a: r.a, b: r.b, t: 'b', pause: i * 2, speed: 0.85 + i * 0.15 });
    });
  }, undefined, () => {});
}
// 鸟群（纯代码：双翼片小黑鸟 V 队）
function resetFlock(f) {
  f.wait = 12 + Math.random() * 25;
  f.g.visible = false;
  const sgn = Math.random() < 0.5 ? 1 : -1;
  f.g.position.set(-25 - Math.random() * 115, 4 + Math.random() * 18, -sgn * (180 + Math.random() * 80));
  const dir = new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, sgn).normalize();
  f.vel = dir.clone().multiplyScalar(6.5 + Math.random() * 3);
  f.g.rotation.y = Math.atan2(dir.x, dir.z);
}
function makeFlock() {
  const g = new THREE.Group();
  const bm = new THREE.MeshBasicMaterial({ color: 0x232a38, side: THREE.DoubleSide });
  const birds = [];
  const N = 9 + ((Math.random() * 5) | 0);
  for (let i = 0; i < N; i++) {
    const b = new THREE.Group();
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.32), bm);
      w.position.x = s * 0.45;
      w.rotation.x = -Math.PI / 2;
      w.userData.s = s;
      b.add(w);
    }
    const row = Math.ceil((i + 1) / 2), side = i % 2 ? 1 : -1;
    b.position.set(side * row * 1.5 + (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 0.6, -(row * 1.7) + (Math.random() - 0.5) * 0.5);
    b.userData.ph = Math.random() * 6;
    g.add(b);
    birds.push(b);
  }
  scene.add(g);
  const f = { g, birds, vel: new THREE.Vector3(), wait: 0 };
  resetFlock(f);
  f.wait = 4 + Math.random() * 12;
  return f;
}
creatures.flocks = [makeFlock(), makeFlock()];

// ---------- 远处浮塔群（Blender 三型实例化；基座没入云海） ----------
{
  const TOWER_SPOTS = [ // [型, x, z, 缩放, 朝向]
    ['a', -70, -60, 1.0, 0.3],  ['b', -120, 20, 1.15, 1.2], ['c', -95, 95, 0.9, 2.4],
    ['a', -175, -115, 1.3, 4.0], ['c', -60, 155, 0.8, 0.9], ['b', -195, 135, 1.25, 5.2],
    ['a', -235, 30, 1.5, 2.0],   ['c', -150, -175, 1.05, 3.3], ['b', 60, 215, 1.1, 0.5],
  ];
  const loader = new GLTFLoader();
  const loadTower = (k) => new Promise(res => loader.load(`/models/tower-${k}.glb`, g => {
    g.scene.traverse(o => { if (o.isMesh) o.castShadow = true; });
    toonify(g.scene);
    addOutline(g.scene, 1.02);
    res(g.scene);
  }, undefined, () => res(null)));
  Promise.all([loadTower('a'), loadTower('b'), loadTower('c')]).then(([a, b, c]) => {
    const T = { a, b, c };
    for (const [k, x, z, s, ry] of TOWER_SPOTS) {
      if (!T[k]) continue;
      const inst = T[k].clone(true);
      inst.position.set(x, CFG.cloudY - 12, z);
      inst.scale.setScalar(s);
      inst.rotation.y = ry;
      scene.add(inst);
    }
  });
}

// ---------- 落点塔（两座设计塔：A 低于起点顺滑可达，B 更高需借上升气流） ----------
const PADS = [
  { name: 'deck', x0: -11.5, x1: 9.5, z0: -8.5, z1: 8.5, y: 0 },
  { name: 'towerA', x0: -94, x1: -76, z0: -39, z1: -21, y: -4 },
  { name: 'towerB', x0: -160, x1: -140, z0: 31, z1: 49, y: 7 },
];
function buildPadTower(pad) {
  const cx = (pad.x0 + pad.x1) / 2, cz = (pad.z0 + pad.z1) / 2;
  const r = (pad.x1 - pad.x0) / 2;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, 1.2, 12), mat(0x5a5040));
  disc.position.set(cx, pad.y - 0.6, cz);
  disc.receiveShadow = true;
  scene.add(disc);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.5, 90, 10), mat(0x3d3830));
  shaft.position.set(cx, pad.y - 46, cz);
  scene.add(shaft);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshBasicMaterial({ color: 0x9fd8ff }));
  beacon.position.set(cx, pad.y + 4.5, cz);
  scene.add(beacon);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.5, 6), mat(0x3d3830));
  pole.position.set(cx, pad.y + 2.25, cz);
  scene.add(pole);
}
buildPadTower(PADS[1]);
buildPadTower(PADS[2]);

// 上升气流柱（去塔 B 的钥匙）：可见的淡光柱
const UPDRAFT = { x: -110, z: 8, r: 11, top: 30 };
{
  const col = new THREE.Mesh(
    new THREE.CylinderGeometry(UPDRAFT.r, UPDRAFT.r, UPDRAFT.top - CFG.cloudY, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false })
  );
  col.position.set(UPDRAFT.x, (UPDRAFT.top + CFG.cloudY) / 2, UPDRAFT.z);
  scene.add(col);
}

// ---------- 玩家 ----------
const player = new THREE.Group();
let playerBody;
{
  playerBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 4, 12), mat(0xd8d2c0));
  playerBody.position.y = 0.8;
  playerBody.castShadow = true;
  player.add(playerBody);
}
player.position.set(2, 0, 2);
scene.add(player);
// 云阙旅人（飞行帽信使；加载失败保留胶囊）+ 三角翼（滑翔时展开）
let wing = null;
new GLTFLoader().load('/models/traveler.glb', (g) => {
  g.scene.traverse(o => { if (o.isMesh) o.castShadow = true; });
  toonify(g.scene);
  addOutline(g.scene);
  player.remove(playerBody);
  player.add(g.scene);
}, undefined, () => {});
new GLTFLoader().load('/models/wing.glb', (g) => {
  g.scene.traverse(o => { if (o.isMesh) o.castShadow = true; });
  toonify(g.scene);
  addOutline(g.scene, 1.02);
  wing = g.scene;
  wing.position.set(0, 1.18, 0.08);
  wing.visible = false;
  player.add(wing);
}, undefined, () => {});

// ---------- 状态与输入 ----------
const G = CFG.glide;
const state = {
  mode: 'walk',            // walk | glide
  pad: PADS[0],
  yaw: Math.PI,            // 面向 -z? 起飞方向由行走朝向决定
  pitch: 0,
  speed: 0,
  toastTimer: 0,
};
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space' && state.mode === 'walk') launch();
});
addEventListener('keyup', e => keys[e.code] = false);

const toastEl = document.getElementById('toast');
function toast(text, ms = 1600) {
  toastEl.textContent = text;
  toastEl.style.opacity = 1;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => (toastEl.style.opacity = 0), ms);
}

function launch() {
  state.mode = 'glide';
  state.yaw = player.rotation.y;
  state.pitch = -0.12;
  state.speed = G.launchSpeed;
  state.launchGrace = state.pad; // 未飞出出发台边界前，不判定落回它
  player.position.y += 1.2; // 跃起
}

function respawn() {
  toast('坠入云海');
  state.mode = 'walk';
  state.pad = PADS[0];
  player.position.set(2, 0, 2);
  player.rotation.set(0, Math.PI, 0);
  camera.fov = CFG.cam.fov;
  camera.updateProjectionMatrix();
}

// ---------- 主循环 ----------
const clock = new THREE.Clock();
let elapsed = 0;
const dir = new THREE.Vector3();
const fwd = new THREE.Vector3();
camera.position.set(player.position.x + CFG.cam.offset[0], CFG.cam.offset[1], player.position.z + CFG.cam.offset[2]);
const composer = makeComposer(renderer, scene, camera);

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  const k = 1 - Math.exp(-5 * dt);

  if (state.mode === 'walk') {
    dir.set(
      (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0),
      0,
      (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0)
    );
    if (dir.lengthSq() > 0) {
      dir.normalize().multiplyScalar(CFG.playerSpeed * dt);
      player.position.add(dir);
      player.rotation.y = Math.atan2(dir.x, dir.z);
    }
    const P = state.pad;
    player.position.x = THREE.MathUtils.clamp(player.position.x, P.x0 + 0.5, P.x1 - 0.5);
    player.position.z = THREE.MathUtils.clamp(player.position.z, P.z0 + 0.5, P.z1 - 0.5);
    player.position.y = P.y;
    player.rotation.x = 0;
    player.rotation.z += (0 - player.rotation.z) * k;  // 落地回正
    if (wing) wing.visible = false;                    // 收翼

    camera.position.lerp(new THREE.Vector3(
      player.position.x + CFG.cam.offset[0],
      P.y + CFG.cam.offset[1],
      player.position.z + CFG.cam.offset[2]
    ), k);
    camera.lookAt(
      player.position.x + CFG.cam.lookAhead[0],
      P.y + CFG.cam.lookAhead[1],
      player.position.z + CFG.cam.lookAhead[2]
    );
    if (camera.fov !== CFG.cam.fov) {
      camera.fov += (CFG.cam.fov - camera.fov) * k;
      camera.updateProjectionMatrix();
    }
  } else {
    // ---- 滑翔 ----
    state.yaw += ((keys['KeyA'] ? 1 : 0) - (keys['KeyD'] ? 1 : 0)) * G.yawRate * dt;
    state.pitch += ((keys['KeyS'] ? 1 : 0) - (keys['KeyW'] ? 1 : 0)) * G.pitchRate * dt;
    state.pitch = THREE.MathUtils.clamp(state.pitch, G.pitchMin, G.pitchMax);

    // 能量模型：俯冲加速，平飞缓降回基速；低速失速下沉
    state.speed += (Math.sin(-state.pitch) * G.accelFromDive - (state.speed - G.baseSpeed) * G.drag) * dt;
    state.speed = THREE.MathUtils.clamp(state.speed, G.minSpeed, G.maxSpeed);

    fwd.set(
      Math.sin(state.yaw) * Math.cos(state.pitch),
      Math.sin(state.pitch),
      Math.cos(state.yaw) * Math.cos(state.pitch)
    );
    player.position.addScaledVector(fwd, state.speed * dt);
    if (state.speed < G.minSpeed + 1.5) player.position.y -= G.stallSink * dt;

    // 上升气流
    const du = Math.hypot(player.position.x - UPDRAFT.x, player.position.z - UPDRAFT.z);
    if (du < UPDRAFT.r && player.position.y < UPDRAFT.top) {
      player.position.y += G.updraftLift * dt;
    }

    // 身体姿态跟飞行方向 + 转向压坡度；展翼
    if (wing) wing.visible = true;
    player.rotation.y = state.yaw;
    player.rotation.x = -state.pitch * 0.8 + 0.5; // 滑翔时身体前倾吊在翼下
    const turnIn = (keys['KeyA'] ? 1 : 0) - (keys['KeyD'] ? 1 : 0);
    player.rotation.z += ((-turnIn * 0.5) - player.rotation.z) * (1 - Math.exp(-6 * dt));

    // 出发台豁免：飞出其水平边界（或爬升超其上方 3m）后解除
    if (state.launchGrace) {
      const LP = state.launchGrace;
      const inside = player.position.x > LP.x0 && player.position.x < LP.x1 &&
                     player.position.z > LP.z0 && player.position.z < LP.z1;
      if (!inside || player.position.y > LP.y + 3) state.launchGrace = null;
    }
    // 落台判定：水平在台内 + 高度贴台面 + 在下降
    for (const P of PADS) {
      if (P === state.launchGrace) continue;
      if (player.position.x > P.x0 && player.position.x < P.x1 &&
          player.position.z > P.z0 && player.position.z < P.z1 &&
          player.position.y > P.y - 0.4 && player.position.y < P.y + 1.4 &&
          state.pitch <= 0.05) {
        state.mode = 'walk';
        state.pad = P;
        player.position.y = P.y;
        player.rotation.x = 0;
        toast(P.name === 'deck' ? '归台' : '落');
        break;
      }
    }
    // 坠云重生
    if (player.position.y < CFG.cloudY + 2) respawn();

    // 追飞相机：拉在身后，速度越快视野越阔
    if (state.mode === 'glide') {
      const camTarget = player.position.clone().addScaledVector(fwd, -G.camDist);
      camTarget.y += G.camUp;
      camera.position.lerp(camTarget, 1 - Math.exp(-4 * dt));
      const look = player.position.clone().addScaledVector(fwd, 6);
      camera.lookAt(look);
      const fovT = CFG.cam.fov + (G.fovGlide - CFG.cam.fov) * ((state.speed - G.minSpeed) / (G.maxSpeed - G.minSpeed));
      camera.fov += (fovT - camera.fov) * k;
      camera.updateProjectionMatrix();
    }
  }

  // --- 过路飞船巡航 ---
  for (const t of traffic) {
    if (t.wait > 0) { t.wait -= dt; continue; }
    t.obj.visible = true;
    t.obj.position.addScaledVector(t.vel, dt);
    t.obj.position.y = t.baseY + Math.sin(elapsed * 0.5 + t.phase) * 1.2;
    t.obj.rotation.z = Math.sin(elapsed * 0.4 + t.phase) * 0.02; // 微倾，像在气流里
    if (Math.abs(t.obj.position.x) > 380 || Math.abs(t.obj.position.z) > 380) resetTraffic(t);
  }

  // --- 生灵 ---
  if (creatures.lev) {
    const L = creatures.levState;
    if (L.active) {
      creatures.lev.position.addScaledVector(L.vel, dt);
      creatures.lev.position.y = CFG.cloudY - 2 + Math.sin(elapsed * 0.25 + L.phase) * 4.5; // 时浮时沉
      creatures.lev.rotation.z = Math.sin(elapsed * 0.2 + L.phase) * 0.05;
      if (Math.abs(creatures.lev.position.z) > 360 || Math.abs(creatures.lev.position.x) > 360) resetLev();
    } else {
      L.wait -= dt;
      if (L.wait <= 0) spawnLev();
    }
  }
  if (creatures.roc) { // 绕塔盘旋
    const ra = elapsed * 0.16;
    creatures.roc.position.set(-120 + Math.cos(ra) * 34, 16 + Math.sin(elapsed * 0.5) * 2.5, 20 + Math.sin(ra) * 34);
    creatures.roc.rotation.y = Math.atan2(-Math.sin(ra), Math.cos(ra));
    creatures.roc.rotation.z = 0.18; // 内倾
    const flap = Math.sin(elapsed * 2.1) * 0.45;
    if (creatures.rocWings[0]) creatures.rocWings[0].rotation.z = flap;
    if (creatures.rocWings[1]) creatures.rocWings[1].rotation.z = -flap;
  }
  for (const f of creatures.flocks) {
    if (f.wait > 0) { f.wait -= dt; continue; }
    f.g.visible = true;
    f.g.position.addScaledVector(f.vel, dt);
    for (const b of f.birds) {
      const w = Math.sin(elapsed * 7 + b.userData.ph) * 0.55;
      for (const wg of b.children) wg.rotation.z = wg.userData.s * w;
    }
    if (Math.abs(f.g.position.z) > 320 || Math.abs(f.g.position.x) > 320) resetFlock(f);
  }
  for (const c of creatures.crew) { // 甲板巡走
    if (c.pause > 0) { c.pause -= dt; continue; }
    const tgt = c.t === 'b' ? c.b : c.a;
    const dx = tgt[0] - c.obj.position.x, dz = tgt[1] - c.obj.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.15) {
      c.t = c.t === 'b' ? 'a' : 'b';
      c.pause = 2 + Math.random() * 5;
      continue;
    }
    c.obj.position.x += dx / d * c.speed * dt;
    c.obj.position.z += dz / d * c.speed * dt;
    c.obj.rotation.y = Math.atan2(dx, dz);
    c.obj.position.y = Math.abs(Math.sin(elapsed * 6)) * 0.03; // 步伐微颠
  }

  composer.render();
  requestAnimationFrame(tick);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// 全场卡通分档 + 描线（天穹/月/透明体已豁免）
toonify(scene);
addOutline(scene);

window.__yunque = { player, camera, scene, renderer, composer, state, PADS, UPDRAFT, traffic, resetTraffic, creatures, spawnLev };
tick();
