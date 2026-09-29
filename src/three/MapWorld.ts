import * as THREE from 'three';
import { CITIES, CITY, CITY_INFO, EDGES, NODE, NODES, NODE_KIND_INFO, OUTLINE, inPoly, proj } from '../game/data';
import { makeUniqueCity } from './landmarks';
import type { ClassId } from '../game/types';
import { makeCloud, makeHero, makeTankProp, mat, toonGradient, treeGeometry, walkPose, waypointGeometry, type Rig } from './models';
import { ParticleSystem } from './particles';
import { dashTexture, glowTexture, labelTexture, landTexture, textSprite } from './textures';

export const LAND_H = 0.8;
export const MAP_SCALE = 3;
const W2 = (x: number, y: number, h = LAND_H) => new THREE.Vector3(((x - 225) / 10) * MAP_SCALE, h, ((y - 350) / 10) * MAP_SCALE);
const tierHex = (t: number) => ['#4ade80', '#86efac', '#facc15', '#fb923c', '#f97316', '#ef4444', '#dc2626', '#b91c1c'][Math.min(7, Math.max(0, Math.round(t) - 1))];

function shapeFrom(pts: { x: number; y: number }[]) {
  const s = new THREE.Shape();
  pts.forEach((p, i) => { const v = W2(p.x, p.y); if (i) s.lineTo(v.x, -v.z); else s.moveTo(v.x, -v.z); });
  s.closePath();
  return s;
}
const NEIGHBOURS: [number, number][][] = [
  [[95, 22.5], [108.5, 22.5], [108.5, 10], [104.8, 8.6], [104, 10.4], [103, 11.3], [102.9, 11.7], [101.5, 14.5], [99.5, 14.5], [98.9, 12.0], [98.6, 10.0], [98.0, 11.5], [97.7, 13], [97.6, 15], [97.2, 16.5], [95, 16.5]],
  [[100.1, 6.5], [101.1, 6.0], [101.8, 5.8], [102.1, 6.2], [103.4, 4.8], [103.5, 1.5], [101, 2.8], [100.3, 5.3]],
];
const FRONT = [[98.4, 17.2], [99.6, 16.5], [101, 15.7], [102.6, 15.9], [104.5, 16.8]].map(([lo, la]) => proj(lo, la));
const FIRES = [[101.2, 15.85], [101.35, 15.75], [101.1, 15.7]].map(([lo, la]) => proj(lo, la));
const TANKS = [[101.0, 15.95], [101.4, 15.95], [101.2, 16.05]].map(([lo, la]) => proj(lo, la));

