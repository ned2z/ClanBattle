/**
 * Save / load.
 *
 * save.ts reads sessionStorage at module load, so the storage globals have to
 * exist before the import is evaluated. A tiny in-memory sessionStorage shim
 * stands in: it is enough to prove the module uses session rather than local
 * storage, and it keeps the tests free of a browser environment.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CITIES, NODE } from './data';
import { newGame } from './store';
import type { GameState } from './types';

function makeSession(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
  } as Storage;
}

/** The privacy-mode case: the module must fall back to memory, not explode. */
const THROWING = {
  get length(): number { throw new Error('denied'); },
  key: () => { throw new Error('denied'); },
  getItem: () => { throw new Error('denied'); },
  setItem: () => { throw new Error('denied'); },
  removeItem: () => { throw new Error('denied'); },
  clear: () => { throw new Error('denied'); },
} as unknown as Storage;

const g = (): GameState => newGame('ทดสอบ', ['shield', 'whitemage', 'rogue'], ['เอ', 'บี', 'ซี']);
const level = (s: GameState) => Math.round(s.members.reduce((a, m) => a + m.level, 0) / s.members.length);

/** Fresh module instance per test so the storage probe re-runs. */
const load = async () => {
  vi.resetModules();
  return import('./save');
};

beforeEach(async () => {
  (globalThis as { sessionStorage?: Storage }).sessionStorage = makeSession();
  (globalThis as { localStorage?: Storage }).localStorage = makeSession();
  await load();
});

describe('storage target', () => {
  it('does not write the save to localStorage', async () => {
    const s = await load();
    s.writeSave(g(), level);
    expect(s.hasSave()).toBe(true);
    expect(localStorage.getItem('tbs-save-v1')).toBeNull();
    expect(sessionStorage.getItem('tbs-save-v1')).not.toBeNull();
  });

  it('falls back to memory when sessionStorage is blocked', async () => {
    (globalThis as { sessionStorage?: Storage }).sessionStorage = THROWING;
    const s = await load();
    const game = g();
    expect(s.writeSave(game, level)).toBe(true);   // must not throw
    expect(s.hasSave()).toBe(true);
    expect(s.readSave()?.summary.partyName).toBe(game.partyName);
    s.clearSave();
    expect(s.hasSave()).toBe(false);
  });
});

describe('write / read round trip', () => {
  it('restores the whole state', async () => {
    const s = await load();
    const a = g();
    a.gold = 4242; a.fame = 17; a.day = 9; a.minute = 700; a.location = 'ayu';
    a.inv.potion = 9; a.visited = ['bkk', 'ayu'];
    expect(s.writeSave(a, level)).toBe(true);

    const back = s.readSave()!;
    expect(back.state.gold).toBe(4242);
    expect(back.state.fame).toBe(17);
    expect(back.state.day).toBe(9);
    expect(back.state.minute).toBe(700);
    expect(back.state.location).toBe('ayu');
    expect(back.state.inv.potion).toBe(9);
    expect(back.state.visited).toEqual(['bkk', 'ayu']);
  });

  it('denormalises a summary so the title screen never loads to find out', async () => {
    const s = await load();
    const a = g();
    a.gold = 777; a.location = 'kan';
    s.writeSave(a, level);
    expect(s.readSave()!.summary).toMatchObject({ partyName: a.partyName, gold: 777, location: 'kan', day: a.day });
    expect(s.readSave()!.summary.level).toBe(level(a));
  });

  it('strips an in-flight journey so a resume cannot start mid-segment', async () => {
    const s = await load();
    const a = g();
    a.travel = { path: ['bkk', 'ns', 'ayu'], seg: 1, t: 0.4 };
    s.writeSave(a, level);
    expect(s.readSave()!.state.travel).toBeNull();
  });

  it('overwrites the single slot rather than adding a second', async () => {
    const s = await load();
    const a = g(); a.gold = 100;
    s.writeSave(a, level);
    const b = g(); b.gold = 200;
    s.writeSave(b, level);
    expect(s.readSave()!.state.gold).toBe(200);
  });

  it('does not alias the live state object', async () => {
    const s = await load();
    const a = g();
    s.writeSave(a, level);
    a.gold = 31337;
    expect(s.readSave()!.state.gold).toBe(150);
  });
});

