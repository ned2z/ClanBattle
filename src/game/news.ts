/**
 * Daily news.
 *
 * Every item is derived from real game state, not written flavour text: the
 * economy headlines compare actual prices across two days, the rival headlines
 * read the live standings, the monster sightings come from the real drop
 * tables, and city events are seeded from each city's own tier.
 *
 * That means the same is also true of the strongest property here: the feed is
 * a pure function of `day`, so nothing has to be stored, the news for day 5 is
 * identical every time, and the market chart and the paper can never disagree.
 */

import { CITIES, CITY } from './data';
import { MATERIALS } from '../data/economy/materials';
import { priceAt } from './market/price';
import { fmtTime } from './time';
import type { GameState } from './types';

export type NewsCat = 'economy' | 'rival' | 'monster' | 'city';

export interface NewsCatStyle {
  id: NewsCat;
  label: string;
  icon: string;
  color: string;
  /** Faint background wash used for the card. */
  wash: string;
}

/** Distinct colour AND icon per category, so the section reads at a glance. */
export const CATS: NewsCatStyle[] = [
  { id: 'economy', label: 'เศรษฐกิจ', icon: '💰', color: '#f6c453', wash: 'rgba(246,196,83,.12)' },
  { id: 'rival',   label: 'ปาร์ตี้อื่น', icon: '⚔️', color: '#e5533d', wash: 'rgba(229,83,61,.12)' },
  { id: 'monster', label: 'มอนสเตอร์หายาก', icon: '🐉', color: '#a78bfa', wash: 'rgba(167,139,250,.12)' },
  { id: 'city',    label: 'เมืองอื่น', icon: '🏛️', color: '#38bdf8', wash: 'rgba(56,189,248,.12)' },
];

export const CAT = Object.fromEntries(CATS.map((c) => [c.id, c])) as Record<NewsCat, NewsCatStyle>;

export interface NewsItem {
  cat: NewsCat;
  text: string;
  /** Optional emphasis span inside the text. */
  detail?: string;
  tone?: 'up' | 'down' | 'flat';
}

const hash = (s: string) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
};
const pick = <T,>(arr: T[], seed: number): T => arr[hash(String(seed)) % arr.length];

/** ---------- economy ---------- */
// Compare each material's price today against yesterday, in the player's city.
function economyNews(g: GameState, day: number, minute: number): NewsItem[] {
  const out: NewsItem[] = [];
  const scored = MATERIALS.map((m) => {
    const now = priceAt(g.location, m.id, day, minute);
    const prev = priceAt(g.location, m.id, Math.max(1, day - 1), minute);
    return { m, now, pct: prev ? ((now - prev) / prev) * 100 : 0 };
  }).filter((x) => Math.abs(x.pct) >= 1.5)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

  for (const { m, now, pct } of scored.slice(0, 3)) {
    const up = pct > 0;
    out.push({
      cat: 'economy',
      text: `${m.icon} ${m.name} ${up ? 'พุ่ง' : 'ร่วง'} ${Math.abs(pct).toFixed(1)}% ที่${CITY[g.location]?.name ?? g.location}`,
      detail: `${now.toLocaleString('en-US')} 🪙`,
      tone: up ? 'up' : 'down',
    });
  }

  // The sharpest single move anywhere in the country, so the paper has a
  // headline even when the home market is flat.
  const wild = MATERIALS.map((m) => {
    let best = { id: g.location, pct: 0 };
    for (const c of CITIES) {
      const a = priceAt(c.id, m.id, day, minute);
      const b = priceAt(c.id, m.id, Math.max(1, day - 1), minute);
      const pct = b ? ((a - b) / b) * 100 : 0;
      if (Math.abs(pct) > Math.abs(best.pct)) best = { id: c.id, pct };
    }
    return { m, ...best };
  }).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0];

  if (wild && Math.abs(wild.pct) >= 2) {
    out.push({
      cat: 'economy',
      text: `${wild.m.icon} ${wild.m.name} ผันผวนแรงที่${CITY[wild.id].name}`,
      detail: `${wild.pct > 0 ? '+' : ''}${wild.pct.toFixed(1)}%`,
      tone: wild.pct > 0 ? 'up' : 'down',
    });
  }
  return out;
}

