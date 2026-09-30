# ⚔️ สมรภูมิสยาม (ClanBattle)

A roguelite party RPG set in Thailand — take a party out across a map of Siam,
clear quests, grow your classes, and fight your way to the top of the Siamese
leaderboard.

Built with **React 19 + TypeScript + Vite 7 + Tailwind CSS 4 + Three.js**

---

## 🎮 Getting started

```bash
npm install       # install dependencies
npm run dev       # start the dev server (defaults to http://localhost:5173)
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Build into a single HTML file in `dist/` |
| `npm run preview` | Serve the build you just made |
| `npm run typecheck` | Check TypeScript types (`tsc --noEmit`) |
| `npm run test` | Run the test suite |
| `npm run verify` | Everything: typecheck → test → build |

> 💡 `vite-plugin-singlefile` inlines all JS and CSS into one `index.html`,
> which makes it easy to deploy to GitHub Pages or share as a single file

---

## ⌨️ Keyboard shortcuts

**Anywhere**

| Key | Action |
|---|---|
| `Esc` | Close a dialog / open or close the pause menu |
| `P` | Pause |
| `Enter` | Resume (while paused) |

**On the map**

| Key | Action |
|---|---|
| `Q` | Party menu (classes, skills, equipment) |
| `J` | Quest list |
| `T` | Leaderboard |
| `L` | Adventure log |

**In battle**

| Key | Action |
|---|---|
| `Space` / `F` | Change speed (1x → 2x → 4x) |
| `Space` / `Enter` | Advance (on the result screen) |
| `S` | Skip the turn (faster) |
| `Tab` | Cycle result tabs (summary → stats → log) |
| `L` | Hide or show the log |

**On the game-over screen**

| Key | Action |
|---|---|
| `R` / `Enter` / `Space` | Restart immediately |

**Mouse / touch (in battle)**

| Gesture | Result |
|---|---|
| Drag (one finger) | Orbit the camera left / right, and slightly up / down |
| Pinch (two fingers) | Zoom in and out |
| Release | Camera eases back to centre on its own |

> The camera ignores input during cutscenes and while a big skill plays out.
> Press `F` to speed things up instead — that never disturbs the camera.

---

## 🗺️ Game systems

**Six classes** — switch class at a training hall in any city

| Class | Role |
|---|---|
| 🛡️ Shieldbearer | Front line. Taunts, guards, soaks the hit that would have killed someone behind. |
| ⚔️ Greatsword | Highest attack. Trades safety for damage, and doubles down when hurt. |
| 🗡️ Knife Assassin | Speed and crit. Opens with a preemptive strike and finishes wounded targets. |
| 🔮 Dark Sorcerer | Hard damage through resistances. The mage that ignores armour. |
| ✨ Light Cleric | The healer. Revival and party-wide restoration, which is what makes a wipe survivable. |
| 💰 Merchant | Buys at a discount. The only class that changes the economy rather than the fight. |

**Map locations**

| Place | Effect |
|---|---|
| 🏯 City | Quests, shops, inn, training hall |
| 🏡 Village | Restores 25% HP on every visit |
| ⛩️ Shrine | Restores 60% MP • first visit +25 fame |
| 🏰 Fort | First visit: rations ×2 |
| ⛺ Bandit camp | Forced fight (win it for bonus gold) |
| 🏛️ Ruins | First visit: find treasure or equipment |
| 💧 Lake | Restores 15% HP and 25% MP |

**12 enemy types** · **126 skills** · **10 NPC parties** climbing the leaderboard at once

> All three counts come from `src/game/data.ts` (`ENEMIES`, `SKILLS`, `NPC_SEED`)

---

## 🗃️ Code structure

```
src/
├── main.tsx              # App entry point
├── App.tsx               # Overall game state + every screen
│
├── game/                 # Pure game logic (no React)
│   ├── types.ts          # All TypeScript types
│   ├── data.ts           # Data: cities, classes, skills, enemies, NPCs, map
│   ├── engine.ts         # Formulas, battle (ATB), travel, items
│   ├── store.ts          # State manager + localStorage (high score)
│   ├── fx.ts             # Screen effects (shake, flash, floating numbers)
│   ├── portraits.ts      # Portrait sprite atlas
│   └── portraitData.ts   # base64 images (inlined so the build is one file)
│
├── three/                # 3D scenes
│   ├── MapWorld.ts       # World map (the overworld)
│   ├── BattleWorld.ts    # Battle scene
│   ├── TravelWorld.ts    # Travel scene
│   ├── models.ts         # Character models
│   ├── landmarks.ts      # Map landmarks
│   ├── particles.ts      # Particle system
│   ├── textures.ts       # Canvas-generated textures
│   └── vfx.ts            # 3D effects
│
└── components/           # UI (React)
    ├── StartScreen.tsx   # Party select screen
    ├── MapScreen.tsx     # Map screen + HUD
    ├── BattleScreen.tsx  # Battle screen
    ├── PartyMenu.tsx     # Party growth menu
    ├── Panels.tsx        # Quests / shop / leaderboard / modal
    ├── AdventureLog.tsx  # Adventure log
    ├── FxLayer.tsx       # Every effect layer
    └── Icons.tsx         # SVG icons
```

> 🧩 **Principle:** `game/` is pure logic with no React dependency, so it is easy
> to test and reuse. `components/` only handles presentation.

---

## 🎥 Battle camera (`three/camera/`)

The camera is deliberately **as simple as possible** — one position, a gentle
drift, and the player is free to orbit it themselves.

| File | Responsibility |
|---|---|
| `shots.ts` | The single camera frame (distance, fov, smoothing, drift) |
| `director.ts` | Position maths + anti-collision spring + player input |
| `spring.ts` | `Spring3` / `Spring1` — weighted movement |
| `input.ts` | Drag / pinch to orbit and zoom |
| `types.ts` | Types |

**Principles**

- No cuts at all — the camera stays put for the whole battle
- Automatic "follow the centre of the field" framing; it pulls back as
  characters fall so the survivors stay in frame
- No depth of field (`BokehPass` was removed — faster and sharper)
- No cinematic openers, battle-end moves, or letterbox bars
- Drag to orbit · pinch to zoom · release to ease back to centre
- ULTs get slow motion and a white flash only; the camera never moves or shakes

> To try the game's original camera behaviour, call `world.setDirector(false)`.

---

## ⚙️ Common Git commands

```bash
git status              # check status
git add .
git commit -m "message"
git push origin main    # send it to GitHub
```

Player data (setup, high score) lives in the browser's `localStorage` and is
never sent to a server.

---

## 🔧 Tech stack

| | |
|---|---|
| React | 19.2 |
| TypeScript | 5.9 (strict mode) |
| Vite | 7.3 |
| Tailwind CSS | 4.1 |
| Three.js | 0.186 |

**Requires:** Node.js 20+ (tested on v22.15.0)

**License:** [MIT](LICENSE) — use, modify, sell and build on it commercially,
as long as you keep the copyright notice.

Further reading: [Technical stack (bilingual)](docs/STACK.html) ·
[Roadmap](docs/ROADMAP.html)
