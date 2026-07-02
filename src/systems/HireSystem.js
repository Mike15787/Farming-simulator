// HireSystem —— 勞力仲介所:雇用/解雇幫工、指派工作、每日結算。純邏輯,無表現。
//
// 設計重點:幫工是「真的」在玩家自己的農場格子(GameState.tiles)上工作,不是像 FarmerSystem
// 那樣背景模擬的抽象產出,所以直接重用 FarmSystem 既有的翻土/播種/澆水/收成狀態機
// (canActOnTile/actOnTile),不必另寫一套平行邏輯。種子從玩家真實背包扣;但幫工的收成不像玩家
// 親自收成那樣進背包,而是轉存倉庫(WarehouseSystem)——玩家背包只是 FarmSystem.actOnTile 唯一
// 認得的落點,所以收成先落背包、立刻搬到倉庫,對玩家背包是零延遲的過渡,不會被誤認成玩家的物品。
import { HIRE_DEFS } from '../config.js';
import { idx, inBounds } from '../state/GameState.js';
import { FarmSystem } from './FarmSystem.js';
import { InventorySystem } from './InventorySystem.js';
import { WarehouseSystem } from './WarehouseSystem.js';

function defOf(id) {
  return HIRE_DEFS.find((d) => d.id === id);
}

export const HireSystem = {
  workerOf(state, id) {
    return (state.workers || []).find((w) => w.id === id);
  },

  // 雇用:錢夠才扣款並標記受雇。
  hire(state, id) {
    const def = defOf(id);
    const w = this.workerOf(state, id);
    if (!def || !w) return { ok: false, reason: 'unknown' };
    if (w.hired) return { ok: false, reason: 'already_hired' };
    if (state.money < def.hireCost) return { ok: false, reason: 'no_money' };
    state.money -= def.hireCost;
    w.hired = true;
    return { ok: true };
  },

  // 解雇:清除受雇與工作狀態,不退費。
  dismiss(state, id) {
    const w = this.workerOf(state, id);
    if (!w || !w.hired) return { ok: false };
    w.hired = false;
    w.job = null;
    return { ok: true };
  },

  // 指派/改派工作:目標須是農場的可耕土格(soil),且未被「別的」受雇員工佔用。
  assign(state, id, x, y, crop) {
    const w = this.workerOf(state, id);
    if (!w || !w.hired) return { ok: false, reason: 'not_hired' };
    if (!inBounds(x, y) || state.tiles[idx(x, y)].terrain !== 'soil') return { ok: false, reason: 'invalid_tile' };
    const taken = (state.workers || []).some((o) => o.id !== id && o.job && o.job.x === x && o.job.y === y);
    if (taken) return { ok: false, reason: 'tile_taken' };
    w.job = { x, y, crop };
    return { ok: true };
  },

  // 取消指派(仍受雇,只是暫時沒有工作)。
  unassign(state, id) {
    const w = this.workerOf(state, id);
    if (w) w.job = null;
  },

  // 換日結算,由 TimeSystem.nextDay 在田地生長迴圈「之前」呼叫:
  //  - 受雇者扣日薪(錢不夠就先欠著,不強制解雇 —— 幫工的收成不進背包,薪水是獨立的錢坑,
  //    要玩家自己去倉庫取出、拿去市場賣才變現)。
  //  - 有指派工作者,對該格重用 FarmSystem 狀態機做「今天的一步」(翻土/播種/澆水/收成)。種子
  //    從玩家背包即時查詢並扣除(每位員工都重新 countItem,不可迴圈外快取——否則兩位員工同天
  //    搶種同一種子、庫存只剩 1 顆時會重複判定「有貨」)。缺種子就先閒置,等玩家補貨。
  //  - 收成:FarmSystem.actOnTile 的收成分支只認得玩家背包,所以先讓它照常加進背包,再立刻搬到
  //    倉庫(WarehouseSystem)—— 幫工收成的作物只進倉庫,不會混進玩家隨身背包。
  stepDay(state) {
    for (const w of state.workers || []) {
      const def = defOf(w.id);
      if (!w.hired || !def) continue;
      if (state.money >= def.wage) state.money -= def.wage;

      if (!w.job) continue;
      const { x, y, crop } = w.job;
      if (!inBounds(x, y)) continue;
      const t = state.tiles[idx(x, y)];
      if (!t || t.terrain !== 'soil') continue;
      const seedId = crop + '_seed';
      const selected = { id: seedId, qty: InventorySystem.countItem(state, seedId) };
      const op = FarmSystem.canActOnTile(state, x, y, selected);
      if (!op) continue;
      const harvestedCrop = op === 'harvest' ? t.crop.id : null;
      FarmSystem.actOnTile(state, x, y, selected);
      if (harvestedCrop) {
        InventorySystem.removeItem(state, harvestedCrop, 1);
        WarehouseSystem.addItem(state, harvestedCrop, 1);
      }
    }
  },
};
