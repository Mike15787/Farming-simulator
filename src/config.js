// 常數設定 —— 格子大小、地圖、顏色表、物品定義、地圖佈局。
// 全部集中於此,方便調整數值與未來換美術(只要改顏色/尺寸,不動邏輯)。

export const TILE = 32; // 每格像素

// 視口(相機視窗)尺寸 —— 與「地圖尺寸」解耦。畫布固定這麼大,地圖世界可比它更大(相機捲動)。
export const UI_H = 80; // 底部 UI 列高度
export const VIEW_COLS = 15; // 視口寬(格)
export const VIEW_ROWS = 15; // 視口高(格)
export const VIEW_W = VIEW_COLS * TILE; // 480:地圖區可視寬
export const VIEW_H = VIEW_ROWS * TILE; // 480:地圖區可視高
export const GAME_W = VIEW_W; // 480:畫布寬
export const GAME_H = VIEW_H + UI_H; // 560:畫布高(地圖區 + UI 列)

// 註:農場地圖尺寸 MAP_W / MAP_H 由 FARM_MAP 推導(見下方 FARM_MAP 之後),不再固定 15。

export const PLAYER_SPEED = 150; // 自由移動速度(像素/秒)
export const PLAYER_SPRINT_MULT = 1.8; // 按住 Shift 加速走動的速度倍率
export const PLAYER_HALF = 8; // 玩家碰撞方框半徑(像素)
export const REACH = TILE * 1.8; // 耕作/對話可及距離(像素):動作按鈕只作用於此範圍內最近目標

// 格子座標 → 像素中心
export function gridToPixel(g) {
  return g * TILE + TILE / 2;
}

// ── 日期 / 季節 ───────────────────────────────────────────────
// 遊戲以一個 day 計數器(1 起算)推進時間;真實日期由「起始日 + (day-1) 天」推導,不另存存檔。
export const START_DATE = { year: 827, month: 11, day: 9 }; // day=1 對應的日期
export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // 各月天數(忽略閏年,2 月固定 28)

// day 計數器 → { year, month, day } 真實日期。
export function dateForDay(day) {
  let y = START_DATE.year;
  let m = START_DATE.month; // 1..12
  let d = START_DATE.day + (day - 1);
  while (d > MONTH_DAYS[m - 1]) {
    d -= MONTH_DAYS[m - 1];
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return { year: y, month: m, day: d };
}

// 日期 → 顯示字串「827年11月9日」。
export function formatDate(date) {
  return date.year + '年' + date.month + '月' + date.day + '日';
}

// 季節:每 3 個月一季。冬(11,12,1)/春(2,3,4)/夏(5,6,7)/秋(8,9,10)。回傳季節 id。
export function seasonForMonth(month) {
  if (month === 11 || month === 12 || month === 1) return 'winter';
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  return 'autumn';
}
export const SEASON_NAME = { winter: '冬', spring: '春', summer: '夏', autumn: '秋' };

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
  path: 0xd7c4a1, // 通道格(地圖間往返的關口)
  // 室內
  floor: 0xd7ccc8,
  wallInner: 0x795548,
  bed: 0x3949ab,
  exit: 0xffa000,
  // 城鎮 / 森林 裝飾地形
  townGround: 0xbcaaa4, // 城鎮地面(石板/廣場)
  building: 0x9c6b4f, // 城鎮建物(實心裝飾)
  tree: 0x2e7d32, // 樹(實心裝飾)
  forestFloor: 0x558b2f, // 森林地面(深草)
  // 角色 / 建物
  player: 0x1e88e5,
  playerNose: 0xffeb3b,
  npc: 0x8e24aa,
  shop: 0x5c6bc0, // 商店色塊
  market: 0x26a69a, // 市場色塊
  rank: 0xb8860b, // 排行榜公佈欄色塊(暗金)
  weatherBoard: 0x00acc1, // 天氣預報布告欄色塊(青)
  agency: 0x4527a0, // 勞力仲介所色塊(深紫)
  warehouse: 0x795548, // 倉庫色塊(木棕)
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
  P: 'path', // 通往城鎮的通道關口(可走,觸碰即切換地圖)
};

