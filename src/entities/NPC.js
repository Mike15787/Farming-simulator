// NPC —— 只持有「外觀」與所在座標,本身不含任務邏輯。
//
// 設計重點:NPC 被互動時把控制權交給 QuestSystem(由場景接線),保持「資料」與「規則」
// 分離。頭上的 '!' 標記只是視覺提示,由場景依任務狀態決定顯示與否。
import { TILE, COLORS, NPC_POS } from '../config.js';

export default class NPC {
  constructor(scene, originX, originY) {
    const px = originX + NPC_POS.x * TILE + TILE / 2;
    const py = originY + NPC_POS.y * TILE + TILE / 2;
    this.body = scene.add.rectangle(px, py, 22, 22, COLORS.npc).setStrokeStyle(2, 0x4a148c).setDepth(9);
    this.marker = scene.add
      .text(px, py - 20, '!', { fontFamily: 'monospace', fontSize: '18px', color: '#ffeb3b' })
      .setOrigin(0.5, 1)
      .setDepth(11);
  }

  setMarker(visible) {
    this.marker.setVisible(visible);
  }
}
