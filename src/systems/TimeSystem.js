// TimeSystem —— 處理「進入下一天」時的所有結算。
//
// 設計重點:把所有「跨天才會發生的變化」集中在這一個函式,世界的時間推進就只有一個入口,
// 邏輯清楚、不會有遺漏的狀態沒更新。日後要加日夜循環或季節,也只需擴充這裡。
import { WEATHER_FX } from '../config.js';
import { SaveManager } from '../state/SaveManager.js';
import { MAX_STAGE } from './FarmSystem.js';
import { FarmerSystem } from './FarmerSystem.js';
import { HireSystem } from './HireSystem.js';
import { MarketSystem } from './MarketSystem.js';
import { WeatherSystem } from './WeatherSystem.js';

export const TimeSystem = {
  nextDay(state) {
    state.day += 1;
    const endedDay = state.day - 1; // 剛結束、要結算的那一天
    const w = WeatherSystem.weatherForDay(state, endedDay);
    const autoWater = WeatherSystem.dayAutoWaters(w); // 下雨/颱風當天自動澆水

    // 0) 幫工結算(扣日薪 + 對指派田做「今天的一步」翻土/播種/澆水/收成):須在田地生長迴圈
    //    之前,幫工今天澆的水才會被緊接著的生長迴圈正確結算(與玩家自己白天澆水同一節奏)。
    HireSystem.stepDay(state);

    // 1) 玩家田地當日結算(天氣感知):
    //    - 颱風且未受保護 → 農損掉 1 階、今天不生長(結界/棚子可免疫)。
    //    - 其餘(含受保護的颱風日):下雨/颱風自動幫澆水;有澆水且未成熟 → 生長 +1。
    //    不論如何都重設「今日已澆水」旗標。
    state.tiles.forEach((t, i) => {
      if (!t.crop) return;
      if (w.typhoon && !WeatherSystem.isProtected(state, i)) {
        t.crop.stage = Math.max(0, t.crop.stage - WEATHER_FX.TYPHOON_STAGE_LOSS);
        t.crop.watered = false;
        return;
      }
      if (autoWater) t.crop.watered = true;
      if (t.crop.watered && t.crop.stage < MAX_STAGE) t.crop.stage += 1;
      t.crop.watered = false;
    });

    // 2) 其餘天氣效果:市場供給衝擊、棚子吹壞、結界天數遞減(須在田地結算之後)。
    WeatherSystem.applyDailyWeather(state, endedDay);

    // 3) NPC 農夫生產:到期收成 → 灌入市場供給、累積各自財富。
    FarmerSystem.stepDay(state);

    // 4) 市場需求消耗:每作物庫存扣掉需求量(供給回落、價格慢慢回升)。
    MarketSystem.consumeDemand(state);

    // 換日後自動存檔,確保進度不丟。
    SaveManager.save(state);
  },
};
