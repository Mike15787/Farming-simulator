// Player —— 處理鍵盤輸入轉成移動,並維護「面向(facing)」。
//
// 設計重點:
//  - 移動採「格子對齊 + 平滑位移」:每次只走一格,用 tween 過去,移動中不再接受輸入,
//    手感比逐格瞬移好。
//  - facing 是互動判定的關鍵輸入(InteractionSystem 要算「面前一格」),所以即使
//    撞牆走不動,也會更新面向(原地轉身)。
//  - Player 不持有任何遊戲規則,座標最終由場景在切換/存檔前同步回 GameState。
import { TILE, COLORS } from '../config.js';

const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export default class Player {
  // canEnter(x,y) 由場景提供,決定某格能否進入(地形/邊界/NPC)。
  constructor(scene, originX, originY, gx, gy, facing, canEnter) {
    this.scene = scene;
    this.originX = originX;
    this.originY = originY;
    this.gx = gx;
    this.gy = gy;
    this.facing = facing || 'down';
    this.canEnter = canEnter;
    this.moving = false;
    this.onArrive = null; // 場景可設:每走完一格回呼 (x,y),用來偵測門/床

    // 用 Container 包住「身體」與「面向標記」,移動時整體 tween。
    this.body = scene.add.rectangle(0, 0, 20, 20, COLORS.player).setStrokeStyle(2, 0x0d47a1);
    this.nose = scene.add.rectangle(0, 0, 8, 8, COLORS.playerNose);
    this.container = scene.add.container(this.px(gx), this.py(gy), [this.body, this.nose]);
    this.container.setDepth(10);
    this.updateNose();

    const kb = scene.input.keyboard;
    this.cursors = kb.createCursorKeys();
    this.wasd = {
      up: kb.addKey('W'),
      down: kb.addKey('S'),
      left: kb.addKey('A'),
      right: kb.addKey('D'),
    };
  }

  px(gx) {
    return this.originX + gx * TILE + TILE / 2;
  }
  py(gy) {
    return this.originY + gy * TILE + TILE / 2;
  }

  updateNose() {
    const d = DIRS[this.facing];
    this.nose.setPosition(d.dx * 11, d.dy * 11);
  }

  setFacing(dir) {
    if (this.facing !== dir) {
      this.facing = dir;
      this.updateNose();
    }
  }

  // 面前一格座標(供互動判定)
  front() {
    const d = DIRS[this.facing];
    return { x: this.gx + d.dx, y: this.gy + d.dy };
  }

  syncToState(state) {
    state.player.x = this.gx;
    state.player.y = this.gy;
    state.player.facing = this.facing;
  }

  update() {
    if (this.moving) return;

    let dir = null;
    const c = this.cursors;
    const w = this.wasd;
    if (c.left.isDown || w.left.isDown) dir = 'left';
    else if (c.right.isDown || w.right.isDown) dir = 'right';
    else if (c.up.isDown || w.up.isDown) dir = 'up';
    else if (c.down.isDown || w.down.isDown) dir = 'down';
    if (!dir) return;

    this.setFacing(dir); // 先轉身(撞牆也會轉)
    const d = DIRS[dir];
    const nx = this.gx + d.dx;
    const ny = this.gy + d.dy;
    if (!this.canEnter(nx, ny)) return;

    this.moving = true;
    this.scene.tweens.add({
      targets: this.container,
      x: this.px(nx),
      y: this.py(ny),
      duration: 110,
      onComplete: () => {
        this.gx = nx;
        this.gy = ny;
        this.moving = false;
        if (this.onArrive) this.onArrive(nx, ny);
      },
    });
  }
}
