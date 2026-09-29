import * as THREE from 'three';
import type { ActionEvent, Unit } from '../game/types';
import type { ParticleSystem } from './particles';
import { canvasTex } from './textures';

export interface Fx { t: number; dur: number; update(k: number, dt: number): void; dispose?(): void }
export interface VfxHost {
  scene: THREE.Scene; camera: THREE.Camera; add: ParticleSystem; norm: ParticleSystem;
  later(sec: number, fn: () => void): void; addFx(f: Fx): void; shake(m: number, d?: number): void;
  flash(pos: THREE.Vector3, color: number, intensity: number): void; hitstop(sec: number): void;
  glowTex: THREE.Texture; circleTex: THREE.Texture;
}

// effect families + the choreography itself live in the data layer
export type { Tech, Target, TechCtx, Step, Args, Recipe, Feature } from '../data/fx/types';
export { RECIPES, IMPACT, PRIMS, FEATURES } from '../data/fx';
import type { Target, Tech, TechCtx, Feature } from '../data/fx/types';
import { FxRunner, RECIPES, FEATURES } from '../data/fx';

const TECH: Record<string, Tech> = {
  s_taunt: 'buff', s_bash: 'leap', s_fort: 'buffall', b_cleave: 'bigslash', b_storm: 'whirl', b_rage: 'buff',
  r_vital: 'thrust', r_poison: 'poison', r_shadow: 'buff', m_fire: 'fireball', m_blizzard: 'blizzard', m_thunder: 'lightning',
  w_heal: 'heal', w_bless: 'healall', w_revive: 'revive', c_coin: 'coin', c_tonic: 'heal', c_merc: 'arrows',
  x_double: 'multi', x_ironfist: 'leap', x_boltarrow: 'lightning', x_hellfire: 'dragon', x_icespear: 'icelance', x_darkwave: 'dark',
  x_judgement: 'holy', x_drain: 'drain', x_spellblade: 'tornado', x_arrowrain: 'arrows', x_smoke: 'debuff', x_warcry: 'buffall',
  x_barrier: 'buffall', x_focus: 'buff', x_haste: 'buffall', x_holywater: 'heal', x_purify: 'heal', x_cobra: 'poison',
  x_rend: 'multi', x_quake: 'leap', x_tornado: 'tornado', x_pierce: 'thrust', x_armorbreak: 'leap', x_curse: 'debuff',
  x_chains: 'chains', x_awaken: 'buff', x_tigerspirit: 'buff', x_mist: 'buffall', x_stonewall: 'buff', x_dragon: 'dragon',
  x_meteor: 'meteor', x_chainbolt: 'chain', x_frostnova: 'blizzard', x_poisonarrow: 'shoot', x_thunderblade: 'bigslash',
  x_knee: 'leap', x_elbow: 'multi', x_manaburst: 'mana', x_moonlight: 'healall', x_naga: 'buffall', x_hawkeye: 'shoot',
  x_groundslam: 'leap', x_deathshadow: 'dark', x_claws: 'multi', x_cannon: 'cannon', x_grenade: 'meteor', x_ambush: 'thrust',
  x_banner: 'buffall', x_ration: 'healall', x_unbind: 'healall',
  y_slash3: 'multi', y_shieldthrow: 'shoot', y_firearrow: 'shoot', y_frostbite: 'icelance', y_spark: 'chain', y_mend: 'heal', y_guard: 'buff',
  y_sandthrow: 'debuff', y_headbutt: 'leap', y_leech: 'drain', y_herb: 'healall', y_quickstab: 'thrust', y_crescent: 'whirl', y_inferno: 'dragon',
  y_glacier: 'blizzard', y_thunderstorm: 'lightning', y_holynova: 'holy', y_venomcloud: 'debuff', y_bladedance: 'multi', y_sanctuary: 'healall',
  y_berserk: 'buff', y_ironwall: 'buffall', y_soulreap: 'bigslash', y_hex: 'debuff', y_earthspike: 'leap', y_windslash: 'tornado',
  y_phoenix: 'dragon', y_absolutezero: 'blizzard', y_judgmentday: 'holy', y_thousandcuts: 'multi', y_garuda: 'tornado', y_revival: 'revive',
  y_divineshield: 'buffall', y_blackhole: 'dark', y_meteorstorm: 'meteor', y_hanuman: 'leap', y_ramasoon: 'lightning', y_mekhala: 'mana',
  y_brahmastra: 'mana', y_amrita: 'healall',
  u_shield: 'buffall', u_berserker: 'whirl', u_rogue: 'multi', u_blackmage: 'dragon', u_whitemage: 'revive', u_merchant: 'coin',
  u_paladin: 'holy', u_guardian: 'buffall', u_berserk: 'multi', u_dragoon: 'leap', u_assassin: 'thrust', u_ranger: 'arrows',
  u_archmage: 'meteor', u_necro: 'dark', u_bishop: 'revive', u_sage: 'holy', u_smith: 'leap', u_alchemist: 'healall',
};

