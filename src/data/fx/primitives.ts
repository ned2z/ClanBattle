import * as THREE from 'three';
import type { Prim, PrimApi } from './types';

const P: Record<string, Prim> = {};

// ---------------------------------------------------------------- meta
/** run a nested list of steps once per target */
P.eachTarget = (p) => {
  const steps = (p.args.steps ?? []) as import('./types').Step[];
  const off = Number(p.args.offset ?? 0);
  p.targets.forEach((t, i) => {
    steps.forEach((s) => {
      const base = typeof s.at === 'number' ? p.T * s.at : p.T;
      const shift = off * i;
      p.h.later(Math.max(0, base + shift), () => p.runOne(s, t, i));
    });
  });
};

/** run a nested list of steps once, at the current spot */
P.group = (p) => p.run((p.args.steps ?? []) as import('./types').Step[]);

/** repeat a step N times, staggered */
P.repeat = (p) => {
  const n = Number(p.args.count ?? 3);
  const gap = Number(p.args.gap ?? 0.03);
  for (let i = 0; i < n; i++) p.h.later(i * gap, () => p.run([{ prim: String(p.args.prim), args: p.args.args }]));
};

// ---------------------------------------------------------------- simple draws
P.circle = (p) => p.v.circle(p.target?.base ?? p.c.fromBase, p.col, Number(p.args.dur ?? 0.6), Number(p.args.size ?? 1.6));
P.glow = (p) => p.v.glow(p.target?.chest ?? p.c.from, p.col, Number(p.args.size ?? 2.4), Number(p.args.dur ?? 0.3));
P.shockwave = (p) => p.v.shockwave(p.target?.base ?? p.centre, p.col, Number(p.args.size ?? 3), Number(p.args.dur ?? 0.5), p.args.y === undefined ? 0.08 : Number(p.args.y));
P.crack = (p) => p.v.crack(p.target?.base ?? p.centre, p.col, Number(p.args.size ?? 2.6));
P.debris = (p) => p.v.debris(p.target?.base ?? p.centre, Number(p.args.count ?? 24), Number(p.args.color ?? 0x6b5236));
P.iceSpikes = (p) => p.v.iceSpikes(p.target?.base ?? p.centre, Number(p.args.size ?? 1));
P.pillar = (p) => p.v.pillar(p.target?.base ?? p.centre, p.col, Number(p.args.dur ?? 0.8), Number(p.args.r ?? 0.7), Number(p.args.hgt ?? 9));
P.explode = (p) => p.v.explode(p.target?.chest ?? p.centre, p.col, Number(p.args.scale ?? 1));

P.slash = (p) => p.v.slash(p.target?.chest ?? p.centre, p.col, Number(p.args.size ?? 1.3), p.args.rot === undefined ? Math.random() * Math.PI * 2 : Number(p.args.rot), Number(p.args.dur ?? 0.3));

P.beam = (p) => {
  const t = p.target; if (!t) return;
  const back = t.chest.clone().sub(p.c.fwd.clone().multiplyScalar(2));
  const fwd = t.chest.clone().add(p.c.fwd.clone().multiplyScalar(2.2));
  p.v.beam(back, fwd, p.col, Number(p.args.dur ?? 0.22), Number(p.args.r ?? 0.12));
};

P.projectile = (p) => {
  const t = p.target; if (!t) return;
  p.v.projectile(p.c.from, t.chest, p.col, Number(p.args.flight ?? 0.3), Number(p.args.size ?? 0.9), Number(p.args.arc ?? 0.8), Number(p.args.trail ?? 1));
};

P.bolt = (p) => p.v.bolt(p.target?.chest ?? p.centre, undefined, p.col);

// ---------------------------------------------------------------- particles
P.aura = (p) => {
  const dur = Number(p.args.dur ?? p.T);
  const n = Number(p.args.count ?? 1);
  const steps = Math.ceil(dur / 0.03);
  for (let i = 0; i < steps; i++) p.h.later(i * 0.03, () => {
    for (let j = 0; j < n; j++) {
      const a = Math.random() * Math.PI * 2;
      p.h.add.spawn(p.c.fromBase.x + Math.cos(a) * 0.55, 0.1, p.c.fromBase.z + Math.sin(a) * 0.55, -Math.cos(a) * 0.3, p.rnd(2, 3.5), -Math.sin(a) * 0.3, 0.5, 0.22, p.col, 0, 0.95);
    }
  });
};

