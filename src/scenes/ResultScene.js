import Phaser from 'phaser';
import { saveStageResult } from '../systems/SaveManager.js';
import { playCoin } from '../systems/SfxPlayer.js';

const TEXT_FONT = 'sans-serif';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  init(data) {
    this.resultData = data;
  }

  create() {
    this.cameras.main.fadeIn(250, 17, 17, 34);
    const { width, height } = this.scale;
    const { accuracy, totalQuestions, unitId } = this.resultData;

    if (totalQuestions === 0) {
      this.add
        .text(width / 2, height / 2 - 40, '문제를 만나지 못했어요!', { fontSize: '28px', color: '#f6e05e', fontFamily: TEXT_FONT })
        .setOrigin(0.5);
      this.add
        .text(width / 2, height / 2, '적을 더 많이 처치해보세요', { fontSize: '20px', color: '#ffffff', fontFamily: TEXT_FONT })
        .setOrigin(0.5);

      this.addButton(width / 2, height / 2 + 60, '다시 하기', '#4fd1c5', () => {
        this.scene.start('Stage', { unitId });
      });
      this.addButton(width / 2, height / 2 + 110, '허브로 돌아가기', '#a0aec0', () => {
        this.scene.start('Hub');
      });
      return;
    }

    const accuracyPercent = Math.round(accuracy * 100);
    const currencyEarned = Math.round(accuracy * 20);

    this.add
      .text(width / 2, height / 2 - 60, '스테이지 클리어!', { fontSize: '32px', color: '#f6e05e', fontFamily: TEXT_FONT })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2, `정답률 ${accuracyPercent}%`, { fontSize: '24px', color: '#ffffff', fontFamily: TEXT_FONT })
      .setOrigin(0.5);

    this.add.image(width / 2 - 45, height / 2 + 40, 'decorCoin').setScale(1.8);
    this.add
      .text(width / 2 - 10, height / 2 + 40, `+${currencyEarned}`, { fontSize: '24px', color: '#ffffff', fontFamily: TEXT_FONT })
      .setOrigin(0, 0.5);

    if (currencyEarned > 0) {
      playCoin();
      this.celebrateWithCoinBurst(width / 2, height / 2 - 60);
    }

    this.addButton(width / 2, height / 2 + 100, '다시 하기', '#4fd1c5', () => {
      this.scene.start('Stage', { unitId });
    });
    this.addButton(width / 2, height / 2 + 150, '허브로 돌아가기', '#a0aec0', () => {
      this.scene.start('Hub');
    });

    saveStageResult({ unitId, accuracy, currencyEarned });
  }

  celebrateWithCoinBurst(x, y) {
    const emitter = this.add.particles(x, y, 'decorCoin', {
      speed: { min: 60, max: 140 },
      angle: { min: 200, max: 340 },
      lifespan: 700,
      scale: { start: 0.8, end: 0 },
      gravityY: 250,
      quantity: 12,
      emitting: false,
    });
    emitter.explode(12);
    this.time.delayedCall(800, () => emitter.destroy());
  }

  addButton(x, y, label, color, onClick) {
    const button = this.add
      .text(x, y, label, { fontSize: '20px', color, fontFamily: TEXT_FONT })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    button.on('pointerover', () => button.setScale(1.08));
    button.on('pointerout', () => button.setScale(1));
    button.on('pointerdown', onClick);
    return button;
  }
}
