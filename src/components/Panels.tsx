import { useState, type ReactNode } from 'react';
import { CITY, CLASSES, EQUIPS, ITEMS, SKILL, CITY_INFO, PERK_INFO } from '../game/data';
import { makeEquip, memberStats, pick, priceOf as basePrice, randomCommon } from '../game/engine';
import { fx } from '../game/fx';
import { EquipIcon, ItemIcon, RarityTag, SkillIcon } from './Icons';
import { MarketPanel } from './MarketPanel';
import { add as addItem, count } from '../game/inv';
import { advanceTime, rankOf, restAtInn } from '../game/store';
import { INN_WAKE, TRAIN_MINUTES, fmtDuration, fmtTime } from '../game/time';
import type { EquipItem, GameState } from '../game/types';

type Update = (fn: (g: GameState) => void) => void;

export function Modal({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onPointerDown={onClose}>
      <div className={`panel slide-up flex max-h-[88vh] w-full flex-col rounded-t-2xl sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'}`} onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#6b5b2e] px-4 py-2.5">
          <div className="title-font text-lg text-amber-300">{title}</div>
          <button className="btn btn-dark px-3 py-1 text-sm" onClick={onClose}>✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{children}</div>
      </div>
    </div>
  );
}

function Tabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="mb-3 flex gap-1 overflow-x-auto">
      {tabs.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} className={`btn shrink-0 px-3 py-1.5 text-sm ${value === k ? 'btn-gold' : 'btn-dark'}`}>{l}</button>
      ))}
    </div>
  );
}

const coinFx = (e?: { clientX: number; clientY: number }) => { if (e) fx.burst(e.clientX, e.clientY, '#f6c453', 14, { speed: 4, shape: 1, up: true }); };