P.burst = (p) => {
  const pos = p.target?.chest ?? p.centre;
  p.h.add.burst(pos, p.col, Number(p.args.count ?? 24), {
    speed: Number(p.args.speed ?? 5), life: Number(p.args.life ?? 0.6), size: Number(p.args.size ?? 0.25),
    gravity: Number(p.args.size2 ?? p.args.g ?? 0) || undefined, up: p.args.up === 1, spread: Number(p.args.spread ?? 0) || undefined,
  });
};

P.motes = (p) => {
  // falling / rising motes used by heal, revive, holy
  const pos = p.target?.base ?? p.centre;
  const n = Number(p.args.count ?? 12);
  const y0 = Number(p.args.y0 ?? 4);
  const vy = Number(p.args.vy ?? -1.5);
  const col = Number(p.args.color ?? 0xfff3c0);
  for (let i = 0; i < n; i++) {
    p.h.later(i * Number(p.args.gap ?? 0.05), () => {
      for (let j = 0; j < Number(p.args.per ?? 4); j++) {
        const a = Math.random() * Math.PI * 2, r = p.rnd(0, Number(p.args.radius ?? 3));
        p.h.add.spawn(pos.x + Math.cos(a) * r, y0, pos.z + Math.sin(a) * r, 0, vy, 0, 1.2, 0.22, col, 0, 0.99);
      }
    });
  }
};

P.clouds = (p) => {
  // storm clouds gathering above each target before a bolt falls
  p.targets.forEach((t) => {
    const cloud = t.base.clone().setY(Number(p.args.y0 ?? 6));
    p.v.glow(cloud, Number(p.args.color ?? 0x6a5aff), Number(p.args.size ?? 4), Number(p.args.dur ?? 0.8));
  });
};

P.skyRain = (p) => {
  // rocks raining onto every target, one per target
  p.targets.forEach((t, i) => {
    const fl = p.T * Number(p.args.frac ?? 0.45);
    p.h.later(p.T - fl + i * 0.02, () => {
      p.v.projectile(t.chest.clone().add(new THREE.Vector3(3, 12, -4)), t.base.clone().setY(0.3), Number(p.args.color ?? 0xff6020), fl, 1.8, 0, 4);
    });
    p.h.later(p.T + i * 0.02, () => { p.v.explode(t.chest, Number(p.args.color ?? 0xff6020), 1.5); });
  });
};

P.rain = (p) => {
  // blizzard snow ring
  for (let i = 0; i < Number(p.args.count ?? 18); i++) {
    p.h.later(Number(p.args.t0 ?? 0.25) * p.T + i * p.T * 0.04, () => {
      for (let j = 0; j < Number(p.args.per ?? 8); j++) {
        const a = Math.random() * Math.PI * 2, r = p.rnd(0, Number(p.args.radius ?? 2.6));
        p.h.add.spawn(p.centre.x + Math.cos(a) * r, p.rnd(2, 4), p.centre.z + Math.sin(a) * r, -Math.sin(a) * 3, -2, Math.cos(a) * 3, 0.8, 0.18, Number(p.args.color ?? 0xe8faff));
      }
    });
  }
};

P.stream = (p) => {
  // continuous particle stream (dragon breath)
  const dir = p.centre.clone().setY(1).sub(p.c.from).normalize();
  const start = p.T * Number(p.args.from ?? 0.45), end = p.T + Number(p.args.to ?? 0.2);
  for (let tt = start; tt < end; tt += 0.025) {
    p.h.later(tt, () => {
      const o = p.c.from.clone().add(dir.clone().multiplyScalar(0.5));
      for (let j = 0; j < Number(p.args.per ?? 7); j++) {
        const v = dir.clone().multiplyScalar(p.rnd(8, 12)).add(new THREE.Vector3(p.rnd(-1.8, 1.8), p.rnd(-0.8, 1.2), p.rnd(-1.8, 1.8)));
        p.h.add.spawn(o.x, o.y, o.z, v.x, v.y, v.z, 0.55, p.rnd(0.35, 0.7), Math.random() < 0.5 ? 0xff7a2a : 0xffd04a, 0, 0.9, 1.5);
      }
    });
  }
};

P.drain = (p) => {
  p.targets.forEach((t) => p.h.later(p.T + 0.05, () => {
    for (let i = 0; i < 5; i++) p.h.later(i * 0.04, () => p.v.projectile(t.chest, p.c.from, Number(p.args.color ?? 0xff3355), 0.35, 0.4, p.rnd(0.3, 1.2), 1));
  }));
};

P.coins = (p) => {
  p.targets.forEach((t) => {
    for (let i = 0; i < 7; i++) {
      p.h.later(Math.max(0, p.T - 0.3 + i * 0.02), () => {
        p.v.projectile(p.c.from, t.chest.clone().add(new THREE.Vector3(p.rnd(-0.3, 0.3), p.rnd(-0.3, 0.3), p.rnd(-0.3, 0.3))), Number(p.args.color ?? 0xffd35a), 0.3, 0.35, p.rnd(0.8, 1.8), 1);
      });
    }
  });
};

