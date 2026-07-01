// ShopScene —— 商店 / 市場 / 排行榜 的模態面板(疊在最上層)。
//
// 四種模式:mode='shop' 買種子;mode='market' 賣作物(動態價);mode='rank' 看財富排行榜(唯讀);
//           mode='forecast' 看 14 天天氣預報 + 施放魔法結界(唯讀 + 一顆按鈕)。
// 面板蓋住地圖區(留下底部 UI 列可見,方便看金錢),按 Esc 或「關閉」鈕離開。
// 本場景只負責畫面與點擊,交易交給 ShopSystem、價格走 MarketSystem、預報走 WeatherSystem。開啟期間
// Runtime.shopActive=true,讓 FarmScene 暫停、UIScene 不吃點擊。
import { GAME_W, VIEW_H, COLORS, SHOP_STOCK, ITEMS, festivalFor, WEATHER, BARRIER } from '../config.js';
import { GameState } from '../state/GameState.js';
import { SaveManager } from '../state/SaveManager.js';
import { ShopSystem, buyPrice, isSellable } from '../systems/ShopSystem.js';
import { MarketSystem, basePrice } from '../systems/MarketSystem.js';
import { FarmerSystem } from '../systems/FarmerSystem.js';
import { WeatherSystem } from '../systems/WeatherSystem.js';
import { itemName } from '../systems/InventorySystem.js';
import { Runtime } from '../runtime.js';

const TREND = { up: { sym: '▲', color: '#66bb6a' }, down: { sym: '▼', color: '#ef5350' }, flat: { sym: '＝', color: '#b0bec5' } };

const PANEL = { x: 24, y: 26, w: GAME_W - 48, h: VIEW_H - 52 }; // 蓋住地圖區(視口高)
const ROW_TOP = PANEL.y + 64;
const ROW_H = 46;
const CLOSE = { x: PANEL.x + PANEL.w - 34, y: PANEL.y + 10, w: 24, h: 24 };

export default class ShopScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ShopScene', active: false });
  }

  init(data) {
    this.mode = (data && data.mode) || 'shop'; // 'shop' | 'market' | 'rank' | 'forecast'
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
    // market:背包中可販售的作物,顯示動態價 + 漲跌;節慶當天的熱門作物名稱前加 emoji。
    const fest = festivalFor(s.day);
    return s.inventory
      .filter((it) => isSellable(it.id) && it.qty > 0)
      .map((it) => ({
        id: it.id,
        kind: 'sell',
        name: (fest && fest.crop === it.id ? fest.emoji + ' ' : '') + itemName(it.id),
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
    if (this.mode === 'forecast') {
      this.buildForecastRows();
      return;
    }
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

  // 天氣預報:今天 + 未來 13 天(共 14 天),每列日期 + 上午/下午天氣 + 準確率;底部施放結界。
  buildForecastRows() {
    this.rows = [{ buttons: [] }];
    const s = GameState.data;
    const fc = WeatherSystem.forecast(s);
    const PITCH = 21;
    const N = 14;
    for (let i = 0; i < N && i < fc.length; i++) {
      const e = fc[i];
      const y = ROW_TOP + i * PITCH;
      const md = (e.offset === 0 ? '今 ' : '') + e.date.month + '/' + e.date.day;
      const label =
        md.padEnd(7, ' ') + ' 上午' + WEATHER[e.am].emoji + ' 下午' + WEATHER[e.pm].emoji + '  ' + Math.round(e.acc * 100) + '%' + (e.typhoonWarning ? '  🌀颱風警報' : '');
      const color = e.typhoonWarning ? '#ff7043' : e.offset === 0 ? '#ffffff' : '#cfd8dc';
      this.rowObjs.push(this.add.text(PANEL.x + 16, y, label, { fontFamily: 'monospace', fontSize: '13px', color }).setDepth(2));
    }
    // 底部:魔法結界狀態 / 施放按鈕
    const by = PANEL.y + PANEL.h - 60;
    if (s.barrierDays > 0) {
      this.rowObjs.push(
        this.add.text(PANEL.x + 16, by + 8, '🛡️ 魔法結界生效中(剩 ' + s.barrierDays + ' 天,全農場免疫颱風)', { fontFamily: 'sans-serif', fontSize: '13px', color: '#b39ddb' }).setDepth(2)
      );
    } else {
      const label = '🛡️ 施放魔法結界  -$' + BARRIER.cost + '(' + BARRIER.days + ' 天)';
      this.rows[0].buttons.push(this.makeButton(PANEL.x + 16, by, PANEL.w - 32, 34, label, 0x5e35b1, { type: 'barrier' }));
    }
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
    } else if (a.type === 'barrier') {
      if (s.barrierDays > 0) this.message = '結界已在生效中';
      else if (s.money < BARRIER.cost) this.message = '金錢不足,無法施放結界!';
      else {
        s.money -= BARRIER.cost;
        s.barrierDays = BARRIER.days;
        this.message = '已施放魔法結界(' + BARRIER.days + ' 天,全農場免疫颱風)!';
      }
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
    // 市場模式:有節慶時,訊息列顯示節慶橫幅(蓋過空白訊息);其餘沿用交易訊息。
    const fest = this.mode === 'market' ? festivalFor(GameState.data.day) : null;
    this.msgText
      .setText(fest && !this.message ? fest.emoji + ' ' + fest.name + ' — ' + ITEMS[fest.crop].name + '需求暴增,趁現在賣!' : this.message)
      .setColor(fest && !this.message ? '#ffca28' : '#90caf9');
    const TITLE = {
      shop: '🛒 商店 — 購買種子 / 棚子',
      market: '🏪 市場 — 販售作物(價格隨供需浮動)',
      rank: '🏆 排行榜 — 傳說中的農夫',
      forecast: '📋 天氣預報 — 未來 14 天(越遠越不準)',
    };
    this.title.setText(TITLE[this.mode] || TITLE.shop);
    this.draw();
  }

  panelColor() {
    return this.mode === 'shop'
      ? COLORS.shop
      : this.mode === 'market'
      ? COLORS.market
      : this.mode === 'forecast'
      ? COLORS.weatherBoard
      : COLORS.rank;
  }

  draw() {
    const g = this.bg;
    g.clear();
    // 半透明遮罩(只蓋地圖區)
    g.fillStyle(0x000000, 0.45);
    g.fillRect(0, 0, GAME_W, VIEW_H);
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
      const HINT = { rank: 'Esc 或 ✕ 關閉', forecast: '施放結界防颱 · Esc 或 ✕ 關閉' };
      const hint = HINT[this.mode] || '點按鈕交易 · Esc 或 ✕ 關閉';
      this._hint = this.add.text(PANEL.x + 16, PANEL.y + PANEL.h - 22, hint, { fontFamily: 'monospace', fontSize: '11px', color: '#78909c' }).setDepth(2);
    }
  }
}
