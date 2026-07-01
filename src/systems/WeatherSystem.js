// WeatherSystem —— 天氣、天氣預報與天氣效果。純邏輯,無表現。
//
// 設計重點:
//  - 天氣是「seed + 絕對天數」的確定性偽隨機(沿用 MarketSystem 的 FNV-1a 手法):未來可算、
//    可預報、跨讀檔穩定,而且每局(seed 不同)不一樣。只在存檔存一個 weather.seed。
//  - 每天分「上午 am / 下午 pm」兩段;機制上兩段取聯集(任一段會澆水→澆水、任一段颱風→成災)。
//  - 颱風只在夏季判定;颱風日的隔天起 TYPHOON_TAIL_DAYS 天為「颱風尾」(強制降雨)。
//  - 預報越遠越不準(當天 100%,每遠一天 -DECAY);颱風於來襲前 WARN_DAYS 天才在預報露出警報,
//    更早只看得到「大雨」。所有天氣效果(自動澆水除外)集中在 applyDailyWeather,由 TimeSystem 呼叫。
import { WEATHER, SEASON_WEATHER, WEATHER_GEN, FORECAST, WEATHER_FX, dateForDay, seasonForMonth } from '../config.js';

// 以任意參數(含 seed)為種子的確定性偽隨機,回傳 [0,1)。
function hash01(...parts) {
  let h = 2166136261;
  const s = parts.join('#');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

// 依權重表 + u∈[0,1) 抽一個 key。
function pickWeighted(table, u) {
  const keys = Object.keys(table);
  let total = 0;
  for (const k of keys) total += table[k];
  let r = u * total;
  for (const k of keys) {
    r -= table[k];
    if (r < 0) return k;
  }
  return keys[keys.length - 1];
}

// 從權重表中抽一個「不等於 tv」的天氣(供預報混淆用)。
function pickAlt(table, tv, u) {
  const alt = {};
  for (const k of Object.keys(table)) if (k !== tv) alt[k] = table[k];
  if (Object.keys(alt).length === 0) return tv;
  return pickWeighted(alt, u);
}

function seedOf(state) {
  return (state.weather && state.weather.seed) || 0;
}

function seasonTableForDay(absDay) {
  const season = seasonForMonth(dateForDay(absDay).month);
  return SEASON_WEATHER[season];
}

export const WeatherSystem = {
  // 某絕對天數是否為颱風日(只夏季判定)。
  isTyphoonDay(state, absDay) {
    if (absDay < 1) return false;
    if (seasonForMonth(dateForDay(absDay).month) !== 'summer') return false;
    return hash01(seedOf(state), absDay, 'typhoon') < WEATHER_GEN.TYPHOON_CHANCE;
  },

  // 某絕對天數的「真實」天氣:{ am, pm, typhoon }(am/pm 為 WEATHER 的 id)。
  weatherForDay(state, absDay) {
    // 1) 颱風日:整天暴雨
    if (this.isTyphoonDay(state, absDay)) {
      return { am: 'typhoon', pm: 'typhoon', typhoon: true };
    }
    // 2) 颱風尾:前 1..TAIL_DAYS 天若有颱風 → 強制降雨(越近越大)
    for (let d = 1; d <= WEATHER_GEN.TYPHOON_TAIL_DAYS; d++) {
      if (this.isTyphoonDay(state, absDay - d)) {
        const rain = d === 1 ? 'heavyRain' : 'lightRain';
        return { am: rain, pm: rain, typhoon: false, tail: true };
      }
    }
    // 3) 一般天氣:依季節加權表分別抽上午/下午
    const table = seasonTableForDay(absDay);
    return {
      am: pickWeighted(table, hash01(seedOf(state), absDay, 'am')),
      pm: pickWeighted(table, hash01(seedOf(state), absDay, 'pm')),
      typhoon: false,
    };
  },

  // 今天的真實天氣。
  today(state) {
    return this.weatherForDay(state, state.day);
  },

  // 當天是否會自動澆水(任一段會澆水即算)。
  dayAutoWaters(w) {
    return !!(WEATHER[w.am] && WEATHER[w.am].autoWater) || !!(WEATHER[w.pm] && WEATHER[w.pm].autoWater);
  },

  // 未來預報(offset 0..HORIZON):每項 { offset, absDay, date, am, pm, typhoonWarning, acc }。
  // am/pm 為「呈現值」(經混淆);颱風於 WARN_DAYS 內才顯示警報,更遠顯示為大雨。
  forecast(state) {
    const out = [];
    for (let k = 0; k <= FORECAST.HORIZON; k++) {
      const absDay = state.day + k;
      const trueW = this.weatherForDay(state, absDay);
      const acc = Math.max(0, 1 - FORECAST.DECAY * k);

      if (trueW.typhoon) {
        if (k <= FORECAST.WARN_DAYS) {
          out.push({ offset: k, absDay, date: dateForDay(absDay), am: 'typhoon', pm: 'typhoon', typhoonWarning: true, acc });
        } else {
          // 太遠:藏住颱風,只露出「大雨」
          out.push({ offset: k, absDay, date: dateForDay(absDay), am: 'heavyRain', pm: 'heavyRain', typhoonWarning: false, acc });
        }
        continue;
      }

      const table = seasonTableForDay(absDay);
      const show = (seg, tv) => {
        const u = hash01(seedOf(state), absDay, 'reveal_' + seg);
        return u < acc ? tv : pickAlt(table, tv, hash01(seedOf(state), absDay, 'alt_' + seg));
      };
      out.push({
        offset: k,
        absDay,
        date: dateForDay(absDay),
        am: show('am', trueW.am),
        pm: show('pm', trueW.pm),
        typhoonWarning: false,
        acc,
      });
    }
    return out;
  },

  // 未來 days 天內最近的颱風(供 HUD 警報用);回傳 { offset, date } 或 null。
  nextTyphoonWithin(state, days) {
    for (let k = 1; k <= days; k++) {
      if (this.isTyphoonDay(state, state.day + k)) return { offset: k, date: dateForDay(state.day + k) };
    }
    return null;
  },

  // 該格是否受保護(棚子 或 全域結界生效中)。
  isProtected(state, tileIndex) {
    const t = state.tiles[tileIndex];
    return !!(t && t.canopy) || (state.barrierDays || 0) > 0;
  },

  // 換日時套用「剛結束那天(endedDay)」的非作物天氣效果:市場供給衝擊、棚子吹壞、結界天數遞減。
  // 註:作物的自動澆水/生長/颱風農損由 TimeSystem 的田地結算迴圈處理(需要正確的先後順序);
  //     此處在那之後呼叫 —— 棚子/結界都已先保護過今天的作物,才在這裡損耗。
  applyDailyWeather(state, endedDay) {
    const w = this.weatherForDay(state, endedDay);
    if (w.typhoon) {
      // 有棚子的格子有機率被吹壞(這場已保護過,壞的是下次)
      state.tiles.forEach((t, i) => {
        if (t.canopy && hash01(seedOf(state), endedDay, 'canopybreak', i) < WEATHER_FX.CANOPY_BREAK_CHANCE) {
          t.canopy = false;
        }
      });
      // 市場供給衝擊:全作物供給下修 → 藉既有定價公式自然漲價
      if (state.market && state.market.supply) {
        for (const id in state.market.supply) {
          state.market.supply[id] = Math.floor(state.market.supply[id] * WEATHER_FX.TYPHOON_SUPPLY_SHOCK);
        }
      }
    }
    // 結界天數每天遞減(先保護今天、再遞減)
    state.barrierDays = Math.max(0, (state.barrierDays || 0) - 1);
  },
};
