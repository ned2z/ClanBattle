/**
 * Town menu — three levels.
 *
 * Level 1 is the venue list, borrowing the Final Fantasy Tactics idea that a
 * town is a set of named places rather than an anonymous row of tabs. Each
 * venue carries its own name and emblem so the town has an identity, and each
 * tier-5 city earns a shop with a distinct owner.
 *
 * Level 2 is the venue's own screen. Level 3 is detail inside a screen.
 */

import { useState, type CSSProperties, type ReactNode } from 'react';
import { CITY, CITY_INFO, CLASSES, EQUIPS, ITEMS, PERK_INFO, SKILL } from '../game/data';
import { makeEquip, memberStats, priceOf as basePrice, randomCommon, MAX_SKILL_LV } from '../game/engine';
import { add as addItem, count } from '../game/inv';
import { advanceTime, restAtInn } from '../game/store';
import { hasSave, writeSave } from '../game/save';
import { CATS, newsFor, newsDate, type NewsCat } from '../game/news';
import { INN_WAKE, TRAIN_MINUTES, fmtDuration, fmtTime } from '../game/time';
import { CityPanel, Modal } from './Panels';
import { MarketPage } from './MarketPage';
import { EquipIcon, ItemIcon, RarityTag, SkillIcon } from './Icons';
import type { GameState } from '../game/types';

type Update = (fn: (g: GameState) => void) => void;

type View = 'root' | 'inn' | 'shop' | 'market' | 'guild' | 'dojo';
type Header = (title: string, sub?: string, onBack?: () => void) => ReactNode;
type Guild = 'bounty' | 'news' | null;

/** One big tile on the town board. `tint` colours the tile's own background. */
interface Venue { key: View | 'leave'; icon: string; name: string; sub?: string; desc: string; tint: string }

/** Each tier-5 city gets a named proprietor, so the biggest towns feel earned. */
const SHOP_OWNER: Record<string, string> = {
  bkk: 'ร้านของท้าวเพชร', pat: 'ร้านของแม่ค้าชาวทะเล', ayu: 'ร้านของช่างชรกวดชอง',
  kan: 'ร้านของสมุนเสนา', ns: 'ร้านของพ่อค้าทางเหนือ', kr: 'ร้านของอัศวินเก่า',
  pl: 'ร้านของช่างฝีมือล้านนา', skt: 'ร้านของเสือป่า', kk: 'ร้านของนายพรานอีสาน',
  brm: 'ร้านของนักรบผีเถื่อน', sur: 'ร้านของชาวประมงใต้', ud: 'ร้านของพ่อค้าเหนือสุด',
  cm: 'ร้านของเชิญแกะ', lpg: 'ร้านของช่างเงา', loei: 'ร้านของล่าวกระทิ่ง',
  npm: 'ร้านของพ่อค้าแม่น้ำโขง', ub: 'ร้านของกองทัพอีสาน', cti: 'ร้านของพ่อค้าแร่',
  cpn: 'ร้านของนายท่าเรือ', nst: 'ร้านของชาวสุริยัน', kbi: 'ร้านของนักประดิษฐ์',
  phu: 'ร้านของพ่อค้าไทย', hy: 'ร้านของเจ้าสำนัก', cr: 'ร้านของเจ้าเมืองเหนือ',
  nan: 'ร้านของชาวเขา', hh: 'ร้านของเจ้าพระยา', cr2: '',
};

const ownerOf = (cityId: string) => SHOP_OWNER[cityId] ?? `ร้านของ${CITY[cityId]?.name ?? cityId}`;

/**
 * Shell only: the popup chrome (backdrop, centring, scroll, close button) comes
 * from Modal. The body renders its own per-view header with the back button.
 */
export function TownMenu({ game, update, onClose, toast }: { game: GameState; update: Update; onClose: () => void; toast: (s: string) => void }) {
  const city = CITY[game.location];
  const info = CITY_INFO[city.id];
  return (
    <Modal title={<>{info.emblem} {city.name}</>} onClose={onClose} wide stack>
      <TownBody game={game} update={update} onClose={onClose} toast={toast} />
    </Modal>
  );
}

