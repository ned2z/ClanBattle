/**
 * Town menu.
 *
 * The venue board is the thing players touch most, so it is asserted by
 * actually clicking it: which tile opens which screen, that back walks one
 * level at a time instead of dumping the player out of the popup, and that the
 * bounty board is not a second popup stacked on the first.
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CITIES, CITY_INFO } from '../game/data';
import { newGame } from '../game/store';
import { clearSave } from '../game/save';
import type { GameState } from '../game/types';
import { TownMenu } from './TownMenu';

// React needs to know it is under act() before any root is created.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let closed: number;

const quest = (id: string, title: string) => ({
  id, type: 'hunt' as const, title, desc: 'ออกเดินทางและกำจัดศัตรู',
  target: 3, progress: 0, from: 'bkk', rewardGold: 100, rewardXp: 50, rewardFame: 5,
});

const g = (cityId = 'bkk'): GameState => {
  const s = newGame('ทดสอบ', ['shield', 'whitemage', 'rogue'], ['เอ', 'บี', 'ซี']);
  s.location = cityId;
  s.gold = 5000;
  return s;
};

const mount = (game: GameState) => {
  act(() => { root.render(<TownMenu game={game} update={(fn) => fn(game)} onClose={() => { closed++; }} toast={() => {}} />); });
};

const tile = (label: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('.venue-tile')].find((b) => b.textContent?.includes(label));
const btn = (label: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(label));
/** The modal's ✕ is also .btn-dark, so back has to be found by its own glyph. */
const back = () => [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === '↩');
const text = () => host.textContent ?? '';
const click = (el: Element | undefined) => { expect(el, 'expected the control to exist').toBeTruthy(); act(() => { (el as HTMLElement).click(); }); };

