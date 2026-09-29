/**
 * Market pricing.
 *
 * price = base x cityBias x dayWave x hourMod
 *
 * Every layer is a pure function of its inputs, so a price can be recomputed
 * at any moment without storing it, and 30 days of history costs nothing to
 * display. Changing one constant rebalances the whole economy at once.
 */

import { MATERIAL, MATERIALS, type Material } from '../../data/economy/materials';
import { CITIES, CITY } from '../data';
import { hourMod } from '../time';
import { hash, rand, wave01 } from './prng';

/** How cheap a material sells in the cities that produce it. */
export const HOME_DISCOUNT = 0.72;
/** How dear it is everywhere else. */
export const AWAY_PREMIUM = 1.18;
/**
 * Stable per-city personality, so no two markets feel identical.
 *
 * Must stay under the break-even of 0.0956. The worst case is buying in a
 * stingy home city and selling in a generous away city:
 *   HOME*(1+F)*MARKUP  vs  AWAY*(1-F)*SELL
 * At F=0.12 that pairing loses 4.8% and a legitimately good route looks
 * unprofitable. F=0.06 keeps the floor at +7.4% while the typical route
 * still nets ~21%, so the location spread stays the dominant signal.
 */
const CITY_FLAVOUR = 0.06;
/** Day-over-day drift, small enough that location still matters most. */
const DAY_SPREAD = 0.10;

/**
 * What a merchant pays you, and what they charge.
 *
 * These are deliberately NOT the same as the equipment sell-back in PartyMenu
 * (0.40). Equipment is loot you may want to dump, so a fat haircut is fine.
 * Materials are a traded commodity, and the arbitrage only works if the sell
 * rate clears HOME_DISCOUNT * BUY_MARKUP / AWAY_PREMIUM = 0.702. At 0.85 a
 * home->away run nets ~21%; at 0.40 it loses 43% and no route in the entire
 * game is profitable. Same-city buy/sell still costs 26%, so no free money.
 */
export const SELL_RATE = 0.85;
export const BUY_MARKUP = 1.15;

/**
 * City bias: cheap where the material is produced, dear elsewhere, plus a
 * small fixed per-city personality so no two markets feel identical.
 */
export function cityBias(cityId: string, matId: string): number {
  const mat = MATERIAL[matId];
  if (!mat) return 1;
  const region = mat.homes.includes(cityId) ? HOME_DISCOUNT : AWAY_PREMIUM;
  const flavour = (rand(hash(cityId), -CITY_FLAVOUR, CITY_FLAVOUR, hash(matId)) + 1) / 2 * 2 - 1;
  return region * (1 + flavour);
}

/**
 * Slow wave across days.
 *
 * Deliberately keyed on the MATERIAL only, not the city. With a per-city wave,
 * a buy in one town and a sell in another could land on opposite troughs, so a
 * route that should net +21% would sometimes show a loss — punishing the player
 * for a difference they cannot see or control. Sharing the wave makes it
 * cancel across a trade, so the location spread stays the one honest signal:
 * this town produces it, that town wants it. It also reads better on a chart,
 * where every city rises and falls together like a real market.
 */
export function dayWave(matId: string, day: number): number {
  const w = wave01(hash(matId), day);
  return 1 + DAY_SPREAD * w;
}

/**
 * Today's price for a material in a city — what the player actually pays or
 * receives. Rounded so the UI never shows a fractional coin.
 */
export function priceAt(cityId: string, matId: string, day: number, minute: number): number {
  const mat = MATERIAL[matId];
  if (!mat) return 0;
  const raw = mat.value * cityBias(cityId, matId) * dayWave(matId, day) * hourMod(minute);
  return Math.max(1, Math.round(raw));
}

/** What a shop charges to buy one unit. */
export const buyPrice = (cityId: string, matId: string, day: number, minute: number): number =>
  Math.max(1, Math.round(priceAt(cityId, matId, day, minute) * BUY_MARKUP));

/** What a shop pays to take one unit off you. */
export const sellPrice = (cityId: string, matId: string, day: number, minute: number): number =>
  Math.max(1, Math.round(priceAt(cityId, matId, day, minute) * SELL_RATE));

/**
 * A slice of history ending on the given day, for the price chart.
 * Oldest first, so it can be drawn left to right.
 */
export function priceHistory(cityId: string, matId: string, day: number, minute: number, days = 30): number[] {
  const out: number[] = [];
  for (let d = day - days + 1; d <= day; d++) out.push(priceAt(cityId, matId, Math.max(1, d), minute));
  return out;
}

export interface PriceStats {
  min: number; max: number; avg: number; current: number;
  /** Percent change across the window, e.g. -3.1 or +8.2. */
  change: number;
}

export function statsOf(series: number[]): PriceStats {
  if (!series.length) return { min: 0, max: 0, avg: 0, current: 0, change: 0 };
  const min = Math.min(...series), max = Math.max(...series);
  const avg = Math.round(series.reduce((s, v) => s + v, 0) / series.length);
  const first = series[0], last = series[series.length - 1];
  return { min, max, avg, current: last, change: first ? +(((last - first) / first) * 100).toFixed(1) : 0 };
}

/** Percentage change between two consecutive days — the sparkline's colour. */
export const trend = (series: number[]): number => {
  if (series.length < 2) return 0;
  const a = series[series.length - 2], b = series[series.length - 1];
  return a ? +(((b - a) / a) * 100).toFixed(1) : 0;
};

/** All materials this city will trade, cheapest first. */
export function marketOf(cityId: string): (Material & { price: number; buy: number; sell: number; local: boolean })[] {
  const city = CITY[cityId];
  const maxTier = city ? Math.min(5, 1 + Math.floor(city.tier / 1.7)) : 1;
  return MATERIALS
    .filter((m) => m.tier <= Math.max(1, maxTier) || m.homes.includes(cityId))
    .map((m) => ({
      ...m,
      price: priceAt(cityId, m.id, 1, 0),
      buy: buyPrice(cityId, m.id, 1, 0),
      sell: sellPrice(cityId, m.id, 1, 0),
      local: m.homes.includes(cityId),
    }));
}

/** Every city id, for the "cheapest place to buy this" hint. */
export const allCityIds = (): string[] => CITIES.map((c) => c.id);
