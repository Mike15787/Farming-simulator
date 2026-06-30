// GameState —— 整個遊戲的單一真實來源(single source of truth)。
//
// 設計重點:
//  - 純資料、可 JSON 化,不持有任何 Phaser GameObject 參照。渲染物件由各 Scene
//    依狀態當場生成,所以存檔只要序列化這一個物件即可,讀檔也不需特殊轉換。
//  - 田地用一維陣列(index = y * MAP_W + x),格子地圖天生適合索引存取,
//    效能與序列化都單純。
//  - 跨場景共享(背包、天數、田地)都讀同一份 GameState.data。
import { MAP_W, MAP_H, FARM_MAP, CHAR_TERRAIN, PLAYER_START, FARM_RETURN, gridToPixel, ITEMS, FARMER_DEFS } from '../config.js';

export const SAVE_VERSION = 3; // v2:像素座標。v3:加入市場供給與 NPC 農夫。由 main.js 遷移舊檔。

export function idx(x, y) {
  return y * MAP_W + x;
}

export function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
}

// 依 FARM_MAP 建立田地陣列。每格:{ terrain, tilled, crop }
//   terrain: 'grass' | 'soil' | 'water' | 'wall' | 'door'  (靜態地形)
//   tilled : 該 soil 是否已翻土
//   crop   : null 或 { id, stage(0~3), watered }  (作物與「今日是否已澆水」旗標分離記錄)
export function buildTiles() {
  const tiles = [];
  for (let y = 0; y < MAP_H; y++) {
    const row = FARM_MAP[y];
    for (let x = 0; x < MAP_W; x++) {
      const terrain = CHAR_TERRAIN[row[x]] || 'grass';
      tiles.push({ terrain, tilled: false, crop: null });
    }
  }
  return tiles;
}

// 市場供給:每作物初始庫存 = 其需求量(供需平衡 → 起手價 = 基準價)。
export function buildMarket() {
  const supply = {};
  for (const id in ITEMS) {
    if (ITEMS[id].demand) supply[id] = ITEMS[id].demand;
  }
  return { supply };
}

// NPC 農夫的「動態狀態」(靜態定義在 config.FARMER_DEFS;這裡只存會變動的進度與財富)。
export function buildFarmers() {
  return FARMER_DEFS.map((f) => ({ id: f.id, step: 0, daysIntoCrop: 0, money: 0 }));
}

// 開新局的預設狀態。
export function createDefaultState() {
  return {
    version: SAVE_VERSION,
    currentScene: 'farm', // 'farm' | 'house' —— 存檔/讀檔時用來還原玩家所在場景
    // 玩家座標為「農場場景」的像素位置(自由移動)。室內固定從入口進場,不讀此值。
    player: { x: gridToPixel(PLAYER_START.x), y: gridToPixel(PLAYER_START.y), facing: PLAYER_START.facing },
    farmReturn: { x: FARM_RETURN.x, y: FARM_RETURN.y }, // 從室內出來時的落點(格子座標)
    day: 1,
    money: 0,
    tiles: buildTiles(),
    inventory: [{ id: 'tomato_seed', qty: 5 }], // 物品堆疊:同 id 累加數量
    selectedSlot: 0,
    quests: { tomatoQuest: 'not_started' },
    market: buildMarket(), // { supply: { cropId: 數量 } }
    farmers: buildFarmers(), // NPC 農夫動態狀態
  };
}

// 全域可變狀態容器。所有系統讀寫 GameState.data。
export const GameState = {
  data: createDefaultState(),
};
