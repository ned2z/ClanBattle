import * as THREE from 'three';
import type { ClassId } from '../game/types';

// ============================================================ TOON CORE
const geoCache = new Map<string, THREE.BufferGeometry>();
function G<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g as T;
}
export const SHARED_GEOS = geoCache;

let _grad: THREE.DataTexture | null = null;
export function toonGradient() {
  if (!_grad) {
    _grad = new THREE.DataTexture(new Uint8Array([105, 105, 105, 255, 175, 175, 175, 255, 232, 232, 232, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat);
    _grad.minFilter = THREE.NearestFilter; _grad.magFilter = THREE.NearestFilter; _grad.generateMipmaps = false; _grad.needsUpdate = true;
  }
  return _grad;
}
export type CelMat = THREE.MeshToonMaterial;
const matCache = new Map<string, CelMat>();
export function mat(color: THREE.ColorRepresentation, o: { emissive?: THREE.ColorRepresentation; ei?: number; rough?: number; metal?: number; opacity?: number; flat?: boolean; vc?: boolean } = {}): CelMat {
  const key = `${new THREE.Color(color).getHexString()}|${o.emissive ?? ''}|${o.ei ?? ''}|${o.opacity ?? ''}|${o.vc ? 1 : 0}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, vertexColors: !!o.vc });
    if (o.opacity !== undefined) { m.transparent = true; m.opacity = o.opacity; }
    matCache.set(key, m);
  }
  return m;
}

const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x2b1d14, side: THREE.BackSide });
OUTLINE_MAT.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize(normal) * 0.022;');
};
OUTLINE_MAT.customProgramCacheKey = () => 'toon-outline';
/** Adds inverted-hull outlines to every opaque mesh under root. */
export function outline(root: THREE.Object3D) {
  const list: THREE.Mesh[] = [];
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !m.userData.outline && !m.userData.noOutline && !(m.material as THREE.Material).transparent) list.push(m); });
  for (const m of list) {
    const o = new THREE.Mesh(m.geometry, OUTLINE_MAT);
    o.userData.outline = true; o.castShadow = false; o.receiveShadow = false;
    m.add(o);
  }
  return root;
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, shadow = true) {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  me.castShadow = shadow;
  return me;
}
const box = (w: number, h: number, d: number) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt: number, rb: number, h: number, s = 12) => G(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const cone = (r: number, h: number, s = 12) => G(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const sph = (r: number, s = 16) => G(`s${r},${s}`, () => new THREE.SphereGeometry(r, s, Math.max(8, (s * 0.75) | 0)));
const cap = (r: number, l: number) => G(`p${r},${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 12));
const tor = (r: number, t: number) => G(`t${r},${t}`, () => new THREE.TorusGeometry(r, t, 8, 24));
const ico = (r: number, d = 1) => G(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));

export interface Rig {
  root: THREE.Group; rig: THREE.Group; height: number; mats: CelMat[]; weapon?: THREE.Object3D;
  limbs?: Record<string, { o: THREE.Object3D; rx: number }>;
}
export function findLimbs(root: THREE.Object3D) {
  const limbs: Record<string, { o: THREE.Object3D; rx: number }> = {};
  root.traverse((o) => { if (o.userData.limb) limbs[o.userData.limb] = { o, rx: o.rotation.x }; });
  return limbs;
}
export function walkPose(r: Rig, k: number, amt: number) {
  const l = r.limbs; if (!l) return;
  const sw = Math.sin(k) * 0.75 * amt;
  if (l.legL) l.legL.o.rotation.x = l.legL.rx + sw;
  if (l.legR) l.legR.o.rotation.x = l.legR.rx - sw;
  if (l.armL) l.armL.o.rotation.x = l.armL.rx - sw * 0.7;
  if (l.armR) l.armR.o.rotation.x = l.armR.rx + sw * 0.5;
}
function collect(root: THREE.Object3D) {
  const mats: CelMat[] = [];
  root.traverse((o) => { const m = (o as THREE.Mesh).material as CelMat | undefined; if (m && (m as CelMat).isMeshToonMaterial && !mats.includes(m)) mats.push(m); });
  return mats;
}

// ============================================================ ANIME FACE
const faceCache = new Map<string, THREE.MeshBasicMaterial>();
function faceMaterial(eye: number, angry: boolean) {
  const key = eye + (angry ? 'a' : 'n');
  let m = faceCache.get(key);
  if (m) return m;
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
  const c = cv.getContext('2d')!;
  const ec = new THREE.Color(eye);
  const col = (k: number) => `rgb(${Math.round(Math.min(255, ec.r * 255 * k))},${Math.round(Math.min(255, ec.g * 255 * k))},${Math.round(Math.min(255, ec.b * 255 * k))})`;
  const drawEye = (cx: number, flip: number) => {
    const cy = 262, w = 58, h = 78;
    c.save(); c.translate(cx, cy); c.scale(flip, 1);
    // white
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(0, 6, w, h, 0, 0, Math.PI * 2); c.fill();
    // iris gradient
    const g = c.createLinearGradient(0, -h, 0, h); g.addColorStop(0, col(0.35)); g.addColorStop(0.55, col(0.9)); g.addColorStop(1, col(1.5));
    c.fillStyle = g; c.beginPath(); c.ellipse(4, 12, w * 0.78, h * 0.86, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = col(0.18); c.beginPath(); c.ellipse(4, 14, w * 0.36, h * 0.44, 0, 0, Math.PI * 2); c.fill();
    // ring
    c.strokeStyle = col(0.3); c.lineWidth = 5; c.beginPath(); c.ellipse(4, 12, w * 0.78, h * 0.86, 0, 0, Math.PI * 2); c.stroke();
    // highlights
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(-16, -18, 17, 22, -0.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(22, 42, 8, 8, 0, 0, Math.PI * 2); c.fill();
    // upper lash
    c.fillStyle = '#1e1420'; c.beginPath();
    c.moveTo(-w - 10, -h * 0.25); c.quadraticCurveTo(-w * 0.2, -h - 30, w + 16, -h * 0.55); c.lineTo(w + 22, -h * 0.35); c.quadraticCurveTo(-w * 0.1, -h - 8, -w - 4, -h * 0.05); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(w + 12, -h * 0.5); c.lineTo(w + 34, -h * 0.72); c.lineTo(w + 20, -h * 0.3); c.fill();
    // lower lash hint
    c.strokeStyle = '#3a2430'; c.lineWidth = 4; c.beginPath(); c.moveTo(-w * 0.4, h + 8); c.quadraticCurveTo(w * 0.3, h + 14, w * 0.8, h * 0.7); c.stroke();
    // brow
    c.strokeStyle = '#2a1a18'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath();
    if (angry) { c.moveTo(-w, -h - 46); c.lineTo(w + 4, -h - 18); } else { c.moveTo(-w + 4, -h - 40); c.quadraticCurveTo(0, -h - 60, w + 4, -h - 40); }
    c.stroke();
    c.restore();
  };
  drawEye(172, 1); drawEye(340, -1);
  // blush
  for (const x of [120, 392]) { const g = c.createRadialGradient(x, 360, 0, x, 360, 46); g.addColorStop(0, 'rgba(255,120,140,.55)'); g.addColorStop(1, 'rgba(255,120,140,0)'); c.fillStyle = g; c.fillRect(x - 50, 310, 100, 100); c.strokeStyle = 'rgba(230,90,110,.6)'; c.lineWidth = 3; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x - 18 + i * 14, 350); c.lineTo(x - 26 + i * 14, 370); c.stroke(); } }
  // mouth
  c.strokeStyle = '#7a2a34'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath();
  if (angry) { c.moveTo(232, 408); c.lineTo(280, 402); } else { c.moveTo(236, 400); c.quadraticCurveTo(256, 416, 276, 400); }
  c.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true;
  m = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.08, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  faceCache.set(key, m);
  return m;
}

// ============================================================ CHIBI HUMANOID
interface HumOpts { body: number; skin?: number; legs?: number; hair?: number; hairStyle?: 'short' | 'long' | 'spiky' | 'none'; eye?: number; robe?: boolean; scale?: number; bulk?: number; angry?: boolean }
function humanoid(o: HumOpts) {
  const root = new THREE.Group(); const rig = new THREE.Group(); root.add(rig);
  const b = o.bulk ?? 1;
  const bodyM = mat(o.body), skinM = mat(o.skin ?? 0xffd9b8), legM = mat(o.legs ?? 0x5a4432), bootM = mat(0x5a3a24);
  for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(side * 0.11 * b, 0.42, 0); hip.userData.limb = side < 0 ? 'legL' : 'legR';
    hip.add(mesh(cap(0.07 * b, 0.24), legM, 0, -0.18, 0));
    const boot = mesh(sph(0.095), bootM, 0, -0.36, 0.03); boot.scale.set(1, 0.72, 1.35); hip.add(boot);
    rig.add(hip);
  }
  if (o.robe) { const sk = mesh(cone(0.36 * b, 0.62, 16), bodyM, 0, 0.3, 0); rig.add(sk); }
  const torso = mesh(cap(0.19 * b, 0.28), bodyM, 0, 0.7, 0); torso.scale.set(1, 1, 0.85); rig.add(torso);
  rig.add(mesh(cyl(0.205 * b, 0.205 * b, 0.05, 16), mat(0x6a4426), 0, 0.53, 0));
  // head
  const head = new THREE.Group(); head.position.set(0, 1.2, 0); head.userData.limb = 'head';
  head.add(mesh(sph(0.3, 28), skinM));
  const neck = mesh(cyl(0.07, 0.08, 0.12, 10), skinM, 0, 0.99, 0); rig.add(neck);
  // anime face decal (curved patch on the head sphere)
  const face = new THREE.Mesh(G('facePatch', () => new THREE.SphereGeometry(0.302, 28, 20, Math.PI / 2 - 0.78, 1.56, Math.PI / 2 - 0.62, 1.2)), faceMaterial(o.eye ?? 0x3a5ab0, !!o.angry));
  face.userData.noOutline = true; face.renderOrder = 2; head.add(face);
  if (o.hair !== undefined && o.hairStyle !== 'none') {
    const hm = mat(o.hair);
    const hl = mat(new THREE.Color(o.hair).offsetHSL(0, 0, 0.12));
    const cap0 = mesh(sph(0.322, 22), hm, 0, 0.055, -0.03); cap0.scale.set(1.03, 0.94, 1.04); head.add(cap0);
    // anime fringe: pointed locks sweeping over the forehead
    const fr: [number, number, number][] = [[-0.2, 0.1, 0.35], [-0.1, 0.07, 0.15], [0.0, 0.06, -0.05], [0.1, 0.075, -0.2], [0.2, 0.1, -0.38]];
    for (const [x, y, rz] of fr) { const lock = mesh(cone(0.075, 0.24, 8), hm, x, y + 0.08, 0.235 - Math.abs(x) * 0.25); lock.rotation.set(-0.35, 0, Math.PI + rz); head.add(lock); }
    // side locks
    for (const sx of [-1, 1]) { const sl = mesh(cone(0.06, 0.34, 8), hm, sx * 0.27, -0.08, 0.1); sl.rotation.set(0, 0, Math.PI + sx * 0.12); head.add(sl); }
    // shine band
    const band = mesh(tor(0.25, 0.018), hl, 0, 0.19, 0.02, false); band.rotation.x = Math.PI / 2 - 0.25; band.userData.noOutline = true; head.add(band);
    if (o.hairStyle === 'long') { const lh = mesh(cap(0.22, 0.46), hm, 0, -0.3, -0.14); lh.scale.set(1.15, 1, 0.7); head.add(lh); for (const sx of [-1, 1]) { const t = mesh(cone(0.07, 0.5, 8), hm, sx * 0.24, -0.3, 0.02); t.rotation.z = Math.PI; head.add(t); } }
    if (o.hairStyle === 'spiky') for (let i = 0; i < 6; i++) { const a = (i / 5 - 0.5) * 2.2; const sp = mesh(cone(0.085, 0.34, 8), hm, Math.sin(a) * 0.24, 0.24 + Math.cos(a) * 0.06, -0.12); sp.rotation.set(-0.7, 0, -a * 0.8); head.add(sp); }
    if (o.hairStyle === 'short') { const ah = mesh(cone(0.03, 0.2, 6), hm, 0.02, 0.36, 0.02); ah.rotation.z = -0.6; head.add(ah); }
  }
  rig.add(head);
  const armL = new THREE.Group(); armL.position.set(-0.24 * b, 0.92, 0); armL.userData.limb = 'armL';
  const armR = new THREE.Group(); armR.position.set(0.24 * b, 0.92, 0); armR.userData.limb = 'armR';
  for (const a of [armL, armR]) { a.add(mesh(cap(0.058 * b, 0.26), bodyM, 0, -0.17, 0)); a.add(mesh(sph(0.064, 12), skinM, 0, -0.37, 0)); }
  armL.rotation.z = -0.2; armR.rotation.z = 0.2;
  rig.add(armL, armR);
  const handL = new THREE.Group(); handL.position.set(0, -0.37, 0); armL.add(handL);
  const handR = new THREE.Group(); handR.position.set(0, -0.37, 0); armR.add(handR);
  if (o.scale) root.scale.setScalar(o.scale);
  return { root, rig, head, armL, armR, handL, handR, bodyM, skinM };
}

