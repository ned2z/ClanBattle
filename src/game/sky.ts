/**
 * Day / night lighting.
 *
 * Pure data and maths — no three.js — so game/ stays free of renderer
 * dependencies. The three/ scenes read this and apply it.
 *
 * Design goal from the brief: night is *dimmer*, not *black*. The player still
 * has to read city labels and pick a route, so night keeps a real ambient
 * floor (hemiI 0.55) and a cool blue cast rather than simply dimming
 * everything. Fog also closes in at night, because you should not be able to
 * see distant detail you could not in the dark.
 */

export interface SkyStyle {
  /** Scene background / sphere tint. */
  sky: string;
  /** Directional (sun or moon) light colour. */
  sun: string;
  sunI: number;
  /** Hemisphere sky-side and ground-side colours. */
  hemiSky: string;
  hemiGround: string;
  hemiI: number;
  fog: string;
  fogNear: number;
  fogFar: number;
  exposure: number;
  /** 0 = full daylight, 1 = deep night. Drives the sky-sphere tint and the
   *  sun/moon swap, so those do not each need their own curve. */
  darkness: number;
  /** 1 while the sun is up, 0 once it has set. */
  daylight: number;
}

interface Key extends SkyStyle { minute: number }

/** Six keys, last one closes the loop at midnight. */
const KEYS: Key[] = [
  {
    minute: 0, // 00:00 deep night
    sky: '#16213f', sun: '#8fa8d8', sunI: 0.40,
    hemiSky: '#5a7ab8', hemiGround: '#1e2a44', hemiI: 0.55,
    fog: '#16213f', fogNear: 45, fogFar: 130, exposure: 0.92,
    darkness: 1, daylight: 0,
  },
  {
    minute: 300, // 05:00 first light
    sky: '#e8a878', sun: '#ffb877', sunI: 1.30,
    hemiSky: '#ffb890', hemiGround: '#6a5a48', hemiI: 0.85,
    fog: '#e8b890', fogNear: 52, fogFar: 160, exposure: 1.00,
    darkness: 0.35, daylight: 0.5,
  },
  {
    minute: 420, // 07:00 morning
    sky: '#bfe6f5', sun: '#fff0d0', sunI: 2.20,
    hemiSky: '#dff2ff', hemiGround: '#6aa050', hemiI: 1.35,
    fog: '#bfe6f5', fogNear: 60, fogFar: 180, exposure: 1.05,
    darkness: 0, daylight: 1,
  },
  {
    minute: 780, // 13:00 bright noon
    sky: '#a8dcf5', sun: '#fffaf0', sunI: 2.40,
    hemiSky: '#eaf8ff', hemiGround: '#74ae58', hemiI: 1.40,
    fog: '#cfeaf7', fogNear: 62, fogFar: 185, exposure: 1.05,
    darkness: 0, daylight: 1,
  },
  {
    minute: 1080, // 18:00 sunset
    sky: '#f0a068', sun: '#ff9a50', sunI: 1.35,
    hemiSky: '#ffb890', hemiGround: '#6a5040', hemiI: 0.85,
    fog: '#f0b088', fogNear: 55, fogFar: 165, exposure: 1.00,
    darkness: 0.35, daylight: 0.5,
  },
  {
    minute: 1440, // 24:00 — closes the loop back to deep night
    sky: '#16213f', sun: '#8fa8d8', sunI: 0.40,
    hemiSky: '#5a7ab8', hemiGround: '#1e2a44', hemiI: 0.55,
    fog: '#16213f', fogNear: 45, fogFar: 130, exposure: 0.92,
    darkness: 1, daylight: 0,
  },
];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Linear blend of two 0xRRGGBB colours. Kept here so game/ needs no THREE. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
  return '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Lighting for a given minute-of-day, smoothly interpolated between keys. */
export function skyAt(minute: number): SkyStyle {
  const m = ((minute % 1440) + 1440) % 1440;
  let i = 0;
  while (i < KEYS.length - 2 && m >= KEYS[i + 1].minute) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = clamp01((m - a.minute) / (b.minute - a.minute));
  return {
    sky: mixHex(a.sky, b.sky, t),
    sun: mixHex(a.sun, b.sun, t),
    sunI: lerp(a.sunI, b.sunI, t),
    hemiSky: mixHex(a.hemiSky, b.hemiSky, t),
    hemiGround: mixHex(a.hemiGround, b.hemiGround, t),
    hemiI: lerp(a.hemiI, b.hemiI, t),
    fog: mixHex(a.fog, b.fog, t),
    fogNear: lerp(a.fogNear, b.fogNear, t),
    fogFar: lerp(a.fogFar, b.fogFar, t),
    exposure: lerp(a.exposure, b.exposure, t),
    darkness: lerp(a.darkness, b.darkness, t),
    daylight: lerp(a.daylight, b.daylight, t),
  };
}

/**
 * How much darker the battle backdrop gets. Deliberately half strength: the
 * fight is about reading units, and dimming the arena as hard as the map
 * would make the hardest part of the game the least readable.
 */
export const battleDarken = (s: SkyStyle) => s.darkness * 0.5;

/** How long a light change takes to ease in, in seconds. */
export const TIME_BLEND = 1.5;

/** Blend two fully resolved styles — used to animate between them. */
export function blendSkyStyle(a: SkyStyle, b: SkyStyle, t: number): SkyStyle {
  const k = clamp01(t);
  return {
    sky: mixHex(a.sky, b.sky, k),
    sun: mixHex(a.sun, b.sun, k),
    sunI: lerp(a.sunI, b.sunI, k),
    hemiSky: mixHex(a.hemiSky, b.hemiSky, k),
    hemiGround: mixHex(a.hemiGround, b.hemiGround, k),
    hemiI: lerp(a.hemiI, b.hemiI, k),
    fog: mixHex(a.fog, b.fog, k),
    fogNear: lerp(a.fogNear, b.fogNear, k),
    fogFar: lerp(a.fogFar, b.fogFar, k),
    exposure: lerp(a.exposure, b.exposure, k),
    darkness: lerp(a.darkness, b.darkness, k),
    daylight: lerp(a.daylight, b.daylight, k),
  };
}
