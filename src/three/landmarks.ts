import * as THREE from 'three';
import { CITY, CITY_INFO, type Landmark } from '../game/data';
import { mat, outline, puffyTree } from './models';

const gc = new Map<string, THREE.BufferGeometry>();
const G = <T extends THREE.BufferGeometry>(k: string, f: () => T) => { let g = gc.get(k); if (!g) { g = f(); gc.set(k, g); } return g as T; };
const box = (w: number, h: number, d: number) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (a: number, b: number, h: number, s = 12) => G(`c${a},${b},${h},${s}`, () => new THREE.CylinderGeometry(a, b, h, s));
const cone = (r: number, h: number, s = 12) => G(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const sph = (r: number, s = 14) => G(`s${r},${s}`, () => new THREE.SphereGeometry(r, s, Math.max(8, (s * 0.7) | 0)));
const hemi = (r: number) => G(`h${r}`, () => new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2));
const tor = (r: number, t: number) => G(`t${r},${t}`, () => new THREE.TorusGeometry(r, t, 8, 24));
const ico = (r: number) => G(`i${r}`, () => new THREE.IcosahedronGeometry(r, 1));

type C = THREE.ColorRepresentation;
function M(g: THREE.BufferGeometry, c: C, x = 0, y = 0, z = 0, o: { e?: C; ei?: number } = {}) {
  const m = new THREE.Mesh(g, mat(c, { emissive: o.e, ei: o.ei })); m.position.set(x, y, z); m.castShadow = true; return m;
}
const GOLD = 0xffcf4a;
const goldE = { e: 0x6a4a00, ei: 0.4 };

function spire(h: number, c: C = GOLD) { const g = new THREE.Group(); g.add(M(cone(0.1, h, 10), c, 0, h / 2, 0, goldE)); g.add(M(sph(0.06, 8), c, 0, h * 0.35, 0, goldE)); return g; }
function thaiRoof(w: number, d: number, c: C, tiers = 2) {
  const g = new THREE.Group(); let y = 0;
  for (let i = 0; i < tiers; i++) { const r = M(cone(1, 0.5, 4), c, 0, y + 0.25, 0); r.rotation.y = Math.PI / 4; r.scale.set(w * (1 - i * 0.22) * 0.72, 1, d * (1 - i * 0.22) * 0.72); g.add(r); y += 0.28; }
  return g;
}
function chedi(s: number, body: C, tip: C = GOLD) {
  const g = new THREE.Group();
  g.add(M(cyl(0.45, 0.55, 0.2, 16), body, 0, 0.1, 0));
  g.add(M(cyl(0.36, 0.45, 0.16, 16), body, 0, 0.28, 0));
  const bell = M(sph(0.36, 18), body, 0, 0.55, 0); bell.scale.y = 1.05; g.add(bell);
  g.add(M(cyl(0.12, 0.16, 0.12, 12), tip, 0, 0.9, 0, goldE));
  g.add(M(cone(0.12, 0.8, 12), tip, 0, 1.35, 0, goldE));
  g.scale.setScalar(s);
  return g;
}
function buddha(c: C, s = 1, e?: C) {
  const g = new THREE.Group(); const o = e ? { e, ei: 0.3 } : {};
  const base = M(cyl(0.55, 0.62, 0.22, 16), 0xf0e0c0, 0, 0.11, 0); g.add(base);
  const lotus = M(cyl(0.5, 0.4, 0.14, 12), 0xff9ab0, 0, 0.29, 0); g.add(lotus);
  const lap = M(sph(0.45, 16), c, 0, 0.45, 0.05, o); lap.scale.set(1.2, 0.45, 0.9); g.add(lap);
  const body = M(sph(0.32, 16), c, 0, 0.78, 0, o); body.scale.set(1, 1.25, 0.8); g.add(body);
  g.add(M(sph(0.2, 16), c, 0, 1.22, 0.02, o));
  g.add(M(cone(0.08, 0.22, 10), c, 0, 1.44, 0, o));
  const halo = M(tor(0.34, 0.04), GOLD, 0, 1.15, -0.25, goldE); g.add(halo);
  g.scale.setScalar(s);
  return g;
}
function water(w: number, d: number, x = 0, z = 0) { const m = new THREE.Mesh(box(w, 0.04, d), mat(0x4ac0e8, { emissive: 0x1a6a8a, ei: 0.25 })); m.position.set(x, 0.27, z); m.receiveShadow = true; return m; }

