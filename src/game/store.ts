import { CITY, NPC_SEED } from './data';
import { makeCityQuests, makeEquip, makeMember, makeNpcs, memberStats, partyLevel, randomDrop, rint, uid, xpNeed } from './engine';
import { EQUIPS, NODE, NODE_KIND_INFO } from './data';
import { dropsOf } from '../data/economy/materials';
import { POTION, add as addItem, prune } from './inv';
import { INN_WAKE, START_MINUTE, addMinutes, battleMinutes, normalize } from './time';
import type { ClassId, EnemyGroup, EquipItem, GameState, LogEntry, Member } from './types';
import type { BattleState } from './engine';

export interface HighScore { name: string; score: number; fame: number; level: number; rank: number; date: string; top: boolean }
const HS_KEY = 'thai-battlefield-hs-v1';
export function loadHS(): HighScore[] {
  try { return JSON.parse(localStorage.getItem(HS_KEY) || '[]'); } catch { return []; }
}
export function saveHS(h: HighScore): HighScore[] {
  const list = [...loadHS(), h].sort((a, b) => b.score - a.score).slice(0, 10);
  try { localStorage.setItem(HS_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  return list;
}

export function newGame(partyName: string, classes: ClassId[], names: string[]): GameState {
  const members = classes.map((c, i) => makeMember(c, names[i]));
  const g: GameState = {
    partyName, members, gold: 150, fame: 0, score: 0, day: 1, minute: START_MINUTE, location: 'bkk',
    inv: { potion: 3, ether: 1, phoenix: 1 },
    quests: [], cityQuests: {}, npcs: makeNpcs(),
    stats: { kills: 0, wins: 0, battles: 0, npcWins: 0, quests: 0 },
    settings: { autoPotion: true, autoRevive: true }, reachedTop: false, travel: null,
    bag: [makeEquip(EQUIPS.find((e) => e.id === 'c1')!, 0), makeEquip(EQUIPS.find((e) => e.id === 'w1')!, 1)],
    log: [],
    visited: [],
    lastDriftDay: 1, lastQuestDay: 1,
  };
  addLog(g, 'info', `ปาร์ตี้ "${partyName}" ออกเดินทางจากกรุงเทพฯ`, 'เป้าหมาย: เป็นปาร์ตี้อันดับ 1 แห่งสยาม');
  g.quests.push({ id: uid('q'), type: 'hunt', title: 'ภารกิจแรก: ปราบศัตรู 3 ตัว', desc: 'ออกเดินทางและกำจัดศัตรู', target: 3, progress: 0, from: 'bkk', rewardGold: 80, rewardFame: 30, rewardXp: 40 });
  g.cityQuests.bkk = makeCityQuests(g, 'bkk');
  return g;
}

let logId = 0;
export function addLog(g: GameState, type: LogEntry['type'], text: string, sub?: string) {
  g.log.unshift({ id: ++logId + Date.now(), day: g.day, type, text, sub });
  if (g.log.length > 120) g.log.length = 120;
}

export function rankOf(g: GameState) {
  return g.npcs.filter((n) => n.fame > g.fame).length + 1;
}

export interface BattleSummary {
  win: boolean;
  xp: number; gold: number; fame: number; score: number;
  levelUps: { name: string; level: number }[];
  questsDone: string[];
  npcName?: string;
  becameTop?: boolean;
  /** In-game minutes the battle consumed. */
  minutes?: number;
  drops: EquipItem[];
  /** Materials harvested from the defeated enemies. */
  mats: { id: string; name: string; icon: string; qty: number }[];
}

function giveXp(m: Member, xp: number, ups: { name: string; level: number }[]) {
  m.xp += xp;
  while (m.xp >= xpNeed(m.level) && m.level < 60) {
    m.xp -= xpNeed(m.level); m.level++; m.sp = (m.sp ?? 0) + 1;
    ups.push({ name: m.name, level: m.level });
  }
}

export function completeQuests(g: GameState, sum: { gold: number; fame: number; score: number; levelUps: { name: string; level: number }[]; questsDone: string[] }) {
  const done = g.quests.filter((q) => q.progress >= q.target);
  for (const q of done) {
    g.gold += q.rewardGold; g.fame += q.rewardFame; g.score += q.rewardFame * 3;
    sum.gold += q.rewardGold; sum.fame += q.rewardFame; sum.score += q.rewardFame * 3;
    g.members.forEach((m) => giveXp(m, q.rewardXp, sum.levelUps));
    sum.questsDone.push(q.title);
    g.stats.quests++;
    addLog(g, 'quest', `เควสสำเร็จ: ${q.title}`, `+${q.rewardGold} ทอง • +${q.rewardFame} ชื่อเสียง`);
  }
  g.quests = g.quests.filter((q) => q.progress < q.target);
}

export function applyBattle(g: GameState, b: BattleState, group: EnemyGroup): BattleSummary {
  const win = b.over === 'win';
  const sum: BattleSummary = { win, xp: 0, gold: 0, fame: 0, score: 0, levelUps: [], questsDone: [], drops: [], mats: [] };
  g.stats.battles++;
  g.inv = { ...b.inv };
  prune(g.inv);
  // sync HP/MP
  for (const u of b.units) {
    if (u.side !== 'ally') continue;
    const m = g.members.find((x) => x.id === u.memberId);
    if (m) { m.hp = u.alive ? u.hp : 0; m.mp = u.mp; }
  }
  if (!win) { addLog(g, 'lose', `พ่ายแพ้ต่อ ${group.title.replace(/^\S+\s/, '')}`, `เทิร์น ${b.turn}`); return sum; }
  const enemies = b.units.filter((u) => u.side === 'enemy');
  const lvlSum = enemies.reduce((a, e) => a + e.level, 0);
  const merchant = g.members.some((m) => m.cls === 'merchant');
  sum.xp = Math.round(enemies.reduce((a, e) => a + 14 + e.level * 7, 0) * (group.npcId ? 1.6 : 1));
  sum.gold = Math.round((enemies.reduce((a, e) => a + 6 + e.level * 4 + rint(0, 5), 0) * (group.npcId ? 2 : 1) + b.goldBonus) * (merchant ? 1.25 : 1));
  sum.fame = Math.round(lvlSum * 1.5);
  sum.score = lvlSum * 10 + 25;
  g.stats.wins++;
  g.stats.kills += enemies.length;
  if (group.npcId) {
    const n = g.npcs.find((x) => x.id === group.npcId);
    if (n) {
      const steal = Math.round(n.fame * 0.22) + 40;
      n.fame = Math.max(10, n.fame - steal);
      sum.fame += steal; sum.score += steal * 2 + 200;
      sum.npcName = n.name;
      g.stats.npcWins++;
      g.quests.forEach((q) => { if (q.type === 'bounty' && q.targetParty === n.id) q.progress = 1; });
    }
  }
  if (group.title.startsWith('⛺')) { const bonus = 40 + group.level * 15; sum.gold += bonus; sum.score += 100; }
  g.gold += sum.gold; g.fame += sum.fame; g.score += sum.score;
  const living = g.members.filter((m) => m.hp > 0);
  for (const m of g.members) {
    giveXp(m, m.hp > 0 ? sum.xp : Math.round(sum.xp * 0.5), sum.levelUps);
  }
  // post-battle recovery for survivors
  for (const m of living) {
    const s = memberStats(m);
    m.hp = Math.min(s.hp, m.hp + Math.round(s.hp * 0.08));
    m.mp = Math.min(s.mp, m.mp + Math.round(s.mp * 0.1));
  }
  g.quests.forEach((q) => {
    if (q.type === 'hunt') q.progress = Math.min(q.target, q.progress + enemies.length);
    if (q.type === 'wins') q.progress = Math.min(q.target, q.progress + 1);
  });
  // loot
  const lootChance = group.npcId ? 0.5 : 0.16 + enemies.length * 0.03;
  if (Math.random() < lootChance) { const d = randomDrop(group.level, group.npcId ? 0.15 : 0); g.bag.push(d); sum.drops.push(d); }
  // Materials. This is the only source — they cannot be bought, so the market
  // loop closes only if monsters actually drop them. Each enemy rolls its own
  // table; elite (NPC) parties drop a little more often.
  for (const e of enemies) {
    for (const { mat, rate } of dropsOf(e.name)) {
      const chance = rate * (group.npcId ? 1.5 : 1);
      if (Math.random() < chance) {
        const qty = 1 + (Math.random() < 0.25 ? 1 : 0);
        addItem(g.inv, mat.id, qty);
        sum.mats.push({ id: mat.id, name: mat.name, icon: mat.icon, qty });
      }
    }
  }
  const names = [...new Set(enemies.map((e) => e.name))].join(', ');
  addLog(g, group.npcId ? 'npc' : 'win', group.npcId ? `ชนะปาร์ตี้ "${sum.npcName}"` : `ชนะ ${names}`, `เทิร์น ${b.turn} • +${sum.xp} EXP • +${sum.gold} ทอง • +${sum.fame} ชื่อเสียง`);
  sum.drops.forEach((d) => addLog(g, 'loot', `ได้รับ ${d.name}`, 'เก็บไว้ในกระเป๋า'));
  sum.mats.forEach((m) => addLog(g, 'loot', `ได้${m.icon}${m.name} x${m.qty}`, 'นำไปขายที่ตลาด'));
  completeQuests(g, sum);
  sum.levelUps.forEach((l) => addLog(g, 'level', `${l.name} เลเวลอัปเป็น Lv${l.level}`, '+1 SP'));
  const wasTop = g.reachedTop;
  if (!wasTop && rankOf(g) === 1) { g.reachedTop = true; sum.becameTop = true; }
  // A battle costs time proportional to how long it dragged on.
  sum.minutes = advanceTime(g, battleMinutes(b.turn));
  return sum;
}

/**
 * Rival parties gain ground over time — but only once per in-game day.
 * Previously this ran on every map node, so a 20-node walk drifted them 20
 * times and the ranking raced ahead of the player. Gating on the day makes
 * "keep up with the competition" a calendar-paced goal instead of a
 * foot-speed one.
 */
export function npcDrift(g: GameState) {
  const { day } = normalize(g.day, g.minute);
  if (g.lastDriftDay === day) return false;
  g.lastDriftDay = day;
  for (const n of g.npcs) {
    n.fame += rint(0, 6 + Math.round(n.level / 2));
    if (Math.random() < 0.04 && n.level < 40) n.level++;
  }
  return true;
}

/**
 * Advance the clock. This is the ONLY place time moves forward, so the
 * "1 node = 5 min" rule can never be bypassed by a stray `day +=`.
 * Returns the number of days that rolled over, so callers can fire
 * once-per-day side effects (quest restock, market refresh).
 */
export function advanceTime(g: GameState, minutes: number): number {
  const { day, minute } = normalize(g.day, g.minute);
  const next = addMinutes(day, minute, minutes);
  const rolled = next.day - day;
  g.day = next.day;
  g.minute = next.minute;
  return rolled;
}

/** Sleep until 07:00. If it is already past 07:00, the night ends the next morning. */
export function restAtInn(g: GameState) {
  const { day, minute } = normalize(g.day, g.minute);
  const targetDay = minute >= INN_WAKE ? day + 1 : day;
  g.day = targetDay;
  g.minute = INN_WAKE;
  npcDrift(g);
  return { day: g.day, minute: g.minute };
}

export function arriveCity(g: GameState, city: string) {
  g.location = city; g.travel = null;
  g.quests.forEach((q) => { if (q.type === 'deliver' && q.targetCity === city) q.progress = 1; });
  // Offers refresh once per day, so stepping out and back in does not reroll them.
  if (g.lastQuestDay !== g.day) {
    g.cityQuests = {};
    g.lastQuestDay = g.day;
  }
  if (!g.cityQuests[city]) g.cityQuests[city] = makeCityQuests(g, city);
  npcDrift(g);
  addLog(g, 'city', `เดินทางถึง ${CITY[city].name}`);
}

export const cityName = (id: string) => CITY[id]?.name ?? id;
export const levelRange = (tier: number) => { const b = Math.max(1, Math.round(tier * 2.2 - 1.5)); return `${Math.max(1, b - 1)}-${b + 1}`; };
export { partyLevel, NPC_SEED };

/** Arrive at a waypoint. Returns toast messages and whether a camp battle should start. */
export function arriveNode(g: GameState, id: string): { msgs: string[]; battle: boolean } {
  const n = NODE[id];
  g.location = id; g.travel = null;
  const first = !g.visited.includes(id);
  if (first) g.visited.push(id);
  const msgs: string[] = [];
  const heal = (hp: number, mp: number) => g.members.forEach((m) => { if (m.hp <= 0) return; const s = memberStats(m); m.hp = Math.min(s.hp, m.hp + Math.round(s.hp * hp)); m.mp = Math.min(s.mp, m.mp + Math.round(s.mp * mp)); });
  let battle = false;
  switch (n.kind) {
    case 'village': heal(0.25, 0.1); msgs.push('🏡 ชาวบ้านต้อนรับ ฟื้นฟู HP 25%'); break;
    case 'shrine': heal(0, 0.6); msgs.push('⛩️ สวดมนต์ที่ศาลเจ้า ฟื้น MP 60%'); if (first) { g.fame += 25; g.score += 50; msgs.push('🎖 ได้รับพร +25 ชื่อเสียง'); } break;
    case 'lake': heal(0.15, 0.25); msgs.push('💧 พักริมบึง ฟื้น HP/MP'); break;
    case 'fort': if (first) { addItem(g.inv, POTION, 2); msgs.push('🏰 ทหารที่ด่านมอบยาสมุนไพร x2'); } else msgs.push('🏰 ด่านทหาร — ปลอดภัย'); break;
    case 'ruin':
      if (first) {
        if (Math.random() < 0.45) { const d = randomDrop(Math.round(n.tier * 2.2), 0.1); g.bag.push(d); msgs.push(`🏛️ พบอุปกรณ์โบราณ: ${d.name}`); addLog(g, 'loot', `พบ ${d.name} ที่${n.name}`); }
        else { const v = rint(30, 60) * Math.max(1, Math.round(n.tier)); g.gold += v; msgs.push(`🏛️ พบสมบัติในซาก +${v} ทอง`); }
      } else msgs.push('🏛️ ซากโบราณถูกสำรวจแล้ว');
      break;
    case 'camp': if (first) { battle = true; msgs.push('⛺ บุกค่ายโจร!'); } else msgs.push('⛺ ค่ายโจรถูกกวาดล้างแล้ว'); break;
    default: break;
  }
  addLog(g, 'city', `แวะ${NODE_KIND_INFO[n.kind].th} ${n.name}`, msgs[0]);
  npcDrift(g);
  return { msgs, battle };
}
