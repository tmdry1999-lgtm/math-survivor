import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { HubScene } from './scenes/HubScene.js';
import { StageScene } from './scenes/StageScene.js';
import { QuestionScene } from './scenes/QuestionScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { ResultScene } from './scenes/ResultScene.js';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'app',
  backgroundColor: '#2b2b40',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    // Centering is handled by #app's own flexbox in index.html. Phaser's autoCenter
    // positions the canvas with its own absolute/margin styles, and combining that with
    // a flex-centered parent made the canvas land off-center on some window sizes.
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [BootScene, TitleScene, HubScene, StageScene, QuestionScene, PauseScene, ResultScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
