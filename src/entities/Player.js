// Player —— 自由 XY 軸移動(像素級),不再卡格子。
//
// 設計重點:
//  - 位置以像素 (x, y) 表示,每幀依輸入向量移動。對角線會正規化,速度不會變快。
//  - 碰撞採「分軸 + 方框四角取樣」:先試 X 再試 Y,撞到實心格就退回該軸,
//    可沿牆滑行、卡角不穿牆。實心與否由場景提供的 solidAt(tileX, tileY) 決定。
//  - facing 只剩視覺用途(鼻子朝向),由移動向量的主軸推得。互動已改為「對最近目標動作」,
//    不再依賴面向。
//  - 玩家的真實座標(像素)在切場景/存檔前由場景同步回 GameState。
import { TILE, COLORS, PLAYER_SPEED, PLAYER_HALF } from '../config.js';

const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export default class Player {
  // solidAt(tileX, tileY) => bool:該格是否不可進入(牆/水/界外/NPC)。
  constructor(scene, originX, originY, px, py, facing, solidAt) {
    this.scene = scene;
    this.originX = originX;
    this.originY = originY;
    this.x = px;
    this.y = py;
    this.facing = facing || 'down';
    this.solidAt = solidAt;
    this.speed = PLAYER_SPEED;
    this.half = PLAYER_HALF;

    this.body = scene.add.rectangle(0, 0, 20, 20, COLORS.player).setStrokeStyle(2, 0x0d47a1);
    this.nose = scene.add.rectangle(0, 0, 8, 8, COLORS.playerNose);
    this.container = scene.add.container(px, py, [this.body, this.nose]).setDepth(10);
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

  updateNose() {
    const d = DIRS[this.facing];
    this.nose.setPosition(d.dx * 11, d.dy * 11);
  }

  setFacing(dir) {
    if (dir && this.facing !== dir) {
      this.facing = dir;
      this.updateNose();
    }
  }

  // 玩家中心所在格
  tileX() {
    return Math.floor((this.x - this.originX) / TILE);
  }
  tileY() {
    return Math.floor((this.y - this.originY) / TILE);
  }

  // 以 (cx,cy) 為中心的方框是否壓到實心格(取四角判定)
  blocked(cx, cy) {
    const h = this.half;
    const pts = [
      [cx - h, cy - h],
      [cx + h, cy - h],
      [cx - h, cy + h],
      [cx + h, cy + h],
    ];
    for (const [bx, by] of pts) {
      const tx = Math.floor((bx - this.originX) / TILE);
      const ty = Math.floor((by - this.originY) / TILE);
      if (this.solidAt(tx, ty)) return true;
    }
    return false;
  }

  syncToState(state) {
    state.player.x = this.x;
    state.player.y = this.y;
    state.player.facing = this.facing;
  }

  setPosition(px, py) {
    this.x = px;
    this.y = py;
    this.container.setPosition(px, py);
  }

  update(delta) {
    let vx = 0;
    let vy = 0;
    const c = this.cursors;
    const w = this.wasd;
    if (c.left.isDown || w.left.isDown) vx -= 1;
    if (c.right.isDown || w.right.isDown) vx += 1;
    if (c.up.isDown || w.up.isDown) vy -= 1;
    if (c.down.isDown || w.down.isDown) vy += 1;
    if (vx === 0 && vy === 0) return;

    const len = Math.hypot(vx, vy); // 對角線正規化
    vx /= len;
    vy /= len;
    const dist = this.speed * (delta / 1000);

    const nx = this.x + vx * dist;
    if (!this.blocked(nx, this.y)) this.x = nx;
    const ny = this.y + vy * dist;
    if (!this.blocked(this.x, ny)) this.y = ny;
    this.container.setPosition(this.x, this.y);

    // 視覺面向:取主軸
    if (Math.abs(vx) > Math.abs(vy)) this.setFacing(vx < 0 ? 'left' : 'right');
    else this.setFacing(vy < 0 ? 'up' : 'down');
  }
}
