import type * as THREE from 'three';
import type { VfxHost } from '../../three/vfx';

/** the 32 effect families the game knows about */
export type Tech =
  | 'strike' | 'multi' | 'bigslash' | 'whirl' | 'thrust' | 'leap' | 'shoot' | 'arrows' | 'cannon' | 'fireball' | 'meteor'
  | 'blizzard' | 'icelance' | 'lightning' | 'chain' | 'dragon' | 'tornado' | 'dark' | 'drain' | 'holy' | 'poison' | 'heal'
  | 'healall' | 'revive' | 'buff' | 'buffall' | 'debuff' | 'coin' | 'chains' | 'mana' | 'item' | 'none';

export interface Target { chest: THREE.Vector3; base: THREE.Vector3 }

/** everything a primitive needs to know about the action it is part of */
export interface TechCtx {
  from: THREE.Vector3;
  fromBase: THREE.Vector3;
  fwd: THREE.Vector3;
  targets: Target[];
  color: number;
  impact: number;
  big: boolean;
}

/** arguments for a step. values are plain numbers/strings so recipes stay data-only */
/** a value that may be a literal or a tiny expression like "$T*0.5" */
export type Val = number | string;

export interface Args {
  color?: number;
  dur?: Val; size?: Val; count?: Val; n?: Val; r?: Val; hgt?: Val;
  rot?: Val; flight?: Val; arc?: Val; trail?: Val; scale?: Val;
  spread?: Val; gap?: Val; up?: Val; speed?: Val; life?: Val;
  y?: Val; y0?: Val; g?: Val; power?: Val; per?: Val; radius?: Val; vy?: Val;
  steps?: Step[]; offset?: Val; prim?: string; args?: Args;
  [k: string]: Val | boolean | Step[] | Args | undefined;
}

/**
 * One line of the choreography.
 * `at` is a fraction of the impact time (1 = on impact). It also accepts a
 * string for absolute tweaks: "1+0.07" = T + 0.07s, "+0.14" = +0.14s.
 */
export interface Step { at?: number | string; prim: string; args?: Args }

/** how hard the hit should feel - applied by the host, not drawn */
export interface Feel { hitstop?: number; flash?: number; slowmo?: [number, number]; shake?: number; shakeDur?: number }

export interface Recipe {
  /** seconds (at 1x) until the hit lands - mirrors the old IMPACT table */
  impact: number;
  steps: Step[];
  feel?: Feel;
}

export interface Feature {
  id: string;
  name: string;
  /** recipe this feature builds on */
  base: string;
  /** extra steps layered on top of the base recipe */
  add?: Step[];
  feel?: Feel;
  callout?: { text: string; sub?: string; dur?: number };
}

/** the drawing surface `Vfx` exposes to primitives */
export interface VfxDraw {
  basic(color: number, map?: THREE.Texture, opts?: Partial<THREE.MeshBasicMaterialParameters>): THREE.MeshBasicMaterial;
  temp(obj: THREE.Object3D, dur: number, update: (k: number, dt: number) => void): void;
  circle(pos: THREE.Vector3, color: number, dur: number, size?: number): void;
  glow(pos: THREE.Vector3, color: number, size: number, dur: number): void;
  shockwave(pos: THREE.Vector3, color: number, size?: number, dur?: number, y?: number): void;
  crack(pos: THREE.Vector3, color: number, size?: number): void;
  debris(pos: THREE.Vector3, n?: number, color?: number): void;
  slash(pos: THREE.Vector3, color: number, size?: number, rot?: number, dur?: number): void;
  pillar(pos: THREE.Vector3, color: number, dur?: number, r?: number, hgt?: number): void;
  beam(a: THREE.Vector3, b: THREE.Vector3, color: number, dur: number, width: number): void;
  projectile(from: THREE.Vector3, to: THREE.Vector3, color: number, flight: number, size?: number, arc?: number, trail?: number): void;
  bolt(to: THREE.Vector3, from?: THREE.Vector3, color?: number): void;
  iceSpikes(pos: THREE.Vector3, scale?: number): void;
  explode(p: THREE.Vector3, color: number, scale?: number): void;
}

/** handed to every primitive */
export interface PrimApi {
  v: VfxDraw;
  h: VfxHost;
  c: TechCtx;
  centre: THREE.Vector3;
  T: number;
  col: number;
  rnd: (a: number, b: number) => number;
  args: Args;
  targets: Target[];
  target?: Target;
  index: number;
  /** schedule a nested chunk of steps, relative to this step's own `at` */
  run(steps: Step[]): void;
  /** fire a single nested step, bound to one specific target */
  runOne(step: Step, target: Target, index: number): void;
}

export type Prim = (p: PrimApi) => void;
