// 云阙 demo 录制 — 分流A·3D 帧步进（30fps × 24s = 720 帧, 1600x900@DSF2 超采样）
// 分镜: 0-4.6 甲板环拍 / 4.6-19.2 滑翔航线(贴云会鲸→气流爬升→掠过巨鸟塔→落塔A) / 19.2-24 落台拉远收官
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const PW = '/Users/jada/.nvm/versions/node/v22.17.1/lib/node_modules/@playwright/mcp/node_modules/playwright/index.mjs';
const { chromium } = await import(PW);

const OUT = '/Users/jada/Desktop/Projects/yunque/demo-frames';
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
  const W = [ // [t, x, y, z]
    [4.6, -8.5, 0.6, 0.5], [5.6, -20, 2.4, 2], [7.5, -38, -5, 14],
    [10, -62, -11, 42], [11.5, -84, -12, 58], [13, -108, -7, 40],
    [14.5, -112, 1, 12], [15.8, -117, 13, -6], [17, -108, 7, -20],
    [18.2, -93, -1.5, -27], [19.2, -85, -3.6, -30],
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

  let lastYaw = null;
  window.__demoFrame = (t, dt) => {
    D.ambient(dt);
    const cam = Y.camera, pl = Y.player;
    let fov = 55;
    if (t < 4.6) {
      // 甲板环拍：行者立于船艏
      pl.position.set(-8.5, 0, 0.5);
      pl.rotation.set(0, -Math.PI / 2, 0);
      D.setWing(false);
      const a = -0.75 + (t / 4.6) * 1.45;
      cam.position.set(-8.5 + Math.cos(a) * 7.4, 3.1, 0.5 + Math.sin(a) * 7.4);
      cam.lookAt(-15.5, 1.6, 0.5);
    } else if (t < 19.2) {
      // 滑翔
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
      pl.rotation.set(-pitch * 0.8 + 0.5 * sm(4.9, 5.6, t), yaw, bank * sm(5.2, 6, t));
      D.setWing(t > 4.9);
      // 追飞机位（起跳段从环拍机位平滑接管）
      const chase = [p[0] - T[0] * 8.5, p[1] + 2.8, p[2] - T[2] * 8.5];
      const b = sm(4.6, 6.0, t);
      const orbA = -0.75 + 1.45, orb = [-8.5 + Math.cos(orbA) * 6.8, 2.3, 0.5 + Math.sin(orbA) * 6.8];
      cam.position.set(
        orb[0] + (chase[0] - orb[0]) * b,
        orb[1] + (chase[1] - orb[1]) * b,
        orb[2] + (chase[2] - orb[2]) * b
      );
      cam.lookAt(p[0] + T[0] * 7, p[1] + T[1] * 5, p[2] + T[2] * 7);
      fov = 55 + 9 * sm(6, 8, t) - 7 * sm(17.5, 19.2, t);
    } else {
      // 落台收官：拉远看塔群与过路船
      pl.position.set(-85, -4, -30);
      pl.rotation.set(0, lastYaw ?? 0, 0);
      D.setWing(t < 19.55);
      const b = sm(19.2, 21.8, t);
      const from = [-85 + 8, -4 + 2.8, -30 + 6], to = [-46, 7, -6];
      cam.position.set(
        from[0] + (to[0] - from[0]) * b,
        from[1] + (to[1] - from[1]) * b,
        from[2] + (to[2] - from[2]) * b
      );
      cam.lookAt(-88, 0, -32);
      fov = 55;
    }
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    D.render();
    return Y.renderer.domElement.toDataURL('image/jpeg', 0.92);
  };
});

// 摆演员：云鲸破云对准 t≈11、两条航船入镜、鸟群一队掠过甲板段
const e0 = await page.evaluate(() => window.__demo.elapsed());
await page.evaluate(([e0]) => {
  const Y = window.__yunque;
  Y.spawnLev();
  const L = Y.creatures.levState;
  Y.creatures.lev.position.set(-58, -28, 118);
  L.vel.set(0, 0, -6.2);
  L.phase = Math.PI / 2 - (e0 + 8) * 0.25;   // sin 峰值 = t11 破云
  Y.creatures.lev.scale.setScalar(1.15);
  Y.creatures.lev.rotation.y = Math.atan2(-1, 0);
  const T = Y.traffic;
  T[0].wait = 0; T[0].obj.visible = true; T[0].obj.position.set(-150, 16, -240);
  T[0].vel.set(0, 0, 12); T[0].baseY = 16; T[0].obj.scale.setScalar(0.9);
  T[0].obj.rotation.y = Math.atan2(1, 0); T[0].phase = 0;
  T[1].wait = 0; T[1].obj.visible = true; T[1].obj.position.set(-250, 0, 150);
  T[1].vel.set(0, 0, -10); T[1].baseY = 0; T[1].obj.scale.setScalar(1.1);
  T[1].obj.rotation.y = Math.atan2(-1, 0); T[1].phase = 2;
  T[2].wait = 9999;
  const F = Y.creatures.flocks;
  F[0].wait = 0; F[0].g.visible = true; F[0].g.position.set(-42, 8, 55);
  F[0].vel.set(0.8, 0, -6.5); F[0].g.rotation.y = Math.atan2(0.8, -6.5);
  F[1].wait = 8;
}, [e0]);

// 逐帧录制
const FPS = 30, DUR = 24, N = FPS * DUR;
console.log('recording', N, 'frames...');
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const dataURL = await page.evaluate(([t, dt]) => window.__demoFrame(t, dt), [i / FPS, 1 / FPS]);
  fs.writeFileSync(path.join(OUT, `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(dataURL.split(',')[1], 'base64'));
  if (i % 120 === 0) console.log(`frame ${i}/${N} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
console.log('done in', ((Date.now() - t0) / 1000).toFixed(0), 's');
await browser.close();
