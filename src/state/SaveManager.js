// SaveManager —— 把 GameState 寫入 / 讀出 localStorage。
//
// 因為 GameState 已設計為純資料,存讀檔不需要任何特殊轉換邏輯——
// 這是「狀態與表現分離」設計帶來的直接好處。
// 觸發點:TimeSystem 換日後、場景切換前都會呼叫 save(),確保進度不丟。
const KEY = 'farm-game-save';

export const SaveManager = {
  save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('[SaveManager] 存檔失敗:', err);
    }
  },

  // 讀檔:若不存在或解析失敗則回傳 null(由呼叫端決定改用預設初始狀態)。
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('[SaveManager] 讀檔失敗,將開新局:', err);
      return null;
    }
  },

  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch (err) {
      /* ignore */
    }
  },
};