function sword(len = 0.7, w = 0.075, color = 0xe8eef8) {
  const g = new THREE.Group();
  const bl = mesh(box(w, len, 0.03), mat(color, { emissive: 0x223344, ei: 0.4 }), 0, len / 2 + 0.08, 0); g.add(bl);
  g.add(mesh(cone(w * 0.72, w * 1.6, 4), mat(color), 0, len + 0.08 + w * 0.8, 0));
  g.add(mesh(box(w * 3.4, 0.055, 0.07), mat(0xf2c14e), 0, 0.08, 0));
  g.add(mesh(cyl(0.028, 0.028, 0.16, 8), mat(0x7a4a24), 0, 0, 0));
  g.add(mesh(sph(0.04, 8), mat(0xf2c14e), 0, -0.09, 0));
  return g;
}
function staff(orb: number) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.03, 0.036, 1.3, 8), mat(0x9a6a3a), 0, 0.25, 0));
  g.add(mesh(sph(0.11, 16), mat(orb, { emissive: orb, ei: 1.6 }), 0, 0.97, 0, false));
  const ring = mesh(tor(0.13, 0.022), mat(0xf2c14e), 0, 0.97, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
  for (const s of [-1, 1]) { const w = mesh(cone(0.04, 0.16, 6), mat(0xf2c14e), s * 0.12, 0.88, 0); w.rotation.z = s * 0.7; g.add(w); }
  return g;
}

