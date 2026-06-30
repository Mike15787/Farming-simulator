// HouseScene —— 室內房屋場景。
//
// 職責:畫出房屋內部(地板、牆、床、出口門);碰床 → 睡覺換日;碰出口門 → 切回戶外。
// 房屋是小型靜態地圖(不放進 GameState.tiles,那是農場的 15×15),置中繪製於地圖區域。
import { TILE, MAP_W, MAP_H, COLORS, HOUSE_MAP, FARM_RETURN } from '../config.js';
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
    // 把房屋置中於 480×480 的地圖區域
    this.originX = Math.floor((MAP_W * TILE - HOUSE_W * TILE) / 2);
    this.originY = Math.floor((MAP_H * TILE - HOUSE_H * TILE) / 2);

    this.gfx = this.add.graphics().setDepth(0);
    this.drawHouse();

    // 進門後出現在出口門正上方,面向房間內側
    this.entry = { x: 4, y: 5 };
    this.player = new Player(this, this.originX, this.originY, this.entry.x, this.entry.y, 'up', (x, y) => this.canEnter(x, y));
    this.player.onArrive = (x, y) => this.onArrive(x, y);
    this.sleeping = false;
  }

  cell(x, y) {
    if (y < 0 || y >= HOUSE_H || x < 0 || x >= HOUSE_W) return '#';
    return HOUSE_MAP[y][x];
  }

  canEnter(x, y) {
    return this.cell(x, y) !== '#'; // 牆不可走;床/門/地板可走
  }

  onArrive(x, y) {
    const c = this.cell(x, y);
    if (c === 'E') this.leave();
    else if (c === 'B') this.sleep();
  }

  sleep() {
    if (this.sleeping) return;
    this.sleeping = true;
    this.cameras.main.flash(500, 0, 0, 0); // 黑色淡入淡出當作睡覺轉場
    TimeSystem.nextDay(GameState.data); // 換日結算 + 自動存檔(作物在農場長大)
    // 睡醒後把玩家移開床鋪,避免重複觸發
    this.time.delayedCall(260, () => {
      this.player.gx = 4;
      this.player.gy = 2;
      this.player.container.setPosition(this.player.px(4), this.player.py(2));
      this.player.setFacing('down');
      this.sleeping = false;
    });
  }

  leave() {
    // 真實來源是 GameState:設好玩家落點與場景,FarmScene 會據此重建。
    GameState.data.player = { x: FARM_RETURN.x, y: FARM_RETURN.y, facing: 'down' };
    GameState.data.currentScene = 'farm';
    SaveManager.save(GameState.data);
    this.scene.start('FarmScene');
  }

  update() {
    if (!Runtime.dialogActive) this.player.update();
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
