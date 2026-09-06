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

const cloudSprites = []; // 供缓漂动画
// ---------- 云海（分层面片 + 积云贴图 billboard） ----------
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
  layer(CFG.cloudY + 5, 0xc4d0e2, 0.14, 1300); // 云面上的薄霭（廉价体积感）
  // 云片 billboard：柔边贴图，近团 + 全向远脊两波
  // 双贴图消除重复感；每朵大云顶上再叠一层顶冠 → 积云的体量
  const texA = cloudTexture(7), texB = cloudTexture(23);
  const mkMats = (tex, color, fog, n, op) => Array.from({ length: n }, (_, i) => new THREE.SpriteMaterial({
    map: tex, transparent: true, opacity: op, depthWrite: false,
    rotation: (i - n / 2) * 0.14, color, fog,
  }));
  const nearMats = [...mkMats(texA, 0xeef2f8, true, 4, 0.92), ...mkMats(texB, 0xe6ecf6, true, 4, 0.9)];
  const farMats = [...mkMats(texA, 0xaebfd6, false, 3, 0.88), ...mkMats(texB, 0xa4b6d0, false, 3, 0.86)];
  const addCloud = (mats, x, z, s, yJit = 0, cap = true) => {
    const sp = new THREE.Sprite(mats[(Math.random() * mats.length) | 0]);
    sp.position.set(x, CFG.cloudY + 2.5 + yJit + s * 0.06, z);
    sp.scale.set(s, s * 0.46, 1);
    sp.userData.baseX = x;
    sp.userData.ph = Math.random() * 6;
    cloudSprites.push(sp);
    scene.add(sp);
    if (cap && s > 34) { // 顶冠：隆起的第二层
      const cp = new THREE.Sprite(mats[(Math.random() * mats.length) | 0]);
      cp.position.set(x + (Math.random() - 0.5) * s * 0.2, sp.position.y + s * 0.17, z + 1);
      cp.scale.set(s * 0.52, s * 0.28, 1);
      cp.userData.baseX = cp.position.x;
      cp.userData.ph = sp.userData.ph + 0.6;
      cloudSprites.push(cp);
      scene.add(cp);
    }
  };
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2, d = 24 + Math.random() * 150;
    addCloud(nearMats, Math.cos(a) * d - 10, Math.sin(a) * d, 26 + Math.random() * 56, Math.random() * 3);
  }
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, d = 250 + Math.random() * 220;
    addCloud(farMats, Math.cos(a) * d, Math.sin(a) * d, 110 + Math.random() * 150, 2 + Math.random() * 12);
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

// ---------- 小星球（星球间探险：每颗一个小世界，球面行走） ----------
const PLANETS = [];
// 把物件立在球面 (lat, lon)：位置贴面、Y 轴对准径向
function onSurface(obj, r, lat, lon) {
  const dir = new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
  obj.position.copy(dir.clone().multiplyScalar(r));
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return obj;
}
function makePlanet(def) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(def.r, 26, 20), mat(def.color));
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  def.build(g, def.r);
  g.position.set(def.x, def.y, def.z);
  scene.add(g);
  const p = { ...def, group: g, center: new THREE.Vector3(def.x, def.y, def.z) };
  PLANETS.push(p);
  return p;
}
// 萤火：给星球加呼吸的光点
const FLIES = [];
function addFireflies(g, r, n, hex) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.8 });
    const fly = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), m);
    onSurface(fly, r + 0.5 + Math.random() * 1.3, (Math.random() - 0.4) * 2.2, Math.random() * Math.PI * 2);
    fly.userData.outline = true;
    g.add(fly);
    FLIES.push({ m, ph: Math.random() * 6 });
  }
}

