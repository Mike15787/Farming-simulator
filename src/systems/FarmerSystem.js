// FarmerSystem —— NPC 農夫的「模擬農場」每日結算與排行榜。純邏輯,無表現。
//
// 每個農夫依 config.FARMER_DEFS 的固定流程 routine 循環種植:每 growDays 天收成一次,
// 產出 yield 個當前作物 → 灌入市場供給(壓低該作物價格),並把收成換成自己的財富(排行榜)。
// 靜態定義(名字/顏色/流程)在 config;動態進度(step/daysIntoCrop/money)在 GameState.farmers。
import { FARMER_DEFS } from '../config.js';
import { MarketSystem } from './MarketSystem.js';

function defOf(id) {
  return FARMER_DEFS.find((f) => f.id === id);
}

export const FarmerSystem = {
  // 換日結算:推進每位農夫,成熟則收成入市、賺錢、輪到下一作物。
  stepDay(state) {
    if (!state.farmers) return;
    for (const fa of state.farmers) {
      const def = defOf(fa.id);
      if (!def) continue;
      fa.daysIntoCrop += 1;
      if (fa.daysIntoCrop >= def.growDays) {
        const crop = def.routine[fa.step % def.routine.length];
        MarketSystem.addSupply(state, crop, def.yield); // 先灌供給(壓價)
        fa.money += def.yield * MarketSystem.price(state, crop); // 再以當下價結算收入
        fa.step = (fa.step + 1) % def.routine.length;
        fa.daysIntoCrop = 0;
      }
    }
  },

  // 財富排行榜:玩家 + 所有農夫,依 money 由高到低。
  ranking(state) {
    const rows = [{ name: '你', money: state.money, isPlayer: true }];
    for (const fa of state.farmers || []) {
      const def = defOf(fa.id);
      rows.push({ name: def ? def.name : fa.id, money: fa.money, isPlayer: false });
    }
    rows.sort((a, b) => b.money - a.money);
    return rows;
  },

  // 某農夫目前正在種什麼(供對話顯示)
  currentCrop(fa) {
    const def = defOf(fa.id);
    if (!def) return null;
    return def.routine[fa.step % def.routine.length];
  },
};
