import Phaser from 'phaser';
import { getSave, purchaseCosmetic, equipCosmetic } from '../systems/SaveManager.js';
import { COSMETIC_CATALOG, DEFAULT_COSMETIC_ID } from '../data/cosmetics.js';
import { UNIT_SEQUENCE, UNIT_LABELS } from '../data/units.js';
import { isMuted, setMuted, startBackgroundMusic, stopBackgroundMusic } from '../systems/SfxPlayer.js';

const TEXT_FONT = 'sans-serif';
// 순차 잠금 대신 모든 단원을 처음부터 열어두기로 한 제품 결정.
// 다시 순차 잠금으로 되돌리려면 이 값을 false로 바꾸면 된다
// (SaveManager는 여전히 unlockedStages를 기록하므로 언제든 복원 가능).
const ALL_STAGES_UNLOCKED = true;

export class HubScene extends Phaser.Scene {
  constructor() {
    super('Hub');
  }

  create() {
    this.cameras.main.fadeIn(250, 17, 17, 34);
    const { width, height } = this.scale;
    const save = getSave();

    this.add.rectangle(width / 2, height / 2, width, height, 0x111122);

    this.add
      .text(width / 2, 40, '나의 작은 방', { fontSize: '26px', color: '#f6e05e', fontFamily: TEXT_FONT })
      .setOrigin(0.5);

    this.add
      .rectangle(width - 90, 32, 140, 40, 0x1a1a2e)
      .setStrokeStyle(2, 0xf6e05e);
    this.currencyText = this.add
      .text(width - 90, 32, `⭐ ${save.currency}`, { fontSize: '16px', color: '#ffffff', fontFamily: TEXT_FONT })
      .setOrigin(0.5);

    this.buildMuteButton(50, 32);
    this.buildStageList(width, 155, save);
    this.buildCosmeticShop(width / 2, 420, save);
  }

  buildMuteButton(x, y) {
    const background = this.add
      .rectangle(x, y, 44, 40, 0x1a1a2e)
      .setStrokeStyle(2, 0xf6e05e)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(x, y, isMuted() ? '🔇' : '🔊', { fontSize: '18px' })
      .setOrigin(0.5);

    background.on('pointerover', () => background.setScale(1.05));
    background.on('pointerout', () => background.setScale(1));
    background.on('pointerdown', () => {
      const nextMuted = !isMuted();
      setMuted(nextMuted);
      if (nextMuted) {
        stopBackgroundMusic();
      } else {
        startBackgroundMusic();
      }
      label.setText(nextMuted ? '🔇' : '🔊');
    });
  }

  buildStageList(width, topY, save) {
    const cardWidth = 220;
    const cardHeight = 170;
    const gap = 20;
    const totalWidth = UNIT_SEQUENCE.length * cardWidth + (UNIT_SEQUENCE.length - 1) * gap;
    const startX = width / 2 - totalWidth / 2 + cardWidth / 2;

    UNIT_SEQUENCE.forEach((unitId, index) => {
      const x = startX + index * (cardWidth + gap);
      const unlocked = ALL_STAGES_UNLOCKED || save.unlockedStages.includes(unitId);
      const progress = save.stageProgress[unitId];

      this.add
        .rectangle(x, topY, cardWidth, cardHeight, unlocked ? 0x1a1a2e : 0x14141f)
        .setStrokeStyle(3, unlocked ? 0x4fd1c5 : 0x2a2a38);

      this.add
        .text(x, topY - 55, UNIT_LABELS[unitId] ?? unitId, {
          fontSize: '16px',
          color: unlocked ? '#ffffff' : '#555566',
          fontFamily: TEXT_FONT,
          align: 'center',
          wordWrap: { width: cardWidth - 24 },
        })
        .setOrigin(0.5);

      const statusText = !unlocked
        ? '🔒 잠김'
        : progress
          ? `최고 정답률 ${Math.round(progress.bestAccuracy * 100)}%`
          : '아직 도전하지 않았어요';
      this.add
        .text(x, topY - 15, statusText, {
          fontSize: '12px',
          color: unlocked ? '#a0aec0' : '#444455',
          fontFamily: TEXT_FONT,
        })
        .setOrigin(0.5);

      if (!unlocked) {
        return;
      }

      const startButton = this.add
        .rectangle(x, topY + 55, cardWidth - 30, 44, 0x2b2b40)
        .setStrokeStyle(2, 0xf6e05e)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(x, topY + 55, '도전하기', { fontSize: '16px', color: '#f6e05e', fontFamily: TEXT_FONT })
        .setOrigin(0.5);

      startButton.on('pointerover', () => startButton.setScale(1.05));
      startButton.on('pointerout', () => startButton.setScale(1));
      startButton.on('pointerdown', () => {
        this.scene.start('Stage', { unitId });
      });
    });
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