// 简易小人：给星球居民用（坐/跪两种姿态）
function makeFigure(clothHex, pose) {
  const f = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.72, 9), mat(clothHex));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 9, 7), mat(0xd9c4a8));
  if (pose === 'sit') {
    body.position.y = 0.52; body.scale.y = 0.85;
    head.position.set(0, 1.0, 0.06);
    head.rotation.z = 0.2;                       // 微微侧头——倾听的姿态
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.5), mat(clothHex));
    legs.position.set(0, 0.16, 0.3);
    f.add(legs);
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.3, 8), mat(0x55606e));
    stone.position.y = 0.02;
    f.add(stone);
  } else { // kneel
    body.position.y = 0.42; body.rotation.x = 0.5; body.scale.y = 0.8;
    head.position.set(0, 0.86, 0.3);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), mat(clothHex));
    arm.position.set(0.16, 0.5, 0.5); arm.rotation.x = 1.2;
    f.add(arm);
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.24), mat(0xf0ead8));
    cloth.position.set(0.16, 0.03, 0.72);
    f.add(cloth);
  }
  f.add(body, head);
  return f;
}

// 拭星：她永远在擦她的星球。一半已经发亮，一半蒙着薄灰。擦不完，也不着急。
makePlanet({
  name: '拭星', poem: '擦不完，也不着急。', x: -72, y: -4, z: -98, r: 11, color: 0x6a6055,
  build(g, r) {
    // 已擦亮的半球（可随擦拭缓缓扩張）——擦过的地方是真的亮
    const bright = new THREE.Mesh(
      new THREE.SphereGeometry(r + 0.04, 26, 20, 0, Math.PI),
      mat(0xcfc4ae, { emissive: 0x3a3628, emissiveIntensity: 0.7 })
    );
    // 她干活的灯：一盏暖橙提灯立在交界线旁（这颗星的色彩身份）
    const lamp = new THREE.Group();
    const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.3, 6), mat(0x3d3830));
    lp.position.y = 0.65;
    const lh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffc98a }));
    lh.position.y = 1.42;
    const ll = new THREE.PointLight(0xffb066, 26, 20, 1.7);
    ll.position.y = 1.5;
    lamp.add(lp, lh, ll);
    onSurface(lamp, r, 0.12, -0.22);
    g.add(lamp);
    addFireflies(g, r, 5, 0xffd9a0);
    const wiped = Number(localStorage.getItem('yq-wipes') || 0);
    bright.rotation.y = Math.min(1.2, wiped * 0.025);   // 历史擦拭让亮界继续推进
    g.add(bright);
    g.userData.bright = bright;
    // 擦拭者跪在明暗交界线上（经度 0 的赤道处）
    const her = makeFigure(0x6e5a4a, 'kneel');
    onSurface(her, r, 0, 0.06);
    g.add(her);
    g.userData.inhabitant = her;
    // 几块她擦过的地方泛着光斑
    for (let i = 0; i < 6; i++) {
      const patch = new THREE.Mesh(new THREE.CircleGeometry(0.5 + Math.random() * 0.5, 10),
        mat(0xd9cfb8, { emissive: 0x4a4436, emissiveIntensity: 0.9 }));
      onSurface(patch, r + 0.06, (Math.random() - 0.5) * 1.8, Math.PI * 0.6 + Math.random() * 1.6);
      patch.rotateX(-Math.PI / 2);
      g.add(patch);
    }
  },
});
// 树星：无人荒星——没有居民，树自己住
makePlanet({
  name: '树星', poem: '没有居民，树自己住。', x: -165, y: 3, z: -58, r: 13, color: 0x577a4a,
  build(g, r) {
    // 满星的绿：大小林木铺开整个球面
    for (let i = 0; i < 14; i++) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 2.6, 7), mat(0x5c4327));
      trunk.position.y = 1.3;
      trunk.rotation.z = (Math.random() - 0.5) * 0.5;
      const crownHex = [0x6fa060, 0x84b072, 0x5f9455][(Math.random() * 3) | 0];
      const crown1 = new THREE.Mesh(new THREE.SphereGeometry(1.1, 9, 7), mat(crownHex));
      crown1.position.set(trunk.rotation.z * -2.2, 2.9, 0);
      crown1.scale.set(1.25, 0.6, 1.25);
      const crown2 = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), mat(0x8fbf7a));
      crown2.position.set(trunk.rotation.z * -2.2 + 0.5, 3.5, 0.3);
      crown2.scale.set(1.1, 0.55, 1.1);
      tree.add(trunk, crown1, crown2);
      const s = 0.55 + Math.random() * 0.85;
      tree.scale.setScalar(s);
      onSurface(tree, r, (Math.random() - 0.5) * 2.6, Math.random() * Math.PI * 2);
      g.add(tree);
    }
    for (let i = 0; i < 30; i++) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.55, 5), mat(0x6fa060));
      onSurface(tuft, r + 0.15, (Math.random() - 0.5) * 2.8, Math.random() * Math.PI * 2);
      g.add(tuft);
    }
    // 林间月色：淡绿的顶光 + 萤绿
    const gl = new THREE.PointLight(0xbfe8c0, 20, 30, 1.8);
    gl.position.set(0, r + 6, 0);
    g.add(gl);
    addFireflies(g, r, 8, 0xc8f0a8);
  },
});
// 井星：他坐在井边，一直在听。你可以把一句没说出口的话投进去。
makePlanet({
  name: '井星', poem: '他不说话，他都听见了。', x: -52, y: -1, z: 118, r: 9, color: 0x5e7a8a,
  build(g, r) {
    // 倾听者：坐在井旁，微微侧头
    const listener = makeFigure(0x3a4763, 'sit');
    onSurface(listener, r, Math.PI / 2 - 0.34, 0.4);
    g.add(listener);
    g.userData.inhabitant = listener;
    // 月光青的星：淡青顶光 + 沉过的话化成的萤光
    const ml = new THREE.PointLight(0x9fd8e8, 18, 26, 1.8);
    ml.position.set(0, r + 7, 0);
    g.add(ml);
    addFireflies(g, r, 7, 0xaef0ff);
    const well = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.8, 10, 1, true), mat(0x6b6455));
    ring.position.y = 0.4;
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.9, 12), new THREE.MeshBasicMaterial({ color: 0x8fd8e8 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.55;
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), mat(0x5c4327));
      post.position.set(sx * 0.95, 1.2, 0);
      well.add(post);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.7, 4), mat(0x5c4327));
    roof.position.y = 2.25;
    roof.rotation.y = Math.PI / 4;
    const wl = new THREE.PointLight(0x8fd8e8, 14, 16, 1.8);
    wl.position.y = 1;
    well.add(ring, water, roof, wl);
    onSurface(well, r, Math.PI / 2, 0);
    g.add(well);
    // 井里已沉着的话让水更亮（跨会话累积）
    const motes = Number(localStorage.getItem('yq-well-motes') || 0);
    wl.intensity = 14 + Math.min(30, motes * 1.5);
    water.material.color.offsetHSL(0, 0, Math.min(0.15, motes * 0.008));
    g.userData.wellLight = wl;
    g.userData.water = water;
    g.userData.wellWorld = () => {
      const v = new THREE.Vector3(0, r, 0);
      return g.localToWorld(v);
    };
    for (let i = 0; i < 10; i++) {
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + Math.random() * 0.25, 0), mat(0x55606e));
      onSurface(stone, r + 0.05, (Math.random() - 0.5) * 2.4, Math.random() * Math.PI * 2);
      g.add(stone);
    }
  },
});

