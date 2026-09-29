/**
 * Crafting.
 *
 * Kept in game/ so components never reach into data/ for rules — the same
 * layering the rest of the codebase uses.
 */

import { RECIPE, bonusOf, goldCost, type Recipe } from '../../data/economy/recipes';
import { add as addItem, count, take } from '../inv';
import { makeEquip, uid } from '../engine';
import type { EquipItem, GameState } from '../types';

export interface CraftCheck {
  ok: boolean;
  /** Materials that are short, by id. */
  missing: { id: string; need: number; have: number }[];
  goldNeed: number;
  goldOk: boolean;
}

/** Can this party craft the recipe right now? */
export function canCraft(g: GameState, recipeId: string): CraftCheck {
  const r = RECIPE[recipeId];
  if (!r) return { ok: false, missing: [], goldNeed: 0, goldOk: false };
  const missing = Object.entries(r.cost)
    .map(([id, need]) => ({ id, need, have: count(g.inv, id) }))
    .filter((x) => x.have < x.need);
  const goldNeed = goldCost(r);
  const goldOk = g.gold >= goldNeed;
  return { ok: missing.length === 0 && goldOk, missing, goldNeed, goldOk };
}

/**
 * Consume the materials and produce the result. Call only after canCraft() —
 * this deliberately does not re-verify, so a stale check cannot overdraw.
 *
 * Equipment recipes push onto the bag; consumable recipes top up an existing
 * inventory stack, which is what lets crafting feed the battle auto-use loop
 * instead of inventing a parallel item pipeline.
 */
export function craft(g: GameState, recipeId: string): EquipItem | null {
  const r = RECIPE[recipeId];
  if (!r) return null;
  for (const [id, n] of Object.entries(r.cost)) take(g.inv, id, n);
  g.gold -= goldCost(r);

  if (r.output) {
    addItem(g.inv, r.output.item, r.output.qty);
    return null;
  }

  const item = makeEquip(
    {
      iid: '', id: recipeId, name: r.name, icon: r.icon, slot: r.slot ?? 'weapon', tier: r.tier,
      rarity: r.rarity, bonus: bonusOf(r), price: goldCost(r) * 3,
    },
    r.rarity,
  );
  // makeEquip stamps its own iid, but keep this explicit so the guarantee that
  // every bag entry is unique stays visible at the call site.
  item.iid = uid('i');
  g.bag.push(item);
  return item;
}

export const allRecipes = (): Recipe[] => Object.values(RECIPE);
