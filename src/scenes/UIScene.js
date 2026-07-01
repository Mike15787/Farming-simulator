// UIScene —— 永遠疊加在最上層的 UI:天數、金錢、背包列、動作按鈕、對話框。
//
// 設計重點:與遊戲場景分離,常駐不重建,只讀 GameState/Runtime 刷新顯示。
//  - 動作按鈕:標籤與可按狀態由 FarmScene 透過 Runtime 提供;點下去呼叫 FarmScene.doAction()
//    (對話中則為「繼續」)。鍵盤空白/E 是等效捷徑。
//  - 背包格可點選切換,等同數字鍵。
import { GAME_W, VIEW_H, UI_H, COLORS, festivalFor, dateForDay, formatDate, WEATHER, FORECAST } from '../config.js';
import { GameState } from '../state/GameState.js';
import { itemName, itemColor } from '../systems/InventorySystem.js';
import { WeatherSystem } from '../systems/WeatherSystem.js';
import { Runtime } from '../runtime.js';

const SLOT = 32;
const GAP = 5;
const MAX_SLOTS = 9; // 縮小格子,容納較多種子,且不與右側動作按鈕重疊
const START_X = 6;
const BAR_Y = VIEW_H; // 480:UI 列起點(=視口高)

const BTN = { w: 96, h: 44, x: GAME_W - 96 - 12, y: BAR_Y + 20 }; // 動作按鈕矩形

export default class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene', active: false });
  }

  create() {
    this.barGfx = this.add.graphics().setDepth(0);

    this.dayText = this.add.text(8, 6, '', { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' }).setDepth(2);
    // 節慶徽章(頂列置中):有節慶才顯示,提醒玩家某作物今天需求暴增。
    this.festText = this.add
      .text(GAME_W / 2, 6, '', { fontFamily: 'sans-serif', fontSize: '14px', color: '#ffca28' })
      .setOrigin(0.5, 0)
      .setDepth(2);
    this.moneyText = this.add
      .text(GAME_W - 8, 6, '', { fontFamily: 'monospace', fontSize: '16px', color: '#ffd54f' })
      .setOrigin(1, 0)
      .setDepth(2);
    this.selText = this.add
      .text(8, BAR_Y + 6, '', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff' })
      .setDepth(2);
    this.hintText = this.add
      .text(8, BAR_Y + UI_H - 15, '', { fontFamily: 'monospace', fontSize: '11px', color: '#b0bec5' })
      .setDepth(2);

    // 動作按鈕文字
    this.btnText = this.add
      .text(BTN.x + BTN.w / 2, BTN.y + BTN.h / 2, '', { fontFamily: 'sans-serif', fontSize: '17px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(2);
    this.btnVisible = false;
    this.btnActive = false;

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
      .text(GAME_W - 24, VIEW_H - 30, '▶ 空白鍵 / 按鈕 繼續', { fontFamily: 'monospace', fontSize: '11px', color: '#cfd8dc' })
      .setOrigin(1, 1)
      .setDepth(6)
      .setVisible(false);

    this.dlgActive = false;
    this.dlgLines = [];
    this.dlgIndex = 0;
    this.dlgOnEnd = null;

    // 滑鼠點擊:動作按鈕 + 背包格
    this.input.on('pointerdown', (p) => this.onPointer(p));
  }

  onPointer(p) {
    if (Runtime.shopActive) return; // 買賣面板開啟中:點擊交給 ShopScene
    const x = p.x;
    const y = p.y;
    // 動作按鈕
    if (this.btnVisible && this.btnActive && x >= BTN.x && x <= BTN.x + BTN.w && y >= BTN.y && y <= BTN.y + BTN.h) {
      this.onActionClick();
      return;
    }
    // 背包格選取
    const s = GameState.data;
    const sy = BAR_Y + 26;
    for (let i = 0; i < Math.min(MAX_SLOTS, s.inventory.length); i++) {
      const sx = START_X + i * (SLOT + GAP);
      if (x >= sx && x <= sx + SLOT && y >= sy && y <= sy + SLOT) {
        s.selectedSlot = i;
        return;
      }
    }
  }

  onActionClick() {
    if (Runtime.dialogActive) {
      this.advanceDialog();
      return;
    }
    // 分派給當前戶外遊戲場景(FarmScene / AreaScene)。
    const gs = Runtime.gameScene;
    if (gs && gs.scene && gs.scene.isActive() && typeof gs.doAction === 'function') gs.doAction();
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
    const y = VIEW_H - 120;
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
    // 日期 + 今日天氣(上午/下午不同就兩個 emoji 都顯示)
    const w = WeatherSystem.today(s);
    const amE = WEATHER[w.am].emoji;
    const pmE = WEATHER[w.pm].emoji;
    this.dayText.setText(formatDate(dateForDay(s.day)) + ' ' + (amE === pmE ? amE : amE + pmE));
    this.moneyText.setText('$ ' + s.money);

    // 中央徽章:颱風警報優先於節慶
    let warnOffset = w.typhoon ? 0 : null;
    if (warnOffset === null) {
      const nt = WeatherSystem.nextTyphoonWithin(s, FORECAST.WARN_DAYS);
      if (nt) warnOffset = nt.offset;
    }
    const fest = festivalFor(s.day);
    if (warnOffset !== null) {
      this.festText.setText('⚠️ 颱風警報 ' + (warnOffset === 0 ? '今天!' : warnOffset + '天後')).setColor('#ff7043');
    } else if (fest) {
      this.festText.setText(fest.emoji + ' ' + fest.name + '!').setColor('#ffca28');
    } else {
      this.festText.setText('');
    }

    const g = this.barGfx;
    g.clear();
    g.fillStyle(0x000000, 0.35);
    g.fillRect(0, 0, GAME_W, 26);
    g.fillStyle(COLORS.uiBg, 1);
    g.fillRect(0, BAR_Y, GAME_W, UI_H);

    // 背包格子
    const sy = BAR_Y + 26;
    for (let i = 0; i < MAX_SLOTS; i++) {
      const sx = START_X + i * (SLOT + GAP);
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
    this.hintText.setText('方向鍵/WASD 移動 · 空白/E 動作 · 點格子切物品 · 走到門進屋/碰床睡覺 · 走到通道往城鎮/森林');

    this.drawActionButton(g);
  }

  drawActionButton(g) {
    // 只有在戶外場景(農場/城鎮/森林)或對話中才顯示動作按鈕;室內、買賣面板開啟時不顯示。
    const sc = GameState.data.currentScene;
    const outdoor = sc === 'farm' || sc === 'town' || sc === 'forest';
    const show = !Runtime.shopActive && (Runtime.dialogActive || outdoor);
    this.btnVisible = show;
    if (!show) {
      this.btnText.setVisible(false);
      this.btnActive = false;
      return;
    }
    const active = Runtime.actionEnabled; // 範圍內有目標 / 對話中 才可按
    this.btnActive = active;
    g.fillStyle(active ? 0x2e7d32 : 0x37474f, 1);
    g.fillRoundedRect(BTN.x, BTN.y, BTN.w, BTN.h, 8);
    g.lineStyle(2, active ? 0xa5d6a7 : 0x546e7a, 1);
    g.strokeRoundedRect(BTN.x, BTN.y, BTN.w, BTN.h, 8);
    this.btnText
      .setVisible(true)
      .setText(Runtime.dialogActive ? '繼續 ▶' : Runtime.actionLabel || '耕作')
      .setColor(active ? '#ffffff' : '#90a4ae');
  }
}
