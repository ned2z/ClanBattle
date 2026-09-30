import { useEffect, useState } from 'react';
import { CLASSES, CLASS_IDS, CITY, MEMBER_NAMES, OUTLINE, MAP_W, MAP_H } from '../game/data';
import { shuffle } from '../game/engine';
import { fx } from '../game/fx';
import { readSave, savedWhen, type SaveEnvelope } from '../game/save';
import { fmtTime } from '../game/time';
import type { HighScore } from '../game/store';
import type { ClassId } from '../game/types';
import { KEYART, PORTRAIT } from '../game/portraits';

export interface Setup { partyName: string; classes: ClassId[]; names: string[] }
export const DEFAULT_SETUP: Setup = { partyName: 'กองทัพพยัคฆ์สยาม', classes: ['shield', 'berserker', 'blackmage', 'whitemage'], names: ['ภูผา', 'สายฟ้า', 'จันทร์', 'แก้ว'] };

const pts = OUTLINE.map((p) => `${p.x},${p.y}`).join(' ');

export function HighScoreTable({ list, highlight }: { list: HighScore[]; highlight?: HighScore | null }) {
  if (!list.length) return <div className="py-3 text-center text-sm text-stone-500">ยังไม่มีสถิติ — เป็นคนแรกสิ!</div>;
  return (
    <div className="space-y-1">
      {list.map((h, i) => {
        const me = highlight && h.date === highlight.date && h.score === highlight.score;
        return (
          <div key={i + h.date} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm ${me ? 'pulse-glow border border-amber-400 bg-amber-900/40' : 'bg-black/30'}`}>
            <span className="w-6 text-center font-bold text-amber-300">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
            <span className="flex-1 truncate">{h.top && '👑 '}{h.name}</span>
            <span className="text-[13px] text-stone-400">Lv{h.level} • #{h.rank}</span>
            <span className="w-16 text-right font-bold text-lime-300">{h.score}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The one saved journey, if there is one. Read on mount rather than held in
 * state: it cannot change while the title screen is up, and re-reading keeps
 * the component free of an effect that only exists to avoid a stale read.
 */
function ResumeCard({ env, onResume }: { env: SaveEnvelope; onResume: () => void }) {
  const s = env.summary;
  const when = savedWhen(env.savedAt);
  return (
    <div className="panel pop-in rounded-2xl p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-sky-300">
        <span>💾 การเดินทางที่บันทึกไว้</span>
        {when && <span className="text-[11px] font-normal text-stone-500">{when}</span>}
      </div>
      <div className="mb-2 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-amber-200">{s.partyName}</div>
          <div className="text-[12px] text-stone-400">
            {CITY[s.location]?.name ?? s.location} · วันที่ {s.day} {fmtTime(s.minute)} · Lv{s.level}
          </div>
        </div>
        <div className="shrink-0 text-right text-[12px]">
          <div className="text-amber-300">🪙 {s.gold.toLocaleString('en-US')}</div>
          <div className="text-orange-300">🎖 {s.fame}</div>
        </div>
      </div>
      <button className="btn btn-gold w-full py-2.5" onClick={onResume}>📖 เล่นต่อ</button>
    </div>
  );
}

export default function StartScreen({ onStart, onResume, hs, last }: { onStart: (s: Setup) => void; onResume: () => void; hs: HighScore[]; last: Setup }) {
  const [mode, setMode] = useState<'title' | 'build'>('title');
  const [setup, setSetup] = useState<Setup>(last);
  const [saved, setSaved] = useState<SaveEnvelope | null>(() => readSave());

  // Coming back here after a run should show whatever is on disk right now,
  // not whatever was there when the title screen first mounted.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') { if (e.key === 'Enter') onStart(setup); return; }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (saved) onResume(); else onStart(setup); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [setup, onStart, onResume, saved]);

  useEffect(() => {
    const onFocus = () => setSaved(readSave());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    const id = setInterval(() => fx.burst(Math.random() * window.innerWidth, window.innerHeight + 10, Math.random() < 0.5 ? '#f97316' : '#fde047', 2, { speed: 2.5, up: true, g: -0.02, life: 120, size: 2.5 }), 120);
    return () => clearInterval(id);
  }, []);

  const cycle = (i: number) => setSetup((s) => { const c = [...s.classes]; c[i] = CLASS_IDS[(CLASS_IDS.indexOf(c[i]) + 1) % CLASS_IDS.length]; return { ...s, classes: c }; });
  const randomize = () => setSetup((s) => ({ ...s, classes: shuffle(CLASS_IDS).slice(0, 4), names: shuffle(MEMBER_NAMES).slice(0, 4) }));

  return (
    <div className="war-bg relative flex h-full w-full items-center justify-center overflow-y-auto p-4">
      <img src={KEYART} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70" style={{ animation: 'kenburns 30s ease-in-out infinite alternate' }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(12,15,10,.35), rgba(12,15,10,.55) 45%, rgba(12,15,10,.92))' }} />
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="pointer-events-none absolute left-1/2 top-1/2 h-[120%] -translate-x-1/2 -translate-y-1/2 opacity-[0.06]">
        <polygon points={pts} fill="#d6c38a" stroke="#f6c453" strokeWidth="3" />
      </svg>
      <div className="relative z-10 w-full max-w-md">
        <div className="pop-in text-center">
          <div className="text-5xl">⚔️🐘⚔️</div>
          <h1 className="title-font shine-text mt-1 text-5xl sm:text-6xl">สมรภูมิสยาม</h1>
          <div className="mt-1 text-sm tracking-widest text-amber-200/80">THAI BATTLEFIELD SIMULATION</div>
          <div className="mt-1 text-xs text-stone-400">15 เมือง • 6 อาชีพ • 68 สกิล • ต่อสู้อัตโนมัติ • ไต่อันดับเป็นปาร์ตี้ที่เก่งที่สุด</div>
        </div>

        {mode === 'title' ? (
          <div className="slide-up mt-6 space-y-3">
            {saved && <ResumeCard env={saved} onResume={onResume} />}
            <button className="btn btn-red pulse-glow w-full py-4 text-2xl" onClick={() => onStart(setup)}>⚔ เริ่มรบทันที</button>
            <button className="btn btn-dark w-full py-3" onClick={() => setMode('build')}>🛠 จัดทีมเอง</button>
            <div className="panel rounded-2xl p-3">
              <div className="mb-2 text-center font-bold text-amber-300">🏆 ตารางคะแนนสูงสุด</div>
              <HighScoreTable list={hs} />
            </div>
            <div className="text-center text-[13px] text-stone-500">คีย์บอร์ด: Enter {saved ? 'เล่นต่อ' : 'เริ่ม'} • ←→ เลือกเมือง • Enter เดินทาง • P พัก • Q ปาร์ตี้ • Space ความเร็วรบ</div>
          </div>
        ) : (
          <div className="slide-up panel mt-5 space-y-3 rounded-2xl p-4">
            <label className="block text-sm">ชื่อปาร์ตี้
              <input value={setup.partyName} maxLength={20} onChange={(e) => setSetup({ ...setup, partyName: e.target.value })} className="mt-1 w-full rounded-lg border border-[#6b5b2e] bg-black/50 px-3 py-2 text-amber-200 outline-none focus:border-amber-400" />
            </label>
            <div className="text-xs text-stone-400">แตะการ์ดเพื่อเปลี่ยนอาชีพ (สกิลสุ่ม 2 ช่องจะสุ่มตอนเริ่ม)</div>
            <div className="grid grid-cols-2 gap-2">
              {setup.classes.map((c, i) => {
                const d = CLASSES[c];
                return (
                  <button key={i} onClick={() => cycle(i)} className="rounded-xl border p-2 text-left transition active:scale-95" style={{ borderColor: d.color + '99', background: `linear-gradient(160deg, ${d.color}33, #0006)` }}>
                    <div className="flex items-center gap-2"><img src={PORTRAIT[c]} alt="" className="h-12 w-12 rounded-lg border object-cover" style={{ borderColor: d.color, objectPosition: '50% 18%' }} /><div><div className="text-sm font-bold">{setup.names[i]}</div><div className="text-xs" style={{ color: d.color }}>{d.name}</div></div></div>
                    <div className="mt-1 text-[12px] text-stone-300">{d.desc}</div>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button className="btn btn-dark flex-1" onClick={randomize}>🎲 สุ่ม</button>
              <button className="btn btn-dark flex-1" onClick={() => setMode('title')}>◀ กลับ</button>
            </div>
            <button className="btn btn-red w-full py-3 text-xl" onClick={() => onStart(setup)}>⚔ ออกศึก!</button>
          </div>
        )}
      </div>
    </div>
  );
}