// 戶外農場佈局(20×20,比一屏 15×15 大 → 相機捲動)。
// G=草地 S=可耕地 W=水域(邊界) H=房屋牆 D=門 P=通道(東往城鎮、西往任務村)
//   保留原 15×15 的既有座標(房屋、中央田、商店/市場/榜/報、農夫、玩家起點皆不變),
//   東側新增田 A(cols15-18,rows6-9)、南側新增田 B(cols6-10,rows15-18),東界 (19,10) 為通道 P,
//   西界 (0,10) 為另一個通道 P(往任務村,見 AREA_MAPS.quests)。
export const FARM_MAP = [
  'WWWWWWWWWWWWWWWWWWWW',
  'WGGGGGGGGGGGGGGGGGGW',
  'WHHHGGGGGGGGGGGGGGGW',
  'WHHHGGGGGGGGGGGGGGGW',
  'WHDHGGGGGGGGGGGGGGGW',
  'WGGGGGGGGGGGGGGGGGGW',
  'WGGGGGSSSSSSGGGSSSSW',
  'WGGGGGSSSSSSGGGSSSSW',
  'WGGGGGSSSSSSGGGSSSSW',
  'WGGGGGSSSSSSGGGSSSSW',
  'PGGGGGSSSSSSGGGGGGGP',
  'WGGGGGSSSSSSGGGGGGGW',
  'WGGGGGGGGGGGGGGGGGGW',
  'WGGGGGGGGGGGGGGGGGGW',
  'WGGGGGGGGGGGGGGGGGGW',
  'WGGGGGSSSSSGGGGGGGGW',
  'WGGGGGSSSSSGGGGGGGGW',
  'WGGGGGSSSSSGGGGGGGGW',
  'WGGGGGSSSSSGGGGGGGGW',
  'WWWWWWWWWWWWWWWWWWWW',
];

// 農場地圖尺寸由 FARM_MAP 推導 —— 放大農場只要改 FARM_MAP,idx()/inBounds()/繪製迴圈自動跟著變。
export const MAP_W = FARM_MAP[0].length;
export const MAP_H = FARM_MAP.length;

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

export const PLAYER_START = { x: 5, y: 9, facing: 'down' }; // 開新局玩家位置
export const FARM_RETURN = { x: 2, y: 5 }; // 從室內回到戶外時的落點(門口下方)
export const SHOP_POS = { x: 13, y: 7 }; // 商店色塊(買種子)
export const MARKET_POS = { x: 13, y: 11 }; // 市場色塊(賣作物)
export const WAREHOUSE_POS = { x: 4, y: 3 }; // 倉庫色塊(房子東側空地,存放收成/種子,唯讀檢視)

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
  // 防災道具:棚子(逐格搭建擋颱風;不是種子,不可播種)
  canopy_kit: { name: '棚子', color: 0x8d6e63, buy: 40 },
  // 作物(市場收購):sell=基準價,demand=每日需求量
  tomato: { name: '番茄', color: 0xe53935, sell: 30, demand: 12 },
  carrot: { name: '胡蘿蔔', color: 0xfb8c00, sell: 38, demand: 10 },
  potato: { name: '馬鈴薯', color: 0xd7b26b, sell: 34, demand: 12 },
  corn: { name: '玉米', color: 0xfdd835, sell: 55, demand: 8 },
  pumpkin: { name: '南瓜', color: 0xef6c00, sell: 95, demand: 5 },
  cabbage: { name: '高麗菜', color: 0x66bb6a, sell: 45, demand: 9 },
  // 森林採集物(非種植,無 _seed;給 sell+demand 使其可在市場販售、接入動態定價)
  berry: { name: '野莓', color: 0xd81b60, sell: 12, demand: 14 },
  mushroom: { name: '蘑菇', color: 0xa1502f, sell: 22, demand: 8 },
};

// 商店上架的商品(新增的 5 種蔬菜種子 + 防災棚子)。
export const SHOP_STOCK = ['carrot_seed', 'potato_seed', 'corn_seed', 'pumpkin_seed', 'cabbage_seed', 'canopy_kit'];

// 可指派給幫工種植的作物 id 清單(需有對應 `_seed` 的作物,排除野莓/蘑菇等森林採集物)。
export function plantableCropIds() {
  return Object.keys(ITEMS).filter((id) => ITEMS[id + '_seed']);
}

