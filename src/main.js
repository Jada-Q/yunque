// 云阙 — Phase 1 灰盒 vista
// 目标只有一个：验证"站在万米高空悬挑平台上"的体感。成败在相机、雾、尺度，不在模型。
import * as THREE from 'three';

const CFG = {
  playerSpeed: 4.0,
  cam: { offset: [3.5, 3.6, 9.5], fov: 55, lookAhead: [-7, 0.2, -15] },
  platform: { x0: -7, x1: 8, z0: -8, z1: 8 },   // 可行走范围（x1 侧连巨构墙）
  cloudY: -26,
  night: 0x0d1526,
};

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(CFG.night);
scene.fog = new THREE.Fog(0x18243c, 60, 320);

const camera = new THREE.PerspectiveCamera(CFG.cam.fov, innerWidth / innerHeight, 0.1, 1200);

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
  const layer = (y, color, op, size) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color, transparent: true, opacity: op }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    scene.add(m);
    return m;
  };
  layer(CFG.cloudY - 2, 0xe8ecf2, 1.0, 1600);
  layer(CFG.cloudY - 8, 0xb8c2d2, 1.0, 1600);
  // 云团两波：近处大团（深度锚）+ 远处成脊的云山（月光下发亮）
  const lumpMat = mat(0xeef1f6, { emissive: 0x3a4560, emissiveIntensity: 0.35 });
  const addLump = (x, z, r, squash) => {
    const lump = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), lumpMat);
    lump.position.set(x, CFG.cloudY + r * squash * 0.55, z);
    lump.scale.y = squash;
    scene.add(lump);
  };
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 22 + Math.random() * 130;
    addLump(Math.cos(a) * d - 10, Math.sin(a) * d, 6 + Math.random() * 18, 0.22 + Math.random() * 0.14);
  }
  // 远处云脊：一长串大团连成山脉线
  for (let i = 0; i < 14; i++) {
    addLump(-120 - Math.random() * 240, -200 + i * 32 + Math.random() * 18, 24 + Math.random() * 30, 0.3);
  }
}

// ---------- 巨构墙（右侧，x>+8，从云下伸到头顶） ----------
{
  const wallMat = mat(0x5c4433);
  const darkMat = mat(0x3d3028);
  // 主体板块
  for (let i = 0; i < 34; i++) {
    const w = 6 + Math.random() * 14, h = 10 + Math.random() * 26, d = 8 + Math.random() * 22;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), Math.random() < 0.5 ? wallMat : darkMat);
    b.position.set(12 + Math.random() * 14, -70 + Math.random() * 160, -110 + Math.random() * 220);
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
  for (let i = 0; i < 90; i++) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.1), winMat);
    win.position.set(9.6 + Math.random() * 3, -50 + Math.random() * 110, -100 + Math.random() * 200);
    win.rotation.y = Math.PI / 2;
    scene.add(win);
  }
}

// ---------- 悬挑平台（玩家站的地方） ----------
{
  const deck = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, 17), mat(0x7a5a40));
  deck.position.set(0.5, -0.4, 0);
  deck.receiveShadow = true;
  scene.add(deck);
  // 斜撑
  for (const dz of [-6, 0, 6]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 14), mat(0x4a3a2c));
    strut.position.set(3, -4.5, dz);
    strut.rotation.z = 0.62;
    scene.add(strut);
  }
  // 栏杆
  const railMat = mat(0x3d3028);
  for (let x = -7; x <= 8; x += 1.5) {
    for (const z of [-8, 8]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), railMat);
      p.position.set(x, 0.55, z);
      scene.add(p);
    }
  }
  for (let z = -8; z <= 8; z += 1.5) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), railMat);
    p.position.set(-7, 0.55, z);
    scene.add(p);
  }
  const railTop = (w, x, z, ry) => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, 0.09), railMat);
    r.position.set(x, 1.1, z); r.rotation.y = ry;
    scene.add(r);
  };
  railTop(15.5, 0.5, -8, 0); railTop(15.5, 0.5, 8, 0); railTop(16.5, -7, 0, Math.PI / 2);
}

// ---------- 远处浮塔群 ----------
{
  const towerMat = mat(0x46506a);
  const towerLit = new THREE.MeshBasicMaterial({ color: 0x9fb4d8 });
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const H = 40 + Math.random() * 70;
    let y = 0;
    while (y < H) {
      const s = 2 + Math.random() * 5;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(s, 4 + Math.random() * 9, s), towerMat);
      seg.position.y = y;
      g.add(seg);
      if (Math.random() < 0.35) {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(s * 1.6, s * 1.6, 0.8, 10), towerMat);
        disc.position.y = y + 2;
        g.add(disc);
      }
      y += 5 + Math.random() * 8;
    }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.6, 6, 6), towerLit);
    tip.position.y = H + 3;
    g.add(tip);
    // 塔基起于云线之下，塔身立在云海之上（参考图里塔群与云的关系）
    g.position.set(-55 - Math.random() * 130, CFG.cloudY + 2 + Math.random() * 6, -140 + Math.random() * 280);
    scene.add(g);
  }
}

// ---------- 玩家 ----------
const player = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 4, 12), mat(0xd8d2c0));
  body.position.y = 0.8;
  body.castShadow = true;
  player.add(body);
}
player.position.set(2, 0, 2);
scene.add(player);

// ---------- 输入与主循环 ----------
const keys = {};
addEventListener('keydown', e => keys[e.code] = true);
addEventListener('keyup', e => keys[e.code] = false);

const clock = new THREE.Clock();
const dir = new THREE.Vector3();
camera.position.set(player.position.x + CFG.cam.offset[0], CFG.cam.offset[1], player.position.z + CFG.cam.offset[2]);

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  dir.set(
    (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0),
    0,
    (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0)
  );
  // 相机在 +z 后方看 -z 向：屏幕上 = -z，屏幕左 = +x？——灰盒期先用世界轴，体感期校准
  if (dir.lengthSq() > 0) {
    dir.normalize().multiplyScalar(CFG.playerSpeed * dt);
    player.position.add(dir);
    player.rotation.y = Math.atan2(dir.x, dir.z);
  }
  const P = CFG.platform;
  player.position.x = THREE.MathUtils.clamp(player.position.x, P.x0 + 0.5, P.x1 - 0.5);
  player.position.z = THREE.MathUtils.clamp(player.position.z, P.z0 + 0.5, P.z1 - 0.5);

  const k = 1 - Math.exp(-5 * dt);
  camera.position.lerp(new THREE.Vector3(
    player.position.x + CFG.cam.offset[0],
    CFG.cam.offset[1],
    player.position.z + CFG.cam.offset[2]
  ), k);
  camera.lookAt(
    player.position.x + CFG.cam.lookAhead[0],
    CFG.cam.lookAhead[1],
    player.position.z + CFG.cam.lookAhead[2]
  );

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

window.__yunque = { player, camera, scene, renderer };
tick();
