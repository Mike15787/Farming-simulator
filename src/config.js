// 常數設定 —— 格子大小、地圖、顏色表、物品定義、地圖佈局。
// 全部集中於此,方便調整數值與未來換美術(只要改顏色/尺寸,不動邏輯)。

export const TILE = 32; // 每格像素
export const MAP_W = 15;
export const MAP_H = 15;

export const UI_H = 80; // 底部 UI 列高度
export const GAME_W = MAP_W * TILE; // 480
export const GAME_H = MAP_H * TILE + UI_H; // 560

export const PLAYER_SPEED = 150; // 自由移動速度(像素/秒)
export const PLAYER_HALF = 8; // 玩家碰撞方框半徑(像素)
export const REACH = TILE * 1.8; // 耕作/對話可及距離(像素):動作按鈕只作用於此範圍內最近目標

// 格子座標 → 像素中心
export function gridToPixel(g) {
  return g * TILE + TILE / 2;
}

// 色塊配色(數值為 Phaser 用的 0xRRGGBB)
export const COLORS = {
  // 戶外地形
  grass: 0x7cb342,
  soil: 0xa1887f, // 可耕地(未翻土)
  tilled: 0x8d6e63, // 翻土
  watered: 0x6d4c41, // 濕潤(已澆水)
  water: 0x4fc3f7,
  houseWall: 0x9e9e9e, // 戶外房屋外牆
  door: 0xffa000, // 門
  // 室內
  floor: 0xd7ccc8,
  wallInner: 0x795548,
  bed: 0x3949ab,
  exit: 0xffa000,
  // 角色
  player: 0x1e88e5,
  playerNose: 0xffeb3b,
  npc: 0x8e24aa,
  // 作物
  cropStalk: 0x43a047,
  seedDot: 0x5d4037,
  fruit: 0xe53935,
  // UI
  uiBg: 0x263238,
  uiSlot: 0x37474f,
  uiSlotSel: 0xffb300,
};

// 字元 → 地形類型(供 FARM_MAP 解析)
export const CHAR_TERRAIN = {
  G: 'grass',
  S: 'soil',
  W: 'water',
  H: 'wall',
  D: 'door',
};

// 戶外農場佈局(15×15)。
// G=草地 S=可耕地 W=水域(邊界) H=房屋牆 D=門
export const FARM_MAP = [
  'WWWWWWWWWWWWWWW',
  'GGGGGGGGGGGGGGG',
  'GHHHGGGGGGGGGGG',
  'GHHHGGGGGGGGGGG',
  'GHDHGGGGGGGGGGG',
  'GGGGGGGGGGGGGGG',
  'GGGGGGSSSSSSGGG',
  'GGGGGGSSSSSSGGG',
  'GGGGGGSSSSSSGGG',
  'GGGGGGSSSSSSGGG',
  'GGGGGGSSSSSSGGG',
  'GGGGGGSSSSSSGGG',
  'GGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGG',
  'WWWWWWWWWWWWWWW',
];

// 室內房屋佈局(9×7)。
// #=牆 .=地板 B=床 E=出口門
export const HOUSE_MAP = [
  '#########',
  '#...BB..#',
  '#.......#',
  '#.......#',
  '#.......#',
  '#.......#',
  '####E####',
];

export const NPC_POS = { x: 3, y: 8 }; // NPC 站在農田左側的草地上
export const PLAYER_START = { x: 5, y: 9, facing: 'down' }; // 開新局玩家位置
export const FARM_RETURN = { x: 2, y: 5 }; // 從室內回到戶外時的落點(門口下方)

// 物品定義:名稱與色塊顏色。種子 id 以 '_seed' 結尾,對應作物 id 去掉後綴。
export const ITEMS = {
  tomato_seed: { name: '番茄種子', color: 0xc0ca33 },
  tomato: { name: '番茄', color: 0xe53935 },
};
