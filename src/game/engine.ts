import {
  BASE_ULT, CITIES, CITY, CITY_INFO, CLASS2, CLASS2_OF, CLASSES, CLASS_IDS, COMMON_SKILLS, EDGES, ENEMIES, EQUIPS, MEMBER_NAMES, NODE, NODES, NPC_SEED, RARITY, SKILL, SKILL_RARITY,
} from './data';
import { ETHER, HIPOTION, PHOENIX, POTION, count, has as hasItem, take } from './inv';
import type {
  ActionEvent, ClassId, EnemyGroup, EquipItem, GameState, HitResult, Member, NpcParty, Quest, Skill, Stats, Status, StatusType, Unit,
} from './types';

export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const rint = (a: number, b: number) => Math.floor(rnd(a, b + 1));
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const shuffle = <T,>(arr: T[]) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
let _id = 0;
export const uid = (p = 'u') => `${p}${Date.now().toString(36)}${(_id++).toString(36)}`;

// ---------- Members ----------
export function rollSkillRarity(): number {
  let r = Math.random() * 100;
  for (let i = SKILL_RARITY.length - 1; i >= 1; i--) { if ((r -= SKILL_RARITY[i].chance) < 0) return i; }
  return 0;
}
export function randomCommon(exclude: string[] = [], n = 2) {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    let rar = rollSkillRarity();
    let pool: string[] = [];
    while (rar >= 0) { pool = COMMON_SKILLS.filter((s) => (SKILL[s].rarity ?? 0) === rar && !exclude.includes(s) && !out.includes(s)); if (pool.length) break; rar--; }
    if (!pool.length) pool = COMMON_SKILLS.filter((s) => !exclude.includes(s) && !out.includes(s));
    out.push(pick(pool));
  }
  return out;
}

export function makeMember(cls: ClassId, name?: string, level = 1): Member {
  const def = CLASSES[cls];
  const extra = randomCommon([], 2);
  const m: Member = {
    id: uid('m'), name: name ?? pick(MEMBER_NAMES), cls, level, xp: 0, sp: 2, hp: 1, mp: 1,
    skills: [...def.skills, ...extra].map((id) => ({ id, enabled: true, level: 1 })),
    tactic: 'balanced', targeting: cls === 'rogue' ? 'lowest' : 'random', healAt: 0.6, equip: {},
  };
  const s = memberStats(m);
  m.hp = s.hp; m.mp = s.mp;
  return m;
}

export function memberStats(m: Member): Stats {
  const d = CLASSES[m.cls];
  const L = m.level - 1;
  const s: Stats = { hp: 0, mp: 0, atk: 0, mag: 0, def: 0, res: 0, spd: 0, crit: 0 };
  const c2 = m.cls2 ? CLASS2[m.cls2] : null;
  (Object.keys(s) as (keyof Stats)[]).forEach((k) => { s[k] = Math.round((d.base[k] + d.growth[k] * L) * ((c2?.mul[k] as number) ?? 1)); });
  for (const e of Object.values(m.equip)) if (e) for (const [k, v] of Object.entries(e.bonus)) s[k as keyof Stats] += v as number;
  return s;
}

/** Skill scaled by its level (1-5). */
export function scaledSkill(s: Skill, lv = 1): Skill {
  if (lv <= 1) return s;
  const k = 1 + 0.15 * (lv - 1);
  return {
    ...s,
    power: +(s.power * k).toFixed(3),
    cd: lv >= 4 ? Math.max(1, s.cd - 1) : s.cd,
    effects: s.effects?.map((e) => ({ ...e, chance: Math.min(1, e.chance + 0.05 * (lv - 1)), value: e.value !== undefined ? +(e.value * (1 + 0.08 * (lv - 1))).toFixed(3) : undefined })),
    revive: s.revive ? Math.min(0.9, s.revive + 0.1 * (lv - 1)) : s.revive,
  };
}
export const MAX_SKILL_LV = 5;
export const skillUpCost = (lv: number) => lv;

