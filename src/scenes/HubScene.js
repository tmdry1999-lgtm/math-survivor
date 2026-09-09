import Phaser from 'phaser';
import { getSave, purchaseCosmetic, equipCosmetic } from '../systems/SaveManager.js';
import { COSMETIC_CATALOG, DEFAULT_COSMETIC_ID } from '../data/cosmetics.js';

const UNIT_LABELS = {
  nums_within_9: '9까지의 수',
};

const TEXT_FONT = 'sans-serif';

export class HubScene extends Phaser.Scene {
  constructor() {
    super('Hub');
  }

  create() {
    this.cameras.main.fadeIn(250, 17, 17, 34);
    const { width, height } = this.scale;
    const save = getSave();
    const unitId = save.unlockedStages[0] ?? 'nums_within_9';
    const progress = save.stageProgress[unitId];

    this.add.rectangle(width / 2, height / 2, width, height, 0x111122);

    this.add
      .text(width / 2, 50, '나의 작은 방', { fontSize: '28px', color: '#f6e05e', fontFamily: TEXT_FONT })
      .setOrigin(0.5);

    this.add
      .rectangle(width - 90, 40, 140, 44, 0x1a1a2e)
      .setStrokeStyle(2, 0xf6e05e);
    this.currencyText = this.add
      .text(width - 90, 40, `⭐ ${save.currency}`, { fontSize: '18px', color: '#ffffff', fontFamily: TEXT_FONT })
      .setOrigin(0.5);

    const cardX = width / 2;
    const cardY = 250;

    this.add
      .rectangle(cardX, cardY, 320, 190, 0x1a1a2e)
      .setStrokeStyle(3, 0x4fd1c5);

    this.add
      .text(cardX, cardY - 60, UNIT_LABELS[unitId] ?? unitId, {
        fontSize: '22px',
        color: '#ffffff',
        fontFamily: TEXT_FONT,
      })
      .setOrigin(0.5);

    const statusText = progress
      ? `최고 정답률 ${Math.round(progress.bestAccuracy * 100)}%  ·  ${progress.attempts}회 도전`
      : '아직 도전하지 않았어요';
    this.add
      .text(cardX, cardY - 25, statusText, { fontSize: '14px', color: '#a0aec0', fontFamily: TEXT_FONT })
      .setOrigin(0.5);

    const startButton = this.add
      .rectangle(cardX, cardY + 45, 220, 55, 0x2b2b40)
      .setStrokeStyle(2, 0xf6e05e)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(cardX, cardY + 45, '모험 떠나기', { fontSize: '20px', color: '#f6e05e', fontFamily: TEXT_FONT })
      .setOrigin(0.5);

    startButton.on('pointerover', () => startButton.setScale(1.05));
    startButton.on('pointerout', () => startButton.setScale(1));
    startButton.on('pointerdown', () => {
      this.scene.start('Stage', { unitId });
    });

    this.buildCosmeticShop(cardX, 460, save);
  }

  buildCosmeticShop(centerX, y, initialSave) {
    this.add
      .text(centerX, y - 45, '꾸미기', { fontSize: '18px', color: '#ffffff', fontFamily: TEXT_FONT })
      .setOrigin(0.5);

    const spacing = 90;
    const startX = centerX - spacing;

    this.cosmeticSwatches = COSMETIC_CATALOG.map((item, index) => {
      const x = startX + index * spacing;
      const swatch = this.add
        .rectangle(x, y, 56, 56, item.color)
        .setInteractive({ useHandCursor: true });
      const ring = this.add.rectangle(x, y, 62, 62).setStrokeStyle(3, 0xf6e05e).setVisible(false);
      const label = this.add
        .text(x, y + 40, item.cost === 0 ? '기본' : `⭐ ${item.cost}`, {
          fontSize: '13px',
          color: '#a0aec0',
          fontFamily: TEXT_FONT,
        })
        .setOrigin(0.5);

      swatch.on('pointerover', () => swatch.setScale(1.08));
      swatch.on('pointerout', () => swatch.setScale(1));
      swatch.on('pointerdown', () => this.handleCosmeticClick(item));

      return { item, ring, label };
    });

    this.refreshCosmeticShop(initialSave);
  }

  handleCosmeticClick(item) {
    const save = getSave();
    // 무료 항목(cost 0)도 처음 클릭 시 purchaseCosmetic을 거쳐 ownedCosmetics에 기록되어야
    // 다음부터 equipCosmetic으로 다시 선택할 수 있다.
    const owned = save.ownedCosmetics.includes(item.id);
    const updatedSave = owned ? equipCosmetic(item.id) : purchaseCosmetic(item.id, item.cost);
    this.refreshCosmeticShop(updatedSave);
  }

  refreshCosmeticShop(save) {
    const equippedId = save.equippedCosmetics.playerColor ?? DEFAULT_COSMETIC_ID;
    this.cosmeticSwatches.forEach(({ item, ring, label }) => {
      ring.setVisible(item.id === equippedId);
      const owned = item.cost === 0 || save.ownedCosmetics.includes(item.id);
      label.setText(item.cost === 0 ? '기본' : owned ? '보유' : `⭐ ${item.cost}`);
    });
    if (this.currencyText) {
      this.currencyText.setText(`⭐ ${save.currency}`);
    }
  }
}
