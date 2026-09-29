import { useState } from 'react';
import type { GameState, LogEntry } from '../game/types';
import { Modal } from './Panels';

const STYLE: Record<LogEntry['type'], { icon: string; color: string; label: string }> = {
  win: { icon: '⚔️', color: '#4ade80', label: 'ชนะ' },
  npc: { icon: '🚩', color: '#f6c453', label: 'ล้มปาร์ตี้' },
  lose: { icon: '💀', color: '#f87171', label: 'แพ้' },
  quest: { icon: '📜', color: '#38bdf8', label: 'เควส' },
  level: { icon: '⬆️', color: '#a3e635', label: 'เลเวล' },
  city: { icon: '🏙', color: '#d6d3c4', label: 'เมือง' },
  loot: { icon: '🎁', color: '#c084fc', label: 'ไอเทม' },
  info: { icon: '📌', color: '#fde68a', label: 'ข้อมูล' },
};
const FILTERS: [string, string, LogEntry['type'][]][] = [
  ['all', 'ทั้งหมด', []], ['battle', '⚔ การต่อสู้', ['win', 'npc', 'lose']], ['quest', '📜 เควส', ['quest']], ['other', '🎁 อื่นๆ', ['loot', 'level', 'city', 'info']],
];

export function LogTicker({ game, onOpen }: { game: GameState; onOpen: () => void }) {
  const items = game.log.slice(0, 13);
  if (!items.length) return null;
  return (
    <button onClick={onOpen} className="absolute bottom-[6.2rem] left-2 z-10 max-h-[calc(100%-13rem)] w-[min(21rem,calc(100%-1rem))] overflow-hidden rounded-xl border border-[#6b5b2e] bg-black/65 p-2 text-left backdrop-blur-sm transition hover:bg-black/80">
      <div className="mb-1 flex items-center justify-between text-[13px] font-bold text-amber-300"><span>📖 บันทึกการเดินทาง</span><span className="text-stone-400">ดูทั้งหมด ›</span></div>
      {items.map((e, i) => (
        <div key={e.id} className="flex gap-1.5 text-[13px] leading-snug" style={{ opacity: 1 - i * 0.055 }}>
          <span>{STYLE[e.type].icon}</span><span className="truncate" style={{ color: STYLE[e.type].color }}>{e.text}</span>
        </div>
      ))}
    </button>
  );
}

export default function AdventureLog({ game, onClose }: { game: GameState; onClose: () => void }) {
  const [f, setF] = useState('all');
  const types = FILTERS.find((x) => x[0] === f)![2];
  const list = game.log.filter((e) => !types.length || types.includes(e.type));
  const s = game.stats;
  return (
    <Modal title="📖 บันทึกการเดินทาง" onClose={onClose}>
      <div className="mb-2 grid grid-cols-4 gap-1.5 text-center text-[13px]">
        <div className="rounded-lg bg-black/30 p-1.5">⚔ ศึก<br /><b className="text-base">{s.battles}</b></div>
        <div className="rounded-lg bg-black/30 p-1.5">🏆 ชนะ<br /><b className="text-base text-lime-300">{s.wins}</b></div>
        <div className="rounded-lg bg-black/30 p-1.5">🚩 ล้มปาร์ตี้<br /><b className="text-base text-amber-300">{s.npcWins}</b></div>
        <div className="rounded-lg bg-black/30 p-1.5">💀 ศัตรู<br /><b className="text-base text-red-300">{s.kills}</b></div>
      </div>
      <div className="mb-2 flex gap-1 overflow-x-auto">{FILTERS.map(([k, l]) => <button key={k} onClick={() => setF(k)} className={`btn shrink-0 px-3 py-1 text-xs ${f === k ? 'btn-gold' : 'btn-dark'}`}>{l}</button>)}</div>
      <div className="relative space-y-1.5 pl-4">
        <div className="absolute bottom-0 left-[7px] top-0 w-px bg-amber-500/30" />
        {list.map((e) => (
          <div key={e.id} className="relative rounded-lg bg-black/30 px-3 py-1.5">
            <div className="absolute -left-[13px] top-2.5 h-2.5 w-2.5 rounded-full border-2 border-[#1a1408]" style={{ background: STYLE[e.type].color }} />
            <div className="flex items-baseline gap-2 text-sm"><span>{STYLE[e.type].icon}</span><span className="font-bold" style={{ color: STYLE[e.type].color }}>{e.text}</span><span className="ml-auto shrink-0 text-[12px] text-stone-500">วันที่ {e.day}</span></div>
            {e.sub && <div className="pl-6 text-[13px] text-stone-400">{e.sub}</div>}
          </div>
        ))}
        {!list.length && <div className="py-4 text-center text-sm text-stone-500">ยังไม่มีบันทึก</div>}
      </div>
    </Modal>
  );
}
