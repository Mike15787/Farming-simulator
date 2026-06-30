// InteractionSystem —— 互動判定的「決策」中樞。
//
// 設計重點:把「按一個鍵,面前是什麼就做什麼」的分派決策集中在這裡,而非散在 Player
// 或各 Scene。本系統只做「判定」並回傳一個描述子;實際「執行」(改狀態、重繪、切場景)
// 由場景負責——因為切場景、重繪是 Phaser 的職責。
// 未來要加新互動物件(櫃子、商店),只需在這裡多一個分支。
import { idx, inBounds } from '../state/GameState.js';
import { NPC_POS } from '../config.js';

export const InteractionSystem = {
  // 依面前一格 (x,y) 內容,回傳要做什麼:
  //   { type: 'npc' } | { type: 'door' } | { type: 'farm', x, y } | { type: 'none' }
  resolve(state, x, y) {
    if (x === NPC_POS.x && y === NPC_POS.y) return { type: 'npc' };
    if (!inBounds(x, y)) return { type: 'none' };
    const t = state.tiles[idx(x, y)];
    if (!t) return { type: 'none' };
    if (t.terrain === 'door') return { type: 'door' };
    if (t.terrain === 'soil') return { type: 'farm', x, y };
    return { type: 'none' };
  },
};