export function makeHero(cls: ClassId, color: string): Rig {
  const c = new THREE.Color(color).getHex();
  let h: ReturnType<typeof humanoid>;
  let weapon: THREE.Object3D | undefined;
  switch (cls) {
    case 'shield': {
      h = humanoid({ body: 0xa9c4e8, legs: 0x4a5a7a, hair: 0x2a3350, hairStyle: 'short', eye: 0x2a4a8a, bulk: 1.12 });
      for (const s of [-1, 1]) { const p = mesh(sph(0.12, 14), mat(0xdfe8f5), s * 0.27, 0.9, 0); p.scale.set(1, 0.7, 1); h.rig.add(p); }
      const cape = mesh(box(0.46, 0.62, 0.03), mat(0x3a6ad0), 0, 0.6, -0.2); cape.rotation.x = 0.12; h.rig.add(cape);
      const sh = new THREE.Group();
      const disk = mesh(cyl(0.3, 0.3, 0.06, 20), mat(c), 0, 0, 0); disk.rotation.x = Math.PI / 2; sh.add(disk);
      const rim = mesh(tor(0.3, 0.03), mat(0xf2c14e), 0, 0, 0.01); sh.add(rim);
      const boss = mesh(sph(0.09, 12), mat(0xf2c14e), 0, 0, 0.04); boss.scale.z = 0.6; sh.add(boss);
      sh.position.set(0.02, 0.06, 0.16); h.handL.add(sh);
      h.armL.rotation.set(-0.55, 0, -0.35);
      weapon = sword(0.55); h.handR.add(weapon); weapon.rotation.x = Math.PI / 2.2;
      break;
    }
    case 'berserker': {
      h = humanoid({ body: 0xe0503e, legs: 0x5a3424, skin: 0xf2c49c, hair: 0xc2542a, hairStyle: 'spiky', eye: 0x6a2a1a, bulk: 1.15, angry: true });
      const helm = mesh(sph(0.33, 18, ), mat(0xb8c0cc), 0, 0.1, -0.02); helm.scale.set(1, 0.62, 1); h.head.add(helm);
      for (const s of [-1, 1]) { const hn = mesh(cone(0.06, 0.32, 10), mat(0xfff2d8), s * 0.3, 0.2, 0); hn.rotation.z = -s * 1.0; h.head.add(hn); }
      const cape = mesh(box(0.5, 0.65, 0.03), mat(0xa02020), 0, 0.6, -0.2); cape.rotation.x = 0.12; h.rig.add(cape);
      weapon = sword(1.15, 0.15, 0xdfe6f0); h.handR.add(weapon); weapon.rotation.x = 1.0;
      h.armR.rotation.x = -0.6;
      break;
    }
    case 'rogue': {
      h = humanoid({ body: 0x4f9a5a, legs: 0x2f4a32, hair: 0x2a3a2a, hairStyle: 'short', eye: 0x2a6a3a });
      const hood = mesh(sph(0.35, 18), mat(0x3f8a4a), 0, 0.05, -0.06); hood.scale.set(1, 1, 1.02); h.head.add(hood);
      const tip = mesh(cone(0.12, 0.25, 10), mat(0x3f8a4a), 0, 0.12, -0.36); tip.rotation.x = -1.9; h.head.add(tip);
      const scarf = mesh(tor(0.2, 0.06), mat(c), 0, 0.93, 0); scarf.rotation.x = Math.PI / 2; h.rig.add(scarf);
      const d1 = sword(0.3, 0.055); h.handR.add(d1); d1.rotation.x = Math.PI / 2;
      const d2 = sword(0.3, 0.055); h.handL.add(d2); d2.rotation.x = Math.PI / 2;
      h.armR.rotation.x = -0.5; h.armL.rotation.x = -0.5;
      weapon = d1;
      break;
    }
    case 'blackmage': {
      h = humanoid({ body: 0x6a48b0, robe: true, hair: 0x4a2a7a, hairStyle: 'short', eye: 0x8a4ad0 });
      const brim = mesh(cyl(0.5, 0.5, 0.035, 24), mat(0x3a2468), 0, 0.2, 0); h.head.add(brim);
      const hat = mesh(cone(0.27, 0.7, 16), mat(0x3a2468), 0.05, 0.54, -0.03); hat.rotation.z = -0.25; h.head.add(hat);
      const band = mesh(tor(0.25, 0.03), mat(0xf2c14e), 0, 0.24, 0); band.rotation.x = Math.PI / 2; h.head.add(band);
      const star = mesh(ico(0.05, 0), mat(0xffe27a, { emissive: 0xffc02a, ei: 1.2 }), 0.2, 0.3, 0.14, false); h.head.add(star);
      weapon = staff(c); h.handR.add(weapon);
      break;
    }
    case 'whitemage': {
      h = humanoid({ body: 0xfbf8f0, robe: true, hair: 0xe6e8f4, hairStyle: 'long', eye: 0x5a7ad0 });
      h.rig.add(mesh(box(0.09, 0.6, 0.02), mat(0xe04a4a), 0, 0.35, 0.3));
      for (const s of [-1, 1]) { const tr = mesh(box(0.05, 0.5, 0.02), mat(0xe04a4a), s * 0.2, 0.3, 0.26); tr.rotation.z = s * 0.3; h.rig.add(tr); }
      const halo = mesh(tor(0.22, 0.025), mat(0xffe27a, { emissive: 0xffd24a, ei: 1.5 }), 0, 0.46, -0.02, false); halo.rotation.x = Math.PI / 2; h.head.add(halo);
      weapon = staff(0xfff1a8); h.handR.add(weapon);
      break;
    }
    case 'merchant':
    default: {
      h = humanoid({ body: 0xb87a44, legs: 0x5a4030, hair: 0x7a4a2a, hairStyle: 'short', eye: 0x5a3a1a });
      h.head.add(mesh(cyl(0.42, 0.42, 0.035, 20), mat(0x8a5a30), 0, 0.2, 0));
      h.head.add(mesh(cyl(0.2, 0.25, 0.22, 16), mat(0x8a5a30), 0, 0.3, 0));
      h.head.add(mesh(cyl(0.255, 0.255, 0.05, 16), mat(c), 0, 0.23, 0));
      h.rig.add(mesh(box(0.38, 0.42, 0.22), mat(0x7a4a24), 0, 0.72, -0.26));
      h.rig.add(mesh(cyl(0.12, 0.12, 0.4, 10), mat(0x5a8a4a), 0, 1.0, -0.28));
      const pouch = mesh(sph(0.1, 12), mat(0xf2c14e), 0.24, 0.5, 0.1); h.rig.add(pouch);
      const xb = new THREE.Group();
      xb.add(mesh(box(0.06, 0.06, 0.55), mat(0x7a4a24), 0, 0, 0.18));
      const bow = mesh(tor(0.28, 0.025), mat(0xb0b8c4), 0, 0, 0.4); bow.scale.set(1, 0.4, 1); bow.rotation.x = Math.PI / 2; xb.add(bow);
      h.handR.add(xb); h.armR.rotation.x = -0.9;
      weapon = xb;
      break;
    }
  }
  outline(h.root);
  return { root: h.root, rig: h.rig, height: 1.6, mats: collect(h.root), weapon, limbs: findLimbs(h.root) };
}

