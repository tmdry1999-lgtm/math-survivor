import Phaser from 'phaser';
import playerUrl from '../assets/sprites/player.png';
import enemyUrl from '../assets/sprites/enemy.png';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.image('player', playerUrl);
    this.load.image('enemy', enemyUrl);
  }

  create() {
    // Reserved for a future pickup-orb mechanic / real pixel-art asset swap; unused for now.
    this.createCircleTexture('xpOrb', 6, 0xf6e05e);
    this.scene.start('Hub');
  }

  createCircleTexture(key, radius, color) {
    const graphics = this.add.graphics();
    graphics.fillStyle(color, 1);
    graphics.fillCircle(radius, radius, radius);
    graphics.generateTexture(key, radius * 2, radius * 2);
    graphics.destroy();
  }
}
