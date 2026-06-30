// 執行期(非序列化)旗標。這些狀態只在當次遊玩有意義,不存進 GameState、不寫存檔。
// 目前用來標記「對話中」,讓場景在對話開啟時暫停玩家移動/世界互動。
export const Runtime = {
  dialogActive: false,
};
