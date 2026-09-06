// 云阙 demo 录制 — 分流A·3D 帧步进（30fps × 24s = 720 帧, 1600x900@DSF2 超采样）
// 分镜: 0-4.6 甲板环拍 / 4.6-19.2 滑翔航线(贴云会鲸→气流爬升→掠过巨鸟塔→落塔A) / 19.2-24 落台拉远收官
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const PW = '/Users/jada/.nvm/versions/node/v22.17.1/lib/node_modules/@playwright/mcp/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);

const OUT = '/Users/jada/Desktop/Projects/yunque/demo-frames2';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
         '--disable-renderer-backgrounding', '--hide-scrollbars', '--mute-audio',
         '--window-position=2600,2600'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERR', e.message));
await page.goto('http://localhost:3032/', { waitUntil: 'networkidle' });

// 等全部资产就位（模型 + 生灵 + 航船）
await page.waitForFunction(() =>
  window.__demo && window.__demo.hasWing() &&
  window.__yunque.creatures.lev && window.__yunque.creatures.roc &&
  window.__yunque.creatures.crew.length === 3 && window.__yunque.traffic.length === 3,
  null, { timeout: 60000 });
await page.waitForTimeout(4000); // 塔群/天舟等无旗标资产的余量

// 冻结游戏循环，注入驱动函数
await page.evaluate(() => {
  window.__frozen = true;
  const Y = window.__yunque, D = window.__demo;

  // ---- 非均匀 Catmull-Rom（有限差分切线的 Hermite）----
  const W = [ // [t, x, y, z] 四星巡礼:拭星→树星→井星→海星
    [4.2, -8.5, 0.6, 0.5], [5.4, -20, 2.0, -2], [7.0, -36, -1, -22],
    [9.0, -52, -3, -55], [10.8, -60, -4, -84],
    [11.8, -58, -2, -91], [13.2, -73, -1, -114], [14.6, -87, 1, -104],   // 绕拭星
    [16.5, -115, 3, -80], [18.3, -142, 4, -64],
    [19.6, -150, 5, -71], [21.0, -164, 8, -42], [22.4, -180, 5, -62],    // 绕树星
    [24.5, -150, 2, -20], [26.5, -100, 0, 40], [28.3, -63, -1, 96],
    [29.3, -42, 6, 110], [30.7, -50, 8.5, 131], [32.0, -64, 6.5, 122],   // 绕井星(高绕看井口)
    [34.0, -95, 2, 138], [36.0, -117, 4, 150], [37.6, -125, 9, 152],
    [38.6, -122.6, 14.7, 153.4],                                          // 触地前
  ];
  function pathAt(t) {
    t = Math.max(W[0][0], Math.min(W[W.length - 1][0], t));
    let i = 0;
    while (i < W.length - 2 && t > W[i + 1][0]) i++;
    const [t0, ...p0] = W[Math.max(0, i - 1)], [t1, ...p1] = W[i], [t2, ...p2] = W[i + 1], [t3, ...p3] = W[Math.min(W.length - 1, i + 2)];
    const h = t2 - t1, u = (t - t1) / h;
    const out = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const m1 = (p2[k] - p0[k]) / (t2 - t0) * h;
      const m2 = (p3[k] - p1[k]) / (t3 - t1) * h;
      const u2 = u * u, u3 = u2 * u;
      out[k] = (2 * u3 - 3 * u2 + 1) * p1[k] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[k] + (u3 - u2) * m2;
    }
    return out;
  }
  const sm = (a, b, t) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
  const V3 = window.__yunque.player.position.constructor;
  // 海星落点(白沙,朝海)
  const SEA = Y.PLANETS.find(p => p.name === '海星');
  const landDir = new V3(0.35, 0.62, -0.55).normalize();
  const landPos = SEA.center.clone().addScaledVector(landDir, SEA.r);
  const landFwd = (() => {  // 朝赤道下坡 = 面朝海
    const f = new V3(0, -1, 0);
    f.addScaledVector(landDir, -f.dot(landDir));
    return f.normalize();
  })();

  let lastYaw = null;
  window.__demoFrame = (t, dt) => {
    D.ambient(dt);
    const cam = Y.camera, pl = Y.player;
    let fov = 55;
    if (t < 4.2) {
      pl.position.set(-8.5, 0, 0.5);
      pl.rotation.set(0, -Math.PI / 2, 0);
      pl.quaternion.setFromEuler(pl.rotation);
      D.setWing(false);
      const a = -0.75 + (t / 4.2) * 1.45;
      cam.position.set(-8.5 + Math.cos(a) * 7.4, 3.1, 0.5 + Math.sin(a) * 7.4);
      cam.up.set(0, 1, 0);
      cam.lookAt(-15.5, 1.6, 0.5);
    } else if (t < 38.6) {
      const p = pathAt(t), pn = pathAt(t + 0.12);
      const tan = [pn[0] - p[0], pn[1] - p[1], pn[2] - p[2]];
      const len = Math.hypot(...tan) || 1;
      const T = tan.map(v => v / len);
      pl.position.set(p[0], p[1], p[2]);
      const yaw = Math.atan2(T[0], T[2]);
      let dy = lastYaw === null ? 0 : yaw - lastYaw;
      if (dy > Math.PI) dy -= 2 * Math.PI;
      if (dy < -Math.PI) dy += 2 * Math.PI;
      lastYaw = yaw;
      const bank = Math.max(-0.55, Math.min(0.55, -dy / dt * 0.55));
      const pitch = Math.asin(Math.max(-1, Math.min(1, T[1])));
      pl.rotation.set(-pitch * 0.8 + 0.5 * sm(4.5, 5.2, t), yaw, bank * sm(4.8, 5.6, t));
      pl.quaternion.setFromEuler(pl.rotation);
      D.setWing(t > 4.5);
      const chase = [p[0] - T[0] * 8.5, p[1] + 2.8, p[2] - T[2] * 8.5];
      const b = sm(4.2, 5.8, t);
      const orbA = -0.75 + 1.45, orb = [-8.5 + Math.cos(orbA) * 7.4, 3.1, 0.5 + Math.sin(orbA) * 7.4];
      cam.position.set(
        orb[0] + (chase[0] - orb[0]) * b,
        orb[1] + (chase[1] - orb[1]) * b,
        orb[2] + (chase[2] - orb[2]) * b
      );
      cam.up.set(0, 1, 0);
      cam.lookAt(p[0] + T[0] * 7, p[1] + T[1] * 5, p[2] + T[2] * 7);
      fov = 55 + 9 * sm(5.8, 7.5, t) - 9 * sm(36.5, 38.6, t);
    } else {
      // 海星白昼沙滩收尾:站定,镜头从身后缓缓转到侧前
      pl.position.copy(landPos);
      const xA = landDir.clone().cross(landFwd).normalize();
      const m = new (Y.camera.matrix.constructor)().makeBasis(xA, landDir, landFwd);
      pl.quaternion.setFromRotationMatrix(m);
      D.setWing(t < 38.9);
      const u = sm(38.6, 42, t);
      const ang = -0.4 + u * 1.5;
      const camP = landPos.clone()
        .addScaledVector(landDir, 2.1 + u * 0.9)
        .addScaledVector(landFwd, Math.cos(ang) * -6.5)
        .addScaledVector(xA, Math.sin(ang) * 6.5);
      cam.position.copy(camP);
      cam.up.copy(landDir);
      cam.lookAt(landPos.clone().addScaledVector(landDir, 0.8).addScaledVector(landFwd, 3.0)); // 视线越过他望向海
      fov = 50;
    }
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    D.render();
    return Y.renderer.domElement.toDataURL('image/jpeg', 0.92);
  };
});

