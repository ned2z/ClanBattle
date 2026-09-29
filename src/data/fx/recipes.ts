import type { Recipe, Tech } from './types';

/**
 * One entry per effect family. This used to be a 200-line switch statement;
 * now the whole choreography is readable at a glance.
 *
 * Timing: `at` is a fraction of `impact` - 1 lands the hit, <1 is windup,
 * >1 is after. String form adds an absolute offset, e.g. "1+0.07" = T + 0.07s.
 */
const R: Partial<Record<Tech, Recipe>> = {};

R.strike = { impact: 0.34, steps: [] };
R.none = { impact: 0.2, steps: [] };
R.item = { impact: 0.3, steps: [{ prim: 'burst', args: { count: 16, up: 1, life: 0.6, size: 0.25 } }] };

R.multi = {
  impact: 0.38,
  steps: [
    { at: 0.1, prim: 'aura', args: { dur: '$T*0.6' } },
    { at: 1, prim: 'eachTarget', args: { steps: [{ prim: 'slash', args: { size: 1.4, rot: 0.6 } }] } },
    { at: '1+0.07', prim: 'eachTarget', args: { steps: [{ prim: 'slash', args: { color: 0xffffff, size: 1.5, rot: -0.8 } }] } },
    { at: '1+0.14', prim: 'eachTarget', args: { steps: [{ prim: 'slash', args: { size: 1.2, rot: 2.2 } }] } },
  ],
};

R.bigslash = {
  impact: 0.62,
  steps: [
    { prim: 'circle', args: { dur: '$T*1.2', size: 2 } },
    { prim: 'aura', args: { dur: '$T', count: 3 } },
    { at: 0.3, prim: 'glowActor', args: { size: 2.2, dur: '$T*0.7' } },
    { at: 1, prim: 'eachTarget', args: { steps: [
      { prim: 'slash', args: { size: 3.2, rot: -0.5, dur: 0.45 } },
      { prim: 'slash', args: { color: 0xffffff, size: 2.4, rot: 0.3, dur: 0.35 } },
      { prim: 'crack', args: { size: 3.2 } },
      { prim: 'shockwave', args: { size: 4.5, dur: 0.6 } },
      { prim: 'debris', args: { count: 20 } },
      { prim: 'hitstop', args: { dur: 0.09 } },
      { prim: 'shake', args: { dur: 0.5, shakeDur: 0.4 } },
      { prim: 'flashAt', args: { power: 40 } },
    ] } },
  ],
};

R.whirl = {
  impact: 0.55,
  steps: [
    { prim: 'circle', args: { dur: '$T*1.4', size: 2.6 } },
    { at: 0.35, prim: 'orbitRing' },
    { at: 1, prim: 'eachTarget', args: { steps: [{ prim: 'slash', args: { size: 1.8, rot: '$index' } }] } },
    { at: '1+0.1', prim: 'eachTarget', args: { steps: [{ prim: 'slash', args: { color: 0xffffff, size: 1.6, rot: '$index+2' } }] } },
    { at: 1, prim: 'group', args: { steps: [
      { prim: 'shockwaveCentre', args: { size: 5, dur: 0.6 } },
      { prim: 'shake', args: { dur: 0.35, shakeDur: 0.35 } },
    ] } },
  ],
};

R.thrust = {
  impact: 0.42,
  steps: [
    { prim: 'aura', args: { dur: '$T*0.8', count: 2 } },
    { at: 1, prim: 'eachTarget', args: { steps: [
      { prim: 'beam', args: { dur: 0.22, r: 0.12 } },
      { prim: 'glow', args: { color: 0xffffff, size: 2.4, dur: 0.25 } },
      { prim: 'burstDir', args: { count: 30, size: 0.2, life: 0.4 } },
      { prim: 'hitstop', args: { dur: 0.06 } },
    ] } },
  ],
};

R.leap = {
  impact: 0.62,
  steps: [
    { prim: 'aura', args: { dur: '$T*0.5', count: 2 } },
    { at: 1, prim: 'eachTarget', args: { steps: [{ prim: 'groundHit' }] } },
  ],
};