export function makeEquip(tpl: EquipItem, rarity = 0): EquipItem {
  const r = RARITY[rarity];
  const bonus: EquipItem['bonus'] = {};
  for (const [k, v] of Object.entries(tpl.bonus)) bonus[k as keyof Stats] = Math.round((v as number) * r.mult);
  if (rarity >= 2) { const extra = pick(['atk', 'def', 'spd', 'crit', 'hp'] as (keyof Stats)[]); bonus[extra] = (bonus[extra] ?? 0) + (extra === 'hp' ? 40 * tpl.tier : extra === 'crit' || extra === 'spd' ? 2 + tpl.tier : 4 * tpl.tier); }
  return { ...tpl, iid: uid('i'), rarity, bonus, name: r.prefix + tpl.name, price: Math.round(tpl.price * r.mult) };
}
export function randomDrop(level: number, bonusRare = 0): EquipItem {
  const tier = Math.max(1, Math.min(5, Math.ceil((level + rint(-2, 2)) / 5)));
  const tpl = pick(EQUIPS.filter((e) => e.tier === tier));
  const roll = Math.random() + bonusRare;
  return makeEquip(tpl, roll > 0.93 ? 2 : roll > 0.65 ? 1 : 0);
}

export const xpNeed = (lvl: number) => Math.round(40 + lvl * 32 + lvl * lvl * 4);

export function partyLevel(g: GameState) {
  return Math.round(g.members.reduce((a, m) => a + m.level, 0) / g.members.length);
}
export const hasMerchant = (g: GameState) => g.members.some((m) => m.cls === 'merchant');
export const priceOf = (g: GameState, p: number) => Math.round(p * (hasMerchant(g) ? 0.85 : 1));

// ---------- Map ----------
const ADJ: Record<string, { to: string; d: number }[]> = {};
for (const c of NODES) ADJ[c.id] = [];
for (const [a, b] of EDGES) {
  const d = Math.hypot(NODE[a].x - NODE[b].x, NODE[a].y - NODE[b].y);
  ADJ[a].push({ to: b, d }); ADJ[b].push({ to: a, d });
}
export function findPath(from: string, to: string): string[] {
  const dist: Record<string, number> = {}; const prev: Record<string, string | null> = {};
  const q = new Set(NODES.map((c) => c.id));
  for (const c of q) { dist[c] = Infinity; prev[c] = null; }
  dist[from] = 0;
  while (q.size) {
    let u = ''; let best = Infinity;
    for (const c of q) if (dist[c] < best) { best = dist[c]; u = c; }
    if (!u) break;
    q.delete(u);
    if (u === to) break;
    for (const { to: v, d } of ADJ[u]) if (dist[u] + d < dist[v]) { dist[v] = dist[u] + d; prev[v] = u; }
  }
  const path: string[] = []; let c: string | null = to;
  while (c) { path.unshift(c); c = prev[c]; }
  return path[0] === from ? path : [from];
}
export const segLen = (a: string, b: string) => Math.hypot(NODE[a].x - NODE[b].x, NODE[a].y - NODE[b].y);
export const neighbors = (id: string) => ADJ[id].map((e) => e.to);
export const pathLen = (p: string[]) => p.slice(1).reduce((s, c, i) => s + segLen(p[i], c), 0);
export const TRAVEL_SPEED = 6.4; // map units per second

// ---------- NPC ----------
export function makeNpcs(): NpcParty[] {
  return NPC_SEED.map((n) => ({
    id: uid('n'), name: n.name, icon: n.icon, color: n.color, level: n.level, fame: n.fame,
    classes: shuffle(CLASS_IDS).slice(0, n.level > 15 ? 4 : n.level > 6 ? 3 : 3) as ClassId[],
  }));
}

// ---------- Units ----------
export function memberToUnit(m: Member): Unit {
  const s = memberStats(m);
  const c = CLASSES[m.cls];
  return {
    uid: m.id, memberId: m.id, name: m.name, icon: c.icon, cls: m.cls, color: c.color, side: 'ally', level: m.level,
    maxHp: s.hp, hp: Math.min(m.hp, s.hp), maxMp: s.mp, mp: Math.min(m.mp, s.mp),
    atk: s.atk, mag: s.mag, def: s.def, res: s.res, spd: s.spd, crit: s.crit,
    statuses: [], cds: {}, skills: m.skills.map((x) => ({ ...x })), tactic: m.tactic, targeting: m.targeting, healAt: m.healAt,
    atb: rnd(0, 30), alive: m.hp > 0,
    ult: rnd(0, 25), ultId: m.cls2 ? CLASS2[m.cls2].ult : BASE_ULT[m.cls], cls2: m.cls2,
  };
}