// 市場供需定價參數。price = base*(1+factor),factor = clamp(-K*(supply/demand - 1), -MAX_DROP, +MAX_RISE)。
//   K        : 敏感度(供需偏離 1 時 factor 變化幅度)
//   MAX_RISE : 漲幅上限(稀缺時最高 = base*(1+MAX_RISE))
//   MAX_DROP : 跌幅上限(供過於求時最低 = base*(1-MAX_DROP),即價格地板)
//   SUPPLY_CAP_MULT : 庫存上限 = demand*此倍數(避免供給無限累積、回升過久)
//   ELASTICITY : 需求價格彈性。當日消耗量 = demand*(1 - ELASTICITY*factor):
//                價低(factor<0,供過於求)→ 多吃、加速消化庫存;價高(factor>0,稀缺)→ 少吃。
//                0 = 無彈性(每天固定吃 demand);建議 0.5~1.0。
//   DEMAND_NOISE : 每日「市場胃納」的隨機波動幅度(±比例)。價格與消耗量都會乘上這個當日倍數,
//                  讓每天行情有高低。倍數是以 (天數+作物) 為種子的確定性偽隨機 → 同一天固定、免存檔。
export const MARKET = { K: 0.5, MAX_RISE: 0.4, MAX_DROP: 0.6, SUPPLY_CAP_MULT: 4, ELASTICITY: 0.8, DEMAND_NOISE: 0.2 };

// 節慶行事曆:每 FESTIVAL_CYCLE 天循環一次。節慶當天,對應作物的「市場胃納」×mult —— 需求量與
// 成交價同步暴增(適合囤貨後在節慶當天大量賣出)。day 以「循環內第幾天」計(1..FESTIVAL_CYCLE)。
// 全部由天數決定(deterministic),不需存檔、不需 migrate。
export const FESTIVAL_CYCLE = 30;
export const FESTIVALS = [
  { day: 15, crop: 'tomato', name: '番茄節', emoji: '🍅', mult: 3 },
  { day: 25, crop: 'pumpkin', name: '萬聖節', emoji: '🎃', mult: 3 },
];

// 查詢某天的節慶(純函式);回傳節慶定義或 null。
export function festivalFor(day) {
  const d = ((day - 1) % FESTIVAL_CYCLE) + 1; // 對應到循環內第幾天
  return FESTIVALS.find((f) => f.day === d) || null;
}

// ── 天氣 ─────────────────────────────────────────────────────
// 天氣型別登錄表。autoWater=當天自動幫作物澆水;damaging=會造成農損(目前只有颱風)。
//   color 用於 FarmScene 天氣覆蓋層;emoji 用於 HUD / 預報。
export const WEATHER = {
  sunny: { id: 'sunny', name: '晴天', emoji: '☀️', color: 0xfff59d, autoWater: false, damaging: false },
  lightRain: { id: 'lightRain', name: '小雨', emoji: '🌦️', color: 0x90caf9, autoWater: true, damaging: false },
  heavyRain: { id: 'heavyRain', name: '大雨', emoji: '🌧️', color: 0x5c6bc0, autoWater: true, damaging: false },
  snow: { id: 'snow', name: '下雪', emoji: '❄️', color: 0xe1f5fe, autoWater: false, damaging: false },
  typhoon: { id: 'typhoon', name: '颱風', emoji: '🌀', color: 0x455a64, autoWater: true, damaging: true },
};

// 各季節的「一般天氣」加權表(數字為權重,不必加總 100)。颱風不在此表,另由 WEATHER_GEN 疊加。
// 冬:晴/小雨/雪;春秋:晴/小雨/大雨;夏:晴/小雨/大雨(+颱風)。
export const SEASON_WEATHER = {
  winter: { sunny: 50, lightRain: 30, snow: 20 },
  spring: { sunny: 55, lightRain: 30, heavyRain: 15 },
  summer: { sunny: 50, lightRain: 30, heavyRain: 20 },
  autumn: { sunny: 55, lightRain: 30, heavyRain: 15 },
};

// 天氣生成參數。TYPHOON_CHANCE 只在夏季判定;颱風後 TYPHOON_TAIL_DAYS 天為「颱風尾」(強制降雨)。
export const WEATHER_GEN = { TYPHOON_CHANCE: 0.08, TYPHOON_TAIL_DAYS: 2 };

