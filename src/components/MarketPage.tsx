/**
 * Market page.
 *
 * Reorganised around a two-column layout: a filter rail on the left, the
 * market on the right. The old view was a single scrolling list where a
 * material's chart only appeared after you tapped it, so you could not compare
 * two goods at once — the point of a market screen.
 *
 *   ┌────────────┬──────────────────────────┐
 *   │ 🔍 search  │  header: purse + clock     │
 *   │ ⭐ mine    │  ┌──────────────────────┐ │
 *   │ 📦 goods   │  │ 🥇 gold   1,240  ▲  │ │
 *   │ ⚒️ forge   │  │ sparkline            │ │
 *   │ 🏘️ local   │  │ [buy][sell]         │ │
 *   └────────────┴──────────────────────────┘ │
 */

import { useMemo, useState } from 'react';
import { CITY, CITY_INFO } from '../game/data';
import { MATERIALS, type Material } from '../data/economy/materials';
import { RECIPES, bonusOf, goldCost } from '../data/economy/recipes';
import { add as addItem, count, take } from '../game/inv';
import { allCityIds, buyPrice, priceHistory, sellPrice, statsOf, trend } from '../game/market/price';
import { PHASE, dayPhase, fmtTime } from '../game/time';
import type { GameState } from '../game/types';
import { Sparkline, trendArrow, trendColor } from './Sparkline';

type Update = (fn: (g: GameState) => void) => void;

const coin = (n: number) => n.toLocaleString('en-US');

type Filter = 'all' | 'mine' | 'local' | 'craft';