R.shoot = {
  impact: 0.36,
  steps: [{ at: '1-$FLY', prim: 'eachTarget', args: { steps: [{ prim: 'jumpTo', args: { flight: '$FLY' } }] } }],
};

R.arrows = {
  impact: 0.85,
  steps: [
    { prim: 'circle', args: { dur: '$T', size: 1.6 } },
    { at: 0.25, prim: 'arrowRain' },
    { at: 1, prim: 'shake', args: { dur: 0.25, shakeDur: 0.3 } },
  ],
};

R.cannon = {
  impact: 0.62,
  steps: [
    { at: 0.5, prim: 'muzzle' },
    { at: 0.5, prim: 'eachTarget', args: { steps: [{ prim: 'projectile', args: { color: 0xff8030, flight: '$T*0.5', size: 0.8, arc: 1.6 } }] } },
    { at: 1, prim: 'eachTarget', args: { steps: [{ prim: 'explode', args: { color: 0xff7a2a, scale: 1.2 } }] } },
  ],
};

R.fireball = {
  impact: 0.66,
  steps: [
    { prim: 'circle', args: { dur: '$T*1.1', size: 1.9 } },
    { prim: 'orb' },
    { at: 1, prim: 'eachTarget', args: { steps: [{ prim: 'explode', args: { scale: 1.2 } }] } },
  ],
};

R.meteor = {
  impact: 0.95,
  steps: [
    { prim: 'circle', args: { dur: '$T', size: 2 } },
    { at: 0.1, prim: 'light', args: { power: 12 } },
    { at: 1, prim: 'skyRain' },
    { at: 1, prim: 'shake', args: { dur: 0.6, shakeDur: 0.5 } },
    { at: 1, prim: 'hitstop', args: { dur: 0.07 } },
  ],
};

R.blizzard = {
  impact: 0.75,
  steps: [
    { prim: 'circle', args: { dur: '$T*1.1', size: 2 } },
    { prim: 'circleCentre', args: { dur: '$T*1.4', size: 4.5 } },
    { prim: 'rain' },
    { at: 1, prim: 'eachTarget', args: { steps: [
      { prim: 'iceSpikes', args: { size: 1.1 } },
      { prim: 'glow', args: { color: 0x9adfff, size: 2.5, dur: 0.4 } },
    ] } },
    { at: 1, prim: 'group', args: { steps: [
      { prim: 'shockwaveCentre', args: { color: 0x9adfff, size: 5, dur: 0.7 } },
      { prim: 'shake', args: { dur: 0.3, shakeDur: 0.3 } },
    ] } },
  ],
};

R.icelance = {
  impact: 0.55,
  steps: [
    { prim: 'circle', args: { dur: '$T', size: 1.7 } },
    { at: '1-$T*0.4', prim: 'eachTarget', args: { steps: [{ prim: 'lance' }] } },
    { at: 1, prim: 'eachTarget', args: { steps: [
      { prim: 'iceSpikes', args: { size: 0.8 } },
      { prim: 'burst', args: { color: 0xffffff, count: 20, speed: 6, life: 0.4, size: 0.15 } },
    ] } },
  ],
};

R.lightning = {
  impact: 0.6,
  steps: [
    { prim: 'circle', args: { dur: '$T*1.1', size: 1.9 } },
    { at: 0.2, prim: 'clouds' },
    { at: 1, prim: 'eachTarget', args: { steps: [
      { prim: 'boltGround' },
      { prim: 'crack', args: { color: 0xfff27a, size: 2.2 } },
    ] } },
    { at: '1+0.09', prim: 'eachTarget', args: { steps: [{ prim: 'bolt' }] } },
    { at: 1, prim: 'group', args: { steps: [
      { prim: 'shake', args: { dur: 0.45, shakeDur: 0.35 } },
      { prim: 'hitstop', args: { dur: 0.07 } },
    ] } },
  ],
};

R.chain = {
  impact: 0.55,
  steps: [
    { prim: 'circle', args: { dur: '$T', size: 1.7 } },
    { at: 1, prim: 'chainHit' },
    { at: 1, prim: 'shake', args: { dur: 0.3, shakeDur: 0.3 } },
  ],
};

