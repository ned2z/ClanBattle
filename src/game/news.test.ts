/**
 * Daily news.
 *
 * The headline property of this module is that the paper is a pure function of
 * `day`: the same day always produces the same feed, so nothing needs storing
 * and the market chart can never disagree with the newspaper.
 */
import { describe, expect, it } from 'vitest';
import { CITIES } from './data';
import { CATS, CAT, newsDate, newsFor, newsTotal, type NewsCat } from './news';
import { newGame } from './store';
import type { GameState } from './types';

const g = (): GameState => newGame('ทดสอบ', ['shield', 'whitemage', 'rogue'], ['เอ', 'บี', 'ซี']);
const ALL: NewsCat[] = ['economy', 'rival', 'monster', 'city'];

describe('categories', () => {
  it('has four categories', () => {
    expect(CATS).toHaveLength(4);
    expect(ALL.every((c) => CAT[c])).toBe(true);
  });

  it('gives every category a distinct icon and colour', () => {
    expect(new Set(CATS.map((c) => c.icon)).size).toBe(4);
    expect(new Set(CATS.map((c) => c.color)).size).toBe(4);
    expect(new Set(CATS.map((c) => c.label)).size).toBe(4);
  });

  it('pairs each id with its own entry', () => {
    for (const c of CATS) expect(CAT[c.id]).toBe(c);
  });
});

describe('newsFor', () => {
  it('returns an entry for every category', () => {
    const n = newsFor(g(), 5, 600);
    expect(Object.keys(n).sort()).toEqual([...ALL].sort());
  });

  it('is deterministic for the same day', () => {
    const a = newsFor(g(), 7, 600);
    const b = newsFor(g(), 7, 600);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('gives different days different papers', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 20; d++) seen.add(JSON.stringify(newsFor(g(), d, 600)));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('files every item under the category it sits in', () => {
    const n = newsFor(g(), 9, 600);
    for (const cat of ALL) {
      for (const it of n[cat]) expect(it.cat).toBe(cat);
    }
  });

  it('always produces non-empty text', () => {
    for (let d = 1; d <= 15; d++) {
      const n = newsFor(g(), d, 600);
      for (const cat of ALL) {
        for (const it of n[cat]) {
          expect(it.text.length).toBeGreaterThan(0);
          expect(it.text).not.toMatch(/undefined|NaN|\[object/);
        }
      }
    }
  });

  it('does not leak a minute change into the body of the paper', () => {
    const noon = newsFor(g(), 6, 720);
    const midnight = newsFor(g(), 6, 60);
    // Rival and city items are day-level; only economy reads the clock.
    expect(JSON.stringify(noon.rival)).toBe(JSON.stringify(midnight.rival));
    expect(JSON.stringify(noon.monster)).toBe(JSON.stringify(midnight.monster));
  });

  it('reads the real standings for rival news', () => {
    const a = g();
    a.fame = 0;
    a.npcs[0].fame = 9999;
    const n = newsFor(a, 3, 600);
    expect(JSON.stringify(n.rival)).toContain(a.npcs[0].name);
  });

  it('economy items carry a direction tone when prices moved', () => {
    const n = newsFor(g(), 8, 600);
    for (const it of n.economy) {
      if (it.tone) expect(['up', 'down', 'flat']).toContain(it.tone);
    }
  });

  it('works from every city', () => {
    for (const c of CITIES) {
      const a = g();
      a.location = c.id;
      a.visited = CITIES.map((x) => x.id);
      const n = newsFor(a, 4, 600);
      for (const cat of ALL) {
        for (const it of n[cat]) expect(it.text).not.toMatch(/undefined|NaN/);
      }
    }
  });

  it('survives a party with no rivals and no inventory', () => {
    const a = g();
    a.npcs = [];
    a.inv = {};
    const n = newsFor(a, 2, 600);
    expect(Object.keys(n)).toHaveLength(4);
  });
});

describe('newsTotal', () => {
  it('sums every category', () => {
    const n = newsFor(g(), 5, 600);
    expect(newsTotal(n)).toBe(ALL.reduce((s, c) => s + n[c].length, 0));
  });

  it('is zero on an empty paper', () => {
    expect(newsTotal({ economy: [], rival: [], monster: [], city: [] })).toBe(0);
  });
});

describe('newsDate', () => {
  it('renders a dateline without NaN', () => {
    expect(newsDate(3, 600)).toContain('3');
    expect(newsDate(3, 600)).not.toMatch(/NaN|undefined/);
  });
});
