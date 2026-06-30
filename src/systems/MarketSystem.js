// MarketSystem —— 供需動態定價與市場庫存。純邏輯,無表現。
//
// 模型(存量):每作物有一個會累積的「庫存 supply」,每天被需求 demand 消耗。
// 成交價依「庫存 / 需求」比值浮動,並夾在漲跌上限內:
//   ratio  = supply / demand                       (1.0 = 供需平衡)
//   factor = clamp(-K*(ratio-1), -MAX_DROP, MAX_RISE)
//   price  = max(FLOOR, round(base*(1+factor)))     FLOOR = round(base*(1-MAX_DROP))
// 供過於求 → 價格下跌到地板;供不應求(稀缺)→ 上漲到天花板。
import { ITEMS, MARKET } from '../config.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function basePrice(id) {
  return (ITEMS[id] && ITEMS[id].sell) || 0;
}
export function demandOf(id) {
  return (ITEMS[id] && ITEMS[id].demand) || 0;
}
export function supplyCap(id) {
  return demandOf(id) * MARKET.SUPPLY_CAP_MULT;
}

export const MarketSystem = {
  // 目前供給(舊檔/未知作物視為等於需求 → 平衡價)
  supplyOf(state, id) {
    const s = state.market && state.market.supply;
    return s && typeof s[id] === 'number' ? s[id] : demandOf(id);
  },

  // 供需偏離係數 factor(已夾上下限);供需平衡時為 0。
  factorOf(state, id) {
    const demand = demandOf(id);
    if (!demand) return 0;
    const ratio = this.supplyOf(state, id) / demand;
    return clamp(-MARKET.K * (ratio - 1), -MARKET.MAX_DROP, MARKET.MAX_RISE);
  },

  // 動態成交單價(整數,且不低於地板價)
  price(state, id) {
    const base = basePrice(id);
    if (!base) return 0;
    const floor = Math.round(base * (1 - MARKET.MAX_DROP));
    return Math.max(floor, Math.round(base * (1 + this.factorOf(state, id))));
  },

  // 漲跌狀態:'up' | 'down' | 'flat'(供 UI 顯示箭頭)
  trend(state, id) {
    const f = this.factorOf(state, id);
    if (f > 0.02) return 'up';
    if (f < -0.02) return 'down';
    return 'flat';
  },

  // 增加市場供給(玩家賣出 / 農夫收成),夾在 [0, cap]
  addSupply(state, id, qty) {
    if (!state.market) state.market = { supply: {} };
    const cur = this.supplyOf(state, id);
    state.market.supply[id] = clamp(cur + qty, 0, supplyCap(id));
  },

  // 每日需求消耗:庫存減去需求量(不為負)。換日時呼叫一次。
  consumeDemand(state) {
    if (!state.market || !state.market.supply) return;
    for (const id in state.market.supply) {
      const d = demandOf(id);
      state.market.supply[id] = clamp(state.market.supply[id] - d, 0, supplyCap(id));
    }
  },
};
