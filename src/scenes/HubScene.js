import Phaser from 'phaser';
import { getSave, purchaseCosmetic, equipCosmetic } from '../systems/SaveManager.js';
import { COSMETIC_CATALOG, DEFAULT_COSMETIC_ID } from '../data/cosmetics.js';
import { UNIT_SEQUENCE, UNIT_LABELS } from '../data/units.js';
import { isMuted, setMuted, startBackgroundMusic, stopBackgroundMusic } from '../systems/SfxPlayer.js';
import { addPanelShadow } from '../ui/panelStyle.js';

const TEXT_FONT = 'sans-serif';
// 순차 잠금 대신 모든 단원을 처음부터 열어두기로 한 제품 결정.
// 다시 순차 잠금으로 되돌리려면 이 값을 false로 바꾸면 된다
// (SaveManager는 여전히 unlockedStages를 기록하므로 언제든 복원 가능).
const ALL_STAGES_UNLOCKED = true;
const STAGE_GRID_COLS = 3;

// "나의 작은 방"이라고 불리는 시작 기지 화면입니다.
// 여기서 도전할 단원(스테이지)을 고르거나, 모은 코인으로 캐릭터 색을 바꾸는
// 꾸미기 상점을 이용할 수 있습니다. 화면 상단에는 보유 코인이 표시됩니다.
export class HubScene extends Phaser.Scene {
  constructor() {
    super('Hub');
  }

  create() {
    this.cameras.main.fadeIn(250, 17, 17, 34);
    const { width, height } = this.scale;
    const save = getSave();

    this.add.rectangle(width / 2, height / 2, width, height, 0x111122);
    this.add.tileSprite(width / 2, height / 2, width, height, 'floor').setAlpha(0.12);
    this.buildRoomDecor(width, height);

    this.add.image(width / 2 - 110, 38, 'decorTorch').setScale(1.6).setAlpha(0.9);
    this.add.image(width / 2 + 110, 38, 'decorTorch').setScale(1.6).setAlpha(0.9);
    this.add
      .text(width / 2, 40, '나의 작은 방', { fontSize: '26px', color: '#f6e05e', fontFamily: TEXT_FONT })
      .setOrigin(0.5);

    addPanelShadow(this, width - 90, 32, 140, 40, 3);
    this.add
      .rectangle(width - 90, 32, 140, 40, 0x1a1a2e)
      .setStrokeStyle(2, 0xf6e05e);
    this.add.image(width - 145, 32, 'decorCoin').setScale(1.4);
    this.currencyText = this.add
      .text(width - 125, 32, `${save.currency}`, { fontSize: '16px', color: '#ffffff', fontFamily: TEXT_FONT })
      .setOrigin(0, 0.5);

    this.buildMuteButton(50, 32);
    this.buildStageList(width, 130, save);
    this.buildCosmeticShop(width / 2, 435, save);
  }

  // 방 구석에 상자/서랍장 같은 배경 장식을 배치해 room 느낌을 낸다 (게임 진행에는 영향 없음).
  buildRoomDecor(width, height) {
    this.add.image(50, height - 50, 'decorChest').setScale(2.2).setAlpha(0.35).setDepth(-1);
    this.add.image(width - 50, height - 50, 'decorDresser').setScale(2.2).setAlpha(0.35).setDepth(-1);
  }

  // 소리 켜기/끄기 버튼. 누를 때마다 스피커 아이콘이 🔊 ↔ 🔇로 바뀐다.
  buildMuteButton(x, y) {
    addPanelShadow(this, x, y, 44, 40, 3);
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

  // 도전 가능한 단원들을 카드 형태로 격자(가로 3칸)에 나열한다.
  // 각 카드에는 단원 이름, 이전 최고 정답률(또는 잠금 표시), "도전하기" 버튼이 들어간다.
  buildStageList(width, topY, save) {
    const cardWidth = 210;
    const cardHeight = 140;
    const colGap = 16;
    const rowGap = 16;

    UNIT_SEQUENCE.forEach((unitId, index) => {
      const row = Math.floor(index / STAGE_GRID_COLS);
      const col = index % STAGE_GRID_COLS;
      const itemsInRow = Math.min(STAGE_GRID_COLS, UNIT_SEQUENCE.length - row * STAGE_GRID_COLS);
      const rowWidth = itemsInRow * cardWidth + (itemsInRow - 1) * colGap;
      const rowStartX = width / 2 - rowWidth / 2 + cardWidth / 2;
      const x = rowStartX + col * (cardWidth + colGap);
      const y = topY + row * (cardHeight + rowGap);

      const unlocked = ALL_STAGES_UNLOCKED || save.unlockedStages.includes(unitId);
      const progress = save.stageProgress[unitId];

      if (unlocked) {
        addPanelShadow(this, x, y, cardWidth, cardHeight);
      }
      this.add
        .rectangle(x, y, cardWidth, cardHeight, unlocked ? 0x1a1a2e : 0x14141f)
        .setStrokeStyle(3, unlocked ? 0x4fd1c5 : 0x2a2a38);

      this.add
        .text(x, y - 48, UNIT_LABELS[unitId] ?? unitId, {
          fontSize: '15px',
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
        .text(x, y - 18, statusText, {
          fontSize: '11px',
          color: unlocked ? '#a0aec0' : '#444455',
          fontFamily: TEXT_FONT,
        })
        .setOrigin(0.5);

      if (!unlocked) {
        return;
      }

      addPanelShadow(this, x, y + 42, cardWidth - 30, 36, 3);
      const startButton = this.add
        .rectangle(x, y + 42, cardWidth - 30, 36, 0x2b2b40)
        .setStrokeStyle(2, 0xf6e05e)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(x, y + 42, '도전하기', { fontSize: '15px', color: '#f6e05e', fontFamily: TEXT_FONT })
        .setOrigin(0.5);

      startButton.on('pointerover', () => startButton.setScale(1.05));
      startButton.on('pointerout', () => startButton.setScale(1));
      startButton.on('pointerdown', () => {
        this.scene.start('Stage', { unitId });
      });
    });
  }

  // 캐릭터 색을 바꿔주는 "꾸미기" 상점. 색상 조각을 클릭하면 코인으로 구매하거나
  // 이미 산 색이면 바로 착용한다.
  buildCosmeticShop(centerX, y, initialSave) {
    this.add
      .text(centerX, y - 45, '꾸미기', { fontSize: '18px', color: '#ffffff', fontFamily: TEXT_FONT })
      .setOrigin(0.5);

    const spacing = 90;
    const startX = centerX - spacing;

    this.cosmeticSwatches = COSMETIC_CATALOG.map((item, index) => {
      const x = startX + index * spacing;
      addPanelShadow(this, x, y, 56, 56, 3);
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

  // 현재 착용 중인 색에 금색 테두리를 표시하고, 각 색상 조각의 안내 문구
  // ("기본" / "보유" / "가격")를 저장 데이터에 맞게 다시 그려준다.
  refreshCosmeticShop(save) {
    const equippedId = save.equippedCosmetics.playerColor ?? DEFAULT_COSMETIC_ID;
    this.cosmeticSwatches.forEach(({ item, ring, label }) => {
      ring.setVisible(item.id === equippedId);
      const owned = item.cost === 0 || save.ownedCosmetics.includes(item.id);
      label.setText(item.cost === 0 ? '기본' : owned ? '보유' : `⭐ ${item.cost}`);
    });
    if (this.currencyText) {
      this.currencyText.setText(`${save.currency}`);
    }
  }
}
