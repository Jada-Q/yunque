// 云阙的视觉工具箱：卡通分档 / 描线 / 云片贴图 / 辉光合成器
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// 三阶分档（夜色版：档差小一点，避免死黑）
const toneData = new Uint8Array([110, 180, 240]);
const gradientMap = new THREE.DataTexture(toneData, 3, 1, THREE.RedFormat);
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.needsUpdate = true;

// 把子树的 Standard 材质换成 toon（发光体/Basic/点线不动）
export function toonify(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.isMeshStandardMaterial) return;
    const m = o.material;
    if (m.emissiveIntensity > 0.5 && m.emissive && m.emissive.getHex() !== 0) return;
    const toon = new THREE.MeshToonMaterial({
      color: m.color.clone(),
      gradientMap,
      transparent: m.transparent,
      opacity: m.opacity,
    });
    if (m.emissive) { toon.emissive = m.emissive.clone(); toon.emissiveIntensity = m.emissiveIntensity; }
    toon.depthWrite = m.depthWrite;
    o.material = toon;
  });
}

// 反向壳描线（不透明 mesh 专用）
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x0a0e18, side: THREE.BackSide });
export function addOutline(root, thickness = 1.03) {
  const targets = [];
  root.traverse((o) => { if (o.isMesh && !o.material.transparent && !o.userData.outline) targets.push(o); });
  for (const o of targets) {
    const hull = new THREE.Mesh(o.geometry, outlineMat);
    hull.scale.setScalar(thickness);
    hull.userData.outline = true;
    o.add(hull);
  }
}

// 云片贴图：多瓣簇 + 平底 + 细碎噪声（canvas 生成，零外链）——积云的体积感
export function cloudTexture(seed = 7) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  // 主体：一串沿水平带分布的软瓣，上缘隆起、下缘压平
  const lobes = [];
  for (let i = 0; i < 26; i++) {
    const x = 70 + rnd() * 372;
    const yBase = 300;
    const r = 34 + rnd() * 78;
    const y = yBase - r * (0.35 + rnd() * 0.55);       // 大瓣顶得更高
    lobes.push([x, y, r]);
  }
  for (const [x, y, r] of lobes) {
    const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.55, 'rgba(240,244,250,0.42)');
    g.addColorStop(1, 'rgba(235,240,248,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
  }
  // 细碎子瓣：轮廓破圆
  for (let i = 0; i < 40; i++) {
    const [px, py, pr] = lobes[(rnd() * lobes.length) | 0];
    const a = rnd() * Math.PI * 2;
    const x = px + Math.cos(a) * pr * 0.75, y = py + Math.sin(a) * pr * 0.55;
    const r = pr * (0.16 + rnd() * 0.2);
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
  }
  // 底部裁平（积云平底）
  const fade = ctx.createLinearGradient(0, 296, 0, 400);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = fade;
  ctx.fillRect(0, 296, 512, 216);
  ctx.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 辉光合成器：窗灯/信标/星星发光
export function makeComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    0.5,    // strength
    0.6,    // radius
    0.78    // threshold：压高，云不再洗白，只留灯与信标发光
  );
  composer.addPass(bloom);
  return composer;
}