const LM: Record<Landmark, () => THREE.Group> = {
  palace: () => { const g = new THREE.Group();
    g.add(M(box(1.3, 0.35, 0.8), 0xfff4e0, 0, 0.2, 0));
    const r = thaiRoof(1.6, 1.0, 0xd04a3a, 3); r.position.y = 0.38; g.add(r);
    const r2 = thaiRoof(1.3, 0.75, 0x3aa058, 2); r2.position.y = 0.7; g.add(r2);
    [-0.55, 0, 0.55].forEach((x, i) => { const sp = spire(i === 1 ? 1.2 : 0.8); sp.position.set(x, i === 1 ? 1.2 : 0.95, 0); g.add(sp); });
    [-0.9, 0.9].forEach((x) => { const c = chedi(0.55, GOLD); c.position.set(x, 0, 0.55); g.add(c); });
    return g; },
  brickruins: () => { const g = new THREE.Group(); const brick = 0xc8663a, d = 0xa04a2a;
    ([[0, 0, 1.3], [-0.65, 0.3, 0.9], [0.65, 0.3, 0.9], [0.2, -0.6, 0.6]] as const).forEach(([x, z, s]) => { const t = new THREE.Group();
      for (let i = 0; i < 4; i++) t.add(M(cyl(0.3 - i * 0.05, 0.33 - i * 0.05, 0.3, 8), i % 2 ? brick : d, 0, 0.15 + i * 0.3, 0));
      t.add(M(cone(0.18, 0.5, 8), brick, 0, 1.45, 0)); t.scale.setScalar(s); t.position.set(x, 0, z); g.add(t); });
    for (let i = 0; i < 5; i++) g.add(M(box(0.18, 0.12, 0.18), d, -0.8 + i * 0.35, 0.06, 0.8));
    return g; },
  buddhaRuins: () => { const g = new THREE.Group(); const b = buddha(0xe8e0d0, 1.1); b.position.z = -0.1; g.add(b);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI + Math.PI; const h = 0.5 + (i % 3) * 0.25; g.add(M(cyl(0.08, 0.1, h, 8), 0xd8ccb0, Math.cos(a) * 0.95, h / 2, Math.sin(a) * -0.6 + 0.3)); }
    return g; },
  goldMountain: () => { const g = new THREE.Group(); const hill = M(hemi(1.0), 0x4aa850, 0, 0, 0); hill.scale.set(1.2, 1.1, 1.1); g.add(hill);
    const c = chedi(0.9, GOLD); c.position.y = 1.0; g.add(c);
    for (let i = 0; i < 5; i++) { const t = puffyTree(0.45, 0x3a9a48); const a = i * 1.25; t.position.set(Math.cos(a) * 0.9, 0.2, Math.sin(a) * 0.8); g.add(t); }
    return g; },
  whiteTemple: () => { const g = new THREE.Group(); const w = 0xffffff, silver = 0xdfe8ff; const e = { e: 0x8ab0e0, ei: 0.3 };
    g.add(M(box(0.9, 0.4, 1.3), w, 0, 0.2, 0, e));
    for (let i = 0; i < 3; i++) { const r = M(cone(1, 0.5, 4), silver, 0, 0.62 + i * 0.3, 0, e); r.rotation.y = Math.PI / 4; r.scale.set(0.8 - i * 0.18, 1, 1.1 - i * 0.25); g.add(r); }
    const s = spire(0.9, silver); s.position.y = 1.4; g.add(s);
    [-0.6, 0.6].forEach((x) => { const s2 = spire(0.7, w); s2.position.set(x, 0.35, 0.7); g.add(s2); });
    g.add(M(box(0.3, 0.05, 0.8), 0x9ad8ff, 0, 0.27, 1.2, { e: 0x4a9ad8, ei: 0.4 }));
    return g; },
  beachTowers: () => { const g = new THREE.Group(); const sand = M(cyl(1.3, 1.3, 0.06, 20), 0xfff0c0, 0, 0.27, 0.4); sand.scale.z = 0.5; g.add(sand);
    ([[-0.6, -0.3, 1.6, 0xff7ac0], [-0.1, -0.5, 2.1, 0x5ac0f0], [0.45, -0.25, 1.4, 0xffd04a], [0.85, -0.55, 1.8, 0x9a7aff]] as const).forEach(([x, z, h, c]) => { g.add(M(box(0.34, h, 0.34), c, x, h / 2 + 0.25, z)); g.add(M(box(0.36, 0.05, 0.36), 0xffffff, x, h + 0.25, z)); for (let k = 1; k < h * 4; k++) g.add(M(box(0.35, 0.03, 0.35), 0xffffff, x, 0.25 + k * 0.24, z)); });
    return g; },
  bridge: () => { const g = new THREE.Group(); g.add(water(3.1, 0.7, 0, 0.2));
    const steel = 0x5a6a7a;
    [-1, 0, 1].forEach((i) => { const arch = M(tor(0.45, 0.05), steel, i * 0.9, 0.55, 0.2); arch.scale.y = 0.8; g.add(arch); });
    g.add(M(box(2.9, 0.08, 0.35), 0x7a5a3a, 0, 0.55, 0.2));
    const train = new THREE.Group(); [0, 0.42, 0.84].forEach((x, i) => { train.add(M(box(0.38, 0.22, 0.26), i === 0 ? 0x2a2a3a : 0xd04a3a, x, 0.72, 0.2)); }); train.add(M(cyl(0.05, 0.05, 0.18, 8), 0x2a2a3a, -0.1, 0.9, 0.2)); train.position.x = -0.7; g.add(train);
    return g; },
  seaPier: () => { const g = new THREE.Group(); g.add(water(3, 1.1, 0, 0.8));
    for (let i = 0; i < 6; i++) g.add(M(box(0.3, 0.04, 0.2), 0x9a6a3a, 0.5, 0.35, 0.3 + i * 0.2));
    g.add(M(box(1.0, 0.45, 0.6), 0xfffaf0, -0.3, 0.45, -0.2)); const r = thaiRoof(1.3, 0.8, 0x3aa0b8, 2); r.position.set(-0.3, 0.68, -0.2); g.add(r);
    for (let i = 0; i < 4; i++) g.add(M(cyl(0.03, 0.03, 0.45, 6), 0x9a6a3a, -0.75 + i * 0.3, 0.2, 0.15));
    return g; },
  dragonGate: () => { const g = new THREE.Group(); const red = 0xd02a2a;
    [-0.55, 0.55].forEach((x) => { g.add(M(cyl(0.08, 0.08, 1.2, 10), red, x, 0.6, 0.3)); });
    g.add(M(box(1.5, 0.12, 0.3), GOLD, 0, 1.22, 0.3, goldE)); const roof = M(cone(1, 0.35, 4), 0x2a8a4a, 0, 1.42, 0.3); roof.rotation.y = Math.PI / 4; roof.scale.set(1.2, 1, 0.35); g.add(roof);
    for (let i = 0; i < 9; i++) { const t = i / 8; g.add(M(sph(0.12 - t * 0.04, 10), i % 2 ? 0x3ab050 : GOLD, -0.9 + t * 1.8, 0.6 + Math.sin(t * Math.PI * 2) * 0.25 + t * 0.4, -0.35)); }
    g.add(M(sph(0.16, 12), 0x3ab050, 0.95, 1.1, -0.35));
    return g; },
  khmer: () => { const g = new THREE.Group(); const sand = 0xd8b07a, d = 0xc09a62;
    g.add(M(box(1.6, 0.2, 1.2), d, 0, 0.1, 0));
    ([[0, 0, 1.2], [-0.55, 0.3, 0.75], [0.55, 0.3, 0.75]] as const).forEach(([x, z, s]) => { const t = new THREE.Group();
      t.add(M(box(0.5, 0.45, 0.5), sand, 0, 0.42, 0));
      for (let i = 0; i < 5; i++) t.add(M(cyl(0.22 - i * 0.035, 0.26 - i * 0.035, 0.18, 8), i % 2 ? sand : d, 0, 0.73 + i * 0.17, 0));
      t.add(M(sph(0.07, 8), sand, 0, 1.6, 0)); t.scale.setScalar(s); t.position.set(x, 0, z); g.add(t); });
    return g; },
  bigBuddhaGold: () => { const g = new THREE.Group(); const b = buddha(GOLD, 1.3, 0x6a4a00); g.add(b);
    const flame = M(tor(0.55, 0.06), 0xffb030, 0, 1.35, -0.3, { e: 0xff8a00, ei: 0.6 }); flame.scale.y = 1.25; g.add(flame);
    return g; },
  dino: () => { const g = new THREE.Group(); const c = 0x6ac04a, belly = 0xd8f0a0;
    const body = M(sph(0.5, 16), c, 0, 0.75, 0); body.scale.set(1.3, 0.85, 0.8); g.add(body);
    g.add(M(sph(0.35, 14), belly, 0, 0.62, 0.15));
    for (let i = 0; i < 6; i++) { const t = i / 5; g.add(M(sph(0.16 - t * 0.04, 10), c, 0.55 + t * 0.35, 1.0 + t * 0.9, 0)); }
    const head = M(sph(0.2, 12), c, 0.98, 1.95, 0); head.scale.set(1.3, 0.9, 0.9); g.add(head);
    for (const s of [-1, 1]) { g.add(M(sph(0.045, 8), 0xffffff, 1.12, 2.0, s * 0.1)); g.add(M(sph(0.025, 6), 0x1a1a1a, 1.15, 2.0, s * 0.12)); }
    for (let i = 0; i < 5; i++) { const t = i / 4; g.add(M(sph(0.15 - t * 0.1, 10), c, -0.65 - t * 0.7, 0.7 - t * 0.35, 0)); }
    for (const [x, z] of [[-0.35, -0.25], [-0.35, 0.25], [0.35, -0.25], [0.35, 0.25]]) g.add(M(cyl(0.11, 0.12, 0.5, 10), c, x, 0.35, z));
    for (let i = 0; i < 5; i++) g.add(M(cone(0.07, 0.16, 6), 0xffa030, -0.4 + i * 0.2, 1.17 - Math.abs(i - 2) * 0.05, 0));
    return g; },
  boats: () => { const g = new THREE.Group(); g.add(water(3, 1.2, 0, 0.3));
    ([[-0.8, 0.1, 0xd04a3a], [0.1, 0.45, 0x3a8ac0], [0.9, 0.05, 0xffb030]] as const).forEach(([x, z, c], i) => { const b = new THREE.Group();
      const hull = M(sph(0.3, 12), c, 0, 0.3, 0); hull.scale.set(2.0, 0.35, 0.55); b.add(hull);
      for (let k = 0; k < 4; k++) b.add(M(sph(0.06, 8), [0xffe14a, 0x6ad04a, 0xff7a3a, 0xff4a8a][k], -0.3 + k * 0.18, 0.4, 0));
      const hat = M(cone(0.14, 0.1, 10), 0xf0d890, 0.35, 0.52, 0); b.add(hat); b.add(M(sph(0.08, 8), 0xffd8b0, 0.35, 0.45, 0));
      b.rotation.y = i * 0.4 - 0.4; b.position.set(x, 0, z); g.add(b); });
    g.add(M(box(0.7, 0.35, 0.4), 0xfaf0e0, -0.6, 0.45, -0.55)); const r = thaiRoof(0.9, 0.6, 0x2a8ac0, 1); r.position.set(-0.6, 0.62, -0.55); g.add(r);
    return g; },
  lotus: () => { const g = new THREE.Group(); const pond = M(cyl(1.25, 1.25, 0.05, 24), 0x4ac0d8, 0, 0.27, 0, { e: 0x1a6a8a, ei: 0.2 }); g.add(pond);
    for (let i = 0; i < 26; i++) { const a = i * 2.4, r = 0.25 + ((i * 37) % 10) / 10 * 0.9; const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const pad = M(cyl(0.12, 0.12, 0.02, 10), 0x4ab04a, x, 0.3, z); g.add(pad);
      if (i % 2 === 0) { const f = M(cone(0.08, 0.14, 6), 0xff5a8a, x, 0.39, z, { e: 0xaa2a4a, ei: 0.2 }); g.add(f); g.add(M(sph(0.035, 6), 0xffe14a, x, 0.43, z)); } }
    return g; },
  candle: () => { const g = new THREE.Group();
    g.add(M(box(1.0, 0.2, 0.7), 0x9a6a3a, 0, 0.35, 0));
    for (const [x, z] of [[-0.4, -0.35], [0.4, -0.35], [-0.4, 0.35], [0.4, 0.35]]) { const w = M(tor(0.12, 0.03), 0x5a3a24, x, 0.3, z); w.rotation.y = Math.PI / 2; g.add(w); }
    g.add(M(cyl(0.22, 0.26, 1.4, 16), 0xffc040, 0, 1.15, 0, { e: 0x7a4a00, ei: 0.35 }));
    for (let i = 0; i < 5; i++) g.add(M(tor(0.25, 0.04), 0xffe08a, 0, 0.6 + i * 0.28, 0, goldE));
    const fl = M(sph(0.1, 10), 0xffe08a, 0, 1.97, 0, { e: 0xff9a2a, ei: 1.4 }); fl.scale.y = 1.6; g.add(fl);
    [-0.55, 0.55].forEach((x) => { const s = spire(0.5); s.position.set(x, 0.45, 0); g.add(s); });
    return g; },
  bigBuddhaWhite: () => { const g = new THREE.Group(); const hill = M(hemi(1.0), 0x4aa850, 0, 0, 0); hill.scale.set(1.2, 0.8, 1.1); g.add(hill);
    const b = buddha(0xfaf8f4, 1.1); b.position.y = 0.7; g.add(b); return g; },
  lanterns: () => { const g = new THREE.Group(); const red = 0xd02a2a;
    g.add(M(box(0.9, 0.5, 0.6), red, 0, 0.5, -0.2)); const roof = M(cone(1, 0.3, 4), 0xffc020, 0, 0.9, -0.2, goldE); roof.rotation.y = Math.PI / 4; roof.scale.set(0.85, 1, 0.6); g.add(roof);
    for (const x of [-1, 1]) g.add(M(cyl(0.03, 0.03, 1.2, 6), 0x5a3a24, x * 1.0, 0.6, 0.5));
    for (let i = 0; i < 7; i++) { const t = i / 6; const lx = -1 + t * 2; const ly = 1.15 - Math.sin(t * Math.PI) * 0.25; const l = M(sph(0.09, 10), red, lx, ly, 0.5, { e: 0xff3a1a, ei: 0.6 }); l.scale.y = 1.25; g.add(l); }
    return g; },
  carriage: () => { const g = new THREE.Group();
    g.add(M(box(0.9, 0.4, 0.6), 0xf0dcc0, -0.4, 0.45, -0.4)); const r = thaiRoof(1.2, 0.8, 0x7a4a2a, 2); r.position.set(-0.4, 0.66, -0.4); g.add(r);
    const cart = new THREE.Group(); cart.add(M(box(0.5, 0.3, 0.35), 0xd04a3a, 0, 0.45, 0)); cart.add(M(box(0.55, 0.04, 0.4), 0xffe08a, 0, 0.62, 0));
    for (const s of [-1, 1]) { const w = M(tor(0.14, 0.025), 0x3a2a1a, -0.1, 0.3, s * 0.2); g.add(w); cart.add(w.clone()); }
    const horse = new THREE.Group(); const hb = M(sph(0.18, 12), 0xf5f0e8, 0, 0.45, 0); hb.scale.set(1.6, 0.9, 0.8); horse.add(hb); horse.add(M(sph(0.1, 10), 0xf5f0e8, 0.32, 0.65, 0));
    for (const [x, z] of [[-0.15, -0.08], [-0.15, 0.08], [0.15, -0.08], [0.15, 0.08]]) horse.add(M(cyl(0.03, 0.03, 0.3, 6), 0xf5f0e8, x, 0.18, z));
    horse.position.x = 0.6; cart.add(horse); cart.position.set(0.3, 0, 0.5); g.add(cart);
    return g; },
  crossTemple: () => { const g = new THREE.Group(); const w = 0xf8ecd8;
    g.add(M(box(1.3, 0.4, 0.5), w, 0, 0.3, 0)); g.add(M(box(0.5, 0.4, 1.3), w, 0, 0.3, 0));
    const r1 = thaiRoof(1.7, 0.7, 0xd04a3a, 2); r1.position.y = 0.5; g.add(r1); const r2 = thaiRoof(0.7, 1.7, 0xd04a3a, 2); r2.position.y = 0.5; g.add(r2);
    const s = spire(0.8); s.position.y = 1.0; g.add(s);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.add(M(sph(0.1, 10), 0xe0a030, Math.cos(a) * 0.7, 0.55, Math.sin(a) * 0.7, goldE)); }
    return g; },
  misty: () => { const g = new THREE.Group();
    ([[-0.4, -0.3, 1.0, 1.5], [0.4, -0.4, 0.8, 1.2], [0.0, 0.2, 0.6, 0.9]] as const).forEach(([x, z, s, h]) => { const m = M(hemi(1), 0x5a9a6a, x, 0, z); m.scale.set(s, h, s); g.add(m); });
    for (let i = 0; i < 5; i++) { const c = M(sph(0.35, 12), 0xffffff, -0.7 + i * 0.35, 0.9 + (i % 2) * 0.2, 0.3, { e: 0xe8e8ff, ei: 0.3 }); c.scale.y = 0.4; g.add(c); }
    const mask = new THREE.Group(); mask.add(M(sph(0.3, 14), 0xff4a8a, 0, 0, 0)); mask.add(M(sph(0.08, 8), 0xffffff, -0.1, 0.05, 0.25)); mask.add(M(sph(0.08, 8), 0xffffff, 0.1, 0.05, 0.25)); mask.add(M(cone(0.08, 0.35, 8), 0x4ad0e0, 0, -0.05, 0.35));
    const nose = mask.children[3]; nose.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) { const h = M(cone(0.06, 0.3, 8), 0xffe14a, s * 0.22, 0.3, 0); h.rotation.z = -s * 0.5; mask.add(h); }
    mask.position.set(0.7, 0.45, 0.7); g.add(mask);
    return g; },
  tallStupa: () => { const g = new THREE.Group(); const w = 0xfff8ec;
    g.add(M(box(0.9, 0.3, 0.9), w, 0, 0.15, 0)); g.add(M(box(0.7, 0.8, 0.7), w, 0, 0.7, 0)); g.add(M(box(0.72, 0.08, 0.72), GOLD, 0, 1.1, 0, goldE));
    const t = M(cone(0.4, 1.4, 4), w, 0, 1.85, 0); t.rotation.y = Math.PI / 4; g.add(t);
    const s = spire(0.6); s.position.y = 2.5; g.add(s);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.add(M(box(0.05, 0.4, 0.05), GOLD, Math.cos(a) * 0.36, 0.7, Math.sin(a) * 0.36, goldE)); }
    return g; },
  stadium: () => { const g = new THREE.Group();
    const st = M(tor(0.7, 0.18), 0x3a6ad0, 0.4, 0.4, 0.2); st.rotation.x = Math.PI / 2; st.scale.set(1.3, 1, 1); g.add(st);
    const field = M(cyl(0.6, 0.6, 0.04, 20), 0x5ad04a, 0.4, 0.3, 0.2); field.scale.x = 1.3; g.add(field);
    const k = new THREE.Group(); for (let i = 0; i < 4; i++) k.add(M(cyl(0.2 - i * 0.04, 0.24 - i * 0.04, 0.2, 8), 0xd8b07a, 0, 0.12 + i * 0.2, 0)); k.add(M(box(0.4, 0.3, 0.4), 0xc09a62, 0, 0.15, 0)); k.position.set(-0.8, 0, -0.4); k.scale.setScalar(1.2); g.add(k);
    return g; },
  cathedral: () => { const g = new THREE.Group(); const w = 0xfaf4ec, blue = 0x3a6ab0;
    g.add(M(box(0.6, 0.6, 1.2), w, 0, 0.4, 0)); const r = M(cone(1, 0.4, 4), blue, 0, 0.9, 0); r.rotation.y = Math.PI / 4; r.scale.set(0.5, 1, 0.9); g.add(r);
    [-0.25, 0.25].forEach((x) => { g.add(M(box(0.25, 1.2, 0.25), w, x, 0.7, 0.65)); g.add(M(cone(0.18, 0.55, 4), blue, x, 1.58, 0.65)); });
    g.add(M(cyl(0.12, 0.12, 0.02, 16), 0xa04ad0, 0, 0.8, 0.79, { e: 0x6a2aa0, ei: 0.5 }));
    for (let i = 0; i < 5; i++) g.add(M(ico(0.07), [0x6ae0c0, 0xff4a8a, 0x5aa0ff, 0xffe14a, 0xd04ad0][i], -0.8 + i * 0.4, 0.35, 1.0, { e: 0x333333, ei: 0.5 }));
    return g; },
  coastRock: () => { const g = new THREE.Group(); g.add(water(3, 1.0, 0, 0.8));
    const rk = M(ico(0.55), 0x9a9a8a, 0.3, 0.35, 0); rk.scale.set(1.3, 0.8, 1); g.add(rk);
    for (let i = 0; i < 4; i++) g.add(M(cyl(0.16 - i * 0.015, 0.18 - i * 0.015, 0.3, 12), i % 2 ? 0xd03a3a : 0xffffff, 0.3, 0.9 + i * 0.3, 0));
    g.add(M(cyl(0.14, 0.14, 0.15, 10), 0xffe08a, 0.3, 2.1, 0, { e: 0xffb020, ei: 1.2 })); g.add(M(cone(0.18, 0.25, 10), 0xd03a3a, 0.3, 2.3, 0));
    return g; },
  whiteStupa: () => { const g = new THREE.Group(); const c = chedi(1.35, 0xffffff); g.add(c);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const m = chedi(0.3, 0xfff4e0); m.position.set(Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95); g.add(m); }
    return g; },
  karst: () => { const g = new THREE.Group(); g.add(water(3, 1.3, 0, 0.3));
    ([[-0.6, -0.2, 1.8], [0.2, -0.45, 2.3], [0.8, 0.1, 1.5], [-0.1, 0.5, 1.2]] as const).forEach(([x, z, h]) => { const p = M(ico(0.35), 0xb8b4a8, x, h / 2 + 0.2, z); p.scale.set(1, h / 0.7, 1); g.add(p); const top = M(sph(0.3, 12), 0x4ab050, x, h + 0.25, z); top.scale.y = 0.5; g.add(top); });
    return g; },
};

