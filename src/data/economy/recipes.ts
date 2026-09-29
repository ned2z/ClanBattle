/**
 * Crafting recipes.
 *
 * Crafting is what gives harvested materials a purpose beyond selling. Until
 * this existed the economy loop was: kill -> material -> sell -> repeat, and
 * the only sink for gold was gear you could simply buy.
 *
 * Power model: shop gear of tier T has atk = 5T^2+3 (see data.ts). A crafted
 * piece uses the same curve multiplied by the material's statMul, so a
 * dragon-tier weapon lands around 2x a bought tier-5. That gap is the reward
 * for farming rare monsters rather than shopping.
 *
 * Gold cost is derived from the material value consumed, so rebalancing
 * material prices automatically rebalances crafting here too.
 */

import type { Stats } from '../../game/types';
import { MATERIAL, type Material } from './materials';

export interface Recipe {
  id: string;
  name: string;
  icon: string;
  /** Unused for consumable recipes, which produce no equipment. */
  slot?: 'weapon' | 'armor' | 'acc';
  /** Base rarity tier of the result, before RARITY multipliers. */
  tier: number;
  rarity: number;
  /** Materials consumed, by id. */
  cost: Record<string, number>;
  /** Shop markup on consumed material value — the smith's cut. */
  goldMul: number;
  /**
   * Consumable recipes fill an existing inventory stack (e.g. potions) and
   * produce no equipment. Ties crafting back to the battle auto-use system
   * instead of inventing a parallel item pipeline.
   */
  output?: { item: string; qty: number };
  /** Which stats the result grants, before scaling. Equipment recipes only. */
  bonus: Partial<Stats>;
  desc: string;
}

