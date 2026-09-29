import { ITEMS, RARITY, SKILL, SKILL_RARITY } from '../game/data';
import type { EquipItem } from '../game/types';

export const EL_STYLE: Record<string, { a: string; b: string; sym: string }> = {
  phys: { a: '#3a2a18', b: '#f0c878', sym: '⚔' },
  fire: { a: '#4a0e04', b: '#ff8a3a', sym: '火' },
  ice: { a: '#082444', b: '#8fe4ff', sym: '氷' },
  thunder: { a: '#332404', b: '#ffe84a', sym: '雷' },
  dark: { a: '#180830', b: '#b07aff', sym: '闇' },
  holy: { a: '#403208', b: '#fff3b0', sym: '光' },
  poison: { a: '#0e2e08', b: '#9be04a', sym: '毒' },
  wind: { a: '#042e2a', b: '#6ef0d8', sym: '風' },
};
export const KIND_FRAME: Record<string, string> = { phys: '#e0a85a', mag: '#c9a0ff', heal: '#7ee0a0', buff: '#7ab8ff', debuff: '#e07aff' };

function Pattern({ kind, color }: { kind: string; color: string }) {
  const st = { stroke: color, strokeWidth: 1.4, fill: 'none', opacity: 0.55 } as const;
  return (
    <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full">
      {kind === 'phys' && <><path d="M-4 30 L30 -4 M4 44 L44 4 M-4 44 L44 -4" {...st} /><path d="M10 50 L50 10" {...st} /></>}
      {kind === 'mag' && <><circle cx="20" cy="20" r="15" {...st} /><circle cx="20" cy="20" r="10" {...st} strokeDasharray="2 2" /><path d="M20 3 L34 28 L6 28 Z" {...st} /></>}
      {kind === 'heal' && <><path d="M20 4 V36 M4 20 H36" {...st} strokeWidth={5} opacity={0.22} /><circle cx="20" cy="20" r="14" {...st} /></>}
      {kind === 'buff' && <><path d="M8 30 L20 20 L32 30 M8 20 L20 10 L32 20" {...st} strokeWidth={2.5} /></>}
      {kind === 'debuff' && <><path d="M8 10 L20 20 L32 10 M8 20 L20 30 L32 20" {...st} strokeWidth={2.5} /></>}
    </svg>
  );
}

export function SkillIcon({ id, size = 44, level, off, className = '', glow = true }: { id: string; size?: number; level?: number; off?: boolean; className?: string; glow?: boolean }) {
  const s = SKILL[id];
  if (!s) return null;
  const e = EL_STYLE[s.element]; const rar = s.rarity ?? 0; const rc = SKILL_RARITY[rar].color;
  const f = rar > 0 ? rc : KIND_FRAME[s.kind];
  const pad = Math.max(2, Math.round(size * (rar > 0 ? 0.085 : 0.065)));
  const frameBg = rar === 3 ? 'conic-gradient(from var(--ang), #ff3d7f, #ffb020, #fff27a, #3ce0a0, #3b9cff, #b06aff, #ff3d7f)' : rar === 2 ? `conic-gradient(from var(--ang), #ffb020, #fff0a0, #c07000, #ffb020, #fff0a0, #ffb020)` : `linear-gradient(145deg, ${f}, #2a2214 42%, #120e08 58%, ${f})`;
  return (
    <div className={`relative shrink-0 ${off ? 'grayscale opacity-60' : ''} ${className}`} style={{ width: size, height: size }}>
      <div className={`absolute inset-0 rounded-[24%] ${rar >= 2 && !off ? 'rarity-spin' : ''}`} style={{ background: frameBg, padding: pad, boxShadow: glow && !off ? `0 0 ${size * (rar >= 2 ? 0.4 : 0.22)}px ${rar > 0 ? rc : e.b}${rar >= 2 ? 'aa' : '55'}, inset 0 0 0 1px rgba(0,0,0,.6)` : 'inset 0 0 0 1px rgba(0,0,0,.6)' }}>
        <div className="relative h-full w-full overflow-hidden rounded-[18%]" style={{ background: `radial-gradient(circle at 50% 42%, ${e.b} 0%, ${e.a} 62%, #000 100%)` }}>
          <Pattern kind={s.kind} color={e.b} />
          <div className="absolute inset-0 flex items-center justify-center leading-none" style={{ fontSize: size * 0.5, filter: `drop-shadow(0 0 ${Math.max(2, size * 0.07)}px ${e.b}) drop-shadow(0 ${Math.max(1, size * 0.03)}px 0 rgba(0,0,0,.8))` }}>{s.icon}</div>
          <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(255,255,255,.38), rgba(255,255,255,0) 42%)' }} />
          <div className="pointer-events-none absolute inset-0 rounded-[18%]" style={{ boxShadow: 'inset 0 -6px 10px rgba(0,0,0,.45)' }} />
        </div>
      </div>
      {size >= 34 && (
        <div className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border font-bold leading-none" style={{ width: size * 0.34, height: size * 0.34, fontSize: size * 0.19, background: e.a, borderColor: e.b, color: e.b }}>{e.sym}</div>
      )}
      {level !== undefined && size >= 34 && (
        <div className="absolute -left-1 -top-1 rounded-md border border-amber-300 bg-black/85 px-1 font-bold leading-tight text-amber-300" style={{ fontSize: Math.max(10, size * 0.22) }}>{level}</div>
      )}
    </div>
  );
}