// 海星：全世界都是夜晚，只有这里永远是上午十点。
const FOAMS = [];
makePlanet({
  name: '海星', poem: '想念的地方，永远是晴天。', x: -128, y: 5, z: 162, r: 14, color: 0xf2e8cf,
  sea: true, seaLatEdge: 0.62,
  build(g, r) {
    // 基球=白沙（MeshBasic 不吃夜光——永远晴天），赤道海带=蹭蹭蓝
    g.children[0].material = new THREE.MeshBasicMaterial({ color: 0xf2e8cf });
    g.children[0].userData.outline = true; // 白天的星球不描墨线
    const sea = new THREE.Mesh(
      new THREE.SphereGeometry(r + 0.14, 32, 22, 0, Math.PI * 2, 0.95, Math.PI - 1.9),
      new THREE.MeshBasicMaterial({ color: 0x2fa8d8, transparent: true, opacity: 0.88 })
    );
    sea.userData.outline = true;
    g.add(sea);
    // 岸线浪花：两圈白沫在海陆交界呼吸
    for (const th of [0.95, Math.PI - 0.95]) {
      const foam = new THREE.Mesh(
        new THREE.TorusGeometry((r + 0.16) * Math.sin(th), 0.09, 6, 48),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
      );
      foam.rotation.x = Math.PI / 2;
      foam.position.y = (r + 0.16) * Math.cos(th);
      foam.userData.outline = true;
      foam.userData.ph = th;
      g.add(foam);
      FOAMS.push(foam);
    }
    // 这颗星自己的太阳
    const sunGlow = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20), new THREE.MeshBasicMaterial({ color: 0xfff3d0, fog: false }));
    sunGlow.position.set(6, r + 16, -4);
    sunGlow.userData.outline = true;
    g.add(sunGlow);
    const dayLight = new THREE.PointLight(0xfff2dd, 90, 70, 1.6);
    dayLight.position.set(4, r + 14, -3);
    g.add(dayLight);
    // 几把遮阳伞级别的细节：两只海星、一串脚印石
    for (let i = 0; i < 4; i++) {
      const star5 = new THREE.Mesh(new THREE.CircleGeometry(0.28, 5), new THREE.MeshBasicMaterial({ color: 0xe88d5a }));
      onSurface(star5, r + 0.03, 0.75 + Math.random() * 0.35, Math.random() * Math.PI * 2);
      star5.rotateX(-Math.PI / 2);
      g.add(star5);
    }
  },
});
// 玩家踏浪的脚边浪圈（共享一只，进水即现）
const wadeFoam = new THREE.Mesh(
  new THREE.TorusGeometry(0.55, 0.05, 6, 20),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
);
wadeFoam.visible = false;
scene.add(wadeFoam);

