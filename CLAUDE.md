# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A color-block 2D farming game (MVP) built with **Electron + Phaser.js 3**. No art assets, no AI/compute — everything is drawn with Phaser `Graphics`/`Rectangle` primitives so it runs on low-end laptops. The two design docs explain the original intent and data flow, worth reading before non-trivial changes:
- `01-功能需求.md` — feature/requirements spec (MVP scope, tile state machine, growth rules, quest).
- `02-程式架構.md` — architecture rationale ("why it's designed this way", data flow). Both are in Traditional Chinese, as are most code comments.

> **Note:** movement/interaction was revised *after* those docs. The shipped game uses **free pixel movement** (not grid-step) and a **nearest-target action model** (not facing/front-tile dispatch). The docs still describe the original grid model; the rest (state machine, event-driven time, save layout) still holds. See architecture point 5 below.

## Commands

```bash
npm install     # phaser (runtime) + electron (dev) — pulls the Electron binary, ~minutes first time
npm start       # launch the game (electron .)
```

There is **no bundler, no lint config, and no test runner.** Verify changes two ways:

- **Syntax** (catches ESM parse errors without Electron):
  `node --input-type=module --check < src/<file>.js` for renderer modules; `node --check main.js` for the CommonJS main process.
- **Core logic** — everything under `src/state/` and `src/systems/` is Phaser-free and Node-runnable. To exercise it, copy `src/` somewhere with a `package.json` containing `{"type":"module"}` and import the systems directly (the project `package.json` has no `type`, so `.js` resolves as CommonJS and ESM imports fail otherwise). `SaveManager.save()` swallows the `localStorage is not defined` error under Node by design, so simulations run fine.
- Renderer runtime errors only surface in **DevTools console**, not the terminal. To smoke-test the full Electron+Phaser+protocol boot, run a temporary main that attaches `webContents.on('console-message' | 'did-fail-load' | 'did-finish-load')` and `app.quit()` on a timer.

Reset a save: open DevTools console and run `__SaveManager.clear()`, then reload.

## Architecture — the load-bearing ideas

These cut across files; missing them will make changes fight the design.

**1. `GameState.data` is the single source of truth.** All game state (player, day, money, tiles, inventory, quests, `currentScene`) lives in one plain, JSON-serializable object (`src/state/GameState.js`). Rules mutate it; scenes read it to draw; `SaveManager` serializes the whole thing to `localStorage`. **Never put a Phaser GameObject reference into `GameState`** — that breaks save/load. Render objects are recreated by each scene from state on `create()`.

**2. Data ⇄ presentation are separated.** Systems (`src/systems/*`) are (mostly) pure transition functions over `GameState.data`; scenes (`src/scenes/*`) only "read state → draw color blocks" and "input → call a system". This is why save/load needs zero special conversion.

**3. Time is event-driven, not real-time.** Crops do **not** advance in the update loop. `FarmSystem` watering only sets a `crop.watered` flag; `TimeSystem.nextDay()` (triggered by touching the bed in `HouseScene`) is the *single* place that advances growth stages and auto-saves. It also runs the daily economy: `FarmerSystem.stepDay()` (NPC farmers produce → market supply + their wealth) then `MarketSystem.consumeDemand()` (each crop's daily demand draws down its supply — scaled by today's **appetite** (per-day noise × festival) and **price-elastic** so cheaper ⇒ eats more). Any new "between-day" mechanic (seasons, day/night) goes there.

**4. Tile model.** `tiles` is a flat array indexed by `idx(x,y) = y*MAP_W + x`. Each tile = `{ terrain, tilled, crop }` where `terrain` is static (`grass|soil|water|wall|door`), `tilled` is a soil flag, and `crop` is `null` or `{ id, stage(0–3), watered }`. The farm state machine (untilled → tilled → planted → … → mature → harvest-back-to-tilled) lives entirely in `FarmSystem.actOnTile()`.

