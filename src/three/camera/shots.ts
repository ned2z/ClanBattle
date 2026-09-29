import * as THREE from 'three';
import type { ShotDef } from './types';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * One framing for the whole battle. The camera never cuts: it sits here, floats
 * gently, and the player can swing it by dragging the screen.
 */
export const SHOT: ShotDef = {
  offset: v(-9.2, 5.8, 7.3),   // same framing the game used before any camera work
  lookOffset: v(0, 0, 0),
  fov: 40,
  damping: 11,                 // soft, no overshoot, no snap
  drift: 0.35,                 // the "ลอยค้าง" float
};
