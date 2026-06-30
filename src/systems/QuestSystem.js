// QuestSystem —— 任務狀態列舉與條件檢查。
//
// 狀態流轉:not_started → in_progress → completed
// 設計重點:NPC 對話時依任務當前狀態決定要說哪段台詞、是否可交付。用狀態查表而非散布的
// 布林值,未來加支線任務不會讓對話邏輯爆炸。交付時呼叫 InventorySystem 檢查/扣除物品。
import { InventorySystem } from './InventorySystem.js';

export const TOMATO_NEED = 3;

export const QuestSystem = {
  // 回傳 { lines: string[], onEnd: fn|null }。
  // onEnd 在對話最後一句結束後由 UIScene 呼叫,用來推進任務狀態 / 發獎勵。
  talk(state) {
    const q = state.quests.tomatoQuest;

    if (q === 'not_started') {
      return {
        lines: [
          '你好,新來的鄰居!',
          '我最近好想吃新鮮番茄……',
          '可以幫我種 ' + TOMATO_NEED + ' 顆番茄送來嗎?',
        ],
        onEnd: () => {
          state.quests.tomatoQuest = 'in_progress';
        },
      };
    }

    if (q === 'in_progress') {
      const have = InventorySystem.countItem(state, 'tomato');
      if (have >= TOMATO_NEED) {
        // 可交付:扣番茄、給金錢與種子、任務完成。
        return {
          lines: ['哇,你真的種出來了!', '太感謝了,這些金幣和種子給你!'],
          onEnd: () => {
            InventorySystem.removeItem(state, 'tomato', TOMATO_NEED);
            state.money += 100;
            InventorySystem.addItem(state, 'tomato_seed', 3);
            state.quests.tomatoQuest = 'completed';
          },
        };
      }
      // 進行中但數量不足
      return {
        lines: [
          '番茄還不夠喔,目前 ' + have + '/' + TOMATO_NEED + ' 顆。',
          '記得翻土、播種、澆水,睡一覺就會長大!',
        ],
        onEnd: null,
      };
    }

    // completed
    return { lines: ['謝謝你之前的番茄!', '最近過得還不錯嗎?'], onEnd: null };
  },
};
