import Phaser from 'phaser';
import { getSave } from '../systems/SaveManager.js';

const UNIT_LABELS = {
  nums_within_9: '9까지의 수',
};

const TEXT_FONT = 'sans-serif';

export class HubScene extends Phaser.Scene {
  constructor() {
    super('Hub');
  }

  create() {
    const { width, height } = this.scale;
    const save = getSave();
    const unitId = save.unlockedStages[0] ?? 'nums_within_9';
    const progress = save.stageProgress[unitId];

    this.add.rectangle(width / 2, height / 2, width, height, 0x111122);

    this.add
      .text(width / 2, 60, '나의 작은 방', { fontSize: '30px', color: '#f6e05e', fontFamily: TEXT_FONT })
      .setOrigin(0.5);

    this.add
      .rectangle(width - 90, 40, 140, 44, 0x1a1a2e)
      .setStrokeStyle(2, 0xf6e05e);
    this.add
      .text(width - 90, 40, `⭐ ${save.currency}`, { fontSize: '18px', color: '#ffffff', fontFamily: TEXT_FONT })
      .setOrigin(0.5);

    const cardX = width / 2;
    const cardY = height / 2 + 20;

    this.add
      .rectangle(cardX, cardY, 320, 220, 0x1a1a2e)
      .setStrokeStyle(3, 0x4fd1c5);

    this.add
      .text(cardX, cardY - 70, UNIT_LABELS[unitId] ?? unitId, {
        fontSize: '22px',
        color: '#ffffff',
        fontFamily: TEXT_FONT,
      })
      .setOrigin(0.5);

    const statusText = progress
      ? `최고 정답률 ${Math.round(progress.bestAccuracy * 100)}%  ·  ${progress.attempts}회 도전`
      : '아직 도전하지 않았어요';
    this.add
      .text(cardX, cardY - 30, statusText, { fontSize: '14px', color: '#a0aec0', fontFamily: TEXT_FONT })
      .setOrigin(0.5);

    const startButton = this.add
      .rectangle(cardX, cardY + 50, 220, 60, 0x2b2b40)
      .setStrokeStyle(2, 0xf6e05e)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(cardX, cardY + 50, '모험 떠나기', { fontSize: '20px', color: '#f6e05e', fontFamily: TEXT_FONT })
      .setOrigin(0.5);

    startButton.on('pointerdown', () => {
      this.scene.start('Stage', { unitId });
    });
  }
}
