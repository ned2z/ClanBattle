import * as THREE from 'three';
import type { ClassId } from '../game/types';
import { disposeScene } from './MapWorld';
import { makeCity, makeCloud, makeHero, makePalm, makeRuin, makeTankProp, puffyTree, toonGradient, walkPose, type Rig } from './models';
import { ParticleSystem } from './particles';
import { glowTexture, groundTexture, skyTexture, textSprite } from './textures';
import { TIME_BLEND, blendSkyStyle, skyAt, type SkyStyle } from '../game/sky';

const START = -13, END = 13;

export class TravelWorld {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 2, 0.1, 300);
  private host: HTMLElement;
  private party: Rig[] = [];
  private progress = 0;
  private shown = 0;
  private moving = true;
  private raf = 0; private last = 0; private t = 0;
  private dust: ParticleSystem;
  private fire: ParticleSystem;
  private emitters: THREE.Vector3[] = [];
  private alertS: THREE.Sprite;
  private alertT = -1;
  private ro: ResizeObserver;
  private dead = false;
  private glow = glowTexture();
  private hemi!: THREE.HemisphereLight;
  private key!: THREE.DirectionalLight;
  private sunS!: THREE.Sprite;
  private skyMesh!: THREE.Mesh;

  constructor(host: HTMLElement, members: { cls: ClassId; color: string }[], tier: number) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.domElement.style.display = 'block';
    host.appendChild(this.renderer.domElement);

    const danger = Math.min(1, (tier - 1) / 6);
    const fog = new THREE.Color().lerpColors(new THREE.Color('#d8eef8'), new THREE.Color('#f0d8c0'), danger);
    this.scene.fog = new THREE.Fog(fog, 18, 60);
    this.scene.background = fog;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 20, 12), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }));
    this.scene.add(sky);
    this.skyMesh = sky;
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: 0xffb060, fog: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sun.scale.set(40, 40, 1); sun.position.set(10, 10, -100); this.scene.add(sun);
    this.sunS = sun;
    this.hemi = new THREE.HemisphereLight(0xdff2ff, 0x7ab060, 1.35);
    this.scene.add(this.hemi);
    const key = new THREE.DirectionalLight(0xfff0d8, 2.2);
    this.key = key;
    key.position.set(6, 10, 8); key.castShadow = true; key.shadow.mapSize.set(1024, 512);
    const sc = key.shadow.camera; sc.left = -20; sc.right = 20; sc.top = 6; sc.bottom = -6;
    this.scene.add(key);

    const gt = groundTexture(); gt.repeat.set(10, 4);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 50), new THREE.MeshToonMaterial({ map: gt, gradientMap: toonGradient() }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(60, 1.8), new THREE.MeshToonMaterial({ color: 0xf0dca8, gradientMap: toonGradient() }));
    road.rotation.x = -Math.PI / 2; road.position.y = 0.01; road.receiveShadow = true; this.scene.add(road);

    // hills
    const hG = new THREE.ConeGeometry(1, 1, 6); hG.translate(0, 0.5, 0);
    const hM = new THREE.MeshToonMaterial({ color: 0x6ab85a, gradientMap: toonGradient() });
    for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hM); const s = 4 + Math.random() * 7; m.scale.set(s, 3 + Math.random() * 6, s); m.position.set(-40 + i * 3.3, 0, -18 - Math.random() * 12); this.scene.add(m); }
    // cities at both ends
    const c1 = makeCity(3, false); c1.scale.setScalar(1.8); c1.position.set(START - 3.4, 0, -2.4); this.scene.add(c1);
    const c2 = makeCity(3, true); c2.scale.setScalar(1.8); c2.position.set(END + 3.4, 0, -2.4); this.scene.add(c2);
    // scenery
    for (let i = 0; i < 16; i++) { const p = makePalm(); p.scale.setScalar(0.8 + Math.random() * 0.5); p.position.set(-20 + Math.random() * 40, 0, -3 - Math.random() * 7); p.rotation.y = Math.random() * 6; p.traverse((o) => { o.castShadow = true; }); this.scene.add(p); }
    const nRuins = 2 + Math.round(danger * 4);
    for (let i = 0; i < nRuins; i++) { const r = makeRuin(1 + Math.random()); r.position.set(-9 + (i / nRuins) * 18 + Math.random() * 2, 0, -3.5 - Math.random() * 3); r.rotation.y = Math.random() * 3; this.scene.add(r); this.emitters.push(new THREE.Vector3(r.position.x + 0.5, 1, r.position.z)); }
    if (danger > 0.3) { const tk = makeTankProp(); tk.scale.setScalar(0.8); tk.position.set(4, 0, -5); tk.rotation.y = 2.4; this.scene.add(tk); }

    for (let i = 0; i < 18; i++) { const t = puffyTree(1.3 + Math.random(), 0x5ab84a); t.position.set(-24 + Math.random() * 48, 0, -6 - Math.random() * 8); this.scene.add(t); }
    for (let i = 0; i < 4; i++) { const c = makeCloud(1.6); c.position.set(-20 + i * 13, 9 + Math.random() * 2, -22); this.scene.add(c); }
    // party
    members.forEach((m, i) => {
      const r = makeHero(m.cls, m.color);
      r.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
      r.root.rotation.y = Math.PI / 2;
      r.root.scale.setScalar(0.9);
      this.scene.add(r.root);
      this.party.push(r);
      r.root.userData.idx = i;
    });
    this.alertS = new THREE.Sprite(new THREE.SpriteMaterial({ map: textSprite('!'), transparent: true, depthTest: false }));
    this.alertS.visible = false; this.alertS.renderOrder = 10; this.scene.add(this.alertS);

    this.dust = new ParticleSystem(300, THREE.NormalBlending); this.dust.mat.uniforms.uOpacity.value = 0.4;
    this.fire = new ParticleSystem(400, THREE.AdditiveBlending); this.fire.mat.uniforms.uBoost.value = 1.5;
    this.scene.add(this.dust.points, this.fire.points);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  setProgress(p: number, moving: boolean) { this.progress = p; this.moving = moving; }

  /** Retarget the lighting; eased in the render loop. */
  setTimeOfDay(minute: number) { this.targetSky = skyAt(minute); if (!this.skyFrom) this.skyFrom = this.targetSky; }

  private targetSky: SkyStyle | null = null;
  private skyFrom: SkyStyle | null = null;
  private skyT = 1;

  private blendSky(dt: number) {
    const to = this.targetSky;
    if (!to) return;
    if (this.skyT < 1) this.skyT = Math.min(1, this.skyT + dt / TIME_BLEND);
    if (!this.skyFrom) { this.applySky(to); return; }
    if (this.skyT >= 1) { this.skyFrom = to; this.applySky(to); return; }
    this.applySky(blendSkyStyle(this.skyFrom, to, this.skyT));
  }

  private applySky(s: SkyStyle) {
    const fog = this.scene.fog as THREE.Fog;
    fog.color.set(s.fog);
    this.scene.background = new THREE.Color(s.sky);
    this.hemi.color.set(s.hemiSky);
    this.hemi.groundColor.set(s.hemiGround);
    this.hemi.intensity = s.hemiI;
    this.key.color.set(s.sun);
    this.key.intensity = s.sunI;
    this.renderer.toneMappingExposure = s.exposure;

    // The sky sphere keeps its daylight texture; tinting it dark is far
    // cheaper than regenerating the canvas texture, and the material is
    // MeshBasicMaterial so nothing lights it.
    const m = this.skyMesh.material as THREE.MeshBasicMaterial;
    m.color.set(s.sky);
    // Night sky is darker than the fog, so lift the texture just enough that
    // the gradient still reads instead of collapsing to a flat silhouette.
    m.color.lerp(new THREE.Color(0xffffff), s.darkness * 0.22);

    // Sun becomes a moon: smaller, cooler, dimmer, and lifted a little higher.
    const night = s.darkness;
    this.sunS.material.color.set(night > 0.6 ? 0xcfe0ff : 0xffb060);
    const k = 1 - night * 0.55;
    this.sunS.scale.set(40 * k, 40 * k, 1);
    this.sunS.position.set(10, 10 + night * 14, -100);
  }

  jump(p: number) { this.progress = p; this.shown = p; }
  alert() { this.alertS.visible = true; this.alertT = 0; this.moving = false; }
  treasure() { const p = this.leadPos(); p.y += 1.8; this.fire.burst(p, 0xffd35a, 40, { speed: 4, life: 0.9, gravity: 4, size: 0.3 }); }

  private leadPos() { return this.party[0]?.root.position.clone() ?? new THREE.Vector3(); }

  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const ph = h * this.renderer.getPixelRatio();
    this.dust.setScale(ph, this.camera.fov); this.fire.setScale(ph, this.camera.fov);
  }

  private loop = (now: number) => {
    if (this.dead) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); this.last = now; this.t += dt;
    this.blendSky(dt);
    this.shown += (this.progress - this.shown) * Math.min(1, dt * 8);
    const lx = START + (END - START) * this.shown;
    this.party.forEach((r, i) => {
      const x = lx - i * 1.05;
      r.root.position.set(x, 0, (i % 2 ? -0.35 : 0.35));
      const ph = this.t * 9 + i * 1.3;
      if (this.moving) { walkPose(r, ph, 1); r.rig.position.y = Math.abs(Math.sin(ph)) * 0.08; if (Math.random() < dt * 6) this.dust.spawn(x - 0.2, 0.1, r.root.position.z, -0.4, 0.3, 0, 0.8, 0.45, 0xb8a47a, 0, 0.9, 1.4); }
      else { walkPose(r, 0, 0); r.rig.position.y = Math.sin(this.t * 2 + i) * 0.02; }
    });
    for (const e of this.emitters) if (Math.random() < dt * 18) this.fire.spawn(e.x + (Math.random() - 0.5) * 0.4, e.y, e.z, 0, 1.2 + Math.random(), 0, 0.6, 0.45, Math.random() < 0.5 ? 0xff8a2a : 0xffd04a, -0.5, 0.92, -0.5);
    if (this.alertT >= 0) { this.alertT += dt; const s = Math.min(1, this.alertT * 6) * 1.4 + Math.sin(this.alertT * 30) * 0.08; this.alertS.scale.set(s, s, 1); this.alertS.position.copy(this.leadPos()).setY(2.6); }
    this.dust.update(dt); this.fire.update(dt);
    const cx = THREE.MathUtils.clamp(lx - 1.5, START + 3, END - 3);
    this.camera.position.set(cx + Math.sin(this.t * 0.3) * 0.3, 2.6, 8.5);
    this.camera.lookAt(cx, 1.1, 0);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.dead = true; cancelAnimationFrame(this.raf); this.ro.disconnect();
    disposeScene(this.scene); this.dust.dispose(); this.fire.dispose(); this.glow.dispose();
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}
