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

// 云片贴图：柔边径向渐变（canvas 生成，零外链）
export function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 132, 20, 128, 132, 126);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.45, 'rgba(238,242,248,0.55)');
  g.addColorStop(1, 'rgba(230,236,244,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  // 顶部再叠两坨小球，轮廓不至于太圆
  for (const [x, y, r] of [[86, 96, 52], [176, 90, 44]]) {
    const g2 = ctx.createRadialGradient(x, y, 6, x, y, r);
    g2.addColorStop(0, 'rgba(255,255,255,0.75)');
    g2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, 256, 256);
  }
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
    0.7,    // strength
    0.65,   // radius
    0.6     // threshold：只有亮部起光
  );
  composer.addPass(bloom);
  return composer;
}
