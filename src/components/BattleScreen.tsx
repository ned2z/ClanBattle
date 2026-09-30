import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BIOME_NAME, CLASS2, CLASSES, RARITY, SKILL, STATUS_INFO } from '../game/data';
import { initBattle, stepBattle, type BattleState } from '../game/engine';
import { fx } from '../game/fx';
import { PORTRAIT } from '../game/portraits';
import type { BattleSummary } from '../game/store';
import type { ActionEvent, EnemyGroup, GameState, Unit } from '../game/types';
import { BattleWorld } from '../three/BattleWorld';
import { SkillIcon } from './Icons';
import { BIG_TECH, IMPACT, techFor } from '../three/vfx';

interface Props {
  game: GameState;
  group: EnemyGroup;
  paused: boolean;
  onFinish: (b: BattleState) => BattleSummary;
  onContinue: () => void;
  onGameOver: () => void;
  onPause: () => void;
}
interface Float { id: number; uid: string; text: string; color: string; big?: boolean }
type View = Pick<Unit, 'uid' | 'hp' | 'maxHp' | 'mp' | 'maxMp' | 'alive' | 'statuses' | 'atb' | 'ult'>;
interface LogLine { id: number; turn: number; side: 'ally' | 'enemy'; icon: string; text: string; details: string[]; kind: string }
interface UStat { dealt: number; taken: number; healed: number; kills: number; crits: number; actions: number; attacks: number; stunned: number; misses: number; skills: Record<string, number> }

const SPEEDS = [1, 2, 4];

/** how long the swing animation keeps playing after the hit lands (scaled by speed) */
const ANIM_TAIL = 0.2;
/**
 * Rest between every action, in real seconds. Deliberately NOT scaled by the
 * speed toggle: whatever the battle speed, there is always a 0.5s breath after
 * an action so the player can read the board before the next turn starts.
 */
const ACTION_DELAY = 0.5;
const snap = (b: BattleState): Record<string, View> =>
  Object.fromEntries(b.units.map((u) => [u.uid, { uid: u.uid, hp: u.hp, maxHp: u.maxHp, mp: u.mp, maxMp: u.maxMp, alive: u.alive, atb: u.atb, ult: u.ult, statuses: u.statuses.map((s) => ({ ...s })) }]));
const DOT = new Set(['poison', 'burn', 'bleed']);
let fid = 0;

