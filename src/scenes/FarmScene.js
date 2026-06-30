// FarmScene —— 戶外農場場景(自由移動 + 對最近目標耕作)。
//
// 互動模型(新):
//  - 玩家自由移動;每幀找出「玩家 REACH 範圍內、最近一個有事可做的土格」當目標,並高亮它。
//  - 按動作鍵(空白/E)或點 UI 的動作按鈕 → 對該目標執行 FarmSystem.actOnTile
//    (自動鋤地/播種/澆水/收割,依格子狀態決定)。
//  - 靠近 NPC 時,動作改為對話。走到門格 → 進室內(碰觸觸發)。
import { TILE, MAP_W, MAP_H, COLORS, NPC_POS, REACH } from '../config.js';
import { GameState, idx, inBounds } from '../state/GameState.js';
import { SaveManager } from '../state/SaveManager.js';
import { FarmSystem, MAX_STAGE } from '../systems/FarmSystem.js';
import { QuestSystem } from '../systems/QuestSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import { Runtime } from '../runtime.js';
import Player from '../entities/Player.js';
import NPC from '../entities/NPC.js';

const ACTION_LABEL = { till: '鋤地', plant: '播種', water: '澆水', harvest: '收割' };

export default class FarmScene extends Phaser.Scene {
  constructor() {
    super('FarmScene');
  }

  create() {
    this.originX = 0;
    this.originY = 0;

    this.terrainGfx = this.add.graphics().setDepth(0);
    this.fieldGfx = this.add.graphics().setDepth(1);
    this.highlightGfx = this.add.graphics().setDepth(2); // 目標格高亮(在作物之上、玩家之下)
    this.drawTerrain();
    this.drawField();

    this.npc = new NPC(this, this.originX, this.originY);

    const p = GameState.data.player;
    this.player = new Player(this, this.originX, this.originY, p.x, p.y, p.facing, (tx, ty) => this.solidAt(tx, ty));

    this.target = null; // { x, y, action }

    const kb = this.input.keyboard;
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.numKeys = [];
    for (let i = 0; i < 9; i++) this.numKeys.push(kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE + i));
  }

  // ── 碰撞:水/牆/界外/NPC 不可進入 ───────────────────────
  solidAt(tx, ty) {
    if (!inBounds(tx, ty)) return true;
    if (tx === NPC_POS.x && ty === NPC_POS.y) return true;
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

  // ── 互動目標 ──────────────────────────────────────────────
  selectedItem() {
    return GameState.data.inventory[GameState.data.selectedSlot];
  }

  // 玩家中心與某格中心的距離平方
  dist2ToTile(x, y) {
    const cx = x * TILE + TILE / 2;
    const cy = y * TILE + TILE / 2;
    const dx = this.player.x - cx;
    const dy = this.player.y - cy;
    return dx * dx + dy * dy;
  }

  npcNear() {
    return this.dist2ToTile(NPC_POS.x, NPC_POS.y) <= REACH * REACH;
  }

  // 找 REACH 內最近一個「有事可做」的土格
  computeTarget() {
    const sel = this.selectedItem();
    const maxD2 = REACH * REACH;
    let best = null;
    let bestD2 = maxD2;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = GameState.data.tiles[idx(x, y)];
        if (t.terrain !== 'soil') continue;
        const action = FarmSystem.canActOnTile(GameState.data, x, y, sel);
        if (!action) continue;
        const d2 = this.dist2ToTile(x, y);
        if (d2 <= bestD2) {
          bestD2 = d2;
          best = { x, y, action };
        }
      }
    }
    this.target = best;
  }

  // 動作鍵 / 動作按鈕 都走這裡
  doAction() {
    const ui = this.scene.get('UIScene');
    if (Runtime.dialogActive) {
      ui.advanceDialog();
      return;
    }
    if (this.npcNear()) {
      const d = QuestSystem.talk(GameState.data);
      ui.startDialog(d.lines, d.onEnd);
      return;
    }
    if (this.target) {
      const res = FarmSystem.actOnTile(GameState.data, this.target.x, this.target.y, this.selectedItem());
      if (res.ok) this.drawField();
    }
  }

  update(time, delta) {
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
      // 走到門格 → 進室內
      const ctx = this.player.tileX();
      const cty = this.player.tileY();
      if (inBounds(ctx, cty) && GameState.data.tiles[idx(ctx, cty)].terrain === 'door') {
        this.enterHouse();
        return;
      }
    }

    // 算目標 + 提供給 UI 的按鈕標籤
    this.computeTarget();
    this.drawHighlight();
    this.updateActionLabel();

    // NPC 提示
    const q = GameState.data.quests.tomatoQuest;
    const canQuest = q === 'not_started' || (q === 'in_progress' && InventorySystem.countItem(GameState.data, 'tomato') >= 3);
    this.npc.setMarker(canQuest);
  }

  updateActionLabel() {
    if (Runtime.dialogActive) {
      Runtime.actionLabel = '繼續';
      Runtime.actionEnabled = true;
    } else if (this.npcNear()) {
      Runtime.actionLabel = '對話';
      Runtime.actionEnabled = true;
    } else if (this.target) {
      Runtime.actionLabel = ACTION_LABEL[this.target.action];
      Runtime.actionEnabled = true;
    } else {
      Runtime.actionLabel = '耕作';
      Runtime.actionEnabled = false;
    }
  }

  // ── 繪圖 ──────────────────────────────────────────────────
  drawHighlight() {
    const g = this.highlightGfx;
    g.clear();
    if (Runtime.dialogActive || !this.target) return;
    const { x, y } = this.target;
    g.lineStyle(2, COLORS.uiSlotSel, 1);
    g.strokeRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
    g.fillStyle(COLORS.uiSlotSel, 0.18);
    g.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
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
    g.fillRect(cx - 2, baseY - h, 4, h);
    if (crop.stage >= 2) {
      g.fillRect(cx - 8, baseY - h + 4, 7, 3);
      g.fillRect(cx + 1, baseY - h + 8, 7, 3);
    }
    if (crop.stage >= MAX_STAGE) {
      g.fillStyle(COLORS.fruit, 1);
      g.fillCircle(cx, baseY - h - 1, 5);
    }
  }
}
