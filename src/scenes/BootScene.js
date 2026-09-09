import Phaser from 'phaser';
import playerUrl from '../assets/sprites/player.png';
import enemySlimeUrl from '../assets/sprites/enemy-slime.png';
import enemyGhostUrl from '../assets/sprites/enemy-ghost.png';
import enemyOrcUrl from '../assets/sprites/enemy-orc.png';
import floorUrl from '../assets/sprites/floor.png';
import wallUrl from '../assets/sprites/wall.png';
import decorCoinUrl from '../assets/sprites/decor-coin.png';
import decorRubbleUrl from '../assets/sprites/decor-rubble.png';
import decorTorchUrl from '../assets/sprites/decor-torch.png';
import decorChestUrl from '../assets/sprites/decor-chest.png';
import decorDresserUrl from '../assets/sprites/decor-dresser.png';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.image('player', playerUrl);
    this.load.image('enemySlime', enemySlimeUrl);
    this.load.image('enemyGhost', enemyGhostUrl);
    this.load.image('enemyOrc', enemyOrcUrl);
    this.load.image('floor', floorUrl);
    this.load.image('wall', wallUrl);
    this.load.image('decorCoin', decorCoinUrl);
    this.load.image('decorRubble', decorRubbleUrl);
    this.load.image('decorTorch', decorTorchUrl);
    this.load.image('decorChest', decorChestUrl);
    this.load.image('decorDresser', decorDresserUrl);
  }

  create() {
    // Reserved for a future pickup-orb mechanic; also reused as the hit-particle texture in StageScene.
    this.createCircleTexture('xpOrb', 6, 0xf6e05e);
    this.scene.start('Title');
  }

  createCircleTexture(key, radius, color) {
    const graphics = this.add.graphics();
    graphics.fillStyle(color, 1);
    graphics.fillCircle(radius, radius, radius);
    graphics.generateTexture(key, radius * 2, radius * 2);
    graphics.destroy();
  }
}