// 居民正式模型：替换占位小人（保留原位姿态）
{
  const swapInhabitant = (planetName, file) => {
    new GLTFLoader().load(`/models/${file}`, (g) => {
      const P = PLANETS.find(p => p.name === planetName);
      const old = P?.group.userData.inhabitant;
      if (!old) return;
      g.scene.traverse(o => { if (o.isMesh) o.castShadow = true; });
      toonify(g.scene);
      addOutline(g.scene, 1.03);
      g.scene.position.copy(old.position);
      g.scene.quaternion.copy(old.quaternion);
      P.group.remove(old);
      P.group.add(g.scene);
      P.group.userData.inhabitant = g.scene;
    }, undefined, () => {});
  };
  swapInhabitant('井星', 'listener.glb');
  swapInhabitant('拭星', 'wiper.glb');
}

// ---------- 对话：与居民碰面，点击对方听这颗星的故事 ----------
const STORY = {
  '井星': { name: '倾 听 者', lines: [
    '你也带着没说出口的话吧。',
    '在这里，话不用说给谁听。投进井里就好。',
    '我坐在这儿，替井听着。每一句沉下去的话，都会变成一点光。',
    '水一年比一年亮。你看——都还在，一句也没丢。',
  ]},
  '拭星': { name: '擦 拭 者', lines: [
    '这颗星，我擦了很多年了。',
    '总有人问：擦完那天，你打算做什么？',
    '擦不完的。灰会再落下来，亮过的会再蒙上。',
    '可你看擦过的地方——星光落在上面，会多停一会儿。',
    '这就够了。不急，我们慢慢擦。',
  ]},
};
const dlgState = { open: false, planet: null, idx: 0 };
const dlgEl = document.getElementById('dlg');
const dlgName = document.getElementById('dlg-name');
const dlgText = document.getElementById('dlg-text');
function openDialogue(P) {
  const s = STORY[P.name];
  if (!s) return;
  dlgState.open = true;
  dlgState.planet = P;
  dlgState.idx = 0;
  dlgName.textContent = s.name + ' · ' + P.name;
  dlgText.textContent = s.lines[0];
  dlgEl.style.display = 'block';
}
function advanceDialogue() {
  const s = STORY[dlgState.planet?.name];
  if (!s) return closeDialogue();
  dlgState.idx++;
  if (dlgState.idx >= s.lines.length) return closeDialogue();
  dlgText.textContent = s.lines[dlgState.idx];
}
function closeDialogue() {
  dlgState.open = false;
  dlgEl.style.display = 'none';
}
dlgEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); advanceDialogue(); });
// 点击居民 → 开始对话（球面上、离得近才有效）
const raycaster = new THREE.Raycaster();
const pointerV = new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (dlgState.open || state.mode !== 'planet') return;
  const inh = state.planet?.group.userData.inhabitant;
  if (!inh) return;
  const wp = new THREE.Vector3();
  inh.getWorldPosition(wp);
  if (player.position.distanceTo(wp) > 6) return;
  pointerV.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointerV, camera);
  if (raycaster.intersectObject(inh, true).length) openDialogue(state.planet);
});

