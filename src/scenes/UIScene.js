// UIScene —— 永遠疊加在最上層的 UI:天數、金錢、背包列、對話框。
//
// 設計重點:與遊戲場景分離。UI 不該隨地圖場景切換而重建;獨立 Scene 可常駐,只更新顯示
// 內容。資料一律讀 GameState(每幀刷新文字/色塊,成本低)。對話框由遊戲場景透過
// startDialog/advanceDialog 驅動,並用 Runtime.dialogActive 通知場景暫停輸入。
import { GAME_W, MAP_H, TILE, UI_H, COLORS } from '../config.js';
import { GameState } from '../state/GameState.js';
import { itemName, itemColor } from '../systems/InventorySystem.js';
import { Runtime } from '../runtime.js';

const SLOT = 36;
const GAP = 6;
const MAX_SLOTS = 10;
const BAR_Y = MAP_H * TILE; // 480:UI 列起點

export default class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene', active: false });
  }

  create() {
    this.barGfx = this.add.graphics().setDepth(0);

    this.dayText = this.add.text(8, 6, '', { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' }).setDepth(2);
    this.moneyText = this.add
      .text(GAME_W - 8, 6, '', { fontFamily: 'monospace', fontSize: '16px', color: '#ffd54f' })
      .setOrigin(1, 0)
      .setDepth(2);
    this.selText = this.add
      .text(GAME_W - 8, BAR_Y + 6, '', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff' })
      .setOrigin(1, 0)
      .setDepth(2);
    this.hintText = this.add
      .text(8, BAR_Y + UI_H - 15, '', { fontFamily: 'monospace', fontSize: '11px', color: '#b0bec5' })
      .setDepth(2);

    // 背包格子的數量文字池(重複使用,避免每幀建立物件)
    this.qtyTexts = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      this.qtyTexts.push(
        this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '11px', color: '#ffffff' }).setOrigin(1, 1).setDepth(2)
      );
    }

    // 對話框(預設隱藏)
    this.dlgGfx = this.add.graphics().setDepth(5).setVisible(false);
    this.dlgText = this.add
      .text(0, 0, '', { fontFamily: 'sans-serif', fontSize: '15px', color: '#ffffff', wordWrap: { width: GAME_W - 52 } })
      .setDepth(6)
      .setVisible(false);
    this.dlgHint = this.add
      .text(GAME_W - 24, MAP_H * TILE - 30, '▶ 空白鍵繼續', { fontFamily: 'monospace', fontSize: '11px', color: '#cfd8dc' })
      .setOrigin(1, 1)
      .setDepth(6)
      .setVisible(false);

    this.dlgActive = false;
    this.dlgLines = [];
    this.dlgIndex = 0;
    this.dlgOnEnd = null;
  }

  // ── 對話框 API(供遊戲場景呼叫)──────────────────────────
  startDialog(lines, onEnd) {
    Runtime.dialogActive = true;
    this.dlgActive = true;
    this.dlgLines = lines.slice();
    this.dlgIndex = 0;
    this.dlgOnEnd = onEnd || null;
    this.renderDialog();
  }

  advanceDialog() {
    if (!this.dlgActive) return;
    this.dlgIndex++;
    if (this.dlgIndex >= this.dlgLines.length) this.endDialog();
    else this.renderDialog();
  }

  endDialog() {
    this.dlgActive = false;
    Runtime.dialogActive = false;
    this.dlgGfx.setVisible(false);
    this.dlgText.setVisible(false);
    this.dlgHint.setVisible(false);
    const cb = this.dlgOnEnd;
    this.dlgOnEnd = null;
    if (cb) cb(); // 對話結束才推進任務狀態 / 發獎勵
  }

  renderDialog() {
    const x = 12;
    const y = MAP_H * TILE - 120;
    const w = GAME_W - 24;
    const h = 96;
    const g = this.dlgGfx;
    g.clear();
    g.fillStyle(0x000000, 0.82);
    g.fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(2, 0xffffff, 0.9);
    g.strokeRoundedRect(x, y, w, h, 10);
    g.setVisible(true);
    this.dlgText.setText(this.dlgLines[this.dlgIndex]).setPosition(x + 16, y + 18).setVisible(true);
    this.dlgHint.setVisible(true);
  }

  // ── 每幀刷新 ──────────────────────────────────────────────
  update() {
    const s = GameState.data;
    this.dayText.setText('第 ' + s.day + ' 天');
    this.moneyText.setText('$ ' + s.money);

    const g = this.barGfx;
    g.clear();
    // 頂部半透明條(讓天數/金錢在水域上也清楚)
    g.fillStyle(0x000000, 0.35);
    g.fillRect(0, 0, GAME_W, 26);
    // 底部 UI 列底色
    g.fillStyle(COLORS.uiBg, 1);
    g.fillRect(0, BAR_Y, GAME_W, UI_H);

    // 背包格子
    const startX = 8;
    const sy = BAR_Y + 26;
    for (let i = 0; i < MAX_SLOTS; i++) {
      const sx = startX + i * (SLOT + GAP);
      if (i >= s.inventory.length) {
        this.qtyTexts[i].setVisible(false);
        continue;
      }
      const item = s.inventory[i];
      g.fillStyle(COLORS.uiSlot, 1);
      g.fillRect(sx, sy, SLOT, SLOT);
      g.fillStyle(itemColor(item.id), 1);
      g.fillRect(sx + 5, sy + 5, SLOT - 10, SLOT - 10);
      if (i === s.selectedSlot) {
        g.lineStyle(3, COLORS.uiSlotSel, 1);
        g.strokeRect(sx - 1, sy - 1, SLOT + 2, SLOT + 2);
      } else {
        g.lineStyle(1, 0x000000, 0.6);
        g.strokeRect(sx, sy, SLOT, SLOT);
      }
      this.qtyTexts[i].setVisible(true).setText('' + item.qty).setPosition(sx + SLOT - 2, sy + SLOT - 1);
    }

    const sel = s.inventory[s.selectedSlot];
    this.selText.setText('選取: ' + (sel ? itemName(sel.id) : '無'));
    this.hintText.setText('方向鍵/WASD 移動 · 空白/E 互動 · 數字鍵 切換物品 · 進屋碰床睡覺過天');
  }
}
