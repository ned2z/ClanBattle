import * as THREE from 'three';
import { SHOT } from './shots';
import { Spring1, Spring3, damp } from './spring';

const UP = new THREE.Vector3(0, 1, 0);
const YAW_LIMIT = 0.5;     // rad the player may swing left/right
const PITCH_LIMIT = 0.24;  // rad up/down
const DOLLY_MIN = 0.72;
const DOLLY_MAX = 1.32;
const RECENTER_AFTER = 1.2; // s of no input before the rig eases back to centre
const RECENTER_RATE = 1.1;
const PORTRAIT_YAW = Math.PI / 2; // the arena runs front-to-back on a phone
const PORTRAIT_PULL = 1.14;

/**
 * The battle camera.
 *
 * Deliberately simple: one fixed framing that hovers over the arena, plus the
 * player's own drag. No cuts, no scripted moves, no depth-of-field, no bars -
 * the camera is a steady window onto the fight, nothing more.
 */
export class CameraDirector {
  private posS = new Spring3();
  private lookS = new Spring3();
  private fovS = new Spring1();

  /** centre of the arena, kept in sync with the living units */
  private centre = new THREE.Vector3();
  private off = new THREE.Vector3();
  private out = new THREE.Vector3();
  private t = 0;

  // player control
  userYaw = 0;
  userPitch = 0;
  userDolly = 1;
  private sinceInput = RECENTER_AFTER + 1;

  // ULT drama (kept: slow-mo + white flash). No shake, no punch, no fov kick.
  slowT = 0;
  slowScale = 1;
  flash = 0;
  bloomBoost = 0;
  private bloomT = 0;

  portrait = false;
  aspect = 1.6;

  // ------------------------------------------------------------ arena

  /** call whenever units change so the camera follows the centre of the fight */
  setCentre(v: THREE.Vector3) { this.centre.copy(v); }

  // ------------------------------------------------------------ player

  addUserInput(dYaw: number, dPitch: number, dDolly = 0) {
    this.userYaw = THREE.MathUtils.clamp(this.userYaw + dYaw, -YAW_LIMIT, YAW_LIMIT);
    this.userPitch = THREE.MathUtils.clamp(this.userPitch + dPitch, -PITCH_LIMIT, PITCH_LIMIT);
    if (dDolly) this.userDolly = THREE.MathUtils.clamp(this.userDolly * dDolly, DOLLY_MIN, DOLLY_MAX);
    this.sinceInput = 0;
  }

  resetUserInput() {
    this.userYaw = 0; this.userPitch = 0; this.userDolly = 1;
    this.sinceInput = RECENTER_AFTER + 1;
  }

  /** the camera is always available to the player now */
  get acceptsUserInput() { return true; }

  // ------------------------------------------------------------ drama

  slowmo(sec: number, scale = 0.3) { this.slowT = Math.max(this.slowT, sec); this.slowScale = scale; }
  flashTo(a: number) { this.flash = Math.max(this.flash, a); }
  bloomTo(a: number) { this.bloomT = Math.max(this.bloomT, a); }

  // ------------------------------------------------------------ tick

  step(dt: number) {
    this.t += dt;
    if (this.slowT > 0) this.slowT = Math.max(0, this.slowT - dt);
    this.flash = Math.max(0, this.flash - dt * 2.6);
    this.bloomT = Math.max(0, this.bloomT - dt * 1.8);
  }

  update(dt: number) {
    this.sinceInput += dt;
    if (this.sinceInput > RECENTER_AFTER) {
      const k = damp(RECENTER_RATE, dt);
      this.userYaw += -this.userYaw * k;
      this.userPitch += -this.userPitch * k;
      this.userDolly += (1 - this.userDolly) * k;
    }

    // the hover
    this.off.copy(SHOT.offset).applyAxisAngle(UP, this.userYaw + (this.portrait ? PORTRAIT_YAW : 0));
    this.off.multiplyScalar(this.userDolly * (this.portrait ? PORTRAIT_PULL : 1));
    this.out.copy(this.centre).add(this.off);
    this.out.y += this.userPitch * 3.2 + Math.sin(this.t * 0.23 + 1.7) * SHOT.drift * 0.4;
    this.out.x += Math.sin(this.t * 0.31) * SHOT.drift;

    this.posS.target.copy(this.out);
    this.lookS.target.copy(this.centre).add(SHOT.lookOffset);
    this.lookS.target.y += this.userPitch * 1.1;
    this.fovS.target = SHOT.fov;

    this.posS.step(dt, 90, SHOT.damping);
    this.lookS.step(dt, 90, SHOT.damping * 1.45);
    this.fovS.step(dt, 90, 16);
    this.bloomBoost += (this.bloomT - this.bloomBoost) * damp(6, dt);
  }

  apply(camera: THREE.PerspectiveCamera) {
    camera.position.copy(this.posS.value);
    camera.lookAt(this.lookS.value);
    if (Math.abs(camera.fov - this.fovS.value) > 0.01) {
      camera.fov = this.fovS.value;
      camera.updateProjectionMatrix();
    }
  }

  /** place the rig exactly, used on first frame and on resize */
  snap() {
    this.posS.snap(this.posS.target);
    this.lookS.snap(this.lookS.target);
    this.fovS.snap(SHOT.fov);
  }
}