// 投进井里的话（光点飞行中）
const MOTES = [];
let hintShown = {};
function planetInteract() {
  const P = state.planet;
  if (!P) return;
  if (P.name === '井星') {
    const wellPos = P.group.userData.wellWorld();
    if (player.position.distanceTo(wellPos) < 5) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0xbfe8f2 }));
      m.position.copy(player.position).addScaledVector(state.pRadial, 1.2);
      scene.add(m);
      MOTES.push({ mesh: m, from: m.position.clone(), to: wellPos.clone(), t: 0, planet: P });
      toast('一句话，沉进井里', 2000);
    }
  } else if (P.name === '拭星') {
    const n = Number(localStorage.getItem('yq-wipes') || 0) + 1;
    localStorage.setItem('yq-wipes', String(n));
    P.group.userData.bright.rotation.y = Math.min(1.2, n * 0.025);
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.55, 10),
      mat(0x9a938a, { emissive: 0x2a2f38, emissiveIntensity: 0.8 }));
    const local = P.group.worldToLocal(player.position.clone()).normalize();
    patch.position.copy(local.clone().multiplyScalar(P.r + 0.06));
    patch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), local);
    P.group.add(patch);
    toast('亮了一块', 1400);
  }
}

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
  mode: 'walk',            // walk | glide | planet
  pad: PADS[0],
  planet: null,
  planetGrace: null,
  pRadial: new THREE.Vector3(0, 1, 0),
  pHeading: new THREE.Vector3(0, 0, 1),
  yaw: Math.PI,            // 面向 -z? 起飞方向由行走朝向决定
  pitch: 0,
  speed: 0,
  toastTimer: 0,
};
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (dlgState.open) {
    if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') advanceDialogue();
    return;
  }
  if (e.code === 'Space' && state.mode === 'walk') launch();
  else if (e.code === 'Space' && state.mode === 'planet') planetLaunch();
  else if (e.code === 'KeyE' && state.mode === 'planet') planetInteract();
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
  state.planet = null;
  state.planetGrace = null;
  player.position.set(2, 0, 2);
  player.rotation.set(0, Math.PI, 0);
  player.quaternion.setFromEuler(player.rotation);
  camera.up.set(0, 1, 0);
  camera.fov = CFG.cam.fov;
  camera.updateProjectionMatrix();
}