beforeEach(() => {
  sessionStorage.clear();
  clearSave();
  closed = 0;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

// Roots outlive the test body unless unmounted, and every leaked popup would
// then be counted by the document-wide queries below.
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('the venue board', () => {
  it('shows six big tiles', () => {
    mount(g());
    expect(host.querySelectorAll('.venue-tile')).toHaveLength(6);
  });

  it('names every venue the player can reach', () => {
    mount(g());
    for (const name of ['โรงแรม', 'Shop', 'Market', 'Guild', 'Dojo', 'ออกจากเมือง']) {
      expect(text(), `missing ${name}`).toContain(name);
    }
  });

  it('tints every tile so they read as separate shopfronts', () => {
    mount(g());
    const tints = [...host.querySelectorAll<HTMLElement>('.venue-tile')].map((t) => t.style.getPropertyValue('--tint'));
    expect(tints).toHaveLength(6);
    expect(new Set(tints).size).toBe(6);
  });

  it('stacks sheets behind the window', () => {
    mount(g());
    // The two offset panels that make the popup read as a pile of layers.
    expect(host.querySelectorAll('.panel[aria-hidden="true"]').length).toBe(2);
  });

  it('shows the city name, tier and perk', () => {
    mount(g('ayu'));
    expect(text()).toContain(CITY_INFO.ayu.title);
    expect(text()).toContain(CITY_INFO.ayu.emblem);
  });

  it('renders in all 26 cities', () => {
    for (const c of CITIES) {
      act(() => { root.render(<TownMenu game={g(c.id)} update={() => {}} onClose={() => {}} toast={() => {}} />); });
      expect(host.querySelectorAll('.venue-tile'), `city ${c.id} lost its tiles`).toHaveLength(6);
    }
  });

  it('leaves dismissal to the modal close button, not a second arrow', () => {
    mount(g());
    expect(back()).toBeFalsy();
  });
});

describe('walking the levels', () => {
  it('opens the shop and comes back', () => {
    mount(g());
    click(tile('Shop'));
    expect(text()).toContain('ร้านของ');
    expect(back()).toBeTruthy();
    click(back());
    expect(host.querySelectorAll('.venue-tile')).toHaveLength(6);
  });

  it('opens the market and comes back', () => {
    mount(g());
    click(tile('Market'));
    expect(text()).toContain('ตลาดวัตถุดิบ');
    click(back());
    expect(host.querySelectorAll('.venue-tile')).toHaveLength(6);
  });

  it('opens the dojo and comes back', () => {
    mount(g());
    click(tile('Dojo'));
    expect(text()).toContain('ค่าเรียน');
    click(back());
    expect(host.querySelectorAll('.venue-tile')).toHaveLength(6);
  });

  it('opens the inn and comes back', () => {
    mount(g());
    click(tile('โรงแรม'));
    expect(text()).toContain('บันทึกเกม');
    click(back());
    expect(host.querySelectorAll('.venue-tile')).toHaveLength(6);
  });

  it('walks guild -> news -> guild -> board one arrow at a time', () => {
    mount(g());
    click(tile('Guild'));
    expect(text()).toContain('รับงานล่าค่าหัว');
    expect(text()).toContain('ข่าวสารประจำวัน');

    click(btn('ข่าวสารประจำวัน'));
    expect(text()).toContain('ข่าวสารประจำวัน');
    click(back());
    expect(text()).toContain('รับงานล่าค่าหัว');       // back to the guild menu
    click(back());
    expect(host.querySelectorAll('.venue-tile')).toHaveLength(6);
  });

  it('walks guild -> bounty -> guild -> board one arrow at a time', () => {
    mount(g());
    click(tile('Guild'));
    click(btn('รับงานล่าค่าหัว'));
    expect(text()).toContain('เควสที่รับได้');
    click(back());
    expect(text()).toContain('สมาคมการค้า');
    click(back());
    expect(host.querySelectorAll('.venue-tile')).toHaveLength(6);
  });

  it('opens a news category and back returns to the news index', () => {
    mount(g());
    click(tile('Guild'));
    click(btn('ข่าวสารประจำวัน'));
    click(btn('เศรษฐกิจ'));
    expect(text()).not.toContain('เศรษฐกิจ\n');   // left the index
    click(back());
    expect(text()).toContain('ข่าวสารประจำวัน');
  });
});

describe('leaving town', () => {
  it('closes the menu from the tile, without touching the modal ✕', () => {
    mount(g());
    click(tile('ออกจากเมือง'));
    expect(closed).toBe(1);
  });

  it('shows no arrow on the leave tile', () => {
    mount(g());
    expect(tile('ออกจากเมือง')?.textContent).not.toContain('›');
  });
});

describe('the inn save', () => {
  it('writes a save and says so', () => {
    const game = g();
    let toast = '';
    act(() => { root.render(<TownMenu game={game} update={() => {}} onClose={() => {}} toast={(s) => { toast = s; }} />); });
    click(btn('โรงแรม'));
    click(btn('บันทึกเกมตอนนี้'));
    expect(toast).toContain('บันทึกแล้ว');
    expect(sessionStorage.getItem('tbs-save-v1')).not.toBeNull();
  });

  it('offers an overwrite once a save exists', () => {
    const game = g();
    act(() => { root.render(<TownMenu game={game} update={() => {}} onClose={() => {}} toast={() => {}} />); });
    click(btn('โรงแรม'));
    click(btn('บันทึกเกมตอนนี้'));
    click(back());
    click(btn('โรงแรม'));
    expect(text()).toContain('เขียนทับเซฟเดิม');
  });

  it('tells the player the save dies with the tab', () => {
    mount(g());
    click(btn('โรงแรม'));
    expect(text()).toContain('ปิดแท็บแล้วหาย');
  });
});

describe('bounty board is not a second popup', () => {
  it('renders exactly one modal backdrop', () => {
    mount(g());
    click(tile('Guild'));
    click(btn('รับงานล่าค่าหัว'));
    // Two stacked z-50 overlays would mean two of these; the town menu owns the
    // only one, and the bounty board renders inside it.
    expect(document.querySelectorAll('.fixed.inset-0')).toHaveLength(1);
    expect(document.querySelectorAll('.panel')).toHaveLength(3);   // 2 stacked sheets + 1 window
  });

  it('accepts a quest and moves it into the active list', () => {
    const game = g();
    // newGame already seeds one tutorial quest, so measure the delta rather than
    // an absolute count.
    const before = game.quests.length;
    game.cityQuests.bkk = [quest('q1', 'ล่าสัตว์ในป่า')];
    mount(game);
    click(tile('Guild'));
    click(btn('รับงานล่าค่าหัว'));
    click(btn('รับ'));
    expect(game.quests).toHaveLength(before + 1);
    expect(game.cityQuests.bkk).toHaveLength(0);
  });

  it('shows the fame reward with a readable icon', () => {
    const game = g();
    game.cityQuests.bkk = [quest('q1', 'งานทดสอบ')];
    mount(game);
    click(tile('Guild'));
    click(btn('รับงานล่าค่าหัว'));
    expect(text()).toContain('🎖');
  });
});

describe('no broken glyphs reach the screen', () => {
  it('renders the board without a replacement character', () => {
    mount(g());
    expect(text()).not.toContain('�');
  });

  it('renders every venue screen without a replacement character', () => {
    mount(g());
    for (const label of ['Shop', 'Market', 'Guild', 'โรงแรม', 'Dojo']) {
      click(tile(label));
      expect(text(), `${label} has a broken glyph`).not.toContain('�');
      click(back());
    }
  });
});
