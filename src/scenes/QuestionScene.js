import Phaser from 'phaser';
import { playCorrect, playWrong } from '../systems/SfxPlayer.js';
import { addPanelShadow } from '../ui/panelStyle.js';

const COMPARISON_TYPES = ['comparison', 'compare_three', 'compare_numbers'];
const SHAPE_TYPES_FOR_CONTENT = ['shape_match', 'odd_one_out'];

export class QuestionScene extends Phaser.Scene {
  constructor() {
    super('Question');
  }

  init(data) {
    this.question = data.question;
    this.rewardIcon = data.rewardIcon ?? '⚔️';
    this.difficulty = data.difficulty ?? 1;
    this.answered = false;
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
    const panelShadow = addPanelShadow(this, width / 2, height / 2, 420, 280, 6).setScale(0.85);
    const panel = this.add
      .rectangle(width / 2, height / 2, 420, 280, 0x1a1a2e, 1)
      .setStrokeStyle(4, 0xf6e05e)
      .setScale(0.85)
      .setAlpha(0);
    this.tweens.add({ targets: [panel, panelShadow], scale: 1, duration: 180, ease: 'Back.Out' });
    this.tweens.add({ targets: panel, alpha: 1, duration: 180, ease: 'Back.Out' });

    const stars = '★'.repeat(this.difficulty + 1) + '☆'.repeat(2 - this.difficulty);
    this.add
      .text(width / 2 - 190, height / 2 - 125, stars, { fontSize: '14px', color: '#f6e05e', fontFamily: 'sans-serif' })
      .setOrigin(0, 0.5);
    this.add
      .text(width / 2 + 190, height / 2 - 125, this.rewardIcon, { fontSize: '18px' })
      .setOrigin(1, 0.5);

    if (COMPARISON_TYPES.includes(this.question.type)) {
      this.buttons = this.renderComparisonPanels(width, height);
    } else {
      this.renderPrompt(width, height);
      this.buttons = this.renderChoiceRow(width, height);
    }
  }

  renderChoiceRow(width, height) {
    const choices = this.question.choices;
    const wide = choices.length >= 4;
    const spacing = wide ? 100 : 120;
    const buttonWidth = wide ? 70 : 90;
    const totalWidth = spacing * (choices.length - 1);
    const startX = width / 2 - totalWidth / 2;
    const y = height / 2 + 40;

    return choices.map((choice, index) => {
      const x = startX + index * spacing;
      addPanelShadow(this, x, y, buttonWidth, 70, 3);
      const rectangle = this.add
        .rectangle(x, y, buttonWidth, 70, 0x2b2b40)
        .setStrokeStyle(2, 0xffffff)
        .setInteractive({ useHandCursor: true });

      this.renderChoiceContent(x, y, choice);

      rectangle.on('pointerover', () => {
        if (this.answered) return;
        rectangle.setScale(1.08);
      });
      rectangle.on('pointerout', () => {
        rectangle.setScale(1);
      });
      rectangle.on('pointerdown', () => {
        if (this.answered) return;
        this.answered = true;
        this.showResult(choice);
      });

      return { rectangle, choice };
    });
  }

  renderComparisonPanels(width, height) {
    this.add
      .text(width / 2, height / 2 - 100, this.getComparisonHint(), {
        fontSize: '16px',
        color: '#a0aec0',
        fontFamily: 'sans-serif',
      })
      .setOrigin(0.5);

    const choices = this.question.choices;
    const isThreeWay = choices.length === 3;
    const panelWidth = isThreeWay ? 120 : 180;
    const spacing = isThreeWay ? 130 : 220;
    const y = height / 2 + 20;
    const startX = width / 2 - (spacing * (choices.length - 1)) / 2;

    return choices.map((choice, index) => {
      const x = startX + index * spacing;
      addPanelShadow(this, x, y, panelWidth, 130, 4);
      const rectangle = this.add
        .rectangle(x, y, panelWidth, 130, 0x2b2b40)
        .setStrokeStyle(2, 0xffffff)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(x, y, this.getComparisonPanelContent(choice), {
          fontSize: this.question.type === 'compare_numbers' ? '34px' : isThreeWay ? '15px' : '18px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: panelWidth - 16 },
          fontFamily: 'sans-serif',
        })
        .setOrigin(0.5);

      rectangle.on('pointerover', () => {
        if (this.answered) return;
        rectangle.setScale(1.05);
      });
      rectangle.on('pointerout', () => {
        rectangle.setScale(1);
      });
      rectangle.on('pointerdown', () => {
        if (this.answered) return;
        this.answered = true;
        this.showResult(choice);
      });

      return { rectangle, choice };
    });
  }

  getComparisonHint() {
    if (this.question.type === 'compare_numbers') {
      return this.question.askMore ? '더 큰 수를 골라요' : '더 작은 수를 골라요';
    }
    return this.question.askMore ? '더 많은 쪽을 골라요' : '더 적은 쪽을 골라요';
  }