P.arrowRain = (p) => {
  const up = p.c.from.clone();
  for (let i = 0; i < 10; i++) p.v.projectile(up, up.clone().add(new THREE.Vector3(p.rnd(-1, 1), 8, p.rnd(-1, 1))), Number(p.args.color ?? 0xffe28a), 0.25, 0.3, 0, 0.5);
  p.targets.forEach((t) => {
    for (let i = 0; i < 6; i++) {
      p.h.later(Math.max(0, p.T - 0.28 + i * 0.03), () => {
        const end = t.base.clone().add(new THREE.Vector3(p.rnd(-0.6, 0.6), 0.6, p.rnd(-0.6, 0.6)));
        p.v.projectile(end.clone().add(new THREE.Vector3(p.rnd(-1, 1), 9, 1.5)), end, Number(p.args.color ?? 0xffe28a), 0.26, 0.35, 0, 1);
      });
    }
  });
};

P.poison = (p) => {
  p.targets.forEach((t) => {
    for (let i = 0; i < 16; i++) p.h.norm.spawn(t.chest.x + p.rnd(-0.5, 0.5), t.chest.y + p.rnd(-0.4, 0.4), t.chest.z + p.rnd(-0.5, 0.5), p.rnd(-0.6, 0.6), p.rnd(0.2, 0.8), p.rnd(-0.6, 0.6), 1.2, 0.8, 0x4a8a20, 0, 0.9, 1.5);
    p.h.add.burst(t.chest, 0x8be04a, 24, { speed: 3, life: 0.8, size: 0.25 });
  });
};

P.debuffCloud = (p) => {
  p.targets.forEach((t) => {
    for (let i = 0; i < 16; i++) p.h.norm.spawn(t.chest.x + p.rnd(-0.6, 0.6), t.chest.y + 1.2, t.chest.z + p.rnd(-0.6, 0.6), 0, -1.5, 0, 0.9, 0.4, 0x2a0a3a, 0, 0.95, 1);
    p.h.add.burst(t.chest, 0xa06bff, 20, { speed: 2, life: 0.7 });
  });
};

P.manaGather = (p) => {
  const cp = p.c.from.clone().add(p.c.fwd.clone().multiplyScalar(0.6)); cp.y += 0.3;
  for (let i = 0; i < 20; i++) {
    p.h.later(i * p.T * 0.035, () => {
      for (let j = 0; j < 4; j++) {
        const d = new THREE.Vector3(p.rnd(-1, 1), p.rnd(-1, 1), p.rnd(-1, 1)).normalize().multiplyScalar(1.8);
        p.h.add.spawn(cp.x + d.x, cp.y + d.y, cp.z + d.z, -d.x * 4, -d.y * 4, -d.z * 4, 0.3, 0.2, Number(p.args.color ?? 0x5ee0ff));
      }
    });
  }
  p.h.later(p.T * 0.2, () => p.v.glow(cp, Number(p.args.color ?? 0x5ee0ff), 2, p.T * 0.8));
  p.v.beam(cp, p.target?.chest ?? p.centre, Number(p.args.color ?? 0x5ee0ff), 0.45, 0.35);
};

P.orb = (p) => {
  // held charging orb (fireball)
  const col = Number(p.args.color ?? p.col);
  const orbPos = p.c.from.clone().add(p.c.fwd.clone().multiplyScalar(0.5));
  orbPos.y += 0.6;
  const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: p.h.glowTex, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  orb.position.copy(orbPos);
  p.v.temp(orb, p.T * Number(p.args.frac ?? 0.62), (k) => {
    const s = 0.3 + k * 1.3; orb.scale.set(s, s, 1);
    if (Math.random() < 0.8) { const a = Math.random() * Math.PI * 2; p.h.add.spawn(orbPos.x + Math.cos(a) * 1.2, orbPos.y + p.rnd(-0.8, 0.8), orbPos.z + Math.sin(a) * 1.2, -Math.cos(a) * 3, 0, -Math.sin(a) * 3, 0.35, 0.2, col); }
  });
  p.targets.forEach((t, i) => {
    p.h.later(p.T * Number(p.args.frac ?? 0.62), () => p.v.projectile(orbPos, t.chest, col, p.T * 0.38 + i * 0.01, 1.5, 0.6, 3));
  });
};

