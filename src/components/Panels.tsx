import { type ReactNode } from 'react';
import { CITY, CITY_INFO } from '../game/data';
import { pick } from '../game/engine';
import { rankOf } from '../game/store';
import type { EquipItem, GameState } from '../game/types';

type Update = (fn: (g: GameState) => void) => void;

/**
 * Popup shell.
 *
 * `stack` draws two offset sheets behind the panel so the window reads as a
 * pile of layered menus rather than a floating rectangle — the town menu uses
 * it, small dialogs do not.
 */
export function Modal({ title, onClose, children, wide, stack }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; stack?: boolean }) {
  return (
    <div className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onPointerDown={onClose}>
      <div className={`relative flex w-full justify-center ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'}`}>
        {stack && (<>
          <div aria-hidden className="panel pointer-events-none absolute inset-x-3 bottom-0 -top-3 rounded-2xl opacity-75" />
          <div aria-hidden className="panel pointer-events-none absolute inset-x-7 bottom-0 -top-6 rounded-2xl opacity-45" />
        </>)}
        <div className="panel slide-up relative flex max-h-[88vh] w-full flex-col rounded-t-2xl sm:rounded-2xl" onPointerDown={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-[#6b5b2e] px-4 py-2.5">
            <div className="title-font text-lg text-amber-300">{title}</div>
            <button className="btn btn-dark px-3 py-1 text-sm" onClick={onClose}>✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">{children}</div>
        </div>
      </div>
    </div>
  );
}



// ------------------------------------------------------------------ CITY
/**
 * Bounty board. Reached from Guild in the town menu; the other town screens
 * (inn, shop, market, dojo) now live in TownMenu, so this one is quests only.
 *
 * This renders bare content, not a `Modal`: the town menu is already a popup,
 * and wrapping a popup in a popup stacked two `z-50` overlays and two backdrops
 * on top of each other.
 */
export function CityPanel({ game, update, toast }: { game: GameState; update: Update; toast: (s: string) => void }) {
  const city = CITY[game.location];
  const info = CITY_INFO[city.id];
  const offers = game.cityQuests[city.id] ?? [];

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-xl p-2.5" style={{ background: `linear-gradient(90deg, ${info.color}33, rgba(0,0,0,.25))`, border: `1px solid ${info.color}66` }}>
        <span className="text-2xl">📜</span>
        <span className="min-w-0 flex-1 text-[13px] text-stone-300">ป้ายรับงานของสมาคมการค้า — รับได้สูงสุด 4 งานพร้อมกัน</span>
      </div>
      <div className="mb-2 text-right text-sm">🪙 <b className="text-amber-300">{game.gold.toLocaleString('en-US')}</b></div>
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
                <button className="btn btn-green text-sm" disabled={game.quests.length >= 4} onClick={() => {
                  update((g) => { g.quests.push(q); g.cityQuests[city.id] = g.cityQuests[city.id].filter((x) => x.id !== q.id); });
                  toast('รับเควส: ' + q.title);
                }}>รับ</button>
              </div>
            ))}
            {!offers.length && <div className="text-sm text-stone-500">ไม่มีเควสเหลือ — กลับมาใหม่ภายหลัง</div>}
          </div>
        </div>
        <QuestList game={game} update={update} />
      </div>
    </div>
  );
}

export const bonusText = (e: EquipItem) => Object.entries(e.bonus).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(' ');


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