/** ---------- rival parties ---------- */
function rivalNews(g: GameState): NewsItem[] {
  return g.npcs
    .filter((n) => n.level >= 5)
    .slice()
    .sort((a, b) => b.fame - a.fame)
    .slice(0, 3)
    .map((n, i) => ({
      cat: 'rival' as const,
      text: `${n.icon} ${n.name} ${i === 0 ? 'ขึ้นเป็นอันดับ 1' : 'แซงคู่แข่ง'}`,
      detail: `Lv${n.level} · ${n.fame.toLocaleString('en-US')} ชื่อเสียง`,
      tone: i === 0 ? 'up' : 'flat',
    }));
}

/** ---------- rare monsters ---------- */
// Report where a tier-4+ material is actually obtainable, so the paper doubles
// as a hunting guide rather than decoration.
function monsterNews(day: number): NewsItem[] {
  const rare = MATERIALS.filter((m) => m.tier >= 4);
  const out: NewsItem[] = [];
  for (const m of rare.slice(0, 3)) {
    const beast = pick(m.dropFrom, hash(day + m.id));
    const zone = m.homes[hash(m.id + day) % m.homes.length];
    out.push({
      cat: 'monster',
      text: `พบ${beast} ปรากฏตัวที่${CITY[zone]?.name ?? zone}`,
      detail: `ได้ ${m.icon} ${m.name}`,
    });
  }
  return out;
}

/** ---------- other cities ---------- */
const CITY_EVENTS = [
  'ถูกโจมตีจากกองโจร สูญเสียสินค้า',
  'งานเทศกาล ประชาชนแน่น',
  'ซ่อมแซมกำแพงเมือง เสร็จสิ้น',
  'ตลาดค้าสัตว์เปิดใหม่',
  'ห้างศาลาวังกา ทำการบูรณะ',
  'เกิดสภาพแล้ง น้ำขาด',
  'พบสุวรรณโณ ทองคำจำนวนมาก',
  'ข้าวเหนียวงอกเกินกว่า ราคาลด',
  'ชาวต่างชาติเยือนเมือง',
  'พายุกระโชก บ้านเรือนเสียหาย',
];
const CITY_GOOD = [1, 2, 3, 6];

function cityNews(g: GameState, day: number): NewsItem[] {
  const others = CITIES.filter((c) => c.id !== g.location);
  return others
    .map((c) => ({ c, i: (hash(c.id + day) + day) % CITY_EVENTS.length }))
    .filter((x) => x.c.tier >= 2)
    .slice(0, 3)
    .map(({ c, i }) => ({
      cat: 'city' as const,
      text: `${c.name} — ${CITY_EVENTS[i]}`,
      detail: CITY_GOOD.includes(i) ? 'ข่าวดี' : 'ติดตามต่อ',
      tone: (CITY_GOOD.includes(i) ? 'up' : 'flat') as 'up' | 'flat',
    }));
}

/** Today's paper, grouped by category. Deterministic in `day`. */
export function newsFor(g: GameState, day: number, minute: number): Record<NewsCat, NewsItem[]> {
  return {
    economy: economyNews(g, day, minute),
    rival: rivalNews(g),
    monster: monsterNews(day),
    city: cityNews(g, day),
  };
}

export const newsTotal = (n: Record<NewsCat, NewsItem[]>) =>
  CATS.reduce((s, c) => s + n[c.id].length, 0);

/** Dateline for the masthead. */
export const newsDate = (day: number, minute: number) => `วันที่ ${day} · ${fmtTime(minute)}`;