function npcUnit(cls: ClassId, level: number, name: string): Unit {
  const m = makeMember(cls, name, level);
  if (level >= 12) m.cls2 = pick(CLASS2_OF[cls]);
  // NPC gear scales with level
  const t = Math.min(5, Math.max(0, Math.floor(level / 5)));
  const u = memberToUnit(m);
  u.uid = uid('e'); u.memberId = undefined; u.side = 'enemy';
  const boost = (1 + t * 0.1) * 0.82;
  u.maxHp = Math.round(u.maxHp * boost); u.hp = u.maxHp; u.maxMp = Math.round(u.maxMp * 1.2); u.mp = u.maxMp;
  u.atk = Math.round(u.atk * boost); u.mag = Math.round(u.mag * boost); u.def = Math.round(u.def * boost); u.res = Math.round(u.res * boost);
  u.skills = u.skills.map((sl) => ({ ...sl, level: Math.min(5, 1 + Math.floor(level / 7)) }));
  u.alive = true;
  return u;
}

export function monsterUnit(level: number, tier: number): Unit {
  const pool = ENEMIES.filter((e) => e.minTier <= tier);
  const t = pick(pool.slice(-6));
  const L = level;
  const u: Unit = {
    uid: uid('e'), name: t.name, icon: t.icon, color: '#ef4444', side: 'enemy', level: L,
    maxHp: Math.round((50 + 20 * L) * t.hp), hp: 0, maxMp: 40 + L * 4, mp: 0,
    atk: Math.round((11 + 3.1 * L) * t.atk), mag: Math.round((11 + 3.1 * L) * t.mag),
    def: Math.round((7 + 1.8 * L) * t.def), res: Math.round((7 + 1.8 * L) * t.res),
    spd: Math.round((8 + 0.9 * L) * t.spd), crit: 5,
    statuses: [], cds: {}, skills: t.skills.map((id) => ({ id, enabled: true, level: Math.min(5, 1 + Math.floor(L / 8)) })), tactic: 'balanced', targeting: 'random', healAt: 0.5,
    atb: rnd(0, 30), alive: true, weak: t.weak as Unit['weak'], ult: 0,
  };
  u.hp = u.maxHp; u.mp = u.maxMp;
  return u;
}

export function routeTier(a: string, b: string) { return (NODE[a].tier + NODE[b].tier) / 2; }

export function makeEncounter(g: GameState, tier: number, forceNpc?: string): EnemyGroup {
  const pl = partyLevel(g);
  const baseLvl = Math.max(1, Math.round(tier * 2.2 - 1.5 + rnd(-1, 1.2)));
  const lvl = Math.max(1, Math.min(Math.round(baseLvl * 0.85 + pl * 0.15), pl + (g.stats.battles < 3 ? 2 : 4)));
  const bountyIds = g.quests.filter((q) => q.type === 'bounty').map((q) => q.targetParty);
  let npc: NpcParty | undefined;
  if (forceNpc) npc = g.npcs.find((n) => n.id === forceNpc);
  else if (g.stats.battles >= 2 && Math.random() < 0.3) {
    const bounty = g.npcs.filter((n) => bountyIds.includes(n.id));
    if (bounty.length && Math.random() < 0.6) npc = pick(bounty);
    else {
      const ok = g.npcs.filter((n) => n.level <= pl + 2);
      const sorted = (ok.length ? ok : [...g.npcs].sort((a, b) => a.level - b.level).slice(0, 1)).sort((a, b) => Math.abs(a.level - lvl) - Math.abs(b.level - lvl));
      npc = pick(sorted.slice(0, 2));
    }
  }
  if (npc) {
    const units = npc.classes.map((c, i) => {
      const u = npcUnit(c, npc!.level + (i === 0 ? 1 : 0), `${CLASSES[c].short}${i + 1}`);
      u.color = npc!.color; u.tactic = 'aggressive';
      return u;
    });
    return { units, npcId: npc.id, title: `${npc.icon} ปาร์ตี้ "${npc.name}"`, level: npc.level };
  }
  const n = g.stats.battles < 2 ? 2 : Math.min(4, (tier < 2 ? rint(2, 3) : rint(2, 3)) + (tier >= 5 && Math.random() < 0.4 ? 1 : 0));
  const units = Array.from({ length: n }, () => monsterUnit(Math.max(1, lvl + rint(-1, 0)), Math.ceil(tier)));
  return { units, title: '⚔ ศัตรูซุ่มโจมตี!', level: lvl };
}

