/**
 * Town market.
 *
 * Prices are not stored anywhere — every figure here is recomputed from
 * (city, material, day, minute) via market/price.ts. Two consequences the
 * player can feel: reopening the tab never changes a number, and a price
 * chart can show 30 days of history without anything being persisted.
 */

import { useState } from 'react';
import { CITY, CITY_INFO, RARITY } from '../game/data';
import { MATERIAL, MATERIALS, type Material } from '../data/economy/materials';
import { RECIPES, bonusOf, goldCost, type Recipe } from '../data/economy/recipes';
import { makeEquip, uid } from '../game/engine';
import { canCraft } from '../game/economy/craft';
import { add as addItem, count, take, total } from '../game/inv';
import { allCityIds, buyPrice, priceHistory, sellPrice, statsOf, trend } from '../game/market/price';
import { PHASE, dayPhase, fmtTime } from '../game/time';
import type { GameState } from '../game/types';
import { Sparkline, trendArrow, trendColor } from './Sparkline';

type Update = (fn: (g: GameState) => void) => void;

const REGION_NAME: Record<Material['region'], string> = {
  north: 'เหนือ', central: 'กลาง', northeast: 'อีสาน', east: 'ตะวันออก', south: 'ใต้',
};

/**
 * Coin amounts here reach six figures (a full bag of shadowhearts is ~150k),
 * which is unreadable without separators. The rest of the UI prints gold raw
 * because it rarely gets that large; the market is where it does.
 */
const coin = (n: number): string => n.toLocaleString('en-US');

/** Where this material is cheapest to buy, across every city. */
function cheapest(matId: string, day: number, minute: number): { city: string; price: number } {
  let best = { city: '', price: Infinity };
  for (const id of allCityIds()) {
    const p = buyPrice(id, matId, day, minute);
    if (p < best.price) best = { city: id, price: p };
  }
  return best;
}

/** Where it pays best to sell, across every city. */
function bestBuyer(matId: string, day: number, minute: number): { city: string; price: number } {
  let best = { city: '', price: 0 };
  for (const id of allCityIds()) {
    const p = sellPrice(id, matId, day, minute);
    if (p > best.price) best = { city: id, price: p };
  }
  return best;
}

