// FarmScene —— 戶外農場場景(自由移動 + 對最近目標動作)。
//
// 互動模型:玩家自由移動;每幀在 REACH 範圍內找「最近的可動作目標」,可能是:
//   - 土格(鋤地/播種/澆水/收割,FarmSystem.canActOnTile 判定)
//   - 商店 / 市場 / 排行榜 色塊(開對應面板)
//   - 任務 NPC、競爭農夫(對話 / 查看狀態)
// 取其中離玩家最近者當目標並高亮,按動作鍵(空白/E)或點 UI 動作按鈕即執行。
// 走到門格 → 進室內(碰觸)。面板開啟時(Runtime.shopActive)本場景暫停。
import { TILE, MAP_W, MAP_H, COLORS, NPC_POS, SHOP_POS, MARKET_POS, RANK_POS, WEATHER_POS, REACH, ITEMS, FARMER_DEFS, WEATHER } from '../config.js';
import { GameState, idx, inBounds } from '../state/GameState.js';
import { SaveManager } from '../state/SaveManager.js';
import { FarmSystem, MAX_STAGE } from '../systems/FarmSystem.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { FarmerSystem } from '../systems/FarmerSystem.js';
import { MarketSystem } from '../systems/MarketSystem.js';
import { WeatherSystem } from '../systems/WeatherSystem.js';
import { Runtime } from '../runtime.js';
import Player from '../entities/Player.js';
import NPC from '../entities/NPC.js';

const ACTION_LABEL = { till: '鋤地', plant: '播種', water: '澆水', harvest: '收割', canopy: '搭棚' };
const PHASE_MS = 15000; // 天氣覆蓋層「上午→下午」切換的實時秒數(純氣氛)

export default class FarmScene extends Phaser.Scene {
  constructor() {
    super('FarmScene');
  }

