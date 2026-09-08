import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.createCircleTexture('player', 16, 0x4fd1c5);
    this.createCircleTexture('enemy', 14, 0xf56565);
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