// ============================================================ MONSTERS
function cartoonEyes(head: THREE.Object3D, sp: number, y: number, z: number, r: number, iris = 0xffc020) {
  for (const s of [-1, 1]) {
    const w = mesh(sph(r, 12), mat(0xffffff), s * sp, y, z, false); w.scale.set(1, 1.1, 0.5); w.userData.noOutline = true; head.add(w);
    const p = mesh(sph(r * 0.6, 10), mat(iris, { emissive: iris, ei: 0.35 }), s * sp, y - r * 0.1, z + r * 0.35, false); p.scale.set(1, 1.2, 0.5); p.userData.noOutline = true; head.add(p);
    const br = mesh(box(r * 2.2, r * 0.4, r * 0.4), mat(0x2a1a10), s * sp, y + r * 1.15, z + r * 0.2, false); br.rotation.z = s * -0.5; br.userData.noOutline = true; head.add(br);
  }
}
function quadruped(o: { color: number; scale: number; trunk?: boolean; stripes?: boolean; long?: number; belly?: number }) {
  const root = new THREE.Group(); const rig = new THREE.Group(); root.add(rig);
  const m = mat(o.color); const dark = mat(new THREE.Color(o.color).multiplyScalar(0.7)); const belly = mat(o.belly ?? 0xf5ecd8);
  const L = o.long ?? 1;
  const body = mesh(cap(0.34, 0.6 * L), m, 0, 0.72, 0); body.rotation.x = Math.PI / 2; rig.add(body);
  const bl = mesh(cap(0.25, 0.45 * L), belly, 0, 0.6, 0); bl.rotation.x = Math.PI / 2; rig.add(bl);
  for (const [x, z, n] of [[-0.2, 0.33, 'legL'], [0.2, 0.33, 'legR'], [-0.2, -0.33, ''], [0.2, -0.33, '']] as const) {
    const leg = new THREE.Group(); leg.position.set(x, 0.55, z * L); if (n) leg.userData.limb = n;
    leg.add(mesh(cap(0.09, 0.28), dark, 0, -0.25, 0)); rig.add(leg);
  }
  const head = new THREE.Group(); head.position.set(0, 1.0, 0.6 * L); head.userData.limb = 'head'; rig.add(head);
  head.add(mesh(sph(0.28, 18), m));
  const snout = mesh(sph(0.15, 14), belly, 0, -0.07, 0.22); snout.scale.set(1.1, 0.8, 1.1); head.add(snout);
  head.add(mesh(sph(0.045, 8), mat(0x2a1a10), 0, -0.02, 0.37, false));
  cartoonEyes(head, 0.11, 0.07, 0.22, 0.07);
  for (const s of [-1, 1]) { const ear = mesh(cone(0.09, 0.2, 8), dark, s * 0.15, 0.25, -0.02); ear.rotation.z = -s * 0.3; head.add(ear); }
  const tail = mesh(cap(0.05, 0.4), dark, 0, 0.85, -0.62 * L); tail.rotation.x = -0.8; rig.add(tail);
  if (o.trunk) {
    const tk = mesh(cap(0.08, 0.45), m, 0, -0.32, 0.3); tk.rotation.x = 0.3; head.add(tk);
    for (const s of [-1, 1]) { const t = mesh(cone(0.035, 0.3, 8), mat(0xfff8e8), s * 0.12, -0.15, 0.3); t.rotation.x = 2.2; head.add(t); const ear = mesh(sph(0.22, 12), dark, s * 0.3, 0, -0.05); ear.scale.set(0.3, 1.1, 1); head.add(ear); }
    rig.add(mesh(box(0.6, 0.12, 0.65), mat(0xd03a3a), 0, 1.07, 0));
    rig.add(mesh(box(0.64, 0.05, 0.7), mat(0xf2c14e), 0, 1.0, 0));
    const hp = mesh(cone(0.12, 0.2, 4), mat(0xf2c14e), 0, 0.3, 0.1); head.add(hp);
  }
  if (o.stripes) for (let i = -2; i <= 2; i++) { const st = mesh(box(0.7, 0.05, 0.07), mat(0x2a1a10), 0, 0.82, i * 0.16); st.userData.noOutline = true; rig.add(st); }
  root.scale.setScalar(o.scale);
  return { root, rig, height: 1.35 * o.scale };
}
function serpent(o: { color: number; scale: number; horns?: boolean; belly?: number }) {
  const root = new THREE.Group(); const rig = new THREE.Group(); root.add(rig);
  const m = mat(o.color); const bm = mat(o.belly ?? 0xf5e6b0);
  const n = 10;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1); const r = 0.24 - t * 0.07;
    const x = Math.sin(t * 5) * 0.35, z = -0.6 + t * 0.9 - (t > 0.6 ? (t - 0.6) * 0.5 : 0), y = r + (t > 0.5 ? (t - 0.5) * 2.6 : 0);
    rig.add(mesh(sph(r, 16), i % 2 ? m : bm, x, y, z));
  }
  const head = new THREE.Group(); head.position.set(Math.sin(5) * 0.35, 1.58, 0.22); head.userData.limb = 'head'; rig.add(head);
  const hd = mesh(sph(0.24, 16), m, 0, 0, 0.06); hd.scale.set(1.05, 0.8, 1.25); head.add(hd);
  cartoonEyes(head, 0.1, 0.08, 0.26, 0.065, 0xff4a2a);
  const hood = mesh(sph(0.35, 16), m, 0, 0, -0.12); hood.scale.set(1.2, 1, 0.3); head.add(hood);
  if (o.horns) {
    const hm = mat(0xf2c14e);
    for (const s of [-1, 1]) { const a = mesh(cone(0.045, 0.38, 8), hm, s * 0.12, 0.22, -0.05); a.rotation.set(-0.6, 0, -s * 0.3); head.add(a); }
    head.add(mesh(cone(0.2, 0.42, 5), hm, 0, 0.14, -0.28));
  }
  root.scale.setScalar(o.scale);
  return { root, rig, height: 1.85 * o.scale };
}
function krasue() {
  const root = new THREE.Group(); const rig = new THREE.Group(); root.add(rig);
  const head = new THREE.Group(); head.position.y = 1.35; head.userData.limb = 'head'; rig.add(head);
  head.add(mesh(sph(0.28, 18), mat(0xfff0e4)));
  const hair = mesh(sph(0.31, 18), mat(0x1a1424), 0, 0.05, -0.06); hair.scale.set(1.02, 1, 1.02); head.add(hair);
  const lh = mesh(cap(0.24, 0.6), mat(0x1a1424), 0, -0.35, -0.12); head.add(lh);
  cartoonEyes(head, 0.1, 0.02, 0.24, 0.065, 0xff2a4a);
  const glow = mat(0xff6a8a, { emissive: 0xff2a5a, ei: 1.2 });
  for (let i = 0; i < 5; i++) { const s = mesh(cap(0.025, 0.7 + (i % 2) * 0.3), glow, (i - 2) * 0.06, 0.7, (i % 2) * 0.05, false); s.rotation.z = (i - 2) * 0.1; rig.add(s); }
  rig.add(mesh(sph(0.13, 12), mat(0xff4a6a, { emissive: 0xaa1133, ei: 0.8 }), 0, 0.35, 0, false));
  outline(root);
  return { root, rig, height: 1.75 };
}
function tank() {
  const root = new THREE.Group(); const rig = new THREE.Group(); root.add(rig);
  const m = mat(0x8a9a5a); const d = mat(0x4a5230);
  const hull = mesh(cap(0.35, 0.9), m, 0, 0.45, 0); hull.rotation.x = Math.PI / 2; hull.scale.set(1.5, 1, 0.8); rig.add(hull);
  for (const s of [-1, 1]) { const tr = mesh(cap(0.18, 1.2), d, s * 0.6, 0.22, 0); tr.rotation.x = Math.PI / 2; rig.add(tr); }
  const tur = new THREE.Group(); tur.position.y = 0.78; rig.add(tur);
  const dome = mesh(sph(0.38, 16), m); dome.scale.set(1, 0.6, 1); tur.add(dome);
  const barrel = mesh(cyl(0.06, 0.07, 1.0, 10), d, 0, 0.02, 0.6); barrel.rotation.x = Math.PI / 2; tur.add(barrel);
  tur.add(mesh(box(0.2, 0.1, 0.2), mat(0xd04a3a), 0.2, 0.2, -0.1));
  root.scale.setScalar(1.2);
  outline(root);
  return { root, rig, height: 1.5 };
}
export function makeMonster(icon: string): Rig {
  let r: { root: THREE.Group; rig: THREE.Group; height: number };
  switch (icon) {
    case '🐺': r = quadruped({ color: 0x8a9ab8, scale: 0.9, belly: 0xe8ecf4 }); break;
    case '🐅': r = quadruped({ color: 0xf59a3a, scale: 1.05, stripes: true }); break;
    case '🐘': r = quadruped({ color: 0x9aa4b8, scale: 1.65, trunk: true, long: 1.1, belly: 0xb8c0d0 }); break;
    case '🐍': r = serpent({ color: 0x6ac04a, scale: 0.9 }); break;
    case '🐉': r = serpent({ color: 0x2ac0a8, scale: 1.4, horns: true, belly: 0xffd870 }); break;
    case '👻': return { ...(r = krasue()), mats: collect(r.root), limbs: findLimbs(r.root) };
    case '🪖': return { ...(r = tank()), mats: collect(r.root), limbs: findLimbs(r.root) };
    default: {
      const presets: Record<string, HumOpts & { gear: (h: ReturnType<typeof humanoid>) => void }> = {
        '🥷': { body: 0x3a4a6a, legs: 0x2a3048, hair: 0x1a1a24, hairStyle: 'short', angry: true, eye: 0xd03a3a, gear: (h) => { const mask = mesh(box(0.5, 0.12, 0.4), mat(0x2a2a3a), 0, -0.06, 0.08); h.head.add(mask); const s = sword(0.65, 0.05); h.handR.add(s); s.rotation.x = 1.2; } },
        '💂': { body: 0x7a8a4a, legs: 0x4a5430, hair: 0x3a2a1a, hairStyle: 'short', angry: true, gear: (h) => { const hl = mesh(sph(0.33, 16), mat(0x6a7a3a), 0, 0.1, 0); hl.scale.set(1, 0.6, 1); h.head.add(hl); const g = new THREE.Group(); g.add(mesh(box(0.06, 0.1, 0.85), mat(0x4a4a4a), 0, 0, 0.3)); g.add(mesh(box(0.08, 0.14, 0.3), mat(0x8a5a30), 0, -0.04, -0.05)); h.handR.add(g); h.armR.rotation.x = -1.1; } },
        '👹': { body: 0x3aa87a, skin: 0x4ac08a, legs: 0x2a6a4a, scale: 1.55, bulk: 1.3, angry: true, eye: 0xffd020, gear: (h) => { const gold = mat(0xf2c14e); h.head.add(mesh(cone(0.2, 0.5, 12), gold, 0, 0.38, 0)); h.head.add(mesh(cyl(0.3, 0.3, 0.08, 16), gold, 0, 0.18, 0)); for (const s of [-1, 1]) h.head.add(mesh(cone(0.03, 0.12, 6), mat(0xffffff), s * 0.08, -0.16, 0.25)); const club = new THREE.Group(); club.add(mesh(cyl(0.05, 0.12, 0.9, 10), mat(0x8a5a30), 0, 0.45, 0)); club.add(mesh(sph(0.17, 12), mat(0x9a6a3a), 0, 0.92, 0)); h.handR.add(club); club.rotation.x = 1.3; } },
        '🧟': { body: 0x8a8a5a, skin: 0xb0d890, legs: 0x5a5a3a, hair: 0x4a5a3a, hairStyle: 'spiky', eye: 0xff4a4a, gear: (h) => { h.armL.rotation.x = -1.4; h.armR.rotation.x = -1.4; } },
        '💀': { body: 0x5a4a8a, skin: 0xcfd8e8, legs: 0x3a2a5a, scale: 1.3, bulk: 1.15, angry: true, eye: 0x3ac0ff, gear: (h) => { const hl = mesh(sph(0.33, 16), mat(0x7a7a9a), 0, 0.08, -0.02); hl.scale.set(1, 0.75, 1); h.head.add(hl); h.head.add(mesh(cone(0.08, 0.4, 8), mat(0xd03a3a), 0, 0.42, -0.05)); const sp = new THREE.Group(); sp.add(mesh(cyl(0.03, 0.03, 1.8, 8), mat(0x4a3a2a), 0, 0.5, 0)); sp.add(mesh(cone(0.07, 0.32, 6), mat(0xdfe6f0), 0, 1.5, 0)); h.handR.add(sp); const cape = mesh(box(0.5, 0.7, 0.03), mat(0x3a1a4a), 0, 0.6, -0.22); cape.rotation.x = 0.12; h.rig.add(cape); } },
      };
      const p = presets[icon] ?? presets['🥷'];
      const h = humanoid(p);
      p.gear(h);
      r = { root: h.root, rig: h.rig, height: 1.5 * (p.scale ?? 1) };
    }
  }
  outline(r.root);
  return { ...r, mats: collect(r.root), limbs: findLimbs(r.root) };
}

