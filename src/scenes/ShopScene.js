// ShopScene —— 商店 / 市場 / 排行榜 的模態面板(疊在最上層)。
//
// 三種模式:mode='shop' 買種子;mode='market' 賣作物(動態價);mode='rank' 看財富排行榜(唯讀)。
// 面板蓋住地圖區(留下底部 UI 列可見,方便看金錢),按 Esc 或「關閉」鈕離開。
// 本場景只負責畫面與點擊,交易交給 ShopSystem、價格走 MarketSystem。開啟期間 Runtime.shopActive=true,
// 讓 FarmScene 暫停、UIScene 不吃點擊。
import { GAME_W, MAP_H, TILE, COLORS, SHOP_STOCK, ITEMS } from '../config.js';
import { GameState } from '../state/GameState.js';
import { SaveManager } from '../state/SaveManager.js';
import { ShopSystem, buyPrice, isSellable } from '../systems/ShopSystem.js';
import { MarketSystem, basePrice } from '../systems/MarketSystem.js';
import { FarmerSystem } from '../systems/FarmerSystem.js';
import { itemName } from '../systems/InventorySystem.js';
import { Runtime } from '../runtime.js';

const TREND = { up: { sym: '▲', color: '#66bb6a' }, down: { sym: '▼', color: '#ef5350' }, flat: { sym: '＝', color: '#b0bec5' } };

const PANEL = { x: 24, y: 26, w: GAME_W - 48, h: MAP_H * TILE - 52 }; // 蓋住地圖區
const ROW_TOP = PANEL.y + 64;
const ROW_H = 46;
const CLOSE = { x: PANEL.x + PANEL.w - 34, y: PANEL.y + 10, w: 24, h: 24 };