export class MapWorld {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.5, 400);
  container: HTMLElement;
  onCityClick: (id: string) => void = () => {};
  private raf = 0; private active = true; private last = 0; private time = 0;
  private fire: ParticleSystem; private smoke: ParticleSystem;
  private cityLabels: Record<string, THREE.Sprite> = {};
  private qrings: Record<string, THREE.Mesh> = {};
  private hero: Rig; private marker: THREE.Group; private crystal: THREE.Mesh; private ring: THREE.Mesh;
  private tokenPos = new THREE.Vector3(); private tokenPrev = new THREE.Vector3();
  private moving = false; private walkPh = 0;
  private selRing: THREE.Mesh; private beam: THREE.Mesh; private selLabel: THREE.Sprite; private selId: string | null = null;
  private pathGroup = new THREE.Group(); private dashTex = dashTexture();
  private alert: THREE.Sprite; private alertT = -1;
  private seaMat: THREE.ShaderMaterial;
  private clouds: THREE.Group[] = [];
  private visitedMesh: THREE.InstancedMesh | null = null;
  private disposables: { dispose(): void }[] = [];
  private target = new THREE.Vector3(); private desired: THREE.Vector3 | null = null; private follow = false;
  private dist = 30; private userDist = 30; private pitch = 0.95;
  private ro: ResizeObserver;
  private pointers = new Map<number, { x: number; y: number }>();
  private downAt = { x: 0, y: 0, moved: 0 }; private pinch0 = 0;
  private nodeWorld: { id: string; p: THREE.Vector3 }[] = [];
  private sun!: THREE.DirectionalLight;

  constructor(container: HTMLElement, members: { cls: ClassId; color: string }[]) {
    this.container = container;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.75 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.display = 'block';

    const fogC = new THREE.Color('#bfe6f5');
    this.scene.background = fogC;
    this.scene.fog = new THREE.Fog(fogC, 60, 180);
    this.scene.add(new THREE.HemisphereLight(0xdff2ff, 0x6aa050, 1.35));
    const sun = new THREE.DirectionalLight(0xfff0d0, 2.2);
    sun.position.set(-22, 45, 20); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 140;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    this.scene.add(sun); this.scene.add(sun.target); this.sun = sun;

    // sea (bright turquoise with sparkles)
    this.seaMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFog: { value: fogC } },
      vertexShader: `varying vec3 vW; varying float vD; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW=w.xyz; vec4 mv=viewMatrix*w; vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform float uTime; uniform vec3 uFog; varying vec3 vW; varying float vD;
        void main(){
          float w = sin(vW.x*0.8+uTime*1.1)*sin(vW.z*0.6-uTime*0.8) + sin((vW.x+vW.z)*1.6+uTime*1.8)*0.4;
          vec3 deep = vec3(0.16,0.55,0.82); vec3 sh = vec3(0.35,0.8,0.9);
          vec3 c = mix(deep, sh, 0.45+0.2*w);
          c += vec3(1.0)*step(1.22, w)*0.45;
          float f = smoothstep(60.0,150.0,vD);
          gl_FragColor = vec4(mix(c,uFog,f),1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), this.seaMat);
    sea.rotation.x = -Math.PI / 2; sea.position.y = 0.05; this.scene.add(sea);

    // neighbours
    const nbTop = new THREE.MeshToonMaterial({ color: 0xb8d8a0, gradientMap: toonGradient() });
    const nbSide = new THREE.MeshToonMaterial({ color: 0xd8c8a0, gradientMap: toonGradient() });
    for (const poly of NEIGHBOURS) {
      const g = new THREE.ExtrudeGeometry(shapeFrom(poly.map(([lo, la]) => proj(lo, la))), { depth: 0.45, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, [nbTop, nbSide]); m.receiveShadow = true; this.scene.add(m);
    }
    ([['เมียนมา', 97.3, 18.6], ['ลาว', 102.8, 19.6], ['กัมพูชา', 104.3, 13.3], ['มาเลเซีย', 101.9, 4.9], ['อ่าวไทย', 101.0, 10.8], ['ทะเลอันดามัน', 97.2, 9.0]] as const).forEach(([t, lo, la]) => {
      const p = proj(lo, la); const s = this.makeLabel(t, '', '#fff', 0.55); s.position.copy(W2(p.x, p.y, 1.2)); s.scale.multiplyScalar(3.2); this.scene.add(s);
    });

    // land
    const landG = new THREE.ExtrudeGeometry(shapeFrom(OUTLINE), { depth: LAND_H, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 3 });
    landG.rotateX(-Math.PI / 2); landG.translate(0, -0.15, 0);
    const pos = landG.attributes.position; const uv = landG.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) / MAP_SCALE + 22.5) / 45, 1 - (pos.getZ(i) / MAP_SCALE + 35) / 70);
    const land = new THREE.Mesh(landG, [new THREE.MeshToonMaterial({ map: landTexture(OUTLINE, proj, FRONT), gradientMap: toonGradient() }), new THREE.MeshToonMaterial({ color: 0xf0dca0, gradientMap: toonGradient() })]);
    land.receiveShadow = true; this.scene.add(land);

    this.buildNature();
    this.buildRoads();
    this.buildNodes();

    // selection
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.35, 40), new THREE.MeshBasicMaterial({ color: 0xffd35a, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    this.selRing.rotation.x = -Math.PI / 2; this.selRing.visible = false; this.scene.add(this.selRing);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.0, 12, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.visible = false; this.scene.add(this.beam);
    this.selLabel = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
    this.selLabel.visible = false; this.selLabel.renderOrder = 16; this.scene.add(this.selLabel);
    this.scene.add(this.pathGroup);

    // leader + marker
    this.hero = makeHero(members[0].cls, members[0].color);
    this.hero.root.scale.setScalar(1.35);
    this.hero.root.traverse((o) => { if ((o as THREE.Mesh).isMesh && !o.userData.outline) o.castShadow = true; });
    this.scene.add(this.hero.root);
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.9, 6), mat(0x8a5a30)); flagPole.position.set(-0.3, 1.1, -0.2); this.hero.root.add(flagPole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.38, 6, 1), new THREE.MeshToonMaterial({ color: 0xe04a3a, side: THREE.DoubleSide, gradientMap: toonGradient() }));
    flag.geometry.translate(0.3, 0, 0); flag.position.set(-0.3, 1.85, -0.2); this.hero.root.add(flag); flag.userData.flag = true;
    this.marker = new THREE.Group();
    const addM = (c: number, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 40), addM(0xffd35a)); this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.08; this.marker.add(this.ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), addM(0xffc040, 0.2)); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.07; this.marker.add(disc);
    this.crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshToonMaterial({ color: 0xffd35a, emissive: 0xff9a00, emissiveIntensity: 0.9, gradientMap: toonGradient() }));
    this.crystal.scale.set(1, 1.6, 1); this.crystal.position.y = 3.2; this.marker.add(this.crystal);
    this.scene.add(this.marker);
    this.alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: textSprite('!'), depthTest: false, transparent: true }));
    this.alert.visible = false; this.alert.renderOrder = 20; this.alert.position.y = 4.2; this.marker.add(this.alert);

    this.fire = new ParticleSystem(500, THREE.AdditiveBlending);
    this.smoke = new ParticleSystem(500, THREE.NormalBlending); this.smoke.mat.uniforms.uOpacity.value = 0.35;
    this.scene.add(this.fire.points, this.smoke.points);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.bindInput();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private makeLabel(text: string, sub: string, subColor: string, opacity = 1) {
    const { tex, aspect } = labelTexture(text, sub, subColor);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, opacity }));
    s.scale.set(2.1 * aspect, 2.1, 1); s.renderOrder = 15;
    this.disposables.push(tex);
    return s;
  }

  private buildNature() {
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const nearNode = (x: number, y: number, r: number) => NODES.some((c) => Math.hypot(c.x - x, c.y - y) < (c.kind === 'city' ? r : r * 0.55));
    const nearRoad = (x: number, y: number) => EDGES.some(([a, b]) => { const A = NODE[a], B = NODE[b]; const dx = B.x - A.x, dy = B.y - A.y; const t = Math.max(0, Math.min(1, ((x - A.x) * dx + (y - A.y) * dy) / (dx * dx + dy * dy))); return Math.hypot(A.x + dx * t - x, A.y + dy * t - y) < 5; });
    const g = toonGradient();
    // ---- mountain RANGES (clustered along ridge lines)
    const mG = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const mM = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: g });
    const mts: THREE.Matrix4[] = []; const cols: THREE.Color[] = []; const caps: THREE.Matrix4[] = [];
    const RANGES: [number, number][][] = [
      [[98.3, 20.0], [98.6, 19.3], [98.4, 18.5], [98.2, 17.6]],        // Thanon Thong Chai
      [[100.2, 19.9], [100.6, 19.2], [100.9, 18.4], [101.0, 17.6]],     // Luang Prabang range
      [[98.7, 16.8], [98.9, 16.0], [98.9, 15.2], [99.1, 14.5]],         // Tenasserim north
      [[101.3, 16.9], [101.6, 16.3], [101.8, 15.7]],                    // Phetchabun
      [[101.4, 14.35], [102.0, 14.25], [102.6, 14.3]],                  // Sankamphaeng/Dangrek
      [[99.3, 12.0], [99.1, 11.2], [98.9, 10.4], [98.8, 9.6]],          // Tenasserim south
      [[99.6, 8.9], [99.8, 8.3], [100.0, 7.7]],                         // Nakhon Si range
    ];
    for (const r of RANGES) {
      for (let k = 0; k < r.length - 1; k++) {
        const [lo1, la1] = r[k], [lo2, la2] = r[k + 1];
        const n = 7;
        for (let i = 0; i < n; i++) {
          const t = i / n + rand(-0.03, 0.03);
          const p = proj(lo1 + (lo2 - lo1) * t + rand(-0.12, 0.12), la1 + (la2 - la1) * t + rand(-0.12, 0.12));
          if (!inPoly(p.x, p.y, OUTLINE) || nearNode(p.x, p.y, 18) || nearRoad(p.x, p.y)) continue;
          const v = W2(p.x, p.y); const s = rand(1.6, 2.5); const h = rand(1.8, 3.3) * (la1 > 18 ? 1.25 : 1);
          mts.push(new THREE.Matrix4().compose(v, new THREE.Quaternion(), new THREE.Vector3(s, h, s * rand(0.8, 1.1))));
          cols.push(new THREE.Color().setHSL(rand(0.28, 0.34), rand(0.42, 0.52), rand(0.38, 0.46)));
          if (h > 2.9) caps.push(new THREE.Matrix4().compose(v.clone().setY(v.y + h * 0.8), new THREE.Quaternion(), new THREE.Vector3(s * 0.5, h * 0.22, s * 0.5)));
        }
      }
    }
    const mInst = new THREE.InstancedMesh(mG, mM, mts.length);
    mts.forEach((m, i) => { mInst.setMatrixAt(i, m); mInst.setColorAt(i, cols[i]); });
    mInst.castShadow = true; mInst.receiveShadow = true; this.scene.add(mInst);
    if (caps.length) { const cInst = new THREE.InstancedMesh(mG, new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: g }), caps.length); caps.forEach((m, i) => cInst.setMatrixAt(i, m)); this.scene.add(cInst); }
    // ---- FOREST PATCHES (dense clusters instead of scatter)
    const tM = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: g });
    const tG = treeGeometry();
    const trees: THREE.Matrix4[] = []; const tc: THREE.Color[] = [];
    let patches = 0, tries2 = 0;
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    while (patches < 80 && tries2++ < 6000) {
      const lo = rand(97.6, 105.3), la = rand(6.2, 20.2); const c0 = proj(lo, la);
      if (!inPoly(c0.x, c0.y, OUTLINE) || nearNode(c0.x, c0.y, 16) || nearRoad(c0.x, c0.y)) continue;
      const isan = lo > 101.8 && la > 14.3 && la < 18; const central = lo > 99.6 && lo < 101.3 && la > 13.6 && la < 16.4;
      if ((isan || central) && Math.random() < 0.6) continue;
      patches++;
      const hue = isan ? rand(0.15, 0.2) : la < 10 ? rand(0.3, 0.37) : rand(0.26, 0.33);
      const n = Math.round(rand(14, 26)); const R = rand(5, 9);
      for (let i = 0; i < n; i++) {
        const x = c0.x + gauss() * R, y = c0.y + gauss() * R * 0.8;
        if (!inPoly(x, y, OUTLINE) || nearRoad(x, y)) continue;
        const dCenter = Math.hypot(x - c0.x, y - c0.y) / R;
        const s = rand(0.9, 1.4) * (1.15 - dCenter * 0.4);
        trees.push(new THREE.Matrix4().compose(W2(x, y), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6), new THREE.Vector3(s, s * rand(0.95, 1.2), s)));
        tc.push(new THREE.Color().setHSL(hue + rand(-0.015, 0.015), rand(0.5, 0.62), rand(0.4, 0.5)));
      }
    }
    const tInst = new THREE.InstancedMesh(tG, tM, trees.length);
    trees.forEach((m, i) => { tInst.setMatrixAt(i, m); tInst.setColorAt(i, tc[i]); });
    tInst.castShadow = true; tInst.receiveShadow = true; this.scene.add(tInst);
    TANKS.forEach((p) => { const t = makeTankProp(); t.scale.setScalar(0.7); t.position.copy(W2(p.x, p.y)); t.rotation.y = Math.random() * 6; this.scene.add(t); });
    // puffy clouds casting shadows
    for (let i = 0; i < 18; i++) {
      const c = makeCloud(rand(1.6, 2.6));
      c.position.set(rand(-90, 90), rand(20, 25), rand(-110, 110));
      c.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
      this.scene.add(c); this.clouds.push(c);
    }
    const glow = glowTexture(); this.disposables.push(glow);
  }

  private ribbonGeo(a: THREE.Vector3, b: THREE.Vector3, width: number, uvScale = 0) {
    const len = a.distanceTo(b);
    const g = new THREE.PlaneGeometry(len, width);
    if (uvScale) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len * uvScale); }
    g.rotateX(-Math.PI / 2);
    g.rotateY(Math.atan2(-(b.z - a.z), b.x - a.x));
    const mid = a.clone().add(b).multiplyScalar(0.5); g.translate(mid.x, mid.y, mid.z);
    return g;
  }
  private buildRoads() {
    const edge: THREE.BufferGeometry[] = [], road: THREE.BufferGeometry[] = [];
    for (const [a, b] of EDGES) {
      const A = W2(NODE[a].x, NODE[a].y, LAND_H + 0.03), B = W2(NODE[b].x, NODE[b].y, LAND_H + 0.03);
      edge.push(this.ribbonGeo(A, B, 0.42)); road.push(this.ribbonGeo(A, B, 0.26).translate(0, 0.01, 0));
      // round joints
      edge.push(new THREE.CircleGeometry(0.21, 10).rotateX(-Math.PI / 2).translate(B.x, B.y, B.z));
    }
    const merge = (list: THREE.BufferGeometry[]) => { const nonIdx = list.map((g) => (g.index ? g.toNonIndexed() : g)); let n = 0; nonIdx.forEach((g) => (n += g.attributes.position.count)); const pos = new Float32Array(n * 3); let o = 0; nonIdx.forEach((g) => { pos.set(g.attributes.position.array as Float32Array, o * 3); o += g.attributes.position.count; g.dispose(); }); list.forEach((g) => g.dispose()); const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.computeVertexNormals(); return out; };
    const e = new THREE.Mesh(merge(edge), new THREE.MeshToonMaterial({ color: 0xd8b878, gradientMap: toonGradient(), polygonOffset: true, polygonOffsetFactor: -1 }));
    const r = new THREE.Mesh(merge(road), new THREE.MeshToonMaterial({ color: 0xf5e2b0, gradientMap: toonGradient(), polygonOffset: true, polygonOffsetFactor: -2 }));
    e.receiveShadow = true; r.receiveShadow = true;
    this.scene.add(e, r);
  }

  private buildNodes() {
    for (const c of CITIES) {
      const g = makeUniqueCity(c.id);
      g.scale.setScalar(1.25);
      const p = W2(c.x, c.y);
      g.position.copy(p); this.scene.add(g);
      const ring = new THREE.Mesh(new THREE.RingGeometry(2.25, 2.5, 40), new THREE.MeshBasicMaterial({ color: tierHex(c.tier), transparent: true, opacity: 0.9, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, LAND_H + 0.06, p.z); this.scene.add(ring);
      const lo = Math.max(1, Math.round(c.tier * 2.2 - 1.5));
      const label = this.makeLabel(`${CITY_INFO[c.id].emblem} ${c.name}`, `Lv${Math.max(1, lo - 1)}-${lo + 1} • ${CITY_INFO[c.id].title}`, tierHex(c.tier));
      label.position.set(p.x, LAND_H + 4.8, p.z); this.scene.add(label);
      this.cityLabels[c.id] = label;
    }
    // waypoints: instanced per kind
    const kinds = ['village', 'shrine', 'fort', 'camp', 'ruin', 'lake'] as const;
    const tm = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
    for (const k of kinds) {
      const list = NODES.filter((n) => n.kind === k);
      if (!list.length) continue;
      const inst = new THREE.InstancedMesh(waypointGeometry(k), tm, list.length);
      const m4 = new THREE.Matrix4();
      list.forEach((n, i) => { m4.compose(W2(n.x, n.y), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 1.7) % 6.28), new THREE.Vector3(1.25, 1.25, 1.25)); inst.setMatrixAt(i, m4); });
      inst.castShadow = true; inst.receiveShadow = true;
      this.scene.add(inst);
    }
    // small colored pins for kind recognition
    const pinG = new THREE.SphereGeometry(0.16, 10, 8);
    const pin = new THREE.InstancedMesh(pinG, new THREE.MeshToonMaterial({ gradientMap: toonGradient() }), NODES.length);
    const m4 = new THREE.Matrix4(); const col = new THREE.Color();
    NODES.forEach((n, i) => { const p = W2(n.x, n.y, LAND_H + (n.kind === 'city' ? 0 : 1.55)); m4.makeTranslation(p.x, n.kind === 'city' ? -50 : p.y, p.z); pin.setMatrixAt(i, m4); pin.setColorAt(i, col.set(NODE_KIND_INFO[n.kind].color)); });
    this.scene.add(pin);
    // quest rings on cities
    for (const c of CITIES) {
      const p = W2(c.x, c.y);
      const q = new THREE.Mesh(new THREE.RingGeometry(2.7, 2.95, 40), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, depthWrite: false }));
      q.rotation.x = -Math.PI / 2; q.position.set(p.x, LAND_H + 0.07, p.z); q.visible = false; this.scene.add(q); this.qrings[c.id] = q;
    }
    this.nodeWorld = NODES.map((n) => ({ id: n.id, p: W2(n.x, n.y, LAND_H + 0.6) }));
    // fire spots
    for (const f of FIRES) { const p = W2(f.x, f.y); const ring = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12), new THREE.MeshBasicMaterial({ color: 0x5a4a3a })); ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, LAND_H + 0.04, p.z); this.scene.add(ring); }
  }

  // ---------------------------------------------------------------- API
  setToken(x: number, y: number, moving: boolean) {
    this.tokenPos.copy(W2(x, y));
    if (!moving && this.isCityAt(x, y)) this.tokenPos.z += 2.8;
    this.moving = moving; this.follow = moving;
  }
  private isCityAt(x: number, y: number) { return CITIES.some((c) => Math.abs(c.x - x) < 0.01 && Math.abs(c.y - y) < 0.01); }
  placeTokenNow(x: number, y: number) {
    this.setToken(x, y, false); this.hero.root.position.copy(this.tokenPos); this.marker.position.copy(this.tokenPos); this.tokenPrev.copy(this.tokenPos);
  }
  focus(x: number, y: number, dist?: number) { this.desired = W2(x, y); if (dist) this.userDist = dist; }
  jumpTo(x: number, y: number) { this.target.copy(W2(x, y)); this.desired = null; }
  setSelected(id: string | null) {
    this.selId = id;
    if (!id) { this.selRing.visible = false; this.beam.visible = false; this.selLabel.visible = false; return; }
    const n = NODE[id]; const p = W2(n.x, n.y);
    this.selRing.visible = true; this.selRing.position.set(p.x, LAND_H + 0.09, p.z);
    const big = n.kind === 'city';
    this.selRing.scale.setScalar(big ? 1.5 : 1);
    this.beam.visible = true; this.beam.position.set(p.x, LAND_H + 6, p.z);
    if (!big) {
      const old = this.selLabel.material.map; const { tex, aspect } = labelTexture(`${NODE_KIND_INFO[n.kind].icon} ${n.name}`, NODE_KIND_INFO[n.kind].th, NODE_KIND_INFO[n.kind].color);
      this.selLabel.material.map = tex; this.selLabel.material.needsUpdate = true; old?.dispose();
      this.selLabel.scale.set(2 * aspect, 2, 1); this.selLabel.position.set(p.x, LAND_H + 3.2, p.z); this.selLabel.visible = true;
    } else this.selLabel.visible = false;
  }
  setPath(path: string[] | null) {
    this.pathGroup.children.forEach((m) => (m as THREE.Mesh).geometry.dispose());
    this.pathGroup.clear();
    if (!path || path.length < 2) return;
    const m = new THREE.MeshBasicMaterial({ map: this.dashTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    for (let i = 0; i < path.length - 1; i++) {
      const A = W2(NODE[path[i]].x, NODE[path[i]].y, LAND_H + 0.09), B = W2(NODE[path[i + 1]].x, NODE[path[i + 1]].y, LAND_H + 0.09);
      this.pathGroup.add(new THREE.Mesh(this.ribbonGeo(A, B, 0.34, 0.8), m));
    }
  }
  setQuestTargets(ids: string[]) { for (const [id, o] of Object.entries(this.qrings)) o.visible = ids.includes(id); }
  setVisited(ids: string[]) {
    const camps = ids.filter((id) => NODE[id]?.kind === 'camp');
    if (this.visitedMesh) { this.scene.remove(this.visitedMesh); this.visitedMesh.dispose(); this.visitedMesh = null; }
    if (!camps.length) return;
    const g = new THREE.TorusGeometry(0.5, 0.06, 6, 20); g.rotateX(Math.PI / 2);
    const inst = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0x4ade80 }), camps.length);
    const m4 = new THREE.Matrix4();
    camps.forEach((id, i) => { const p = W2(NODE[id].x, NODE[id].y, LAND_H + 1.55); inst.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)); });
    this.visitedMesh = inst; this.scene.add(inst);
  }
  setAlert(on: boolean) { this.alert.visible = on; this.alertT = on ? 0 : -1; }
  setActive(on: boolean) {
    if (on === this.active) return;
    this.active = on;
    if (on) { this.last = performance.now(); this.resize(); this.raf = requestAnimationFrame(this.loop); } else cancelAnimationFrame(this.raf);
  }
  burstAt(x: number, y: number, color: THREE.ColorRepresentation, n = 40, up = true) {
    this.fire.burst(W2(x, y, LAND_H + 0.6), color, n, { speed: 6, up, gravity: up ? 4 : 0, life: 1.1, size: 0.5 });
  }
  burstToken(color: THREE.ColorRepresentation, n = 40) { const p = this.hero.root.position.clone(); p.y += 1.2; this.fire.burst(p, color, n, { speed: 7, life: 0.8, size: 0.5 }); }
  project(x: number, y: number) {
    const v = W2(x, y, LAND_H + 1).project(this.camera); const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }
  zoom(f: number) { this.userDist = THREE.MathUtils.clamp(this.userDist * f, 9, 230); }

  // ---------------------------------------------------------------- INPUT
  private bindInput() {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onDown); el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp); el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
  }
  private onDown = (e: PointerEvent) => {
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) this.downAt = { x: e.clientX, y: e.clientY, moved: 0 };
    if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.pinch0 = Math.hypot(a.x - b.x, a.y - b.y); this.downAt.moved = 99; }
  };
  private onMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse') this.renderer.domElement.style.cursor = this.pick(e) ? 'pointer' : 'grab'; return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (this.pointers.size === 1) {
      this.downAt.moved += Math.abs(dx) + Math.abs(dy);
      if (this.downAt.moved > 6) {
        const wpp = (2 * this.dist * Math.tan((this.camera.fov * Math.PI) / 360)) / this.container.clientHeight;
        this.target.x -= dx * wpp; this.target.z -= (dy * wpp) / Math.sin(this.pitch);
        this.desired = null; this.follow = false;
      }
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch0 > 0) this.zoom(this.pinch0 / d); this.pinch0 = d;
    }
  };
  private onUp = (e: PointerEvent) => {
    const had = this.pointers.delete(e.pointerId);
    if (had && this.pointers.size === 0 && this.downAt.moved <= 6) { const id = this.pick(e); if (id) this.onCityClick(id); }
  };
  private onWheel = (e: WheelEvent) => { e.preventDefault(); this.zoom(e.deltaY > 0 ? 1.1 : 0.9); };
  private pick(e: { clientX: number; clientY: number }) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    let best: string | undefined; let bd = 1e9; const v = new THREE.Vector3();
    for (const n of this.nodeWorld) {
      v.copy(n.p).project(this.camera); if (v.z > 1) continue;
      const sx = ((v.x + 1) / 2) * r.width, sy = ((1 - v.y) / 2) * r.height;
      const d = Math.hypot(sx - mx, sy - my); const lim = NODE[n.id].kind === 'city' ? 42 : 26;
      if (d < lim && d < bd) { bd = d; best = n.id; }
    }
    return best;
  }

  // ---------------------------------------------------------------- LOOP
  private resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const ph = h * this.renderer.getPixelRatio();
    this.fire.setScale(ph, this.camera.fov); this.smoke.setScale(ph, this.camera.fov);
  }

  private loop = (now: number) => {
    if (!this.active) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
    this.last = now; this.time += dt; const t = this.time;
    this.seaMat.uniforms.uTime.value = t;

    // leader
    const hr = this.hero.root;
    this.tokenPrev.copy(hr.position);
    hr.position.lerp(this.tokenPos, 1 - Math.exp(-dt * 16));
    this.marker.position.copy(hr.position);
    const d = hr.position.clone().sub(this.tokenPrev); const sp = d.length() / Math.max(dt, 1e-4);
    let want: number | null = null;
    if (sp > 0.2) want = Math.atan2(d.x, d.z); else if (!this.moving) want = 0;
    if (want !== null) { let dd = want - hr.rotation.y; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); hr.rotation.y += dd * Math.min(1, dt * 8); }
    this.walkPh += d.length() * 5;
    if (sp > 0.25) { walkPose(this.hero, this.walkPh, 1); this.hero.rig.position.y = Math.abs(Math.sin(this.walkPh)) * 0.08; if (Math.random() < dt * 14) this.smoke.spawn(hr.position.x, hr.position.y + 0.1, hr.position.z, 0, 0.4, 0, 0.8, 0.45, 0xe8d8b0, 0, 0.9, 1.4); }
    else { walkPose(this.hero, 0, 0); this.hero.rig.position.y = Math.sin(t * 2) * 0.02; }
    hr.traverse((o) => { if (o.userData.flag) { const bp = ((o as THREE.Mesh).geometry as THREE.PlaneGeometry).attributes.position; for (let i = 0; i < bp.count; i++) { const x = bp.getX(i); bp.setZ(i, Math.sin(x * 8 - t * (this.moving ? 12 : 5)) * 0.06 * x); } bp.needsUpdate = true; } });
    this.crystal.rotation.y += dt * 2.2; this.crystal.position.y = 3.2 + Math.sin(t * 3) * 0.15;
    { const s2 = 1 + Math.sin(t * 4) * 0.08; this.ring.scale.set(s2, s2, s2); }
    if (this.alertT >= 0) { this.alertT += dt; const k = Math.min(1, this.alertT * 6); const s = (0.4 + k * 1.1 + Math.sin(this.alertT * 30) * 0.08) * 1.3; this.alert.scale.set(s, s, 1); }

    if (this.selRing.visible) { const s = (this.selId && NODE[this.selId].kind === 'city' ? 1.5 : 1) * (1 + Math.sin(t * 4) * 0.08); this.selRing.scale.set(s, s, s); (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(t * 3) * 0.06; }
    this.dashTex.offset.x -= dt * 1.6;
    for (const q of Object.values(this.qrings)) if (q.visible) { const s = 1 + ((t * 0.8) % 1) * 0.3; q.scale.set(s, s, s); (q.material as THREE.MeshBasicMaterial).opacity = 1 - ((t * 0.8) % 1); }

    for (const f of FIRES) {
      const p = W2(f.x, f.y, LAND_H + 0.1);
      if (Math.random() < dt * 18) this.fire.spawn(p.x + (Math.random() - 0.5) * 0.4, p.y, p.z + (Math.random() - 0.5) * 0.4, 0, 1 + Math.random(), 0, 0.6, 0.45, Math.random() < 0.5 ? 0xff8a2a : 0xffd04a, -0.5, 0.92, -0.6);
      if (Math.random() < dt * 4) this.smoke.spawn(p.x, p.y + 0.8, p.z, 0.3, 0.8, 0, 3, 0.7, 0x9a948c, 0, 0.98, 2.2);
    }
    this.fire.update(dt); this.smoke.update(dt);
    for (const c of this.clouds) { c.position.x += dt * 0.9; if (c.position.x > 110) c.position.x = -110; }

    if (this.follow) { this.desired = hr.position.clone(); this.desired.z += 3.5; }
    { const wd = this.moving ? Math.min(this.userDist, 15) : this.userDist; this.dist += (wd - this.dist) * (1 - Math.exp(-dt * 2.2)); }
    if (this.desired) this.target.lerp(this.desired, 1 - Math.exp(-dt * 3));
    this.target.x = THREE.MathUtils.clamp(this.target.x, -24 * MAP_SCALE, 24 * MAP_SCALE); this.target.z = THREE.MathUtils.clamp(this.target.z, -36 * MAP_SCALE, 36 * MAP_SCALE);
    this.sun.target.position.set(this.target.x, 0, this.target.z); this.sun.position.set(this.target.x - 22, 45, this.target.z + 20);
    { const sh = THREE.MathUtils.clamp(this.dist * 0.9, 18, 60); const c2 = this.sun.shadow.camera; if (Math.abs(c2.right - sh) > 1) { c2.left = -sh; c2.right = sh; c2.top = sh; c2.bottom = -sh; c2.updateProjectionMatrix(); } }
    const cp = this.camera.position;
    const wantP = new THREE.Vector3(this.target.x, this.target.y + this.dist * Math.sin(this.pitch), this.target.z + this.dist * Math.cos(this.pitch));
    cp.lerp(wantP, 1 - Math.exp(-dt * 8));
    this.camera.lookAt(cp.x, cp.y - this.dist * Math.sin(this.pitch), cp.z - this.dist * Math.cos(this.pitch));
    (this.scene.fog as THREE.Fog).near = this.dist + 25; (this.scene.fog as THREE.Fog).far = this.dist * 1.6 + 120;
    // label declutter: hide city labels when far zoom? keep; scale with distance
    const ls = THREE.MathUtils.clamp(this.dist / 30, 0.7, 4);
    for (const [id, l] of Object.entries(this.cityLabels)) { const a = l.userData.a ?? (l.userData.a = l.scale.x / l.scale.y); l.scale.set(2.1 * a * ls, 2.1 * ls, 1); void id; }
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.active = false; cancelAnimationFrame(this.raf); this.ro.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onDown); el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerup', this.onUp); el.removeEventListener('pointercancel', this.onUp); el.removeEventListener('wheel', this.onWheel);
    disposeScene(this.scene);
    this.fire.dispose(); this.smoke.dispose(); this.dashTex.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose(); this.renderer.forceContextLoss(); el.remove();
  }
}

export function disposeScene(scene: THREE.Object3D) {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mt of mats) {
      for (const [k, v] of Object.entries(mt)) if (k !== 'gradientMap' && v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
      mt.dispose();
    }
  });
}
export { CITY };
