// ShopSystem —— 商店(買種子)與市場(賣作物)的純交易邏輯,操作 GameState.money 與背包。
//
// 設計重點:與表現分離。本系統只做「能不能買/賣 + 改狀態」,UI(ShopScene)只負責畫面與點擊。
// 種子買價固定(ITEMS.buy);作物賣價走 MarketSystem 動態定價(供需 + 漲跌上限)。
import { ITEMS } from '../config.js';
import { InventorySystem } from './InventorySystem.js';
import { MarketSystem } from './MarketSystem.js';

export function buyPrice(id) {
  return (ITEMS[id] && ITEMS[id].buy) || 0;
}
export function isSellable(id) {
  return ((ITEMS[id] && ITEMS[id].sell) || 0) > 0;
}

export const ShopSystem = {
  // 購買種子:錢夠才扣款並入庫。
  buy(state, id, qty = 1) {
    const price = buyPrice(id);
    if (!price) return { ok: false, reason: 'not_for_sale' };
    const cost = price * qty;
    if (state.money < cost) return { ok: false, reason: 'no_money' };
    state.money -= cost;
    InventorySystem.addItem(state, id, qty);
    return { ok: true, spent: cost, qty };
  },

  // 販售作物:逐個以「當下動態價」賣出,每賣 1 個就把供給 +1 → 價格即時下修,
  // 因此一次倒貨會邊際遞減(供給洪水壓低價格)。qty 為上限,有多少賣多少。
  sell(state, id, qty = 1) {
    if (!isSellable(id)) return { ok: false, reason: 'not_sellable' };
    const have = InventorySystem.countItem(state, id);
    if (have <= 0) return { ok: false, reason: 'none' };
    const n = Math.min(qty, have);
    let earned = 0;
    for (let i = 0; i < n; i++) {
      const unit = MarketSystem.price(state, id);
      earned += unit;
      state.money += unit;
      InventorySystem.removeItem(state, id, 1);
      MarketSystem.addSupply(state, id, 1);
    }
    return { ok: true, earned, sold: n, avg: Math.round(earned / n) };
  },
};
