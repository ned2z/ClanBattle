import { useEffect, useMemo, useRef, useState } from 'react';
import { CITIES, CLASSES, NODE, NODE_KIND_INFO } from '../game/data';
import { MapWorld } from '../three/MapWorld';
import { TravelWorld } from '../three/TravelWorld';
import { PORTRAIT } from '../game/portraits';
import { TRAVEL_SPEED, findPath, neighbors, partyLevel, pathLen, routeTier, segLen } from '../game/engine';
import { fx } from '../game/fx';
import { levelRange } from '../game/store';
import { addMinutes, fmtDuration, fmtTime, travelMinutes } from '../game/time';
import type { GameState, Travel } from '../game/types';

interface Props {
  game: GameState;
  paused: boolean;
  active: boolean;
  onEncounter: (t: Travel, tier: number) => void;
  onArrive: (city: string, nodesPassed: number) => void;
  onStartTravel: (path: string[]) => void;
  onTreasure: (t: Travel) => void;
  onOpenCity: () => void;
}

const tierColor = (t: number) => ['#4ade80', '#86efac', '#facc15', '#fb923c', '#f97316', '#ef4444', '#dc2626', '#b91c1c'][Math.min(7, Math.max(0, Math.round(t) - 1))];

export default function MapScreen({ game, paused, active, onEncounter, onArrive, onStartTravel, onTreasure, onOpenCity }: Props) {
  const [sel, setSel] = useState<string | null>(null);
  const [alert, setAlert] = useState(false);
  const etaRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const travelRef = useRef<Travel | null>(game.travel);
  const elapsedRef = useRef(0);
  const tvProgress = useRef(0);
  const graceRef = useRef(1.1);
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<MapWorld | null>(null);
  const tvHostRef = useRef<HTMLDivElement>(null);
  const tvRef = useRef<TravelWorld | null>(null);
  travelRef.current = game.travel;

  const traveling = !!game.travel;
  const path = useMemo(() => (sel && !traveling ? findPath(game.location, sel) : game.travel?.path ?? null), [sel, traveling, game.location, game.travel]);
  const pNodes = path ? path.length - 1 : 0;

  // latest click handler for the 3D world
  const clickRef = useRef<(id: string) => void>(() => {});
  clickRef.current = (id: string) => {
    if (paused) return;
    if (!traveling && id !== game.location) setSel(id);
    else if (!traveling && id === game.location) onOpenCity();
  };

  // create / destroy world
  useEffect(() => {
    const w = new MapWorld(hostRef.current!, game.members.map((m) => ({ cls: m.cls, color: CLASSES[m.cls].color })));
    worldRef.current = w;
    w.onCityClick = (id) => clickRef.current(id);
    const c = NODE[game.location];
    const tr = game.travel;
    if (tr && tr.path[tr.seg + 1]) { const a = NODE[tr.path[tr.seg]], b = NODE[tr.path[tr.seg + 1]]; const x = a.x + (b.x - a.x) * tr.t, y = a.y + (b.y - a.y) * tr.t; w.jumpTo(x, y); w.placeTokenNow(x, y); }
    else { w.jumpTo(c.x, c.y); w.placeTokenNow(c.x, c.y); }
    return () => { w.dispose(); worldRef.current = null; };
  }, []); // eslint-disable-line

  useEffect(() => { worldRef.current?.setActive(active); }, [active]);
  // Day/night: the clock only moves on travel, rest or battle, so this is rare
  // and cheap. The world eases into the new light rather than snapping.
  useEffect(() => { worldRef.current?.setTimeOfDay(game.minute); }, [game.minute]);
  // travel popup 3D scene
  const travelKey = game.travel ? game.travel.path.join('>') : '';
  useEffect(() => {
    if (!travelKey || !active || !tvHostRef.current) return;
    const p = travelKey.split('>');
    const tier = Math.max(...p.slice(1).map((c, i) => routeTier(p[i], c)));
    const w = new TravelWorld(tvHostRef.current, game.members.map((m) => ({ cls: m.cls, color: CLASSES[m.cls].color })), tier);
    w.jump(tvProgress.current);
    w.setTimeOfDay(game.minute);
    tvRef.current = w;
    return () => { w.dispose(); tvRef.current = null; };
  }, [travelKey, active]); // eslint-disable-line
  useEffect(() => { tvRef.current?.setTimeOfDay(game.minute); }, [game.minute]);
  useEffect(() => { tvRef.current?.setProgress(tvRef.current ? (tvProgress.current) : 0, !paused && !alert); }, [paused, alert]);
  useEffect(() => { worldRef.current?.setPath(path); }, [path]);
  useEffect(() => {
    worldRef.current?.setSelected(traveling ? null : sel);
    if (sel && !traveling) { const a = NODE[game.location], b = NODE[sel]; worldRef.current?.focus((a.x + b.x) / 2, (a.y + b.y) / 2); }
  }, [sel, traveling, game.location]);
  const questKey = game.quests.map((q) => q.targetCity ?? '').join(',');
  useEffect(() => { worldRef.current?.setQuestTargets(questKey.split(',').filter(Boolean)); }, [questKey]);
  useEffect(() => { worldRef.current?.setAlert(alert); }, [alert]);
  const visitedKey = game.visited.join(',');
  useEffect(() => { worldRef.current?.setVisited(visitedKey ? visitedKey.split(',') : []); }, [visitedKey]);

  // position token
  const place = (t: Travel | null) => {
    let x = NODE[game.location].x, y = NODE[game.location].y;
    if (t) {
      const a = NODE[t.path[t.seg]], b = NODE[t.path[t.seg + 1]];
      if (b) { x = a.x + (b.x - a.x) * t.t; y = a.y + (b.y - a.y) * t.t; } else { x = a.x; y = a.y; }
    }
    worldRef.current?.setToken(x, y, !!t && !paused);
    return { x, y };
  };
  // Keyed on travelKey, not game.travel: update() clones the state, so the
  // travel object is a new reference on every node tick. Keying on the object
  // would reset graceRef each node and quietly suppress ambushes.
  useEffect(() => { place(game.travel); graceRef.current = 1.1; if (!game.travel) tvProgress.current = 0; }, [travelKey, game.location, paused]); // eslint-disable-line

  // travel loop
  useEffect(() => {
    if (!game.travel || paused || !active || alert) return;
    let raf = 0; let last = performance.now(); let done = false;
    const total = pathLen(game.travel.path);
    const frame = (now: number) => {
      if (done) return;
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
      const t = travelRef.current!;
      const a = t.path[t.seg], b = t.path[t.seg + 1];
      const len = segLen(a, b);
      t.t += (dt * TRAVEL_SPEED) / len;
      elapsedRef.current += dt;
      graceRef.current -= dt;
      if (t.t >= 1) {
        t.t = 0; t.seg++;
        if (t.seg >= t.path.length - 1) {
          done = true;
          const c = NODE[t.path[t.path.length - 1]];
          worldRef.current?.setToken(c.x, c.y, false);
          worldRef.current?.burstAt(c.x, c.y, 0xf6c453, 70);
          elapsedRef.current = 0;
          setSel(null);
          onArrive(c.id, t.path.length - 1);
          return;
        }
      }
      place(t);
      // progress UI
      let covered = 0; for (let i = 0; i < t.seg; i++) covered += segLen(t.path[i], t.path[i + 1]);
      covered += segLen(t.path[t.seg], t.path[t.seg + 1]) * t.t;
      if (etaRef.current) {
        // ETA is shown in in-game time, not real seconds: 1 node = 5 min.
        const realLeft = Math.max(0, (total - covered) / TRAVEL_SPEED);
        const nodesLeft = total > 0 ? ((total - covered) / total) * (t.path.length - 1) : 0;
        etaRef.current.textContent = `${fmtDuration(travelMinutes(nodesLeft))} (${realLeft.toFixed(0)} วิ)`;
      }
      if (barRef.current) barRef.current.style.width = `${(covered / total) * 100}%`;
      tvProgress.current = covered / total;
      tvRef.current?.setProgress(covered / total, true);
      // encounters
      if (graceRef.current <= 0) {
        const tier = routeTier(t.path[t.seg], t.path[t.seg + 1]);
        if (Math.random() < dt * (0.3 + tier * 0.02) * 0.24) {
          done = true;
          setAlert(true);
          fx.shake(10, 16);
          worldRef.current?.setToken(place(t).x, place(t).y, false);
          worldRef.current?.burstToken(0xff3b3b, 60);
          tvRef.current?.alert();
          const snap = { ...t, path: [...t.path] };
          setTimeout(() => { setAlert(false); onEncounter(snap, tier); }, 700);
          return;
        }
        if (Math.random() < dt * 0.008) {
          graceRef.current = 1;
          worldRef.current?.burstToken(0xf6c453, 40);
          tvRef.current?.treasure();
          onTreasure({ ...t, path: [...t.path] });
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { done = true; cancelAnimationFrame(raf); };
  }, [travelKey, paused, active, alert]); // eslint-disable-line

  // keyboard
  useEffect(() => {
    if (!active || paused) return;
    const order = CITIES.map((c) => c.id);
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === '+' || e.key === '=') worldRef.current?.zoom(0.85);
      if (e.key === '-' || e.key === '_') worldRef.current?.zoom(1.15);
      if (traveling) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const nb = neighbors(game.location);
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        setSel((s) => { const i = s ? nb.indexOf(s) : -1; return nb[(i + dir + nb.length) % nb.length]; });
      } else if (['ArrowRight', 'ArrowLeft'].includes(e.key)) {
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        setSel((s) => {
          let i = s && order.includes(s) ? order.indexOf(s) : Math.max(0, order.indexOf(game.location));
          do { i = (i + dir + order.length) % order.length; } while (order[i] === game.location);
          return order[i];
        });
      } else if ((e.key === 'Enter' || e.key === ' ') && sel && sel !== game.location) {
        e.preventDefault(); onStartTravel(findPath(game.location, sel));
      } else if (e.key.toLowerCase() === 'c' || (e.key === 'Enter' && !sel)) onOpenCity();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, paused, traveling, sel, game.location, onStartTravel, onOpenCity]);

  const destTier = sel ? NODE[sel].tier : 0;
  const maxTier = path ? Math.max(...path.slice(1).map((c, i) => routeTier(path[i], c))) : 0;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#141d26]">
      <div ref={hostRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55) 100%)' }} />
      <div className="absolute right-2 top-[4.75rem] flex flex-col gap-1 sm:top-20">
        <button className="btn btn-dark px-3 py-1 text-lg" onClick={() => worldRef.current?.zoom(0.8)}>＋</button>
        <button className="btn btn-dark px-3 py-1 text-lg" onClick={() => worldRef.current?.zoom(1.25)}>－</button>
        <button className="btn btn-dark px-2 py-1 text-sm" title="กลับไปที่ปาร์ตี้" onClick={() => { const c = NODE[game.location]; worldRef.current?.focus(c.x, c.y); }}>🎯</button>
      </div>
      {alert && <div className="red-flash pointer-events-none absolute inset-0 bg-red-700" />}

      {/* travel popup */}
      {traveling && game.travel && (() => {
        const tp = game.travel.path;
        const lens = tp.slice(1).map((c, i) => segLen(tp[i], c));
        const tot = lens.reduce((a, b) => a + b, 0);
        let acc = 0;
        return (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="tof-frame slide-up pointer-events-auto w-full max-w-lg overflow-hidden rounded-2xl">
              <div className="flex items-center justify-between gap-2 px-4 py-2">
                <div className="min-w-0">
                  <div className="text-[13px] text-stone-400">กำลังเดินทาง</div>
                  <div className="truncate font-bold"><span className="text-stone-200">{NODE[tp[0]].name}</span> <span className="text-amber-400">➜</span> <span className="text-amber-300">{NODE[tp[tp.length - 1]].name}</span></div>
                </div>
                <div className="flex -space-x-2">{game.members.map((m) => <img key={m.id} src={PORTRAIT[m.cls]} alt="" className={`h-8 w-8 rounded-full border-2 border-amber-300/70 object-cover ${m.hp <= 0 ? 'grayscale' : ''}`} style={{ objectPosition: '50% 18%' }} />)}</div>
              </div>
              <div className="relative h-24 sm:h-32">
                <div ref={tvHostRef} className="absolute inset-0" />
                {alert && <div className="red-flash pointer-events-none absolute inset-0 bg-red-700" />}
                {alert && <div className="pop-in absolute inset-0 flex items-center justify-center"><div className="title-font text-3xl text-red-400 sm:text-4xl" style={{ textShadow: '0 3px 0 #000, 0 0 20px #f00' }}>⚠ ถูกซุ่มโจมตี!</div></div>}
              </div>
              <div className="px-4 py-2.5">
                <div className="relative">
                  <div className="bar" style={{ height: 8 }}><div ref={barRef} style={{ width: '0%', background: 'linear-gradient(90deg,#f6c453,#f97316)', transition: 'none' }} /></div>
                  {tp.map((c, i) => { const pct = i === 0 ? 0 : ((acc += lens[i - 1]) / tot) * 100; return <div key={c + i} className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${NODE[c].kind === 'city' ? 'h-3.5 w-3.5 border-amber-200 bg-amber-500' : 'h-2 w-2 border-white/60 bg-stone-800'}`} style={{ left: `${pct}%` }} />; })}
                </div>
                <div className="mt-1.5 flex justify-between text-[13px] text-stone-300"><span>{NODE[tp[0]].name}</span><span className="text-stone-500">ผ่าน {tp.length - 2} จุด</span><span className="text-amber-300">{NODE[tp[tp.length - 1]].name}</span></div>
                <div className="mt-1 flex items-center justify-between text-[13px]"><span className="text-stone-400">⚔ ระวังศัตรูซุ่มโจมตีตามทาง</span><span className="text-amber-200">ETA <span ref={etaRef}>…</span></span></div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* bottom bar */}
      <div className={`absolute inset-x-0 bottom-0 flex justify-center p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] ${traveling ? 'hidden' : ''}`}>
        <div className="panel slide-up w-full max-w-xl rounded-2xl p-3">
          {traveling ? (
            <div className="text-center text-sm text-amber-200">🚶 กำลังเดินทาง...</div>
          ) : sel ? (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-base font-bold text-amber-300">{NODE[sel].name} <span className="text-xs font-normal text-stone-400">{NODE[sel].en}</span></div>
                <div className="text-[13px]" style={{ color: NODE_KIND_INFO[NODE[sel].kind].color }}>{NODE_KIND_INFO[NODE[sel].kind].icon} {NODE_KIND_INFO[NODE[sel].kind].th} — {NODE_KIND_INFO[NODE[sel].kind].desc}{NODE[sel].kind !== 'city' && game.visited.includes(sel) && <span className="ml-1 text-stone-400">(เคยแวะแล้ว)</span>}</div>
                <div className="truncate text-[13px] text-stone-400">เส้นทาง {(path?.length ?? 1) - 1} ช่วง • ผ่านเมือง: {path?.filter((c, i) => i > 0 && NODE[c].kind === 'city').map((c) => NODE[c].name).join(', ') || '-'}</div>
                {Math.round(destTier * 2.2 - 1.5) > partyLevel(game) + 3 && <div className="text-[13px] font-bold text-red-400">⚠ อันตรายสูง! ศัตรูเลเวลสูงกว่าปาร์ตี้มาก</div>}
                <div className="text-[13px]">⏱ {fmtDuration(travelMinutes(pNodes))} • อันตราย <span style={{ color: tierColor(maxTier) }}>{'☠'.repeat(Math.max(1, Math.ceil(maxTier / 2)))}</span> • ศัตรู Lv{levelRange(destTier)}</div>
                <div className="text-[13px] text-sky-300">🕐 ถึงปลายทางประมาณ {fmtTime(addMinutes(game.day, game.minute, travelMinutes(pNodes)).minute)}</div>
              </div>
              <button className="btn btn-red pulse-glow shrink-0 px-5 py-3 text-lg" onClick={() => path && onStartTravel(path)}>⚔ เดินทาง</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 text-sm">
                <div>📍 อยู่ที่ <b className="text-amber-300">{NODE_KIND_INFO[NODE[game.location].kind].icon} {NODE[game.location].name}</b></div>
                <div className="text-[13px] text-stone-400">แตะจุดบนแผนที่เพื่อเลือกจุดหมาย • ←→ เมือง • ↑↓ จุดใกล้เคียง</div>
              </div>
              {NODE[game.location].kind === 'city' && <button className="btn btn-gold shrink-0" onClick={onOpenCity}>🏙 เข้าเมือง</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