export default function BattleScreen({ game, group, paused, onFinish, onContinue, onGameOver, onPause }: Props) {
  const bRef = useRef<BattleState | null>(null);
  if (!bRef.current) bRef.current = initBattle(game, group.units);
  const b = bRef.current;
  const unitById = useMemo(() => Object.fromEntries(b.units.map((u) => [u.uid, u])), [b]);
  const [view, setView] = useState(() => snap(b));
  const [floats, setFloats] = useState<Float[]>([]);
  const [banner, setBanner] = useState<{ k: number; text: string; icon: string; side: string; sid?: string } | null>(null);
  const [cutin, setCutin] = useState<{ k: number; text: string; icon: string; side: string; img?: string; name: string; color: string; sid?: string } | null>(null);
  const [flashK, setFlashK] = useState(0);
  const [lines, setLines] = useState<LogLine[]>([{ id: 0, turn: 0, side: 'enemy', icon: '⚔', text: `${group.title} ปรากฏตัว!`, details: [], kind: 'info' }]);
  const [showLog, setShowLog] = useState(false);
  // v2 key: forces everyone back to 1x on first load so the intro is watchable
  const [speed, setSpeed] = useState(() => Number(localStorage.getItem('tbs-speed-v2') || 1));
  const [phase, setPhase] = useState<'intro' | 'fight' | 'done'>('intro');
  const [summary, setSummary] = useState<BattleSummary | null>(null);
  const [resTab, setResTab] = useState<'sum' | 'perf' | 'log'>('sum');
  const [autoGo, setAutoGo] = useState(true);
  const [activeUid, setActiveUid] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const stats = useRef<Record<string, UStat>>(Object.fromEntries(b.units.map((u) => [u.uid, { dealt: 0, taken: 0, healed: 0, kills: 0, crits: 0, actions: 0, attacks: 0, stunned: 0, misses: 0, skills: {} }])));
  const anchors = useRef<Record<string, HTMLDivElement | null>>({});
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<BattleWorld | null>(null);
  const timers = useRef<number[]>([]);
  const finishedRef = useRef(false);
  const nextDelay = useRef(350);

  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { localStorage.setItem('tbs-speed-v2', String(speed)); }, [speed]);

  useEffect(() => {
    const w = new BattleWorld(hostRef.current!, b.units, (id) => anchors.current[id], group.biome ?? 'plain');
    w.setTimeOfDay(game.minute);
    worldRef.current = w;
    return () => { w.dispose(); worldRef.current = null; };
  }, [b]); // eslint-disable-line
  useEffect(() => { if (worldRef.current) worldRef.current.paused = paused; }, [paused]);
  // A battle rarely crosses dawn, but resting or a long fight can.
  useEffect(() => { worldRef.current?.setTimeOfDay(game.minute); }, [game.minute]);

  const syncStatuses = useCallback(() => {
    const w = worldRef.current; if (!w) return;
    for (const u of b.units) { w.setStatuses(u.uid, u.alive ? u.statuses.map((s) => s.type) : []); w.setHp(u.uid, u.hp / u.maxHp); }
  }, [b]);

  // ---------- stats & log recording
  const record = useCallback((ev: ActionEvent) => {
    const a = unitById[ev.actor];
    const st = stats.current;
    const details: string[] = [];
    if (ev.kind === 'skip') st[ev.actor].stunned++;
    else if (ev.kind !== 'dot') {
      st[ev.actor].actions++;
      if (ev.kind === 'attack') st[ev.actor].attacks++;
      else st[ev.actor].skills[ev.label] = (st[ev.actor].skills[ev.label] ?? 0) + 1;
    }
    for (const h of ev.hits) {
      const t = unitById[h.uid];
      const isDot = h.uid === ev.actor && h.dmg !== undefined && !!h.status?.some((s) => DOT.has(s));
      const isRegen = h.uid === ev.actor && h.heal !== undefined && ev.kind !== 'heal' && ev.kind !== 'item';
      if (h.miss) { st[ev.actor].misses++; details.push(`↳ ${t.name}: หลบได้ (MISS)`); continue; }
      if (h.dmg !== undefined) {
        st[h.uid].taken += h.dmg;
        if (isDot) details.push(`↳ ${t.name} โดน${STATUS_INFO[h.status![0]].name} -${h.dmg}`);
        else {
          st[ev.actor].dealt += h.dmg; if (h.crit) st[ev.actor].crits++;
          details.push(`↳ ${t.name} -${h.dmg}${h.crit ? ' 💥คริติคอล' : ''}${h.weak ? ' (แพ้ทาง!)' : ''}${h.shielded ? ` (โล่ดูดซับ ${h.shielded})` : ''}`);
        }
      }
      if (h.heal !== undefined && h.heal > 0) { st[ev.actor].healed += h.heal; details.push(`↳ ${t.name} ${h.revived ? 'ฟื้นคืนชีพ' : isRegen ? 'ฟื้นฟู' : 'ฟื้น HP'} +${h.heal}`); }
      if (h.mpHeal) details.push(`↳ ${t.name} ฟื้น MP +${h.mpHeal}`);
      if (h.status && !isDot) details.push(`↳ ${t.name} ติดสถานะ ${h.status.map((s) => STATUS_INFO[s].icon + STATUS_INFO[s].name).join(', ')}`);
      if (h.killed) { if (!isDot) st[ev.actor].kills++; details.push(`☠ ${t.name} ถูกกำจัด!`); }
    }
    const text = ev.kind === 'skip' ? `${a.name} ติดสตัน ขยับไม่ได้` : ev.kind === 'dot' ? `${a.name} ล้มลงจากสถานะผิดปกติ` : ev.kind === 'attack' ? `${a.name} โจมตีปกติ` : ev.ult ? `⚡ ${a.name} ปลดปล่อยไม้ตาย ${ev.label}!` : `${a.name} ใช้ ${ev.label}`;
    setLines((l) => [{ id: ++fid, turn: b.turn, side: a.side, icon: ev.kind === 'attack' ? '🗡' : ev.icon, text, details, kind: ev.kind }, ...l].slice(0, 200));
  }, [b, unitById]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setView(snap(b));
    syncStatuses();
    const s = onFinish(b);
    setSummary(s);
    setPhase('done');
    setActiveUid(null);
    setLines((l) => [{ id: ++fid, turn: b.turn, side: s.win ? 'ally' : 'enemy', icon: s.win ? '🏆' : '💀', text: s.win ? 'ชัยชนะ!' : 'พ่ายแพ้...', details: [], kind: 'info' }, ...l]);
    if (s.win) {
      worldRef.current?.victory('ally');
      const r = hostRef.current?.getBoundingClientRect();
      if (r) for (let i = 0; i < 4; i++) setTimeout(() => fx.burst(r.left + r.width * (0.2 + Math.random() * 0.6), r.top + r.height * 0.3, i % 2 ? '#f6c453' : '#fff7d6', 36, { speed: 7, g: 0.18, shape: 1, size: 4 }), i * 140);
    } else { worldRef.current?.victory('enemy'); fx.shake(16, 30); }
  }, [b, onFinish, syncStatuses]);

  useEffect(() => { fx.shake(8, 14); }, []);

  // wait for the real 3D entrance to finish instead of guessing a duration
  useEffect(() => {
    if (phase !== 'intro') return;
    let tries = 0;
    const id = window.setInterval(() => {
      if (worldRef.current?.isEntranceDone() || ++tries > 60) { clearInterval(id); setPhase('fight'); }
    }, 50);
    return () => clearInterval(id);
  }, [phase]);

  // ---------- play one event
  const playEvent = useCallback((ev: ActionEvent) => {
    const actor = unitById[ev.actor];
    const w = worldRef.current;
    const tech = techFor(ev, actor);
    const sp = speed;
    const impact = (IMPACT[tech] * (ev.ult ? 1.35 : 1)) / sp;
    const total = impact + ANIM_TAIL / sp;
    nextDelay.current = (total + ACTION_DELAY) * 1000;
    const targets = [...new Set(ev.hits.filter((h) => !(h.uid === ev.actor && ev.hits.indexOf(h) === 0 && h.status?.some((s) => DOT.has(s)))).map((h) => h.uid))];
    const tIds = targets.filter((id) => id !== ev.actor || ['buff', 'heal', 'item'].includes(ev.kind));
    setActiveUid(ev.actor);
    const rar = ev.skillId ? SKILL[ev.skillId]?.rarity ?? 0 : 0;
    const big = ev.isSkill && (BIG_TECH.has(tech) || rar >= 2 || !!ev.ult);
    if (rar >= 2) { w?.shake(0.3, 0.3); }
    w?.act(ev.actor, tech, tIds.length ? tIds : [ev.actor], ev.element, impact, total, ev.isSkill, !!ev.ult);
    if (ev.kind === 'skip') w?.stun(ev.actor);
    if (big) setCutin({ k: ++fid, text: ev.label, icon: ev.icon, side: actor.side, img: actor.cls ? PORTRAIT[actor.cls] : undefined, name: ev.ult ? `${actor.name} • ⚡ ULTIMATE` : rar >= 2 ? `${actor.name} • ${rar === 3 ? '💠 UNIQUE' : '🌟 LEGENDARY'}` : actor.name, color: ev.ult ? '#ff2ad0' : rar === 3 ? '#ff3d7f' : rar === 2 ? '#ffb020' : actor.color, sid: ev.skillId });
    if (ev.ult) { w?.shake(0.45, 0.4); w?.celebrate(true); setFlashK((k) => k + 1); }
    else if (ev.isSkill) setBanner({ k: ++fid, text: ev.label, icon: ev.icon, side: actor.side, sid: ev.skillId });
    record(ev);
    later(() => {
      const fl: Float[] = [];
      let shake = 0;
      for (const h of ev.hits) {
        const tu = unitById[h.uid];
        const isDot = h.uid === ev.actor && h.dmg !== undefined && !!h.status?.some((s) => DOT.has(s));
        w?.impact(h.uid, {
          dmg: h.dmg !== undefined, crit: h.crit, heal: !!h.heal, mp: !!h.mpHeal, killed: h.killed, revived: h.revived, miss: h.miss,
          element: ev.element, kind: ev.kind, dot: isDot, buff: ev.kind === 'buff', debuff: ev.kind === 'debuff',
        });
        if (h.miss) { fl.push({ id: ++fid, uid: h.uid, text: 'MISS', color: '#cbd5e1' }); continue; }
        if (h.dmg !== undefined) {
          fl.push({ id: ++fid, uid: h.uid, text: `${h.crit ? '💥' : ''}${h.dmg}${h.weak ? ' WEAK!' : ''}`, color: h.crit ? '#fde047' : isDot ? '#a3e635' : tu.side === 'ally' ? '#fca5a5' : '#ffffff', big: h.crit || h.weak });
          shake = Math.max(shake, h.crit ? 9 : ev.hits.length > 2 ? 5 : 3);
          if (h.shielded) fl.push({ id: ++fid, uid: h.uid, text: `🔰-${h.shielded}`, color: '#7dd3fc' });
        }
        if (h.heal) fl.push({ id: ++fid, uid: h.uid, text: `+${h.heal}${h.revived ? ' ฟื้น!' : ''}`, color: '#4ade80', big: h.revived });
        if (h.mpHeal) fl.push({ id: ++fid, uid: h.uid, text: `+${h.mpHeal} MP`, color: '#60a5fa' });
        if (h.status && !isDot) for (const s of h.status) fl.push({ id: ++fid, uid: h.uid, text: `${STATUS_INFO[s].icon}${STATUS_INFO[s].name}`, color: STATUS_INFO[s].bad ? '#fca5a5' : '#93c5fd' });
        if (h.killed) shake = Math.max(shake, 8);
      }
      if (ev.kind === 'skip') fl.push({ id: ++fid, uid: ev.actor, text: '💫 สตัน', color: '#fde68a' });
      if (ev.gold) fl.push({ id: ++fid, uid: ev.actor, text: `+${ev.gold}🪙`, color: '#fbbf24' });
      if (shake) fx.shake(shake, 12);
      if (ev.isSkill && ev.hits.some((h) => h.dmg && !h.miss && h.uid !== ev.actor)) w?.hitstop(ev.ult ? 0.16 : 0.1);
      if (big && ev.kind !== 'heal' && ev.kind !== 'buff') setFlashK((k) => k + 1);
      setFloats((f) => [...f.slice(-24), ...fl]);
      setView(snap(b));
      syncStatuses();
      const ids = fl.map((x) => x.id);
      later(() => setFloats((f) => f.filter((x) => !ids.includes(x.id))), 1050);
    }, impact * 1000);
  }, [b, unitById, speed, record, syncStatuses]);

  // ---------- main loop
  useEffect(() => {
    if (phase !== 'fight' || paused) return;
    const t = window.setTimeout(() => {
      const ev = stepBattle(b);
      if (!ev) { finish(); return; }
      playEvent(ev);
      if (b.over) later(finish, nextDelay.current + 200);
      setTick((x) => x + 1);
    }, nextDelay.current);
    return () => clearTimeout(t);
  }, [phase, paused, tick, b, finish, playEvent]);

  const skip = useCallback(() => {
    if (phase === 'done') return;
    const before = snap(b);
    let n = 0;
    while (!b.over && n++ < 800) { const ev = stepBattle(b); if (ev) record(ev); }
    if (!b.over) b.over = 'lose';
    for (const u of b.units) worldRef.current?.impact(u.uid, { element: 'phys', kind: 'none', killed: !u.alive && before[u.uid]?.alive, revived: u.alive && !before[u.uid]?.alive });
    finish();
  }, [b, phase, finish, record]);

  const proceed = useCallback(() => { if (summary) (summary.win ? onContinue : onGameOver)(); }, [summary, onContinue, onGameOver]);
  useEffect(() => {
    if (!summary?.win || paused || !autoGo) return;
    const t = setTimeout(onContinue, 6000);
    return () => clearTimeout(t);
  }, [summary, paused, onContinue, autoGo]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (paused) return;
      if (e.key.toLowerCase() === 'l') setShowLog((s) => !s);
      if (phase === 'done') {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); proceed(); }
        if (e.key === 'Tab') { e.preventDefault(); setAutoGo(false); setResTab((t) => (t === 'sum' ? 'perf' : t === 'perf' ? 'log' : 'sum')); }
        return;
      }
      if (e.key === ' ' || e.key.toLowerCase() === 'f') { e.preventDefault(); setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]); }
      if (e.key.toLowerCase() === 's') skip();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [phase, paused, proceed, skip]);

  // ---------- render helpers
  const allies = b.units.filter((u) => u.side === 'ally');
  const enemies = b.units.filter((u) => u.side === 'enemy');
  const aliveA = allies.filter((u) => view[u.uid].alive).length;
  const aliveE = enemies.filter((u) => view[u.uid].alive).length;

  const plate = (u: Unit) => {
    const v = view[u.uid];
    const ally = u.side === 'ally';
    const low = v.hp / v.maxHp < 0.3;
    return (
      <div key={u.uid} ref={(el) => { anchors.current[u.uid] = el; }} className="absolute left-0 top-0 will-change-transform" style={{ transform: 'translate3d(-999px,-999px,0)' }}>
        <div className={`absolute bottom-0 left-0 -translate-x-1/2 ${ally ? 'w-[78px] sm:w-[100px]' : 'w-[96px] sm:w-[124px]'} ${v.alive ? '' : 'opacity-40'}`}>
          <div className={`rounded-md border px-1 py-0.5 shadow-lg transition-transform ${activeUid === u.uid ? 'scale-110 border-amber-300 bg-black/80' : ally ? 'border-sky-400/40 bg-black/55' : 'border-red-500/50 bg-black/60'}`}>
            {!ally && <div className="flex items-baseline justify-between gap-1 text-[11px] leading-tight sm:text-[13px]"><span className="truncate font-bold text-red-100">{u.icon} {u.name}</span><span className="shrink-0 text-amber-300">{u.level}</span></div>}
            {ally && <div className="truncate text-center text-[11px] font-bold leading-tight text-sky-100 sm:text-[12px]">{u.name}</div>}
            <div className="bar mt-0.5" style={{ height: 5 }}><div style={{ width: `${(v.hp / v.maxHp) * 100}%`, background: low ? '#ef4444' : ally ? 'linear-gradient(90deg,#16a34a,#4ade80)' : 'linear-gradient(90deg,#c2410c,#fb923c)' }} /></div>
            {!ally && <div className="bar mt-px" style={{ height: 2 }}><div style={{ width: `${Math.min(100, v.atb)}%`, background: '#fde68a', transition: 'width .2s linear' }} /></div>}
            {!ally && u.ultId && <div className={`bar mt-px ${v.ult >= 100 ? 'ult-full' : ''}`} style={{ height: 3 }}><div style={{ width: `${Math.min(100, v.ult)}%`, background: 'linear-gradient(90deg,#b026ff,#ff2ad0)' }} /></div>}
            {v.statuses.length > 0 && <div className="flex h-3 flex-wrap justify-center gap-px text-[11px] leading-none">{v.statuses.slice(0, 5).map((s) => <span key={s.type}>{STATUS_INFO[s.type].icon}</span>)}</div>}
          </div>
        </div>
        {floats.filter((f) => f.uid === u.uid).map((f, i) => (
          <div key={f.id} className="float-num" style={{ color: f.color, fontSize: f.big ? 34 : 22, top: -48 - i * 18 + 'px' }}>{f.text}</div>
        ))}
      </div>
    );
  };

  const logList = (max = 200) => (
    <div className="space-y-1">
      {lines.slice(0, max).map((l) => (
        <div key={l.id} className={`rounded-lg border-l-4 bg-black/35 px-2 py-1 ${l.side === 'ally' ? 'border-sky-400' : 'border-red-500'}`}>
          <div className="flex items-baseline gap-1.5 text-xs"><span className="shrink-0 text-[12px] text-stone-500">T{l.turn}</span><span>{l.icon}</span><span className={`font-bold ${l.side === 'ally' ? 'text-sky-200' : 'text-red-200'}`}>{l.text}</span></div>
          {l.details.map((d, i) => <div key={i} className={`pl-6 text-[13px] ${d.startsWith('☠') ? 'font-bold text-red-300' : d.includes('+') ? 'text-lime-300' : 'text-stone-300'}`}>{d}</div>)}
        </div>
      ))}
    </div>
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#1a0f08]">
      <div ref={hostRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,.6) 100%)' }} />
      {flashK > 0 && <div key={flashK} className="red-flash pointer-events-none absolute inset-0 bg-white" style={{ animationDuration: '.35s' }} />}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">{b.units.map(plate)}</div>

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-1.5 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="panel min-w-0 flex-1 rounded-xl px-3 py-1">
          <div className="truncate text-sm font-bold text-red-300 sm:text-base">{group.title}</div>
          <div className="text-[12px] text-stone-400">เทิร์น {b.turn} • 🛡 {aliveA} vs {aliveE} ☠</div>
        </div>
        <button className={`btn px-2.5 py-1.5 text-sm ${showLog ? 'btn-gold' : 'btn-dark'}`} onClick={() => setShowLog((s) => !s)} title="Battle Log (L)">📜</button>
        <button className="btn btn-dark px-2.5 py-1.5 text-sm" onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])}>⏩{speed}x</button>
        <button className="btn btn-dark px-2.5 py-1.5 text-sm" onClick={skip} disabled={phase === 'done'}>⏭</button>
        <button className="btn btn-dark px-2.5 py-1.5 text-sm" onClick={onPause}>⏸</button>
      </div>

      {/* battle log box (11 lines) */}
      {!showLog && lines[0] && (
        <div className="pointer-events-none absolute left-2 top-[4.3rem] z-10 w-[min(22rem,calc(100%-1rem))] overflow-hidden rounded-xl border border-white/10 bg-black/50 px-2 py-1 backdrop-blur-[2px] sm:top-[4.8rem]">
          {lines.flatMap((l) => [{ k: `${l.id}`, t: `${l.icon} ${l.text}`, side: l.side, head: true }, ...l.details.slice(0, 2).map((d, i) => ({ k: `${l.id}-${i}`, t: d.replace('↳', '　→'), side: l.side, head: false }))]).slice(0, 11).map((row, i) => (
            <div key={row.k} className={`truncate text-[12px] leading-[1.35] sm:text-[13px] ${i === 0 ? 'fade-in' : ''} ${i >= 5 ? 'hidden sm:block' : ''} ${row.head ? (row.side === 'ally' ? 'font-bold text-sky-200' : 'font-bold text-red-200') : row.t.includes('☠') ? 'text-red-300' : row.t.includes('+') ? 'text-lime-300' : 'text-stone-300'}`} style={{ opacity: 1 - i * 0.06 }}>{row.t}</div>
          ))}
        </div>
      )}

      {banner && (
        <div key={banner.k} className="skill-banner z-20" style={{ top: '24%' }}>
          <div className={`flex items-center gap-2 whitespace-nowrap rounded-lg border-2 py-1 pl-1.5 pr-4 text-xl font-extrabold shadow-2xl sm:text-2xl ${banner.side === 'ally' ? 'border-sky-300 bg-sky-900/85 text-sky-100' : 'border-red-400 bg-red-950/85 text-red-100'}`}>{banner.sid ? <SkillIcon id={banner.sid} size={40} /> : banner.icon} {banner.text}</div>
        </div>
      )}
      {cutin && <CutIn key={cutin.k} {...cutin} />}

      {phase === 'intro' && (
        <div className="pop-in pointer-events-none absolute inset-x-0 top-[14%] z-30 flex flex-col items-center">
          <div className="title-font text-5xl text-red-400 sm:text-7xl" style={{ textShadow: '0 4px 0 #000, 0 0 30px #f00' }}>⚔ BATTLE!</div>
          <div className="mt-2 rounded-full bg-black/60 px-4 py-1 text-lg text-amber-200">{group.title}</div>
          {group.biome && <div className="mt-1 rounded-full bg-black/50 px-3 py-0.5 text-sm text-stone-200">📍 {BIOME_NAME[group.biome]}</div>}
        </div>
      )}

      {/* party HUD */}
      <div className="absolute inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-3xl gap-1.5 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {allies.map((u) => {
          const v = view[u.uid];
          const act = activeUid === u.uid;
          return (
            <div key={u.uid} className={`relative flex-1 overflow-hidden rounded-xl border-2 bg-black/70 transition-all ${act ? '-translate-y-1.5 border-amber-300 shadow-[0_0_16px_rgba(246,196,83,.7)]' : 'border-white/15'} ${v.alive ? '' : 'grayscale'}`}>
              <div className="flex items-stretch">
                <div className="relative h-14 w-11 shrink-0 overflow-hidden sm:h-16 sm:w-14">
                  <img src={PORTRAIT[u.cls!]} alt="" className="h-full w-full object-cover" style={{ objectPosition: '50% 18%' }} />
                  <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, transparent 60%, rgba(0,0,0,.85))` }} />
                  {!v.alive && <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xl">💀</div>}
                </div>
                <div className="min-w-0 flex-1 px-1 py-1">
                  <div className="flex items-baseline justify-between text-[12px] leading-tight sm:text-xs"><span className="truncate font-bold" style={{ color: u.cls2 ? CLASS2[u.cls2].color : u.color }}>{u.cls2 ? CLASS2[u.cls2].icon : ''}{u.name}</span><span className="text-amber-300">{u.level}</span></div>
                  <div className="bar mt-0.5" style={{ height: 6 }}><div style={{ width: `${(v.hp / v.maxHp) * 100}%`, background: v.hp / v.maxHp < 0.3 ? '#ef4444' : 'linear-gradient(90deg,#16a34a,#4ade80)' }} /></div>
                  <div className="text-[11px] leading-tight text-stone-300 sm:text-[12px]">{v.hp}<span className="text-stone-500">/{v.maxHp}</span></div>
                  <div className="bar" style={{ height: 3 }}><div style={{ width: `${(v.mp / Math.max(1, v.maxMp)) * 100}%`, background: '#3b82f6' }} /></div>
                  <div className="bar mt-px" style={{ height: 2 }}><div style={{ width: `${Math.min(100, v.atb)}%`, background: '#fde68a', transition: 'width .2s linear' }} /></div>
                  <div className="mt-0.5 flex items-center gap-1">
                    <span className={`text-[10px] font-black leading-none ${v.ult >= 100 ? 'ult-text' : 'text-fuchsia-300'}`}>ULT</span>
                    <div className={`bar flex-1 ${v.ult >= 100 ? 'ult-full' : ''}`} style={{ height: 5 }}><div style={{ width: `${Math.min(100, v.ult)}%`, background: v.ult >= 100 ? 'linear-gradient(90deg,#ff2ad0,#ffe14a,#ff2ad0)' : 'linear-gradient(90deg,#7a26ff,#ff2ad0)', backgroundSize: '200% 100%' }} /></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* live battle log drawer */}
      {showLog && (
        <div className="slide-up absolute bottom-24 right-2 top-16 z-20 flex w-[min(340px,calc(100%-1rem))] flex-col rounded-xl border border-[#6b5b2e] bg-black/80 backdrop-blur-sm sm:bottom-24 sm:top-20">
          <div className="flex items-center justify-between border-b border-[#6b5b2e] px-3 py-1.5"><span className="font-bold text-amber-300">📜 Battle Log</span><button className="text-sm text-stone-400" onClick={() => setShowLog(false)}>✕</button></div>
          <div className="flex-1 overflow-y-auto p-2">{logList(80)}</div>
        </div>
      )}

      {/* result */}
      {summary && (
        <div className="fade-in absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-3">
          <div className="panel pop-in flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl" onPointerDown={() => setAutoGo(false)}>
            <div className="p-4 pb-2 text-center">
              {summary.win ? <div className="title-font shine-text text-5xl">ชัยชนะ!</div> : <div className="title-font text-5xl text-red-500">พ่ายแพ้...</div>}
              {summary.npcName && <div className="mt-1 text-sm text-amber-200">โค่นปาร์ตี้ "{summary.npcName}" ได้สำเร็จ!</div>}
              <div className="mt-2 flex justify-center gap-1">
                {([['sum', '🏅 สรุป'], ['perf', '📊 ผลงาน'], ['log', '📜 บันทึก']] as const).map(([k, l]) => (
                  <button key={k} className={`btn px-3 py-1 text-sm ${resTab === k ? 'btn-gold' : 'btn-dark'}`} onClick={() => { setResTab(k); setAutoGo(false); }}>{l}</button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4">
              {resTab === 'sum' && (summary.win ? (
                <div className="pb-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-black/40 p-2">⭐ EXP <b className="text-sky-300">+{summary.xp}</b></div>
                    <div className="rounded-lg bg-black/40 p-2">🪙 ทอง <b className="text-amber-300">+{summary.gold}</b></div>
                    <div className="rounded-lg bg-black/40 p-2">🎖 ชื่อเสียง <b className="text-orange-300">+{summary.fame}</b></div>
                    <div className="rounded-lg bg-black/40 p-2">🏅 คะแนน <b className="text-lime-300">+{summary.score}</b></div>
                  </div>
                  {summary.drops.map((d) => <div key={d.iid} className="pop-in mt-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: RARITY[d.rarity].color, color: RARITY[d.rarity].color, background: 'rgba(0,0,0,.4)' }}>🎁 ได้รับไอเทม: {d.icon} <b>{d.name}</b> <span className="text-xs">({RARITY[d.rarity].name})</span></div>)}
                  {summary.mats.length > 0 && (
                    <div className="mt-2 rounded-lg border border-lime-700/60 bg-lime-950/40 px-3 py-2 text-sm">
                      <div className="mb-1 text-[13px] text-lime-300">🪨 ได้วัตถุดิบ (นำไปขายที่ตลาดได้)</div>
                      <div className="flex flex-wrap gap-1.5">
                        {summary.mats.map((m, i) => (
                          <span key={i} className="pop-in rounded bg-black/40 px-2 py-0.5 text-[13px] text-lime-200">{m.icon} {m.name} <b>x{m.qty}</b></span>
                        ))}
                      </div>
                    </div>
                  )}
                  {summary.levelUps.length > 0 && <div className="mt-2 space-y-0.5 text-sm text-lime-300">{summary.levelUps.map((l, i) => <div key={i} className="pop-in" style={{ animationDelay: `${i * 0.1}s` }}>⬆ {l.name} เลเวลอัป! Lv{l.level} <span className="text-amber-300">(+1 SP)</span></div>)}</div>}
                  {summary.questsDone.length > 0 && <div className="mt-2 space-y-0.5 text-sm text-sky-300">{summary.questsDone.map((q, i) => <div key={i}>📜 สำเร็จ: {q}</div>)}</div>}
                  {summary.becameTop && <div className="shine-text mt-2 text-lg font-extrabold">👑 คุณคือปาร์ตี้อันดับ 1 แห่งสยาม!</div>}
                </div>
              ) : <div className="pb-2 text-center text-sm text-stone-300">ปาร์ตี้ของคุณล้มลงทั้งหมดในสนามรบ<br />ดูแท็บ 📊 ผลงาน เพื่อวิเคราะห์ว่าพลาดตรงไหน</div>)}
              {resTab === 'perf' && <PerfTab allies={allies} enemies={enemies} stats={stats.current} view={view} game={game} />}
              {resTab === 'log' && <div className="pb-2">{logList()}</div>}
            </div>
            <div className="p-4 pt-2">
              <button className={`btn w-full py-3 text-lg ${summary.win ? 'btn-gold' : 'btn-red'}`} onClick={proceed}>{summary.win ? 'เดินทางต่อ ▶' : 'ดูผลลัพธ์'}</button>
              {summary.win && autoGo && <div className="bar mt-2" style={{ height: 3 }}><div style={{ width: '100%', background: '#f6c453', animation: 'shrink 6s linear forwards' }} /></div>}
              <style>{'@keyframes shrink{to{width:0}}'}</style>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ CUT-IN
function CutIn({ text, icon, side, img, name, color, sid }: { text: string; icon: string; side: string; img?: string; name: string; color: string; sid?: string }) {
  const ally = side === 'ally';
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[26%] z-20 h-28 overflow-hidden sm:h-36">
      <div className={`cutin-strip absolute inset-0 ${ally ? '' : 'cutin-rev'}`} style={{ background: ally ? `linear-gradient(90deg, rgba(0,0,0,0), ${color}cc 20%, rgba(10,20,40,.92) 50%, ${color}cc 80%, rgba(0,0,0,0))` : 'linear-gradient(90deg, rgba(0,0,0,0), #7f1d1dcc 20%, rgba(30,5,5,.92) 50%, #7f1d1dcc 80%, rgba(0,0,0,0))' }}>
        <div className="absolute inset-0 opacity-30" style={{ background: 'repeating-linear-gradient(90deg, transparent 0 14px, rgba(255,255,255,.35) 14px 16px)' }} />
        <div className={`absolute inset-y-0 flex items-center gap-3 ${ally ? 'left-[6%]' : 'right-[6%] flex-row-reverse'}`}>
          {img ? <img src={img} alt="" className="cutin-face h-24 w-24 rounded-full border-4 object-cover sm:h-32 sm:w-32" style={{ borderColor: color, objectPosition: '50% 18%', boxShadow: `0 0 24px ${color}` }} /> : <div className="cutin-face flex h-24 w-24 items-center justify-center rounded-full border-4 border-red-500 bg-black/60 text-6xl sm:h-32 sm:w-32">{icon}</div>}
          <div className={ally ? '' : 'text-right'}>
            <div className="text-xs font-bold text-white/80 sm:text-sm">{name}</div>
            <div className={`flex items-center gap-2 ${ally ? '' : 'flex-row-reverse'}`}>{sid && <SkillIcon id={sid} size={52} />}<div className="title-font whitespace-nowrap text-3xl text-white sm:text-5xl" style={{ textShadow: `0 3px 0 #000, 0 0 20px ${ally ? color : '#f00'}` }}>{sid ? '' : icon} {text}</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ PERFORMANCE
