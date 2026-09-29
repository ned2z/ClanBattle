import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import type { Biome, Element, StatusType, Unit } from '../game/types';
import { CLASS2 } from '../game/data';
import { disposeScene } from './MapWorld';
import { grassTuftGeometry, makeCloud, puffyTree, makeBanana, makeBarrel, makeBroadleaf, makeBush, makeDeadTree, makeHero, makeMonster, makePalm, makePine, makePrang, makeRock, makeRuin, mat, walkPose, type Rig } from './models';
import { ParticleSystem } from './particles';
import { glowTexture, groundTexture, magicCircleTexture, skyTexture } from './textures';
import { toonGradient } from './models';
import { BIG_TECH, MELEE_TECH, Vfx, easeInOut, easeOut, type Fx, type Tech, type VfxHost } from './vfx';

export const EL_COLOR: Record<Element, number> = {
  phys: 0xffe28a, fire: 0xff7a2a, ice: 0x7dd3fc, thunder: 0xfff27a, dark: 0xa06bff, holy: 0xfff3c0, poison: 0x8be04a, wind: 0x5eead4,
};

type AnimType = 'melee' | 'leap' | 'whirl' | 'cast' | 'shoot' | 'power' | 'hit' | 'victory' | 'item' | 'dodge';
interface BU {
  uid: string; side: 'ally' | 'enemy'; rig: Rig; base: THREE.Vector3; face: number; phase: number;
  anim: null | { type: AnimType; t: number; dur: number; hitAt: number; to?: THREE.Vector3; color: number };
  flash: number; flashCol: THREE.Color; dead: boolean; deadK: number; baseCols: THREE.Color[]; baseEm: THREE.Color[];
  hp: number; enter: { t: number; dur: number; from: THREE.Vector3; landed: boolean } | null; kb: number; dodgeDir: number;
  statuses: Set<StatusType>; bubble?: THREE.Mesh; stars?: THREE.Group; tauntRing?: THREE.Mesh; offset: THREE.Vector3;
}

export class BattleWorld implements VfxHost {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  add: ParticleSystem;
  norm: ParticleSystem;
  glowTex = glowTexture();
  circleTex = magicCircleTexture();
  paused = false;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private vfx: Vfx;
  private container: HTMLElement;
  private units = new Map<string, BU>();
  private anchor: (uid: string) => HTMLElement | null | undefined;
  private raf = 0;
  private last = 0;
  private time = 0;
  private fxs: Fx[] = [];
  private timers: { t: number; fn: () => void }[] = [];
  private shakeT = 0; private shakeM = 0; private punch = 0; private hitT = 0;
  private camBase = new THREE.Vector3(); private camLook = new THREE.Vector3(); private intro = 0;
  private camFocus = new THREE.Vector3(); private camFocusT = new THREE.Vector3(); private camZoom = 1; private camZoomT = 1;
  private portrait = false;
  private flashLight = new THREE.PointLight(0xffffff, 0, 16, 1.5);
  private fireLights: THREE.PointLight[] = [];
  private emitters: THREE.Vector3[] = [];
  private flags: THREE.Mesh[] = [];
  private clouds: THREE.Group[] = [];
  private actorRing: THREE.Mesh;
  private ro: ResizeObserver;
  private disposed = false;
  private tmpV = new THREE.Vector3();
  private tipV = new THREE.Vector3();
  private bokeh: BokehPass | null = null;
  private windU = { value: 0 };
  private biome: Biome;
  private lookT = new THREE.Vector3();