describe('rejection of bad payloads', () => {
  it('returns null with no save present', async () => {
    const s = await load();
    expect(s.hasSave()).toBe(false);
    expect(s.readSave()).toBeNull();
  });

  it('survives unparseable JSON', async () => {
    const s = await load();
    sessionStorage.setItem('tbs-save-v1', '{not json');
    expect(s.readSave()).toBeNull();
  });

  it('rejects a payload with no state', async () => {
    const s = await load();
    sessionStorage.setItem('tbs-save-v1', JSON.stringify({ version: 1, savedAt: 'x' }));
    expect(s.readSave()).toBeNull();
  });

  it('rejects a save from a newer build', async () => {
    const s = await load();
    sessionStorage.setItem('tbs-save-v1', JSON.stringify({ version: 99, savedAt: 'x', state: g() }));
    expect(s.readSave()).toBeNull();
  });

  it('rejects a party-less state', async () => {
    const s = await load();
    sessionStorage.setItem('tbs-save-v1', JSON.stringify({ version: 1, savedAt: 'x', state: { ...g(), members: [] } }));
    expect(s.readSave()).toBeNull();
  });

  it('moves a location that no longer exists onto the map', async () => {
    const s = await load();
    sessionStorage.setItem('tbs-save-v1', JSON.stringify({ version: 1, savedAt: 'x', state: { ...g(), location: 'atlantis' } }));
    const back = s.readSave()!.state;
    expect(NODE[back.location]).toBeDefined();
    expect(back.location).toBe(CITIES[0].id);
  });

  it('fills in fields an older build never wrote', async () => {
    const s = await load();
    const legacy = g() as Partial<GameState>;
    delete legacy.visited; delete legacy.bag; delete legacy.log; delete legacy.cityQuests; delete legacy.stats;
    sessionStorage.setItem('tbs-save-v1', JSON.stringify({ version: 1, savedAt: 'x', state: legacy }));
    const back = s.readSave()!.state;
    expect(back.visited).toEqual([]);
    expect(back.bag).toEqual([]);
    expect(back.log).toEqual([]);
    expect(back.cityQuests).toEqual({});
    expect(back.stats).toBeDefined();
  });

  it('normalises an out-of-range clock', async () => {
    const s = await load();
    sessionStorage.setItem('tbs-save-v1', JSON.stringify({ version: 1, savedAt: 'x', state: { ...g(), day: 1, minute: -600 } }));
    const m = s.readSave()!.state.minute;
    expect(m).toBeGreaterThanOrEqual(0);
    expect(m).toBeLessThan(24 * 60);
  });
});

describe('clearSave', () => {
  it('removes the slot', async () => {
    const s = await load();
    s.writeSave(g(), level);
    s.clearSave();
    expect(s.hasSave()).toBe(false);
  });

  it('is safe when nothing is stored', async () => {
    const s = await load();
    expect(() => s.clearSave()).not.toThrow();
  });
});

describe('savedWhen', () => {
  it('formats recent times', async () => {
    const s = await load();
    const now = Date.now();
    expect(s.savedWhen(new Date(now).toISOString())).toBe('เมื่อสักครู่');
    expect(s.savedWhen(new Date(now - 30 * 60000).toISOString())).toBe('30 นาทีที่แล้ว');
    expect(s.savedWhen(new Date(now - 5 * 3600_000).toISOString())).toBe('5 ชั่วโมงที่แล้ว');
    expect(s.savedWhen(new Date(now - 72 * 3600_000).toISOString())).toBe('3 วันที่แล้ว');
  });

  it('returns empty for an unparseable date instead of NaN', async () => {
    const s = await load();
    expect(s.savedWhen('not a date')).toBe('');
    expect(s.savedWhen('')).toBe('');
  });
});

