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

export type Tech =
  | 'strike' | 'multi' | 'bigslash' | 'whirl' | 'thrust' | 'leap' | 'shoot' | 'arrows' | 'cannon' | 'fireball' | 'meteor'
  | 'blizzard' | 'icelance' | 'lightning' | 'chain' | 'dragon' | 'tornado' | 'dark' | 'drain' | 'holy' | 'poison' | 'heal'
  | 'healall' | 'revive' | 'buff' | 'buffall' | 'debuff' | 'coin' | 'chains' | 'mana' | 'item' | 'none';

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

/** windup time (seconds at 1x) until the hit lands */
export const IMPACT: Record<Tech, number> = {
  strike: 0.34, multi: 0.38, bigslash: 0.62, whirl: 0.55, thrust: 0.42, leap: 0.62, shoot: 0.36, arrows: 0.85, cannon: 0.62,
  fireball: 0.66, meteor: 0.95, blizzard: 0.75, icelance: 0.55, lightning: 0.6, chain: 0.55, dragon: 0.62, tornado: 0.66,
  dark: 0.66, drain: 0.45, holy: 0.62, poison: 0.42, heal: 0.48, healall: 0.58, revive: 0.85, buff: 0.48, buffall: 0.58,
  debuff: 0.52, coin: 0.48, chains: 0.52, mana: 0.78, item: 0.3, none: 0.2,
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

export interface TechCtx {
  from: THREE.Vector3;      // actor chest
  fromBase: THREE.Vector3;  // actor feet
  fwd: THREE.Vector3;
  targets: { chest: THREE.Vector3; base: THREE.Vector3 }[];
  color: number;
  impact: number;           // seconds (speed-scaled)
  big: boolean;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Vfx {
  private crackTex: THREE.Texture;
  private streakTex: THREE.Texture;
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
  private basic(color: number, map?: THREE.Texture, opts: Partial<THREE.MeshBasicMaterialParameters> = {}) {
    return new THREE.MeshBasicMaterial({ color, map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, ...opts });
  }
  private temp(obj: THREE.Object3D, dur: number, update: (k: number, dt: number) => void) {
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
  play(tech: Tech, c: TechCtx) {
    const h = this.h; const T = c.impact; const col = c.color;
    const at = (frac: number, fn: () => void) => h.later(Math.max(0, T * frac), fn);
    const centre = c.targets.reduce((a, t) => a.add(t.base), new THREE.Vector3()).divideScalar(Math.max(1, c.targets.length));
    const aura = (dur: number, n = 1) => {
      const steps = Math.ceil(dur / 0.03);
      for (let i = 0; i < steps; i++) h.later(i * 0.03, () => { for (let j = 0; j < n; j++) { const a = Math.random() * Math.PI * 2; h.add.spawn(c.fromBase.x + Math.cos(a) * 0.55, 0.1, c.fromBase.z + Math.sin(a) * 0.55, -Math.cos(a) * 0.3, rnd(2, 3.5), -Math.sin(a) * 0.3, 0.5, 0.22, col, 0, 0.95); } });
    };
    switch (tech) {
      case 'strike':
        break;
      case 'multi':
        at(0.1, () => aura(T * 0.6));
        c.targets.forEach((t) => { at(1, () => { this.slash(t.chest, col, 1.4, 0.6); }); h.later(T + 0.07, () => this.slash(t.chest, 0xffffff, 1.5, -0.8)); h.later(T + 0.14, () => this.slash(t.chest, col, 1.2, 2.2)); });
        break;
      case 'bigslash':
        this.circle(c.fromBase, col, T * 1.2, 2);
        aura(T, 3);
        at(0.3, () => this.glow(c.from, col, 2.2, T * 0.7));
        c.targets.forEach((t) => at(1, () => { this.slash(t.chest, col, 3.2, -0.5, 0.45); this.slash(t.chest, 0xffffff, 2.4, 0.3, 0.35); this.crack(t.base, col, 3.2); this.shockwave(t.base, col, 4.5, 0.6); this.debris(t.base, 20); h.hitstop(0.09); h.shake(0.5, 0.4); h.flash(t.chest, col, 40); }));
        break;
      case 'whirl': {
        this.circle(c.fromBase, col, T * 1.4, 2.6);
        at(0.35, () => {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.06, 6, 40), this.basic(col));
          ring.rotation.x = -Math.PI / 2; ring.position.copy(centre).setY(0.9);
          this.temp(ring, T * 1.1, (k, dt) => { ring.rotation.z += dt * 18; const s = 0.6 + k * 0.8; ring.scale.set(s, s, s); (ring.material as THREE.MeshBasicMaterial).opacity = 1 - k * 0.8; for (let i = 0; i < 3; i++) { const a = Math.random() * Math.PI * 2; h.add.spawn(centre.x + Math.cos(a) * 1.6 * s, 0.9, centre.z + Math.sin(a) * 1.6 * s, -Math.sin(a) * 4, 0.5, Math.cos(a) * 4, 0.3, 0.2, col); } });
        });
        c.targets.forEach((t, i) => { at(1, () => this.slash(t.chest, col, 1.8, i)); h.later(T + 0.1, () => this.slash(t.chest, 0xffffff, 1.6, i + 2)); });
        at(1, () => { this.shockwave(centre, col, 5, 0.6); h.shake(0.35, 0.35); });
        break;
      }
      case 'thrust':
        aura(T * 0.8, 2);
        c.targets.forEach((t) => at(1, () => { const back = t.chest.clone().sub(c.fwd.clone().multiplyScalar(2)); const fwd = t.chest.clone().add(c.fwd.clone().multiplyScalar(2.2)); this.beam(back, fwd, col, 0.22, 0.12); this.glow(t.chest, 0xffffff, 2.4, 0.25); h.add.burst(t.chest, col, 30, { dir: c.fwd.clone().multiplyScalar(6), speed: 1, life: 0.4, size: 0.2 }); h.hitstop(0.06); }));
        break;
      case 'leap':
        aura(T * 0.5, 2);
        c.targets.forEach((t) => at(1, () => { this.crack(t.base, col, 3.6); this.shockwave(t.base, col, 5, 0.55); this.shockwave(t.base, 0xffffff, 3, 0.35); this.debris(t.base, 30); h.shake(0.6, 0.45); h.hitstop(0.08); h.flash(t.base, col, 30); }));
        break;
      case 'shoot':
        c.targets.forEach((t) => { const fl = Math.min(0.26, T * 0.55); h.later(Math.max(0, T - fl), () => { const f = c.from.clone().add(c.fwd.clone().multiplyScalar(0.4)); this.glow(f, col, 0.8, 0.15); this.projectile(f, t.chest, col, fl, 0.55, 0.2, 1); }); });
        break;
      case 'arrows':
        this.circle(c.fromBase, col, T, 1.6);
        at(0.25, () => { const up = c.from.clone(); for (let i = 0; i < 10; i++) this.projectile(up, up.clone().add(new THREE.Vector3(rnd(-1, 1), 8, rnd(-1, 1))), 0xffe28a, 0.25, 0.3, 0, 0.5); });
        c.targets.forEach((t) => { for (let i = 0; i < 6; i++) h.later(Math.max(0, T - 0.28 + i * 0.03), () => { const end = t.base.clone().add(new THREE.Vector3(rnd(-0.6, 0.6), 0.6, rnd(-0.6, 0.6))); this.projectile(end.clone().add(new THREE.Vector3(rnd(-1, 1), 9, 1.5)), end, 0xffe28a, 0.26, 0.35, 0, 1); }); });
        at(1, () => h.shake(0.25, 0.3));
        break;
      case 'cannon':
        at(0.5, () => { const f = c.from.clone().add(c.fwd.clone().multiplyScalar(0.8)); this.glow(f, 0xffc070, 3, 0.25); h.add.burst(f, 0xffa040, 30, { dir: c.fwd.clone().multiplyScalar(5), speed: 1, life: 0.4 }); for (let i = 0; i < 8; i++) h.norm.spawn(f.x, f.y, f.z, c.fwd.x * 2 + rnd(-0.5, 0.5), rnd(0.2, 1), c.fwd.z * 2, 1.2, 0.8, 0x777066, 0, 0.9, 2); h.shake(0.3, 0.2); });
        c.targets.forEach((t) => { h.later(T * 0.5, () => this.projectile(c.from, t.chest, 0xff8030, T * 0.5, 0.8, 1.6)); at(1, () => this.explode(t.chest, 0xff7a2a, 1.2)); });
        break;
      case 'fireball': {
        this.circle(c.fromBase, col, T * 1.1, 1.9);
        const orbPos = c.from.clone().add(c.fwd.clone().multiplyScalar(0.5)); orbPos.y += 0.6;
        const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: h.glowTex, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        orb.position.copy(orbPos);
        this.temp(orb, T * 0.62, (k) => { const s = 0.3 + k * 1.3; orb.scale.set(s, s, 1); if (Math.random() < 0.8) { const a = Math.random() * Math.PI * 2; h.add.spawn(orbPos.x + Math.cos(a) * 1.2, orbPos.y + rnd(-0.8, 0.8), orbPos.z + Math.sin(a) * 1.2, -Math.cos(a) * 3, 0, -Math.sin(a) * 3, 0.35, 0.2, col); } });
        c.targets.forEach((t, i) => { h.later(T * 0.62, () => this.projectile(orbPos, t.chest, col, T * 0.38 + i * 0.01, 1.5, 0.6, 3)); at(1, () => this.explode(t.chest, col, 1.2)); });
        break;
      }
      case 'meteor':
        this.circle(c.fromBase, col, T, 2);
        at(0.1, () => h.flash(c.from, col, 12));
        c.targets.forEach((t, i) => { const fl = T * 0.45; h.later(T - fl + i * 0.02, () => this.projectile(t.chest.clone().add(new THREE.Vector3(3, 12, -4)), t.base.clone().setY(0.3), 0xff6020, fl, 1.8, 0, 4)); h.later(T + i * 0.02, () => { this.explode(t.chest, 0xff6020, 1.5); this.crack(t.base, 0xff6020, 3); this.debris(t.base, 16); }); });
        at(1, () => { h.shake(0.6, 0.5); h.hitstop(0.07); });
        break;
      case 'blizzard':
        this.circle(c.fromBase, col, T * 1.1, 2);
        this.circle(centre, col, T * 1.4, 4.5);
        for (let i = 0; i < 18; i++) h.later(T * 0.25 + i * T * 0.04, () => { for (let j = 0; j < 8; j++) { const a = Math.random() * Math.PI * 2, r = rnd(0, 2.6); h.add.spawn(centre.x + Math.cos(a) * r, rnd(2, 4), centre.z + Math.sin(a) * r, -Math.sin(a) * 3, -2, Math.cos(a) * 3, 0.8, 0.18, 0xe8faff); } });
        c.targets.forEach((t) => at(1, () => { this.iceSpikes(t.base, 1.1); this.glow(t.chest, 0x9adfff, 2.5, 0.4); }));
        at(1, () => { this.shockwave(centre, 0x9adfff, 5, 0.7); h.shake(0.3, 0.3); });
        break;
      case 'icelance':
        this.circle(c.fromBase, col, T, 1.7);
        c.targets.forEach((t) => {
          const fl = T * 0.4;
          h.later(T - fl, () => {
            const g = new THREE.ConeGeometry(0.14, 1.4, 6); g.rotateX(Math.PI / 2);
            const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xcff2ff, emissive: 0x4ab8ff, emissiveIntensity: 2, flatShading: true }));
            const from = c.from.clone().add(new THREE.Vector3(0, 0.8, 0)); m.position.copy(from); m.lookAt(t.chest);
            this.temp(m, fl, (k) => { m.position.lerpVectors(from, t.chest, k * k); h.add.spawn(m.position.x, m.position.y, m.position.z, 0, 0, 0, 0.3, 0.3, 0x9adfff); });
          });
          at(1, () => { this.iceSpikes(t.base, 0.8); h.add.burst(t.chest, 0xffffff, 20, { speed: 6, life: 0.4, size: 0.15 }); });
        });
        break;
      case 'lightning':
        this.circle(c.fromBase, col, T * 1.1, 1.9);
        at(0.2, () => c.targets.forEach((t) => { const cloud = t.base.clone().setY(6); this.glow(cloud, 0x6a5aff, 4, T * 0.9); }));
        c.targets.forEach((t) => { at(1, () => { this.bolt(t.base.clone().setY(0.1)); this.crack(t.base, 0xfff27a, 2.2); }); h.later(T + 0.09, () => this.bolt(t.chest)); });
        at(1, () => { h.shake(0.45, 0.35); h.hitstop(0.07); });
        break;
      case 'chain': {
        this.circle(c.fromBase, col, T, 1.7);
        let prev = c.from.clone().add(new THREE.Vector3(0, 0.4, 0));
        c.targets.forEach((t, i) => { const p0 = prev.clone(); h.later(T + i * 0.06, () => this.bolt(t.chest, p0, 0xa0e0ff)); prev = t.chest.clone(); });
        at(1, () => h.shake(0.3, 0.3));
        break;
      }
      case 'dragon': {
        this.circle(c.fromBase, col, T * 1.3, 2.3);
        const dir = centre.clone().setY(1).sub(c.from).normalize();
        const start = T * 0.45, end = T + 0.2;
        for (let tt = start; tt < end; tt += 0.025) h.later(tt, () => { const o = c.from.clone().add(dir.clone().multiplyScalar(0.5)); for (let j = 0; j < 7; j++) { const v = dir.clone().multiplyScalar(rnd(8, 12)).add(new THREE.Vector3(rnd(-1.8, 1.8), rnd(-0.8, 1.2), rnd(-1.8, 1.8))); h.add.spawn(o.x, o.y, o.z, v.x, v.y, v.z, 0.55, rnd(0.35, 0.7), Math.random() < 0.5 ? 0xff7a2a : 0xffd04a, 0, 0.9, 1.5); } });
        c.targets.forEach((t) => at(1, () => this.explode(t.chest, col, 1)));
        at(1, () => h.shake(0.4, 0.5));
        break;
      }
      case 'tornado': {
        this.circle(c.fromBase, col, T, 1.8);
        const pos = c.targets.length === 1 ? c.targets[0].base.clone() : centre.clone();
        at(0.4, () => {
          const g = new THREE.CylinderGeometry(1.4, 0.25, 4, 20, 4, true); g.translate(0, 2, 0);
          const m = new THREE.Mesh(g, this.basic(col, this.streakTex, { opacity: 0.5 }));
          m.position.copy(pos).setY(0);
          this.temp(m, T * 0.6 + 0.5, (k, dt) => { m.rotation.y += dt * 14; const w = Math.sin(Math.min(1, k * 1.2) * Math.PI); m.scale.set(w * (c.targets.length > 1 ? 1.6 : 1), 0.5 + w * 0.6, w * (c.targets.length > 1 ? 1.6 : 1)); for (let i = 0; i < 4; i++) { const a = Math.random() * Math.PI * 2, y = Math.random() * 3.5, r = 0.3 + y * 0.3; h.add.spawn(pos.x + Math.cos(a) * r, y, pos.z + Math.sin(a) * r, -Math.sin(a) * 5, 1, Math.cos(a) * 5, 0.35, 0.2, col); } });
        });
        at(1, () => h.shake(0.3, 0.4));
        break;
      }
      case 'dark':
        this.circle(c.fromBase, 0x9a5aff, T * 1.1, 2);
        c.targets.forEach((t) => {
          at(0.25, () => {
            const sph = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0x14001f, transparent: true, depthWrite: false }));
            sph.position.copy(t.chest);
            this.temp(sph, T * 0.75, (k) => { const s = k < 0.7 ? 0.2 + k * 1.4 : (1 - k) * 3.5; sph.scale.setScalar(Math.max(0.01, s)); (sph.material as THREE.MeshBasicMaterial).opacity = 0.85; for (let i = 0; i < 3; i++) { const d = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(2); h.add.spawn(t.chest.x + d.x, t.chest.y + d.y, t.chest.z + d.z, -d.x * 3, -d.y * 3, -d.z * 3, 0.3, 0.2, 0xa06bff); } });
            this.glow(t.chest, 0x7a3aff, 3.5, T * 0.8);
          });
          at(1, () => { h.add.burst(t.chest, 0xb07aff, 40, { speed: 8, life: 0.5, size: 0.3 }); this.shockwave(t.base, 0x7a3aff, 3.5, 0.5); });
        });
        at(1, () => h.shake(0.35, 0.3));
        break;
      case 'drain':
        c.targets.forEach((t) => h.later(T + 0.05, () => { for (let i = 0; i < 5; i++) h.later(i * 0.04, () => this.projectile(t.chest, c.from, 0xff3355, 0.35, 0.4, rnd(0.3, 1.2), 1)); }));
        break;
      case 'holy':
        this.circle(c.fromBase, col, T * 1.1, 1.9);
        c.targets.forEach((t) => { at(0.3, () => this.circle(t.base, 0xfff3c0, T * 0.9, 2.2)); at(0.85, () => this.pillar(t.base, 0xfff3c0, 0.7, 0.8)); at(1, () => { this.glow(t.chest, 0xffffff, 3.5, 0.4); h.add.burst(t.chest, 0xfff3c0, 30, { speed: 5, life: 0.6, up: true }); }); });
        at(1, () => { h.shake(0.3, 0.3); h.flash(centre, 0xfff3c0, 30); });
        break;
      case 'poison':
        c.targets.forEach((t) => at(1, () => { for (let i = 0; i < 16; i++) h.norm.spawn(t.chest.x + rnd(-0.5, 0.5), t.chest.y + rnd(-0.4, 0.4), t.chest.z + rnd(-0.5, 0.5), rnd(-0.6, 0.6), rnd(0.2, 0.8), rnd(-0.6, 0.6), 1.2, 0.8, 0x4a8a20, 0, 0.9, 1.5); h.add.burst(t.chest, 0x8be04a, 24, { speed: 3, life: 0.8, size: 0.25 }); }));
        break;
      case 'heal':
        this.circle(c.fromBase, 0x86efac, T, 1.6);
        c.targets.forEach((t) => { this.circle(t.base, 0x86efac, T + 0.6, 1.8); at(1, () => { this.pillar(t.base, 0x86efac, 0.7, 0.55, 5); h.add.burst(t.base.clone().setY(0.2), 0xbbf7d0, 30, { speed: 2.5, up: true, life: 1.1, gravity: -1.5, spread: 1.2 }); }); });
        break;
      case 'healall':
        this.circle(c.fromBase, 0x86efac, T * 1.2, 2);
        at(0.2, () => this.circle(centre, 0x86efac, T + 0.8, 5.5));
        for (let i = 0; i < 12; i++) h.later(T * 0.3 + i * 0.05, () => { for (let j = 0; j < 4; j++) { const a = Math.random() * Math.PI * 2, r = rnd(0, 3); h.add.spawn(centre.x + Math.cos(a) * r, 4, centre.z + Math.sin(a) * r, 0, -1.5, 0, 1.2, 0.22, 0xfff3c0, 0, 0.99); } });
        c.targets.forEach((t) => at(1, () => { this.pillar(t.base, 0x86efac, 0.8, 0.5, 5); h.add.burst(t.base.clone().setY(0.2), 0xbbf7d0, 20, { speed: 2.4, up: true, life: 1, gravity: -1.5, spread: 1 }); }));
        break;
      case 'revive':
        this.circle(c.fromBase, 0xfff3c0, T * 1.2, 2);
        c.targets.forEach((t) => {
          this.circle(t.base, 0xfff3c0, T + 1, 2.6);
          for (let i = 0; i < 20; i++) h.later(i * T * 0.04, () => h.add.spawn(t.base.x + rnd(-1.2, 1.2), 5, t.base.z + rnd(-1.2, 1.2), rnd(-0.3, 0.3), -2, rnd(-0.3, 0.3), 2, 0.3, 0xffffff, 0, 0.99));
          at(0.9, () => { this.pillar(t.base, 0xfff3c0, 1.1, 1, 12); h.flash(t.chest, 0xfff3c0, 40); });
          at(1, () => { this.shockwave(t.base, 0xfff3c0, 4, 0.8); this.glow(t.chest, 0xffffff, 5, 0.6); });
        });
        break;
      case 'buff':
        this.circle(c.fromBase, col, T + 0.4, 1.8);
        aura(T + 0.2, 3);
        at(1, () => { this.shockwave(c.fromBase, col, 2.6, 0.5); this.pillar(c.fromBase, col, 0.5, 0.6, 4); this.glow(c.from, col, 3, 0.4); });
        break;
      case 'buffall':
        this.circle(c.fromBase, col, T, 1.8);
        at(0.3, () => this.circle(centre, col, T + 0.6, 5.5));
        aura(T, 2);
        c.targets.forEach((t) => at(1, () => { this.pillar(t.base, col, 0.6, 0.55, 5); h.add.burst(t.base.clone().setY(0.1), col, 18, { speed: 3, up: true, life: 0.8, spread: 1 }); }));
        at(1, () => this.shockwave(centre, col, 5, 0.7));
        break;
      case 'debuff':
        this.circle(c.fromBase, 0x9a5aff, T, 1.7);
        c.targets.forEach((t) => { at(0.3, () => this.circle(t.base, 0x9a5aff, T, 1.6)); at(1, () => { for (let i = 0; i < 16; i++) h.norm.spawn(t.chest.x + rnd(-0.6, 0.6), t.chest.y + 1.2, t.chest.z + rnd(-0.6, 0.6), 0, -1.5, 0, 0.9, 0.4, 0x2a0a3a, 0, 0.95, 1); h.add.burst(t.chest, 0xa06bff, 20, { speed: 2, life: 0.7 }); }); });
        break;
      case 'coin':
        c.targets.forEach((t) => { for (let i = 0; i < 7; i++) h.later(Math.max(0, T - 0.3 + i * 0.02), () => this.projectile(c.from, t.chest.clone().add(new THREE.Vector3(rnd(-0.3, 0.3), rnd(-0.3, 0.3), rnd(-0.3, 0.3))), 0xffd35a, 0.3, 0.35, rnd(0.8, 1.8), 1)); at(1, () => h.add.burst(t.chest, 0xffd35a, 40, { speed: 6, gravity: 9, life: 0.9, size: 0.22 })); });
        break;
      case 'chains':
        this.circle(c.fromBase, 0x9aa3b8, T, 1.6);
        c.targets.forEach((t) => at(0.6, () => {
          const n = 14; const grp = new THREE.Group(); const from = c.from.clone();
          for (let i = 0; i < n; i++) { const l = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 5, 10), new THREE.MeshStandardMaterial({ color: 0xaab2c0, metalness: 0.9, roughness: 0.3, emissive: 0x334455 })); l.rotation.y = i % 2 ? Math.PI / 2 : 0; grp.add(l); }
          this.temp(grp, T * 0.4 + 0.45, (k) => { const reach = Math.min(1, k * 2.2); grp.children.forEach((l, i) => { l.position.lerpVectors(from, t.chest, (i / n) * reach); l.lookAt(t.chest); l.rotateZ(i % 2 ? Math.PI / 2 : 0); }); });
        }));
        break;
      case 'mana': {
        this.circle(c.fromBase, 0x5ee0ff, T * 1.2, 2.3);
        const cp = c.from.clone().add(c.fwd.clone().multiplyScalar(0.6)); cp.y += 0.3;
        for (let i = 0; i < 20; i++) h.later(i * T * 0.035, () => { for (let j = 0; j < 4; j++) { const d = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(1.8); h.add.spawn(cp.x + d.x, cp.y + d.y, cp.z + d.z, -d.x * 4, -d.y * 4, -d.z * 4, 0.3, 0.2, 0x5ee0ff); } });
        at(0.2, () => this.glow(cp, 0x5ee0ff, 2, T * 0.8));
        c.targets.forEach((t) => { at(0.85, () => this.beam(cp, t.chest, 0x5ee0ff, 0.45, 0.35)); at(1, () => this.explode(t.chest, 0x5ee0ff, 1.3)); });
        at(1, () => { h.shake(0.5, 0.4); h.hitstop(0.08); });
        break;
      }
      case 'item':
        h.add.burst(c.from, 0xfff3c0, 16, { speed: 2, up: true, life: 0.6 });
        break;
      default: break;
    }
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
