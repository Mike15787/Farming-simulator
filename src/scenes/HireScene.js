// HireScene —— 勞力仲介所的模態面板(疊在最上層)。
//
// 兩個子畫面:'list'(雇用/管理員工列表,預設)與 'assign'(針對某位員工,在小比例農場地圖上
// 點選要負責的田 + 挑作物,兩者都在同一個面板內完成,不需離開去農場)。
// 沿用 ShopScene 的模態慣例:面板蓋住地圖區(留底部 UI 列可見),Runtime.shopActive=true 讓
// FarmScene/AreaScene 暫停、UIScene 不吃點擊;Esc / ✕ / 點面板外關閉。本場景只負責畫面與點擊,
// 交易/指派邏輯交給 HireSystem。
import { GAME_W, VIEW_H, COLORS, HIRE_DEFS, MAP_W, MAP_H, plantableCropIds } from '../config.js';
import { GameState, idx } from '../state/GameState.js';
import { SaveManager } from '../state/SaveManager.js';
import { HireSystem } from '../systems/HireSystem.js';
import { itemName, itemColor } from '../systems/InventorySystem.js';
import { Runtime } from '../runtime.js';

const PANEL = { x: 24, y: 26, w: GAME_W - 48, h: VIEW_H - 52 }; // 蓋住地圖區(視口高)
const ROW_TOP = PANEL.y + 64;
const CLOSE = { x: PANEL.x + PANEL.w - 34, y: PANEL.y + 10, w: 24, h: 24 };
const LIST_ROW_H = 92;

// 迷你農場地圖(assign 畫面用):每格 GRID_PX 像素。
const GRID_PX = 11;
const GRID_X = PANEL.x + 16;
const GRID_Y = ROW_TOP;
const CROP_Y = GRID_Y + MAP_H * GRID_PX + 16;
const CROP_SIZE = 28;
const CROP_GAP = 8;
const SUMMARY_Y = CROP_Y + CROP_SIZE + 12;
const BTN_Y = SUMMARY_Y + 24;

