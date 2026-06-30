// Phaser 遊戲初始化 —— 渲染行程入口。
// 流程:讀存檔(沒有就開新局)→ 建立 Phaser.Game → 由 BootScene 決定進入哪個場景。
import { GAME_W, GAME_H } from './config.js';
import { GameState, createDefaultState } from './state/GameState.js';
import { SaveManager } from './state/SaveManager.js';
import BootScene from './scenes/BootScene.js';
import FarmScene from './scenes/FarmScene.js';
import HouseScene from './scenes/HouseScene.js';
import UIScene from './scenes/UIScene.js';

// 啟動時若有存檔則載入,否則開新局。
const saved = SaveManager.load();
GameState.data = saved || createDefaultState();

const config = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#1b1b1b',
  pixelArt: true,
  roundPixels: true,
  // 場景陣列順序即渲染疊放順序:UIScene 在最後,永遠畫在最上層。
  scene: [BootScene, FarmScene, HouseScene, UIScene],
};

// 開發用:掛到 window 方便在 DevTools 主控台檢視/除錯。
window.__GAME = new Phaser.Game(config);
window.__SaveManager = SaveManager; // 想重來可在主控台執行 __SaveManager.clear() 後重整