// ============================================================ BUILDINGS / MAP
const ROOFS = [0xe0583a, 0xf0843a, 0x3aa0b8, 0xd04a4a, 0x5a9a4a];
function house(w: number, h: number, roof: number) {
  const g = new THREE.Group();
  g.add(mesh(box(w, h, w * 0.85), mat(0xfff4e0), 0, h / 2, 0));
  const r = mesh(cone(w * 0.82, h * 0.8, 4), mat(roof), 0, h + h * 0.4, 0); r.rotation.y = Math.PI / 4; r.scale.set(1, 1, 0.9); g.add(r);
  g.add(mesh(box(w * 0.25, h * 0.45, 0.02), mat(0x8a5a30), 0, h * 0.23, w * 0.43));
  g.add(mesh(box(w * 0.2, w * 0.2, 0.02), mat(0x7ac0e0), w * 0.28, h * 0.6, w * 0.43));
  return g;
}
export function puffyTree(s = 1, color = 0x5ab84a) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.07, 0.1, 0.6, 8), mat(0x9a6a3a), 0, 0.3, 0));
  const c = new THREE.Color(color);
  const a = mesh(ico(0.42, 1), mat(c), 0, 0.85, 0); g.add(a);
  const b = mesh(ico(0.3, 1), mat(c.clone().offsetHSL(0.02, 0, 0.08)), 0.22, 1.05, 0.12); g.add(b);
  const d = mesh(ico(0.28, 1), mat(c.clone().offsetHSL(-0.02, 0, -0.05)), -0.22, 0.75, -0.1); g.add(d);
  g.scale.setScalar(s);
  return g;
}
export function makeCity(tier: number, capital: boolean): THREE.Group {
  const g = new THREE.Group();
  const base = mesh(cyl(1.5, 1.7, 0.25, 24), mat(0x8fd06a), 0, 0.12, 0); base.receiveShadow = true; g.add(base);
  const wall = mesh(tor(1.45, 0.09), mat(0xe8dcc0), 0, 0.28, 0); wall.rotation.x = Math.PI / 2; g.add(wall);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const tw = mesh(cyl(0.12, 0.14, 0.4, 10), mat(0xe8dcc0), Math.cos(a) * 1.45, 0.4, Math.sin(a) * 1.45); g.add(tw); g.add(mesh(cone(0.16, 0.2, 10), mat(ROOFS[i % 2]), Math.cos(a) * 1.45, 0.7, Math.sin(a) * 1.45)); }
  const n = 4 + Math.min(5, tier);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3; const r = 0.62 + (i % 2) * 0.35;
    const hs = house(0.32 + (i % 3) * 0.05, 0.26 + (i % 2) * 0.1 + (capital ? 0.12 : 0), ROOFS[i % ROOFS.length]);
    hs.position.set(Math.cos(a) * r, 0.25, Math.sin(a) * r); hs.rotation.y = -a + Math.PI / 2; g.add(hs);
  }
  for (let i = 0; i < 3; i++) { const t = puffyTree(0.45, 0x4ab04a); const a = i * 2.1 + 1; t.position.set(Math.cos(a) * 1.05, 0.25, Math.sin(a) * 1.05); g.add(t); }
  const gold = mat(0xffcf4a, { emissive: 0x6a4a00, ei: 0.35 });
  const s = capital ? 1.45 : 0.75 + tier * 0.05;
  const ch = new THREE.Group();
  ch.add(mesh(cyl(0.3, 0.38, 0.2, 16), mat(0xfff8ec), 0, 0.1, 0));
  ch.add(mesh(sph(0.27, 18), capital ? gold : mat(0xfff8ec), 0, 0.36, 0));
  ch.add(mesh(cone(0.12, 0.7, 14), gold, 0, 0.9, 0));
  ch.scale.setScalar(s); ch.position.y = 0.25; g.add(ch);
  if (capital) for (const [x, z] of [[-0.75, -0.3], [0.75, -0.3]]) { const p = new THREE.Group(); p.add(mesh(box(0.35, 0.3, 0.35), mat(0xfff4e0), 0, 0.15, 0)); p.add(mesh(cone(0.13, 0.6, 10), gold, 0, 0.6, 0)); p.position.set(x, 0.25, z); g.add(p); }
  outline(g);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.receiveShadow = true; });
  return g;
}
export function makeTankProp() { return tank().root; }
export function makeCloud(s = 1) {
  const g = new THREE.Group(); const m = mat(0xffffff, { emissive: 0xdde8f8, ei: 0.35 });
  const n = 5 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) { const b = mesh(sph(0.6 + Math.random() * 0.5, 14), m, (i - n / 2) * 0.7 + Math.random() * 0.3, Math.random() * 0.35, (Math.random() - 0.5) * 0.8); b.scale.y = 0.7; g.add(b); }
  g.scale.setScalar(s);
  return g;
}

