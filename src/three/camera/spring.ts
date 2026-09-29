import * as THREE from 'three';

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const easeLinear = (x: number) => x;
export const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeInCubic = (x: number) => x * x * x;
export const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

/** frame-rate independent exponential smoothing. rate ~ how fast. */
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * Math.max(0, dt));

/** Critically-damped-ish spring on a 3D vector. Gives the camera real inertia. */
export class Spring3 {
  value = new THREE.Vector3();
  vel = new THREE.Vector3();
  target = new THREE.Vector3();
  /** pull toward target */
  stiffness = 90;
  /** resistance to velocity */
  damping = 16;
  private acc = new THREE.Vector3();

  step(dt: number, stiffness = this.stiffness, damping = this.damping) {
    const h = Math.min(Math.max(dt, 1 / 240), 1 / 30);
    this.acc.copy(this.target).sub(this.value).multiplyScalar(stiffness);
    this.acc.addScaledVector(this.vel, -damping);
    this.vel.addScaledVector(this.acc, h);
    this.value.addScaledVector(this.vel, h);
  }

  snap(v: THREE.Vector3) {
    this.value.copy(v);
    this.target.copy(v);
    this.vel.set(0, 0, 0);
  }

  get settled() { return this.vel.lengthSq() < 1e-6; }
}

/** single-axis spring for scalars (fov, aperture, ...) */
export class Spring1 {
  value = 0;
  vel = 0;
  target = 0;
  step(dt: number, stiffness = 90, damping = 16) {
  const h = Math.min(Math.max(dt, 1 / 240), 1 / 30);
 const a = (this.target - this.value) * stiffness - this.vel * damping;
    this.vel += a * h;
    this.value += this.vel * h;
  }
  snap(v: number) { this.value = v; this.target = v; this.vel = 0; }
}
