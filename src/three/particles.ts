import * as THREE from 'three';

const VS = /* glsl */ `
attribute float psize;
attribute float palpha;
attribute vec3 pcolor;
varying float vA;
varying vec3 vC;
uniform float uScale;
void main() {
  vA = palpha; vC = pcolor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = psize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FS = /* glsl */ `
varying float vA;
varying vec3 vC;
uniform float uSoft;
uniform float uOpacity;
uniform float uBoost;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float a = mix(smoothstep(0.5, 0.35, r), pow(1.0 - r * 2.0, 1.6), uSoft);
  gl_FragColor = vec4(vC * uBoost, a * vA * uOpacity);
}`;

export interface SpawnOpts {
  speed?: number; up?: boolean; gravity?: number; life?: number; size?: number; spread?: number; drag?: number; grow?: number; dir?: THREE.Vector3;
}

export class ParticleSystem {
  max: number;
  count = 0;
  points: THREE.Points;
  private pos: Float32Array; private vel: Float32Array; private col: Float32Array;
  private size: Float32Array; private size0: Float32Array; private alpha: Float32Array;
  private life: Float32Array; private life0: Float32Array; private grav: Float32Array; private drag: Float32Array; private grow: Float32Array;
  private geo: THREE.BufferGeometry;
  mat: THREE.ShaderMaterial;
  private tmp = new THREE.Color();

  constructor(max = 1500, blending: THREE.Blending = THREE.AdditiveBlending, soft = 1) {
    this.max = max;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.size0 = new Float32Array(max); this.alpha = new Float32Array(max);
    this.life = new Float32Array(max); this.life0 = new Float32Array(max); this.grav = new Float32Array(max);
    this.drag = new Float32Array(max); this.grow = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('psize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('palpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending,
      uniforms: { uScale: { value: 500 }, uSoft: { value: soft }, uOpacity: { value: 1 }, uBoost: { value: 1 } },
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  setScale(heightPx: number, fovDeg: number) {
    this.mat.uniforms.uScale.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: THREE.ColorRepresentation, gravity = 0, drag = 0.9, grow = 0) {
    if (this.count >= this.max) return;
    const i = this.count++;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.tmp.set(color);
    this.col[i3] = this.tmp.r; this.col[i3 + 1] = this.tmp.g; this.col[i3 + 2] = this.tmp.b;
    this.life[i] = life; this.life0[i] = life; this.size0[i] = size; this.size[i] = size;
    this.grav[i] = gravity; this.drag[i] = drag; this.grow[i] = grow; this.alpha[i] = 1;
  }

  burst(p: THREE.Vector3, color: THREE.ColorRepresentation, n: number, o: SpawnOpts = {}) {
    const sp = o.speed ?? 3;
    const spread = o.spread ?? 0.2;
    for (let k = 0; k < n; k++) {
      let vx: number, vy: number, vz: number;
      if (o.dir) {
        vx = o.dir.x + (Math.random() - 0.5) * 0.6; vy = o.dir.y + (Math.random() - 0.5) * 0.6; vz = o.dir.z + (Math.random() - 0.5) * 0.6;
      } else if (o.up) {
        const a = Math.random() * Math.PI * 2; const r = Math.random() * 0.45;
        vx = Math.cos(a) * r; vz = Math.sin(a) * r; vy = 0.6 + Math.random() * 0.6;
      } else {
        const u = Math.random() * 2 - 1; const a = Math.random() * Math.PI * 2; const s = Math.sqrt(1 - u * u);
        vx = s * Math.cos(a); vy = u; vz = s * Math.sin(a);
      }
      const v = sp * (0.35 + Math.random() * 0.8);
      const life = (o.life ?? 0.8) * (0.6 + Math.random() * 0.7);
      this.spawn(
        p.x + (Math.random() - 0.5) * spread, p.y + (Math.random() - 0.5) * spread, p.z + (Math.random() - 0.5) * spread,
        vx * v, vy * v, vz * v, life, (o.size ?? 0.25) * (0.6 + Math.random() * 0.8), color, o.gravity ?? 0, o.drag ?? 0.9, o.grow ?? 0,
      );
    }
  }

  update(dt: number) {
    const n = this.count;
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.kill(i); continue; }
      const i3 = i * 3;
      const d = Math.pow(this.drag[i], dt * 10);
      this.vel[i3] *= d; this.vel[i3 + 1] = this.vel[i3 + 1] * d - this.grav[i] * dt; this.vel[i3 + 2] *= d;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const k = this.life[i] / this.life0[i];
      this.alpha[i] = Math.min(1, k * 1.6) * Math.min(1, (1 - k) * 12 + 0.2);
      this.size[i] = this.size0[i] * (1 + this.grow[i] * (1 - k));
      i++;
    }
    if (n || this.count) {
      this.geo.setDrawRange(0, this.count);
      (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.attributes.pcolor as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.attributes.psize as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.attributes.palpha as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  private kill(i: number) {
    const j = --this.count;
    if (i === j) return;
    const i3 = i * 3, j3 = j * 3;
    for (let c = 0; c < 3; c++) { this.pos[i3 + c] = this.pos[j3 + c]; this.vel[i3 + c] = this.vel[j3 + c]; this.col[i3 + c] = this.col[j3 + c]; }
    this.size[i] = this.size[j]; this.size0[i] = this.size0[j]; this.alpha[i] = this.alpha[j]; this.life[i] = this.life[j];
    this.life0[i] = this.life0[j]; this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j]; this.grow[i] = this.grow[j];
  }

  dispose() { this.geo.dispose(); this.mat.dispose(); }
}
