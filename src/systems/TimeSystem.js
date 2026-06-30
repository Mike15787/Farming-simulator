// TimeSystem —— 處理「進入下一天」時的所有結算。
//
// 設計重點:把所有「跨天才會發生的變化」集中在這一個函式,世界的時間推進就只有一個入口,
// 邏輯清楚、不會有遺漏的狀態沒更新。日後要加日夜循環或季節,也只需擴充這裡。
import { SaveManager } from '../state/SaveManager.js';
import { MAX_STAGE } from './FarmSystem.js';

export const TimeSystem = {
  nextDay(state) {
    state.day += 1;

    // 統一結算所有田地:有澆水且未成熟 → 生長階段 +1;沒澆水 → 停滯。
    // 不論是否生長,都重設「今日已澆水」旗標,逼玩家明天要再澆一次。
    for (const t of state.tiles) {
      if (!t.crop) continue;
      if (t.crop.watered && t.crop.stage < MAX_STAGE) {
        t.crop.stage += 1;
      }
      t.crop.watered = false;
    }

    // 換日後自動存檔,確保進度不丟。
    SaveManager.save(state);
  },
};