// 天氣預報參數。HORIZON=看幾天;DECAY=每遠一天準確率下降;WARN_DAYS=颱風提前幾天預警。
//   當天準確率=100%,第 k 天 acc = max(0, 1 - DECAY*k);第 14 天 ≈ 30%。
export const FORECAST = { HORIZON: 14, DECAY: 0.05, WARN_DAYS: 7 };

// 天氣效果參數。颱風:未受保護作物掉 STAGE_LOSS 階、市場供給 ×SUPPLY_SHOCK(自然漲價)、
//   棚子有 CANOPY_BREAK_CHANCE 機率被吹壞。
export const WEATHER_FX = { TYPHOON_STAGE_LOSS: 1, TYPHOON_SUPPLY_SHOCK: 0.5, CANOPY_BREAK_CHANCE: 0.25 };

// 魔法結界(全域防颱):施放花費 cost,保護 days 天(期間全農場免疫颱風)。
export const BARRIER = { cost: 300, days: 3 };

// NPC 農夫定義(模擬農場)。各自有固定種植流程 routine(作物 id 循環),每 growDays 天收成 yield 個,
// 產出灌入市場供給並換成自己的財富(排行榜)。farmer 本人以彩色方塊站在 pos(草地格,可對話看狀態)。
export const FARMER_DEFS = [
  { id: 'wang', name: '老王', color: 0xef9a9a, pos: { x: 1, y: 6 }, routine: ['carrot', 'cabbage'], growDays: 3, yield: 6 },
  { id: 'mei', name: '阿美', color: 0xb39ddb, pos: { x: 1, y: 9 }, routine: ['corn', 'tomato'], growDays: 4, yield: 5 },
  { id: 'xiong', name: '大雄', color: 0x80cbc4, pos: { x: 13, y: 3 }, routine: ['potato', 'pumpkin'], growDays: 5, yield: 4 },
];

export const RANK_POS = { x: 11, y: 2 }; // 排行榜公佈欄色塊
export const WEATHER_POS = { x: 13, y: 2 }; // 天氣預報布告欄色塊

// 可雇用的幫工 NPC(城鎮勞力仲介所)。hireCost=雇用一次性費用;wage=每日薪水(換日結算扣款,
// 錢不夠就先欠著、不強制解雇 —— 幫工的收成進玩家背包不是錢,薪水是獨立的錢坑,靠玩家自己賣掉
// 收成變現)。動態狀態(是否已雇用、指派的工作)存在 GameState.workers;這裡只放靜態定義。
export const HIRE_DEFS = [
  { id: 'ah_ji', name: '阿吉', color: 0x4caf50, hireCost: 200, wage: 15 },
  { id: 'xiao_lan', name: '小蘭', color: 0xec407a, hireCost: 350, wage: 25 },
];

