// 執行期(非序列化)旗標。這些狀態只在當次遊玩有意義,不存進 GameState、不寫存檔。
//  - dialogActive:對話中,讓場景暫停玩家移動、把動作鍵轉為「繼續對話」。
//  - actionLabel / actionEnabled:由 FarmScene 每幀更新,UIScene 的動作按鈕據此顯示
//    要做的事(鋤地/播種/澆水/收割/對話/繼續)與是否可按。
export const Runtime = {
  dialogActive: false,
  shopActive: false, // 商店/市場面板開啟中:讓 FarmScene 暫停、UIScene 不吃點擊
  actionLabel: '耕作',
  actionEnabled: false,
};
