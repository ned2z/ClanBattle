import { useEffect, useState } from 'react';
import { BASE_ULT, CLASS2, CLASS2_LEVEL, CLASS2_OF, CLASSES, CLASS_IDS, COMMON_SKILLS, ELEMENT_NAME, SKILL_RARITY, ULT_IDS, EQUIPS, ITEMS, KIND_NAME, RARITY, SKILL, STATUS_INFO, TARGET_NAME } from '../game/data';
import { EquipIcon, ItemIcon, RarityTag, SkillIcon, EL_STYLE, KIND_FRAME } from './Icons';
import { MAX_SKILL_LV, memberStats, scaledSkill, skillUpCost, xpNeed } from '../game/engine';
import { fx } from '../game/fx';
import { count } from '../game/inv';
import { PORTRAIT } from '../game/portraits';
import type { EquipItem, GameState, Member, Stats, Tactic, Targeting } from '../game/types';

type Update = (fn: (g: GameState) => void) => void;
type Tab = 'status' | 'skills' | 'equip' | 'tactic' | 'codex';
const SLOT_INFO = { weapon: { name: 'อาวุธ', icon: '🗡️' }, armor: { name: 'เกราะ', icon: '🥋' }, acc: { name: 'เครื่องประดับ', icon: '📿' } } as const;
const STAT_NAME: Record<keyof Stats, string> = { hp: 'HP', mp: 'MP', atk: 'ATK', mag: 'MAG', def: 'DEF', res: 'RES', spd: 'SPD', crit: 'CRIT' };
const TACTICS: [Tactic, string, string][] = [
  ['aggressive', '🔥 บุกเต็มที่', 'ใช้สกิลทุกครั้งที่ทำได้'],
  ['balanced', '⚖️ สมดุล', 'ผสมสกิลกับโจมตีปกติ'],
  ['conserve', '💧 ประหยัด MP', 'เก็บ MP ใช้สกิลน้อย'],
  ['attack', '🗡 โจมตีล้วน', 'ไม่ใช้สกิลเลย'],
];
const TARGETS: [Targeting, string][] = [['lowest', '🎯 HP ต่ำสุด'], ['random', '🎲 สุ่ม'], ['strongest', '💪 ตัวแข็งแกร่ง']];