const ITEM_COL: Record<string, string> = { potion: '#4ade80', hipotion: '#22c55e', ether: '#60a5fa', phoenix: '#fbbf24' };
export function ItemIcon({ id, size = 44, count }: { id: string; size?: number; count?: number }) {
  const it = ITEMS.find((x) => x.id === id)!;
  const c = ITEM_COL[id] ?? '#fff';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full" style={{ background: `linear-gradient(145deg, #f6c453, #5a4012 50%, #f6c453)`, padding: Math.max(2, size * 0.06) }}>
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full" style={{ background: `radial-gradient(circle at 50% 40%, ${c}, #0a1a10 75%)`, fontSize: size * 0.52 }}>
          <span style={{ filter: `drop-shadow(0 0 4px ${c}) drop-shadow(0 2px 0 #000)` }}>{it.icon}</span>
          <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(255,255,255,.4), transparent 45%)' }} />
        </div>
      </div>
      {count !== undefined && <div className="absolute -bottom-1 -right-1 rounded-md border border-white/40 bg-black/85 px-1 text-[12px] font-bold leading-tight">x{count}</div>}
    </div>
  );
}

const SLOT_BG: Record<string, string> = { weapon: '#5a1e12', armor: '#12304a', acc: '#3a1a4a' };
export function EquipIcon({ item, size = 44 }: { item: EquipItem; size?: number }) {
  const r = RARITY[item.rarity];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-[20%]" style={{ background: `linear-gradient(145deg, ${r.color}, #1a1a1a 50%, ${r.color})`, padding: Math.max(2, size * 0.06), boxShadow: item.rarity ? `0 0 ${size * 0.25}px ${r.color}88` : 'none' }}>
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[16%]" style={{ background: `radial-gradient(circle at 50% 40%, ${SLOT_BG[item.slot]}, #000 90%)`, fontSize: size * 0.5 }}>
          <span style={{ filter: 'drop-shadow(0 2px 0 #000)' }}>{item.icon}</span>
          <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(255,255,255,.35), transparent 45%)' }} />
        </div>
      </div>
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap leading-none text-amber-300" style={{ fontSize: Math.max(9, size * 0.2), textShadow: '0 1px 0 #000' }}>{'★'.repeat(item.tier)}</div>
    </div>
  );
}

export function RarityTag({ id, className = '' }: { id: string; className?: string }) {
  const s = SKILL[id]; if (!s || s.cls !== 'any') return null;
  const r = SKILL_RARITY[s.rarity ?? 0];
  return <span className={`inline-block rounded px-1.5 text-[11px] font-bold leading-snug ${s.rarity === 3 ? 'rarity-unique-text' : ''} ${className}`} style={{ color: s.rarity === 3 ? undefined : r.color, border: `1px solid ${r.color}88`, background: `${r.color}22` }}>{r.name}</span>;
}
