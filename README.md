# 種田小遊戲 (Farming Simulator MVP)

色塊風格的 2D 種田小遊戲。技術棧 **Electron + Phaser.js 3**,美術全用色塊/幾何圖形,零外部素材、零 AI 運算,低算力筆電也能流暢運行。

## 安裝與執行

```bash
npm install      # 安裝 electron 與 phaser
npm start        # 啟動遊戲
```

## 操作方式

| 按鍵 | 動作 |
|------|------|
| 方向鍵 / WASD | 移動(會記錄面向) |
| 空白鍵 / E | 互動(翻土→播種→澆水→收成、跟 NPC 對話、進門);對話中為「繼續」 |
| 數字鍵 1–9 | 切換背包選取物品 |

## 核心玩法循環

種田 → 進屋碰床睡覺(換日,作物生長)→ 收成 → 完成 NPC 任務 → 進出房屋。

- **田地狀態機**:可耕地 →(翻土)→ 翻土 →(播種,需選種子)→ 作物 →(澆水)→(睡一覺)→ 生長 → 成熟 →(收成)→ 回到翻土。
- **生長條件**:當天有澆水 **且** 進入下一天,缺一不可(共 4 階段)。
- **任務**:左側紫色 NPC 要 3 顆番茄,交付後給金錢與種子。
- **存檔**:localStorage,睡覺/切場景時自動存檔;重整後接續。

## 程式架構

詳見 `02-程式架構.md`。核心三原則:

1. **資料與表現分離** — 所有狀態集中在 `src/state/GameState.js`(單一真實來源、純資料可 JSON 化),Scene 只「讀狀態→畫色塊」「輸入→改狀態」。
2. **狀態機驅動** — 田地、作物、任務皆用明確狀態列舉。
3. **事件驅動時間** — 不用即時計時器,睡覺才觸發 `TimeSystem` 換日結算。

```
main.js / preload.js / index.html      Electron 外殼(極薄,只開窗 + app:// protocol)
src/
  main.js          Phaser 初始化
  config.js        常數:格子/地圖/顏色/物品/佈局
  runtime.js       非序列化執行期旗標(dialogActive)
  state/           GameState(單一真實來源)、SaveManager(localStorage)
  scenes/          BootScene / FarmScene / HouseScene / UIScene(疊加)
  systems/         FarmSystem / TimeSystem / InventorySystem / QuestSystem / InteractionSystem
  entities/        Player(移動+面向)、NPC(外觀+對話資料)
```

## 重來一局

開啟 DevTools 主控台執行 `__SaveManager.clear()` 後重整視窗即可清檔。

## 未來擴充(非 MVP)

商店與經濟、多作物/多季節、作物枯萎、日夜循環、室內倉庫、多 NPC 與好感度、色塊逐步替換為像素/向量美術。