export default function PartyMenu({ game, update, onClose, toast }: { game: GameState; update: Update; onClose: () => void; toast: (s: string) => void }) {
  const [sel, setSel] = useState(game.members[0].id);
  const [tab, setTab] = useState<Tab>('status');
  const m = game.members.find((x) => x.id === sel) ?? game.members[0];
  const c = CLASSES[m.cls];
  const mu = (fn: (mm: Member) => void) => update((g) => fn(g.members.find((x) => x.id === sel)!));

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const idx = game.members.findIndex((x) => x.id === sel);
      if (e.key === 'ArrowDown' || e.key === 's') setSel(game.members[(idx + 1) % game.members.length].id);
      if (e.key === 'ArrowUp' || e.key === 'w') setSel(game.members[(idx - 1 + game.members.length) % game.members.length].id);
      const tabs: Tab[] = ['status', 'skills', 'equip', 'tactic', 'codex'];
      if (e.key === 'ArrowRight' || e.key === 'e') setTab((t) => tabs[(tabs.indexOf(t) + 1) % 5]);
      if (e.key === 'ArrowLeft' || e.key === 'q') setTab((t) => tabs[(tabs.indexOf(t) + 4) % 5]);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [game.members, sel]);

  return (
    <div className="tof-bg fade-in fixed inset-0 z-50 flex flex-col">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-amber-500/30 bg-black/30 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="title-font text-2xl tracking-widest text-amber-300">PARTY</div>
        <div className="hidden text-xs text-stone-400 sm:block">จัดการปาร์ตี้ • ↑↓ เลือกตัวละคร • ←→ เปลี่ยนแท็บ • Esc ปิด</div>
        <div className="ml-auto flex items-center gap-3 text-sm"><span>🪙 <b className="text-amber-300">{game.gold}</b></span><span>🎒 {game.bag.length}</span></div>
        <button className="btn btn-dark px-3 py-1" onClick={onClose}>✕</button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        {/* member list */}
        <div className="flex shrink-0 gap-2 overflow-x-auto p-2 sm:w-60 sm:flex-col sm:overflow-y-auto">
          {game.members.map((x) => {
            const s = memberStats(x); const cc = CLASSES[x.cls]; const on = x.id === sel;
            return (
              <button key={x.id} onClick={() => setSel(x.id)} className={`card-hover relative flex w-40 shrink-0 items-center gap-2 overflow-hidden rounded-xl border-2 p-1.5 text-left sm:w-full ${on ? 'border-amber-300 bg-amber-500/15' : 'border-white/10 bg-black/40'}`}>
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: cc.color }}>
                  <img src={PORTRAIT[x.cls]} alt="" className={`h-full w-full object-cover ${x.hp <= 0 ? 'grayscale' : ''}`} style={{ objectPosition: '50% 18%' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between"><span className="truncate text-sm font-bold">{x.name}</span><span className="text-[12px] text-amber-300">Lv{x.level}</span></div>
                  <div className="text-[12px]" style={{ color: x.cls2 ? CLASS2[x.cls2].color : cc.color }}>{x.cls2 ? `${CLASS2[x.cls2].icon} ${CLASS2[x.cls2].name}` : `${cc.icon} ${cc.name}`}</div>
                  <div className="bar mt-0.5" style={{ height: 4 }}><div style={{ width: `${(x.hp / s.hp) * 100}%`, background: '#22c55e' }} /></div>
                  <div className="bar mt-px" style={{ height: 3 }}><div style={{ width: `${(x.mp / s.mp) * 100}%`, background: '#3b82f6' }} /></div>
                </div>
                {x.sp > 0 && <span className="absolute bottom-1 left-1 rounded-full bg-amber-400 px-1 text-[10px] font-bold text-black">SP{x.sp}</span>}
              </button>
            );
          })}
        </div>

        {/* main */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* showcase */}
          <div className="relative hidden w-72 shrink-0 overflow-hidden lg:block">
            <img key={m.id} src={PORTRAIT[m.cls]} alt="" className="fade-in absolute inset-0 h-full w-full object-cover" style={{ objectPosition: '50% 20%' }} />
            <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 50%, rgba(10,12,20,.95)), linear-gradient(90deg, transparent 70%, rgba(20,22,36,1))` }} />
            <div className="absolute bottom-4 left-4 right-4">
              <div className="text-xs tracking-widest" style={{ color: m.cls2 ? CLASS2[m.cls2].color : c.color }}>{m.cls2 ? `${CLASS2[m.cls2].icon} ${CLASS2[m.cls2].name} (${CLASS2[m.cls2].en})` : c.name}</div>
              <div className="title-font text-3xl">{m.name}</div>
              <div className="text-sm text-amber-300">Lv {m.level}</div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-3">
            <div className="mb-2 flex gap-1 overflow-x-auto">
              {([['status', '📋 สถานะ'], ['skills', `✨ สกิล${m.sp ? ` (${m.sp})` : ''}`], ['equip', '🛡 อุปกรณ์'], ['tactic', '🧠 แผนรบ'], ['codex', '📖 คลังสกิล & ไอเท็ม']] as [Tab, string][]).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-t-lg border-b-2 px-4 py-2 text-sm font-bold transition ${tab === k ? 'border-amber-300 bg-amber-500/15 text-amber-200' : 'border-transparent text-stone-400 hover:text-stone-200'}`}>{l}</button>
              ))}
            </div>
            <div key={m.id + tab} className="slide-up min-h-0 flex-1 overflow-y-auto pr-1">
              {tab === 'status' && <><StatusTab m={m} /><ClassChange m={m} mu={mu} toast={toast} /></>}
              {tab === 'skills' && <SkillsTab m={m} mu={mu} toast={toast} />}
              {tab === 'equip' && <EquipTab m={m} game={game} update={update} toast={toast} />}
              {tab === 'tactic' && <TacticTab m={m} mu={mu} game={game} update={update} />}
              {tab === 'codex' && <Codex game={game} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ STATUS
function Radar({ m }: { m: Member }) {
  const s = memberStats(m);
  const keys: (keyof Stats)[] = ['hp', 'atk', 'mag', 'spd', 'res', 'def'];
  const ref = (k: keyof Stats) => Math.max(...CLASS_IDS.map((id) => CLASSES[id].base[k] + CLASSES[id].growth[k] * (m.level - 1))) * 1.35 + (k === 'spd' ? 6 : k === 'hp' ? 60 : 8);
  const R = 70, cx = 90, cy = 88;
  const pt = (i: number, r: number) => { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`; };
  const vals = keys.map((k) => Math.min(1, s[k] / ref(k)));
  return (
    <svg viewBox="0 0 180 180" className="h-44 w-44">
      {[1, 0.66, 0.33].map((f) => <polygon key={f} points={keys.map((_, i) => pt(i, R * f)).join(' ')} fill="none" stroke="rgba(246,196,83,.25)" />)}
      {keys.map((_, i) => <line key={i} x1={cx} y1={cy} x2={pt(i, R).split(',')[0]} y2={pt(i, R).split(',')[1]} stroke="rgba(246,196,83,.15)" />)}
      <polygon points={vals.map((v, i) => pt(i, R * Math.max(0.08, v))).join(' ')} fill={CLASSES[m.cls].color + '55'} stroke={CLASSES[m.cls].color} strokeWidth="2" />
      {keys.map((k, i) => { const [x, y] = pt(i, R + 12).split(',').map(Number); return <text key={k} x={x} y={y + 3} fontSize="9" fill="#f5f0dc" textAnchor="middle" fontWeight="700">{STAT_NAME[k]}</text>; })}
    </svg>
  );
}

function StatusTab({ m }: { m: Member }) {
  const s = memberStats(m); const c = CLASSES[m.cls];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="tof-frame rounded-xl p-3">
        <div className="flex items-center gap-3 lg:hidden">
          <img src={PORTRAIT[m.cls]} alt="" className="h-20 w-20 rounded-xl border-2 object-cover" style={{ borderColor: c.color, objectPosition: '50% 18%' }} />
          <div><div className="title-font text-xl">{m.name}</div><div className="text-xs" style={{ color: c.color }}>{c.icon} {c.name}</div><div className="text-sm text-amber-300">Lv {m.level}</div></div>
        </div>
        <div className="mt-2 text-xs text-stone-300 lg:mt-0">{c.desc}</div>
        <div className="mt-2 flex justify-between text-[13px]"><span>EXP</span><span>{m.xp}/{xpNeed(m.level)}</span></div>
        <div className="bar" style={{ height: 7 }}><div style={{ width: `${(m.xp / xpNeed(m.level)) * 100}%`, background: 'linear-gradient(90deg,#8b5cf6,#c4b5fd)' }} /></div>
        <div className="mt-2 flex items-center gap-2 text-sm"><span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-black">SP {m.sp}</span><span className="text-[13px] text-stone-400">ใช้อัปเกรดสกิลได้ (ได้ +1 ทุกเลเวล)</span></div>
        <div className="mt-3 flex justify-center"><Radar m={m} /></div>
      </div>
      <div className="tof-frame rounded-xl p-3">
        <div className="mb-2 text-sm font-bold text-amber-200">ค่าสถานะ</div>
        {(Object.keys(STAT_NAME) as (keyof Stats)[]).map((k) => {
          const eq = Object.values(m.equip).reduce((a, e) => a + ((e?.bonus[k] as number) ?? 0), 0);
          return (
            <div key={k} className="flex items-center justify-between border-b border-white/5 py-1 text-sm">
              <span className="text-stone-300">{STAT_NAME[k]}</span>
              <span><b>{k === 'hp' ? `${m.hp}/${s.hp}` : k === 'mp' ? `${m.mp}/${s.mp}` : s[k]}{k === 'crit' ? '%' : ''}</b>{eq > 0 && <span className="ml-1 text-xs text-lime-300">(+{eq})</span>}</span>
            </div>
          );
        })}
        <div className="mt-3 text-sm font-bold text-amber-200">อุปกรณ์</div>
        {(['weapon', 'armor', 'acc'] as const).map((sl) => { const e = m.equip[sl]; return <div key={sl} className="flex justify-between py-0.5 text-xs"><span className="text-stone-400">{SLOT_INFO[sl].icon} {SLOT_INFO[sl].name}</span><span style={{ color: e ? RARITY[e.rarity].color : '#78716c' }}>{e?.name ?? '— ว่าง —'}</span></div>; })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ SKILLS
function SkillsTab({ m, mu, toast }: { m: Member; mu: (fn: (mm: Member) => void) => void; toast: (s: string) => void }) {
  const c = CLASSES[m.cls];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-2 text-xs">
        <span>ลำดับบนสุด = ใช้ก่อน • แตะการ์ดเพื่อเปิด/ปิดสกิล</span>
        <span className="rounded-full bg-amber-400 px-2 py-0.5 font-bold text-black">SP {m.sp}</span>
      </div>
      {(() => { const uid2 = m.cls2 ? CLASS2[m.cls2].ult : BASE_ULT[m.cls]; const us = SKILL[uid2]; return (
        <div className="relative flex items-center gap-3 overflow-hidden rounded-xl border-2 p-2.5" style={{ borderColor: '#ff2ad0', background: 'linear-gradient(90deg, rgba(122,38,255,.35), rgba(255,42,208,.2), rgba(20,16,30,.9))' }}>
          <SkillIcon id={uid2} size={62} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2"><span className="ult-text text-sm font-black">⚡ ULTIMATE</span><span className="font-bold">{us.name}</span></div>
            <div className="text-[13px] text-stone-300">{us.desc}</div>
            <div className="text-[12px] text-fuchsia-200">ใช้อัตโนมัติเมื่อเกจ ULT เต็ม 100% • ไม่ใช้ MP • เกจเพิ่มเมื่อโจมตี/โดนโจมตี/ฆ่าศัตรู</div>
          </div>
        </div>
      ); })()}
      {m.skills.map((sl, i) => {
        const base = SKILL[sl.id]; const lv = sl.level ?? 1;
        const cur = scaledSkill(base, lv); const nxt = lv < MAX_SKILL_LV ? scaledSkill(base, lv + 1) : null;
        const innate = c.skills.includes(sl.id); const cost = skillUpCost(lv);
        return (
          <div key={sl.id} className={`tof-frame card-hover flex items-center gap-3 rounded-xl p-2.5 ${sl.enabled ? '' : 'opacity-45 grayscale'}`}>
            <span className="w-4 text-center text-xs font-bold text-stone-500">{i + 1}</span>
            <button className="relative shrink-0" onClick={() => mu((x) => { x.skills[i].enabled = !x.skills[i].enabled; })}>
              <SkillIcon id={sl.id} size={60} level={lv} off={!sl.enabled} />
              <span className={`absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[13px] font-bold ${sl.enabled ? 'bg-lime-500 text-black' : 'bg-stone-600'}`}>{sl.enabled ? 'ON' : 'OFF'}</span>
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-bold">{base.name}</span>
                {innate ? <span className="text-[12px] text-sky-300">[อาชีพ]</span> : <RarityTag id={sl.id} />}
                <span className="text-xs tracking-tight text-amber-300">{'★'.repeat(lv)}<span className="text-stone-600">{'★'.repeat(MAX_SKILL_LV - lv)}</span></span>
              </div>
              <div className="text-[13px] text-stone-400">{base.desc}</div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-[13px]">
                {cur.power > 0 && <span>พลัง <b className="text-amber-200">{Math.round(cur.power * 100)}%</b>{nxt && <span className="text-lime-300"> → {Math.round(nxt.power * 100)}%</span>}</span>}
                <span className="text-sky-300">MP {cur.mp}</span>
                <span className="text-stone-300">CD {cur.cd}{nxt && nxt.cd < cur.cd && <span className="text-lime-300"> → {nxt.cd}</span>}</span>
                {cur.effects?.[0] && cur.effects[0].chance < 1 && <span className="text-purple-300">โอกาส {Math.round(cur.effects[0].chance * 100)}%</span>}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-1">
              <button disabled={!nxt || m.sp < cost} className="btn btn-gold px-2 py-1 text-[13px]" onClick={(e) => { mu((x) => { x.sp -= cost; x.skills[i].level = lv + 1; }); fx.burst(e.clientX, e.clientY, '#f6c453', 36, { speed: 5, up: true, shape: 1 }); toast(`${base.icon} ${base.name} อัปเป็น Lv${lv + 1}!`); }}>{nxt ? `⬆ อัป (${cost} SP)` : 'MAX'}</button>
              <div className="flex gap-1">
                <button className="btn btn-dark flex-1 px-2 py-0 text-xs" disabled={i === 0} onClick={() => mu((x) => { [x.skills[i - 1], x.skills[i]] = [x.skills[i], x.skills[i - 1]]; })}>▲</button>
                <button className="btn btn-dark flex-1 px-2 py-0 text-xs" disabled={i === m.skills.length - 1} onClick={() => mu((x) => { [x.skills[i + 1], x.skills[i]] = [x.skills[i], x.skills[i + 1]]; })}>▼</button>
              </div>
            </div>
          </div>
        );
      })}
      <div className="text-center text-[13px] text-stone-500">อัปสกิล: พลัง +15% ต่อเลเวล • โอกาสติดสถานะ +5% • Lv4 ขึ้นไป คูลดาวน์ -1 • เปลี่ยนสกิลสุ่มได้ที่สำนักฝึกในเมือง</div>
    </div>
  );
}

// ------------------------------------------------------------------ EQUIPMENT
function EquipTab({ m, game, update, toast }: { m: Member; game: GameState; update: Update; toast: (s: string) => void }) {
  const [slot, setSlot] = useState<'weapon' | 'armor' | 'acc'>('weapon');
  const cur = m.equip[slot];
  const bag = game.bag.filter((e) => e.slot === slot).sort((a, b) => b.tier - a.tier || b.rarity - a.rarity);
  const setEquip = (fn: (g: GameState, mm: Member) => void) => update((g) => {
    const mm = g.members.find((x) => x.id === m.id)!;
    fn(g, mm);
    const s = memberStats(mm); mm.hp = Math.min(mm.hp, s.hp); mm.mp = Math.min(mm.mp, s.mp);
  });
  const diff = (e: EquipItem) => {
    const keys = new Set([...Object.keys(e.bonus), ...Object.keys(cur?.bonus ?? {})]) as Set<keyof Stats>;
    return [...keys].map((k) => ({ k, d: ((e.bonus[k] as number) ?? 0) - ((cur?.bonus[k] as number) ?? 0) })).filter((x) => x.d !== 0);
  };
  const itemCard = (e: EquipItem | undefined, big = false) => e ? (
    <div className={`flex items-center gap-2 ${big ? '' : ''}`}>
      <EquipIcon item={e} size={48} />
      <div className="min-w-0"><div className="truncate text-sm font-bold" style={{ color: RARITY[e.rarity].color }}>{e.name}</div><div className="text-[12px] text-amber-400">{'★'.repeat(e.tier)} <span className="text-stone-400">{RARITY[e.rarity].name}</span></div><div className="text-[12px] text-lime-300">{Object.entries(e.bonus).map(([k, v]) => `${STAT_NAME[k as keyof Stats]}+${v}`).join(' ')}</div></div>
    </div>
  ) : <div className="text-sm text-stone-500">— ว่าง —</div>;

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="space-y-2">
        {(['weapon', 'armor', 'acc'] as const).map((sl) => (
          <button key={sl} onClick={() => setSlot(sl)} className={`tof-frame card-hover block w-full rounded-xl p-2.5 text-left ${slot === sl ? 'ring-2 ring-amber-300' : ''}`}>
            <div className="mb-1 text-[13px] font-bold text-amber-200">{SLOT_INFO[sl].icon} {SLOT_INFO[sl].name}</div>
            {itemCard(m.equip[sl], true)}
          </button>
        ))}
        {cur && <button className="btn btn-dark w-full text-sm" onClick={() => { setEquip((g, mm) => { g.bag.push(mm.equip[slot]!); mm.equip[slot] = undefined; }); toast(`ถอด ${cur.name} เก็บเข้ากระเป๋า`); }}>ถอด {SLOT_INFO[slot].name}</button>}
      </div>
      <div className="tof-frame rounded-xl p-2.5">
        <div className="mb-2 flex items-center justify-between text-sm"><b className="text-amber-200">🎒 กระเป๋า — {SLOT_INFO[slot].name}</b><span className="text-[13px] text-stone-400">{bag.length} ชิ้น</span></div>
        <div className="space-y-2">
          {bag.map((e) => {
            const d = diff(e);
            const sell = Math.round(e.price * 0.4);
            return (
              <div key={e.iid} className="rounded-lg border border-white/10 bg-black/30 p-2">
                {itemCard(e)}
                <div className="mt-1 flex flex-wrap gap-x-2 text-[13px]">{d.map(({ k, d: v }) => <span key={k} className={v > 0 ? 'text-lime-300' : 'text-red-400'}>{STAT_NAME[k]} {v > 0 ? '▲' : '▼'}{Math.abs(v)}</span>)}{!d.length && <span className="text-stone-500">ค่าเท่าเดิม</span>}</div>
                <div className="mt-1.5 flex gap-1">
                  <button className="btn btn-green flex-1 py-1 text-xs" onClick={(ev) => { setEquip((g, mm) => { const old = mm.equip[slot]; g.bag = g.bag.filter((x) => x.iid !== e.iid); if (old) g.bag.push(old); mm.equip[slot] = e; }); fx.burst(ev.clientX, ev.clientY, RARITY[e.rarity].color, 30, { speed: 5 }); toast(`${m.name} สวม ${e.name}`); }}>สวมใส่</button>
                  <button className="btn btn-dark py-1 text-xs" onClick={(ev) => { update((g) => { g.bag = g.bag.filter((x) => x.iid !== e.iid); g.gold += sell; }); fx.burst(ev.clientX, ev.clientY, '#f6c453', 16, { up: true, shape: 1 }); toast(`ขาย ${e.name} +${sell} 🪙`); }}>ขาย {sell}🪙</button>
                </div>
              </div>
            );
          })}
          {!bag.length && <div className="py-6 text-center text-sm text-stone-500">ไม่มีไอเทมในช่องนี้<br /><span className="text-[13px]">ซื้อที่ร้านค้าในเมือง หรือเก็บจากการชนะศึก</span></div>}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ TACTICS
function TacticTab({ m, mu, game, update }: { m: Member; mu: (fn: (mm: Member) => void) => void; game: GameState; update: Update }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="tof-frame space-y-3 rounded-xl p-3">
        <div>
          <div className="mb-1 text-sm font-bold text-amber-200">แผนการรบของ {m.name}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {TACTICS.map(([k, l, d]) => <button key={k} onClick={() => mu((x) => { x.tactic = k; })} className={`btn px-2 py-2 text-left text-xs ${m.tactic === k ? 'btn-gold' : 'btn-dark'}`}>{l}<div className="text-[12px] font-normal opacity-80">{d}</div></button>)}
          </div>
        </div>
        <div>
          <div className="mb-1 text-sm font-bold text-amber-200">เป้าหมายโจมตี</div>
          <div className="flex gap-1">{TARGETS.map(([k, l]) => <button key={k} onClick={() => mu((x) => { x.targeting = k; })} className={`btn flex-1 px-1 py-1.5 text-xs ${m.targeting === k ? 'btn-gold' : 'btn-dark'}`}>{l}</button>)}</div>
        </div>
        <div>
          <div className="mb-1 text-sm font-bold text-amber-200">ฮีล/บัฟ เมื่อ HP เพื่อนต่ำกว่า</div>
          <div className="flex gap-1">{[0.4, 0.6, 0.8].map((v) => <button key={v} onClick={() => mu((x) => { x.healAt = v; })} className={`btn flex-1 py-1.5 text-xs ${m.healAt === v ? 'btn-gold' : 'btn-dark'}`}>{v * 100}%</button>)}</div>
        </div>
      </div>
      <div className="tof-frame space-y-2 rounded-xl p-3">
        <div className="text-sm font-bold text-amber-200">ไอเทมปาร์ตี้ (ใช้อัตโนมัติ)</div>
        <div className="grid grid-cols-2 gap-1.5">{ITEMS.map((it) => <div key={it.id} className="flex items-center gap-2 rounded-lg bg-black/30 p-1.5 text-xs"><ItemIcon id={it.id} size={36} /><span className="flex-1">{it.name}<div className="text-[12px] text-stone-400">{it.desc}</div></span><b>x{count(game.inv, it.id)}</b></div>)}</div>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={game.settings.autoPotion} onChange={(e) => update((g) => { g.settings.autoPotion = e.target.checked; })} /> ใช้ยาอัตโนมัติเมื่อ HP ต่ำ</label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={game.settings.autoRevive} onChange={(e) => update((g) => { g.settings.autoRevive = e.target.checked; })} /> ใช้ขนนกชุบชีวิตอัตโนมัติ</label>
        <div className="rounded-lg bg-sky-900/30 p-2 text-[13px] text-sky-100">💡 เคล็ดลับ: ให้สายโล่เปิด "ยั่วยุ" อันดับ 1, เวทย์ขาวตั้งฮีลที่ 60-80%, สายดาเมจใช้แผน "บุก" — ดูแท็บ 📊 ผลงาน หลังจบศึกเพื่อปรับแต่ง</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ CODEX
type Sel = { t: 'skill'; id: string } | { t: 'item'; id: string } | { t: 'equip'; id: string };
function Codex({ game }: { game: GameState }) {
  const [sec, setSec] = useState<'class' | 'ult' | 'tech' | 'item'>('class');
  const [sel, setSel] = useState<Sel>({ t: 'skill', id: CLASSES[game.members[0].cls].skills[0] });
  const owners = (id: string) => game.members.filter((m) => m.skills.some((s) => s.id === id) || (m.cls2 ? CLASS2[m.cls2].ult : BASE_ULT[m.cls]) === id);
  const grid = (ids: string[]) => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
      {ids.map((id) => {
        const own = owners(id);
        const on = sel.t === 'skill' && sel.id === id;
        return (
          <button key={id} onClick={() => setSel({ t: 'skill', id })} className={`relative flex flex-col items-center gap-1 rounded-xl p-1.5 transition ${on ? 'bg-amber-500/20 ring-2 ring-amber-300' : 'hover:bg-white/5'}`}>
            <SkillIcon id={id} size={50} off={!own.length} glow={!!own.length} />
            <span className="w-full truncate text-center text-[12px] leading-tight">{SKILL[id].name}</span>
            {own.length > 0 && <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border border-black bg-lime-400" />}
          </button>
        );
      })}
    </div>
  );
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        <div className="mb-2 flex gap-1 overflow-x-auto">
          {([['class', `⚔ สกิลอาชีพ`], ['ult', `⚡ ไม้ตาย (${ULT_IDS.length})`], ['tech', `✨ เทคนิค (${COMMON_SKILLS.length})`], ['item', '🎒 ไอเท็ม & อุปกรณ์']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setSec(k)} className={`btn shrink-0 px-3 py-1.5 text-sm ${sec === k ? 'btn-gold' : 'btn-dark'}`}>{l}</button>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-stone-400">
          {Object.entries(KIND_NAME).map(([k, n]) => <span key={k} className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: KIND_FRAME[k] }} />{n}</span>)}
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-lime-400" />มีในปาร์ตี้</span>
        </div>
        {sec === 'class' && (
          <div className="space-y-3">
            {CLASS_IDS.map((cid) => (
              <div key={cid} className="tof-frame rounded-xl p-2">
                <div className="mb-1 flex items-center gap-2 text-sm font-bold" style={{ color: CLASSES[cid].color }}><img src={PORTRAIT[cid]} alt="" className="h-7 w-7 rounded-md object-cover" style={{ objectPosition: '50% 18%' }} />{CLASSES[cid].name}</div>
                {grid(CLASSES[cid].skills)}
              </div>
            ))}
          </div>
        )}
        {sec === 'ult' && (
          <div className="space-y-3">
            {CLASS_IDS.map((cid) => (
              <div key={cid} className="tof-frame rounded-xl p-2">
                <div className="mb-1 flex items-center gap-2 text-sm font-bold" style={{ color: CLASSES[cid].color }}><img src={PORTRAIT[cid]} alt="" className="h-7 w-7 rounded-md object-cover" style={{ objectPosition: '50% 18%' }} />{CLASSES[cid].name} → {CLASS2_OF[cid].map((k) => CLASS2[k].name).join(' / ')}</div>
                {grid([BASE_ULT[cid], ...CLASS2_OF[cid].map((k) => CLASS2[k].ult)])}
              </div>
            ))}
          </div>
        )}
        {sec === 'tech' && (
          <div className="space-y-3">
            {[3, 2, 1, 0].map((r) => { const ids = COMMON_SKILLS.filter((id) => (SKILL[id].rarity ?? 0) === r); return (
              <div key={r} className="tof-frame rounded-xl p-2" style={{ borderColor: SKILL_RARITY[r].color + '88' }}>
                <div className="mb-1 flex items-center justify-between text-sm font-bold"><span className={r === 3 ? 'rarity-unique-text' : ''} style={{ color: r === 3 ? undefined : SKILL_RARITY[r].color }}>{['⚪', '🔷', '🌟', '💠'][r]} {SKILL_RARITY[r].name} — {SKILL_RARITY[r].th} ({ids.length})</span><span className="text-[12px] text-stone-400">โอกาสสุ่มได้ {SKILL_RARITY[r].chance}%</span></div>
                {grid(ids)}
              </div>
            ); })}
          </div>
        )}
        {sec === 'item' && (
          <div className="space-y-3">
            <div className="tof-frame rounded-xl p-2">
              <div className="mb-2 text-sm font-bold text-amber-200">ของใช้</div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
                {ITEMS.map((it) => <button key={it.id} onClick={() => setSel({ t: 'item', id: it.id })} className={`flex flex-col items-center gap-1 rounded-xl p-1.5 ${sel.t === 'item' && sel.id === it.id ? 'bg-amber-500/20 ring-2 ring-amber-300' : 'hover:bg-white/5'}`}><ItemIcon id={it.id} size={50} count={count(game.inv, it.id)} /><span className="text-center text-[12px] leading-tight">{it.name}</span></button>)}
              </div>
            </div>
            {(['weapon', 'armor', 'acc'] as const).map((sl) => (
              <div key={sl} className="tof-frame rounded-xl p-2">
                <div className="mb-2 text-sm font-bold text-amber-200">{SLOT_INFO[sl].icon} {SLOT_INFO[sl].name}</div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
                  {EQUIPS.filter((e) => e.slot === sl).map((e) => <button key={e.id} onClick={() => setSel({ t: 'equip', id: e.id })} className={`flex flex-col items-center gap-1 rounded-xl p-1.5 ${sel.t === 'equip' && sel.id === e.id ? 'bg-amber-500/20 ring-2 ring-amber-300' : 'hover:bg-white/5'}`}><EquipIcon item={e} size={50} /><span className="mt-1 text-center text-[12px] leading-tight">{e.name}</span></button>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="tof-frame order-first h-fit rounded-xl p-3 md:sticky md:top-0 md:order-none">
        {sel.t === 'skill' && (() => {
          const s = SKILL[sel.id]; const own = owners(sel.id); const e = EL_STYLE[s.element];
          return (
            <div>
              <div className="flex items-center gap-3"><SkillIcon id={s.id} size={76} /><div><div className="title-font text-xl">{s.name}</div><div className="text-[13px]" style={{ color: KIND_FRAME[s.kind] }}>{KIND_NAME[s.kind]} • <span style={{ color: e.b }}>ธาตุ{ELEMENT_NAME[s.element]}</span></div><div className="text-[12px] text-stone-400">{s.ult ? <span className="ult-text font-black">⚡ ULTIMATE — ใช้เมื่อเกจเต็ม</span> : s.cls === 'any' ? <><RarityTag id={s.id} /> เทคนิคสุ่ม {SKILL_RARITY[s.rarity ?? 0].chance}%</> : `สกิลอาชีพ ${CLASSES[s.cls].name}`}</div></div></div>
              <div className="mt-3 rounded-lg bg-black/30 p-2 text-sm">{s.desc}</div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[13px]">
                <div className="rounded-lg bg-black/30 p-1.5">🎯 {TARGET_NAME[s.target]}</div>
                <div className="rounded-lg bg-black/30 p-1.5">💥 พลัง {s.power ? `${Math.round(s.power * 100)}%${s.hits ? ` x${s.hits}` : ''}` : '-'}</div>
                <div className="rounded-lg bg-black/30 p-1.5 text-sky-300">🔷 MP {s.mp}</div>
                <div className="rounded-lg bg-black/30 p-1.5">⏳ คูลดาวน์ {s.cd}</div>
              </div>
              {s.effects && <div className="mt-2 space-y-0.5 text-[13px]">{s.effects.map((ef, i) => <div key={i} className={STATUS_INFO[ef.type].bad ? 'text-red-300' : 'text-sky-300'}>{STATUS_INFO[ef.type].icon} {STATUS_INFO[ef.type].name} {Math.round(ef.chance * 100)}% • {ef.turns} เทิร์น</div>)}</div>}
              {(s.lifesteal || s.pierce || s.critBonus || s.cleanse || s.revive || s.gold) && <div className="mt-1 text-[13px] text-amber-200">{s.lifesteal ? `ดูดเลือด ${s.lifesteal * 100}% ` : ''}{s.pierce ? `เจาะเกราะ ${s.pierce * 100}% ` : ''}{s.critBonus ? `คริ +${s.critBonus}% ` : ''}{s.cleanse ? 'ล้างสถานะ ' : ''}{s.revive ? `ชุบชีวิต ${s.revive * 100}% ` : ''}{s.gold ? 'ได้ทอง ' : ''}</div>}
              <div className="mt-3 border-t border-white/10 pt-2 text-[13px]">
                <div className="mb-1 font-bold text-amber-200">ผู้ที่มีสกิลนี้</div>
                {own.length ? own.map((m) => { const lv = m.skills.find((x) => x.id === s.id)?.level ?? 1; return <div key={m.id} className="flex items-center gap-2 py-0.5"><img src={PORTRAIT[m.cls]} alt="" className="h-6 w-6 rounded object-cover" style={{ objectPosition: '50% 18%' }} />{m.name}<span className="ml-auto text-amber-300">{'★'.repeat(lv)}</span></div>; }) : <div className="text-stone-500">ยังไม่มีใครในปาร์ตี้ — {s.cls === 'any' ? 'เรียนได้ที่สำนักฝึก' : `ต้องมีอาชีพ ${CLASSES[s.cls].name}`}</div>}
              </div>
            </div>
          );
        })()}
        {sel.t === 'item' && (() => { const it = ITEMS.find((x) => x.id === sel.id)!; return <div><div className="flex items-center gap-3"><ItemIcon id={it.id} size={76} /><div><div className="title-font text-xl">{it.name}</div><div className="text-sm text-stone-300">มีอยู่ x{count(game.inv, it.id)}</div></div></div><div className="mt-3 rounded-lg bg-black/30 p-2 text-sm">{it.desc}</div><div className="mt-2 text-[13px] text-stone-400">ราคา {it.price} 🪙 • ใช้อัตโนมัติในการต่อสู้ (ตั้งค่าได้ในแท็บแผนรบ)</div></div>; })()}
        {sel.t === 'equip' && (() => { const e = EQUIPS.find((x) => x.id === sel.id)!; return <div><div className="flex items-center gap-3"><EquipIcon item={e} size={76} /><div><div className="title-font text-xl">{e.name}</div><div className="text-sm text-stone-300">{SLOT_INFO[e.slot].name} ระดับ {e.tier}</div></div></div><div className="mt-3 space-y-0.5 rounded-lg bg-black/30 p-2 text-sm text-lime-300">{Object.entries(e.bonus).map(([k, v]) => <div key={k}>{STAT_NAME[k as keyof Stats]} +{v}</div>)}</div><div className="mt-2 text-[13px] text-stone-400">ราคาพื้นฐาน {e.price} 🪙 • ระดับ ✦หายาก / ✦✦มหากาพย์ ได้จากการชนะศึก (ค่าสูงขึ้น 30-65%)</div></div>; })()}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ CLASS CHANGE
function ClassChange({ m, mu, toast }: { m: Member; mu: (fn: (mm: Member) => void) => void; toast: (s: string) => void }) {
  const opts = CLASS2_OF[m.cls];
  const ready = m.level >= CLASS2_LEVEL;
  return (
    <div className="tof-frame mt-3 rounded-xl p-3">
      <div className="mb-2 flex items-center justify-between"><div className="text-sm font-bold text-amber-200">🔱 เปลี่ยนคลาส (Class 2)</div><div className="text-[12px] text-stone-400">ต้องการ Lv {CLASS2_LEVEL}</div></div>
      {m.cls2 ? (
        <div className="flex items-center gap-3 rounded-xl p-2" style={{ background: `linear-gradient(90deg, ${CLASS2[m.cls2].color}33, transparent)` }}>
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border-2 text-3xl" style={{ borderColor: CLASS2[m.cls2].color }}>{CLASS2[m.cls2].icon}</div>
          <div><div className="title-font text-lg" style={{ color: CLASS2[m.cls2].color }}>{CLASS2[m.cls2].name} <span className="text-sm text-stone-400">{CLASS2[m.cls2].en}</span></div><div className="text-[13px] text-stone-300">{CLASS2[m.cls2].desc}</div></div>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {opts.map((k) => { const c2 = CLASS2[k]; return (
            <div key={k} className={`rounded-xl border-2 p-2.5 ${ready ? '' : 'opacity-60'}`} style={{ borderColor: c2.color + 'aa', background: `linear-gradient(160deg, ${c2.color}22, rgba(0,0,0,.35))` }}>
              <div className="flex items-center gap-2"><span className="text-3xl">{c2.icon}</span><div><div className="font-bold" style={{ color: c2.color }}>{c2.name}</div><div className="text-[12px] text-stone-400">{c2.en}</div></div></div>
              <div className="mt-1 text-[13px] text-stone-200">{c2.desc}</div>
              <div className="mt-1 flex flex-wrap gap-1 text-[12px]">{Object.entries(c2.mul).map(([st, v]) => <span key={st} className="rounded bg-lime-900/50 px-1.5 text-lime-300">{st.toUpperCase()} +{Math.round(((v as number) - 1) * 100)}%</span>)}</div>
              <div className="mt-1.5 flex items-center gap-2 text-[12px]"><SkillIcon id={c2.skill} size={30} /><span>สกิลใหม่: <b>{SKILL[c2.skill].name}</b></span></div>
              <div className="mt-1 flex items-center gap-2 text-[12px]"><SkillIcon id={c2.ult} size={30} /><span><span className="ult-text font-black">ULT</span> {SKILL[c2.ult].name}</span></div>
              <button disabled={!ready} className="btn btn-gold mt-2 w-full py-1.5 text-sm" onClick={(e) => {
                mu((x) => { x.cls2 = k; const has = x.skills.find((sl) => sl.id === c2.skill); if (has) has.level = Math.min(5, has.level + 1); else x.skills.push({ id: c2.skill, enabled: true, level: 1 }); const st = memberStats(x); x.hp = st.hp; x.mp = st.mp; });
                fx.burst(e.clientX, e.clientY, c2.color, 60, { speed: 7, up: true, shape: 1 }); fx.shake(8, 14); toast(`🔱 ${m.name} เปลี่ยนคลาสเป็น ${c2.name}!`);
              }}>{ready ? 'เลือกสายนี้' : `🔒 Lv ${CLASS2_LEVEL}`}</button>
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}
