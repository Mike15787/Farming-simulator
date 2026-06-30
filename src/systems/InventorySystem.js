// InventorySystem —— 對 GameState.inventory 做增、刪、查、計數。
//
// 設計重點:
//  - 同類物品堆疊(同 id 累加數量),而非每個佔一格,符合種田遊戲習慣也省 UI 空間。
//  - 提供單一存取入口:其他系統(如 QuestSystem 要算番茄數量)一律呼叫 countItem,
//    不直接碰 inventory 陣列,避免邏輯散落。
import { ITEMS } from '../config.js';

export const InventorySystem = {
  addItem(state, id, qty = 1) {
    const it = state.inventory.find((i) => i.id === id);
    if (it) it.qty += qty;
    else state.inventory.push({ id, qty });
  },

  removeItem(state, id, qty = 1) {
    const i = state.inventory.findIndex((x) => x.id === id);
    if (i < 0) return false;
    state.inventory[i].qty -= qty;
    if (state.inventory[i].qty <= 0) {
      state.inventory.splice(i, 1);
      // 移除後夾住選取索引,避免指向不存在的格子
      if (state.selectedSlot >= state.inventory.length) {
        state.selectedSlot = Math.max(0, state.inventory.length - 1);
      }
    }
    return true;
  },

  countItem(state, id) {
    const it = state.inventory.find((i) => i.id === id);
    return it ? it.qty : 0;
  },
};

// 物品顯示輔助(UI 用)
export function itemName(id) {
  return (ITEMS[id] && ITEMS[id].name) || id;
}

export function itemColor(id) {
  return (ITEMS[id] && ITEMS[id].color) || 0xffffff;
}