function planetLaunch() {
  const h = state.pHeading, rad = state.pRadial;
  state.mode = 'glide';
  state.yaw = Math.atan2(h.x, h.z);
  state.pitch = 0.18;
  state.speed = G.launchSpeed;
  state.launchGrace = null;
  state.planetGrace = state.planet;   // 飞出本星引力边界前不再被它捕获
  player.position.addScaledVector(rad, 1.6);
  state.planet = null;
  wadeFoam.visible = false;
  camera.up.set(0, 1, 0);
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
  if (window.__frozen) { requestAnimationFrame(tick); return; } // demo 帧步进时由外部驱动
  const k = 1 - Math.exp(-5 * dt);

  if (state.mode === 'walk') {
    // 甲板相机在 +z 后方朝 -z 看：屏幕上 = -z、屏幕右 = +x（2026-09-06 校准，此前两轴皆反）
    dir.set(
      (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0),
      0,
      (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0)
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
  } else if (state.mode === 'planet') {
    // ---- 球面行走（小星球引力：脚下即大地） ----
    const P = state.planet;
    const rad = state.pRadial, h = state.pHeading;
    const turn = dlgState.open ? 0 : (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0);
    if (turn) h.applyAxisAngle(rad, turn * 2.2 * dt).normalize();
    const fwdIn = dlgState.open ? 0 : (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
    if (fwdIn) {
      const axis = new THREE.Vector3().crossVectors(rad, h).normalize();
      const ang = fwdIn * (CFG.playerSpeed * dt) / P.r;
      rad.applyAxisAngle(axis, ang).normalize();
      h.applyAxisAngle(axis, ang).normalize();     // 平行输运，保持切向
    }
    player.position.copy(P.center).addScaledVector(rad, P.r);
    const xA = new THREE.Vector3().crossVectors(rad, h).normalize();
    player.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, rad, h));
    if (wing) wing.visible = false;
    // 海星踏浪：走进海带即起浪圈
    if (P.sea) {
      const lat = Math.asin(THREE.MathUtils.clamp(rad.y, -1, 1));
      const inSea = Math.abs(lat) < (Math.PI / 2 - 0.95);
      wadeFoam.visible = inSea;
      if (inSea) {
        wadeFoam.position.copy(player.position).addScaledVector(rad, 0.08);
        wadeFoam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), rad);
        const ws = 1 + Math.sin(elapsed * 5) * 0.15;
        wadeFoam.scale.set(ws, ws, 1);
        if (!hintShown.wade) { hintShown.wade = true; toast('踏浪', 1800); }
      }
    } else wadeFoam.visible = false;
    // 球面相机：沿径向抬起、退到身后，up=径向
    const camT = player.position.clone().addScaledVector(rad, 4.2).addScaledVector(h, -7.5);
    camera.position.lerp(camT, k);
    camera.up.copy(rad);
    camera.lookAt(player.position.clone().addScaledVector(rad, 1.2).addScaledVector(h, 2.5));
    if (camera.fov !== CFG.cam.fov) {
      camera.fov += (CFG.cam.fov - camera.fov) * k;
      camera.updateProjectionMatrix();
    }
  } else {
    // ---- 滑翔 ----
    // WASD 走飞行惯例（W俯冲），方向键走直觉惯例（↓俯冲 ↑拉升），两套并存
    state.yaw += ((keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0)) * G.yawRate * dt;
    state.pitch += ((keys['KeyS'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyW'] || keys['ArrowDown'] ? 1 : 0)) * G.pitchRate * dt;
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

    // 引力辅助：近星时航向被轻轻拉向星心（降落不再考验准头）
    {
      let pull = null, pd = 1e9;
      for (const P of PLANETS) {
        if (P === state.planetGrace) continue;
        const d = player.position.distanceTo(P.center);
        if (d < P.r + 10 && d < pd) { pd = d; pull = P; }
      }
      if (pull) {
        const to = pull.center.clone().sub(player.position).normalize();
        const tYaw = Math.atan2(to.x, to.z);
        let dy2 = tYaw - state.yaw;
        if (dy2 > Math.PI) dy2 -= 2 * Math.PI;
        if (dy2 < -Math.PI) dy2 += 2 * Math.PI;
        state.yaw += dy2 * Math.min(1, 1.6 * dt);
        const tPitch = Math.asin(THREE.MathUtils.clamp(to.y, -1, 1));
        state.pitch += (tPitch - state.pitch) * Math.min(1, 1.6 * dt);
      }
    }

    // 星球捕获：靠近即降落（引力井）
    for (const P of PLANETS) {
      if (P === state.planetGrace) {
        if (player.position.distanceTo(P.center) > P.r + 6) state.planetGrace = null;
        continue;
      }
      const dP = player.position.distanceTo(P.center);
      if (dP < P.r + 1.4) {
        state.mode = 'planet';
        state.planet = P;
        state.pRadial.copy(player.position).sub(P.center).normalize();
        fwd.set(Math.sin(state.yaw), 0, Math.cos(state.yaw));
        state.pHeading.copy(fwd).addScaledVector(state.pRadial, -fwd.dot(state.pRadial));
        if (state.pHeading.lengthSq() < 0.05) state.pHeading.set(1, 0, 0).addScaledVector(state.pRadial, -state.pRadial.x);
        state.pHeading.normalize();
        player.rotation.z = 0;
        if (wing) wing.visible = false;
        toast(P.poem || P.name, 3000);
        if (!hintShown[P.name]) {
          hintShown[P.name] = true;
          if (P.name === '井星') setTimeout(() => toast('E · 把一句没说出口的话投进井里', 2600), 3300);
          if (P.name === '拭星') setTimeout(() => toast('E · 帮她擦一块', 2200), 3300);
        }
        break;
      }
    }
    if (state.mode !== 'glide') { composer.render(); requestAnimationFrame(tick); return; }

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
      camera.up.set(0, 1, 0);
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

  ambientUpdate(dt);
  composer.render();
  requestAnimationFrame(tick);
}

// 氛围层统一步进（tick 与 demo 帧步进共用）
function ambientUpdate(dt) {
  elapsed += dt;
  // 云缓漂
  for (const sp of cloudSprites) {
    sp.position.x = sp.userData.baseX + Math.sin(elapsed * 0.015 + sp.userData.ph) * 4;
  }
  // 沉井的话（光点弧线飞向井口）
  for (let i = MOTES.length - 1; i >= 0; i--) {
    const M = MOTES[i];
    M.t += dt / 1.4;
    const u = Math.min(1, M.t);
    M.mesh.position.lerpVectors(M.from, M.to, u);
    M.mesh.position.addScaledVector(state.pRadial, Math.sin(u * Math.PI) * 1.6);
    if (u >= 1) {
      scene.remove(M.mesh);
      MOTES.splice(i, 1);
      const n = Number(localStorage.getItem('yq-well-motes') || 0) + 1;
      localStorage.setItem('yq-well-motes', String(n));
      const ud = M.planet.group.userData;
      ud.wellLight.intensity = 14 + Math.min(30, n * 1.5);
      ud.water.material.color.offsetHSL(0, 0, 0.006);
    }
  }
  // 萤火呼吸
  for (const f of FLIES) f.m.opacity = 0.45 + 0.4 * Math.sin(elapsed * 2 + f.ph);
  // 海星岸浪呼吸
  for (const f of FOAMS) {
    const s = 1 + Math.sin(elapsed * 0.9 + f.userData.ph) * 0.012;
    f.scale.set(s, s, 1);
    f.material.opacity = 0.5 + Math.sin(elapsed * 0.9 + f.userData.ph) * 0.25;
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

window.__yunque = { player, camera, scene, renderer, composer, state, PADS, PLANETS, UPDRAFT, traffic, resetTraffic, creatures, spawnLev };
// demo 帧步进钩子（__frozen=true 后由录制脚本逐帧驱动）
window.__demo = {
  ambient: (dt) => ambientUpdate(dt),
  render: () => composer.render(),
  elapsed: () => elapsed,
  setWing: (v) => { if (wing) wing.visible = v; },
  hasWing: () => !!wing,
};
tick();