// ============================================================ BATTLE PROPS
export function makePalm() {
  const g = new THREE.Group(); const tm = mat(0xa87a4a); const lm = mat(0x4ac04a); const lm2 = mat(0x3aa03a);
  let x = 0, y = 0;
  for (let i = 0; i < 6; i++) { const s = mesh(cyl(0.09 - i * 0.008, 0.11 - i * 0.008, 0.55, 10), tm, x, y + 0.27, 0); s.rotation.z = -0.08 * i; g.add(s); x += 0.04 * i; y += 0.53; }
  for (let i = 0; i < 8; i++) { const l = mesh(box(0.28, 0.04, 1.35), i % 2 ? lm : lm2, x, y, 0); l.rotation.y = (i / 8) * Math.PI * 2; l.rotation.x = 0.55; l.translateZ(0.55); g.add(l); }
  g.add(mesh(sph(0.1, 10), mat(0x7a5a2a), x, y - 0.1, 0.1));
  outline(g);
  return g;
}
export function makeRuin(h = 1.5) {
  const g = new THREE.Group(); const m = mat(0xe0d4b8); const d = mat(0xc8b894); const moss = mat(0x6ac04a);
  for (let i = 0; i < 4; i++) {
    const hh = h * (0.4 + ((i * 37) % 10) / 16);
    const b = mesh(cyl(0.2, 0.24, hh, 12), i % 2 ? m : d, i * 0.55, hh / 2, 0); g.add(b);
    const mc = mesh(sph(0.24, 12), moss, i * 0.55, hh, 0); mc.scale.set(1, 0.35, 1); g.add(mc);
  }
  g.add(mesh(box(1.9, 0.14, 0.36), d, 0.8, 0.07, 0.45));
  for (let i = 0; i < 3; i++) { const r = mesh(ico(0.18, 0), d, 0.3 + i * 0.6, 0.12, 0.8); r.rotation.set(i, i * 2, 0); g.add(r); }
  outline(g);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.receiveShadow = true; });
  return g;
}
export function makePrang() {
  const g = new THREE.Group(); const m = mat(0xeadcc0); const d = mat(0xd4c4a0); const moss = mat(0x6ac04a); const gold = mat(0xffcf4a);
  g.add(mesh(box(4, 1, 4), d, 0, 0.5, 0));
  let y = 1, s = 3;
  for (let i = 0; i < 6; i++) { g.add(mesh(box(s, 0.7, s), i % 2 ? m : d, 0, y + 0.35, 0)); if (i % 2 === 0) { const mc = mesh(box(s * 1.02, 0.12, s * 1.02), moss, 0, y + 0.72, 0); g.add(mc); } y += 0.7; s *= 0.78; }
  g.add(mesh(cone(s * 0.7, 2.5, 12), m, 0, y + 1.25, 0));
  g.add(mesh(cone(0.12, 0.8, 8), gold, 0, y + 2.8, 0));
  g.add(mesh(box(1.5, 1.2, 0.3), mat(0x5a4a3a), 0, 1.7, 1.55));
  for (const [x, z] of [[-3, -2], [3, -2]]) { g.add(mesh(box(1.4, 3, 1.4), m, x, 1.5, z)); g.add(mesh(cone(0.6, 1.6, 10), m, x, 3.8, z)); const vine = mesh(sph(0.6, 10), moss, x, 3.0, z + 0.4); vine.scale.set(1.2, 0.5, 0.6); g.add(vine); }
  outline(g);
  return g;
}
export function makeSandbags() {
  const g = new THREE.Group(); const m = mat(0xe8d4a0);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 5 - r; i++) { const s = mesh(cap(0.14, 0.32), m, i * 0.42 + r * 0.21, 0.14 + r * 0.24, 0); s.rotation.z = Math.PI / 2; g.add(s); }
  outline(g);
  return g;
}
/** Campfire (kept name for compatibility). */
export function makeBarrel() {
  const g = new THREE.Group(); const st = mat(0xb8b0a0); const wd = mat(0x9a6a3a);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const r = mesh(ico(0.12, 0), st, Math.cos(a) * 0.35, 0.08, Math.sin(a) * 0.35); g.add(r); }
  for (let i = 0; i < 3; i++) { const l = mesh(cyl(0.05, 0.05, 0.55, 8), wd, 0, 0.12, 0); l.rotation.set(Math.PI / 2 - 0.4, (i / 3) * Math.PI * 2, 0); g.add(l); }
  g.add(mesh(sph(0.12, 10), mat(0xffb040, { emissive: 0xff7a1a, ei: 1.5 }), 0, 0.16, 0, false));
  outline(g);
  return g;
}
export function makeSpikes() {
  const g = new THREE.Group(); const m = mat(0xb07a4a);
  for (let i = 0; i < 5; i++) { const s = mesh(cyl(0.05, 0.06, 1.1, 8), m, i * 0.35, 0.45, 0); s.rotation.x = 0.35; g.add(s); g.add(mesh(cone(0.06, 0.15, 8), m, i * 0.35, 0.98, 0.18)); }
  g.add(mesh(box(1.8, 0.08, 0.08), m, 0.7, 0.35, 0.0));
  outline(g);
  return g;
}