// ── 城鎮 / 森林 / 任務村 地圖(資料驅動,由 AreaScene 共用)──────
// 每張:layout=字元格陣列(可大於一屏 → 相機捲動);colors=字元→COLORS 鍵;solid=實心字元集合。
//   城鎮字元:B=建物 .=地面 R=道路 W=水 P=通道關口。 森林/任務村:G=草地 T=樹 W=水 P=通道關口。
// gatherNodes(森林):可採集節點,不進 layout(疊在草地上繪製)。item=產出物品,respawnDays=隔幾天重生。
// buildings(可選):靜態可互動建物點,不進 layout(疊在地面上繪製)。{ id, x, y, kind, label, colorKey }。
// npcs(可選):靜態可對話 NPC,不進 layout(疊在地面上繪製)。{ id, x, y, color, name? };id 對應
//   QuestSystem 的任務 id——GameState.buildQuests() 會依這裡列出的 id 自動產生預設任務狀態,
//   新增一條任務線路只要在這裡加一筆座標 + 在 QuestSystem.HANDLERS 加一個同名 handler。
export const AREA_MAPS = {
  town: {
    name: '城鎮',
    colors: { B: 'building', '.': 'townGround', R: 'path', P: 'path', W: 'water', T: 'tree' },
    solid: 'BWT', // 建物/水/樹不可走;地面/道路/通道可走
    layout: [
      'BBBBBBBBBBBBBBBBBBBB',
      'B..................B',
      'B..BB....RR....BB..B',
      'B..BB....RR....BB..B',
      'B........RR........B',
      'B..RRRRRRRRRRRRRR..B',
      'B..R............R..B',
      'P..R............R..P',
      'B..R............R..B',
      'B..RRRRRRRRRRRRRR..B',
      'B........RR........B',
      'B..BB....RR....BB..B',
      'B..BB....RR....BB..B',
      'B..................B',
      'BBBBBBBBBBBBBBBBBBBB',
    ],
    buildings: [{ id: 'agency', x: 4, y: 4, kind: 'agency', label: '仲', colorKey: 'agency' }],
  },
  forest: {
    name: '森林',
    colors: { G: 'forestFloor', T: 'tree', W: 'water', P: 'path' },
    solid: 'TW', // 樹/水不可走
    layout: [
      'TTTTTTTTTTTTTTTTTT',
      'TGGGGGGGGGGGGGGGGT',
      'TGGGGGTGGGGGGGGGGT',
      'TGGGTTGGGGGGWWGGGT',
      'TGGGGGGGGGGGWWGGGT',
      'TGGGGGGGGGGGGGGGGT',
      'TGGGGGGTTGGGGGGGGT',
      'TGGGGGGTTGGGGGGGGT',
      'PGGGGGGGGGGGGGGGGT',
      'TGGGGGGGGGGGGTTGGT',
      'TGGGGGGGGGGGGTTGGT',
      'TGGGGGTGGGGGGGGGGT',
      'TGGGGTTGGGGGGGGGGT',
      'TGGGGGGGGGGGGGGGGT',
      'TGGGGGGGGGGGGGGGGT',
      'TGGGGGGGGGGGGGGGGT',
      'TGGGGGGGGGGGGGGGGT',
      'TTTTTTTTTTTTTTTTTT',
    ],
    gatherNodes: [
      { x: 10, y: 1, item: 'berry', respawnDays: 2 },
      { x: 14, y: 5, item: 'berry', respawnDays: 2 },
      { x: 8, y: 15, item: 'berry', respawnDays: 2 },
      { x: 3, y: 13, item: 'mushroom', respawnDays: 3 },
      { x: 15, y: 10, item: 'mushroom', respawnDays: 3 },
    ],
  },
  // 任務村:集中放置所有任務 NPC 的小空地,農場西側通道直達,方便測試不同任務線路不必跑遍大地圖。
  quests: {
    name: '任務村',
    colors: { T: 'tree', G: 'grass', P: 'path' },
    solid: 'T',
    layout: [
      'TTTTTTTTTTTTTT',
      'TGGGGGGGGGGGGT',
      'TGGGGGGGGGGGGT',
      'TGGGGGGGGGGGGT',
      'TGGGGGGGGGGGGP',
      'TGGGGGGGGGGGGT',
      'TGGGGGGGGGGGGT',
      'TGGGGGGGGGGGGT',
      'TGGGGGGGGGGGGT',
      'TTTTTTTTTTTTTT',
    ],
    npcs: [{ id: 'tomatoQuest', x: 6, y: 4, color: COLORS.npc }],
  },
};

// 通道關口:走到某地圖的 (x,y) 通道格 → 切到 to 地圖、落在 dest 格(dest 必為非通道格,避免立即彈回)。
// 拓撲:任務村 ⇄ 農場 ⇄ 城鎮 ⇄ 森林(農場東西各一個出口,城鎮是城鎮/森林側的樞紐)。
export const PORTALS = {
  farm: [
    { x: 19, y: 10, to: 'town', dest: { x: 1, y: 7 } },
    { x: 0, y: 10, to: 'quests', dest: { x: 12, y: 4 } },
  ],
  town: [
    { x: 0, y: 7, to: 'farm', dest: { x: 18, y: 10 } },
    { x: 19, y: 7, to: 'forest', dest: { x: 1, y: 8 } },
  ],
  forest: [{ x: 0, y: 8, to: 'town', dest: { x: 18, y: 7 } }],
  quests: [{ x: 13, y: 4, to: 'farm', dest: { x: 1, y: 10 } }],
};

// 地圖 id → 場景 key(BootScene / mapUtils 用)。
export const SCENE_KEY = { farm: 'FarmScene', house: 'HouseScene', town: 'TownScene', forest: 'ForestScene', quests: 'QuestScene' };