export default class HireScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HireScene', active: false });
  }

  create() {
    Runtime.shopActive = true;
    this.message = '';
    this.view = 'list'; // 'list' | 'assign'
    this.assignId = null; // 目前正在指派工作的員工 id
    this.selectedTile = null; // { x, y }
    this.selectedCrop = null; // crop id

    this.bg = this.add.graphics().setDepth(0);
    this.gridGfx = this.add.graphics().setDepth(1);
    this.title = this.add.text(PANEL.x + 16, PANEL.y + 12, '', { fontFamily: 'sans-serif', fontSize: '18px', color: '#ffffff' }).setDepth(2);
    this.moneyText = this.add
      .text(CLOSE.x - 14, PANEL.y + 14, '', { fontFamily: 'monospace', fontSize: '15px', color: '#ffd54f' })
      .setOrigin(1, 0)
      .setDepth(2);
    this.msgText = this.add.text(PANEL.x + 16, PANEL.y + 38, '', { fontFamily: 'sans-serif', fontSize: '12px', color: '#90caf9' }).setDepth(2);

    this.rowObjs = [];
    this.buttons = [];
    this.render();

    this.input.on('pointerdown', (p) => this.onPointer(p));
    this.keyEsc = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  // ── 畫面切換 ──────────────────────────────────────────────
  openAssign(workerId) {
    const s = GameState.data;
    const w = HireSystem.workerOf(s, workerId);
    this.view = 'assign';
    this.assignId = workerId;
    this.selectedTile = w && w.job ? { x: w.job.x, y: w.job.y } : null;
    this.selectedCrop = w && w.job ? w.job.crop : null;
    this.message = '';
    this.render();
  }

  backToList() {
    this.view = 'list';
    this.assignId = null;
    this.message = '';
    this.render();
  }

  // ── 重繪(狀態變動後統一呼叫)────────────────────────────
  render() {
    this.rowObjs.forEach((o) => o.destroy());
    this.rowObjs = [];
    this.buttons = [];
    if (this.view === 'assign') this.renderAssign();
    else this.renderList();
  }

  renderList() {
    const s = GameState.data;
    const right = PANEL.x + PANEL.w - 16;
    HIRE_DEFS.forEach((def, i) => {
      const w = HireSystem.workerOf(s, def.id);
      const ry = ROW_TOP + i * LIST_ROW_H;

      this.rowObjs.push(this.add.rectangle(PANEL.x + 32, ry + 14, 22, 22, def.color).setStrokeStyle(1, 0x000000, 0.4).setDepth(2));
      this.rowObjs.push(this.add.text(PANEL.x + 54, ry, def.name, { fontFamily: 'sans-serif', fontSize: '15px', color: '#ffffff' }).setDepth(2));

      if (!w.hired) {
        this.rowObjs.push(
          this.add.text(PANEL.x + 54, ry + 22, '尚未雇用 · 雇用費 $' + def.hireCost + ' · 日薪 $' + def.wage, { fontFamily: 'monospace', fontSize: '12px', color: '#b0bec5' }).setDepth(2)
        );
        this.buttons.push(this.makeButton(right - 100, ry + 4, 100, 32, '雇用 $' + def.hireCost, 0x2e7d32, { type: 'hire', id: def.id }));
        return;
      }

      this.rowObjs.push(
        this.add.text(PANEL.x + 54, ry + 22, '在職中 · 日薪 $' + def.wage, { fontFamily: 'monospace', fontSize: '12px', color: '#a5d6a7' }).setDepth(2)
      );
      const jobText = w.job ? '工作:田(' + w.job.x + ',' + w.job.y + ') · ' + itemName(w.job.crop) : '尚未指派工作';
      this.rowObjs.push(this.add.text(PANEL.x + 54, ry + 40, jobText, { fontFamily: 'monospace', fontSize: '12px', color: '#cfd8dc' }).setDepth(2));
      this.buttons.push(this.makeButton(right - 192, ry + 4, 92, 32, '指派工作', 0x5e35b1, { type: 'openAssign', id: def.id }));
      this.buttons.push(this.makeButton(right - 92, ry + 4, 92, 32, '解雇', 0xb71c1c, { type: 'dismiss', id: def.id }));
    });
  }

  renderAssign() {
    // 圖例
    this.rowObjs.push(
      this.add
        .text(GRID_X + MAP_W * GRID_PX + 14, GRID_Y, '點選要指派的\n可耕地(棕色)。\n其他顏色=已被\n別的員工負責。', {
          fontFamily: 'sans-serif',
          fontSize: '11px',
          color: '#b0bec5',
          lineSpacing: 4,
        })
        .setDepth(2)
    );

    // 作物挑選列:色塊本體 + 選取框
    plantableCropIds().forEach((cropId, i) => {
      const cx = PANEL.x + 16 + i * (CROP_SIZE + CROP_GAP);
      const selected = this.selectedCrop === cropId;
      this.rowObjs.push(
        this.add
          .rectangle(cx, CROP_Y, CROP_SIZE, CROP_SIZE, itemColor(cropId))
          .setOrigin(0, 0)
          .setStrokeStyle(selected ? 3 : 1, selected ? COLORS.uiSlotSel : 0x000000, selected ? 1 : 0.4)
          .setDepth(2)
      );
      this.buttons.push({ rect: { x: cx, y: CROP_Y, w: CROP_SIZE, h: CROP_SIZE }, action: { type: 'pickCrop', crop: cropId } });
    });

    const tileText = this.selectedTile ? '田(' + this.selectedTile.x + ',' + this.selectedTile.y + ')' : '(尚未選田)';
    const cropText = this.selectedCrop ? itemName(this.selectedCrop) : '(尚未選作物)';
    this.rowObjs.push(
      this.add.text(PANEL.x + 16, SUMMARY_Y, '指派:' + tileText + ' · 種 ' + cropText, { fontFamily: 'sans-serif', fontSize: '13px', color: '#ffffff' }).setDepth(2)
    );

    const ready = !!(this.selectedTile && this.selectedCrop);
    this.buttons.push(this.makeButton(PANEL.x + 16, BTN_Y, 84, 32, '返回', 0x455a64, { type: 'backToList' }));
    this.buttons.push(this.makeButton(PANEL.x + 110, BTN_Y, 108, 32, '取消指派', 0x6d4c41, { type: 'unassign', id: this.assignId }));
    this.buttons.push(
      this.makeButton(PANEL.x + 228, BTN_Y, 120, 32, '確認指派', ready ? 0x2e7d32 : 0x37474f, { type: 'confirmAssign', id: this.assignId, disabled: !ready })
    );
  }

  makeButton(x, y, w, h, label, color, action) {
    const r = this.add.rectangle(x, y, w, h, color).setOrigin(0, 0).setStrokeStyle(1, 0xffffff, 0.5).setDepth(2);
    const t = this.add.text(x + w / 2, y + h / 2, label, { fontFamily: 'sans-serif', fontSize: '13px', color: '#ffffff' }).setOrigin(0.5).setDepth(3);
    this.rowObjs.push(r, t);
    return { rect: { x, y, w, h }, action };
  }

  // ── 點擊 ──────────────────────────────────────────────────
  onPointer(p) {
    const x = p.x;
    const y = p.y;
    if (x >= CLOSE.x && x <= CLOSE.x + CLOSE.w && y >= CLOSE.y && y <= CLOSE.y + CLOSE.h) {
      this.close();
      return;
    }
    if (y > PANEL.y + PANEL.h) {
      this.close();
      return;
    }

    if (this.view === 'assign' && this.hitGrid(x, y)) return;

    for (const b of this.buttons) {
      const r = b.rect;
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        if (!b.action.disabled) this.doAction(b.action);
        return;
      }
    }
  }

  hitGrid(x, y) {
    const gx = Math.floor((x - GRID_X) / GRID_PX);
    const gy = Math.floor((y - GRID_Y) / GRID_PX);
    if (gx < 0 || gy < 0 || gx >= MAP_W || gy >= MAP_H) return false;
    const t = GameState.data.tiles[idx(gx, gy)];
    if (!t || t.terrain !== 'soil') return true; // 點在網格內但非可耕地:吃掉點擊,不穿透
    this.selectedTile = { x: gx, y: gy };
    this.message = '';
    this.render();
    return true;
  }

  doAction(a) {
    const s = GameState.data;
    if (a.type === 'hire') {
      const res = HireSystem.hire(s, a.id);
      const def = HIRE_DEFS.find((d) => d.id === a.id);
      this.message = res.ok ? '已雇用 ' + def.name + '!' : res.reason === 'no_money' ? '金錢不足,無法雇用!' : '無法雇用';
    } else if (a.type === 'dismiss') {
      const def = HIRE_DEFS.find((d) => d.id === a.id);
      HireSystem.dismiss(s, a.id);
      this.message = '已解雇 ' + def.name;
    } else if (a.type === 'openAssign') {
      this.openAssign(a.id);
      return;
    } else if (a.type === 'backToList') {
      this.backToList();
      return;
    } else if (a.type === 'pickCrop') {
      this.selectedCrop = a.crop;
    } else if (a.type === 'unassign') {
      HireSystem.unassign(s, a.id);
      this.selectedTile = null;
      this.selectedCrop = null;
      this.message = '已取消指派';
    } else if (a.type === 'confirmAssign') {
      const res = HireSystem.assign(s, a.id, this.selectedTile.x, this.selectedTile.y, this.selectedCrop);
      const def = HIRE_DEFS.find((d) => d.id === a.id);
      this.message = res.ok
        ? '已指派 ' + def.name + ' 到田(' + this.selectedTile.x + ',' + this.selectedTile.y + ') 種 ' + itemName(this.selectedCrop)
        : res.reason === 'tile_taken'
        ? '此田已由其他員工負責,請換一格'
        : '指派失敗';
    }
    SaveManager.save(s);
    this.render();
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
    this.title.setText(
      this.view === 'assign' ? '🧑‍🌾 指派工作 — ' + (HIRE_DEFS.find((d) => d.id === this.assignId) || {}).name : '🧑‍🌾 勞力仲介所 — 雇用幫工'
    );
    this.draw();
  }

  draw() {
    const g = this.bg;
    g.clear();
    g.fillStyle(0x000000, 0.45);
    g.fillRect(0, 0, GAME_W, VIEW_H);
    g.fillStyle(0x263238, 0.98);
    g.fillRoundedRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 12);
    g.lineStyle(2, COLORS.agency, 1);
    g.strokeRoundedRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 12);
    g.lineStyle(1, 0xffffff, 0.15);
    g.lineBetween(PANEL.x + 12, ROW_TOP - 8, PANEL.x + PANEL.w - 12, ROW_TOP - 8);
    g.fillStyle(0xb71c1c, 1);
    g.fillRoundedRect(CLOSE.x, CLOSE.y, CLOSE.w, CLOSE.h, 5);
    if (!this._closeX) {
      this._closeX = this.add.text(CLOSE.x + CLOSE.w / 2, CLOSE.y + CLOSE.h / 2, '✕', { fontFamily: 'sans-serif', fontSize: '15px', color: '#ffffff' }).setOrigin(0.5).setDepth(3);
    }
    if (!this._hint) {
      this._hint = this.add.text(PANEL.x + 16, PANEL.y + PANEL.h - 22, '', { fontFamily: 'monospace', fontSize: '11px', color: '#78909c' }).setDepth(2);
    }
    this._hint.setText(this.view === 'assign' ? '點選田地 + 作物 · Esc 或 ✕ 關閉' : '雇用 / 指派 / 解雇 · Esc 或 ✕ 關閉');

    this.drawGrid();
  }

  // 迷你農場地圖:soil=可點選、依是否被指派上色;非 soil 淡灰不可互動。
  drawGrid() {
    const g = this.gridGfx;
    g.clear();
    if (this.view !== 'assign') return;
    const s = GameState.data;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = s.tiles[idx(x, y)];
        const px = GRID_X + x * GRID_PX;
        const py = GRID_Y + y * GRID_PX;
        if (!t || t.terrain !== 'soil') {
          g.fillStyle(0x37474f, 0.5);
          g.fillRect(px, py, GRID_PX - 1, GRID_PX - 1);
          continue;
        }
        const job = (s.workers || []).find((w) => w.job && w.job.x === x && w.job.y === y);
        if (job) {
          const jd = HIRE_DEFS.find((d) => d.id === job.id);
          g.fillStyle((jd && jd.color) || COLORS.soil, 0.85);
        } else {
          g.fillStyle(COLORS.soil, 1);
        }
        g.fillRect(px, py, GRID_PX - 1, GRID_PX - 1);
      }
    }
    if (this.selectedTile) {
      const { x, y } = this.selectedTile;
      g.lineStyle(2, COLORS.uiSlotSel, 1);
      g.strokeRect(GRID_X + x * GRID_PX - 1, GRID_Y + y * GRID_PX - 1, GRID_PX + 1, GRID_PX + 1);
    }
  }
}