P.lance = (p) => {
  const t = p.target; if (!t) return;
  const fl = p.T * Number(p.args.frac ?? 0.4);
  const g = new THREE.ConeGeometry(0.14, 1.4, 6); g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xcff2ff, emissive: 0x4ab8ff, emissiveIntensity: 2, flatShading: true }));
  const from = p.c.from.clone().add(new THREE.Vector3(0, 0.8, 0));
  m.position.copy(from); m.lookAt(t.chest);
  p.v.temp(m, fl, (k) => { m.position.lerpVectors(from, t.chest, k * k); p.h.add.spawn(m.position.x, m.position.y, m.position.z, 0, 0, 0, 0.3, 0.3, 0x9adfff); });
};

P.orbitRing = (p) => {
  const col = p.col;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.06, 6, 40), p.v.basic(col));
  ring.rotation.x = -Math.PI / 2; ring.position.copy(p.centre).setY(0.9);
  p.v.temp(ring, p.T * 1.1, (k, dt) => {
    ring.rotation.z += dt * 18; const s = 0.6 + k * 0.8; ring.scale.set(s, s, s);
    (ring.material as THREE.MeshBasicMaterial).opacity = 1 - k * 0.8;
    for (let i = 0; i < 3; i++) { const a = Math.random() * Math.PI * 2; p.h.add.spawn(p.centre.x + Math.cos(a) * 1.6 * s, 0.9, p.centre.z + Math.sin(a) * 1.6 * s, -Math.sin(a) * 4, 0.5, Math.cos(a) * 4, 0.3, 0.2, col); }
  });
};

P.column = (p) => {
  const col = p.col;
  const pos = p.targets.length === 1 ? p.targets[0].base.clone() : p.centre.clone();
  const g = new THREE.CylinderGeometry(1.4, 0.25, 4, 20, 4, true); g.translate(0, 2, 0);
  const m = new THREE.Mesh(g, p.v.basic(col, (p.v as unknown as { streakTex: THREE.Texture }).streakTex, { opacity: 0.5 }));
  m.position.copy(pos).setY(0);
  const wide = p.targets.length > 1 ? 1.6 : 1;
  p.v.temp(m, p.T * 0.6 + 0.5, (k, dt) => {
    m.rotation.y += dt * 14;
    const w = Math.sin(Math.min(1, k * 1.2) * Math.PI);
    m.scale.set(w * wide, 0.5 + w * 0.6, w * wide);
    for (let i = 0; i < 4; i++) { const a = Math.random() * Math.PI * 2, y = Math.random() * 3.5, r = 0.3 + y * 0.3; p.h.add.spawn(pos.x + Math.cos(a) * r, y, pos.z + Math.sin(a) * r, -Math.sin(a) * 5, 1, Math.cos(a) * 5, 0.35, 0.2, col); }
  });
};

P.voidOrb = (p) => {
  const t = p.target; if (!t) return;
  const sph = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0x14001f, transparent: true, depthWrite: false }));
  sph.position.copy(t.chest);
  p.v.temp(sph, p.T * 0.75, (k) => {
    const s = k < 0.7 ? 0.2 + k * 1.4 : (1 - k) * 3.5;
    sph.scale.setScalar(Math.max(0.01, s));
    (sph.material as THREE.MeshBasicMaterial).opacity = 0.85;
    for (let i = 0; i < 3; i++) { const d = new THREE.Vector3(p.rnd(-1, 1), p.rnd(-1, 1), p.rnd(-1, 1)).normalize().multiplyScalar(2); p.h.add.spawn(t.chest.x + d.x, t.chest.y + d.y, t.chest.z + d.z, -d.x * 3, -d.y * 3, -d.z * 3, 0.3, 0.2, 0xa06bff); }
  });
  p.v.glow(t.chest, 0x7a3aff, 3.5, p.T * 0.8);
};

P.links = (p) => {
  const t = p.target; if (!t) return;
  const n = 14; const grp = new THREE.Group(); const from = p.c.from.clone();
  for (let i = 0; i < n; i++) {
    const l = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 5, 10), new THREE.MeshStandardMaterial({ color: 0xaab2c0, metalness: 0.9, roughness: 0.3, emissive: 0x334455 }));
    l.rotation.y = i % 2 ? Math.PI / 2 : 0; grp.add(l);
  }
  p.v.temp(grp, p.T * 0.4 + 0.45, (k) => {
    const reach = Math.min(1, k * 2.2);
    grp.children.forEach((l, i) => { l.position.lerpVectors(from, t.chest, (i / n) * reach); l.lookAt(t.chest); l.rotateZ(i % 2 ? Math.PI / 2 : 0); });
  });
};

