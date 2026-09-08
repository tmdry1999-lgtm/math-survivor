import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { HubScene } from './scenes/HubScene.js';
import { StageScene } from './scenes/StageScene.js';
import { QuestionScene } from './scenes/QuestionScene.js';
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
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [BootScene, HubScene, StageScene, QuestionScene, ResultScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
