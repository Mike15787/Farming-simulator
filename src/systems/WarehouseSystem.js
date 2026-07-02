// WarehouseSystem —— 倉庫(GameState.warehouse.items)的增刪查。
//
// 與 InventorySystem 同款「同 id 堆疊」邏輯,但沒有「目前選取格」的概念 —— 倉庫在遊戲裡是唯讀檢視
// (見 ShopScene 的 warehouse 模式),不需要 InventorySystem.removeItem 那樣的 selectedSlot 收斂處理。
export const WarehouseSystem = {
  addItem(state, id, qty = 1) {
    const it = state.warehouse.items.find((i) => i.id === id);
    if (it) it.qty += qty;
    else state.warehouse.items.push({ id, qty });
  },

  removeItem(state, id, qty = 1) {
    const i = state.warehouse.items.findIndex((x) => x.id === id);
    if (i < 0) return false;
    state.warehouse.items[i].qty -= qty;
    if (state.warehouse.items[i].qty <= 0) state.warehouse.items.splice(i, 1);
    return true;
  },

  countItem(state, id) {
    const it = state.warehouse.items.find((i) => i.id === id);
    return it ? it.qty : 0;
  },
};