export const RECIPES: Recipe[] = [
  {
    id: 'c_iron_sword', name: 'ดาบเหล็ก', icon: '🗡️', slot: 'weapon', tier: 1, rarity: 0,
    cost: { iron: 8 }, goldMul: 0.5, bonus: { atk: 8, mag: 8 },
    desc: 'ดาบพื้นฐาน ตีจากเหล็กธรรมดา',
  },
  {
    id: 'c_silver_sword', name: 'ดาบเงิน', icon: '⚔️', slot: 'weapon', tier: 2, rarity: 1,
    cost: { silver: 4, iron: 4 }, goldMul: 0.4, bonus: { atk: 23, mag: 23 },
    desc: 'ขอบเงิน เจาะเกราะได้ดีกว่าดาบเหล็ก',
  },
  {
    id: 'c_dragon_sword', name: 'ดาบมังกร', icon: '🐉', slot: 'weapon', tier: 5, rarity: 2,
    cost: { dragonscale: 5, gold: 3 }, goldMul: 0.5, bonus: { atk: 128, mag: 128, crit: 8 },
    desc: 'ตีจากเกล็ดมังกร — แข็งแกร่งที่สุดในเกม',
  },
  {
    id: 'c_iron_armor', name: 'เกราะเหล็ก', icon: '🥋', slot: 'armor', tier: 1, rarity: 0,
    cost: { iron: 10 }, goldMul: 0.5, bonus: { def: 7, res: 7, hp: 25 },
    desc: 'เกราะหนังเหล็กพื้นฐาน',
  },
  {
    id: 'c_gold_armor', name: 'เกราทอง', icon: '🥇', slot: 'armor', tier: 3, rarity: 1,
    cost: { gold: 5, iron: 6 }, goldMul: 0.4, bonus: { def: 39, res: 39, hp: 225 },
    desc: 'เคลือบทองคำ ทนทานกว่าเกราะเหล็กมาก',
  },
  {
    id: 'c_dragon_armor', name: 'เกราะมังกร', icon: '🐲', slot: 'armor', tier: 5, rarity: 2,
    cost: { dragonscale: 5, shadowheart: 2 }, goldMul: 0.5, bonus: { def: 103, res: 103, hp: 625 },
    desc: 'เกล็ดมังกรเรียงซ้อน ป้องกันเหนือธรรมชาติ',
  },
  {
    id: 'c_herb_tonic', name: 'ยาสมุนไพรเข้ม', icon: '🧪', tier: 1, rarity: 0,
    cost: { herb: 3 }, goldMul: 0.3, bonus: {},
    output: { item: 'potion', qty: 2 },
    desc: 'ต้มยาสมุนไพร ได้ยาฟื้น HP 2 ขวด',
  },
  {
    id: 'c_wood_bow', name: 'ธนูไม้', icon: '🏹', slot: 'weapon', tier: 1, rarity: 0,
    cost: { wood: 6 }, goldMul: 0.5, bonus: { atk: 7, spd: 2 },
    desc: 'ธนูเบา ตีไวแต่หนักไม่มาก',
  },
  {
    id: 'c_hide_jerkin', name: 'เสื้อหนัง', icon: '🥾', slot: 'armor', tier: 1, rarity: 0,
    cost: { hide: 6 }, goldMul: 0.5, bonus: { def: 4, res: 5, spd: 2 },
    desc: 'เบาและคล่องตัว ป้องกันน้อยแต่วิ่งเร็ว',
  },
  {
    id: 'c_snake_armor', name: 'เกราะงู', icon: '🐍', slot: 'armor', tier: 2, rarity: 0,
    cost: { snakeskin: 5, hide: 3 }, goldMul: 0.4, bonus: { def: 19, res: 25, hp: 100 },
    desc: 'หนังงูยักษ์ ยืดหยุ่นกว่าเหล็ก',
  },
  {
    id: 'c_bone_amulet', name: 'ต่างหูกระดูก', icon: '🦴', slot: 'acc', tier: 3, rarity: 1,
    cost: { bone: 3 }, goldMul: 0.4, bonus: { mag: 30, mp: 30 },
    desc: 'กระดูกวิญญาณ ขยายพลังเวท',
  },
  {
    id: 'c_tiger_boots', name: 'รองเท้าเสือ', icon: '🐅', slot: 'acc', tier: 4, rarity: 1,
    cost: { tigerhide: 3 }, goldMul: 0.4, bonus: { spd: 9, crit: 10 },
    desc: 'หนังเสือสมิง วิ่งเร็วจนตามไม่ทัน',
  },
  {
    id: 'c_ivory_plate', name: 'เกราะงาช้าง', icon: '🐘', slot: 'armor', tier: 4, rarity: 1,
    cost: { ivory: 4, iron: 6 }, goldMul: 0.4, bonus: { def: 67, res: 51, hp: 400 },
    desc: 'งาช้างศึก หนักแต่กันดักฟัน',
  },
  {
    id: 'c_silver_ring', name: 'แหวนเงิน', icon: '💍', slot: 'acc', tier: 2, rarity: 0,
    cost: { silver: 3 }, goldMul: 0.4, bonus: { spd: 5, crit: 6, mp: 20 },
    desc: 'เพิ่มความเร็วและคริติก',
  },
  {
    id: 'c_dragon_crown', name: 'มงกุฎมังกร', icon: '👑', slot: 'acc', tier: 5, rarity: 2,
    cost: { dragonscale: 6, shadowheart: 2 }, goldMul: 0.5, bonus: { spd: 11, crit: 15, mp: 50, atk: 40 },
    desc: 'เครื่องประดับระดับสูงสุด',
  },
];

export const RECIPE: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

/** Gold the smith charges, derived from what the materials are worth. */
export function goldCost(r: Recipe): number {
  const matValue = Object.entries(r.cost).reduce((s, [id, n]) => s + (MATERIAL[id]?.value ?? 0) * n, 0);
  return Math.max(1, Math.round(matValue * r.goldMul));
}

/** Stat bonus of the crafted item, scaled by its primary material. */
export function bonusOf(r: Recipe): Partial<Stats> {
  // Consumable recipes produce no equipment, so they have no stat block.
  if (r.output) return {};
  // Use the most valuable material in the recipe as the scaling driver.
  const main = Object.entries(r.cost)
    .map(([id, n]) => ({ mat: MATERIAL[id], v: (MATERIAL[id]?.value ?? 0) * n }))
    .sort((a, b) => b.v - a.v)[0];
  const mul = main?.mat ? (1 + (main.mat.statMul - 1) * 0.5) : 1;
  const out: Partial<Stats> = {};
  for (const [k, v] of Object.entries(r.bonus)) {
    out[k as keyof Stats] = Math.round((v as number) * mul);
  }
  return out;
}

/** Main material id, for the "needs X" line in the UI. */
export const mainMaterial = (r: Recipe): Material | undefined => {
  const id = Object.entries(r.cost)
    .sort((a, b) => (MATERIAL[b[0]]?.value ?? 0) * b[1] - (MATERIAL[a[0]]?.value ?? 0) * a[1])[0]?.[0];
  return id ? MATERIAL[id] : undefined;
};
