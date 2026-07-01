// MarketSystem —— 供需動態定價與市場庫存。純邏輯,無表現。
//
// 模型(存量):每作物有一個會累積的「庫存 supply」,每天被「當日需求」消耗。
// 成交價依「庫存 / 需求」比值浮動,並夾在漲跌上限內,再乘上「今日市場胃納」:
//   factor   = clamp(-K*(supply/demand - 1), -MAX_DROP, MAX_RISE)   供給偏離係數
//   appetite = 每日波動(±DEMAND_NOISE) × 節慶加成(節慶當天對應作物 ×mult)
//   price    = max(FLOOR, round(base*(1+factor)*appetite))          FLOOR = round(base*(1-MAX_DROP))
// 供過於求 → 下跌到地板;稀缺 → 上漲到天花板;胃納高的日子(波動/節慶)→ 全面加價。
// 需求具價格彈性:當日消耗量 = demand*appetite*(1 - ELASTICITY*factor) —— 便宜多買、昂貴少買,
// 節慶 / 高胃納日吃更多,讓倒貨壓低的價格被加速消化、更快回穩。
// appetite 由「天數」決定(確定性偽隨機 + 節慶行事曆),同一天固定 → 不需存檔、不閃爍。
import { ITEMS, MARKET, festivalFor } from '../config.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// 以 (天數, 作物) 為種子的確定性偽隨機(FNV-1a),回傳約 [1-NOISE, 1+NOISE] 的每日需求波動倍數。
function dailyNoise(day, id) {
  let h = 2166136261;
  const s = id + '#' + day;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = ((h >>> 0) % 10000) / 10000; // [0,1)
  return 1 + (u * 2 - 1) * MARKET.DEMAND_NOISE;
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

  // 今日市場胃納 = 每日波動 × 節慶加成(節慶當天對應作物 ×mult,其餘為 1)。價格與消耗量都乘它。
  appetite(state, id) {
    const fest = festivalFor(state.day);
    const festMul = fest && fest.crop === id ? fest.mult : 1;
    return dailyNoise(state.day, id) * festMul;
  },

  // 動態成交單價(整數,且不低於地板價):供給係數 × 今日胃納。
  price(state, id) {
    const base = basePrice(id);
    if (!base) return 0;
    const floor = Math.round(base * (1 - MARKET.MAX_DROP));
    return Math.max(floor, Math.round(base * (1 + this.factorOf(state, id)) * this.appetite(state, id)));
  },

  // 漲跌狀態:'up' | 'down' | 'flat'(供 UI 顯示箭頭)。以當前價 vs 基準價判斷,
  // 自動涵蓋供給、每日波動與節慶三者的合併影響。
  trend(state, id) {
    const base = basePrice(id);
    if (!base) return 'flat';
    const r = this.price(state, id) / base - 1;
    if (r > 0.02) return 'up';
    if (r < -0.02) return 'down';
    return 'flat';
  },

  // 增加市場供給(玩家賣出 / 農夫收成),夾在 [0, cap]
  addSupply(state, id, qty) {
    if (!state.market) state.market = { supply: {} };
    const cur = this.supplyOf(state, id);
    state.market.supply[id] = clamp(cur + qty, 0, supplyCap(id));
  },

  // 當日實際需求量 = 基準需求 × 今日胃納 × 價格彈性項。
  //   胃納:每日波動 + 節慶暴增;彈性:factor<0(便宜)→ 多吃、factor>0(稀缺)→ 少吃。
  //   ELASTICITY=0 時彈性項為 1。回傳非負整數。
  demandToday(state, id) {
    const d = demandOf(id);
    if (!d) return 0;
    return Math.max(0, Math.round(d * this.appetite(state, id) * (1 - MARKET.ELASTICITY * this.factorOf(state, id))));
  },

  // 每日需求消耗:庫存減去「當日彈性需求量」(不為負)。換日時呼叫一次。
  consumeDemand(state) {
    if (!state.market || !state.market.supply) return;
    for (const id in state.market.supply) {
      state.market.supply[id] = clamp(state.market.supply[id] - this.demandToday(state, id), 0, supplyCap(id));
    }
  },
};
