// FarmSystem —— 單格田地的狀態機:翻土 → 播種 → 澆水 → (換日生長) → 收成。
//
// 設計重點:
//  - 每個動作都是一次明確的狀態轉移,輸入「目前格子狀態 + 選取物品」,改變格子並回傳結果。
//  - 作物生長階段(0~3)與「今日是否已澆水」旗標分開記錄:澆水只設旗標,真正的階段推進
//    交給 TimeSystem 在換日時統一處理(事件驅動時間),避免在 update loop 每幀檢查生長。
//  - 為什麼澆水與生長分離:種田的核心節奏是「今天照顧 → 明天看結果」,把即時動作(澆水)
//    與換日結算(生長)解耦,才能正確表達這個節奏。
import { idx, inBounds } from '../state/GameState.js';
import { InventorySystem } from './InventorySystem.js';

export const MAX_STAGE = 3; // 0=種子 1=發芽 2=成長 3=成熟

export const FarmSystem = {
  // 對 (x,y) 格子執行一次互動動作。selected 為玩家當前選取的背包物品(可能為 undefined)。
  // 回傳 { ok, action?, reason? }。ok 為 true 時呼叫端需重繪該區域。
  actOnTile(state, x, y, selected) {
    if (!inBounds(x, y)) return { ok: false };
    const t = state.tiles[idx(x, y)];
    if (!t || t.terrain !== 'soil') return { ok: false };

    // 1) 可耕地未翻土 → 翻土
    if (!t.tilled) {
      t.tilled = true;
      return { ok: true, action: 'till' };
    }

    // 2) 已翻土、無作物 → 播種(需選取種子)
    if (!t.crop) {
      if (selected && typeof selected.id === 'string' && selected.id.endsWith('_seed') && selected.qty > 0) {
        const cropId = selected.id.replace(/_seed$/, '');
        t.crop = { id: cropId, stage: 0, watered: false };
        InventorySystem.removeItem(state, selected.id, 1);
        return { ok: true, action: 'plant' };
      }
      return { ok: false, reason: 'no_seed' };
    }

    // 3) 作物已成熟 → 收成(取得作物,格子回到「翻土」狀態,可再次播種)
    if (t.crop.stage >= MAX_STAGE) {
      InventorySystem.addItem(state, t.crop.id, 1);
      t.crop = null;
      return { ok: true, action: 'harvest' };
    }

    // 4) 作物生長中、今天還沒澆水 → 澆水(只設旗標,生長等換日)
    if (!t.crop.watered) {
      t.crop.watered = true;
      return { ok: true, action: 'water' };
    }

    return { ok: false, reason: 'already_watered' };
  },
};