P.jumpTo = (p) => {
  const t = p.target; if (!t) return;
  const f = p.c.from.clone().add(p.c.fwd.clone().multiplyScalar(0.4));
  p.v.glow(f, p.col, 0.8, 0.15);
  p.v.projectile(f, t.chest, p.col, Number(p.args.flight ?? 0.2), 0.55, 0.2, 1);
};

P.muzzle = (p) => {
  const f = p.c.from.clone().add(p.c.fwd.clone().multiplyScalar(0.8));
  p.v.glow(f, Number(p.args.color ?? 0xffc070), 3, 0.25);
  p.h.add.burst(f, Number(p.args.color ?? 0xffa040), 30, { dir: p.c.fwd.clone().multiplyScalar(5), speed: 1, life: 0.4 });
  for (let i = 0; i < 8; i++) p.h.norm.spawn(f.x, f.y, f.z, p.c.fwd.x * 2 + p.rnd(-0.5, 0.5), p.rnd(0.2, 1), p.c.fwd.z * 2, 1.2, 0.8, 0x777066, 0, 0.9, 2);
  p.h.shake(0.3, 0.2);
};

P.groundHit = (p) => {
  const t = p.target; if (!t) return;
  p.v.crack(t.base, p.col, 3.6);
  p.v.shockwave(t.base, p.col, 5, 0.55);
  p.v.shockwave(t.base, 0xffffff, 3, 0.35);
  p.v.debris(t.base, 30);
  p.h.shake(Number(p.args.shake ?? 0.6), Number(p.args.shakeDur ?? 0.45));
  p.h.hitstop(Number(p.args.hitstop ?? 0.08));
  p.h.flash(t.base, p.col, 30);
};

// ---------------------------------------------------------------- host feel
P.hitstop = (p) => p.h.hitstop(Number(p.args.dur ?? 0.08));
P.shake = (p) => p.h.shake(Number(p.args.dur === undefined ? 0.3 : Number(p.args.dur)), Number(p.args.shakeDur ?? 0.3));
P.light = (p) => p.h.flash(p.c.from, p.col, Number(p.args.power ?? 20));

export const PRIMS = P as Record<string, Prim>;
export type { PrimApi };

// ---------------------------------------------------------------- positioned helpers
// recipes stay readable by naming *where* something happens instead of repeating
// `p.target?.base ?? p.centre` in every step.
P.circleActor = (p) => p.v.circle(p.c.fromBase, p.col, Number(p.args.dur ?? 0.6), Number(p.args.size ?? 1.6));
P.circleCentre = (p) => p.v.circle(p.centre, p.col, Number(p.args.dur ?? 0.6), Number(p.args.size ?? 1.6));
P.circleBase = (p) => p.v.circle(p.target?.base ?? p.centre, p.col, Number(p.args.dur ?? 0.6), Number(p.args.size ?? 1.6));
P.glowActor = (p) => p.v.glow(p.c.from, p.col, Number(p.args.size ?? 2.4), Number(p.args.dur ?? 0.3));
P.pillarActor = (p) => p.v.pillar(p.c.fromBase, p.col, Number(p.args.dur ?? 0.8), Number(p.args.r ?? 0.7), Number(p.args.hgt ?? 9));
P.shockwaveActor = (p) => p.v.shockwave(p.c.fromBase, p.col, Number(p.args.size ?? 3), Number(p.args.dur ?? 0.5));
P.shockwaveCentre = (p) => p.v.shockwave(p.centre, p.col, Number(p.args.size ?? 3), Number(p.args.dur ?? 0.5));
P.lightCentre = (p) => p.h.flash(p.centre, Number(p.args.color ?? p.col), Number(p.args.power ?? 20));
P.flashAt = (p) => p.h.flash(p.target?.chest ?? p.centre, Number(p.args.color ?? p.col), Number(p.args.power ?? 20));

P.boltGround = (p) => p.v.bolt((p.target?.base ?? p.centre).clone().setY(0.1));
P.burstDir = (p) => {
  const pos = p.target?.chest ?? p.centre;
  p.h.add.burst(pos, p.col, Number(p.args.count ?? 30), {
    dir: p.c.fwd.clone().multiplyScalar(6), speed: 1, life: Number(p.args.life ?? 0.4), size: Number(p.args.size ?? 0.2),
  });
};

/** lightning that hops from one target to the next */
P.chainHit = (p) => {
  let prev = p.c.from.clone().add(new THREE.Vector3(0, 0.4, 0));
  p.targets.forEach((t, i) => {
    const from = prev.clone();
    p.h.later(p.T + i * 0.06, () => p.v.bolt(t.chest, from, 0xa0e0ff));
    prev = t.chest.clone();
  });
};