export function MarketPanel({ game, update, toast }: { game: GameState; update: Update; toast: (s: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [view, setView] = useState<'trade' | 'craft'>('trade');
  const { day, minute } = game;
  const cityId = game.location;
  const phase = PHASE[dayPhase(minute)];

  // Only materials this city actually trades.
  const traded = MATERIALS.filter((m) => m.homes.includes(cityId) || m.tier <= Math.max(1, Math.min(5, 1 + Math.floor((CITY[cityId]?.tier ?? 1) / 1.7))));
  const held = Object.keys(game.inv).filter((id) => MATERIALS.some((m) => m.id === id));

  const buy = (m: Material, qty: number) => {
    const unit = buyPrice(cityId, m.id, day, minute);
    const cost = unit * qty;
    if (game.gold < cost) return;
    update((g) => { g.gold -= cost; addItem(g.inv, m.id, qty); });
    toast(`ซื้อ ${m.icon}${m.name} x${qty} −${coin(cost)} 🪙`);
  };

  const sell = (m: Material, qty: number) => {
    const have = count(game.inv, m.id);
    const n = Math.min(have, qty);
    if (n <= 0) return;
    const unit = sellPrice(cityId, m.id, day, minute);
    update((g) => { take(g.inv, m.id, n); g.gold += unit * n; });
    toast(`ขาย ${m.icon}${m.name} x${n} +${coin(unit * n)} 🪙`);
  };

  return (
    <div className="space-y-3">
      <div className="mb-1 flex gap-1">
        <button className={`btn flex-1 px-3 py-1.5 text-sm ${view === 'trade' ? 'btn-gold' : 'btn-dark'}`} onClick={() => setView('trade')}>💵 ซื้อ/ขาย</button>
        <button className={`btn flex-1 px-3 py-1.5 text-sm ${view === 'craft' ? 'btn-gold' : 'btn-dark'}`} onClick={() => setView('craft')}>⚒️ ครอฟต์</button>
      </div>
      {view === 'craft' ? <Forge game={game} update={update} toast={toast} /> : <>
      {/* ---------- portfolio ---------- */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="เงินในมือ" value={coin(game.gold)} unit="🪙" tone="text-amber-300" />
        <Stat label="วันที่" value={`${day} · ${fmtTime(minute)}`} unit={phase.icon} tone="text-stone-200" />
        <Stat label="วัตถุดิบ" value={`${held.length}`} unit="ชนิ้ด" tone="text-lime-300" />
        <Stat label="มูลค่ารวม" value={coin(total(game.inv))} unit="ชิ้น" tone="text-sky-300" />
      </div>

      {/* ---------- hint: where the real money is ---------- */}
      <BestTip day={day} minute={minute} />

      {/* ---------- your stock ---------- */}
      {held.length > 0 && (
        <section>
          <h3 className="mb-1 text-sm font-bold text-lime-300">🎒 วัตถุดิบที่คุณถือ ({held.length})</h3>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {held.map((id) => {
              const m = MATERIALS.find((x) => x.id === id)!;
              const n = count(game.inv, id);
              const unit = sellPrice(cityId, id, day, minute);
              return (
                <div key={id} className="flex items-center gap-2 rounded-lg bg-black/30 p-2 text-sm">
                  <span className="text-xl">{m.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{m.name}</span>
                    <span className="block text-[12px] text-stone-400">x{n} · ขายได้ {coin(unit)} 🪙/ชิ้น</span>
                  </span>
                  <button className="btn btn-dark shrink-0 px-2 py-1 text-xs" onClick={() => sell(m, 1)}>ขาย 1</button>
                  <button className="btn btn-green shrink-0 px-2 py-1 text-xs" onClick={() => sell(m, n)}>ทั้งหมด</button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------- market board ---------- */}
      <section>
        <h3 className="mb-1 text-sm font-bold text-amber-200">📈 ตลาดวัตถุดิบ — {traded.length} รายการ</h3>
        <p className="mb-2 text-[12px] text-stone-400">
          ราคาขยับตามวันและช่วงเวลา · เมืองที่ผลิตได้จะขายถูกกว่า · แตะเพื่อดูกราฟ 30 วัน
        </p>
        <div className="space-y-1.5">
          {traded.map((m) => {
            const series = priceHistory(cityId, m.id, day, minute, 30);
            const st = statsOf(series);
            const buyNow = buyPrice(cityId, m.id, day, minute);
            const sellNow = sellPrice(cityId, m.id, day, minute);
            const local = m.homes.includes(cityId);
            const chg = trend(series);
            const isOpen = open === m.id;
            const have = count(game.inv, m.id);
            return (
              <div key={m.id} className="rounded-lg border border-white/10 bg-black/30">
                <button className="flex w-full items-center gap-2 p-2 text-left" onClick={() => setOpen(isOpen ? null : m.id)}>
                  <span className="text-xl">{m.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-bold">
                      {m.name}
                      {local && <span className="rounded bg-lime-900/70 px-1 text-[10px] text-lime-300">บ้านเกิด</span>}
                      <span className="text-[11px] font-normal text-stone-500">T{m.tier} · {REGION_NAME[m.region]}</span>
                    </span>
                    <span className="text-[12px] text-stone-400">
                      ซื้อ {coin(buyNow)} · ขาย {coin(sellNow)} 🪙
                      {have > 0 && <span className="text-lime-300"> · ถือ {have}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-bold text-amber-200">{coin(st.current)} 🪙</span>
                    <span className="block text-[12px]" style={{ color: trendColor(chg) }}>
                      {trendArrow(chg)} {chg > 0 ? '+' : ''}{chg}%
                    </span>
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-white/10 p-2">
                    <Sparkline data={series} color={trendColor(chg)} height={64} className="mb-1" />
                    <div className="flex justify-between text-[11px] text-stone-400">
                      <span>ต่ำ {coin(st.min)}</span>
                      <span>เฉลี่ย {coin(st.avg)}</span>
                      <span>สูง {coin(st.max)}</span>
                    </div>
                    <MarketAdvice mat={m} day={day} minute={minute} local={local} />
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button className="btn btn-dark px-2.5 py-1 text-xs" disabled={game.gold < buyNow} onClick={() => buy(m, 1)}>ซื้อ 1 · {buyNow} 🪙</button>
                      <button className="btn btn-dark px-2.5 py-1 text-xs" disabled={game.gold < buyNow * 5} onClick={() => buy(m, 5)}>ซื้อ 5 · {buyNow * 5} 🪙</button>
                      <span className="flex-1" />
                      <button className="btn btn-dark px-2.5 py-1 text-xs" disabled={have < 1} onClick={() => sell(m, 1)}>ขาย 1 · {sellNow} 🪙</button>
                      <button className="btn btn-green px-2.5 py-1 text-xs" disabled={have < 1} onClick={() => sell(m, have)}>ขายทั้งหมด ({have})</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {held.length === 0 && (
        <p className="rounded-lg bg-black/30 p-3 text-center text-[13px] text-stone-500">
          ยังไม่มีวัตถุดิบในกระเป๋า — ไปล่ามอนสเตอร์เพื่อหามัน<br />
          <span className="text-stone-600">วัตถุดิบซื้อไม่ได้ ต้องได้จากการสู้</span>
        </p>
      )}
      </>}
    </div>
  );
}

function Stat({ label, value, unit, tone }: { label: string; value: string; unit: string; tone: string }) {
  return (
    <div className="rounded-lg bg-black/30 p-2 text-center">
      <div className="text-[11px] text-stone-400">{label}</div>
      <div className={`text-lg font-bold ${tone}`}>{value}</div>
      <div className="text-[11px] text-stone-500">{unit}</div>
    </div>
  );
}

/** One-line, actionable advice — the thing that makes the system legible. */
function MarketAdvice({ mat, day, minute, local }: { mat: Material; day: number; minute: number; local: boolean }) {
  const cheap = cheapest(mat.id, day, minute);
  const rich = bestBuyer(mat.id, day, minute);
  const lines: string[] = [];
  if (local) lines.push(`📍 ที่นี่คือบ้านเกิดของ${mat.name} — ราคาถูกที่สุดที่จะหาได้`);
  else lines.push(`💰 ซื้อถูกที่สุดที่ ${CITY[cheap.city]?.name ?? cheap.city} (${cheap.price} 🪙)`);
  lines.push(`📤 ขายได้มากที่สุดที่ ${CITY[rich.city]?.name ?? rich.city} (${rich.price} 🪙)`);
  const margin = rich.price - cheap.price;
  if (margin > 0 && !local) lines.push(`💡 เดินทางไปเทรด กำไรประมาณ ${margin} 🪙 ต่อชิ้น`);
  return <div className="mt-1 space-y-0.5 text-[12px] text-stone-400">{lines.map((l, i) => <div key={i}>{l}</div>)}</div>;
}

/** Highlights the single most valuable opportunity on the board. */
function BestTip({ day, minute }: { day: number; minute: number }) {
  let best: { m: Material; from: string; to: string; gain: number } | null = null;
  for (const m of MATERIALS) {
    const c = cheapest(m.id, day, minute);
    const b = bestBuyer(m.id, day, minute);
    const gain = b.price - c.price;
    if (gain > 0 && (!best || gain > best.gain)) best = { m, from: c.city, to: b.city, gain };
  }
  if (!best) return null;
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-900/20 p-2 text-[13px]">
      <b className="text-amber-200">💡 โอกาสที่คุ้มที่สุดวันนี้</b>
      <div className="text-stone-300">
        {best.m.icon}{best.m.name}: ซื้อที่ {CITY[best.from]?.name ?? best.from} → ขายที่ {CITY[best.to]?.name ?? best.to}
        {' '}<b className="text-lime-300">+{coin(best.gain)} 🪙/ชิ้น</b>
      </div>
    </div>
  );
}

/** Recipes the smith will take here. The smith's own city cuts the fee. */
function Forge({ game, update, toast }: { game: GameState; update: Update; toast: (s: string) => void }) {
  const smith = CITY[game.location] ? (CITY_INFO[game.location]?.perk === 'gear') : false;
  const fee = (n: number) => Math.round(n * (smith ? 0.75 : 1));
  const onCraft = (r: Recipe) => {
    const chk = canCraft(game, r.id);
    if (!chk.ok) { toast('ยังขาดวัตถุดิบหรือทองไม่พอ'); return; }
    update((g) => {
      const real = fee(goldCost(r));
      g.gold -= fee(goldCost(r));
      for (const [id, n] of Object.entries(r.cost)) take(g.inv, id, n);
      if (r.output) { addItem(g.inv, r.output.item, r.output.qty); return; }
      const item = makeEquip({ iid: '', id: r.id, name: r.name, icon: r.icon, slot: r.slot ?? 'weapon', tier: r.tier, rarity: r.rarity, bonus: bonusOf(r), price: real * 3 }, r.rarity);
      item.iid = uid('i');
      g.bag.push(item);
      toast(`⚒️ ครอฟต์ ${r.icon}${r.name} สำเร็จ!`);
    });
  };
  return (
    <div className="space-y-2">
      <p className="rounded-lg bg-black/30 p-2 text-[12px] text-stone-400">
        ⚒️ ครอฟต์อุปกรณ์จากวัตถุดิบ — ยิ่งล่ายาก ยิ่งได้ของแพง
        {smith && <b className="text-lime-300"> · เมืองช่างตีเหล็ก ค่าแรงลด 25%</b>}
      </p>
      {RECIPES.map((r) => {
        const need = Object.entries(r.cost);
        const short = need.filter(([id, n]) => count(game.inv, id) < n);
        const feeGold = fee(goldCost(r));
        const ready = short.length === 0 && game.gold >= feeGold;
        return (
          <div key={r.id} className={`rounded-lg border p-2 ${ready ? 'border-lime-600/70 bg-lime-950/25' : 'border-white/10 bg-black/30'}`}>
            <div className="flex items-center gap-2">
              <span className="text-xl">{r.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-bold">
                  {r.name}
                  <span className="text-[11px] font-normal text-stone-500">T{r.tier}{r.output ? '' : ' · ' + (RARITY[r.rarity]?.name ?? '')}</span>
                </span>
                <span className="block text-[12px] text-stone-400">{r.desc}</span>
              </span>
              <button className={`btn shrink-0 px-3 py-1 text-xs ${ready ? 'btn-green' : 'btn-dark'}`} disabled={!ready} onClick={() => onCraft(r)}>
                {ready ? 'ครอฟต์' : 'ยังไม่ครบ'}
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[12px]">
              {need.map(([id, n]) => {
                const m = MATERIAL[id];
                const have = count(game.inv, id);
                const ok = have >= n;
                return <span key={id} className={`rounded px-1.5 py-0.5 ${ok ? 'bg-lime-900/60 text-lime-200' : 'bg-red-950/60 text-red-300'}`}>{m?.icon} {m?.name} {have}/{n}</span>;
              })}
              <span className={`ml-auto ${game.gold >= feeGold ? 'text-amber-300' : 'text-stone-500'}`}>🪙 {coin(feeGold)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
