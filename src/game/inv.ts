/**
 * Inventory helpers.
 *
 * The inventory is a plain `Record<string, number>` so the item catalogue can
 * grow to 400-500 entries without touching a single type definition.
 *
 * Because the project does NOT enable `noUncheckedIndexedAccess`, TypeScript
 * types `inv.potion` as `number` even when the key is absent (it is actually
 * `undefined`). Reading raw is therefore a silent bug waiting to happen —
 * every read in the codebase goes through `count()` instead.
 */

export type Inventory = Record<string, number>;

/** Stackable item ids the game itself grants or consumes. */
export const POTION = 'potion';
export const HIPOTION = 'hipotion';
export const ETHER = 'ether';
export const PHOENIX = 'phoenix';

/** How many of `id` the party holds. Safe for keys that are not present. */
export const count = (inv: Inventory, id: string): number => inv[id] ?? 0;

/** Add `n` (default 1). Negative values subtract; floors at 0. */
export function add(inv: Inventory, id: string, n = 1): void {
  const next = (inv[id] ?? 0) + n;
  if (next > 0) inv[id] = next;
  else delete inv[id];
}

/** Remove up to `n`; returns how many were actually taken. Never goes negative. */
export function take(inv: Inventory, id: string, n = 1): number {
  const have = inv[id] ?? 0;
  const got = Math.min(have, Math.max(0, n));
  if (got <= 0) return 0;
  const left = have - got;
  if (left > 0) inv[id] = left;
  else delete inv[id];
  return got;
}

export const has = (inv: Inventory, id: string, n = 1): boolean => (inv[id] ?? 0) >= n;

/** Total distinct stacks held — used for the bag summary. */
export const kinds = (inv: Inventory): number => Object.keys(inv).length;

/** Total individual items held. */
export const total = (inv: Inventory): number =>
  Object.values(inv).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);

/** Drop zero/NaN/negative entries. Keeps saves and clones tidy. */
export function prune(inv: Inventory): void {
  for (const k of Object.keys(inv)) {
    const v = inv[k];
    if (!Number.isFinite(v) || v <= 0) delete inv[k];
  }
}