**5. Movement is free; interaction targets the nearest thing.** `Player` moves in pixel space (`x,y` floats, `PLAYER_SPEED`) with axis-separated AABB collision: it asks the scene's `solidAt(tileX,tileY)` predicate (water/wall/out-of-bounds/NPC/shop/market are solid). `facing` is now cosmetic (the nose), derived from the movement vector. **There is no front-tile dispatch** — `FarmScene.computeAction()` runs each frame: it scans soil tiles for the nearest one within `REACH` where `FarmSystem.canActOnTile` returns an op (`till|plant|water|harvest`), then also considers the shop/market/NPC tiles, and keeps **the single closest** as `this.action = { kind:'farm'|'shop'|'market'|'npc', x, y, op? }`. It highlights that tile. The action — triggered by **Space/E or the on-screen Action button** — dispatches in `doAction()`: farm → `FarmSystem.actOnTile`; shop/market → `openShop(mode)` (launch `ShopScene`); npc → `QuestSystem.talk` → dialog. Door/bed are touch-triggered: each frame the scene checks the tile under the player's center (`player.tileX/tileY`). The Action button lives in `UIScene`; it reads `Runtime.actionLabel`/`actionEnabled` (set by `FarmScene` each frame) for its label/enabled state and calls `FarmScene.doAction()` on click. `canActOnTile` is a no-mutation mirror of `actOnTile` — keep the two in sync when changing farm rules.

**5b. Shop/market/rank is a modal scene.** `ShopScene` (one scene, `mode: 'shop'|'market'|'rank'`) is launched on top of `UIScene` and renders a panel over the map area (the bottom HUD bar stays visible). Buy logic is pure in `ShopSystem.buy` (fixed `ITEMS.buy` prices, `SHOP_STOCK` lists seeds). Sell goes through `ShopSystem.sell` at the **dynamic** market price (see 5c). `rank` mode is a read-only leaderboard from `FarmerSystem.ranking`. While open, `Runtime.shopActive` is true → `FarmScene.update` early-returns (paused) and `UIScene.onPointer` ignores clicks, so `ShopScene` owns input. Esc / ✕ / clicking the HUD bar closes it (and saves).

**5c. Competitive economy (supply/demand pricing + simulated farmers).** The world has 3 simulated competitor farmers (`FARMER_DEFS` in config: fixed `routine` of crop ids, `growDays`, `yield`; runtime state `{step, daysIntoCrop, money}` in `GameState.farmers`) plus shop/market/rank "building" tiles and a quest NPC — all are just nearest-target candidates in `FarmScene.computeAction`. **`MarketSystem` is the dynamic pricing core:** each crop has a `supply` (in `GameState.market.supply`) and a config `demand`; `price = clamp` of `base*(1 + factor)*appetite`, `factor = clamp(-K*(supply/demand - 1), -MAX_DROP, +MAX_RISE)` (constants in `config.MARKET`, floor = `base*(1-MAX_DROP)`). Selling adds 1 to supply **per unit** (a big dump tanks the price, recovers as demand eats it on later days); farmers' daily harvests add `yield` to supply. `base` = `ITEMS[crop].sell`. **`appetite` = today's market appetite** (`MarketSystem.appetite`) = per-day pseudo-random noise (±`DEMAND_NOISE`) × festival multiplier — it multiplies both price and consumption, so prices wobble day to day and spike on festivals. **Daily demand is also price-elastic** (`MarketSystem.demandToday`): consumed = `round(demand*appetite*(1 - ELASTICITY*factor))`, so a cheap glut (negative factor) is eaten *faster* than flat `demand` and clears sooner, while a scarce crop is eaten slower; `ELASTICITY` is in `config.MARKET` (0 ⇒ flat). **Festivals** (`config.FESTIVALS` + `festivalFor(day)`, a pure function of `day` on a `FESTIVAL_CYCLE`-day loop → **no save-state, no migration**) spike one crop's `appetite` by `mult` on set days (🍅 番茄節 day 15 → tomato, 🎃 萬聖節 day 25 → pumpkin); surfaced by `UIScene` (top-bar badge) and `ShopScene` market mode (banner + emoji on the hot crop). Keep `MarketSystem.price`/`trend`/`demandToday`/`appetite` and the UI in sync if you change the formulas.