// ---------- Quests ----------
export function makeCityQuests(g: GameState, cityId: string): Quest[] {
  const c = CITY[cityId];
  const t = c.tier;
  const out: Quest[] = [];
  const others = CITIES.filter((x) => x.id !== cityId);
  const mul = 1 + partyLevel(g) * 0.08;
  const xpMul = CITY_INFO[cityId]?.perk === 'xp' ? 1.5 : 1;
  const types = shuffle(['hunt', 'deliver', 'bounty', 'wins'] as const).slice(0, 3);
  for (const type of types) {
    const base = { id: uid('q'), type, progress: 0, from: cityId } as Quest;
    if (type === 'hunt') {
      const n = rint(4, 8);
      Object.assign(base, { title: `กวาดล้างศัตรู ${n} ตัว`, desc: 'กำจัดศัตรูใดก็ได้ระหว่างเดินทาง', target: n, rewardGold: Math.round((40 + n * 12 * t) * mul), rewardFame: 20 + n * 4 * t, rewardXp: 30 * t });
    } else if (type === 'deliver') {
      const d = pick(others);
      Object.assign(base, { title: `ส่งเสบียงไป ${d.name}`, desc: `นำเสบียงไปส่งที่ ${d.name}`, target: 1, targetCity: d.id, rewardGold: Math.round((60 + Math.round(segLen(cityId, d.id)) * 1.2 * (1 + t * 0.3)) * mul), rewardFame: 30 + d.tier * 12, rewardXp: 25 * d.tier });
    } else if (type === 'bounty') {
      const pl = partyLevel(g);
      const cand = [...g.npcs].sort((a, b) => Math.abs(a.level - (pl + 2)) - Math.abs(b.level - (pl + 2))).slice(0, 3);
      const n = pick(cand);
      Object.assign(base, { title: `ล่าค่าหัว "${n.name}"`, desc: `เอาชนะปาร์ตี้ ${n.icon} ${n.name} (Lv${n.level})`, target: 1, targetParty: n.id, rewardGold: Math.round((120 + n.level * 30) * mul), rewardFame: 80 + n.level * 12, rewardXp: 40 * n.level });
    } else {
      const n = rint(2, 4);
      Object.assign(base, { title: `ชนะศึก ${n} ครั้ง`, desc: 'ชนะการต่อสู้ใดก็ได้', target: n, rewardGold: Math.round((50 + n * 25 * t) * mul), rewardFame: 25 + n * 6 * t, rewardXp: 35 * t });
    }
    out.push(base);
  }
  out.forEach((q) => { q.rewardXp = Math.round(q.rewardXp * xpMul); });
  return out;
}

// ---------- Battle ----------
export interface BattleState { units: Unit[]; turn: number; over: null | 'win' | 'lose'; inv: GameState['inv']; settings: GameState['settings']; goldBonus: number; itemsUsed: number }

export function initBattle(g: GameState, enemies: Unit[]): BattleState {
  return {
    units: [...g.members.map(memberToUnit), ...enemies], turn: 0, over: null,
    inv: { ...g.inv }, settings: { ...g.settings }, goldBonus: 0, itemsUsed: 0,
  };
}

