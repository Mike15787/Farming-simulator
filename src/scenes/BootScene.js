// BootScene —— 啟動引導。依 GameState(可能來自存檔)決定要進哪個遊戲場景,
// 並把常駐的 UIScene 疊加起來。本身不渲染任何東西,做完就結束。
import { GameState } from '../state/GameState.js';
import { SCENE_KEY } from '../config.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    // currentScene('farm'|'house'|'town'|'forest')→ 場景 key,還原玩家所在地圖。
    const gameplay = SCENE_KEY[GameState.data.currentScene] || 'FarmScene';
    // UIScene 常駐疊加(launch 不會停掉別的場景);遊戲場景用 start(會結束 Boot)。
    this.scene.launch('UIScene');
    this.scene.start(gameplay);
  }
}