  create() {
    this.originX = 0;
    this.originY = 0;

    this.terrainGfx = this.add.graphics().setDepth(0);
    this.fieldGfx = this.add.graphics().setDepth(1);
    this.objGfx = this.add.graphics().setDepth(2); // 商店/市場色塊
    this.highlightGfx = this.add.graphics().setDepth(3); // 目標格高亮
    this.weatherGfx = this.add.graphics().setDepth(4); // 天氣覆蓋層(蓋地圖區)
    this.drawTerrain();
    this.drawField();
    this.drawWorldObjects();

    // 今日天氣(整天不變);上午/下午覆蓋層以計時器輪替(純氣氛,不影響機制)。
    this.today = WeatherSystem.today(GameState.data);
    this.weatherPhase = 'am';
    this.phaseElapsed = 0;
    this.drawWeather();

    this.npc = new NPC(this, this.originX, this.originY);

    const p = GameState.data.player;
    this.player = new Player(this, this.originX, this.originY, p.x, p.y, p.facing, (tx, ty) => this.solidAt(tx, ty));

    this.action = null; // { kind:'farm'|'shop'|'market'|'npc', x, y, op? }

    const kb = this.input.keyboard;
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.numKeys = [];
    for (let i = 0; i < 9; i++) this.numKeys.push(kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE + i));
  }

  // ── 碰撞:水/牆/界外/NPC/農夫/商店/市場/排行榜 不可進入 ────
  solidAt(tx, ty) {
    if (!inBounds(tx, ty)) return true;
    if (tx === NPC_POS.x && ty === NPC_POS.y) return true;
    if (tx === SHOP_POS.x && ty === SHOP_POS.y) return true;
    if (tx === MARKET_POS.x && ty === MARKET_POS.y) return true;
    if (tx === RANK_POS.x && ty === RANK_POS.y) return true;
    if (tx === WEATHER_POS.x && ty === WEATHER_POS.y) return true;
    if (FARMER_DEFS.some((f) => f.pos.x === tx && f.pos.y === ty)) return true;
    const t = GameState.data.tiles[idx(tx, ty)];
    return t.terrain === 'water' || t.terrain === 'wall';
  }

  enterHouse() {
    this.player.syncToState(GameState.data);
    GameState.data.currentScene = 'house';
    Runtime.actionEnabled = false;
    SaveManager.save(GameState.data);
    this.scene.start('HouseScene');
  }

  openShop(mode) {
    this.player.syncToState(GameState.data);
    this.scene.launch('ShopScene', { mode });
    this.scene.bringToTop('ShopScene');
  }

  // ── 互動目標 ──────────────────────────────────────────────
  selectedItem() {
    return GameState.data.inventory[GameState.data.selectedSlot];
  }

  dist2ToTile(x, y) {
    const cx = x * TILE + TILE / 2;
    const cy = y * TILE + TILE / 2;
    const dx = this.player.x - cx;
    const dy = this.player.y - cy;
    return dx * dx + dy * dy;
  }

  // 在 REACH 內找「最近的可動作目標」(土格 / 商店 / 市場 / NPC),取距離最小者。
  computeAction() {
    const sel = this.selectedItem();
    let best = null;
    let bestD2 = REACH * REACH;

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = GameState.data.tiles[idx(x, y)];
        if (t.terrain !== 'soil') continue;
        const op = FarmSystem.canActOnTile(GameState.data, x, y, sel);
        if (!op) continue;
        const d2 = this.dist2ToTile(x, y);
        if (d2 <= bestD2) {
          bestD2 = d2;
          best = { kind: 'farm', x, y, op };
        }
      }
    }

    const consider = (kind, pos, extra) => {
      const d2 = this.dist2ToTile(pos.x, pos.y);
      if (d2 <= bestD2) {
        bestD2 = d2;
        best = { kind, x: pos.x, y: pos.y, ...extra };
      }
    };
    consider('shop', SHOP_POS);
    consider('market', MARKET_POS);
    consider('rank', RANK_POS);
    consider('forecast', WEATHER_POS);
    consider('npc', NPC_POS);
    FARMER_DEFS.forEach((f, i) => consider('farmer', f.pos, { farmerIndex: i }));

    this.action = best;
  }

  doAction() {
    const ui = this.scene.get('UIScene');
    if (Runtime.dialogActive) {
      ui.advanceDialog();
      return;
    }
    if (!this.action) return;
    switch (this.action.kind) {
      case 'shop':
        this.openShop('shop');
        break;
      case 'market':
        this.openShop('market');
        break;
      case 'rank':
        this.openShop('rank');
        break;
      case 'forecast':
        this.openShop('forecast');
        break;
      case 'npc': {
        const d = QuestSystem.talk(GameState.data);
        ui.startDialog(d.lines, d.onEnd);
        break;
      }
      case 'farmer':
        ui.startDialog(this.talkFarmer(this.action.farmerIndex), null);
        break;
      case 'farm': {
        const res = FarmSystem.actOnTile(GameState.data, this.action.x, this.action.y, this.selectedItem());
        if (res.ok) this.drawField();
        break;
      }
    }
  }

  // 競爭農夫的狀態對話:在種什麼、財富、目前排名。
  talkFarmer(index) {
    const def = FARMER_DEFS[index];
    const fa = GameState.data.farmers.find((f) => f.id === def.id);
    const cropId = FarmerSystem.currentCrop(fa);
    const cropName = (ITEMS[cropId] && ITEMS[cropId].name) || cropId;
    const price = MarketSystem.price(GameState.data, cropId);
    const ranking = FarmerSystem.ranking(GameState.data);
    const rank = ranking.findIndex((r) => !r.isPlayer && r.name === def.name) + 1;
    return [
      def.name + ':「我這塊地正在種' + cropName + '(現在市價 $' + price + ')。」',
      '「我的身家有 $' + fa.money + ',目前排第 ' + rank + ' 名。」',
      '「想當傳說中的農夫?先把我比下去吧!」',
    ];
  }

  update(time, delta) {
    if (Runtime.shopActive) return; // 買賣面板開啟中:暫停

    // 物品切換(數字鍵)
    for (let i = 0; i < this.numKeys.length; i++) {
      if (Phaser.Input.Keyboard.JustDown(this.numKeys[i])) {
        if (i < GameState.data.inventory.length) GameState.data.selectedSlot = i;
      }
    }

    // 動作鍵
    if (Phaser.Input.Keyboard.JustDown(this.keySpace) || Phaser.Input.Keyboard.JustDown(this.keyE)) {
      this.doAction();
    }

    if (!Runtime.dialogActive) {
      this.player.update(delta);
      const ctx = this.player.tileX();
      const cty = this.player.tileY();
      if (inBounds(ctx, cty) && GameState.data.tiles[idx(ctx, cty)].terrain === 'door') {
        this.enterHouse();
        return;
      }
    }

    this.computeAction();
    this.drawHighlight();
    this.updateActionLabel();

    const q = GameState.data.quests.tomatoQuest;
    const canQuest = q === 'not_started' || (q === 'in_progress' && InventorySystem.countItem(GameState.data, 'tomato') >= 3);
    this.npc.setMarker(canQuest);

    // 天氣覆蓋層:上午/下午輪替(純氣氛)。
    this.phaseElapsed += delta;
    if (this.phaseElapsed >= PHASE_MS) {
      this.phaseElapsed = 0;
      this.weatherPhase = this.weatherPhase === 'am' ? 'pm' : 'am';
      this.drawWeather();
    }
  }

  updateActionLabel() {
    if (Runtime.dialogActive) {
      Runtime.actionLabel = '繼續';
      Runtime.actionEnabled = true;
      return;
    }
    if (!this.action) {
      Runtime.actionLabel = '耕作';
      Runtime.actionEnabled = false;
      return;
    }
    const k = this.action.kind;
    const LABEL = { shop: '商店', market: '市場', rank: '排行榜', forecast: '看預報', npc: '對話', farmer: '攀談' };
    Runtime.actionLabel = k === 'farm' ? ACTION_LABEL[this.action.op] : LABEL[k];
    Runtime.actionEnabled = true;
  }

  // ── 繪圖 ──────────────────────────────────────────────────
  drawHighlight() {
    const g = this.highlightGfx;
    g.clear();
    if (Runtime.dialogActive || !this.action) return;
    const { x, y } = this.action;
    g.lineStyle(2, COLORS.uiSlotSel, 1);
    g.strokeRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
    g.fillStyle(COLORS.uiSlotSel, 0.18);
    g.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
  }

  drawWorldObjects() {
    const g = this.objGfx;
    g.clear();
    const block = (pos, color, label) => {
      const px = pos.x * TILE;
      const py = pos.y * TILE;
      g.fillStyle(color, 1);
      g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      g.lineStyle(2, 0x000000, 0.3);
      g.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
      this.add.text(px + TILE / 2, py + TILE / 2, label, { fontFamily: 'sans-serif', fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setDepth(3);
    };
    block(SHOP_POS, COLORS.shop, '商');
    block(MARKET_POS, COLORS.market, '市');
    block(RANK_POS, COLORS.rank, '榜');
    block(WEATHER_POS, COLORS.weatherBoard, '報');

    // 競爭農夫:彩色方塊 + 名字標籤
    for (const f of FARMER_DEFS) {
      const px = f.pos.x * TILE;
      const py = f.pos.y * TILE;
      g.fillStyle(f.color, 1);
      g.fillRect(px + 5, py + 5, TILE - 10, TILE - 10);
      g.lineStyle(2, 0x000000, 0.35);
      g.strokeRect(px + 5, py + 5, TILE - 10, TILE - 10);
      this.add
        .text(px + TILE / 2, py - 2, f.name, { fontFamily: 'sans-serif', fontSize: '10px', color: '#ffffff', backgroundColor: '#00000066' })
        .setOrigin(0.5, 1)
        .setDepth(3);
    }
  }

  drawTerrain() {
    const g = this.terrainGfx;
    g.clear();
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = GameState.data.tiles[idx(x, y)];
        let col = COLORS.grass;
        if (t.terrain === 'soil') col = COLORS.soil;
        else if (t.terrain === 'water') col = COLORS.water;
        else if (t.terrain === 'wall') col = COLORS.houseWall;
        else if (t.terrain === 'door') col = COLORS.door;
        g.fillStyle(col, 1);
        g.fillRect(x * TILE, y * TILE, TILE, TILE);
        g.lineStyle(1, 0x000000, 0.08);
        g.strokeRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }

  drawField() {
    const g = this.fieldGfx;
    g.clear();
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = GameState.data.tiles[idx(x, y)];
        if (t.terrain !== 'soil') continue;
        let col = COLORS.soil;
        if (t.tilled) col = t.crop && t.crop.watered ? COLORS.watered : COLORS.tilled;
        g.fillStyle(col, 1);
        g.fillRect(x * TILE, y * TILE, TILE, TILE);
        g.lineStyle(1, 0x000000, 0.12);
        g.strokeRect(x * TILE, y * TILE, TILE, TILE);
        if (t.crop) this.drawCrop(g, x, y, t.crop);
        if (t.canopy) this.drawCanopy(g, x, y);
      }
    }
  }

  // 棚子:半透明頂蓋 + 兩根支柱,表示這格受保護。
  drawCanopy(g, x, y) {
    const px = x * TILE;
    const py = y * TILE;
    g.fillStyle(0x6d4c41, 0.35);
    g.fillRect(px + 2, py + 2, TILE - 4, 6); // 頂蓋
    g.fillStyle(0x4e342e, 0.5);
    g.fillRect(px + 3, py + 3, 3, TILE - 6); // 左柱
    g.fillRect(px + TILE - 6, py + 3, 3, TILE - 6); // 右柱
  }

  // 天氣覆蓋層:依當前時段(上午/下午)天氣在地圖區疊色 + 降雨/雪粒(晴天不疊)。
  drawWeather() {
    const g = this.weatherGfx;
    g.clear();
    const id = this.weatherPhase === 'pm' ? this.today.pm : this.today.am;
    const w = WEATHER[id];
    if (!w || id === 'sunny') return;
    const W = MAP_W * TILE;
    const H = MAP_H * TILE;
    const alpha = id === 'typhoon' ? 0.32 : id === 'heavyRain' ? 0.2 : id === 'snow' ? 0.16 : 0.12;
    g.fillStyle(w.color, alpha);
    g.fillRect(0, 0, W, H);
    if (id === 'lightRain' || id === 'heavyRain' || id === 'typhoon') {
      const n = id === 'lightRain' ? 40 : id === 'typhoon' ? 120 : 80;
      g.lineStyle(1, 0xffffff, id === 'typhoon' ? 0.35 : 0.25);
      for (let i = 0; i < n; i++) {
        const rx = (i * 53) % W;
        const ry = (i * 97) % H;
        g.lineBetween(rx, ry, rx - 4, ry + 10);
      }
    } else if (id === 'snow') {
      g.fillStyle(0xffffff, 0.7);
      for (let i = 0; i < 60; i++) {
        g.fillCircle((i * 61) % W, (i * 89) % H, 1.5);
      }
    }
  }

  // 作物以幾何形狀表示生長階段;成熟果實依作物種類上色(ITEMS[id].color)。
  drawCrop(g, x, y, crop) {
    const cx = x * TILE + TILE / 2;
    const baseY = y * TILE + TILE - 5;
    const cropColor = (ITEMS[crop.id] && ITEMS[crop.id].color) || COLORS.fruit;
    if (crop.stage === 0) {
      g.fillStyle(COLORS.seedDot, 1);
      g.fillCircle(cx, y * TILE + TILE / 2, 3);
      return;
    }
    const h = crop.stage === 1 ? 9 : crop.stage === 2 ? 16 : 18;
    g.fillStyle(COLORS.cropStalk, 1);
    g.fillRect(cx - 2, baseY - h, 4, h);
    if (crop.stage >= 2) {
      g.fillRect(cx - 8, baseY - h + 4, 7, 3);
      g.fillRect(cx + 1, baseY - h + 8, 7, 3);
    }
    if (crop.stage >= MAX_STAGE) {
      g.fillStyle(cropColor, 1);
      g.fillCircle(cx, baseY - h - 1, 5);
    }
  }
}
