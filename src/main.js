import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { StageScene } from './scenes/StageScene.js';
import { QuestionScene } from './scenes/QuestionScene.js';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'app',
  backgroundColor: '#2b2b40',
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [BootScene, StageScene, QuestionScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
