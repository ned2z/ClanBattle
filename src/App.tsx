import { useCallback, useEffect, useRef, useState } from 'react';
import BattleScreen from './components/BattleScreen';
import FxLayer from './components/FxLayer';
import MapScreen from './components/MapScreen';
import { CityPanel, Modal, QuestList, RankPanel, randomTip } from './components/Panels';
import PartyMenu from './components/PartyMenu';
import AdventureLog, { LogTicker } from './components/AdventureLog';
import StartScreen, { DEFAULT_SETUP, HighScoreTable, type Setup } from './components/StartScreen';
import { CITY, NODE } from './game/data';
import { makeEncounter, partyLevel, rint, type BattleState } from './game/engine';
import { fx } from './game/fx';
import { addLog, applyBattle, arriveCity, arriveNode, completeQuests, loadHS, newGame, rankOf, saveHS, type BattleSummary, type HighScore } from './game/store';
import type { EnemyGroup, GameState, Travel } from './game/types';

type Screen = 'start' | 'map' | 'battle' | 'gameover';
type Panel = null | 'city' | 'party' | 'quests' | 'rank' | 'log';

export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [game, setGame] = useState<GameState | null>(null);
  const [group, setGroup] = useState<EnemyGroup | null>(null);
  const [battleKey, setBattleKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [hs, setHs] = useState<HighScore[]>(loadHS);
  const [lastHS, setLastHS] = useState<HighScore | null>(null);
  const [setup, setSetup] = useState<Setup>(() => { try { return JSON.parse(localStorage.getItem('tbs-setup') || '') as Setup; } catch { return DEFAULT_SETUP; } });
  const [transition, setTransition] = useState(0);
  const [runId, setRunId] = useState(0);
  const gameRef = useRef(game);
  gameRef.current = game;
  const shakeRef = useRef<HTMLDivElement>(null);
  useEffect(() => { fx.setShake(shakeRef.current); }, []);

  const toast = useCallback((text: string) => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-3), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const update = useCallback((fn: (g: GameState) => void) => {
    setGame((g) => { if (!g) return g; const n = structuredClone(g); fn(n); return n; });
  }, []);

  const start = useCallback((s: Setup) => {
    setSetup(s);
    localStorage.setItem('tbs-setup', JSON.stringify(s));
    setGame(newGame(s.partyName || 'ปาร์ตี้ไร้นาม', s.classes, s.names));
    setScreen('map'); setPaused(false); setPanel(null); setGroup(null); setTransition((x) => x + 1); setRunId((x) => x + 1);
    toast('📜 ภารกิจแรก: ออกเดินทางและปราบศัตรู!');
  }, [toast]);

  const endGame = useCallback(() => {
    const g = gameRef.current; if (!g) return;
    const entry: HighScore = { name: g.partyName, score: g.score, fame: g.fame, level: partyLevel(g), rank: rankOf(g), date: new Date().toISOString(), top: g.reachedTop };
    setHs(saveHS(entry)); setLastHS(entry);
    setScreen('gameover'); setPaused(false); setPanel(null);
  }, []);

  // ---------- map callbacks
  const onStartTravel = useCallback((path: string[]) => {
    if (path.length < 2) return;
    update((g) => { g.travel = { path, seg: 0, t: 0 }; });
    setPanel(null);
  }, [update]);

  const onEncounter = useCallback((t: Travel, tier: number) => {
    const g = gameRef.current; if (!g) return;
    const grp = makeEncounter(g, tier);
    grp.biome = NODE[t.t < 0.5 ? t.path[t.seg] : t.path[t.seg + 1] ?? t.path[t.seg]].biome;
    update((n) => { n.travel = t; });
    setGroup(grp); setBattleKey((k) => k + 1); setScreen('battle'); setTransition((x) => x + 1);
  }, [update]);

  const onArrive = useCallback((city: string, sec: number) => {
    const g = gameRef.current; if (!g) return;
    const n = structuredClone(g);
    if (NODE[city].kind !== 'city') {
      const res = arriveNode(n, city);
      n.day += Math.max(1, Math.round(sec / 20));
      setGame(n); gameRef.current = n;
      res.msgs.forEach((m) => toast(m));
      if (res.battle) {
        const grp = makeEncounter(n, NODE[city].tier + 0.6);
        grp.biome = NODE[city].biome;
        grp.title = `⛺ ค่ายโจร ${NODE[city].name}`;
        grp.units.push(...makeEncounter(n, NODE[city].tier).units.slice(0, Math.max(0, 4 - grp.units.length)));
        setTimeout(() => { setGroup(grp); setBattleKey((k) => k + 1); setScreen('battle'); setTransition((x) => x + 1); }, 700);
      }
      return;
    }
    arriveCity(n, city);
    n.day += Math.max(1, Math.round(sec / 20));
    const sum = { gold: 0, fame: 0, score: 0, levelUps: [] as { name: string; level: number }[], questsDone: [] as string[] };
    completeQuests(n, sum);
    sum.levelUps.forEach((l) => addLog(n, 'level', `${l.name} เลเวลอัปเป็น Lv${l.level}`, '+1 SP'));
    n.score += 10;
    setGame(n);
    toast(`🏙 มาถึง ${CITY[city].name}`);
    sum.questsDone.forEach((q) => toast(`📜 สำเร็จ: ${q} (+${sum.gold}🪙)`));
    sum.levelUps.forEach((l) => toast(`⬆ ${l.name} Lv${l.level}!`));
    setTimeout(() => setPanel('city'), 450);
  }, [toast]);

  const onTreasure = useCallback((t: Travel) => {
    const g = gameRef.current; if (!g) return;
    const roll = Math.random();
    const v = rint(10, 25) * Math.max(1, partyLevel(g));
    update((n) => {
      n.travel = t;
      if (roll < 0.6) n.gold += v;
      else if (roll < 0.85) n.inv.potion++;
      else n.inv.phoenix++;
      addLog(n, 'loot', roll < 0.6 ? `พบหีบสมบัติ +${v} ทอง` : roll < 0.85 ? 'พบยาสมุนไพร 🧃' : 'พบขนนกการเวก 🪶');
    });
    toast(roll < 0.6 ? `🎁 พบหีบสมบัติ! +${v} 🪙` : roll < 0.85 ? '🎁 พบยาสมุนไพร 🧃' : '✨ พบขนนกการเวก 🪶!');
  }, [update, toast]);

  // ---------- battle callbacks
  const onFinish = useCallback((b: BattleState): BattleSummary => {
    const g = gameRef.current!;
    const n = structuredClone(g);
    const sum = applyBattle(n, b, group!);
    setGame(n);
    gameRef.current = n;
    return sum;
  }, [group]);

  const onContinue = useCallback(() => {
    setScreen('map'); setGroup(null); setTransition((x) => x + 1);
  }, []);

  // ---------- keyboard
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const key = e.key.toLowerCase();
      if (screen === 'gameover') {
        if (key === 'enter' || key === 'r' || key === ' ') { e.preventDefault(); start(setup); }
        return;
      }
      if (screen !== 'map' && screen !== 'battle') return;
      if (key === 'escape' && panel) { setPanel(null); return; }
      if (key === 'p' || key === 'escape') { setPaused((p) => !p); return; }
      if (paused) { if (key === 'enter') setPaused(false); return; }
      if (screen === 'map') {
        if (key === 'q') setPanel((p) => (p === 'party' ? null : 'party'));
        if (key === 'j') setPanel((p) => (p === 'quests' ? null : 'quests'));
        if (key === 't') setPanel((p) => (p === 'rank' ? null : 'rank'));
        if (key === 'l') setPanel((p) => (p === 'log' ? null : 'log'));
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [screen, panel, paused, start, setup]);

  // auto-pause when tab hidden
  useEffect(() => {
    const v = () => { if (document.hidden && (screen === 'map' || screen === 'battle')) setPaused(true); };
    document.addEventListener('visibilitychange', v);
    return () => document.removeEventListener('visibilitychange', v);
  }, [screen]);

  const rank = game ? rankOf(game) : 0;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0c0f0a]">
      <div ref={shakeRef} className="h-full w-full will-change-transform">
        <>
          {screen === 'start' && <div key={'s' + transition} className="fade-in h-full w-full"><StartScreen onStart={start} hs={hs} last={setup} /></div>}

          {game && screen === 'map' && (
            <div key={'run' + runId} className="fade-in relative h-full w-full">
              <MapScreen game={game} paused={paused || !!panel} active={screen === 'map'} onEncounter={onEncounter} onArrive={onArrive} onStartTravel={onStartTravel} onTreasure={onTreasure} onOpenCity={() => !game.travel && NODE[game.location].kind === 'city' && setPanel('city')} />
              {/* HUD */}
              <div className="absolute inset-x-0 top-0 flex items-start gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
                <div className="panel flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xl px-3 py-1.5 text-xs sm:text-sm">
                  <span className="max-w-[9rem] truncate font-bold text-amber-300">🚩 {game.partyName}</span>
                  <span>🪙 <b className="text-amber-200">{game.gold}</b></span>
                  <span>🎖 <b className="text-orange-300">{game.fame}</b></span>
                  <span>🏅 <b className="text-lime-300">{game.score}</b></span>
                  <span className={rank === 1 ? 'shine-text font-bold' : ''}>🏆 #{rank}</span>
                  <span className="text-stone-400">วันที่ {game.day}</span>
                </div>
                <div className="flex gap-1">
                  <button className="btn btn-gold relative px-2.5 py-1.5" title="เมนูปาร์ตี้ (Q)" onClick={() => setPanel('party')}>👥<span className="hidden sm:inline"> Party</span>{game.members.some((m) => m.sp > 0) && <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-red-500" />}</button>
                  <button className="btn btn-dark px-2.5 py-1.5" title="บันทึกการเดินทาง (L)" onClick={() => setPanel('log')}>📖</button>
                  <button className="btn btn-dark relative px-2.5 py-1.5" title="เควส (J)" onClick={() => setPanel('quests')}>📜{game.quests.length > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-sky-500 px-1 text-[11px]">{game.quests.length}</span>}</button>
                  <button className="btn btn-dark px-2.5 py-1.5" title="อันดับ (T)" onClick={() => setPanel('rank')}>🏆</button>
                  <button className="btn btn-dark px-2.5 py-1.5" title="พัก (P)" onClick={() => setPaused(true)}>⏸</button>
                </div>
              </div>
              {screen === 'map' && game.stats.battles === 0 && !game.travel && !panel && (
                <div className="pointer-events-none absolute bottom-[7.5rem] left-1/2 z-10 -translate-x-1/2 animate-bounce whitespace-nowrap rounded-full border border-amber-400 bg-black/80 px-4 py-2 text-sm text-amber-200">👆 แตะเมืองใดก็ได้ แล้วกด ⚔ เดินทาง</div>
              )}
              {screen === 'map' && panel === 'city' && <CityPanel game={game} update={update} onClose={() => setPanel(null)} toast={toast} />}
              {screen === 'map' && panel === 'party' && <PartyMenu game={game} update={update} onClose={() => setPanel(null)} toast={toast} />}
              {panel === 'log' && <AdventureLog game={game} onClose={() => setPanel(null)} />}
              {screen === 'map' && !panel && !game.travel && <LogTicker game={game} onOpen={() => setPanel('log')} />}
              {panel === 'rank' && <RankPanel game={game} onClose={() => setPanel(null)} />}
              {panel === 'quests' && <Modal title="📜 เควส" onClose={() => setPanel(null)}><QuestList game={game} update={update} /></Modal>}
            </div>
          )}

          {screen === 'battle' && game && group && (
            <div className="fade-in absolute inset-0"><BattleScreen key={battleKey} game={game} group={group} paused={paused} onFinish={onFinish} onContinue={onContinue} onGameOver={endGame} onPause={() => setPaused(true)} /></div>
          )}

          {screen === 'gameover' && game && (
            <div className="war-bg flex h-full w-full items-center justify-center overflow-y-auto p-4">
              <div className="panel pop-in w-full max-w-md rounded-2xl p-5 text-center">
                <div className="text-5xl">💀</div>
                <div className="title-font text-5xl text-red-500">GAME OVER</div>
                <div className="mt-1 text-stone-300">"{game.partyName}" ล่มสลายในสมรภูมิ</div>
                <div className="my-3 text-sm text-stone-400">คะแนน</div>
                <div className="shine-text -mt-3 text-6xl font-black">{game.score}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-black/40 p-2">🏆 อันดับ<br /><b className="text-base">#{rank}</b></div>
                  <div className="rounded-lg bg-black/40 p-2">⚔ ชนะ<br /><b className="text-base">{game.stats.wins}</b></div>
                  <div className="rounded-lg bg-black/40 p-2">💀 ฆ่า<br /><b className="text-base">{game.stats.kills}</b></div>
                  <div className="rounded-lg bg-black/40 p-2">🚩 ล้มปาร์ตี้<br /><b className="text-base">{game.stats.npcWins}</b></div>
                  <div className="rounded-lg bg-black/40 p-2">📜 เควส<br /><b className="text-base">{game.stats.quests}</b></div>
                  <div className="rounded-lg bg-black/40 p-2">⭐ เลเวล<br /><b className="text-base">{partyLevel(game)}</b></div>
                </div>
                <div className="mt-4 text-left"><div className="mb-1 text-center font-bold text-amber-300">🏆 ตารางคะแนนสูงสุด</div><HighScoreTable list={hs} highlight={lastHS} /></div>
                <button className="btn btn-red pulse-glow mt-4 w-full py-3 text-xl" onClick={() => start(setup)}>↻ เล่นใหม่ทันที (R)</button>
                <button className="btn btn-dark mt-2 w-full" onClick={() => setScreen('start')}>🏠 หน้าหลัก</button>
              </div>
            </div>
          )}
        </>
      </div>

      {/* pause */}
      {paused && (screen === 'map' || screen === 'battle') && (
        <div className="fade-in fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="panel pop-in w-full max-w-xs rounded-2xl p-5 text-center">
            <div className="title-font text-4xl text-amber-300">⏸ พักเกม</div>
            <div className="mt-2 text-xs text-stone-400">💡 {randomTip()}</div>
            <button className="btn btn-gold mt-4 w-full py-3 text-lg" onClick={() => setPaused(false)}>▶ เล่นต่อ</button>
            <button className="btn btn-red mt-2 w-full" onClick={() => start(setup)}>↻ เริ่มใหม่</button>
            <button className="btn btn-dark mt-2 w-full" onClick={() => { setPaused(false); endGame(); }}>🏳 ยอมแพ้ (บันทึกคะแนน)</button>
            <button className="btn btn-dark mt-2 w-full" onClick={() => { setPaused(false); setScreen('start'); }}>🏠 หน้าหลัก</button>
          </div>
        </div>
      )}

      {/* toasts */}
      <div className="pointer-events-none fixed left-1/2 top-16 z-[58] flex -translate-x-1/2 flex-col items-center gap-1 sm:top-20">
        {toasts.map((t) => <div key={t.id} className="pop-in whitespace-nowrap rounded-full border border-amber-500/60 bg-black/85 px-4 py-1.5 text-sm text-amber-100 shadow-lg">{t.text}</div>)}
      </div>

      <FxLayer />
    </div>
  );
}