function TownBody({ game, update, onClose, toast }: { game: GameState; update: Update; onClose: () => void; toast: (s: string) => void }) {
  const [view, setView] = useState<View>('root');
  const [guild, setGuild] = useState<Guild>(null);
  const city = CITY[game.location];
  const info = CITY_INFO[city.id];
  const go = (v: View) => { setGuild(null); setView(v); };

  /**
   * `onBack` lets a view nested deeper than the venue list supply its own back
   * action. Without it the button would jump straight out of the town menu,
   * skipping the level in between.
   */
  const header: Header = (title: string, sub?: string, onBack?: () => void) => (
    <div className="mb-3 flex items-center gap-2">
      {/* On the root view the Modal already has a close button, so the slot is
          left empty to avoid showing two identical dismiss controls. */}
      {view === 'root' ? <span className="w-1 shrink-0" /> : (
        <button className="btn btn-dark px-2.5 py-1 text-sm" onClick={onBack ?? (() => go('root'))}>{'↩'}</button>
      )}
      <div className="min-w-0 flex-1">
        <div className="title-font truncate text-lg text-amber-300">{title}</div>
        {sub && <div className="truncate text-[12px] text-stone-400">{sub}</div>}
      </div>
      <div className="shrink-0 text-right text-sm">
        <div className="text-amber-200">🪙 {game.gold.toLocaleString('en-US')}</div>
        <div className="text-[11px] text-stone-400">วันที่ {game.day} · {fmtTime(game.minute)}</div>
      </div>
    </div>
  );

  // ---------------- level 1: the venue grid ----------------
  if (view === 'root') {
    const venues: Venue[] = [
      { key: 'inn', icon: '🏨', name: 'โรงแรม', desc: 'พักผ่อนฟื้นฟู · บันทึกเกม', tint: '#f6c453' },
      { key: 'shop', icon: '⚒️', name: 'Shop', sub: ownerOf(city.id), desc: 'อุปกรณ์และไอเทมของเมือง', tint: '#d9704a' },
      { key: 'market', icon: '📈', name: 'Market', sub: 'ตลาดวัตถุดิบ', desc: 'ซื้อ ขาย และครอฟต์', tint: '#4fb0a0' },
      { key: 'guild', icon: '🎖', name: 'Guild', sub: 'สมาคมการค้า', desc: 'รับเควส · อ่านข่าวสาร', tint: '#6f9fe0' },
      { key: 'dojo', icon: '📖', name: 'Dojo', sub: 'สำนักฝึก', desc: 'เปลี่ยนสกิล · ค่าเรียน 2 ชั่วโมง', tint: '#b07fe0' },
      { key: 'leave', icon: '🚪', name: 'ออกจากเมือง', desc: 'กลับไปเดินทางต่อ', tint: '#8a8a8a' },
    ];
    return (
      <div>
        {header(info.title, `อันตรายระดับ ${city.tier}`)}
        <div className="mb-3 flex items-center gap-2 rounded-xl p-2.5" style={{ background: `linear-gradient(90deg, ${info.color}33, rgba(0,0,0,.25))`, border: `1px solid ${info.color}66` }}>
          <div className="min-w-0 flex-1 text-[13px] text-stone-300">{info.desc}</div>
          <div className="shrink-0 rounded-lg bg-black/40 px-2 py-1 text-center text-[12px]">
            <div className="text-lg">{PERK_INFO[info.perk].icon}</div>
            <div className="text-lime-300">{PERK_INFO[info.perk].name}</div>
            <div className="text-stone-500">{PERK_INFO[info.perk].desc}</div>
          </div>
        </div>
        {/* Big tiles, two rows of three on a phone in landscape and on desktop —
            the whole town is visible at a glance instead of a scrolling list. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {venues.map((v) => (
            <button key={v.key} onClick={() => (v.key === 'leave' ? onClose() : go(v.key))}
              className="venue-tile group relative flex min-h-[5.5rem] flex-col justify-between overflow-hidden rounded-xl p-2.5 text-left transition"
              style={{ '--tint': v.tint } as CSSProperties}>
              <span className="venue-tile-glow" aria-hidden />
              <span className="relative flex items-start justify-between gap-1">
                <span className="text-2xl leading-none sm:text-3xl">{v.icon}</span>
                {v.key !== 'leave' && <span className="text-stone-500 transition group-hover:translate-x-0.5">›</span>}
              </span>
              <span className="relative mt-2 block">
                <span className="block text-sm font-bold leading-tight text-amber-100 sm:text-base">{v.name}</span>
                {v.sub && <span className="block truncate text-[11px] text-stone-400">{v.sub}</span>}
                <span className="mt-0.5 block text-[11px] leading-snug text-stone-500">{v.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------------- inn ----------------
  if (view === 'inn') {
    const innCost = info.perk === 'inn' ? 0 : basePrice(game, 12 + city.tier * 10);
    const saved = hasSave();
    return (
      <div>
        {header('โรงแรม', `${info.emblem} ${city.name}`)}
        <div className="space-y-2">
          <div className="rounded-xl bg-black/30 p-3">
            <div className="text-sm text-stone-300">พักผ่อนฟื้นฟู HP/MP เต็ม และชุบชีวิตสมาชิกที่ล้ม</div>
            <div className="mt-1 space-y-0.5 text-xs">
              {game.members.map((m) => {
                const s = memberStats(m);
                return <div key={m.id}>{CLASSES[m.cls].icon} {m.name}: <span className={m.hp <= 0 ? 'text-red-400' : ''}>{m.hp}/{s.hp}</span> HP • {m.mp}/{s.mp} MP</div>;
              })}
            </div>
            <div className="mt-1 text-[12px] text-stone-400">ตื่นเวลา {fmtTime(INN_WAKE)} · ตอนนี้ {fmtTime(game.minute)}</div>
            <button className="btn btn-gold mt-2 w-full py-2.5" disabled={game.gold < innCost} onClick={() => {
              update((g) => { g.gold -= innCost; g.members.forEach((m) => { const s = memberStats(m); m.hp = s.hp; m.mp = s.mp; m.healAt = 0; }); restAtInn(g); });
              toast(`พักผ่อนเต็มที่! ตื่นเวลา ${fmtTime(INN_WAKE)} 💤`);
            }}>พักผ่อน ({innCost ? `${innCost} 🪙` : 'ฟรี! เมืองนี้เป็นเมืองพัก'})</button>
          </div>

          <div className="rounded-xl border border-sky-700/60 bg-sky-950/30 p-3">
            <div className="text-sm font-bold text-sky-300">💾 บันทึกเกม</div>
            <div className="mt-1 text-[12px] text-stone-400">
              บันทึกความคืบหน้าไว้ 1 ช่อง · อยู่ต่อเมื่อยังเปิดเกมนี้อยู่ (ปิดแท็บแล้วหาย) · ถ้าตายจะกลับมาเริ่มที่เมืองนี้
              {saved && <span className="text-sky-400"> · มีเซฟอยู่แล้ว กดทับจะเขียนทับ</span>}
            </div>
            <button className="btn btn-dark mt-2 w-full py-2" onClick={() => {
              const ok = writeSave(game, (s) => Math.round(s.members.reduce((a, m) => a + m.level, 0) / Math.max(1, s.members.length)));
              toast(ok ? `💾 บันทึกแล้ว (วันที่ ${game.day})` : 'บันทึกไม่สำเร็จ — พื้นที่จัดเก็บเต็ม');
            }}>{saved ? 'เขียนทับเซฟเดิม' : 'บันทึกเกมตอนนี้'}</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- shop ----------------
  if (view === 'shop') return <ShopView game={game} update={update} toast={toast} header={header} />;
  // ---------------- market ----------------
  if (view === 'market') return <>{header('ตลาดวัตถุดิบ', `${info.emblem} ${city.name}`)}<MarketPage game={game} update={update} toast={toast} /></>;

  // ---------------- guild ----------------
  if (view === 'guild') {
    if (!guild) {
      const n = newsFor(game, game.day, game.minute);
      const unread = CATS.reduce((s, c) => s + n[c.id].length, 0);
      return (
        <div>
          {header('สมาคมการค้า', `${info.emblem} ${city.name}`)}
          <div className="space-y-1.5">
            <button onClick={() => setGuild('bounty')} className="tof-frame flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:brightness-125">
              <span className="text-2xl">📜</span>
              <span className="min-w-0 flex-1"><span className="block text-base font-bold text-amber-200">รับงานล่าค่าหัว</span><span className="block text-[12px] text-stone-400">เควสจากเมืองนี้ ({game.cityQuests[city.id]?.length ?? 0} งาน)</span></span>
              <span className="text-stone-500">›</span>
            </button>
            <button onClick={() => setGuild('news')} className="tof-frame flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:brightness-125">
              <span className="text-2xl">📰</span>
              <span className="min-w-0 flex-1"><span className="block text-base font-bold text-amber-200">ข่าวสารประจำวัน</span><span className="block text-[12px] text-stone-400">พ่านเกม · {unread} ข่าว</span></span>
              <span className="text-stone-500">›</span>
            </button>
          </div>
        </div>
      );
    }
    if (guild === 'bounty') return <>{header('📜 รับงานล่าค่าหัว', `${info.emblem} ${city.name}`, () => setGuild(null))}<CityPanel game={game} update={update} toast={toast} /></>;
    return <NewsView game={game} header={header} onBack={() => setGuild(null)} />;
  }

  // ---------------- dojo ----------------
  return <DojoView game={game} update={update} toast={toast} header={header} />;
}

/* ============================ shop ============================ */

function ShopView({ game, update, toast, header }: ViewProps) {
  const city = CITY[game.location];
  const info = CITY_INFO[city.id];
  const [who, setWho] = useState(game.members[0].id);
  const [tab, setTab] = useState<'gear' | 'item'>('gear');
  const member = game.members.find((m) => m.id === who)!;
  const maxTier = Math.min(5, 1 + Math.floor(city.tier / 1.7));
  // The smithy perk applies to gear, the herbalist perk to consumables.
  const price = (p: number, kind: 'gear' | 'item') =>
    Math.round(basePrice(game, p) * (info.perk === kind ? (kind === 'gear' ? 0.75 : 0.65) : 1));

  return (
    <div>
      {header(ownerOf(city.id), `${info.emblem} ${city.name} · ${PERK_INFO[info.perk].name}`)}
      <div className="mb-2 flex gap-1">
        {(['gear', 'item'] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`btn flex-1 py-1.5 text-sm ${tab === k ? 'btn-gold' : 'btn-dark'}`}>
            {k === 'gear' ? '⚔️ อุปกรณ์' : '🧪 ของใช้'}
          </button>
        ))}
      </div>

      {tab === 'item' ? (
        <div className="grid grid-cols-2 gap-2">
          {ITEMS.map((it) => {
            const cost = price(it.price, 'item');
            return (
              <button key={it.id} className="flex items-center gap-2 rounded-xl bg-black/30 p-2 text-left transition hover:bg-black/50 active:scale-95 disabled:opacity-40"
                disabled={game.gold < cost} onClick={() => { update((g) => { g.gold -= cost; addItem(g.inv, it.id); }); toast(`ซื้อ ${it.name} −${cost} 🪙`); }}>
                <ItemIcon id={it.id} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{it.name} <span className="text-stone-400">x{count(game.inv, it.id)}</span></span>
                  <span className="block text-[13px] text-stone-400">{it.desc}</span>
                </span>
                <span className="text-sm text-amber-300">{cost}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="mb-1.5 flex flex-wrap gap-1">
            {game.members.map((m) => (
              <button key={m.id} onClick={() => setWho(m.id)} className={`btn px-2.5 py-1 text-xs ${who === m.id ? 'btn-gold' : 'btn-dark'}`}>
                {CLASSES[m.cls].icon} {m.name}
              </button>
            ))}
          </div>
          <p className="mb-1 text-[13px] text-amber-200">อุปกรณ์สูงสุดระดับ {maxTier} — ซื้อแล้วสวมใส่ {member.name} ทันที</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {EQUIPS.filter((e) => e.tier <= maxTier).map((e) => {
              const cur = member.equip[e.slot];
              const owned = cur?.id === e.id;
              const cost = price(e.price, 'gear');
              return (
                <button key={e.id} disabled={owned || game.gold < cost} className="flex items-center gap-2 rounded-xl bg-black/30 p-2 text-left transition hover:bg-black/50 active:scale-95 disabled:opacity-40"
                  onClick={() => {
                    update((g) => {
                      const m = g.members.find((x) => x.id === who)!;
                      const sBefore = memberStats(m);
                      g.gold -= cost;
                      const old = m.equip[e.slot];
                      if (old) g.bag.push(old);
                      m.equip[e.slot] = makeEquip(e, 0);
                      const sAfter = memberStats(m);
                      m.hp = Math.min(sAfter.hp, m.hp + Math.max(0, sAfter.hp - sBefore.hp));
                    });
                    toast(`${member.name} สวม ${e.name}${cur ? ' (ของเดิมเข้ากระเป๋า)' : ''}`);
                  }}>
                  <EquipIcon item={e} size={42} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{e.name} <span className="text-amber-400">{'★'.repeat(e.tier)}</span></span>
                    <span className="block text-[13px] text-lime-300">{Object.entries(e.bonus).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(' ')}</span>
                    <span className="block text-[12px] text-stone-500">ตอนนี้: {cur ? cur.name : '-'}</span>
                  </span>
                  <span className="text-sm text-amber-300">{owned ? 'สวมอยู่' : cost}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================ news ============================ */

function NewsView({ game, header, onBack }: { game: GameState; header: Header; onBack: () => void }) {
  const [open, setOpen] = useState<NewsCat | null>(null);
  const n = newsFor(game, game.day, game.minute);
  if (open) {
    const c = CATS.find((x) => x.id === open)!;
    return (
      <div>
        {header(`${c.icon} ${c.label}`, newsDate(game.day, game.minute), () => setOpen(null))}
        <div className="space-y-2">
          {n[open].length === 0 && <div className="py-6 text-center text-sm text-stone-500">ยังไม่มีข่าวในหมวดนี้</div>}
          {n[open].map((it, i) => (
            <div key={i} className="rounded-lg border p-2.5" style={{ borderColor: c.color + '55', background: c.wash }}>
              <div className="text-sm text-stone-200">{it.text}</div>
              {it.detail && <div className="mt-0.5 text-[12px] text-stone-400">{it.detail}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      {header('📰 ข่าวสารประจำวัน', newsDate(game.day, game.minute), onBack)}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {CATS.map((c) => (
          <button key={c.id} onClick={() => setOpen(c.id)} className="rounded-lg border px-2.5 py-1.5 text-left transition hover:brightness-125"
            style={{ borderColor: c.color + '77', background: c.wash }}>
            <span className="block text-sm font-bold" style={{ color: c.color }}>{c.icon} {c.label}</span>
            <span className="block text-[11px] text-stone-400">{n[c.id].length} ข่าว</span>
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {CATS.map((c) => (
          <section key={c.id} className="rounded-lg border p-2" style={{ borderColor: c.color + '44' }}>
            <div className="mb-1 flex items-center gap-1.5 text-[13px] font-bold" style={{ color: c.color }}>
              {c.icon} {c.label} <span className="text-stone-600">({n[c.id].length})</span>
            </div>
            {n[c.id].slice(0, 2).map((it, i) => (
              <div key={i} className="flex items-start gap-1.5 py-0.5 text-[13px] text-stone-300">
                <span style={{ color: it.tone === 'down' ? '#6fbf4a' : it.tone === 'up' ? '#e5533d' : c.color }}>•</span>
                <span className="min-w-0 flex-1">{it.text}</span>
                {it.detail && <span className="shrink-0 text-stone-500">{it.detail}</span>}
              </div>
            ))}
            {n[c.id].length > 2 && <button className="mt-0.5 text-[12px] underline" style={{ color: c.color }} onClick={() => setOpen(c.id)}>อ่านทั้งหมด ({n[c.id].length}) ›</button>}
          </section>
        ))}
      </div>
    </div>
  );
}

/* ============================ dojo ============================ */

function DojoView({ game, update, toast, header }: ViewProps) {
  const city = CITY[game.location];
  const info = CITY_INFO[city.id];
  const [who, setWho] = useState(game.members[0].id);
  const [opts, setOpts] = useState<{ mid: string; slot: number; list: string[] } | null>(null);
  const member = game.members.find((m) => m.id === who)!;
  const cost = Math.round(basePrice(game, 60 + city.tier * 35));

  return (
    <div>
      {header('สำนักฝึก', `${info.emblem} ${city.name} · ค่าเรียน ${cost} 🪙 · ใช้เวลา ${fmtDuration(TRAIN_MINUTES)}`)}
      <div className="mb-2 flex flex-wrap gap-1">
        {game.members.map((m) => (
          <button key={m.id} onClick={() => { setWho(m.id); setOpts(null); }} className={`btn px-2.5 py-1 text-xs ${who === m.id ? 'btn-gold' : 'btn-dark'}`}>
            {CLASSES[m.cls].icon} {m.name}
          </button>
        ))}
      </div>
      <div className="mb-2 text-[12px] text-stone-400">เปลี่ยนสกิลช่องที่ 4-5 · โอกาส Rare 10% · Legendary 4% · Unique 1%</div>
      <div className="space-y-1.5">
        {member.skills.map((sl, i) => {
          const s = SKILL[sl.id];
          const innate = CLASSES[member.cls].skills.includes(s.id);
          return (
            <div key={i} className="flex items-center gap-2 rounded-xl bg-black/30 p-2">
              <SkillIcon id={s.id} size={40} level={sl.level} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{s.name} {innate && <span className="text-[12px] text-sky-300">[อาชีพ]</span>}</div>
                <div className="text-[13px] text-stone-400">{s.desc} • MP {s.mp} • Lv{sl.level}/{MAX_SKILL_LV}</div>
              </div>
              {!innate && <button className="btn btn-dark text-xs" disabled={game.gold < cost} onClick={() => {
                update((g) => { g.gold -= cost; advanceTime(g, TRAIN_MINUTES); });
                const list = info.perk === 'train'
                  ? [0, 1, 2].map(() => { const a = randomCommon(member.skills.map((x) => x.id), 1)[0]; const b2 = randomCommon(member.skills.map((x) => x.id), 1)[0]; return (SKILL[b2].rarity ?? 0) > (SKILL[a].rarity ?? 0) ? b2 : a; }).filter((v, i2, arr) => arr.indexOf(v) === i2)
                  : randomCommon(member.skills.map((x) => x.id), 3);
                setOpts({ mid: member.id, slot: i, list });
              }}>เปลี่ยน</button>}
            </div>
          );
        })}
      </div>
      {opts && opts.mid === member.id && (
        <div className="pop-in mt-2 rounded-xl border border-amber-500/50 bg-amber-900/20 p-2">
          <div className="mb-1 text-sm font-bold text-amber-200">เลือกสกิลใหม่:</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {opts.list.map((id) => {
              const s = SKILL[id];
              return (
                <button key={id} className="rounded-xl bg-black/40 p-2 text-left transition hover:bg-black/60 active:scale-95" onClick={() => {
                  update((g) => { const m = g.members.find((x) => x.id === opts.mid)!; m.skills[opts.slot] = { id, enabled: true, level: 1 }; });
                  toast(`${member.name} เรียนรู้ ${s.name}!`); setOpts(null);
                }}>
                  <div className="flex items-center gap-2 text-sm font-bold"><SkillIcon id={id} size={40} /><span>{s.name}<br /><RarityTag id={id} /></span></div>
                  <div className="text-[13px] text-stone-400">{s.desc}</div>
                  <div className="text-[12px] text-sky-300">MP {s.mp} • CD {s.cd}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface ViewProps { game: GameState; update: Update; toast: (s: string) => void; header: Header }