export default class ShopScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ShopScene', active: false });
  }

  init(data) {
    this.mode = (data && data.mode) || 'shop'; // 'shop' | 'market' | 'rank'
  }

  create() {
    Runtime.shopActive = true;
    this.message = '';

    this.bg = this.add.graphics().setDepth(0);
    this.title = this.add.text(PANEL.x + 16, PANEL.y + 12, '', { fontFamily: 'sans-serif', fontSize: '18px', color: '#ffffff' }).setDepth(2);
    this.moneyText = this.add
      .text(CLOSE.x - 14, PANEL.y + 14, '', { fontFamily: 'monospace', fontSize: '15px', color: '#ffd54f' })
      .setOrigin(1, 0)
      .setDepth(2);
    this.msgText = this.add.text(PANEL.x + 16, PANEL.y + 38, '', { fontFamily: 'sans-serif', fontSize: '12px', color: '#90caf9' }).setDepth(2);

    this.rowObjs = [];
    this.buildRows();

    this.input.on('pointerdown', (p) => this.onPointer(p));
    this.keyEsc = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  // 依模式算出列資料(每次交易後重建,因為背包/金錢/價格會變)
  computeRows() {
    const s = GameState.data;
    if (this.mode === 'shop') {
      return SHOP_STOCK.map((id) => ({ id, kind: 'buy', name: itemName(id), color: ITEMS[id].color, price: buyPrice(id) }));
    }
    if (this.mode === 'rank') {
      return FarmerSystem.ranking(s).map((r, i) => ({ kind: 'rank', rankNo: i + 1, name: r.name, money: r.money, isPlayer: r.isPlayer }));
    }
    // market:背包中可販售的作物,顯示動態價 + 漲跌
    return s.inventory
      .filter((it) => isSellable(it.id) && it.qty > 0)
      .map((it) => ({
        id: it.id,
        kind: 'sell',
        name: itemName(it.id),
        color: ITEMS[it.id].color,
        price: MarketSystem.price(s, it.id),
        base: basePrice(it.id),
        trend: MarketSystem.trend(s, it.id),
        qty: it.qty,
      }));
  }

  buildRows() {
    this.rowObjs.forEach((o) => o.destroy());
    this.rowObjs = [];
    this.rows = this.computeRows();

    const right = PANEL.x + PANEL.w - 16;
    this.rows.forEach((row, i) => {
      const ry = ROW_TOP + i * ROW_H;
      row.buttons = [];

      if (row.kind === 'rank') {
        // 排行榜列:名次 + 名字(玩家金色)+ 財富。冠軍加 👑。
        const crown = row.rankNo === 1 ? '👑 ' : '';
        const nameColor = row.isPlayer ? '#ffd54f' : '#ffffff';
        this.rowObjs.push(
          this.add.text(PANEL.x + 24, ry + 12, crown + row.rankNo + '. ' + row.name, { fontFamily: 'sans-serif', fontSize: '16px', color: nameColor }).setDepth(2)
        );
        this.rowObjs.push(
          this.add.text(right, ry + 12, '$' + row.money, { fontFamily: 'monospace', fontSize: '15px', color: '#b0bec5' }).setOrigin(1, 0).setDepth(2)
        );
        return;
      }

      // 商店 / 市場列:色塊 + 名稱 + 副資訊
      this.rowObjs.push(this.add.rectangle(PANEL.x + 32, ry + ROW_H / 2 - 4, 22, 22, row.color).setStrokeStyle(1, 0x000000, 0.4).setDepth(2));
      this.rowObjs.push(this.add.text(PANEL.x + 54, ry + 4, row.name, { fontFamily: 'sans-serif', fontSize: '15px', color: '#ffffff' }).setDepth(2));

      if (row.kind === 'buy') {
        this.rowObjs.push(this.add.text(PANEL.x + 54, ry + 24, '$' + row.price, { fontFamily: 'monospace', fontSize: '12px', color: '#b0bec5' }).setDepth(2));
        row.buttons.push(this.makeButton(right - 84, ry + 8, 84, 30, '購買', 0x2e7d32, { type: 'buy', id: row.id, qty: 1 }));
      } else {
        // 賣出列:持有量 + 動態市價 + 漲跌箭頭(相對基準價)
        const tr = TREND[row.trend];
        this.rowObjs.push(
          this.add.text(PANEL.x + 54, ry + 24, '持有 ' + row.qty + ' · 市價 $' + row.price, { fontFamily: 'monospace', fontSize: '12px', color: '#b0bec5' }).setDepth(2)
        );
        this.rowObjs.push(
          this.add.text(PANEL.x + 188, ry + 23, tr.sym + ' (基準 $' + row.base + ')', { fontFamily: 'monospace', fontSize: '11px', color: tr.color }).setDepth(2)
        );
        row.buttons.push(this.makeButton(right - 154, ry + 8, 66, 30, '賣 1', 0x00695c, { type: 'sell', id: row.id, qty: 1 }));
        row.buttons.push(this.makeButton(right - 80, ry + 8, 80, 30, '全部賣', 0x00838f, { type: 'sell', id: row.id, qty: row.qty }));
      }
    });
  }

  makeButton(x, y, w, h, label, color, action) {
    const r = this.add.rectangle(x, y, w, h, color).setOrigin(0, 0).setStrokeStyle(1, 0xffffff, 0.5).setDepth(2);
    const t = this.add.text(x + w / 2, y + h / 2, label, { fontFamily: 'sans-serif', fontSize: '13px', color: '#ffffff' }).setOrigin(0.5).setDepth(3);
    this.rowObjs.push(r, t);
    return { rect: { x, y, w, h }, action };
  }

  onPointer(p) {
    const x = p.x;
    const y = p.y;
    // 關閉鈕
    if (x >= CLOSE.x && x <= CLOSE.x + CLOSE.w && y >= CLOSE.y && y <= CLOSE.y + CLOSE.h) {
      this.close();
      return;
    }
    // 點面板外亦關閉(底部 UI 列)
    if (y > PANEL.y + PANEL.h) {
      this.close();
      return;
    }
    for (const row of this.rows) {
      for (const b of row.buttons || []) {
        const r = b.rect;
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
          this.doAction(b.action);
          return;
        }
      }
    }
  }

  doAction(a) {
    const s = GameState.data;
    if (a.type === 'buy') {
      const res = ShopSystem.buy(s, a.id, a.qty);
      this.message = res.ok ? '已購買 ' + itemName(a.id) + ' ×' + res.qty + '(-$' + res.spent + ')' : res.reason === 'no_money' ? '金錢不足!' : '無法購買';
    } else if (a.type === 'sell') {
      const res = ShopSystem.sell(s, a.id, a.qty);
      this.message = res.ok ? '已賣出 ' + itemName(a.id) + ' ×' + res.sold + '(+$' + res.earned + ')' : '沒有可賣的';
    }
    SaveManager.save(s);
    this.buildRows(); // 背包/金錢已變,重建列
  }

  close() {
    Runtime.shopActive = false;
    SaveManager.save(GameState.data);
    this.scene.stop();
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
      this.close();
      return;
    }
    this.moneyText.setText('$ ' + GameState.data.money);
    this.msgText.setText(this.message);
    this.title.setText(this.mode === 'shop' ? '🛒 商店 — 購買種子' : this.mode === 'market' ? '🏪 市場 — 販售作物(價格隨供需浮動)' : '🏆 排行榜 — 傳說中的農夫');
    this.draw();
  }

  panelColor() {
    return this.mode === 'shop' ? COLORS.shop : this.mode === 'market' ? COLORS.market : COLORS.rank;
  }

  draw() {
    const g = this.bg;
    g.clear();
    // 半透明遮罩(只蓋地圖區)
    g.fillStyle(0x000000, 0.45);
    g.fillRect(0, 0, GAME_W, MAP_H * TILE);
    // 面板
    g.fillStyle(0x263238, 0.98);
    g.fillRoundedRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 12);
    g.lineStyle(2, this.panelColor(), 1);
    g.strokeRoundedRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 12);
    // 標題底線
    g.lineStyle(1, 0xffffff, 0.15);
    g.lineBetween(PANEL.x + 12, ROW_TOP - 8, PANEL.x + PANEL.w - 12, ROW_TOP - 8);
    // 關閉鈕
    g.fillStyle(0xb71c1c, 1);
    g.fillRoundedRect(CLOSE.x, CLOSE.y, CLOSE.w, CLOSE.h, 5);
    if (!this._closeX) {
      this._closeX = this.add.text(CLOSE.x + CLOSE.w / 2, CLOSE.y + CLOSE.h / 2, '✕', { fontFamily: 'sans-serif', fontSize: '15px', color: '#ffffff' }).setOrigin(0.5).setDepth(3);
    }
    // 市場無可賣作物的提示
    const showEmpty = this.mode === 'market' && this.rows.length === 0;
    if (showEmpty) {
      if (!this._empty) {
        this._empty = this.add.text(PANEL.x + PANEL.w / 2, ROW_TOP + 30, '目前沒有可販售的作物', { fontFamily: 'sans-serif', fontSize: '14px', color: '#90a4ae' }).setOrigin(0.5).setDepth(2);
      }
      this._empty.setVisible(true);
    } else if (this._empty) {
      this._empty.setVisible(false);
    }
    // 底部操作提示
    if (!this._hint) {
      const hint = this.mode === 'rank' ? 'Esc 或 ✕ 關閉' : '點按鈕交易 · Esc 或 ✕ 關閉';
      this._hint = this.add.text(PANEL.x + 16, PANEL.y + PANEL.h - 22, hint, { fontFamily: 'monospace', fontSize: '11px', color: '#78909c' }).setDepth(2);
    }
  }
}