describe('nearestVisitedCity', () => {
  it('falls back to the first city when nothing was visited', async () => {
    const s = await load();
    const a = g();
    a.visited = [];
    expect(s.nearestVisitedCity(a)).toBe(CITIES[0].id);
  });

  it('stays put when the party fell inside a visited city', async () => {
    const s = await load();
    const a = g();
    a.location = 'ayu';
    a.visited = ['bkk', 'ayu'];
    expect(s.nearestVisitedCity(a)).toBe('ayu');
  });

  it('only ever returns something that is a city on the map', async () => {
    const s = await load();
    for (const c of CITIES) {
      const a = g();
      a.location = c.id;
      a.visited = CITIES.map((x) => x.id);
      expect(NODE[s.nearestVisitedCity(a)]?.kind).toBe('city');
    }
  });

  it('ignores visited nodes that are not cities', async () => {
    const s = await load();
    const a = g();
    a.location = 'bkk';
    const nonCity = Object.values(NODE).find((n) => n.kind !== 'city' && n.id !== 'bkk')!;
    a.visited = ['bkk', nonCity.id];
    expect(NODE[s.nearestVisitedCity(a)]?.kind).toBe('city');
  });
});

describe('applyDefeat', () => {
  it('takes the agreed 30% of the purse', async () => {
    const s = await load();
    const a = g();
    a.gold = 1000;
    expect(s.applyDefeat(a).lost).toBe(300);
    expect(a.gold).toBe(700);
    expect(s.DEATH_GOLD_LOSS).toBe(0.3);
  });

  it('rounds the loss to whole coins', async () => {
    const s = await load();
    const a = g();
    a.gold = 999;
    const { lost } = s.applyDefeat(a);
    expect(Number.isInteger(lost)).toBe(true);
    expect(a.gold).toBe(999 - lost);
  });

  it('leaves everyone on 1 HP instead of dead', async () => {
    const s = await load();
    const a = g();
    a.members.forEach((m) => { m.hp = 0; });
    s.applyDefeat(a);
    expect(a.members.every((m) => m.hp === 1)).toBe(true);
  });

  it('moves the party to a visited city and cancels travel', async () => {
    const s = await load();
    const a = g();
    a.visited = ['bkk', 'ayu'];
    a.location = 'ns';
    a.travel = { path: ['bkk', 'ns'], seg: 0, t: 0.5 };
    const { wakeCity } = s.applyDefeat(a);
    expect(NODE[wakeCity]?.kind).toBe('city');
    expect(a.visited).toContain(wakeCity);
    expect(a.travel).toBeNull();
  });

  it('writes an entry into the adventure log', async () => {
    const s = await load();
    const a = g();
    a.log = [];
    s.applyDefeat(a);
    expect(a.log[0].type).toBe('lose');
    expect(a.log[0].text).toContain('ล่มสลาย');
  });

  it('loses nothing when the purse is empty', async () => {
    const s = await load();
    const a = g();
    a.gold = 0;
    expect(s.applyDefeat(a).lost).toBe(0);
    expect(a.gold).toBe(0);
  });

  it('leaves the saved checkpoint untouched so a reload replays the pre-defeat run', async () => {
    const s = await load();
    const a = g();
    a.gold = 1000; a.location = 'ayu';
    s.writeSave(a, level);
    const before = s.readSave()!.state;

    a.gold = 5000;                        // play on, then get wiped out
    s.applyDefeat(a);
    expect(a.gold).toBe(3500);

    const reloaded = s.readSave()!.state;
    expect(reloaded.gold).toBe(before.gold);
    expect(reloaded.location).toBe(before.location);
  });
});