export const BIG_TECH = new Set<Tech>(['bigslash', 'whirl', 'leap', 'meteor', 'blizzard', 'lightning', 'dragon', 'tornado', 'dark', 'holy', 'revive', 'mana', 'cannon', 'arrows', 'healall', 'chain', 'fireball', 'buffall']);
export const MELEE_TECH = new Set<Tech>(['strike', 'multi', 'bigslash', 'whirl', 'thrust', 'leap', 'poison', 'drain']);

const RANGED_CLS = new Set(['blackmage', 'whitemage', 'merchant']);
const RANGED_MON = new Set(['🪖', '💂', '👻']);

export function techFor(ev: ActionEvent, actor: Unit): Tech {
  if (ev.kind === 'skip' || ev.kind === 'dot') return 'none';
  if (ev.kind === 'item') return 'item';
  if (ev.kind === 'attack') return (actor.cls && RANGED_CLS.has(actor.cls)) || RANGED_MON.has(actor.icon) ? 'shoot' : 'strike';
  return (ev.skillId && TECH[ev.skillId]) || (ev.kind === 'heal' ? 'heal' : ev.kind === 'buff' ? 'buff' : ev.kind === 'debuff' ? 'debuff' : ev.kind === 'mag' ? 'fireball' : 'strike');
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Vfx {
  private crackTex: THREE.Texture;
  streakTex: THREE.Texture;

  constructor(private h: VfxHost) {
    this.crackTex = canvasTex(256, 256, (c, w) => {
      c.translate(w / 2, w / 2); c.strokeStyle = '#fff'; c.lineCap = 'round'; c.shadowColor = '#fff'; c.shadowBlur = 8;
      for (let i = 0; i < 9; i++) {
        let x = 0, y = 0; const a0 = (i / 9) * Math.PI * 2 + Math.random() * 0.4; c.lineWidth = 6;
        c.beginPath(); c.moveTo(0, 0);
        for (let k = 0; k < 6; k++) { const a = a0 + (Math.random() - 0.5) * 0.7; x += Math.cos(a) * 20; y += Math.sin(a) * 20; c.lineTo(x, y); c.lineWidth = 6 - k; }
        c.stroke();
      }
    }, false);
    this.streakTex = canvasTex(64, 256, (c, w, hh) => {
      for (let i = 0; i < 14; i++) { const x = Math.random() * w; const g = c.createLinearGradient(0, 0, 0, hh); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x, Math.random() * hh * 0.3, 2 + Math.random() * 4, hh * 0.7); }
    }, false);
    this.streakTex.wrapS = this.streakTex.wrapT = THREE.RepeatWrapping;
  }
  dispose() { this.crackTex.dispose(); this.streakTex.dispose(); }

  // ------------------------------------------------------------ primitives
  basic(color: number, map?: THREE.Texture, opts: Partial<THREE.MeshBasicMaterialParameters> = {}) {
    return new THREE.MeshBasicMaterial({ color, map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, ...opts });
  }
  temp(obj: THREE.Object3D, dur: number, update: (k: number, dt: number) => void) {
    this.h.scene.add(obj);
    this.h.addFx({ t: 0, dur, update, dispose: () => { this.h.scene.remove(obj); obj.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mt = m.material as THREE.Material | undefined; mt?.dispose(); }); } });
  }

  circle(pos: THREE.Vector3, color: number, dur: number, size = 1.6) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.basic(color, this.h.circleTex));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos).setY(0.05);
    this.temp(m, dur, (k, dt) => { const s = size * Math.min(1, k * 6) * (1 + k * 0.15); m.scale.set(s, s, s); m.rotation.z += dt * 2.5; (m.material as THREE.MeshBasicMaterial).opacity = (k < 0.8 ? 1 : (1 - k) * 5) * 0.3; });
    const m2 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.basic(color, this.h.circleTex));
    m2.rotation.x = -Math.PI / 2; m2.position.copy(pos).setY(0.07);
    this.temp(m2, dur, (k, dt) => { const s = size * 0.62 * Math.min(1, k * 6); m2.scale.set(s, s, s); m2.rotation.z -= dt * 4; (m2.material as THREE.MeshBasicMaterial).opacity = (k < 0.8 ? 1 : (1 - k) * 5) * 0.28; });
  }
  glow(pos: THREE.Vector3, color: number, size: number, dur: number) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.h.glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.copy(pos);
    this.temp(s, dur, (k) => { const sc = size * 0.75 * (0.4 + k * 1.1); s.scale.set(sc, sc, 1); s.material.opacity = (1 - k) * 0.32; });
  }
  shockwave(pos: THREE.Vector3, color: number, size = 3, dur = 0.5, y = 0.08) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), this.basic(color));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos).setY(y);
    this.temp(m, dur, (k) => { const s = 0.3 + easeOut(k) * size * 0.8; m.scale.set(s, s, s); (m.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.25; });
  }
  crack(pos: THREE.Vector3, color: number, size = 2.6) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.basic(color, this.crackTex));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6; m.position.copy(pos).setY(0.06);
    this.temp(m, 1.4, (k) => { (m.material as THREE.MeshBasicMaterial).opacity = k < 0.1 ? k * 10 : 1 - k; });
  }
  debris(pos: THREE.Vector3, n = 24, color = 0x6b5236) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = rnd(2, 6); this.h.norm.spawn(pos.x, 0.2, pos.z, Math.cos(a) * v * 0.5, rnd(4, 8), Math.sin(a) * v * 0.5, rnd(0.6, 1.1), rnd(0.15, 0.3), color, 14, 0.98); }
    for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2; this.h.norm.spawn(pos.x + Math.cos(a) * 0.5, 0.2, pos.z + Math.sin(a) * 0.5, Math.cos(a) * 3, 0.5, Math.sin(a) * 3, 1.2, 0.8, 0xa08c6a, 0, 0.9, 2.2); }
  }
  slash(pos: THREE.Vector3, color: number, size = 1.3, rot = Math.random() * Math.PI * 2, dur = 0.3) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 32, 1, 0, Math.PI * 1.15), this.basic(color));
    const core = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.76, 32, 1, 0, Math.PI * 1.15), this.basic(0xffffff));
    m.add(core);
    m.position.copy(pos); m.quaternion.copy(this.h.camera.quaternion); m.rotateZ(rot);
    this.temp(m, dur, (k) => { const s = size * (0.6 + easeOut(k) * 0.7); m.scale.set(s, s, s); (m.material as THREE.MeshBasicMaterial).opacity = 1 - k; (core.material as THREE.MeshBasicMaterial).opacity = 1 - k; m.rotateZ(0.1); });
  }
  pillar(pos: THREE.Vector3, color: number, dur = 0.8, r = 0.7, hgt = 9) {
    const g = new THREE.CylinderGeometry(r, r, hgt, 24, 1, true); g.translate(0, hgt / 2, 0);
    const m = new THREE.Mesh(g, this.basic(color, this.streakTex));
    const inner = new THREE.Mesh(g.clone(), this.basic(0xffffff)); inner.scale.set(0.35, 1, 0.35); m.add(inner);
    m.position.copy(pos).setY(0);
    this.temp(m, dur, (k, dt) => { const w = Math.sin(k * Math.PI); m.scale.set(0.2 + w, 1, 0.2 + w); (m.material as THREE.MeshBasicMaterial).opacity = w * 0.2; (inner.material as THREE.MeshBasicMaterial).opacity = w * 0.1; this.streakTex.offset.y -= dt * 0.8; });
  }
  beam(a: THREE.Vector3, b: THREE.Vector3, color: number, dur: number, width: number) {
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(1, 1, len, 12, 1, true); g.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(g, this.basic(color));
    const core = new THREE.Mesh(g.clone(), this.basic(0xffffff)); core.scale.set(0.4, 0.4, 1); m.add(core);
    m.position.copy(a).lerp(b, 0.5); m.lookAt(b);
    this.temp(m, dur, (k) => { const w = width * Math.sin(Math.min(1, k * 1.3) * Math.PI) * (0.85 + Math.random() * 0.3); m.scale.set(w, w, 1); (m.material as THREE.MeshBasicMaterial).opacity = 0.8; });
  }
  projectile(from: THREE.Vector3, to: THREE.Vector3, color: number, flight: number, size = 0.9, arc = 0.8, trail = 1) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.h.glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.h.glowTex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    core.scale.set(0.45, 0.45, 1); s.add(core); s.scale.set(size, size, 1); s.position.copy(from);
    const p = new THREE.Vector3();
    this.temp(s, flight, (k) => {
      p.lerpVectors(from, to, k); p.y += Math.sin(k * Math.PI) * arc; s.position.copy(p);
      for (let i = 0; i < 2 * trail; i++) this.h.add.spawn(p.x, p.y, p.z, rnd(-0.4, 0.4), rnd(-0.4, 0.4), rnd(-0.4, 0.4), 0.35, size * 0.5, color, 0, 0.9, -0.6);
    });
  }
  bolt(to: THREE.Vector3, from?: THREE.Vector3, color = 0xfff27a) {
    const top = from ?? to.clone().add(new THREE.Vector3(rnd(-1.5, 1.5), 12, rnd(-1, 1)));
    const pts: THREE.Vector3[] = [];
    const n = 14;
    for (let i = 0; i <= n; i++) { const p = new THREE.Vector3().lerpVectors(top, to, i / n); if (i && i < n) { p.x += rnd(-0.5, 0.5); p.y += rnd(-0.3, 0.3); p.z += rnd(-0.5, 0.5); } pts.push(p); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curve, 40, 0.06, 5, false);
    const m = new THREE.Mesh(g, this.basic(0xffffff));
    const halo = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.2, 6, false), this.basic(color));
    m.add(halo);
    this.temp(m, 0.35, (k) => { const o = Math.random() < 0.25 ? 0.2 : 1 - k; (m.material as THREE.MeshBasicMaterial).opacity = o; (halo.material as THREE.MeshBasicMaterial).opacity = o * 0.6; });
    this.h.flash(to, 0xfff5b0, 45);
    this.h.add.burst(to, color, 30, { speed: 7, life: 0.4, size: 0.25 });
  }
  iceSpikes(pos: THREE.Vector3, scale = 1) {
    const g = new THREE.ConeGeometry(0.17, 1, 5); g.translate(0, 0.5, 0);
    const m = new THREE.MeshStandardMaterial({ color: 0xcff2ff, emissive: 0x4ab8ff, emissiveIntensity: 1.2, transparent: true, flatShading: true, roughness: 0.15, metalness: 0.4 });
    const group = new THREE.Group();
    for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(g, m); const a = (i / 9) * Math.PI * 2; const r = i === 0 ? 0 : 0.5; c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); c.rotation.set(Math.sin(a) * 0.45 * (r ? 1 : 0), 0, -Math.cos(a) * 0.45 * (r ? 1 : 0)); c.scale.set(1, (i === 0 ? 1.8 : 0.7 + Math.random() * 0.9) * scale, 1); group.add(c); }
    group.position.copy(pos).setY(0);
    this.temp(group, 0.9, (k) => { const s = k < 0.12 ? easeOut(k / 0.12) : 1; group.scale.set(1, s, 1); m.opacity = k < 0.7 ? 1 : (1 - k) / 0.3; });
    this.h.add.burst(pos, 0xe0f7ff, 26, { speed: 5, life: 0.6, size: 0.2, gravity: 5 });
  }

  // ------------------------------------------------------------ techniques
  /**
   * The choreography is data, not code: see `src/data/fx/recipes.ts`.
   * This method just hands the recipe to the runner and applies its "feel".
   */
  play(tech: Tech, c: TechCtx, featureId?: string) {
    const feature: Feature | undefined = featureId ? FEATURES[featureId] : undefined;
    const centre = c.targets.reduce((a, t) => a.add(t.base), new THREE.Vector3()).divideScalar(Math.max(1, c.targets.length));
    const runner = new FxRunner({
      v: this, h: this.h, c, centre, T: c.impact, col: c.color, rnd,
      targets: c.targets as Target[],
    });
    runner.play(tech, feature);
    const feel = { ...RECIPES[tech]?.feel, ...feature?.feel };
    if (feel?.hitstop) this.h.hitstop(feel.hitstop);
  }

  explode(p: THREE.Vector3, color: number, scale = 1) {
    const h = this.h;
    this.glow(p, color, 2.6 * scale, 0.4);
    this.glow(p, 0xffffff, 1.1 * scale, 0.15);
    this.shockwave(p, color, 3.5 * scale, 0.5);
    h.add.burst(p, color, Math.round(50 * scale), { speed: 7 * scale, life: 0.6, size: 0.35, gravity: 3 });
    h.add.burst(p, 0xffe08a, Math.round(20 * scale), { speed: 10 * scale, life: 0.3, size: 0.2 });
    for (let i = 0; i < 10 * scale; i++) h.norm.spawn(p.x + rnd(-0.4, 0.4), p.y, p.z + rnd(-0.4, 0.4), rnd(-1, 1), rnd(0.8, 2), rnd(-1, 1), 1.6, 1, 0x3a3430, 0, 0.93, 2.2);
    h.flash(p, color, 35);
  }
}

export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
