import Phaser from 'phaser';
import { startBackgroundMusic } from '../systems/SfxPlayer.js';
import { addPanelShadow } from '../ui/panelStyle.js';

const TEXT_FONT = 'sans-serif';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.cameras.main.fadeIn(300, 17, 17, 34);
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x111122);
    this.add.tileSprite(width / 2, height / 2, width, height, 'floor').setAlpha(0.12);

    const hero = this.add.image(width / 2, height / 2 - 160, 'player').setScale(3);
    this.tweens.add({
      targets: hero,
      scaleY: 3 * 0.94,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    const title = this.add
      .text(width / 2, height / 2 - 80, '수학 서바이버', {
        fontSize: '48px',
        color: '#f6e05e',
        fontFamily: TEXT_FONT,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScale(0.9);
    this.tweens.add({
      targets: title,
      scale: 1,
      duration: 500,
      ease: 'Back.Out',
    });

    this.add
      .text(width / 2, height / 2 - 30, '초등 1학년 수학 5개 단원과 함께 모험을 떠나요', {
        fontSize: '15px',
        color: '#a0aec0',
        fontFamily: TEXT_FONT,
      })
      .setOrigin(0.5);

    addPanelShadow(this, width / 2, height / 2 + 60, 220, 60, 5);
    const startButton = this.add
      .rectangle(width / 2, height / 2 + 60, 220, 60, 0x2b2b40)
      .setStrokeStyle(3, 0xf6e05e)
      .setInteractive({ useHandCursor: true });
    const startLabel = this.add
      .text(width / 2, height / 2 + 60, '시작하기', { fontSize: '22px', color: '#f6e05e', fontFamily: TEXT_FONT })
      .setOrigin(0.5);

    this.tweens.add({
      targets: [startButton, startLabel],
      scale: { from: 1, to: 1.04 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    startButton.on('pointerdown', () => {
      startBackgroundMusic();
      this.scene.start('Hub');
    });
  }
}