**6. Scenes and input coordination.**
- `BootScene` reads `GameState.currentScene`, `launch`es the persistent `UIScene`, and `start`s the right gameplay scene. **`UIScene` stays alive across farm↔house `scene.start()` calls** (it's an overlay; never recreated). Scene array order in `src/main.js` sets render depth — `UIScene` is last = always on top.
- Scene switching writes truth to `GameState` first (`player`, `currentScene`), then `scene.start()`. The destination scene reads `GameState.player` on `create()` — scene params are not used for position. This is what makes save-then-load restore the correct scene+position.
- **Dialog input is single-consumer.** While `Runtime.dialogActive` (a non-serialized flag in `src/runtime.js`) is true, gameplay scenes skip player movement and route the interact key to `UIScene.advanceDialog()` instead of world interaction. Quest side-effects (advancing state, giving rewards) fire from the dialog's `onEnd` callback when the last line is dismissed — not when the dialog opens.

**7. Electron shell is deliberately thin.** `main.js` registers a custom **`app://` protocol** (`protocol.handle` + a manual extension→MIME map) and loads `app://local/index.html`. This is what lets ES modules load with `webSecurity` left on (plain `file://` blocks module CORS). **If you add a new asset extension, add it to the `MIME` map in `main.js`** or it will 404. Phaser is loaded as a classic `<script>` (global `Phaser`); game code is `<script type="module">`. No IPC, no Node in the renderer (`contextIsolation: true`).

## Conventions / gotchas

- **Tuning lives in `src/config.js`**: tile size, map dimensions, `PLAYER_SPEED`/`PLAYER_HALF`/`REACH`, the `COLORS` table, `ITEMS`, the two char-grid layouts (`FARM_MAP` 15×15, `HOUSE_MAP` 9×7), and the `gridToPixel(g)` helper. Changing the look/feel = editing values here, not logic.
- **`GameState.player.x/y` are pixels in farm-scene space** (not grid coords). The house always spawns the player at a fixed entry and doesn't read them. `SAVE_VERSION` (in `GameState.js`) gates the format; `main.js` `migrate()` chains conversions (v1 grid→pixel coords; v2→v3 backfills `market`/`farmers` defaults via `buildMarket`/`buildFarmers`). Bump the version + extend `migrate()` if you change the save shape.
- **Some coordinates are duplicated.** `NPC_POS`, player start, and `FARM_RETURN` are in config, but `HouseScene` hardcodes bed/entry/exit tile coords to match `HOUSE_MAP`. Keep them in sync if you edit the house layout.
- Items **stack by `id`** (`{id, qty}`); seeds end in `_seed` and map to a crop id by stripping the suffix (`tomato_seed` → `tomato`). `FarmSystem` and `InventorySystem` both rely on this. `ITEMS` (config) is the catalog for all 6 crops + their seeds: `name`, `color` (also the mature-fruit color in `drawCrop`), `buy` (seed price), `sell` (crop **base** price; `>0` ⇒ sellable), `demand` (daily market demand, drives dynamic pricing). Add a crop = add its `_seed` + crop entries here (give the crop a `demand`) and (if buyable) to `SHOP_STOCK`; `GameState.buildMarket` seeds its supply automatically — growth/market/pricing are all generic over the catalog.
- Canvas is fixed **480×560**: a 480×480 map area on top, an 80px UI bar (`UI_H`) at the bottom. `HouseScene` centers its smaller map inside the 480×480 region via an `originX/originY` offset that `Player` also uses.
- `FarmScene` uses two graphics layers: `terrainGfx` (static, drawn once) and `fieldGfx` (soil state + crops, redrawn on every interaction and after `nextDay`). Redraw the field layer after mutating any tile.

## Keeping the design docs in sync

`01-功能需求.md`(功能需求)與 `02-程式架構.md`(程式架構)是這份 CLAUDE.md 的設計來源。**只要改寫了本檔(CLAUDE.md)中關於功能或架構的內容,就必須把對應的改動一併同步回 `01-功能需求.md` 與 `02-程式架構.md`**,讓三份文件保持一致,不要讓設計文件落後於實作。(例如:移動模型從格子改為自由像素移動、互動從面前一格改為最近目標 + 動作按鈕,這類改動就應同時更新到那兩份文件。)
