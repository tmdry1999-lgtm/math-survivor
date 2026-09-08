import Phaser from 'phaser';
import { saveStageResult } from '../systems/SaveManager.js';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  init(data) {
    this.resultData = data;
  }

  create() {
    const { width, height } = this.scale;
    const { accuracy, totalQuestions, unitId } = this.resultData;

    if (totalQuestions === 0) {
      this.add
        .text(width / 2, height / 2 - 40, '문제를 만나지 못했어요!', { fontSize: '28px', color: '#f6e05e' })
        .setOrigin(0.5);
      this.add
        .text(width / 2, height / 2, '적을 더 많이 처치해보세요', { fontSize: '20px', color: '#ffffff' })
        .setOrigin(0.5);

      const earlyRestartButton = this.add
        .text(width / 2, height / 2 + 60, '다시 하기', { fontSize: '20px', color: '#4fd1c5' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      earlyRestartButton.on('pointerdown', () => {
        this.scene.start('Stage', { unitId });
      });
      return;
    }

    const accuracyPercent = Math.round(accuracy * 100);
    const currencyEarned = Math.round(accuracy * 20);

    this.add
      .text(width / 2, height / 2 - 60, '스테이지 클리어!', { fontSize: '32px', color: '#f6e05e' })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2, `정답률 ${accuracyPercent}%`, { fontSize: '24px', color: '#ffffff' })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 40, `별조각 +${currencyEarned}`, { fontSize: '24px', color: '#ffffff' })
      .setOrigin(0.5);

    const restartButton = this.add
      .text(width / 2, height / 2 + 100, '다시 하기', { fontSize: '20px', color: '#4fd1c5' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    restartButton.on('pointerdown', () => {
      this.scene.start('Stage', { unitId });
    });

    saveStageResult({ unitId, accuracy, currencyEarned });
  }
}