R.dragon = {
  impact: 0.62,
  steps: [
    { prim: 'circle', args: { dur: '$T*1.3', size: 2.3 } },
    { prim: 'stream' },
    { at: 1, prim: 'eachTarget', args: { steps: [{ prim: 'explode', args: { scale: 1 } }] } },
    { at: 1, prim: 'shake', args: { dur: 0.4, shakeDur: 0.5 } },
  ],
};

R.tornado = {
  impact: 0.66,
  steps: [
    { prim: 'circle', args: { dur: '$T', size: 1.8 } },
    { at: 0.4, prim: 'column' },
    { at: 1, prim: 'shake', args: { dur: 0.3, shakeDur: 0.4 } },
  ],
};

R.dark = {
  impact: 0.66,
  steps: [
    { prim: 'circleActor', args: { color: 0x9a5aff, dur: '$T*1.1', size: 2 } },
    { at: 0.25, prim: 'eachTarget', args: { steps: [{ prim: 'voidOrb' }] } },
    { at: 1, prim: 'eachTarget', args: { steps: [
      { prim: 'burst', args: { color: 0xb07aff, count: 40, speed: 8, life: 0.5, size: 0.3 } },
      { prim: 'shockwave', args: { color: 0x7a3aff, size: 3.5, dur: 0.5 } },
    ] } },
    { at: 1, prim: 'shake', args: { dur: 0.35, shakeDur: 0.3 } },
  ],
};

R.drain = { impact: 0.45, steps: [{ prim: 'drain' }] };

R.holy = {
  impact: 0.62,
  steps: [
    { prim: 'circle', args: { dur: '$T*1.1', size: 1.9 } },
    { at: 0.3, prim: 'eachTarget', args: { steps: [{ prim: 'circleBase', args: { color: 0xfff3c0, dur: '$T*0.9', size: 2.2 } }] } },
    { at: 0.85, prim: 'eachTarget', args: { steps: [{ prim: 'pillar', args: { color: 0xfff3c0, dur: 0.7, r: 0.8 } }] } },
    { at: 1, prim: 'eachTarget', args: { steps: [
      { prim: 'glow', args: { color: 0xffffff, size: 3.5, dur: 0.4 } },
      { prim: 'burst', args: { color: 0xfff3c0, count: 30, speed: 5, life: 0.6, up: 1 } },
    ] } },
    { at: 1, prim: 'group', args: { steps: [
      { prim: 'shake', args: { dur: 0.3, shakeDur: 0.3 } },
      { prim: 'lightCentre', args: { color: 0xfff3c0, power: 30 } },
    ] } },
  ],
};

R.poison = { impact: 0.42, steps: [{ at: 1, prim: 'poison' }] };

R.heal = {
  impact: 0.48,
  steps: [
    { prim: 'circle', args: { color: 0x86efac, dur: '$T', size: 1.6 } },
    { prim: 'eachTarget', args: { steps: [{ prim: 'circleBase', args: { color: 0x86efac, dur: '$T+0.6', size: 1.8 } }] } },
    { at: 1, prim: 'eachTarget', args: { steps: [
      { prim: 'pillar', args: { color: 0x86efac, dur: 0.7, r: 0.55, hgt: 5 } },
      { prim: 'burst', args: { color: 0xbbf7d0, count: 30, speed: 2.5, up: 1, life: 1.1, g: -1.5, spread: 1.2 } },
    ] } },
  ],
};

R.healall = {
  impact: 0.58,
  steps: [
    { prim: 'circle', args: { color: 0x86efac, dur: '$T*1.2', size: 2 } },
    { at: 0.2, prim: 'circleCentre', args: { color: 0x86efac, dur: '$T+0.8', size: 5.5 } },
    { prim: 'motes', args: { count: 12, y0: 4, vy: -1.5, color: 0xfff3c0, gap: 0.05, per: 4, radius: 3 } },
    { at: 1, prim: 'eachTarget', args: { steps: [
      { prim: 'pillar', args: { color: 0x86efac, dur: 0.8, r: 0.5, hgt: 5 } },
      { prim: 'burst', args: { color: 0xbbf7d0, count: 20, speed: 2.4, up: 1, life: 1, g: -1.5, spread: 1 } },
    ] } },
  ],
};