function house(w: number, h: number, wall: number, roof: number) {
  const g = new THREE.Group();
  g.add(M(box(w, h, w * 0.85), wall, 0, h / 2, 0));
  const r = M(cone(w * 0.82, h * 0.8, 4), roof, 0, h + h * 0.4, 0); r.rotation.y = Math.PI / 4; r.scale.set(1, 1, 0.9); g.add(r);
  g.add(M(box(w * 0.25, h * 0.45, 0.02), 0x8a5a30, 0, h * 0.23, w * 0.43));
  return g;
}

/** Unique, themed city model. */
export function makeUniqueCity(id: string): THREE.Group {
  const info = CITY_INFO[id]; const c = CITY[id];
  const g = new THREE.Group();
  const base = M(cyl(1.7, 1.9, 0.25, 28), info.ground, 0, 0.12, 0); base.receiveShadow = true; g.add(base);
  const rim = M(tor(1.7, 0.1), info.wall, 0, 0.27, 0); rim.rotation.x = Math.PI / 2; g.add(rim);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.25; const tw = M(cyl(0.12, 0.14, 0.42, 10), info.wall, Math.cos(a) * 1.7, 0.42, Math.sin(a) * 1.7); g.add(tw);
    g.add(M(cone(0.17, 0.22, 10), info.roofs[i % info.roofs.length], Math.cos(a) * 1.7, 0.74, Math.sin(a) * 1.7));
  }
  // houses on outer ring (back half so landmark stays visible)
  const nh = 3 + Math.min(4, Math.round(c.tier / 2));
  for (let i = 0; i < nh; i++) {
    const a = Math.PI + (i / (nh - 1 || 1)) * Math.PI * 0.95 + 0.05; const r = 1.25;
    const hs = house(0.3 + (i % 3) * 0.04, 0.25 + (i % 2) * 0.1, info.wall, info.roofs[i % info.roofs.length]);
    hs.position.set(Math.cos(a) * r, 0.25, Math.sin(a) * r * 0.9); hs.rotation.y = -a - Math.PI / 2; g.add(hs);
  }
  for (let i = 0; i < 2; i++) { const t = puffyTree(0.45, 0x4ab04a); const a = 0.5 + i * 2.2; t.position.set(Math.cos(a) * 1.3, 0.25, Math.sin(a) * 1.3); g.add(t); }
  const lm = LM[info.landmark]();
  lm.position.y = 0.25;
  lm.scale.multiplyScalar(id === 'bkk' ? 1.1 : 0.95);
  g.add(lm);
  // city banner
  const pole = M(cyl(0.02, 0.02, 1.0, 6), 0x8a5a30, 1.25, 0.75, 0.9); g.add(pole);
  const flag = new THREE.Mesh(box(0.4, 0.26, 0.01), mat(info.color)); flag.position.set(1.45, 1.1, 0.9); g.add(flag);
  outline(g);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.receiveShadow = true; });
  return g;
}
