// NPC —— 只持有「外觀」與所在座標,本身不含任務邏輯。
//
// 設計重點:NPC 被互動時把控制權交給 QuestSystem(由場景接線),保持「資料」與「規則」
// 分離。頭上的 '!' 標記只是視覺提示,由場景依任務狀態決定顯示與否。
// 泛化:constructor 吃一個 def(位置/顏色/可選名字),同一個類別可在任一地圖上放多個不同的 NPC
// (見 AreaScene 的 def.npcs),不再綁死單一座標。
import { TILE, COLORS } from '../config.js';

export default class NPC {
  // def: { x, y, color?, name? }。name 有給才畫名牌(比照 FarmScene 農夫名牌的畫法)。
  constructor(scene, originX, originY, def) {
    const px = originX + def.x * TILE + TILE / 2;
    const py = originY + def.y * TILE + TILE / 2;
    this.body = scene.add.rectangle(px, py, 22, 22, def.color ?? COLORS.npc).setStrokeStyle(2, 0x4a148c).setDepth(9);
    this.marker = scene.add
      .text(px, py - 20, '!', { fontFamily: 'monospace', fontSize: '18px', color: '#ffeb3b' })
      .setOrigin(0.5, 1)
      .setDepth(11);
    if (def.name) {
      // 名牌畫在「!」標記上方,避免兩者重疊。
      scene.add
        .text(px, py - 36, def.name, { fontFamily: 'sans-serif', fontSize: '10px', color: '#ffffff', backgroundColor: '#00000066' })
        .setOrigin(0.5, 1)
        .setDepth(3);
    }
  }

  setMarker(visible) {
    this.marker.setVisible(visible);
  }
}
