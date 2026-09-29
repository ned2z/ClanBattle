/**
 * Deterministic pseudo-randomness.
 *
 * Market prices must be identical every time the player looks at them —
 * across a page refresh, across machines, across a whole run. Anything based
 * on `Math.random()` would make the price graph lie to the player.
 *
 * So every price is a pure function of (city, item, day, time): no state is
 * stored anywhere, and the same inputs always produce the same number.
 */

/** FNV-1a style string hash -> uint32. */
export function hash(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic float in [0,1) for a seed plus any number of salt values. */
export function rand01(seed: number, ...salt: number[]): number {
  let x = seed >>> 0;
  for (const s of salt) {
    x = (Math.imul(x ^ (s >>> 0), 2246822519) + 0x9e3779b9) >>> 0;
    x = (x ^ (x >>> 13)) >>> 0;
  }
  return (x >>> 0) / 4294967296;
}

/** Deterministic float in [lo,hi). */
export const rand = (seed: number, lo: number, hi: number, ...salt: number[]): number =>
  lo + rand01(seed, ...salt) * (hi - lo);

/**
 * Smooth deterministic wave in [-1,1] with a real period.
 *
 * `t` is the day index. The period and phase come from the seed, so each
 * city/item pair cycles on its own rhythm, but the value is continuous in
 * `t`. That matters: a chart the player can read trends against, and a
 * "wait for the price to dip" plan that is actually achievable. Pure noise
 * was tried first and produced ±18% day-to-day swings, which reads as
 * randomness rather than a market.
 */
export function wave01(seed: number, t: number, ...salt: number[]): number {
  // Period between 5 and 11 days; phase offset so neighbouring pairs differ.
  const period = 5 + rand01(seed, ...salt, 0x27d4eb2f) * 6;
  const phase = rand01(seed, ...salt, 0x165667b1) * Math.PI * 2;
  return Math.sin((t / period) * Math.PI * 2 + phase);
}

/** Convert a hash to a small integer id, useful as a stable salt. */
export const idOf = (str: string): number => hash(str) % 100000;