// ------------------------------------------------------------------ CITY
export function CityPanel({ game, update, onClose, toast }: { game: GameState; update: Update; onClose: () => void; toast: (s: string) => void }) {
  const [tab, setTab] = useState<'quest' | 'shop' | 'market' | 'inn' | 'train'>('quest');
  const city = CITY[game.location];
  const info = CITY_INFO[city.id];
  const priceOf = (g: GameState, p: number, kind: 'gear' | 'item' | 'other' = 'other') => Math.round(basePrice(g, p) * (info.perk === kind ? (kind === 'gear' ? 0.75 : 0.65) : 1));
  const offers = game.cityQuests[city.id] ?? [];
  const [who, setWho] = useState(game.members[0].id);
  const [trainOpts, setTrainOpts] = useState<{ mid: string; slot: number; opts: string[] } | null>(null);
  const maxTier = Math.min(5, 1 + Math.floor(city.tier / 1.7));
  const innCost = info.perk === 'inn' ? 0 : priceOf(game, 12 + city.tier * 10);
  const trainCost = priceOf(game, 60 + city.tier * 35);
  const member = game.members.find((m) => m.id === who)!;

  return (
    <Modal title={<>{info.emblem} {city.name} <span className="text-xs text-stone-400">อันตราย ระดับ {city.tier}</span></>} onClose={onClose} wide>
      <div className="mb-3 flex items-center gap-3 rounded-xl p-2.5" style={{ background: `linear-gradient(90deg, ${info.color}44, rgba(0,0,0,.25))`, border: `1px solid ${info.color}88` }}>
        <div className="text-4xl">{info.emblem}</div>
        <div className="min-w-0 flex-1"><div className="font-bold" style={{ color: info.color }}>{info.title}</div><div className="text-[13px] text-stone-300">{info.desc}</div></div>
        <div className="shrink-0 rounded-lg bg-black/40 px-2 py-1 text-center text-[12px]"><div className="text-lg">{PERK_INFO[info.perk].icon}</div><div className="font-bold text-amber-200">{PERK_INFO[info.perk].name}</div><div className="text-lime-300">{PERK_INFO[info.perk].desc}</div></div>
      </div>
      <Tabs tabs={[['quest', '📜 เควส'], ['shop', '🛒 ร้านค้า'], ['market', '🏦 ตลาด'], ['inn', '🛏 โรงเตี๊ยม'], ['train', '📖 สำนักฝึก']]} value={tab} onChange={setTab} />
      <div className="mb-2 text-right text-sm">🪙 <b className="text-amber-300">{game.gold}</b>{game.members.some((m) => m.cls === 'merchant') && <span className="ml-2 text-xs text-lime-300">(พ่อค้าลด 15%)</span>}</div>

      {tab === 'quest' && (
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-sm font-bold text-amber-200">เควสที่รับได้ ({game.quests.length}/4)</div>
            <div className="space-y-2">
              {offers.map((q) => (
                <div key={q.id} className="flex items-center gap-2 rounded-xl bg-black/30 p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{q.title}</div>
                    <div className="text-xs text-stone-400">{q.desc}</div>
                    <div className="text-xs">🪙{q.rewardGold} • 🎖{q.rewardFame} • ⭐{q.rewardXp}</div>
                  </div>
                  <button className="btn btn-green text-sm" disabled={game.quests.length >= 4} onClick={() => { update((g) => { g.quests.push(q); g.cityQuests[city.id] = g.cityQuests[city.id].filter((x) => x.id !== q.id); }); toast('รับเควส: ' + q.title); }}>รับ</button>
                </div>
              ))}
              {!offers.length && <div className="text-sm text-stone-500">ไม่มีเควสเหลือ — กลับมาใหม่ภายหลัง</div>}
            </div>
          </div>
          <QuestList game={game} update={update} />
        </div>
      )}

      {tab === 'shop' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {ITEMS.map((it) => (
              <button key={it.id} className="flex items-center gap-2 rounded-xl bg-black/30 p-2 text-left transition hover:bg-black/50 active:scale-95 disabled:opacity-40" disabled={game.gold < priceOf(game, it.price, 'item')}
                onClick={(e) => { update((g) => { g.gold -= priceOf(g, it.price, 'item'); addItem(g.inv, it.id); }); coinFx(e); }}>
                <ItemIcon id={it.id} size={40} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{it.name} <span className="text-stone-400">x{count(game.inv, it.id)}</span></span><span className="block text-[13px] text-stone-400">{it.desc}</span></span>
                <span className="text-sm text-amber-300">{priceOf(game, it.price, 'item')}</span>
              </button>
            ))}
          </div>
          <div>
            <div className="mb-1 text-sm font-bold text-amber-200">อุปกรณ์ (สูงสุดระดับ {maxTier}) — สวมให้:</div>
            <MemberPicker game={game} value={who} onChange={setWho} />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {EQUIPS.filter((e) => e.tier <= maxTier).map((e) => {
                const cur = member.equip[e.slot];
                const owned = cur?.id === e.id;
                return (
                  <button key={e.id} disabled={owned || game.gold < priceOf(game, e.price, 'gear')} className="flex items-center gap-2 rounded-xl bg-black/30 p-2 text-left transition hover:bg-black/50 active:scale-95 disabled:opacity-40"
                    onClick={(ev) => { update((g) => { const m = g.members.find((x) => x.id === who)!; const sBefore = memberStats(m); g.gold -= priceOf(g, e.price, 'gear'); const old = m.equip[e.slot]; if (old) g.bag.push(old); m.equip[e.slot] = makeEquip(e, 0); const sAfter = memberStats(m); m.hp = Math.min(sAfter.hp, m.hp + Math.max(0, sAfter.hp - sBefore.hp)); }); coinFx(ev); toast(`${member.name} สวม ${e.name}${cur ? ' (ของเก่าเก็บในกระเป๋า)' : ''}`); }}>
                    <EquipIcon item={e} size={42} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{e.name} <span className="text-[12px] text-amber-400">{'★'.repeat(e.tier)}</span></span>
                      <span className="block text-[13px] text-lime-300">{bonusText(e)}</span>
                      <span className="block text-[12px] text-stone-500">ตอนนี้: {cur ? cur.name : '-'}</span>
                    </span>
                    <span className="text-sm text-amber-300">{owned ? 'สวมอยู่' : priceOf(game, e.price, 'gear')}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'market' && <MarketPanel game={game} update={update} toast={toast} />}

      {tab === 'inn' && (
        <div className="space-y-3 text-center">
          <div className="text-5xl">🛏️</div>
          <div className="text-sm text-stone-300">พักผ่อนฟื้นฟู HP/MP เต็ม และชุบชีวิตสมาชิกที่ล้ม</div>
          <div className="space-y-1">
            {game.members.map((m) => { const s = memberStats(m); return <div key={m.id} className="text-xs">{CLASSES[m.cls].icon} {m.name}: <span className={m.hp <= 0 ? 'text-red-400' : ''}>{m.hp}/{s.hp}</span> HP • {m.mp}/{s.mp} MP</div>; })}
          </div>
          <div className="text-[13px] text-stone-400">ตื่นพรุ่งนี้เวลา {fmtTime(INN_WAKE)} · ปัจจุบัน {fmtTime(game.minute)}</div>
          <button className="btn btn-gold px-6 py-3 text-lg" disabled={game.gold < innCost} onClick={(e) => {
            update((g) => {
              g.gold -= innCost;
              g.members.forEach((m) => { const s = memberStats(m); m.hp = s.hp; m.mp = s.mp; m.healAt = 0; });
              restAtInn(g);
            });
            fx.burst(e.clientX, e.clientY, '#86efac', 40, { up: true, speed: 5, g: -0.03, life: 50 });
            toast(`ปาร์ตี้พักผ่อนเต็มที่! ตื่นเวลา ${fmtTime(INN_WAKE)} 💤`);
          }}>พักผ่อน ({innCost ? `${innCost} 🪙` : 'ฟรี!'})</button>
        </div>
      )}

      {tab === 'train' && (
        <div className="space-y-3">
          <div className="text-sm text-stone-300">สุ่มเปลี่ยนสกิลทั่วไป (ช่องที่ 4-5) — เลือกจาก 3 ตัวเลือก • ค่าเรียน {trainCost} 🪙 • ใช้เวลา {fmtDuration(TRAIN_MINUTES)}<br /><span className="text-[13px]">โอกาส: <b className="text-sky-400">Rare 10%</b> • <b className="text-amber-400">Legendary 4%</b> • <b className="rarity-unique-text">Unique 1%</b></span></div>
          <MemberPicker game={game} value={who} onChange={(v) => { setWho(v); setTrainOpts(null); }} />
          <div className="space-y-2">
            {member.skills.map((sl, i) => {
              const s = SKILL[sl.id];
              const innate = CLASSES[member.cls].skills.includes(sl.id);
              return (
                <div key={sl.id} className="flex items-center gap-2 rounded-xl bg-black/30 p-2">
                  <SkillIcon id={sl.id} size={42} level={sl.level} />
                  <div className="min-w-0 flex-1"><div className="text-sm font-bold">{s.name} {innate && <span className="text-[12px] text-sky-300">[อาชีพ]</span>}</div><div className="text-[13px] text-stone-400">{s.desc} • MP {s.mp}</div></div>
                  {!innate && <button className="btn btn-dark text-xs" disabled={game.gold < trainCost} onClick={() => {
                    update((g) => { g.gold -= trainCost; });
                    setTrainOpts({ mid: member.id, slot: i, opts: info.perk === 'train' ? [0, 1, 2].map(() => { const a = randomCommon(member.skills.map((x) => x.id), 1)[0]; const b2 = randomCommon(member.skills.map((x) => x.id), 1)[0]; return (SKILL[b2].rarity ?? 0) > (SKILL[a].rarity ?? 0) ? b2 : a; }).filter((v, i2, arr) => arr.indexOf(v) === i2) : randomCommon(member.skills.map((x) => x.id), 3) });
                  }}>เปลี่ยน</button>}
                </div>
              );
            })}
          </div>
          {trainOpts && trainOpts.mid === member.id && (
            <div className="pop-in rounded-xl border border-amber-500/50 bg-amber-900/20 p-2">
              <div className="mb-1 text-sm font-bold text-amber-200">เลือกสกิลใหม่:</div>
              <div className="grid gap-2 sm:grid-cols-3">
                {trainOpts.opts.map((id) => { const s = SKILL[id]; return (
                  <button key={id} className="rounded-xl bg-black/40 p-2 text-left transition hover:bg-black/60 active:scale-95" onClick={(e) => {
                    update((g) => { const m = g.members.find((x) => x.id === trainOpts.mid)!; m.skills[trainOpts.slot] = { id, enabled: true, level: 1 }; advanceTime(g, TRAIN_MINUTES); });
                    fx.burst(e.clientX, e.clientY, '#c084fc', 30, { speed: 5 }); toast(`${member.name} เรียนรู้ ${s.name}!`); setTrainOpts(null);
                  }}><div className="flex items-center gap-2 text-sm font-bold"><SkillIcon id={id} size={40} /> <span>{s.name}<br /><RarityTag id={id} /></span></div><div className="text-[13px] text-stone-400">{s.desc}</div><div className="text-[12px] text-sky-300">MP {s.mp} • CD {s.cd}</div></button>
                ); })}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export const bonusText = (e: EquipItem) => Object.entries(e.bonus).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(' ');

function MemberPicker({ game, value, onChange }: { game: GameState; value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto">
      {game.members.map((m) => (
        <button key={m.id} onClick={() => onChange(m.id)} className={`btn shrink-0 px-2.5 py-1 text-xs ${value === m.id ? 'btn-gold' : 'btn-dark'}`}>{CLASSES[m.cls].icon} {m.name}</button>
      ))}
    </div>
  );
}

export function QuestList({ game, update }: { game: GameState; update: Update }) {
  return (
    <div>
      <div className="mb-1 text-sm font-bold text-amber-200">เควสที่ทำอยู่</div>
      <div className="space-y-2">
        {game.quests.map((q) => (
          <div key={q.id} className="rounded-xl bg-black/30 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold">{q.title}</div>
              <button className="text-xs text-red-300 underline" onClick={() => update((g) => { g.quests = g.quests.filter((x) => x.id !== q.id); })}>ยกเลิก</button>
            </div>
            <div className="text-xs text-stone-400">{q.desc}{q.targetCity && ` (📍${CITY[q.targetCity].name})`}</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="bar flex-1"><div style={{ width: `${(q.progress / q.target) * 100}%`, background: '#38bdf8' }} /></div>
              <span className="text-xs">{q.progress}/{q.target}</span>
            </div>
            <div className="text-[13px] text-stone-300">รางวัล: 🪙{q.rewardGold} 🎖{q.rewardFame} ⭐{q.rewardXp}</div>
          </div>
        ))}
        {!game.quests.length && <div className="text-sm text-stone-500">ยังไม่มีเควส — ไปรับที่เมือง</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ RANK
export function RankPanel({ game, onClose }: { game: GameState; onClose: () => void }) {
  const rows = [...game.npcs.map((n) => ({ id: n.id, name: n.name, icon: n.icon, level: n.level, fame: n.fame, me: false, color: n.color })),
    { id: 'me', name: game.partyName, icon: '🚩', level: Math.round(game.members.reduce((a, m) => a + m.level, 0) / game.members.length), fame: game.fame, me: true, color: '#f6c453' }]
    .sort((a, b) => b.fame - a.fame);
  const bounty = new Set(game.quests.map((q) => q.targetParty));
  return (
    <Modal title="🏆 ทำเนียบปาร์ตี้แห่งสยาม" onClose={onClose}>
      <div className="mb-2 text-center text-sm text-stone-300">อันดับของคุณ: <b className="text-2xl text-amber-300">#{rankOf(game)}</b> — เอาชนะปาร์ตี้คู่แข่งเพื่อชิงชื่อเสียง!</div>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={r.id} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${r.me ? 'pulse-glow border border-amber-400 bg-amber-900/40' : 'bg-black/30'}`}>
            <span className="w-7 text-center font-bold text-amber-200">{i === 0 ? '👑' : `#${i + 1}`}</span>
            <span className="text-lg">{r.icon}</span>
            <span className="flex-1 truncate font-bold" style={{ color: r.color }}>{r.name}{bounty.has(r.id) && ' 🎯'}</span>
            <span className="text-xs text-stone-400">Lv{r.level}</span>
            <span className="w-16 text-right text-sm">🎖{r.fame}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export const randomTip = () => pick([
  'ความเร็ว (SPD) สูง = ได้เทิร์นบ่อยขึ้น',
  'ตั้งให้อัศวินโล่ใช้ "ยั่วยุ" เป็นอันดับแรกเพื่อปกป้องทีม',
  'ศัตรูมีจุดอ่อนธาตุ — โจมตีถูกธาตุแรงขึ้น 40%',
  'เอาชนะปาร์ตี้คู่แข่งจะชิงชื่อเสียงของพวกเขามา',
  'พักที่โรงเตี๊ยมเพื่อชุบชีวิตเพื่อนที่ล้ม',
  'สำนักฝึกช่วยเปลี่ยนสกิลสุ่มให้เข้ากับทีม',
]);
