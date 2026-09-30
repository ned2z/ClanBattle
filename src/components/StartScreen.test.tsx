/**
 * Title screen, with a focus on the one thing that was added to it: the resume
 * card. A save that cannot be picked back up is worse than no save at all, so
 * the card appearing, updating, and handing back a whole state all matter.
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CITIES } from '../game/data';
import { clearSave, hasSave, readSave, writeSave } from '../game/save';
import { newGame } from '../game/store';
import type { GameState } from '../game/types';
import StartScreen, { DEFAULT_SETUP, type Setup } from './StartScreen';

// React needs to know it is under act() before any root is created.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let started: Setup[];
let resumed: number;

const g = (): GameState => newGame('ทดสอบ', ['shield', 'whitemage', 'rogue'], ['เอ', 'บี', 'ซี']);
const level = (s: GameState) => Math.round(s.members.reduce((a, m) => a + m.level, 0) / s.members.length);

const mount = () => act(() => {
  root.render(<StartScreen onStart={(s) => started.push(s)} onResume={() => { resumed++; }} hs={[]} last={DEFAULT_SETUP} />);
});
const btn = (label: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(label));
const text = () => host.textContent ?? '';
const click = (el: Element | undefined) => { expect(el, 'expected the control to exist').toBeTruthy(); act(() => { (el as HTMLElement).click(); }); };

beforeEach(() => {
  sessionStorage.clear();
  clearSave();
  started = [];
  resumed = 0;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('with no save', () => {
  it('offers a new run and no resume card', () => {
    mount();
    expect(text()).toContain('เริ่มรบทันที');
    expect(text()).not.toContain('เล่นต่อ');
  });

  it('says Enter starts a new run', () => {
    mount();
    expect(text()).toContain('Enter เริ่ม');
  });
});

describe('with a save', () => {
  beforeEach(() => {
    const s = g();
    s.gold = 8888; s.fame = 42; s.day = 12; s.location = 'kan';
    writeSave(s, level);
  });

  it('shows the resume card above the new-run button', () => {
    mount();
    expect(text()).toContain('การเดินทางที่บันทึกไว้');
    expect(text()).toContain('เล่นต่อ');
  });

  it('summarises the saved journey without loading it', () => {
    mount();
    expect(text()).toContain('ทดสอบ');
    expect(text()).toContain(CITIES.find((c) => c.id === 'kan')!.name);
    expect(text()).toContain('วันที่ 12');
    expect(text()).toContain('8,888');
    expect(text()).toContain('42');
  });

  it('hands back to onResume rather than starting fresh', () => {
    mount();
    click(btn('เล่นต่อ'));
    expect(resumed).toBe(1);
    expect(started).toHaveLength(0);
  });

  it('changes the Enter hint to mean resume', () => {
    mount();
    expect(text()).toContain('Enter เล่นต่อ');
  });

  it('returns a state the map can actually run', () => {
    // This is the whole point of readSave: what comes back has to be playable.
    const back = readSave()!;
    expect(back.state.members).toHaveLength(3);
    expect(back.state.location).toBe('kan');
    expect(back.state.gold).toBe(8888);
    expect(back.state.travel).toBeNull();
  });
});

describe('a save that went bad', () => {
  it('does not offer a resume it cannot honour', () => {
    sessionStorage.setItem('tbs-save-v1', '{{{ corrupt');
    mount();
    expect(text()).not.toContain('เล่นต่อ');
    expect(text()).toContain('เริ่มรบทันที');
  });

  it('disappears once cleared', () => {
    const s = g();
    writeSave(s, level);
    mount();
    expect(text()).toContain('เล่นต่อ');
    act(() => root.unmount());
    clearSave();
    expect(hasSave()).toBe(false);
    root = createRoot(host);
    mount();
    expect(text()).not.toContain('เล่นต่อ');
  });
});

describe('without a replacement character', () => {
  it('renders the title screen clean', () => {
    const s = g();
    writeSave(s, level);
    mount();
    expect(text()).not.toContain('�');
  });
});