const stat = (u: Unit, k: 'atk' | 'mag' | 'def' | 'res' | 'spd') => {
  let v = u[k];
  const up = { atk: 'atkUp', mag: 'magUp', def: 'defUp', res: 'defUp', spd: 'spdUp' }[k] as StatusType;
  const dn = { atk: 'atkDown', mag: '', def: 'defDown', res: 'defDown', spd: 'spdDown' }[k];
  for (const s of u.statuses) { if (s.type === up) v *= 1 + s.value; if (s.type === dn) v *= 1 - s.value; }
  return Math.max(1, v);
};
const has = (u: Unit, t: StatusType) => u.statuses.find((s) => s.type === t);

function addStatus(u: Unit, type: StatusType, turns: number, value: number) {
  const ex = u.statuses.find((s) => s.type === type);
  if (ex) { ex.turns = Math.max(ex.turns, turns); ex.value = Math.max(ex.value, value); }
  else u.statuses.push({ type, turns, value });
}

const alive = (b: BattleState, side: 'ally' | 'enemy') => b.units.filter((u) => u.side === side && u.alive);

function checkOver(b: BattleState) {
  if (!alive(b, 'enemy').length) b.over = 'win';
  else if (!alive(b, 'ally').length) b.over = 'lose';
}

function chooseEnemyTarget(b: BattleState, actor: Unit): Unit {
  const foes = alive(b, actor.side === 'ally' ? 'enemy' : 'ally');
  const taunt = foes.find((f) => has(f, 'taunt'));
  if (taunt && Math.random() < 0.75) return taunt;
  if (actor.targeting === 'lowest') return foes.reduce((a, c) => (c.hp / c.maxHp < a.hp / a.maxHp ? c : a));
  if (actor.targeting === 'strongest') return foes.reduce((a, c) => (stat(c, 'atk') + stat(c, 'mag') > stat(a, 'atk') + stat(a, 'mag') ? c : a));
  return pick(foes);
}

function skillUsable(b: BattleState, u: Unit, s: Skill): boolean {
  if (u.mp < s.mp || (u.cds[s.id] ?? 0) > 0) return false;
  const allies = alive(b, u.side);
  if (s.target === 'deadAlly') return b.units.some((x) => x.side === u.side && !x.alive);
  if (s.kind === 'heal') {
    if (s.target === 'allies') return allies.filter((a) => a.hp / a.maxHp < u.healAt + 0.1).length >= 2 || allies.some((a) => a.hp / a.maxHp < u.healAt - 0.2) || (!!s.cleanse && allies.some((a) => a.statuses.some((x) => ['poison', 'burn', 'bleed', 'stun'].includes(x.type))));
    return allies.some((a) => a.hp / a.maxHp < u.healAt);
  }
  if (s.kind === 'buff') {
    const main = s.effects?.[0]?.type;
    if (!main) return true;
    if (s.target === 'self') return !has(u, main);
    return allies.filter((a) => !has(a, main)).length >= Math.min(2, allies.length);
  }
  if (s.kind === 'debuff') {
    const main = s.effects?.[0]?.type;
    const foes = alive(b, u.side === 'ally' ? 'enemy' : 'ally');
    return !!main && foes.some((f) => !has(f, main));
  }
  return true;
}

function calcDamage(a: Unit, d: Unit, s: Skill | null): HitResult {
  const r: HitResult = { uid: d.uid };
  const ev = has(d, 'evade');
  if (ev && Math.random() < ev.value) { r.miss = true; return r; }
  if (Math.random() < 0.04) { r.miss = true; return r; }
  const magic = s?.kind === 'mag';
  const power = s ? s.power : 1;
  const off = magic ? stat(a, 'mag') : stat(a, 'atk');
  let dv = magic ? stat(d, 'res') : stat(d, 'def');
  if (s?.pierce) dv *= 1 - s.pierce;
  let dmg = off * power * (70 / (70 + dv)) * rnd(0.9, 1.1) * 1.15;
  const crit = Math.random() * 100 < a.crit + (s?.critBonus ?? 0) + (magic ? 0 : 3);
  if (crit) { dmg *= 1.65; r.crit = true; }
  if (s && d.weak && s.element === d.weak) { dmg *= 1.4; r.weak = true; }
  dmg = Math.max(1, Math.round(dmg));
  const sh = has(d, 'shield');
  if (sh) {
    const abs = Math.min(sh.value, dmg);
    sh.value -= abs; dmg -= abs; r.shielded = abs;
    if (sh.value <= 0) d.statuses = d.statuses.filter((x) => x !== sh);
  }
  d.hp = Math.max(0, d.hp - dmg);
  r.dmg = dmg;
  if (d.hp <= 0) { d.alive = false; d.statuses = []; r.killed = true; d.atb = 0; }
  return r;
}

