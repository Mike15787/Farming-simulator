// Phaser 遊戲初始化 —— 渲染行程入口。
// 流程:讀存檔(沒有就開新局)→ 建立 Phaser.Game → 由 BootScene 決定進入哪個場景。
import { GAME_W, GAME_H, MAP_W, MAP_H, gridToPixel } from './config.js';
import { GameState, createDefaultState, SAVE_VERSION, buildMarket, buildFarmers } from './state/GameState.js';
import { SaveManager } from './state/SaveManager.js';
import { Runtime } from './runtime.js';
import BootScene from './scenes/BootScene.js';
import FarmScene from './scenes/FarmScene.js';
import HouseScene from './scenes/HouseScene.js';
import UIScene from './scenes/UIScene.js';
import ShopScene from './scenes/ShopScene.js';

// 舊存檔遷移:
//   v1→v2:玩家座標由「格子」改為「像素」。
//   v2→v3:加入市場供給與 NPC 農夫(舊檔沒有就補預設)。
// 其餘欄位(tiles/inventory/quests)皆相容。
function migrate(s) {
  if (!s || s.version === SAVE_VERSION) return s;
  if (s.player && s.player.x < MAP_W && s.player.y < MAP_H) {
    s.player.x = gridToPixel(s.player.x); // v1→v2
    s.player.y = gridToPixel(s.player.y);
  }
  if (!s.market) s.market = buildMarket(); // v2→v3
  if (!s.farmers) s.farmers = buildFarmers();
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
  scene: [BootScene, FarmScene, HouseScene, UIScene, ShopScene],
};

// 開發用:掛到 window 方便在 DevTools 主控台檢視/除錯。
window.__GAME = new Phaser.Game(config);
window.__SaveManager = SaveManager; // 想重來可在主控台執行 __SaveManager.clear() 後重整
window.__GameState = GameState; // 在主控台用 __GameState.data 檢視當前狀態
window.__Runtime = Runtime;
