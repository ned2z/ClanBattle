import type * as THREE from 'three';

/**
 * The whole game uses a single camera framing. This is that framing.
 * `offset` is relative to the arena centre, `lookOffset` is the aim point.
 */
export interface ShotDef {
  offset: THREE.Vector3;
  lookOffset: THREE.Vector3;
  fov: number;
  /** higher = heavier, calmer motion */
  damping: number;
  /** gentle idle float, in world units */
  drift: number;
}
