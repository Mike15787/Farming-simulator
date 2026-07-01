// AreaScene —— 城鎮 / 森林 的通用戶外場景(資料驅動,一個類別註冊成兩個 key)。
//
// 與 FarmScene 相同的互動骨架(自由移動 + 對最近目標動作 + 相機捲動 + 通道格切換),但地圖是
// config.AREA_MAPS 的靜態字元格(不進 GameState.tiles),且動作只有「採集」(森林的 gatherNodes)。
// 城鎮沒有採集點 → 動作按鈕停用,純探索。切換由 mapUtils 的通道關口處理。
import { TILE, REACH, COLORS, AREA_MAPS, ITEMS } from '../config.js';
import { GameState } from '../state/GameState.js';
import { SaveManager } from '../state/SaveManager.js';
import { InventorySystem, itemName } from '../systems/InventorySystem.js';
import { Runtime } from '../runtime.js';
import { setupWorldCamera, transitionTo, portalAt } from '../mapUtils.js';
import Player from '../entities/Player.js';

export default class AreaScene extends Phaser.Scene {
  constructor(key, mapId) {
    super(key);
    this.mapId = mapId;
  }

  create() {
    this.def = AREA_MAPS[this.mapId];
    this.cols = this.def.layout[0].length;
    this.rows = this.def.layout.length;
    this.originX = 0;
    this.originY = 0;

    this.terrainGfx = this.add.graphics().setDepth(0);
    this.nodeGfx = this.add.graphics().setDepth(1); // 採集點
    this.highlightGfx = this.add.graphics().setDepth(3);
    this.drawTerrain();
    this.drawNodes();

    const p = GameState.data.player;
    this.player = new Player(this, 0, 0, p.x, p.y, p.facing, (tx, ty) => this.solidAt(tx, ty));

    setupWorldCamera(this, this.cols * TILE, this.rows * TILE, this.player.container);
    Runtime.gameScene = this;

    this.action = null; // { kind:'gather', x, y, node }

    const kb = this.input.keyboard;
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.numKeys = [];
    for (let i = 0; i < 9; i++) this.numKeys.push(kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE + i));
  }

  // ── 地圖字元查詢 / 碰撞 ────────────────────────────────────
  cell(x, y) {
    if (y < 0 || y >= this.rows || x < 0 || x >= this.cols) return null;
    return this.def.layout[y][x];
  }

  solidAt(tx, ty) {
    const c = this.cell(tx, ty);
    if (c === null) return true; // 界外
    return this.def.solid.includes(c);
  }

  // 採集點是否已重生(距上次採集達 respawnDays)。
  nodeReady(node) {
    const last = GameState.data.forest && GameState.data.forest.gathered[node.x + ',' + node.y];
    if (last == null) return true;
    return GameState.data.day - last >= node.respawnDays;
  }

  // ── 每幀 ──────────────────────────────────────────────────
  update(time, delta) {
    if (Runtime.shopActive) return;

    for (let i = 0; i < this.numKeys.length; i++) {
      if (Phaser.Input.Keyboard.JustDown(this.numKeys[i])) {
        if (i < GameState.data.inventory.length) GameState.data.selectedSlot = i;
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keySpace) || Phaser.Input.Keyboard.JustDown(this.keyE)) {
      this.doAction();
    }

    if (!Runtime.dialogActive) {
      this.player.update(delta);
      const tx = this.player.tileX();
      const ty = this.player.tileY();
      const portal = portalAt(this.mapId, tx, ty);
      if (portal) {
        transitionTo(this, portal.to, portal.dest);
        return;
      }
    }

    this.computeAction();
    this.drawHighlight();
    this.updateActionLabel();
  }

  // 在 REACH 內找最近的「已重生採集點」。
  computeAction() {
    let best = null;
    let bestD2 = REACH * REACH;
    const nodes = this.def.gatherNodes || [];
    for (const n of nodes) {
      if (!this.nodeReady(n)) continue;
      const cx = n.x * TILE + TILE / 2;
      const cy = n.y * TILE + TILE / 2;
      const dx = this.player.x - cx;
      const dy = this.player.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD2) {
        bestD2 = d2;
        best = { kind: 'gather', x: n.x, y: n.y, node: n };
      }
    }
    this.action = best;
  }

  doAction() {
    const ui = this.scene.get('UIScene');
    if (Runtime.dialogActive) {
      ui.advanceDialog();
      return;
    }
    if (!this.action || this.action.kind !== 'gather') return;
    const n = this.action.node;
    const qty = 1 + (Math.random() < 0.4 ? 1 : 0); // 1~2 個
    InventorySystem.addItem(GameState.data, n.item, qty);
    GameState.data.forest.gathered[n.x + ',' + n.y] = GameState.data.day;
    SaveManager.save(GameState.data);
    this.flashGather(n, qty);
    this.action = null;
    this.drawNodes();
  }

  // 採集回饋:節點上方浮出「+野莓 ×2」文字,上升淡出(非阻斷)。
  flashGather(node, qty) {
    const cx = node.x * TILE + TILE / 2;
    const cy = node.y * TILE + TILE / 2;
    const t = this.add
      .text(cx, cy - 8, '+' + itemName(node.item) + ' ×' + qty, { fontFamily: 'sans-serif', fontSize: '12px', color: '#ffffff', backgroundColor: '#00000066' })
      .setOrigin(0.5, 1)
      .setDepth(11);
    this.tweens.add({ targets: t, y: cy - 28, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  updateActionLabel() {
    if (Runtime.dialogActive) {
      Runtime.actionLabel = '繼續';
      Runtime.actionEnabled = true;
      return;
    }
    if (this.action) {
      Runtime.actionLabel = '採集';
      Runtime.actionEnabled = true;
      return;
    }
    Runtime.actionLabel = '探索';
    Runtime.actionEnabled = false;
  }

  // ── 繪圖 ──────────────────────────────────────────────────
  drawTerrain() {
    const g = this.terrainGfx;
    g.clear();
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const c = this.def.layout[y][x];
        const key = this.def.colors[c] || 'grass';
        g.fillStyle(COLORS[key] || COLORS.grass, 1);
        g.fillRect(x * TILE, y * TILE, TILE, TILE);
        g.lineStyle(1, 0x000000, 0.08);
        g.strokeRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }

  drawNodes() {
    const g = this.nodeGfx;
    g.clear();
    const nodes = this.def.gatherNodes || [];
    for (const n of nodes) {
      const cx = n.x * TILE + TILE / 2;
      const cy = n.y * TILE + TILE / 2;
      // 底座矮叢
      g.fillStyle(0x33691e, 1);
      g.fillEllipse(cx, cy + 4, TILE - 10, 12);
      if (this.nodeReady(n)) {
        // 成熟:以物品色畫幾顆果實/菇
        const col = (ITEMS[n.item] && ITEMS[n.item].color) || 0xffffff;
        g.fillStyle(col, 1);
        g.fillCircle(cx - 5, cy, 4);
        g.fillCircle(cx + 4, cy - 2, 4);
        g.fillCircle(cx, cy + 3, 4);
        g.lineStyle(1, 0x000000, 0.3);
        g.strokeCircle(cx - 5, cy, 4);
        g.strokeCircle(cx + 4, cy - 2, 4);
        g.strokeCircle(cx, cy + 3, 4);
      } else {
        // 已採集:淡灰空叢
        g.fillStyle(0x9e9e9e, 0.4);
        g.fillCircle(cx, cy, 3);
      }
    }
  }

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
}