// 摆演员:云鲸 t26 破云于航线旁、两条航船、双鸟群
const e0 = await page.evaluate(() => window.__demo.elapsed());
await page.evaluate(([e0]) => {
  const Y = window.__yunque;
  Y.spawnLev();
  const L = Y.creatures.levState;
  Y.creatures.lev.position.set(-85, -28, 209);
  L.vel.set(0, 0, -6.5);
  L.phase = Math.PI / 2 - (e0 + 26) * 0.25;
  Y.creatures.lev.scale.setScalar(1.15);
  Y.creatures.lev.rotation.y = Math.atan2(-1, 0);
  const T = Y.traffic;
  T[0].wait = 0; T[0].obj.visible = true; T[0].obj.position.set(-220, 12, -280);
  T[0].vel.set(0, 0, 11); T[0].baseY = 12; T[0].obj.scale.setScalar(0.9);
  T[0].obj.rotation.y = Math.atan2(1, 0); T[0].phase = 0;
  T[1].wait = 0; T[1].obj.visible = true; T[1].obj.position.set(-395, 3, 135);
  T[1].vel.set(10, 0, 0); T[1].baseY = 3; T[1].obj.scale.setScalar(1.05);
  T[1].obj.rotation.y = Math.atan2(0, -10) === 0 ? Math.PI : Math.PI; T[1].phase = 2;
  T[1].obj.rotation.y = Math.atan2(0, -1) ; // 船艏(-X)对 +x 航向
  T[2].wait = 9999;
  const F = Y.creatures.flocks;
  F[0].wait = 0; F[0].g.visible = true; F[0].g.position.set(-42, 8, 55);
  F[0].vel.set(0.8, 0, -6.5); F[0].g.rotation.y = Math.atan2(0.8, -6.5);
  F[1].wait = 30; // 后段自然出场
}, [e0]);

// 逐帧录制
const FPS = 30, DUR = 42, N = FPS * DUR;
console.log('recording', N, 'frames...');
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const dataURL = await page.evaluate(([t, dt]) => window.__demoFrame(t, dt), [i / FPS, 1 / FPS]);
  fs.writeFileSync(path.join(OUT, `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(dataURL.split(',')[1], 'base64'));
  if (i % 120 === 0) console.log(`frame ${i}/${N} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
console.log('done in', ((Date.now() - t0) / 1000).toFixed(0), 's');
await browser.close();