  constructor(container: HTMLElement, units: Unit[], anchor: (uid: string) => HTMLElement | null | undefined, biome: Biome = 'plain') {
    this.container = container;
    this.biome = biome;
    this.anchor = anchor;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    container.appendChild(this.renderer.domElement);

    this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: coarse ? 0 : 2 }));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bokeh = new BokehPass(this.scene, this.camera, { focus: 15, aperture: 0.0022, maxblur: 0.009 });
    this.composer.addPass(this.bokeh);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.12, 0.25, 1.0);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.portrait = container.clientWidth / Math.max(1, container.clientHeight) < 0.95;
    this.buildEnv();
    this.add = new ParticleSystem(2600, THREE.AdditiveBlending);
    this.add.mat.uniforms.uBoost.value = 0.85;
    this.add.mat.uniforms.uOpacity.value = 0.75;
    this.norm = new ParticleSystem(900, THREE.NormalBlending);
    this.norm.mat.uniforms.uOpacity.value = 0.55;
    this.scene.add(this.add.points, this.norm.points, this.flashLight);
    this.vfx = new Vfx(this);

    this.actorRing = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.8, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.actorRing.rotation.x = -Math.PI / 2; this.scene.add(this.actorRing);

    units.forEach((u, i) => {
      const rig = u.cls ? makeHero(u.cls, u.color) : makeMonster(u.icon);
      const map = new Map<THREE.Material, THREE.MeshToonMaterial>();
      rig.root.traverse((o) => {
        const me = o as THREE.Mesh;
        if (me.isMesh && !me.userData.outline && (me.material as THREE.MeshToonMaterial).isMeshToonMaterial) {
          const src = me.material as THREE.MeshToonMaterial;
          if (!map.has(src)) map.set(src, src.clone());
          me.material = map.get(src)!;
          me.castShadow = true;
        }
      });
      rig.mats = [...map.values()];
      // store limb rest poses after clone
      this.units.set(u.uid, {
        uid: u.uid, side: u.side, rig, base: new THREE.Vector3(), face: 0, phase: i * 1.7, anim: null, flash: 0, flashCol: new THREE.Color(1, 1, 1),
        dead: !u.alive, deadK: u.alive ? 0 : 1, baseCols: rig.mats.map((m) => m.color.clone()), baseEm: rig.mats.map((m) => m.emissive.clone()),
        statuses: new Set(), offset: new THREE.Vector3(), hp: u.hp / u.maxHp, enter: null, kb: 0, dodgeDir: 1,
      });
      this.scene.add(rig.root);
      if (u.cls2 && CLASS2[u.cls2]) {
        const aura = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 32), new THREE.MeshBasicMaterial({ color: CLASS2[u.cls2].color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        aura.rotation.x = -Math.PI / 2; aura.position.y = 0.04; aura.userData.aura = true; rig.root.add(aura);
      }
    });

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.intro = 1;
    let ia = 0, ie = 0;
    for (const u of this.units.values()) {
      const ally = u.side === 'ally';
      const i = ally ? ia++ : ie++;
      const humanoid = !!u.rig.limbs?.legL;
      const from = u.base.clone();
      if (!ally && !humanoid) from.y = 9;
      else if (this.portrait) from.z += ally ? 11 : -11;
      else from.x += ally ? -12 : 12;
      u.enter = { t: -(0.35 + i * 0.16 + (ally ? 0 : 0.08)), dur: 0.85, from, landed: false };
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------ ENV
  private buildEnv() {
    const s = this.scene;
    const B = BIOME_CFG[this.biome];
    const fogC = new THREE.Color(B.fog);
    s.fog = new THREE.Fog(fogC, 26, 90);
    s.background = fogC;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 24, 16), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, color: B.sky }));
    s.add(sky);
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xfff4d0, fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sun.scale.set(36, 36, 1); sun.position.set(40, 45, -110); s.add(sun);
    s.add(new THREE.HemisphereLight(0xdff2ff, 0x7ab060, 1.35));
    const key = new THREE.DirectionalLight(0xfff0d8, 2.3);
    key.position.set(-8, 14, 9); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 50;
    key.shadow.bias = -0.0006;
    s.add(key);
    const rim = new THREE.DirectionalLight(0xbfe0ff, 0.9); rim.position.set(8, 6, -10); s.add(rim);

    const gt = groundTexture(B.groundPal); gt.repeat.set(12, 12);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshToonMaterial({ map: gt, gradientMap: toonGradient() }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; s.add(ground);
    const arena = new THREE.Mesh(new THREE.RingGeometry(6.5, 6.7, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }));
    arena.rotation.x = -Math.PI / 2; arena.position.y = 0.02; s.add(arena);

    // rolling hills + distant forest
    const hG = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const g = toonGradient();
    for (let i = 0; i < 26; i++) {
      const a = Math.PI * (0.02 + (i / 26) * 0.96) + Math.PI; const r = 48 + Math.random() * 30;
      const m = new THREE.Mesh(hG, new THREE.MeshToonMaterial({ color: new THREE.Color(B.hill).offsetHSL((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.1), gradientMap: g }));
      m.position.set(Math.cos(a) * r, -1, Math.sin(a) * r);
      const sc2 = 10 + Math.random() * 14; m.scale.set(sc2 * 1.4, 5 + Math.random() * 11, sc2); s.add(m);
    }
    for (let gI = 0; gI < 5; gI++) { const cx = -36 + gI * 18 + Math.random() * 4, cz = -28 - Math.random() * 6; for (let i = 0; i < 7; i++) { const t = puffyTree(2 + Math.random() * 1.4, B.leaf); t.position.set(cx + (Math.random() - 0.5) * 9, 0, cz + (Math.random() - 0.5) * 5); s.add(t); } }
    for (let i = 0; i < 7; i++) { const c = makeCloud(2 + Math.random() * 2); c.position.set(-50 + i * 16 + Math.random() * 6, 18 + Math.random() * 8, -60 - Math.random() * 20); s.add(c); this.clouds.push(c); }

    const place = (o: THREE.Object3D, x: number, z: number, ry = 0, sc3 = 1) => { o.position.set(x, 0, z); o.rotation.y = ry; o.scale.setScalar(sc3); o.traverse((c) => { if (!c.userData.outline) { c.castShadow = true; c.receiveShadow = true; } }); s.add(o); return o; };
    if (B.temple) { const prang = place(makePrang(), -8, -15, 0.3, 1.3); prang.traverse((c) => { c.castShadow = false; }); }
    place(makeRuin(1.8), -10.5, -6.5, 0.4); place(makeRuin(1.4), 10, -7.5, -0.3);
    this.buildFlora(place);
    ([[-6.2, -4.5], [6.6, 4.5]] as [number, number][]).forEach(([x, z], i) => {
      place(makeBarrel(), x, z);
      this.emitters.push(new THREE.Vector3(x, 0.25, z));
      if (i < 2) { const l = new THREE.PointLight(0xffa040, 5, 7, 1.6); l.position.set(x, 1.0, z); s.add(l); this.fireLights.push(l); }
    });
    for (const [x, z, c] of [[-8.5, -2, 0x3a7ae0], [8.5, -2.5, 0xe04a3a]] as [number, number, number][]) {
      const g2 = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6), mat(0x8a5a30)); pole.position.y = 1.6; g2.add(pole);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3, 8, 1), new THREE.MeshToonMaterial({ color: c, side: THREE.DoubleSide, gradientMap: g }));
      fl.position.set(0.47, 2.5, 0); g2.add(fl); this.flags.push(fl);
      place(g2, x, z, Math.random() * 3);
    }
  }

  private buildFlora(place: (o: THREE.Object3D, x: number, z: number, ry?: number, sc?: number) => THREE.Object3D) {
    const B = BIOME_CFG[this.biome];
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    // grass
    const geo = grassTuftGeometry();
    const gm = new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide, gradientMap: toonGradient() });
    gm.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.windU;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        #else
        vec4 ip = vec4(0.0);
        #endif
        float hh = position.y * position.y;
        float wv = sin(uTime * 1.8 + ip.x * 0.55 + ip.z * 0.35) * 0.6 + sin(uTime * 3.3 + ip.x * 1.7) * 0.25;
        transformed.x += wv * hh * 0.35;
        transformed.z += wv * hh * 0.18;`);
    };
    const N = coarse ? 3500 : 7000;
    const inst = new THREE.InstancedMesh(geo, gm, N);
    const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const c = new THREE.Color();
    const cA = new THREE.Color(B.grass[0]), cB = new THREE.Color(B.grass[1]);
    let n = 0;
    while (n < N) {
      const x = rnd(-20, 20), z = rnd(-18, 10);
      const centre = Math.abs(x) < 6.5 && Math.abs(z) < 4.5;
      if (centre && Math.random() < 0.9) continue;
      if (Math.random() > B.grassDensity) continue;
      const sc = rnd(0.22, 0.48) * B.grassH * (centre ? 0.5 : 1);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28);
      m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(sc, sc * rnd(0.8, 1.3), sc));
      inst.setMatrixAt(n, m4);
      inst.setColorAt(n, c.copy(cA).lerp(cB, Math.random()));
      n++;
    }
    inst.receiveShadow = true;
    this.scene.add(inst);
    // flowers / pebbles
    if (B.flowers) {
      const fg = new THREE.SphereGeometry(0.05, 5, 4);
      const fl = new THREE.InstancedMesh(fg, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x222222 }), 300);
      for (let i = 0; i < 300; i++) { m4.makeTranslation(rnd(-16, 16), rnd(0.12, 0.3), rnd(-14, 8)); fl.setMatrixAt(i, m4); fl.setColorAt(i, c.set(B.flowers[i % B.flowers.length])); }
      this.scene.add(fl);
    }
    // ---- GROVES: tidy clusters (tree cluster + bushes + rocks + flowers)
    const makeTree = (k: string, sc: number) => k === 'pine' ? makePine(sc * 1.15) : k === 'broad' ? makeBroadleaf(sc, B.leaf) : k === 'dead' ? makeDeadTree(sc * 1.1) : k === 'banana' ? makeBanana(sc) : makePalm();
    const GROVES: [number, number, number][] = [[-13, -9, 1.2], [12.5, -10, 1.15], [-2, -15, 1.3], [-14.5, 2.5, 1.0], [14, 3, 0.95], [6, -16, 1.0]];
    let ti = 0;
    for (const [gx, gz, gs] of GROVES) {
      const n = Math.round((B.trees / GROVES.length) * gs);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd(-0.3, 0.3); const r = i === 0 ? 0 : rnd(1.2, 2.8) * gs;
        const sc = (i === 0 ? 1.3 : rnd(0.8, 1.1)) * gs;
        place(makeTree(B.treeKinds[ti++ % B.treeKinds.length], sc), gx + Math.cos(a) * r, gz + Math.sin(a) * r * 0.8, Math.random() * 6, 1);
      }
      for (let i = 0; i < 4; i++) { const a = rnd(0, 6.28); const r = rnd(2.4, 3.6) * gs; place(makeBush(B.leaf, rnd(0.8, 1.2)), gx + Math.cos(a) * r, gz + Math.sin(a) * r * 0.8); }
      for (let i = 0; i < 2; i++) { const rk = makeRock(B.rock, rnd(0.6, 1.2)); rk.position.set(gx + rnd(-3, 3), 0, gz + rnd(1.5, 3)); this.scene.add(rk); }
    }
    // ---- FOREGROUND (close to camera → blurred by depth of field)
    const fg: [number, number][] = this.portrait ? [[-4.5, 9.5], [5, 10], [0.5, 11.5]] : [[-11.5, 8], [-8, 11], [-13, 4.5]];
    for (const [x, z] of fg) {
      for (let i = 0; i < 3; i++) place(makeBush(B.leaf, rnd(1.1, 1.5)), x + rnd(-1.2, 1.2), z + rnd(-0.8, 0.8));
      const rk = makeRock(B.rock, rnd(0.9, 1.3)); rk.position.set(x + rnd(-1, 1), 0, z + rnd(-0.5, 0.5)); this.scene.add(rk);
    }
  }

  // ------------------------------------------------------------ LAYOUT
  private layout() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const aspect = w / Math.max(1, h);
    this.portrait = aspect < 0.95;
    const allies = [...this.units.values()].filter((u) => u.side === 'ally');
    const enemies = [...this.units.values()].filter((u) => u.side === 'enemy');
    const set = (list: BU[], side: 1 | -1) => {
      const n = list.length;
      list.forEach((u, i) => {
        const c = i - (n - 1) / 2;
        if (this.portrait) {
          u.base.set(c * 1.5, 0, side === 1 ? 2.6 + (i % 2) * 0.6 : -2.6 - (i % 2) * 0.7);
          u.face = side === 1 ? Math.PI - c * 0.08 : c * 0.08;
        } else {
          u.base.set(side * -(3.1 + (i % 2) * 1.0), 0, c * 1.45 + 0.3);
          u.face = side === 1 ? Math.PI / 2 - 0.45 : -Math.PI / 2 + 0.45;
        }
      });
    };
    set(allies, 1); set(enemies, -1);
    if (this.portrait) {
      const k = Math.max(1, 0.6 / aspect);
      this.camBase.set(2.2 * k, 8.4 * k, 10.2 * k); this.camLook.set(0, 0.3, -0.6);
    } else {
      const k = Math.max(1, 1.5 / aspect);
      this.camBase.set(-8.2 * k, 6.4 * k, 7.2 * k); this.camLook.set(1.0, 0.6, -0.1);
    }
  }

  private resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.layout();
    this.camera.fov = this.portrait ? 52 : 40;
    this.camera.updateProjectionMatrix();
    const ph = h * this.renderer.getPixelRatio();
    this.add.setScale(ph, this.camera.fov); this.norm.setScale(ph, this.camera.fov);
  }

  // ------------------------------------------------------------ HOST API
  later(sec: number, fn: () => void) { this.timers.push({ t: sec, fn }); }
  addFx(f: Fx) { this.fxs.push(f); }
  shake(m: number, dur = 0.3) { this.shakeM = Math.max(this.shakeM * (this.shakeT / 0.3), m); this.shakeT = Math.max(this.shakeT, dur); }
  hitstop(sec: number) { this.hitT = Math.max(this.hitT, sec); }
  flash(pos: THREE.Vector3, color: number, intensity: number) {
    this.flashLight.position.copy(pos).setY(pos.y + 1.5); this.flashLight.color.setHex(color); this.flashLight.intensity = intensity;
  }
  private chest(u: BU, out = new THREE.Vector3()) { return out.copy(u.rig.root.position).add(this.tmpV.set(0, u.rig.height * 0.55, 0)); }
  private fwd(u: BU) { return new THREE.Vector3(Math.sin(u.face), 0, Math.cos(u.face)); }
  private focus(p: THREE.Vector3 | null, zoom: number) {
    if (p) this.camFocusT.set(p.x * 0.4, 0, p.z * 0.4); else this.camFocusT.set(0, 0, 0);
    this.camZoomT = zoom;
  }

  // ------------------------------------------------------------ ACTIONS
  /** plays a technique. impact/total in seconds (already speed-scaled) */
  act(actorId: string, tech: Tech, targetIds: string[], element: Element, impact: number, total: number, isSkill: boolean) {
    for (const uu of this.units.values()) if (uu.enter) uu.enter.t = Math.max(uu.enter.t, uu.enter.dur);
    const a = this.units.get(actorId);
    if (!a || tech === 'none') return;
    const col = EL_COLOR[element];
    const tUnits = targetIds.map((t) => this.units.get(t)).filter(Boolean) as BU[];
    const ring = this.actorRing.material as THREE.MeshBasicMaterial;
    this.actorRing.position.copy(a.base).setY(0.05);
    ring.color.setHex(a.side === 'ally' ? 0x7dd3fc : 0xff6b6b); ring.opacity = 1;

    const centre = new THREE.Vector3();
    tUnits.forEach((t) => centre.add(t.base)); if (tUnits.length) centre.divideScalar(tUnits.length); else centre.copy(a.base);

    // animation
    if (MELEE_TECH.has(tech) && tUnits.length && tUnits[0].side !== a.side) {
      const dir = centre.clone().sub(a.base).setY(0).normalize();
      const to = centre.clone().sub(dir.multiplyScalar(tUnits.length > 1 ? 1.9 : 1.2));
      a.anim = { type: tech === 'leap' ? 'leap' : tech === 'whirl' ? 'whirl' : 'melee', t: 0, dur: total * 0.95, hitAt: impact, to, color: col };
    } else if (tech === 'shoot' || tech === 'coin' || tech === 'cannon' || tech === 'arrows') {
      a.anim = { type: 'shoot', t: 0, dur: impact + 0.25, hitAt: impact * 0.8, color: col };
    } else if (tech === 'buff' || tech === 'buffall') {
      a.anim = { type: 'power', t: 0, dur: impact + 0.3, hitAt: impact, color: col };
    } else if (tech === 'item') {
      a.anim = { type: 'item', t: 0, dur: impact + 0.2, hitAt: impact, color: col };
    } else {
      a.anim = { type: 'cast', t: 0, dur: impact + 0.3, hitAt: impact, color: col };
    }

    // camera direction
    const big = isSkill && BIG_TECH.has(tech);
    if (big) {
      this.focus(a.base, 0.86);
      this.later(impact * 0.75, () => this.focus(centre, 0.92));
      this.later(total, () => this.focus(null, 1));
    } else if (isSkill) {
      this.focus(centre.clone().lerp(a.base, 0.5), 0.95);
      this.later(total, () => this.focus(null, 1));
    }

    this.vfx.play(tech, {
      from: this.chest(a), fromBase: a.base.clone(), fwd: centre.clone().sub(a.base).setY(0).normalize(),
      targets: tUnits.map((t) => ({ chest: this.chest(t, new THREE.Vector3()).setX(t.base.x).setZ(t.base.z), base: t.base.clone() })),
      color: col, impact, big,
    });
  }

  impact(uid: string, o: { dmg?: boolean; crit?: boolean; heal?: boolean; mp?: boolean; killed?: boolean; revived?: boolean; miss?: boolean; element: Element; kind: string; debuff?: boolean; buff?: boolean; dot?: boolean }) {
    const u = this.units.get(uid);
    if (!u) return;
    const p = this.chest(u).setX(u.base.x).setZ(u.base.z);
    const col = EL_COLOR[o.element];
    if (o.miss) { this.add.burst(p, 0xcbd5e1, 8, { speed: 3, life: 0.3, size: 0.15 }); u.dodgeDir = Math.random() < 0.5 ? -1 : 1; if (!u.anim || u.anim.type === 'hit' || u.anim.type === 'power') u.anim = { type: 'dodge', t: 0, dur: 0.4, hitAt: 0, color: 0xffffff }; return; }
    if (o.dmg) {
      u.flash = 1; u.flashCol.setHex(o.dot ? 0x8be04a : 0xffffff);
      u.kb = o.crit ? 1 : 0;
      if (!u.anim || u.anim.type === 'hit' || u.anim.type === 'power' || u.anim.type === 'cast' || u.anim.type === 'dodge') u.anim = { type: 'hit', t: 0, dur: o.crit ? 0.5 : 0.35, hitAt: 0, color: col };
      const big = !!o.crit;
      this.add.burst(p, col, big ? 60 : 26, { speed: big ? 9 : 5.5, life: 0.55, size: big ? 0.35 : 0.25, gravity: 6 });
      this.add.burst(p, 0xffffff, big ? 16 : 6, { speed: 10, life: 0.18, size: 0.2 });
      if (!o.dot && (o.kind === 'attack' || o.element === 'phys')) this.vfx.slash(p, big ? 0xffffff : 0xffe28a, big ? 1.9 : 1.2);
      this.shake(big ? 0.4 : 0.13, big ? 0.35 : 0.18);
      if (big) { this.punch = 1; this.hitstop(0.1); this.flash(p, 0xfff0c0, 22); this.vfx.glow(p, 0xffffff, 1.8, 0.2); }
    }
    if (o.heal && !o.revived) this.add.burst(p, 0x86efac, 14, { speed: 2, up: true, life: 0.8, gravity: -1 });
    if (o.mp) { this.add.burst(p, 0x60a5fa, 26, { speed: 2, up: true, life: 0.9, size: 0.3 }); this.vfx.circle(u.base, 0x60a5fa, 0.8, 1.4); }
    if (o.killed) {
      u.dead = true;
      this.later(0.12, () => { this.add.burst(p, 0xffffff, 44, { speed: 8, life: 0.6, size: 0.3 }); this.add.burst(p, 0xff3b3b, 34, { speed: 5, life: 0.9, gravity: 5 }); this.vfx.shockwave(u.base, 0xff5533, 3, 0.5); this.shake(0.3, 0.3); });
      for (let i = 0; i < 14; i++) this.later(0.35 + i * 0.05, () => this.add.spawn(p.x + (Math.random() - 0.5) * 0.5, p.y, p.z + (Math.random() - 0.5) * 0.5, 0, 1.6, 0, 1.2, 0.3, 0xbfd8ff, -0.5, 0.95));
    }
    if (o.revived) { u.dead = false; }
  }

  stun(uid: string) {
    const u = this.units.get(uid); if (!u) return;
    const p = this.chest(u); p.y += u.rig.height * 0.5;
    this.add.burst(p, 0xfff27a, 14, { speed: 1.5, life: 0.6, size: 0.25 });
  }

  setStatuses(uid: string, list: StatusType[]) {
    const u = this.units.get(uid); if (!u) return;
    u.statuses = new Set(list);
    const want = (on: boolean, key: 'bubble' | 'stars' | 'tauntRing', make: () => THREE.Mesh | THREE.Group) => {
      if (on && !u[key]) { const o = make(); u.rig.root.add(o); (u as unknown as Record<string, THREE.Object3D>)[key] = o; }
      if (!on && u[key]) { const o = u[key]!; u.rig.root.remove(o); o.traverse((c) => { const m = c as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); }); u[key] = undefined; }
    };
    const sc = u.rig.root.scale.x;
    want(u.statuses.has('shield') && !u.dead, 'bubble', () => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry((u.rig.height / sc) * 0.62, 2), new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true }));
      m.position.y = (u.rig.height / sc) * 0.5; return m;
    });
    want(u.statuses.has('stun') && !u.dead, 'stars', () => {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), new THREE.MeshBasicMaterial({ color: 0xffe14a })); const a = (i / 3) * Math.PI * 2; s.position.set(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35); g.add(s); }
      g.position.y = u.rig.height / sc + 0.1; return g;
    });
    want(u.statuses.has('taunt') && !u.dead, 'tauntRing', () => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 32), new THREE.MeshBasicMaterial({ color: 0xff5533, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.05; return m;
    });
  }

  setHp(uid: string, ratio: number) { const u = this.units.get(uid); if (u) u.hp = ratio; }

  victory(side: 'ally' | 'enemy') {
    this.focus(null, side === 'ally' ? 0.9 : 1.05);
    for (const u of this.units.values()) if (u.side === side && !u.dead) u.anim = { type: 'victory', t: 0, dur: 3, hitAt: 0, color: 0xffffff };
    if (side === 'ally') for (let i = 0; i < 8; i++) this.later(i * 0.16, () => { const c = [0xf6c453, 0xfff3c0, 0x86efac, 0x7dd3fc][i % 4]; const p = new THREE.Vector3((Math.random() - 0.5) * 8, 3 + Math.random() * 2, (Math.random() - 0.5) * 4); this.add.burst(p, c, 60, { speed: 6, life: 1.3, gravity: 4, size: 0.3 }); });
  }

  // ------------------------------------------------------------ LOOP
  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const realDt = Math.max(0, Math.min(0.5, (now - this.last) / 1000));
    const rdt = Math.min(0.05, realDt);
    this.last = now;
    let dt = this.paused ? 0 : rdt;
    if (this.hitT > 0) { this.hitT -= rdt; dt *= 0.08; }
    this.time += dt;
    const t = this.time;

    for (let i = this.timers.length - 1; i >= 0; i--) { const tm = this.timers[i]; tm.t -= dt; if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); } }

    for (const u of this.units.values()) {
      const r = u.rig;
      const pos = r.root.position;
      pos.copy(u.base);
      r.root.rotation.y = u.face;
      r.rig.position.set(0, 0, 0);
      r.rig.rotation.set(0, 0, 0);
      walkPose(r, 0, 0);
      u.offset.multiplyScalar(Math.pow(0.02, dt));
      pos.add(u.offset);
      const an = u.anim;
      if (an) {
        an.t += dt;
        const k = Math.min(1, an.t / an.dur);
        const h = an.hitAt;
        if ((an.type === 'melee' || an.type === 'leap' || an.type === 'whirl') && an.to) {
          const goEnd = Math.max(0.05, h * 0.78);
          const back0 = h + 0.14 + (an.type === 'whirl' ? 0.2 : 0);
          let out: number;
          const pre = goEnd * 0.22;
          if (an.t < pre) { out = 0; r.rig.position.y = -0.14 * (an.t / pre); r.rig.scale.set(1.06, 0.92, 1.06); r.rig.rotation.x = 0.25 * (an.t / pre); }
          else if (an.t < goEnd) out = easeOut((an.t - pre) / (goEnd - pre));
          else if (an.t < back0) out = 1;
          else out = 1 - easeInOut(Math.min(1, (an.t - back0) / Math.max(0.05, an.dur - back0)));
          pos.lerpVectors(u.base, an.to, out);
          if (an.type === 'leap') { if (an.t < h) pos.y += Math.sin((an.t / h) * Math.PI) * 2.2; r.rig.rotation.x = an.t < h ? -0.3 + (an.t / h) * 0.9 : 0.6 * Math.max(0, 1 - (an.t - h) * 5); }
          else if (an.t < goEnd) { pos.y += Math.sin((an.t / goEnd) * Math.PI) * 0.35; walkPose(r, an.t * 26, 1); }
          else if (an.t > back0) walkPose(r, an.t * 22, 0.8);
          const sw = (an.t - h * 0.85) / 0.25;
          if (sw > 0 && sw < 1) {
            r.rig.rotation.x = Math.sin(sw * Math.PI) * 0.55;
            if (r.weapon) r.weapon.rotation.z = Math.sin(sw * Math.PI) * 1.6;
            if (r.weapon && dt > 0) { r.weapon.localToWorld(this.tipV.set(0, 0.9, 0)); for (let i = 0; i < 3; i++) this.add.spawn(this.tipV.x, this.tipV.y, this.tipV.z, 0, 0, 0, 0.22, 0.28, an.color, 0, 0.9, -0.5); }
          } else if (r.weapon) r.weapon.rotation.z = 0;
          if (an.type === 'whirl' && an.t > h * 0.8 && an.t < back0) r.root.rotation.y = u.face + (an.t - h * 0.8) * 30;
          if (an.t < goEnd && dt > 0 && Math.random() < 0.6) this.norm.spawn(pos.x, 0.1, pos.z, 0, 0.5, 0, 0.7, 0.5, 0xa08c6a, 0, 0.9, 1.6);
        } else if (an.type === 'cast' || an.type === 'item') {
          const up = an.t < h ? easeOut(an.t / h) : Math.max(0, 1 - (an.t - h) * 4);
          r.rig.position.y = up * (an.type === 'cast' ? 0.35 : 0.12);
          r.rig.rotation.x = -up * 0.18;
          const l = r.limbs; if (l?.armR) l.armR.o.rotation.x = l.armR.rx - up * 2.2; if (l?.armL && an.type === 'cast') l.armL.o.rotation.x = l.armL.rx - up * 1.4;
          if (an.type === 'cast' && an.t < h && dt > 0 && Math.random() < 0.8) { const c = this.chest(u); const a2 = Math.random() * 6.28; this.add.spawn(c.x + Math.cos(a2) * 0.8, c.y - 0.6, c.z + Math.sin(a2) * 0.8, -Math.cos(a2) * 0.8, 1.5, -Math.sin(a2) * 0.8, 0.5, 0.18, an.color); }
        } else if (an.type === 'shoot') {
          const l = r.limbs; const aim = Math.min(1, an.t / Math.max(0.05, h * 0.6));
          if (l?.armR) l.armR.o.rotation.x = l.armR.rx - aim * 1.4;
          if (an.t > h) { const rk = Math.max(0, 1 - (an.t - h) * 6); pos.addScaledVector(this.fwd(u), -rk * 0.25); }
        } else if (an.type === 'power') {
          const c0 = an.t < h * 0.6 ? an.t / (h * 0.6) : 1;
          r.rig.position.y = an.t < h * 0.6 ? -c0 * 0.15 : Math.max(0, 0.3 - (an.t - h * 0.6) * 0.8);
          const l = r.limbs; const rise = an.t > h * 0.6 ? Math.min(1, (an.t - h * 0.6) * 6) : 0;
          if (l?.armR) l.armR.o.rotation.x = l.armR.rx - rise * 2.6; if (l?.armL) l.armL.o.rotation.x = l.armL.rx - rise * 2.6;
        } else if (an.type === 'hit') {
          const kbk = 0.4 + u.kb * 0.7;
          pos.addScaledVector(this.fwd(u), -Math.sin(k * Math.PI) * kbk);
          r.rig.rotation.x = -Math.sin(k * Math.PI) * (0.35 + u.kb * 0.3);
          r.rig.rotation.z = Math.sin(k * Math.PI * 3) * 0.08 * (1 - k);
          if (u.kb) r.root.rotation.y = u.face + Math.sin(k * Math.PI) * 0.6;
          const l = r.limbs; if (l?.armL) l.armL.o.rotation.x = l.armL.rx - Math.sin(k * Math.PI) * 0.8; if (l?.armR) l.armR.o.rotation.x = l.armR.rx - Math.sin(k * Math.PI) * 0.6;
        } else if (an.type === 'dodge') {
          const f = this.fwd(u); const side = new THREE.Vector3(f.z, 0, -f.x).multiplyScalar(u.dodgeDir);
          const d = Math.sin(k * Math.PI);
          pos.addScaledVector(side, d * 0.9); pos.y += d * 0.35;
          r.rig.rotation.z = -u.dodgeDir * d * 0.35;
          if (dt > 0 && k < 0.5) this.add.spawn(pos.x, 0.9, pos.z, 0, 0, 0, 0.25, 0.9, 0x9ad0ff, 0, 0.9);
        } else if (an.type === 'victory') {
          const jump = Math.abs(Math.sin(an.t * 5 + u.phase));
          r.rig.position.y = jump * 0.6;
          if (an.t < 0.7) r.root.rotation.y = u.face + (an.t / 0.7) * Math.PI * 2;
          const l = r.limbs; if (l?.armR) l.armR.o.rotation.x = l.armR.rx - 2.8; if (l?.armL) l.armL.o.rotation.x = l.armL.rx - 1.2 - jump * 1.2;
        }
        if (k >= 1) u.anim = null;
      }
      if (!u.dead && (!an || an.type === 'hit')) {
        const low = u.hp < 0.3;
        const br = low ? 4.5 : 2.6;
        r.rig.position.y += Math.sin(t * br + u.phase) * (low ? 0.02 : 0.035);
        r.rig.scale.set(1, 1 + Math.sin(t * br + u.phase) * (low ? 0.025 : 0.012), 1);
        const l = r.limbs;
        if (l?.head) { l.head.o.rotation.y = Math.sin(t * 0.7 + u.phase) * 0.35; l.head.o.rotation.x = low ? 0.35 : Math.sin(t * 0.5 + u.phase) * 0.06; }
        if (!an) {
          if (low) { r.rig.rotation.x = 0.28; if (l?.armL) l.armL.o.rotation.x = l.armL.rx - 0.4; if (dt > 0 && Math.random() < dt * 1.5) { const c = this.chest(u); this.add.spawn(c.x, c.y + 0.4, c.z, 0, -0.5, 0, 0.8, 0.14, 0xff4466, 1); } }
          else {
            if (l?.armL) l.armL.o.rotation.x = l.armL.rx + Math.sin(t * 1.3 + u.phase) * 0.08;
            if (l?.armR) l.armR.o.rotation.x = l.armR.rx - Math.sin(t * 1.3 + u.phase) * 0.08;
            r.rig.rotation.y = Math.sin(t * 0.4 + u.phase) * 0.12;
            if (r.weapon) r.weapon.rotation.z = Math.sin(t * 1.7 + u.phase) * 0.12;
          }
        }
      }
      // entrance jump
      if (u.enter) {
        const e = u.enter; e.t += this.paused ? 0 : realDt;
        if (e.t < 0) { pos.set(9999, 0, 9999); }
        else {
          const k = Math.min(1, e.t / e.dur);
          const drop = e.from.y > 1;
          if (drop) { pos.copy(u.base); pos.y = e.from.y * (1 - k * k); r.rig.rotation.x = 0; }
          else {
            pos.lerpVectors(e.from, u.base, easeOut(k));
            pos.y = Math.sin(k * Math.PI) * 2.6;
            r.rig.rotation.y = (1 - k) * Math.PI * 2;
            const l = r.limbs; const tuck = Math.sin(k * Math.PI);
            if (l?.legL) l.legL.o.rotation.x = l.legL.rx - tuck * 1.1; if (l?.legR) l.legR.o.rotation.x = l.legR.rx - tuck * 0.7;
            if (l?.armL) l.armL.o.rotation.x = l.armL.rx - tuck * 2.4; if (l?.armR) l.armR.o.rotation.x = l.armR.rx - tuck * 2.4;
          }
          if (k >= 1) {
            if (!e.landed) {
              e.landed = true;
              this.vfx.shockwave(u.base, u.side === 'ally' ? 0x9ad0ff : 0xff7a5a, drop ? 3.4 : 2.2, 0.5);
              this.vfx.debris(u.base, drop ? 20 : 8, 0x8a7458);
              this.shake(drop ? 0.35 : 0.12, 0.25);
              u.anim = { type: 'power', t: 0, dur: 0.45, hitAt: 0.1, color: 0xffffff };
            }
            u.enter = null;
          }
        }
      }
      u.deadK += ((u.dead ? 1 : 0) - u.deadK) * Math.min(1, dt * 6);
      if (u.deadK > 0.001) { r.rig.rotation.x = -1.45 * u.deadK; r.rig.position.y *= 1 - u.deadK; }
      u.flash = Math.max(0, u.flash - dt * 5);
      const dark = 1 - u.deadK * 0.65;
      r.mats.forEach((m, i) => {
        m.color.copy(u.baseCols[i]).multiplyScalar(dark);
        m.emissive.copy(u.baseEm[i]).multiplyScalar(dark);
        if (u.flash > 0) { m.emissive.r += u.flash * u.flashCol.r * 0.55; m.emissive.g += u.flash * u.flashCol.g * 0.55; m.emissive.b += u.flash * u.flashCol.b * 0.55; }
        if (u.statuses.has('atkUp') || u.statuses.has('magUp')) m.emissive.r += 0.05 + Math.sin(t * 6) * 0.03;
      });
      if (u.stars) u.stars.rotation.y += dt * 4;
      if (u.bubble) { (u.bubble.material as THREE.MeshBasicMaterial).opacity = 0.16 + Math.sin(t * 3) * 0.06; u.bubble.rotation.y += dt * 0.5; }
      if (u.tauntRing) { const s = 1 + Math.sin(t * 5) * 0.1; u.tauntRing.scale.set(s, s, s); }
      if (!u.dead && dt > 0) {
        const c = this.chest(u);
        if (u.statuses.has('poison') && Math.random() < dt * 6) this.add.spawn(c.x + (Math.random() - 0.5) * 0.5, c.y, c.z + (Math.random() - 0.5) * 0.5, 0, 0.8, 0, 0.8, 0.2, 0x8be04a, -0.2);
        if (u.statuses.has('burn') && Math.random() < dt * 12) this.add.spawn(c.x + (Math.random() - 0.5) * 0.5, c.y - 0.3, c.z + (Math.random() - 0.5) * 0.5, 0, 1.4, 0, 0.5, 0.3, 0xff7a2a, -0.5, 0.9, -0.5);
        if (u.statuses.has('bleed') && Math.random() < dt * 5) this.add.spawn(c.x, c.y, c.z, (Math.random() - 0.5), -0.5, (Math.random() - 0.5), 0.6, 0.15, 0xff2244, 4);
        if (u.statuses.has('regen') && Math.random() < dt * 4) this.add.spawn(c.x + (Math.random() - 0.5) * 0.7, 0.2, c.z + (Math.random() - 0.5) * 0.7, 0, 1.2, 0, 1, 0.2, 0x86efac);
        if ((u.statuses.has('atkUp') || u.statuses.has('magUp') || u.statuses.has('spdUp')) && Math.random() < dt * 8) { const a2 = Math.random() * 6.28; this.add.spawn(u.base.x + Math.cos(a2) * 0.5, 0.1, u.base.z + Math.sin(a2) * 0.5, 0, 2, 0, 0.6, 0.18, u.statuses.has('spdUp') ? 0x5eead4 : 0xff9a4a); }
      }
    }

    const arm = this.actorRing.material as THREE.MeshBasicMaterial;
    arm.opacity = Math.max(0, arm.opacity - dt * 1.2);
    this.actorRing.rotation.z += dt;

    if (dt > 0) {
      for (const e of this.emitters) {
        if (Math.random() < dt * 25) this.add.spawn(e.x + (Math.random() - 0.5) * 0.3, e.y, e.z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 1.3 + Math.random(), (Math.random() - 0.5) * 0.3, 0.55 + Math.random() * 0.3, e.z < -20 ? 1.6 : 0.4, Math.random() < 0.5 ? 0xff8a2a : 0xffd04a, -0.5, 0.92, -0.6);
        if (Math.random() < dt * 4) this.norm.spawn(e.x, e.y + 0.8, e.z, 0.3, 0.7 + Math.random() * 0.3, 0, 3, e.z < -20 ? 2.5 : 0.6, 0x4a423a, 0, 0.98, 2.2);
      }
      if (Math.random() < dt * 14) this.add.spawn((Math.random() - 0.5) * 22, 0.2, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 0.4, 0.5 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4, 4, 0.08, 0xffa040, -0.05, 0.99);
    }
    for (const c of this.clouds) { c.position.x += dt * 0.8; if (c.position.x > 60) c.position.x = -60; }
    for (const f of this.flags) { const bp = f.geometry.attributes.position; for (let i = 0; i < bp.count; i++) { const x = bp.getX(i); bp.setZ(i, Math.sin(x * 6 - t * 5) * 0.08 * (x + 0.45)); } bp.needsUpdate = true; }
    this.fireLights.forEach((l, i) => { l.intensity = 6 + Math.sin(t * 14 + i * 2) * 2 + Math.random() * 2; });
    this.flashLight.intensity *= Math.pow(0.002, rdt);

    for (let i = this.fxs.length - 1; i >= 0; i--) {
      const f = this.fxs[i]; f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      f.update(k, dt);
      if (k >= 1) { f.dispose?.(); this.fxs.splice(i, 1); }
    }
    this.add.update(dt); this.norm.update(dt);

    // camera
    this.intro = THREE.MathUtils.clamp(this.intro - realDt / 1.2, 0, 1);
    const ik = easeInOut(this.intro);
    this.camFocus.lerp(this.camFocusT, 1 - Math.exp(-rdt * 3.5));
    this.camZoom += (this.camZoomT - this.camZoom) * (1 - Math.exp(-rdt * 3.5));
    const cp = this.camera.position;
    cp.copy(this.camBase).sub(this.camLook).multiplyScalar(this.camZoom).add(this.camLook).add(this.camFocus);
    cp.x += Math.sin(this.time * 0.25) * 0.5 + ik * 7;
    cp.y += ik * 6; cp.z += ik * 7;
    if (this.shakeT > 0) { this.shakeT -= rdt; const m = this.shakeM * Math.max(0, this.shakeT / 0.3); cp.x += (Math.random() - 0.5) * m; cp.y += (Math.random() - 0.5) * m; }
    this.tmpV.copy(this.camLook).add(this.camFocus);
    this.camera.lookAt(this.tmpV);
    this.lookT.copy(this.tmpV);
    this.windU.value = this.time;
    if (this.bokeh) { const bu = this.bokeh.uniforms as unknown as Record<string, { value: number }>; const want = cp.distanceTo(this.lookT) * 0.86; bu.focus.value += (want - bu.focus.value) * Math.min(1, rdt * 6); bu.aperture.value = this.intro > 0.05 ? 0.0032 : 0.0015; }
    this.punch = Math.max(0, this.punch - rdt * 3);
    const baseFov = this.portrait ? 52 : 40;
    const fov = baseFov - Math.sin(this.punch * Math.PI) * 4;
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }

    this.composer.render(rdt);

    const w = this.container.clientWidth, h = this.container.clientHeight;
    for (const u of this.units.values()) {
      const el = this.anchor(u.uid);
      if (!el) continue;
      const hgt = u.dead ? 0.7 : u.rig.height + 0.25;
      this.tmpV.copy(u.rig.root.position); this.tmpV.y = Math.max(0, this.tmpV.y) + hgt + Math.max(0, u.rig.rig.position.y);
      this.tmpV.project(this.camera);
      el.style.transform = `translate3d(${(((this.tmpV.x + 1) / 2) * w).toFixed(1)}px, ${(((1 - this.tmpV.y) / 2) * h).toFixed(1)}px, 0)`;
    }
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.fxs.forEach((f) => f.dispose?.());
    disposeScene(this.scene);
    this.add.dispose(); this.norm.dispose(); this.vfx.dispose();
    this.glowTex.dispose(); this.circleTex.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

const BIOME_CFG: Record<Biome, { fog: string; sky: number; hill: number; groundPal: string[]; grass: [number, number]; grassH: number; grassDensity: number; leaf: number; rock: number; trees: number; bushes: number; rocks: number; treeKinds: string[]; flowers?: number[]; temple: boolean }> = {
  forest: { fog: '#cfe8e4', sky: 0xe8f4ff, hill: 0x4a9a5a, groundPal: ['#7cc05a', '#6ab04a', '#94d06a', '#5aa040', '#b8e088', '#a88a5a'], grass: [0x3a8a3a, 0x9ad060], grassH: 1.1, grassDensity: 1, leaf: 0x4aa850, rock: 0xb8b8b0, trees: 26, bushes: 14, rocks: 8, treeKinds: ['pine', 'pine', 'broad', 'pine'], flowers: [0xffffff, 0xc0a0ff, 0xffe14a], temple: false },
  plain: { fog: '#d8eef8', sky: 0xffffff, hill: 0x7ac05a, groundPal: ['#9ad460', '#88c450', '#b0e070', '#78b448', '#d8f090', '#c8a870'], grass: [0x5aa83a, 0xc8e870], grassH: 1, grassDensity: 1, leaf: 0x5ab84a, rock: 0xc8c0b0, trees: 16, bushes: 12, rocks: 5, treeKinds: ['palm', 'broad', 'palm', 'banana'], flowers: [0xffe14a, 0xff7ab0, 0xffffff], temple: true },
  dry: { fog: '#f6e8c8', sky: 0xfff4e0, hill: 0xc8b060, groundPal: ['#d8c878', '#c8b868', '#e8d890', '#b8a458', '#f0e0a0', '#c89a60'], grass: [0xb8a048, 0xf0e090], grassH: 1.25, grassDensity: 0.6, leaf: 0xa8b84a, rock: 0xd8b890, trees: 12, bushes: 8, rocks: 16, treeKinds: ['dead', 'dead', 'broad'], flowers: [0xffffff, 0xffa040], temple: true },
  tropical: { fog: '#d0f0ea', sky: 0xe8fff8, hill: 0x3ab070, groundPal: ['#7ccc5a', '#68bc4a', '#98dc6a', '#58ac40', '#c0ec88', '#b89a6a'], grass: [0x3a9a3a, 0x9ae060], grassH: 1.15, grassDensity: 1, leaf: 0x3ab84a, rock: 0xb0b8b0, trees: 26, bushes: 16, rocks: 5, treeKinds: ['palm', 'banana', 'palm', 'broad'], flowers: [0xff4a6a, 0xffa030, 0xffffff], temple: false },
};
