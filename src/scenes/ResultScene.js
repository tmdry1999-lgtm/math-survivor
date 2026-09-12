import Phaser from 'phaser';
import { saveStageResult } from '../systems/SaveManager.js';
import { playCoin } from '../systems/SfxPlayer.js';
import { addPanelShadow } from '../ui/panelStyle.js';

const TEXT_FONT = 'sans-serif';

// 스테이지 제한 시간이 끝난 뒤 보여주는 결과 화면입니다.
// 정답률과 그에 따라 얻은 코인을 보여주고, 결과를 저장한 뒤 "다시 하기"나
// "허브로 돌아가기"를 선택할 수 있게 합니다.
export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  // StageScene이 넘겨준 결과(정답률, 문제 수, 단원 id)를 저장한다.
  init(data) {
    this.resultData = data;
  }

  create() {
    this.cameras.main.fadeIn(250, 17, 17, 34);
    const { width, height } = this.scale;
    const { accuracy, totalQuestions, unitId } = this.resultData;

    // 문제를 한 번도 안 만난 경우(레벨업을 못 함)에는 별도의 안내 화면을 보여준다.
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

    // 이번 결과를 브라우저에 저장해서 다음에 게임을 켜도 코인/진행 상황이 남아있게 한다.
    saveStageResult({ unitId, accuracy, currencyEarned });
  }

  // 코인을 얻었을 때 화면에 코인이 튀어오르는 축하 효과를 보여준다.
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

  // 결과 화면 버튼(그림자+배경+글씨)을 만들어주는 공용 도우미 함수.
  addButton(x, y, label, color, onClick) {
    addPanelShadow(this, x, y, 220, 44, 4);
    const background = this.add
      .rectangle(x, y, 220, 44, 0x1a1a2e)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(color).color)
      .setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontSize: '18px', color, fontFamily: TEXT_FONT }).setOrigin(0.5);

    background.on('pointerover', () => background.setScale(1.05));
    background.on('pointerout', () => background.setScale(1));
    background.on('pointerdown', onClick);
    return background;
  }
}
