// FarmScene —— 戶外農場場景。
//
// 職責:讀 GameState.tiles 把每格依地形/作物畫成色塊;處理玩家移動與互動;
// 偵測碰門 → 切到室內。所有「規則」改的是 GameState,本場景只負責「讀狀態→畫」與
// 「輸入→交給對應系統」。
import { TILE, MAP_W, MAP_H, COLORS, NPC_POS } from '../config.js';
import { GameState, idx, inBounds } from '../state/GameState.js';
import { SaveManager } from '../state/SaveManager.js';
import { FarmSystem, MAX_STAGE } from '../systems/FarmSystem.js';
import { InteractionSystem } from '../systems/InteractionSystem.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { Runtime } from '../runtime.js';
import Player from '../entities/Player.js';
import NPC from '../entities/NPC.js';

export default class FarmScene extends Phaser.Scene {
  constructor() {
    super('FarmScene');
  }

  create() {
    this.originX = 0;
    this.originY = 0;

    // 兩層繪圖:terrainGfx 靜態地形(畫一次);fieldGfx 田地動態狀態+作物(每次互動/換日重畫)。
    this.terrainGfx = this.add.graphics().setDepth(0);
    this.fieldGfx = this.add.graphics().setDepth(1);
    this.drawTerrain();
    this.drawField();

    this.npc = new NPC(this, this.originX, this.originY);

    const p = GameState.data.player;
    this.player = new Player(this, this.originX, this.originY, p.x, p.y, p.facing, (x, y) => this.canEnter(x, y));
    this.player.onArrive = (x, y) => this.onArrive(x, y);

    // 互動 / 物品切換鍵
    const kb = this.input.keyboard;
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.numKeys = [];
    for (let i = 0; i < 9; i++) this.numKeys.push(kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE + i));
  }

  // ── 行走判定 ──────────────────────────────────────────────
  canEnter(x, y) {
    if (!inBounds(x, y)) return false;
    if (x === NPC_POS.x && y === NPC_POS.y) return false; // NPC 擋路
    const t = GameState.data.tiles[idx(x, y)];
    return t.terrain === 'grass' || t.terrain === 'soil' || t.terrain === 'door';
  }

  onArrive(x, y) {
    const t = GameState.data.tiles[idx(x, y)];
    if (t.terrain === 'door') this.enterHouse(); // 碰到門 → 進室內
  }

  enterHouse() {
    this.player.syncToState(GameState.data);
    GameState.data.currentScene = 'house';
    SaveManager.save(GameState.data);
    this.scene.start('HouseScene');
  }

  // ── 互動 ──────────────────────────────────────────────────
  selectedItem() {
    return GameState.data.inventory[GameState.data.selectedSlot];
  }

  handleInteract() {
    const ui = this.scene.get('UIScene');
    if (Runtime.dialogActive) {
      ui.advanceDialog(); // 對話中:互動鍵改為「繼續對話」
      return;
    }
    const f = this.player.front();
    const r = InteractionSystem.resolve(GameState.data, f.x, f.y);
    if (r.type === 'npc') {
      const d = QuestSystem.talk(GameState.data);
      ui.startDialog(d.lines, d.onEnd);
    } else if (r.type === 'door') {
      this.enterHouse();
    } else if (r.type === 'farm') {
      const res = FarmSystem.actOnTile(GameState.data, f.x, f.y, this.selectedItem());
      if (res.ok) this.drawField();
    }
  }

  update() {
    // 物品切換(數字鍵 1~9)
    for (let i = 0; i < this.numKeys.length; i++) {
      if (Phaser.Input.Keyboard.JustDown(this.numKeys[i])) {
        if (i < GameState.data.inventory.length) GameState.data.selectedSlot = i;
      }
    }

    // 互動鍵(空白 / E)
    if (Phaser.Input.Keyboard.JustDown(this.keySpace) || Phaser.Input.Keyboard.JustDown(this.keyE)) {
      this.handleInteract();
    }

    // 對話中暫停移動
    if (!Runtime.dialogActive) this.player.update();

    // NPC 提示標記:有任務可接 / 可交付時顯示 '!'
    const q = GameState.data.quests.tomatoQuest;
    const canAct = q === 'not_started' || (q === 'in_progress' && InventorySystem.countItem(GameState.data, 'tomato') >= 3);
    this.npc.setMarker(canAct);
  }

  // ── 繪圖 ──────────────────────────────────────────────────
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
      }
    }
  }

  // 作物以幾何形狀表示生長階段:點→短線→高線+分岔→頂端加果實圓。
  drawCrop(g, x, y, crop) {
    const cx = x * TILE + TILE / 2;
    const baseY = y * TILE + TILE - 5;
    if (crop.stage === 0) {
      g.fillStyle(COLORS.seedDot, 1);
      g.fillCircle(cx, y * TILE + TILE / 2, 3);
      return;
    }
    const h = crop.stage === 1 ? 9 : crop.stage === 2 ? 16 : 18;
    g.fillStyle(COLORS.cropStalk, 1);
    g.fillRect(cx - 2, baseY - h, 4, h); // 莖
    if (crop.stage >= 2) {
      g.fillRect(cx - 8, baseY - h + 4, 7, 3); // 左分岔
      g.fillRect(cx + 1, baseY - h + 8, 7, 3); // 右分岔
    }
    if (crop.stage >= MAX_STAGE) {
      g.fillStyle(COLORS.fruit, 1);
      g.fillCircle(cx, baseY - h - 1, 5); // 成熟果實
    }
  }
}
