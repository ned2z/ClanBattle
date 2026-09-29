/**
 * Crafting materials — the backbone of the economy.
 *
 * Design rule: materials CANNOT be bought outright. They are dropped by
 * monsters in a specific region, so gold alone can never replace exploring.
 * The town they are "home" to sells them cheap; everywhere else is dearer,
 * which is what makes travelling worthwhile.
 *
 * 12 rows here expand into hundreds of gear variants later via the
 * archetype x material cross product, so this file stays small on purpose.
 */

export interface Material {
  id: string;
  name: string;
  icon: string;
  /** 1-5. Gates which gear tier may use it and which enemies can drop it. */
  tier: number;
  /** Baseline value in gold per unit, before any city or time modifier. */
  value: number;
  /** Stat multiplier applied to gear crafted from this material. */
  statMul: number;
  /** Enemy NAMES (ENEMIES has no ids) that can drop this. */
  dropFrom: string[];
  /** Chance per enemy killed, 0-1. */
  dropRate: number;
  /** Cities where this is plentiful -> sold at a discount. */
  homes: string[];
  region: 'north' | 'central' | 'northeast' | 'east' | 'south';
}

export const MATERIALS: Material[] = [
  {
    id: 'wood', name: 'ไม้', icon: '🪵', tier: 1, value: 12, statMul: 1.0,
    dropFrom: ['โจรป่า', 'หมาป่าสงคราม'], dropRate: 0.45,
    homes: ['lpg', 'nan', 'skt', 'loei'], region: 'north',
  },
  {
    id: 'hide', name: 'หนังสัตว์', icon: '🟤', tier: 1, value: 16, statMul: 1.0,
    dropFrom: ['หมาป่าสงคราม', 'เสือสมิง'], dropRate: 0.4,
    homes: ['lpg', 'loei', 'cm', 'cr'], region: 'north',
  },
  {
    id: 'herb', name: 'ยาสมุนไพร', icon: '🌿', tier: 1, value: 30, statMul: 1.05,
    dropFrom: ['ผีกระสือ', 'โจรป่า'], dropRate: 0.35,
    homes: ['cm', 'lpg', 'bkk', 'pat'], region: 'north',
  },
  {
    id: 'iron', name: 'เหล็กธรรมดา', icon: '🔩', tier: 1, value: 22, statMul: 1.1,
    dropFrom: ['โจรป่า', 'ทหารหนีทัพ', 'รถถังร้าง'], dropRate: 0.3,
    homes: ['skt', 'ns', 'ayu', 'bkk'], region: 'central',
  },
  {
    id: 'silver', name: 'เงิน', icon: '🥈', tier: 2, value: 45, statMul: 1.2,
    dropFrom: ['ทหารหนีทัพ', 'ยักษ์วัดแจ้ง', 'ผีกระสือ'], dropRate: 0.22,
    homes: ['ayu', 'bkk', 'kan', 'ns'], region: 'central',
  },
  {
    id: 'snakeskin', name: 'หนังงูยักษ์', icon: '🐍', tier: 2, value: 90, statMul: 1.25,
    dropFrom: ['งูจงอางยักษ์'], dropRate: 0.4,
    homes: ['loei', 'ud', 'kk', 'kr'], region: 'northeast',
  },
  {
    id: 'bone', name: 'กระดูกวิญญาณ', icon: '🦴', tier: 3, value: 140, statMul: 1.3,
    dropFrom: ['แม่ทัพวิญญาณ', 'ผีกระสือ', 'ปอบ'], dropRate: 0.3,
    homes: ['nan', 'cr', 'skt'], region: 'north',
  },
  {
    id: 'gold', name: 'ทองคำ', icon: '🥇', tier: 3, value: 180, statMul: 1.4,
    dropFrom: ['ยักษ์วัดแจ้ง', 'รถถังร้าง', 'แม่ทัพวิญญาณ'], dropRate: 0.18,
    homes: ['bkk', 'kr', 'brm'], region: 'central',
  },
  {
    id: 'tigerhide', name: 'หนังเสือสมิง', icon: '🐅', tier: 4, value: 520, statMul: 1.55,
    dropFrom: ['เสือสมิง'], dropRate: 0.3,
    homes: ['sur', 'nst', 'kbi'], region: 'south',
  },
  {
    id: 'ivory', name: 'งาช้างศึก', icon: '🐘', tier: 4, value: 600, statMul: 1.6,
    dropFrom: ['ช้างศึกคลั่ง'], dropRate: 0.28,
    homes: ['ud', 'ub', 'npm', 'kk'], region: 'northeast',
  },
  {
    id: 'dragonscale', name: 'เกล็ดมังกร', icon: '🐉', tier: 5, value: 2400, statMul: 2.0,
    dropFrom: ['พญานาคพิโรธ'], dropRate: 0.35,
    homes: ['cr', 'cm'], region: 'north',
  },
  {
    id: 'shadowheart', name: 'หัวใจเงาดำ', icon: '💀', tier: 5, value: 3100, statMul: 2.1,
    dropFrom: ['แม่ทัพวิญญาณ', 'พญานาคพิโรธ'], dropRate: 0.22,
    homes: ['cr', 'nan', 'bkk'], region: 'north',
  },
];

export const MATERIAL: Record<string, Material> = Object.fromEntries(MATERIALS.map((m) => [m.id, m]));

/** Cheap generic lookups, kept in game/ so UI code never imports data/ directly. */
export const materialList = () => MATERIALS;
export const materialOf = (id: string): Material | undefined => MATERIAL[id];

/** Materials this city is a home for — what its market board leads with. */
export const localMaterials = (cityId: string): Material[] => MATERIALS.filter((m) => m.homes.includes(cityId));

/** Every material a given enemy can drop, with its rate. */
export const dropsOf = (enemyName: string): { mat: Material; rate: number }[] =>
  MATERIALS.filter((m) => m.dropFrom.includes(enemyName)).map((mat) => ({ mat, rate: mat.dropRate }));