function PerfTab({ allies, enemies, stats, view, game }: { allies: Unit[]; enemies: Unit[]; stats: Record<string, UStat>; view: Record<string, View>; game: GameState }) {
  const maxDealt = Math.max(1, ...allies.map((u) => stats[u.uid].dealt));
  const maxTaken = Math.max(1, ...allies.map((u) => stats[u.uid].taken));
  const maxHeal = Math.max(1, ...allies.map((u) => stats[u.uid].healed));
  const totalTaken = allies.reduce((a, u) => a + stats[u.uid].taken, 0);
  const mvp = allies.reduce((a, u) => (stats[u.uid].dealt + stats[u.uid].healed > stats[a.uid].dealt + stats[a.uid].healed ? u : a), allies[0]);
  const advice = (u: Unit) => {
    const s = stats[u.uid]; const v = view[u.uid]; const m = game.members.find((x) => x.id === u.memberId);
    const out: string[] = [];
    if (u === mvp) out.push('⭐ MVP — ผลงานโดดเด่นที่สุด');
    if (!v.alive) out.push('💀 ล้มระหว่างสู้ — อัปเกราะ / ให้สายโล่ใช้ "ยั่วยุ" / เพิ่มฮีล');
    if (v.mp < v.maxMp * 0.15 && Object.keys(s.skills).length) out.push('🔷 MP แทบหมด — ตั้งแผน "ประหยัด" หรือพกน้ำมนต์มานา');
    if (!Object.keys(s.skills).length && m?.tactic !== 'attack' && s.actions > 1) out.push('⚠ ไม่ได้ใช้สกิลเลย — ตรวจการเปิดสกิล / MP ไม่พอ');
    if (totalTaken > 0 && s.taken / totalTaken > 0.45 && u.cls !== 'shield' && allies.length > 1) out.push('🎯 รับดาเมจหนักเกินไป — ให้สายโล่ยั่วยุ หรือเปลี่ยนเกราะ');
    if (m && m.skills.some((x) => SKILL[x.id].kind === 'heal' && x.enabled) && s.healed === 0 && totalTaken > 0) out.push('💚 ยังไม่ได้ฮีล — เพิ่มค่า "ฮีลเมื่อ HP ต่ำกว่า"');
    if (s.stunned >= 2) out.push('💫 ติดสตันบ่อย — เพิ่ม SPD หรือกำจัดศัตรูสายสตันก่อน');
    if (s.misses >= 3) out.push('🌫 พลาดบ่อย — ศัตรูหลบสูง ใช้สกิลหมู่แทน');
    return out;
  };
  const bar = (v: number, max: number, color: string) => <div className="bar flex-1" style={{ height: 7 }}><div style={{ width: `${(v / max) * 100}%`, background: color }} /></div>;
  return (
    <div className="space-y-2 pb-2">
      {allies.map((u) => {
        const s = stats[u.uid]; const v = view[u.uid];
        const tips = advice(u);
        return (
          <div key={u.uid} className="rounded-xl border border-white/10 bg-black/35 p-2">
            <div className="flex items-center gap-2">
              <img src={PORTRAIT[u.cls!]} alt="" className={`h-10 w-10 rounded-lg object-cover ${v.alive ? '' : 'grayscale'}`} style={{ objectPosition: '50% 18%' }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1 text-sm"><b style={{ color: u.color }}>{u.name}</b><span className="text-[13px] text-stone-400">{CLASSES[u.cls!].short} Lv{u.level}</span>{u === mvp && <span className="text-xs text-amber-300">⭐MVP</span>}</div>
                <div className="text-[12px] text-stone-400">HP {v.hp}/{v.maxHp} • MP {v.mp}/{v.maxMp} • แอคชัน {s.actions} • คริ {s.crits} • ฆ่า {s.kills}</div>
              </div>
            </div>
            <div className="mt-1.5 space-y-0.5 text-[13px]">
              <div className="flex items-center gap-2"><span className="w-16 text-stone-300">⚔ ดาเมจ</span>{bar(s.dealt, maxDealt, 'linear-gradient(90deg,#f97316,#fde047)')}<span className="w-12 text-right">{s.dealt}</span></div>
              <div className="flex items-center gap-2"><span className="w-16 text-stone-300">🛡 รับดาเมจ</span>{bar(s.taken, maxTaken, 'linear-gradient(90deg,#991b1b,#f87171)')}<span className="w-12 text-right">{s.taken}</span></div>
              <div className="flex items-center gap-2"><span className="w-16 text-stone-300">💚 ฮีล</span>{bar(s.healed, maxHeal, 'linear-gradient(90deg,#15803d,#86efac)')}<span className="w-12 text-right">{s.healed}</span></div>
            </div>
            <div className="mt-1 flex flex-wrap gap-1 text-[12px]">
              {s.attacks > 0 && <span className="rounded bg-white/10 px-1.5 py-0.5">🗡 โจมตี x{s.attacks}</span>}
              {Object.entries(s.skills).map(([k, n]) => <span key={k} className="rounded bg-sky-900/60 px-1.5 py-0.5 text-sky-100">{k} x{n}</span>)}
            </div>
            {tips.length > 0 && <div className="mt-1 space-y-0.5 text-[13px] text-amber-200">{tips.map((t) => <div key={t}>{t}</div>)}</div>}
          </div>
        );
      })}
      <div className="rounded-xl bg-black/30 p-2 text-[13px] text-stone-300">
        <div className="mb-1 font-bold text-red-300">ฝั่งศัตรู</div>
        {enemies.map((u) => <div key={u.uid} className="flex justify-between"><span>{u.icon} {u.name} Lv{u.level} {view[u.uid].alive ? '' : '☠'}</span><span>⚔ {stats[u.uid].dealt} • 🛡 {stats[u.uid].taken}</span></div>)}
      </div>
    </div>
  );
}