  getComparisonPanelContent(choice) {
    if (this.question.type === 'compare_numbers') {
      return choice.value === 'left' ? String(this.question.leftNumber) : String(this.question.rightNumber);
    }
    if (this.question.type === 'compare_three') {
      return '🍎'.repeat(choice.count);
    }
    const count = choice.value === 'left' ? this.question.leftCount : this.question.rightCount;
    return '🍎'.repeat(count);
  }

  renderPrompt(width, height) {
    const promptY = height / 2 - 100;
    const type = this.question.type;

    if (SHAPE_TYPES_FOR_CONTENT.includes(type)) {
      if (type === 'shape_match') {
        this.add
          .text(width / 2, promptY - 30, '같은 모양을 찾아요', { fontSize: '14px', color: '#a0aec0', fontFamily: 'sans-serif' })
          .setOrigin(0.5);
        this.drawShape(width / 2, promptY + 15, this.question.targetShape, 50, 0xf6e05e);
      } else {
        this.add
          .text(width / 2, promptY, '다른 모양을 찾아요', { fontSize: '16px', color: '#a0aec0', fontFamily: 'sans-serif' })
          .setOrigin(0.5);
      }
    } else if (type === 'equation') {
      this.add
        .text(width / 2, promptY, `${this.question.promptText} = ?`, { fontSize: '36px', color: '#ffffff', fontFamily: 'sans-serif' })
        .setOrigin(0.5);
    } else if (type === 'missing_part') {
      this.add
        .text(width / 2, promptY, `${this.question.total} = ${this.question.knownPart} + ?`, {
          fontSize: '32px',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        })
        .setOrigin(0.5);
    } else if (type === 'number_sequence') {
      const { sequenceStart } = this.question;
      this.add
        .text(width / 2, promptY - 20, '다음에 올 숫자는?', { fontSize: '14px', color: '#a0aec0', fontFamily: 'sans-serif' })
        .setOrigin(0.5);
      this.add
        .text(width / 2, promptY + 20, `${sequenceStart}, ${sequenceStart + 1}, ?`, {
          fontSize: '30px',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        })
        .setOrigin(0.5);
    } else if (type === 'number_to_count') {
      this.add
        .text(width / 2, promptY - 25, '몇 개일까요?', { fontSize: '14px', color: '#a0aec0', fontFamily: 'sans-serif' })
        .setOrigin(0.5);
      this.add
        .text(width / 2, promptY + 20, String(this.question.targetNumber), {
          fontSize: '44px',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
    } else {
      this.add
        .text(width / 2, promptY, '🍎'.repeat(this.question.promptCount), { fontSize: '32px' })
        .setOrigin(0.5);
    }
  }

  renderChoiceContent(x, y, choice) {
    const type = this.question.type;
    if (SHAPE_TYPES_FOR_CONTENT.includes(type)) {
      this.drawShape(x, y, choice.value, 32, 0xffffff);
    } else if (type === 'number_to_count') {
      // 0개는 그릴 사과가 없으므로 숫자 0으로 대신 표시한다.
      const content = choice.value === 0 ? '0' : '🍎'.repeat(choice.value);
      this.add
        .text(x, y, content, {
          fontSize: choice.value === 0 ? '28px' : '14px',
          fontFamily: 'sans-serif',
          align: 'center',
          wordWrap: { width: 60 },
        })
        .setOrigin(0.5);
    } else {
      this.add
        .text(x, y, String(choice.value), { fontSize: '28px', fontFamily: 'sans-serif' })
        .setOrigin(0.5);
    }
  }

  drawShape(x, y, shapeType, size, color) {
    const graphics = this.add.graphics();
    graphics.fillStyle(color, 1);
    if (shapeType === 'circle') {
      graphics.fillCircle(x, y, size / 2);
    } else if (shapeType === 'square') {
      graphics.fillRect(x - size / 2, y - size / 2, size, size);
    } else if (shapeType === 'triangle') {
      graphics.fillTriangle(x, y - size / 2, x - size / 2, y + size / 2, x + size / 2, y + size / 2);
    }
    return graphics;
  }

  showResult(selected) {
    if (selected.isCorrect) {
      playCorrect();
    } else {
      playWrong();
    }

    this.buttons.forEach(({ rectangle, choice }) => {
      rectangle.setScale(1);
      if (choice.isCorrect) {
        rectangle.setStrokeStyle(4, 0x48bb78);
      } else if (choice === selected) {
        rectangle.setStrokeStyle(4, 0xf56565);
      }
    });

    const { width, height } = this.scale;
    const message = selected.isCorrect ? `정답! ${this.rewardIcon} 강화!` : `괜찮아요! ${this.rewardIcon} 조금 강화`;
    const color = selected.isCorrect ? '#48bb78' : '#f6ad55';
    const messageY = COMPARISON_TYPES.includes(this.question.type) ? height / 2 + 110 : height / 2 + 95;
    this.add
      .text(width / 2, messageY, message, { fontSize: '18px', color, fontFamily: 'sans-serif' })
      .setOrigin(0.5);

    this.time.delayedCall(700, () => {
      this.scene.get('Stage').events.emit('question-answered', {
        isCorrect: selected.isCorrect,
      });
    });
  }
}
