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
  // 角色 / 建物
  player: 0x1e88e5,
  playerNose: 0xffeb3b,
  npc: 0x8e24aa,
  shop: 0x5c6bc0, // 商店色塊
  market: 0x26a69a, // 市場色塊
  rank: 0xb8860b, // 排行榜公佈欄色塊(暗金)
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
export const SHOP_POS = { x: 13, y: 7 }; // 商店色塊(買種子)
export const MARKET_POS = { x: 13, y: 11 }; // 市場色塊(賣作物)

// 物品定義:名稱與色塊顏色。種子 id 以 '_seed' 結尾,對應作物 id 去掉後綴。
//   buy   : 在商店的購買單價(只有種子有)。
//   sell  : 市場「基準價」base(只有作物有,且 >0 才可賣);實際成交價由 MarketSystem 依供需動態浮動。
//   demand: 市場每日需求量(只有作物有);供給超過需求時價格下跌。需求大 → 價格較穩。
//   color : 背包/商店色塊;作物的 color 同時當成果實顏色。
export const ITEMS = {
  // 種子(商店販售)
  tomato_seed: { name: '番茄種子', color: 0xc0ca33, buy: 15 },
  carrot_seed: { name: '胡蘿蔔種子', color: 0xffb74d, buy: 20 },
  potato_seed: { name: '馬鈴薯種子', color: 0xbcaaa4, buy: 18 },
  corn_seed: { name: '玉米種子', color: 0xfff176, buy: 25 },
  pumpkin_seed: { name: '南瓜種子', color: 0xffab40, buy: 40 },
  cabbage_seed: { name: '高麗菜種子', color: 0xc5e1a5, buy: 22 },
  // 作物(市場收購):sell=基準價,demand=每日需求量
  tomato: { name: '番茄', color: 0xe53935, sell: 30, demand: 12 },
  carrot: { name: '胡蘿蔔', color: 0xfb8c00, sell: 38, demand: 10 },
  potato: { name: '馬鈴薯', color: 0xd7b26b, sell: 34, demand: 12 },
  corn: { name: '玉米', color: 0xfdd835, sell: 55, demand: 8 },
  pumpkin: { name: '南瓜', color: 0xef6c00, sell: 95, demand: 5 },
  cabbage: { name: '高麗菜', color: 0x66bb6a, sell: 45, demand: 9 },
};

// 商店上架的種子(新增的 5 種蔬菜)。
export const SHOP_STOCK = ['carrot_seed', 'potato_seed', 'corn_seed', 'pumpkin_seed', 'cabbage_seed'];

// 市場供需定價參數。price = base*(1+factor),factor = clamp(-K*(supply/demand - 1), -MAX_DROP, +MAX_RISE)。
//   K        : 敏感度(供需偏離 1 時 factor 變化幅度)
//   MAX_RISE : 漲幅上限(稀缺時最高 = base*(1+MAX_RISE))
//   MAX_DROP : 跌幅上限(供過於求時最低 = base*(1-MAX_DROP),即價格地板)
//   SUPPLY_CAP_MULT : 庫存上限 = demand*此倍數(避免供給無限累積、回升過久)
export const MARKET = { K: 0.5, MAX_RISE: 0.4, MAX_DROP: 0.6, SUPPLY_CAP_MULT: 4 };

// NPC 農夫定義(模擬農場)。各自有固定種植流程 routine(作物 id 循環),每 growDays 天收成 yield 個,
// 產出灌入市場供給並換成自己的財富(排行榜)。farmer 本人以彩色方塊站在 pos(草地格,可對話看狀態)。
export const FARMER_DEFS = [
  { id: 'wang', name: '老王', color: 0xef9a9a, pos: { x: 1, y: 6 }, routine: ['carrot', 'cabbage'], growDays: 3, yield: 6 },
  { id: 'mei', name: '阿美', color: 0xb39ddb, pos: { x: 1, y: 9 }, routine: ['corn', 'tomato'], growDays: 4, yield: 5 },
  { id: 'xiong', name: '大雄', color: 0x80cbc4, pos: { x: 13, y: 3 }, routine: ['potato', 'pumpkin'], growDays: 5, yield: 4 },
];

export const RANK_POS = { x: 11, y: 2 }; // 排行榜公佈欄色塊
