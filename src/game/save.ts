/**
 * Save / load.
 *
 * One slot, by design: a run is a roguelite, so the save represents "the
 * journey in progress" and starting over is a legitimate action rather than a
 * slot-management chore. There is deliberately no autosave.
 *
 * Storage is `sessionStorage`, not `localStorage`, because the stated rule is
 * "closing the game loses it" — a save that survived a browser restart would
 * quietly become a second, permanent progression track. sessionStorage keeps
 * the save across a page refresh (so an accidental reload is not fatal) while
 * still dropping it when the tab is closed. The high-score table is separate
 * and does use localStorage, since those are meant to outlive the session.
 *
 * Everything is versioned. A save written by an older build is either
 * migrated forward or rejected cleanly, never loaded half-migrated.
 */

import { NODE, CITIES } from './data';
import { findPath, pathLen } from './engine';
import { normalize } from './time';
import type { GameState } from './types';

const KEY = 'tbs-save-v1';
const VERSION = 1;

/**
 * sessionStorage throws outright in some privacy modes. Resolve the handle
 * once and fall back to a memory shim so a save never hard-fails the caller.
 */
const store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = (() => {
  try {
    const s = sessionStorage;
    const probe = '__tbs_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => { mem.set(k, v); },
      removeItem: (k) => { mem.delete(k); },
    };
  }
})();

export interface SaveEnvelope {
  version: number;
  savedAt: string;
  /** Denormalised for the "resume" summary, so the UI never loads to find out. */
  summary: { partyName: string; day: number; minute: number; location: string; gold: number; fame: number; level: number };
  state: GameState;
}

export const hasSave = (): boolean => {
  try { return !!store.getItem(KEY); } catch { return false; }
};

export function readSave(): SaveEnvelope | null {
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const env = JSON.parse(raw) as SaveEnvelope;
    if (!env || typeof env !== 'object' || !env.state) return null;
    if (env.version > VERSION) return null;   // written by a newer build
    const state = migrate(env.state, env.version);
    if (!state) return null;
    return { ...env, state };
  } catch {
    return null;   // corrupt payload — treat as "no save" rather than crashing
  }
}

export function writeSave(g: GameState, partyLevel: (s: GameState) => number): boolean {
  try {
    // Never persist an in-flight journey: a half-walked path would resume
    // mid-segment with the token somewhere between two nodes.
    const state: GameState = { ...structuredClone(g), travel: null };
    const env: SaveEnvelope = {
      version: VERSION,
      savedAt: new Date().toISOString(),
      summary: {
        partyName: state.partyName, day: state.day, minute: state.minute,
        location: state.location, gold: state.gold, fame: state.fame,
        level: partyLevel(state),
      },
      state,
    };
    store.setItem(KEY, JSON.stringify(env));
    return true;
  } catch {
    return false;   // quota exceeded or private mode
  }
}

export function clearSave(): void {
  try { store.removeItem(KEY); } catch { /* ignore */ }
}

/**
 * Bring an older save up to the current shape. Returns null if the save is
 * too broken to rescue.
 */
function migrate(s: GameState, from: number): GameState | null {
  if (!s.partyName || !Array.isArray(s.members) || !s.members.length) return null;

  // v1 introduced minute-of-day. Anything older had no clock at all.
  if (from < 1) s.minute = 8 * 60;

  const { day, minute } = normalize(s.day ?? 1, s.minute ?? 8 * 60);
  s.day = day; s.minute = minute;

  // The inventory became a Record; older saves were a fixed four-field object,
  // which is already Record-shaped, so only fill the gaps.
  s.inv ??= {};
  s.bag ??= [];
  s.log ??= [];
  s.visited ??= [];
  s.cityQuests ??= {};
  s.stats ??= { kills: 0, wins: 0, battles: 0, npcWins: 0, quests: 0 };
  s.settings ??= { autoPotion: true, autoRevive: true };

  // A save pointing at a node that no longer exists would strand the player.
  if (!s.location || !NODE[s.location]) s.location = CITIES[0].id;

  return s;
}

/** Human-readable "last played" label for the resume prompt. */
export function savedWhen(iso: string): string {
  try {
    const d = new Date(iso);
    // An unparseable date yields NaN everywhere below, which would render as
    // "NaN วันที่แล้ว" instead of falling back.
    if (Number.isNaN(d.getTime())) return '';
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'เมื่อสักครู่';
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`;
    return `${Math.round(hrs / 24)} วันที่แล้ว`;
  } catch {
    return '';
  }
}

/**
 * Where a defeated party wakes up: the nearest previously-visited city to
 * where it fell, falling back to the starting city. Walking the whole way
 * back to where you started would be a punishment on top of a punishment.
 *
 * Distance is measured along the road graph, not as a straight line. The map
 * is a peninsula, so two cities can look adjacent on screen while being
 * several days apart on the only route that connects them — waking the player
 * in the one they cannot reach quickly is the opposite of a rescue.
 */
export function nearestVisitedCity(g: GameState): string {
  const visited = g.visited.filter((id) => NODE[id]?.kind === 'city');
  if (!visited.length) return CITIES[0].id;
  const here = NODE[g.location];
  if (here?.kind === 'city' && visited.includes(g.location)) return g.location;
  if (!here) return visited[0];

  let best = visited[0];
  let bestD = Infinity;
  for (const id of visited) {
    if (!NODE[id]) continue;
    const route = findPath(g.location, id);
    // findPath falls back to [from] when the target is unreachable, which
    // measures as zero and would look falsely perfect; treat that as infinite.
    const d = route.length > 1 ? pathLen(route) : Infinity;
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}

/** 30% of the purse, which is the agreed cost of being wiped out. */
export const DEATH_GOLD_LOSS = 0.3;

/**
 * Full wipe-out resolution. Mutates `g` in place.
 *
 * The party wakes at 1 HP rather than dead, so the run continues but the
 * player is pushed to walk to an inn before the next fight: the cost is the
 * gold plus the detour, not a game over screen.
 */
export function applyDefeat(g: GameState): { lost: number; wakeCity: string } {
  const lost = Math.round(g.gold * DEATH_GOLD_LOSS);
  g.gold -= lost;
  const wakeCity = nearestVisitedCity(g);
  g.location = wakeCity;
  g.travel = null;
  for (const m of g.members) m.hp = 1;
  g.log.unshift({ id: Date.now(), day: g.day, type: 'lose', text: `ปาร์ตี้ล่มสลาย — ฟื้นที่${NODE[wakeCity]?.name ?? wakeCity}`, sub: `เสียทอง ${lost.toLocaleString('en-US')} 🪙` });
  return { lost, wakeCity };
}
