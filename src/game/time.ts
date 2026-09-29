/**
 * Day / time-of-day system.
 *
 * Rule: passing 1 map node = 5 in-game minutes. Everything else is derived
 * from that, so travel time is predictable without the player doing math:
 *   4 nodes -> 20 min, 20 nodes -> 1h40m, 288 nodes -> 1 full day.
 */

export const MIN_PER_NODE = 5;     // minutes per map node passed
export const MINUTES_PER_DAY = 1440;
export const BATTLE_BASE = 20;     // fixed cost of a battle
export const BATTLE_PER_TURN = 3;   // + per turn taken
export const TRAIN_MINUTES = 120;  // 2h to reroll a skill
export const INN_WAKE = 7 * 60;    // waking up always lands on 07:00
export const START_MINUTE = 8 * 60; // a new run begins at 08:00

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

export const PHASE: Record<DayPhase, { icon: string; label: string; color: string }> = {
  dawn:  { icon: '🌅', label: 'ฟ้าสาง', color: '#fdba74' },
  day:   { icon: '☀️', label: 'กลางวัน', color: '#fde047' },
  dusk:  { icon: '🌇', label: 'ตกแดด', color: '#fb923c' },
  night: { icon: '🌙', label: 'กลางคืน', color: '#93c5fd' },
};

/** Which part of the day a minute-of-day falls into. */
export function dayPhase(minute: number): DayPhase {
  const m = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  if (m < 300) return 'night';                        // 00:00-05:00 (night wraps past midnight)
  if (m < 420) return 'dawn';                         // 05:00-07:00
  if (m < 1020) return 'day';                         // 07:00-17:00
  if (m < 1140) return 'dusk';                        // 17:00-19:00
  return 'night';                                     // 19:00-24:00
}

/**
 * Market price multiplier by time of day. Kept small (+/-5%) on purpose:
 * enough for the clock to matter, not enough to turn the game into a wait.
 * Cheapest at dawn, dearest in late afternoon.
 */
const HOUR_MOD: [number, number][] = [
  [300, 0.95],   // 05:00 dawn  - markets just opened, cheap
  [540, 1.00],   // 09:00 morning - normal
  [900, 1.05],   // 15:00 afternoon - peak demand
  [1140, 1.00],  // 19:00 evening - back to normal
];

export function hourMod(minute: number): number {
  const m = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  let mod = 1;
  for (const [from, v] of HOUR_MOD) if (m >= from) mod = v;
  return mod;
}

/** 1230 -> "20:30". */
export function fmtTime(minute: number): string {
  const m = ((Math.round(minute) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** 150 -> "2ชม. 30น." — used for ETA and costs. */
export function fmtDuration(minute: number): string {
  const t = Math.max(0, Math.round(minute));
  if (t < 60) return `${t} นาที`;
  const h = Math.floor(t / 60), m = t % 60;
  return m ? `${h} ชม. ${m} น.` : `${h} ชม.`;
}

/** Day number + minute-of-day -> absolute minutes since the run started. */
export const absMinutes = (day: number, minute: number) => (day - 1) * MINUTES_PER_DAY + minute;

/** Inverse of absMinutes. */
export function fromAbs(total: number): { day: number; minute: number } {
  const t = Math.max(0, Math.round(total));
  return { day: Math.floor(t / MINUTES_PER_DAY) + 1, minute: t % MINUTES_PER_DAY };
}

/**
 * Add minutes to a {day, minute} pair, rolling over into the next day.
 * Always returns a normalised pair — this is the only place days advance.
 */
export function addMinutes(day: number, minute: number, add: number): { day: number; minute: number } {
  return fromAbs(absMinutes(day, minute) + add);
}

/** Minutes between two waypoints, by the "1 node = 5 min" rule. */
export const travelMinutes = (nodes: number) => Math.max(0, Math.round(nodes)) * MIN_PER_NODE;

/** Minutes a battle costs. */
export const battleMinutes = (turns: number) => BATTLE_BASE + Math.max(0, Math.round(turns)) * BATTLE_PER_TURN;

/**
 * Defensive normaliser. Guards against a corrupt/legacy state where minute is
 * missing or out of range, which would otherwise poison price lookups forever.
 */
export function normalize(day: number, minute: number): { day: number; minute: number } {
  const d = Number.isFinite(day) && day >= 1 ? Math.floor(day) : 1;
  const m = Number.isFinite(minute) ? minute : START_MINUTE;
  return fromAbs(absMinutes(d, m));
}