function applyEffects(s: Skill, caster: Unit, t: Unit, r: HitResult) {
  if (!s.effects || !t.alive || r.miss) return;
  for (const e of s.effects) {
    if (Math.random() > e.chance) continue;
    let v = e.value ?? 0;
    if (e.type === 'shield') v = Math.round(stat(caster, 'mag') * Math.max(0.8, s.power) + caster.maxHp * 0.12 * s.power);
    if (e.type === 'stun' && t.side === 'enemy' && t.maxHp > 800 && Math.random() < 0.5) continue;
    addStatus(t, e.type, e.turns, v);
    (r.status ??= []).push(e.type);
  }
}

function doHeal(caster: Unit, t: Unit, s: Skill | null, amount?: number): HitResult {
  const r: HitResult = { uid: t.uid };
  let h = amount ?? Math.round(stat(caster, 'mag') * (s?.power ?? 1) * rnd(0.95, 1.1) + t.maxHp * 0.06 * (s?.power ?? 1));
  if (caster.cls === 'merchant' && s && amount === undefined) h = Math.round(h * 1.15);
  h = Math.min(h, t.maxHp - t.hp);
  t.hp += h; r.heal = h;
  if (s?.cleanse) t.statuses = t.statuses.filter((x) => !STATUS_BAD.has(x.type));
  return r;
}
const STATUS_BAD = new Set<StatusType>(['poison', 'burn', 'bleed', 'stun', 'atkDown', 'defDown', 'spdDown']);

/** Advance to next actor; returns an action event (or null if battle over). */
export function stepBattle(b: BattleState): ActionEvent | null {
  if (b.over) return null;
  const live = b.units.filter((u) => u.alive);
  let tmin = Infinity;
  for (const u of live) tmin = Math.min(tmin, Math.max(0, 100 - u.atb) / stat(u, 'spd'));
  for (const u of live) u.atb += stat(u, 'spd') * tmin;
  const actor = live.filter((u) => u.atb >= 99.999).sort((a, c) => stat(c, 'spd') - stat(a, 'spd'))[0] ?? live[0];
  actor.atb = 0;
  b.turn++;

  // cooldowns & statuses
  for (const k of Object.keys(actor.cds)) actor.cds[k] = Math.max(0, actor.cds[k] - 1);
  const dotHits: HitResult[] = [];
  for (const st of actor.statuses) {
    if (st.type === 'poison' || st.type === 'burn' || st.type === 'bleed') {
      const d = Math.max(1, Math.round(actor.maxHp * st.value));
      actor.hp = Math.max(0, actor.hp - d);
      dotHits.push({ uid: actor.uid, dmg: d, status: [st.type] });
    } else if (st.type === 'regen') {
      const h = Math.min(actor.maxHp - actor.hp, Math.round(actor.maxHp * st.value));
      actor.hp += h; if (h > 0) dotHits.push({ uid: actor.uid, heal: h });
    }
  }
  const stunned = !!has(actor, 'stun');
  actor.statuses.forEach((s) => { if (s.type !== 'shield' || s.turns > 0) s.turns--; });
  actor.statuses = actor.statuses.filter((s) => s.turns > 0);
  actor.mp = Math.min(actor.maxMp, actor.mp + Math.max(1, Math.round(actor.maxMp * 0.04)));

  if (actor.hp <= 0) {
    actor.alive = false; actor.statuses = [];
    dotHits[dotHits.length - 1].killed = true;
    checkOver(b);
    return { actor: actor.uid, label: 'พ่ายแพ้จากสถานะ', icon: '☠️', element: 'poison', kind: 'dot', isSkill: false, hits: dotHits, log: `${actor.name} ล้มลงจากสถานะผิดปกติ` };
  }
  if (stunned) {
    return { actor: actor.uid, label: 'สตัน!', icon: '💫', element: 'phys', kind: 'skip', isSkill: false, hits: dotHits, log: `${actor.name} ติดสตัน ขยับไม่ได้` };
  }

  const ev = act(b, actor);
  ev.hits = [...dotHits, ...ev.hits];
  // ultimate gauge gain
  if (!ev.ult) actor.ult = Math.min(100, actor.ult + (ev.isSkill ? 17 : 13));
  for (const h of ev.hits) {
    const t = b.units.find((x) => x.uid === h.uid);
    if (!t) continue;
    if (h.dmg && t !== actor && t.alive) t.ult = Math.min(100, t.ult + Math.min(30, (h.dmg / t.maxHp) * 75));
    if (h.killed && t.side !== actor.side) actor.ult = Math.min(100, actor.ult + 12);
  }
  checkOver(b);
  return ev;
}

