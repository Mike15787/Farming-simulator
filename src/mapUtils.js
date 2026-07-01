// mapUtils —— 多地圖共用的小工具:捲動相機設定、通道關口偵測與切換。
//
// 設計重點:FarmScene 與 AreaScene(城鎮/森林)都用同一套相機/切換邏輯,避免重複。
//  - 相機:視口只佔上方地圖區(VIEW_W×VIEW_H),邊界為整個地圖世界,跟隨玩家捲動。
//  - 通道切換沿用「先寫 GameState(玩家像素落點 + currentScene)→ 存檔 → scene.start」的既有作法。
import { VIEW_W, VIEW_H, TILE, PORTALS, SCENE_KEY, gridToPixel } from './config.js';
import { GameState } from './state/GameState.js';
import { SaveManager } from './state/SaveManager.js';
import { Runtime } from './runtime.js';

// 設定主相機為「視口固定於上方、邊界為世界、跟隨 target」。
export function setupWorldCamera(scene, worldW, worldH, target) {
  const cam = scene.cameras.main;
  cam.setViewport(0, 0, VIEW_W, VIEW_H); // 只佔地圖區(底部 80px 讓 UIScene 蓋)
  cam.setBounds(0, 0, worldW, worldH);
  cam.startFollow(target, true, 0.12, 0.12);
}

// 查 (tx,ty) 是否為 mapId 的通道關口;回傳 portal 定義或 null。
export function portalAt(mapId, tx, ty) {
  const list = PORTALS[mapId];
  if (!list) return null;
  return list.find((p) => p.x === tx && p.y === ty) || null;
}

// 執行地圖切換:玩家落在目的地圖的 dest 格(像素中心),換場景。
export function transitionTo(scene, toMap, dest) {
  GameState.data.player = { x: gridToPixel(dest.x), y: gridToPixel(dest.y), facing: 'down' };
  GameState.data.currentScene = toMap;
  Runtime.actionEnabled = false;
  SaveManager.save(GameState.data);
  scene.scene.start(SCENE_KEY[toMap] || 'FarmScene');
}

// 供繪圖/命中判定:格中心像素。
export function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}