// ============================================================ FLORA
export function makePine(h = 1) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.1, 0.14, 1.0, 10), mat(0x8a5a30), 0, 0.5, 0));
  const c = [0x2f8a4a, 0x3aa058, 0x4ab868];
  for (let i = 0; i < 3; i++) { const t = mesh(cone(0.95 - i * 0.24, 1.1, 14), mat(c[i]), 0, 1.05 + i * 0.62, 0); g.add(t); }
  const snow = mesh(cone(0.3, 0.35, 14), mat(0xffffff), 0, 2.55, 0); g.add(snow);
  g.scale.setScalar(h);
  outline(g);
  return g;
}
export function makeBroadleaf(h = 1, color = 0x5ab84a) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.1, 0.17, 1.5, 10), mat(0x9a6a3a), 0, 0.75, 0));
  const c1 = new THREE.Color(color);
  for (const [x, y, z, s, l] of [[0, 2.0, 0, 1.25, 0], [0.55, 1.7, 0.2, 0.85, 0.06], [-0.5, 1.75, -0.2, 0.9, -0.05], [0.1, 2.55, -0.1, 0.8, 0.1], [-0.15, 1.9, 0.5, 0.7, 0.03]]) {
    const m = mesh(ico(0.72, 1), mat(c1.clone().offsetHSL(0, 0, l)), x, y, z); m.scale.setScalar(s); g.add(m);
  }
  g.scale.setScalar(h);
  outline(g);
  return g;
}
/** Dry-biome acacia (kept name). */
export function makeDeadTree(h = 1) {
  const g = new THREE.Group(); const w = mat(0x9a6a3a);
  const t = mesh(cyl(0.08, 0.14, 1.8, 8), w, 0, 0.9, 0); t.rotation.z = 0.1; g.add(t);
  for (const s of [-1, 1]) { const b = mesh(cyl(0.04, 0.06, 0.8, 6), w, s * 0.25, 1.75, 0); b.rotation.z = -s * 0.7; g.add(b); }
  const c = mesh(sph(1, 16), mat(0xa8b84a), 0, 2.2, 0); c.scale.set(1.3, 0.32, 1.1); g.add(c);
  const c2 = mesh(sph(0.7, 14), mat(0xc0c85a), 0.4, 2.35, 0.2); c2.scale.set(1.2, 0.3, 1); g.add(c2);
  g.scale.setScalar(h);
  outline(g);
  return g;
}
export function makeBush(color = 0x5ab84a, s = 1) {
  const g = new THREE.Group(); const c = new THREE.Color(color);
  for (let i = 0; i < 4; i++) { const m = mesh(ico(0.4, 1), mat(c.clone().offsetHSL(0, 0, (i - 1.5) * 0.04)), (i - 1.5) * 0.3, 0.28 + (i % 2) * 0.12, (i % 2 - 0.5) * 0.3); m.scale.setScalar(0.75 + (i % 3) * 0.2); g.add(m); }
  for (let i = 0; i < 3; i++) g.add(mesh(sph(0.06, 8), mat([0xff7ab0, 0xffe14a, 0xffffff][i]), (i - 1) * 0.35, 0.6, 0.25, false));
  g.scale.setScalar(s);
  outline(g);
  return g;
}
export function makeRock(color = 0xb8b0a0, s = 1) {
  const g = new THREE.Group();
  const m = mesh(ico(0.5, 1), mat(color));
  m.scale.set(s * (0.8 + Math.random() * 0.6), s * (0.45 + Math.random() * 0.35), s * (0.8 + Math.random() * 0.6));
  m.rotation.set(0, Math.random() * 6, 0); m.position.y = 0.12 * s; m.receiveShadow = true; g.add(m);
  const moss = mesh(sph(0.35, 10), mat(0x6ac04a), 0, 0.12 * s + m.scale.y * 0.4, 0); moss.scale.set(s, 0.25 * s, s * 0.9); g.add(moss);
  outline(g);
  return g as unknown as THREE.Mesh;
}
export function makeBanana(h = 1) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.1, 0.14, 1.3, 10), mat(0x8ab04a), 0, 0.65, 0));
  const lm = mat(0x5ad04a);
  for (let i = 0; i < 6; i++) { const l = mesh(box(0.4, 0.03, 1.2), lm, 0, 1.3, 0); l.rotation.y = (i / 6) * Math.PI * 2; l.rotation.x = 0.7; l.translateZ(0.45); g.add(l); }
  g.scale.setScalar(h);
  outline(g);
  return g;
}
export function grassTuftGeometry() {
  const pos: number[] = []; const col: number[] = []; const idx: number[] = [];
  let v = 0;
  for (let b = 0; b < 3; b++) {
    const a = (b / 3) * Math.PI + Math.random() * 0.5; const ca = Math.cos(a), sa = Math.sin(a);
    const w = 0.07, lean = 0.12 + Math.random() * 0.15, ox = (Math.random() - 0.5) * 0.15, oz = (Math.random() - 0.5) * 0.15;
    const hgt = 0.75 + Math.random() * 0.35;
    const pts = [[-w, 0], [w, 0], [-w * 0.6, hgt * 0.55], [w * 0.6, hgt * 0.55], [0, hgt]];
    for (const [px, py] of pts) {
      const k = py / hgt;
      pos.push(ox + px * ca + lean * k * k * -sa, py, oz + px * sa + lean * k * k * ca);
      col.push(0.55 + k * 0.45, 0.55 + k * 0.45, 0.55 + k * 0.45);
    }
    idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2, v + 2, v + 3, v + 4);
    v += 5;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ============================================================ MERGED PROTOTYPES (instancing)
function colored(g: THREE.BufferGeometry, color: number, m: THREE.Matrix4) {
  const c = g.clone().toNonIndexed(); c.applyMatrix4(m);
  const col = new THREE.Color(color); const n = c.attributes.position.count; const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
  c.setAttribute('color', new THREE.BufferAttribute(a, 3)); c.deleteAttribute('uv');
  return c;
}
const M = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));
export function mergeParts(parts: [THREE.BufferGeometry, number, THREE.Matrix4][]) {
  const list = parts.map(([g, c, m]) => colored(g, c, m));
  let total = 0; for (const g of list) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  for (const g of list) { pos.set(g.attributes.position.array as Float32Array, o * 3); nor.set(g.attributes.normal.array as Float32Array, o * 3); col.set(g.attributes.color.array as Float32Array, o * 3); o += g.attributes.position.count; g.dispose(); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
export function waypointGeometry(kind: string): THREE.BufferGeometry {
  const B = new THREE.BoxGeometry(1, 1, 1), C = new THREE.ConeGeometry(1, 1, 4), C8 = new THREE.ConeGeometry(1, 1, 10), Y = new THREE.CylinderGeometry(1, 1, 1, 10), S = new THREE.SphereGeometry(1, 12, 8), I = new THREE.IcosahedronGeometry(1, 1);
  const base: [THREE.BufferGeometry, number, THREE.Matrix4] = [Y, 0x9ad872, M(0, 0.05, 0, 0.75, 0.1, 0.75)];
  let parts: [THREE.BufferGeometry, number, THREE.Matrix4][] = [];
  switch (kind) {
    case 'village': parts = [base, [B, 0xfff4e0, M(-0.2, 0.25, 0, 0.3, 0.3, 0.28)], [C, 0xe0583a, M(-0.2, 0.5, 0, 0.26, 0.25, 0.24, Math.PI / 4)], [B, 0xfff4e0, M(0.25, 0.22, 0.15, 0.26, 0.26, 0.24)], [C, 0x3aa0b8, M(0.25, 0.44, 0.15, 0.22, 0.22, 0.2, Math.PI / 4)], [I, 0x4ab04a, M(0.1, 0.35, -0.3, 0.2, 0.2, 0.2)]]; break;
    case 'shrine': parts = [base, [Y, 0xfff8ec, M(0, 0.2, 0, 0.25, 0.3, 0.25)], [S, 0xffcf4a, M(0, 0.45, 0, 0.2, 0.2, 0.2)], [C8, 0xffcf4a, M(0, 0.8, 0, 0.08, 0.5, 0.08)], [B, 0xd04a3a, M(-0.35, 0.3, 0.2, 0.04, 0.5, 0.04)], [B, 0xd04a3a, M(-0.1, 0.3, 0.3, 0.04, 0.5, 0.04)], [B, 0xd04a3a, M(-0.22, 0.55, 0.25, 0.4, 0.05, 0.06)]]; break;
    case 'fort': parts = [base, [Y, 0xe8dcc0, M(0, 0.35, 0, 0.2, 0.6, 0.2)], [C8, 0x3a6ad0, M(0, 0.8, 0, 0.26, 0.3, 0.26)], [B, 0xe8dcc0, M(0, 0.12, 0.32, 0.6, 0.2, 0.08)], [B, 0xe8dcc0, M(0.3, 0.12, 0, 0.08, 0.2, 0.6)]]; break;
    case 'camp': parts = [base, [C, 0xc84a3a, M(-0.2, 0.22, 0, 0.3, 0.45, 0.3, Math.PI / 4)], [C, 0xa8804a, M(0.25, 0.18, 0.15, 0.24, 0.36, 0.24, Math.PI / 4)], [Y, 0x5a3a24, M(0.05, 0.4, -0.3, 0.02, 0.8, 0.02)], [B, 0x1a1a1a, M(0.15, 0.7, -0.3, 0.25, 0.15, 0.02)], [S, 0xff8a2a, M(0.05, 0.08, 0.3, 0.08, 0.08, 0.08)]]; break;
    case 'ruin': parts = [base, [Y, 0xe0d4b8, M(-0.25, 0.25, 0, 0.09, 0.5, 0.09)], [Y, 0xd4c4a0, M(0.05, 0.18, -0.1, 0.09, 0.35, 0.09)], [Y, 0xe0d4b8, M(0.3, 0.3, 0.1, 0.09, 0.6, 0.09)], [S, 0x6ac04a, M(-0.25, 0.5, 0, 0.1, 0.04, 0.1)], [B, 0xd4c4a0, M(0, 0.07, 0.3, 0.6, 0.08, 0.15)]]; break;
    case 'lake': parts = [[Y, 0x9ad872, M(0, 0.04, 0, 0.8, 0.08, 0.8)], [Y, 0x4ac0e8, M(0, 0.07, 0, 0.6, 0.04, 0.5)], [I, 0x4ab04a, M(0.55, 0.25, 0.2, 0.18, 0.18, 0.18)], [Y, 0x6ab04a, M(-0.5, 0.15, -0.2, 0.02, 0.3, 0.02)], [Y, 0x6ab04a, M(-0.45, 0.15, -0.3, 0.02, 0.25, 0.02)]]; break;
    default: parts = [base];
  }
  const g = mergeParts(parts);
  [B, C, C8, Y, S, I].forEach((x) => x.dispose());
  return g;
}
export function treeGeometry(): THREE.BufferGeometry {
  const Y = new THREE.CylinderGeometry(1, 1, 1, 8), I = new THREE.IcosahedronGeometry(1, 1);
  const g = mergeParts([[Y, 0x9a6a3a, M(0, 0.3, 0, 0.08, 0.6, 0.08)], [I, 0xffffff, M(0, 0.85, 0, 0.42, 0.42, 0.42)], [I, 0xe8ffe0, M(0.2, 1.05, 0.1, 0.28, 0.28, 0.28)], [I, 0xd0e8c8, M(-0.2, 0.75, -0.1, 0.28, 0.28, 0.28)]]);
  Y.dispose(); I.dispose();
  return g;
}