export const ultLevel = (u: Unit) => Math.min(5, 1 + Math.floor(u.level / 8));
function act(b: BattleState, u: Unit): ActionEvent {
  const allies = alive(b, u.side);
  // ---- ULTIMATE: fires when gauge is full
  let forced: Skill | null = null;
  if (u.ultId && u.ult >= 100 && SKILL[u.ultId]) { forced = scaledSkill(SKILL[u.ultId], ultLevel(u)); u.ult = 0; }
  // Items (ally only)
  if (!forced && u.side === 'ally') {
    const dead = b.units.filter((x) => x.side === 'ally' && !x.alive);
    const hasReviveSkill = u.skills.some((s) => s.enabled && SKILL[s.id].target === 'deadAlly' && skillUsable(b, u, SKILL[s.id]));
    if (b.settings.autoRevive && dead.length && hasItem(b.inv, PHOENIX) && !hasReviveSkill && Math.random() < 0.6) {
      const t = dead[0]; take(b.inv, PHOENIX); b.itemsUsed++;
      t.alive = true; t.hp = Math.round(t.maxHp * 0.5); t.atb = 0;
      return { actor: u.uid, label: 'ขนนกการเวก', icon: '🪶', element: 'holy', kind: 'item', isSkill: true, hits: [{ uid: t.uid, heal: t.hp, revived: true }], log: `${u.name} ใช้ขนนกการเวกชุบชีวิต ${t.name}` };
    }
    const low = allies.filter((a) => a.hp / a.maxHp < 0.32).sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
    const hasHeal = u.skills.some((s) => s.enabled && SKILL[s.id].kind === 'heal' && skillUsable(b, u, SKILL[s.id]));
    const nBig = count(b.inv, HIPOTION), nSmall = count(b.inv, POTION);
    if (b.settings.autoPotion && low && !hasHeal && (nBig > 0 || nSmall > 0)) {
      const hi = (low.hp / low.maxHp < 0.18 && nBig > 0) || nSmall === 0;
      if (hi) take(b.inv, HIPOTION); else take(b.inv, POTION);
      b.itemsUsed++;
      const r = doHeal(u, low, null, Math.round(low.maxHp * (hi ? 0.8 : 0.4)));
      return { actor: u.uid, label: hi ? 'ยาหม้อใหญ่' : 'ยาสมุนไพร', icon: hi ? '🍵' : '🧃', element: 'holy', kind: 'item', isSkill: true, hits: [r], log: `${u.name} ป้อนยาให้ ${low.name} +${r.heal}` };
    }
    if (b.settings.autoPotion && hasItem(b.inv, ETHER) && u.mp < u.maxMp * 0.15 && u.maxMp > 50 && Math.random() < 0.5) {
      take(b.inv, ETHER); b.itemsUsed++;
      const m = Math.round(u.maxMp * 0.5); u.mp = Math.min(u.maxMp, u.mp + m);
      return { actor: u.uid, label: 'น้ำมนต์มานา', icon: '🔷', element: 'ice', kind: 'item', isSkill: true, hits: [{ uid: u.uid, mpHeal: m }], log: `${u.name} ดื่มน้ำมนต์มานา` };
    }
  }

  // Skill selection
  let chosen: Skill | null = forced;
  if (!chosen && u.tactic !== 'attack') {
    for (const slot of u.skills) {
      if (!slot.enabled) continue;
      if (!SKILL[slot.id]) continue;
      const s = scaledSkill(SKILL[slot.id], slot.level ?? 1);
      if (!skillUsable(b, u, s)) continue;
      const urgent = s.kind === 'heal';
      let p = 1;
      if (u.tactic === 'balanced') p = urgent ? 1 : 0.65;
      if (u.tactic === 'conserve') p = urgent ? 1 : u.mp > u.maxMp * 0.6 ? 0.45 : 0.1;
      if (Math.random() < p) { chosen = s; break; }
    }
  }

  if (!chosen) {
    const t = chooseEnemyTarget(b, u);
    const r = calcDamage(u, t, null);
    return { actor: u.uid, label: 'โจมตี', icon: '🗡', element: 'phys', kind: 'attack', isSkill: false, hits: [r], log: `${u.name} โจมตี ${t.name}${r.miss ? ' แต่พลาด!' : ` ${r.dmg}`}` };
  }

  const s = chosen;
  if (!forced) { u.mp -= s.mp; u.cds[s.id] = s.cd + 1; }
  const foes = alive(b, u.side === 'ally' ? 'enemy' : 'ally');
  const hits: HitResult[] = [];
  let gold = 0;

  let targets: Unit[] = [];
  switch (s.target) {
    case 'enemy': targets = [chooseEnemyTarget(b, u)]; break;
    case 'enemies': targets = foes; break;
    case 'random3': targets = [0, 1, 2].map(() => pick(foes)); break;
    case 'self': targets = [u]; break;
    case 'allies': targets = allies; break;
    case 'ally': targets = [allies.reduce((a, c) => (c.hp / c.maxHp < a.hp / a.maxHp ? c : a))]; break;
    case 'deadAlly': targets = b.units.filter((x) => x.side === u.side && !x.alive).slice(0, 1); break;
  }

  if (s.kind === 'phys' || s.kind === 'mag') {
    for (const t of targets) {
      const n = s.hits ?? 1;
      for (let i = 0; i < n; i++) {
        if (!t.alive) break;
        const r = calcDamage(u, t, s);
        applyEffects(s, u, t, r);
        if (s.lifesteal && r.dmg) { const h = Math.min(u.maxHp - u.hp, Math.round(r.dmg * s.lifesteal)); u.hp += h; if (h) hits.push({ uid: u.uid, heal: h }); }
        hits.push(r);
      }
    }
    if (s.gold && u.side === 'ally') { gold = s.gold * u.level; b.goldBonus += gold; }
  } else if (s.kind === 'heal') {
    if (s.revive && s.target === 'allies') {
      for (const d of b.units.filter((x) => x.side === u.side && !x.alive)) { d.alive = true; d.hp = Math.round(d.maxHp * s.revive); d.atb = 0; hits.push({ uid: d.uid, heal: d.hp, revived: true }); }
    }
    for (const t of targets) {
      if (s.revive && s.target === 'deadAlly') {
        t.alive = true; t.hp = Math.round(t.maxHp * s.revive); t.atb = 0;
        hits.push({ uid: t.uid, heal: t.hp, revived: true });
      } else {
        const r = doHeal(u, t, s);
        applyEffects(s, u, t, r);
        hits.push(r);
      }
    }
  } else {
    for (const t of targets) {
      const r: HitResult = { uid: t.uid };
      if (s.kind === 'debuff' && has(t, 'evade') && Math.random() < 0.3) r.miss = true;
      else applyEffects(s, u, t, r);
      hits.push(r);
    }
  }
  const tot = hits.reduce((a, h) => a + (h.dmg ?? 0), 0);
  return { actor: u.uid, label: s.name, icon: s.icon, element: s.element, kind: s.kind, isSkill: true, skillId: s.id, ult: !!forced, hits, gold, log: `${u.name} ใช้ ${s.icon}${s.name}${tot ? ` ${tot} ดาเมจ` : ''}` };
}

export type { Status };