R.revive = {
  impact: 0.85,
  steps: [
    { prim: 'circle', args: { color: 0xfff3c0, dur: '$T*1.2', size: 2 } },
    { prim: 'eachTarget', args: { steps: [
      { prim: 'circleBase', args: { color: 0xfff3c0, dur: '$T+1', size: 2.6 } },
      { prim: 'motes', args: { count: 20, y0: 5, vy: -2, color: 0xffffff, gap: '$T*0.04', per: 1, radius: 1.2 } },
      { at: 0.9, prim: 'group', args: { steps: [
        { prim: 'pillar', args: { color: 0xfff3c0, dur: 1.1, r: 1, hgt: 12 } },
        { prim: 'flashAt', args: { color: 0xfff3c0, power: 40 } },
      ] } },
      { at: 1, prim: 'group', args: { steps: [
        { prim: 'shockwave', args: { color: 0xfff3c0, size: 4, dur: 0.8 } },
        { prim: 'glow', args: { color: 0xffffff, size: 5, dur: 0.6 } },
      ] } },
    ] } },
  ],
};

R.buff = {
  impact: 0.48,
  steps: [
    { prim: 'circle', args: { dur: '$T+0.4', size: 1.8 } },
    { prim: 'aura', args: { dur: '$T+0.2', count: 3 } },
    { at: 1, prim: 'group', args: { steps: [
      { prim: 'shockwaveActor', args: { size: 2.6, dur: 0.5 } },
      { prim: 'pillarActor', args: { dur: 0.5, r: 0.6, hgt: 4 } },
      { prim: 'glowActor', args: { size: 3, dur: 0.4 } },
    ] } },
  ],
};

R.buffall = {
  impact: 0.58,
  steps: [
    { prim: 'circle', args: { dur: '$T', size: 1.8 } },
    { at: 0.3, prim: 'circleCentre', args: { dur: '$T+0.6', size: 5.5 } },
    { prim: 'aura', args: { dur: '$T', count: 2 } },
    { at: 1, prim: 'eachTarget', args: { steps: [
      { prim: 'pillar', args: { dur: 0.6, r: 0.55, hgt: 5 } },
      { prim: 'burst', args: { count: 18, speed: 3, up: 1, life: 0.8, spread: 1 } },
    ] } },
    { at: 1, prim: 'shockwaveCentre', args: { size: 5, dur: 0.7 } },
  ],
};

R.debuff = {
  impact: 0.52,
  steps: [
    { prim: 'circleActor', args: { color: 0x9a5aff, dur: '$T', size: 1.7 } },
    { at: 0.3, prim: 'eachTarget', args: { steps: [
      { prim: 'circleBase', args: { color: 0x9a5aff, dur: '$T', size: 1.6 } },
      { at: 1, prim: 'debuffCloud' },
    ] } },
  ],
};

R.coin = {
  impact: 0.48,
  steps: [
    { prim: 'coins' },
    { at: 1, prim: 'eachTarget', args: { steps: [{ prim: 'burst', args: { color: 0xffd35a, count: 40, speed: 6, g: 9, life: 0.9, size: 0.22 } }] } },
  ],
};

R.chains = {
  impact: 0.52,
  steps: [
    { prim: 'circleActor', args: { color: 0x9aa3b8, dur: '$T', size: 1.6 } },
    { at: 0.6, prim: 'eachTarget', args: { steps: [{ prim: 'links' }] } },
  ],
};

R.mana = {
  impact: 0.78,
  steps: [
    { prim: 'circleActor', args: { color: 0x5ee0ff, dur: '$T*1.2', size: 2.3 } },
    { prim: 'manaGather' },
    { at: 0.85, prim: 'eachTarget', args: { steps: [{ prim: 'explode', args: { color: 0x5ee0ff, scale: 1.3 } }] } },
    { at: 1, prim: 'group', args: { steps: [
      { prim: 'shake', args: { dur: 0.5, shakeDur: 0.4 } },
      { prim: 'hitstop', args: { dur: 0.08 } },
    ] } },
  ],
};

export const RECIPES = R as Record<Tech, Recipe>;
export const IMPACT: Record<Tech, number> = Object.fromEntries(
  (Object.keys(R) as Tech[]).map((t) => [t, R[t]!.impact]),
) as Record<Tech, number>;