export function MarketPage({ game, update, toast }: { game: GameState; update: Update; toast: (s: string) => void }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [tab, setTab] = useState<'trade' | 'craft'>('trade');
  const [sel, setSel] = useState<string | null>(null);
  const { day, minute, location: cityId } = game;
  const phase = PHASE[dayPhase(minute)];

  const traded = useMemo(() => MATERIALS.filter(
    (m) => m.homes.includes(cityId) || m.tier <= Math.max(1, Math.min(5, 1 + Math.floor((CITY[cityId]?.tier ?? 1) / 1.7))),
  ), [cityId]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return traded
      .filter((m) => (filter === 'all' ? true : filter === 'mine' ? count(game.inv, m.id) > 0 : filter === 'local' ? m.homes.includes(cityId) : true))
      .filter((m) => !term || m.name.toLowerCase().includes(term) || m.id.includes(term))
      .map((m) => {
        const series = priceHistory(cityId, m.id, day, minute, 30);
        return { m, series, st: statsOf(series), chg: trend(series), have: count(game.inv, m.id) };
      })
      .sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg));
  }, [traded, q, filter, cityId, day, minute, game.inv]);

  // Everything the player actually holds, each with its own chart.
  const owned = useMemo(() => MATERIALS
    .map((m) => {
      const have = count(game.inv, m.id);
      if (have <= 0) return null;
      const series = priceHistory(cityId, m.id, day, minute, 30);
      return { m, have, series, st: statsOf(series), chg: trend(series) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null), [game.inv, cityId, day, minute]);

  const heldValue = owned.reduce((s, o) => s + o.have * sellPrice(cityId, o.m.id, day, minute), 0);

  const doBuy = (m: Material, n: number) => {
    const cost = buyPrice(cityId, m.id, day, minute) * n;
    if (game.gold < cost) return;
    update((g) => { g.gold -= cost; addItem(g.inv, m.id, n); });
    toast(`ซื้อ ${m.icon}${m.name} x${n} −${coin(cost)} 🪙`);
  };
  const doSell = (m: Material, n: number) => {
    const have = count(game.inv, m.id);
    const k = Math.min(have, n);
    if (k <= 0) return;
    const got = sellPrice(cityId, m.id, day, minute) * k;
    update((g) => { take(g.inv, m.id, k); g.gold += got; });
    toast(`ขาย ${m.icon}${m.name} x${k} +${coin(got)} 🪙`);
  };

  return (
    <div className="space-y-2">
      {/* ---------- header strip ---------- */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-black/30 px-3 py-2">
        <div className="flex-1">
          <div className="text-[12px] text-stone-400">เงินในมือ</div>
          <div className="text-xl font-bold text-amber-300">🪙 {coin(game.gold)}</div>
        </div>
        <div className="flex-1">
          <div className="text-[12px] text-stone-400">มูลค่าวัตถุดิบ</div>
          <div className="text-xl font-bold text-lime-300">🪨 {coin(heldValue)}</div>
        </div>
        <div className="flex-1">
          <div className="text-[12px] text-stone-400">เวลา</div>
          <div className="text-xl font-bold" style={{ color: phase.color }}>{phase.icon} {fmtTime(minute)}</div>
        </div>
        <div className="flex-1">
          <div className="text-[12px] text-stone-400">วันที่</div>
          <div className="text-xl font-bold text-stone-200">{day}</div>
        </div>
      </div>

      <div className="flex gap-1">
        <button className={`btn flex-1 py-1.5 text-sm ${tab === 'trade' ? 'btn-gold' : 'btn-dark'}`} onClick={() => setTab('trade')}>💵 ซื้อ / ขาย</button>
        <button className={`btn flex-1 py-1.5 text-sm ${tab === 'craft' ? 'btn-gold' : 'btn-dark'}`} onClick={() => setTab('craft')}>⚒️ ครอฟต์</button>
      </div>

      {tab === 'craft' ? (
        <Forge game={game} update={update} toast={toast} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-[150px_1fr]">
          {/* ---------- filter rail ---------- */}
          <div className="space-y-1.5">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="🔍 ค้นหาวัตถุดิบ"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-stone-200 placeholder-stone-500 focus:border-amber-500 focus:outline-none"
            />
            {([
              ['all', '📦 ทั้งหมด', traded.length],
              ['mine', '⭐ ที่ฉันมี', owned.length],
              ['local', '🏘️ ของท้องถิ่น', traded.filter((m) => m.homes.includes(cityId)).length],
            ] as [Filter, string, number][]).map(([k, label, n]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[13px] ${filter === k ? 'bg-amber-500/25 ring-1 ring-amber-300' : 'bg-black/30 hover:bg-black/50'}`}>
                <span className="flex-1">{label}</span>
                <span className="text-stone-500">{n}</span>
              </button>
            ))}
            {heldValue > 0 && (
              <button className="w-full rounded-lg bg-lime-900/40 px-2 py-1.5 text-left text-[13px] text-lime-200 hover:bg-lime-900/60"
                onClick={() => owned.forEach((o) => doSell(o.m, o.have))}>
                💰 ขายวัตถุดิบทั้งหมด<br />
                <span className="text-[11px] opacity-70">+{coin(heldValue)} 🪙</span>
              </button>
            )}
          </div>

          {/* ---------- the market ---------- */}
          <div className="space-y-1.5">
            {rows.length === 0 && <div className="py-8 text-center text-sm text-stone-500">ไม่พบวัตถุดิบที่ค้นหา</div>}
            {rows.map(({ m, series, st, chg, have }) => {
              const buy = buyPrice(cityId, m.id, day, minute);
              const sell = sellPrice(cityId, m.id, day, minute);
              const isOpen = sel === m.id;
              const local = m.homes.includes(cityId);
              return (
                <div key={m.id} className={`rounded-lg border ${isOpen ? 'border-amber-500/60 bg-black/50' : 'border-white/10 bg-black/30'}`}>
                  <button className="flex w-full items-center gap-2 p-2 text-left" onClick={() => setSel(isOpen ? null : m.id)}>
                    <span className="text-xl">{m.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1">
                        <b className="text-sm">{m.name}</b>
                        {local && <span className="rounded bg-lime-900/70 px-1 text-[10px] text-lime-300">ท้องถิ่น</span>}
                        <span className="text-[10px] text-stone-500">T{m.tier}</span>
                        {have > 0 && <span className="rounded bg-sky-900/70 px-1 text-[10px] text-sky-300">มี {have}</span>}
                      </span>
                      <span className="block text-[11px] text-stone-400">ซื้อ {coin(buy)} · ขาย {coin(sell)} 🪙</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-bold text-amber-200">{coin(st.current)}</span>
                      <span className="block text-[11px]" style={{ color: trendColor(chg) }}>{trendArrow(chg)} {chg > 0 ? '+' : ''}{chg}%</span>
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/10 px-2 pb-2 pt-1">
                      <Sparkline data={series} color={trendColor(chg)} height={58} />
                      <div className="mb-1.5 flex justify-between text-[11px] text-stone-400">
                        <span>ต่ำ {coin(st.min)}</span>
                        <span>เฉลี่ย {coin(st.avg)}</span>
                        <span>สูง {coin(st.max)}</span>
                      </div>
                      <Advice m={m} day={day} minute={minute} local={local} />
                      <div className="flex flex-wrap gap-1">
                        <button className="btn btn-dark px-2.5 py-1 text-xs" disabled={game.gold < buy} onClick={() => doBuy(m, 1)}>ซื้อ 1</button>
                        <button className="btn btn-dark px-2.5 py-1 text-xs" disabled={game.gold < buy * 10} onClick={() => doBuy(m, 10)}>ซื้อ 10</button>
                        <button className="btn btn-dark px-2.5 py-1 text-xs" disabled={have < 1} onClick={() => doSell(m, 1)}>ขาย 1</button>
                        <button className="btn btn-green px-2.5 py-1 text-xs" disabled={have < 1} onClick={() => doSell(m, have)}>ขายทั้งหมด</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Where this good is actually worth buying, and where it pays to sell. */
function Advice({ m, day, minute, local }: { m: Material; day: number; minute: number; local: boolean }) {
  let cheap = { c: '', p: Infinity };
  let rich = { c: '', p: 0 };
  for (const id of allCityIds()) {
    const b = buyPrice(id, m.id, day, minute);
    if (b < cheap.p) cheap = { c: id, p: b };
    const s = sellPrice(id, m.id, day, minute);
    if (s > rich.p) rich = { c: id, p: s };
  }
  const margin = rich.p - cheap.p;
  return (
    <div className="mb-1.5 space-y-0.5 rounded bg-black/30 p-1.5 text-[11px] text-stone-400">
      {local && <div>📍 ที่นี่คือบ้านเกิดของ{m.name} — ราคาต่ำที่สุดในประเทศ</div>}
      <div>💰 ซื้อถูกที่สุดที่ {CITY[cheap.c]?.name} ({coin(cheap.p)} 🪙)</div>
      <div>📤 ขายได้มากที่สุดที่ {CITY[rich.c]?.name} ({coin(rich.p)} 🪙)</div>
      {margin > 0 && !local && <div className="text-lime-300">💡 เดินทางไปเทรด กำไร ~{coin(margin)} 🪙/ชิ้น</div>}
    </div>
  );
}

/** Crafting bench. */
function Forge({ game, update, toast }: { game: GameState; update: Update; toast: (s: string) => void }) {
  const smith = CITY_INFO[game.location]?.perk === 'gear';
  const fee = (n: number) => Math.round(n * (smith ? 0.75 : 1));
  const onCraft = (id: string) => {
    const r = RECIPES.find((x) => x.id === id);
    if (!r) return;
    const need = Object.entries(r.cost);
    if (need.some(([mid, n]) => count(game.inv, mid) < n) || game.gold < fee(goldCost(r))) {
      toast('ยังขาดวัตถุดิบหรือทองไม่พอ'); return;
    }
    const cost = fee(goldCost(r));
    update((g) => {
      g.gold -= cost;
      for (const [mid, n] of need) take(g.inv, mid, n);
      if (r.output) { addItem(g.inv, r.output.item, r.output.qty); return; }
      const b = bonusOf(r);
      g.bag.push({ iid: `c${g.day}-${g.bag.length}-${id}`, id, name: r.name, icon: r.icon, slot: r.slot ?? 'weapon', tier: r.tier, rarity: r.rarity, bonus: b, price: cost * 3 });
    });
    toast(`⚒️ ครอฟต์ ${r.icon}${r.name} สำเร็จ!`);
  };

  return (
    <div className="space-y-1.5">
      <p className="rounded-lg bg-black/30 p-2 text-[12px] text-stone-400">
        ⚒️ ครอฟต์อุปกรณ์จากวัตถุดิบ — ยิ่งล่ายาก ยิ่งได้ของแพง
        {smith && <b className="text-lime-300"> · เมืองช่างตีเหล็ก ค่าแรงลด 25%</b>}
      </p>
      {RECIPES.map((r) => {
        const need = Object.entries(r.cost);
        const ready = need.every(([mid, n]) => count(game.inv, mid) >= n);
        const g = fee(goldCost(r));
        const can = ready && game.gold >= g;
        return (
          <div key={r.id} className={`rounded-lg border p-2 ${can ? 'border-lime-600/70 bg-lime-950/25' : 'border-white/10 bg-black/30'}`}>
            <div className="flex items-center gap-2">
              <span className="text-xl">{r.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1">
                  <b className="text-sm">{r.name}</b>
                  <span className="text-[10px] text-stone-500">T{r.tier}{r.output ? '' : ` · ${['', 'ธรรมดา', 'หายาก', 'มหากาพย์'][r.rarity]}`}</span>
                </span>
                <span className="block text-[11px] text-stone-400">{r.desc}</span>
              </span>
              <button className={`btn shrink-0 px-3 py-1 text-xs ${can ? 'btn-green' : 'btn-dark'}`} disabled={!can} onClick={() => onCraft(r.id)}>
                {can ? 'ครอฟต์' : 'ยังไม่ครบ'}
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px]">
              {need.map(([mid, n]) => {
                const mat = MATERIALS.find((x) => x.id === mid);
                const have = count(game.inv, mid);
                const ok = have >= n;
                return (
                  <span key={mid} className={`rounded px-1.5 py-0.5 ${ok ? 'bg-lime-900/60 text-lime-200' : 'bg-red-950/60 text-red-300'}`}>
                    {mat?.icon} {mat?.name} {have}/{n}
                  </span>
                );
              })}
              <span className={`ml-auto ${game.gold >= g ? 'text-amber-300' : 'text-stone-500'}`}>🪙 {coin(g)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
