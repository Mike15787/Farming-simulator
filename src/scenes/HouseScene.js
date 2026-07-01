// HouseScene —— 室內房屋場景(自由移動)。
//
// 職責:畫出房屋內部(地板、牆、床、出口門);走到床格 → 睡覺換日;走到出口門格 → 切回戶外。
// 房屋是小型靜態地圖(不放進 GameState.tiles,那是農場的 15×15),置中繪製於地圖區域。
import { TILE, VIEW_W, VIEW_H, COLORS, HOUSE_MAP, FARM_RETURN, gridToPixel } from '../config.js';
import { GameState } from '../state/GameState.js';
import { SaveManager } from '../state/SaveManager.js';
import { TimeSystem } from '../systems/TimeSystem.js';
import { Runtime } from '../runtime.js';
import Player from '../entities/Player.js';

const HOUSE_W = HOUSE_MAP[0].length; // 9
const HOUSE_H = HOUSE_MAP.length; // 7

export default class HouseScene extends Phaser.Scene {
  constructor() {
    super('HouseScene');
  }

  create() {
    // 把房屋置中於 480×480 的視口(地圖區域)
    this.originX = Math.floor((VIEW_W - HOUSE_W * TILE) / 2);
    this.originY = Math.floor((VIEW_H - HOUSE_H * TILE) / 2);

    this.gfx = this.add.graphics().setDepth(0);
    this.drawHouse();

    // 進門後出現在出口門正上方的格子中心,面向房間內側
    this.entry = { x: 4, y: 5 };
    const px = this.originX + gridToPixel(this.entry.x);
    const py = this.originY + gridToPixel(this.entry.y);
    this.player = new Player(this, this.originX, this.originY, px, py, 'up', (tx, ty) => this.solidAt(tx, ty));
    this.sleeping = false;
  }

  cell(x, y) {
    if (y < 0 || y >= HOUSE_H || x < 0 || x >= HOUSE_W) return '#';
    return HOUSE_MAP[y][x];
  }

  solidAt(tx, ty) {
    return this.cell(tx, ty) === '#'; // 牆不可走;床/門/地板可走
  }

  sleep() {
    if (this.sleeping) return;
    this.sleeping = true;
    this.cameras.main.flash(500, 0, 0, 0); // 黑色淡入淡出當作睡覺轉場
    TimeSystem.nextDay(GameState.data); // 換日結算 + 自動存檔(作物在農場長大)
    // 睡醒後把玩家挪離床鋪,避免重複觸發
    this.time.delayedCall(280, () => {
      this.player.setPosition(this.originX + gridToPixel(4), this.originY + gridToPixel(3));
      this.player.setFacing('down');
      this.sleeping = false;
    });
  }

  leave() {
    // 真實來源是 GameState:設好玩家像素落點與場景,FarmScene 會據此重建。
    GameState.data.player = { x: gridToPixel(FARM_RETURN.x), y: gridToPixel(FARM_RETURN.y), facing: 'down' };
    GameState.data.currentScene = 'farm';
    SaveManager.save(GameState.data);
    this.scene.start('FarmScene');
  }

  update(time, delta) {
    if (Runtime.dialogActive) return;
    this.player.update(delta);
    if (this.sleeping) return;
    // 依玩家所在格觸發床 / 出口
    const c = this.cell(this.player.tileX(), this.player.tileY());
    if (c === 'E') this.leave();
    else if (c === 'B') this.sleep();
  }

  drawHouse() {
    const g = this.gfx;
    g.clear();
    for (let y = 0; y < HOUSE_H; y++) {
      for (let x = 0; x < HOUSE_W; x++) {
        const c = HOUSE_MAP[y][x];
        let col = COLORS.floor;
        if (c === '#') col = COLORS.wallInner;
        else if (c === 'E') col = COLORS.exit;
        g.fillStyle(col, 1);
        g.fillRect(this.originX + x * TILE, this.originY + y * TILE, TILE, TILE);
        g.lineStyle(1, 0x000000, 0.12);
        g.strokeRect(this.originX + x * TILE, this.originY + y * TILE, TILE, TILE);
      }
    }
    // 床(跨 (4,1)、(5,1) 兩格)畫成一塊藍色 + 白枕頭
    g.fillStyle(COLORS.bed, 1);
    g.fillRect(this.originX + 4 * TILE + 3, this.originY + 1 * TILE + 5, TILE * 2 - 6, TILE - 8);
    g.fillStyle(0xffffff, 1);
    g.fillRect(this.originX + 4 * TILE + 5, this.originY + 1 * TILE + 8, 9, TILE - 14);
  }
}
