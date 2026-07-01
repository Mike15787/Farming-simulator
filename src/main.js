// Phaser 遊戲初始化 —— 渲染行程入口。
// 流程:讀存檔(沒有就開新局)→ 建立 Phaser.Game → 由 BootScene 決定進入哪個場景。
import { GAME_W, GAME_H, MAP_W, MAP_H, gridToPixel } from './config.js';
import { GameState, createDefaultState, SAVE_VERSION, buildTiles, buildMarket, buildFarmers, buildWeather, idx } from './state/GameState.js';
import { SaveManager } from './state/SaveManager.js';
import { Runtime } from './runtime.js';
import BootScene from './scenes/BootScene.js';
import FarmScene from './scenes/FarmScene.js';
import HouseScene from './scenes/HouseScene.js';
import AreaScene from './scenes/AreaScene.js';
import UIScene from './scenes/UIScene.js';
import ShopScene from './scenes/ShopScene.js';

// 舊存檔遷移:
//   v1→v2:玩家座標由「格子」改為「像素」。
//   v2→v3:加入市場供給與 NPC 農夫(舊檔沒有就補預設)。
//   v3→v4:加入天氣種子與魔法結界天數(舊檔沒有就補預設;tile.canopy 缺值靠讀取端容錯)。
//   v4→v5:農場由 15×15 放大為 20×20 → tiles 長度改變。重建新地圖並把舊田進度(翻土/作物/棚子)
//          複製到相同座標(既有區塊位置不變 → 座標對齊);補森林採集狀態、補市場新物品供給。
// 其餘欄位(inventory/quests)皆相容。
function migrate(s) {
  if (!s || s.version === SAVE_VERSION) return s;
  if (s.player && s.player.x < MAP_W && s.player.y < MAP_H) {
    s.player.x = gridToPixel(s.player.x); // v1→v2
    s.player.y = gridToPixel(s.player.y);
  }
  if (!s.market) s.market = buildMarket(); // v2→v3
  if (!s.farmers) s.farmers = buildFarmers();
  if (!s.weather) s.weather = buildWeather(); // v3→v4
  if (s.barrierDays == null) s.barrierDays = 0;

  // v4→v5:tiles 由舊 15×15 重建為新地圖尺寸,保留既有田地進度。
  const OLD_W = 15;
  const OLD_H = 15;
  if (Array.isArray(s.tiles) && s.tiles.length === OLD_W * OLD_H) {
    const fresh = buildTiles();
    for (let y = 0; y < OLD_H; y++) {
      for (let x = 0; x < OLD_W; x++) {
        const old = s.tiles[y * OLD_W + x];
        const ni = idx(x, y); // 新地圖索引(MAP_W 已是放大後的寬)
        if (old && old.terrain === 'soil' && fresh[ni] && fresh[ni].terrain === 'soil') {
          fresh[ni].tilled = !!old.tilled;
          fresh[ni].crop = old.crop || null;
          fresh[ni].canopy = !!old.canopy;
        }
      }
    }
    s.tiles = fresh;
  }
  // v4→v5:森林採集狀態 + 市場補上新物品(如森林採集物)的供給。
  if (!s.forest) s.forest = { gathered: {} };
  const freshMkt = buildMarket();
  if (!s.market.supply) s.market.supply = freshMkt.supply;
  else for (const id in freshMkt.supply) if (s.market.supply[id] == null) s.market.supply[id] = freshMkt.supply[id];

  s.version = SAVE_VERSION;
  return s;
}

// 啟動時若有存檔則載入(必要時遷移),否則開新局。
const saved = migrate(SaveManager.load());
GameState.data = saved || createDefaultState();

const config = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#1b1b1b',
  pixelArt: true,
  roundPixels: true,
  // 場景陣列順序即渲染疊放順序:UIScene 常駐在 HUD 層,ShopScene(買賣面板)在最後 = 最上層。
  // 城鎮/森林為同一 AreaScene 類別、以不同 key + mapId 註冊(資料驅動)。
  scene: [BootScene, FarmScene, HouseScene, new AreaScene('TownScene', 'town'), new AreaScene('ForestScene', 'forest'), UIScene, ShopScene],
};

// 開發用:掛到 window 方便在 DevTools 主控台檢視/除錯。
window.__GAME = new Phaser.Game(config);
window.__SaveManager = SaveManager; // 想重來可在主控台執行 __SaveManager.clear() 後重整
window.__GameState = GameState; // 在主控台用 __GameState.data 檢視當前狀態
window.__Runtime = Runtime;
