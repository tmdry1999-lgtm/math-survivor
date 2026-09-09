import Phaser from 'phaser';
import { playCorrect, playWrong } from '../systems/SfxPlayer.js';

export class QuestionScene extends Phaser.Scene {
  constructor() {
    super('Question');
  }

  init(data) {
    this.question = data.question;
    this.answered = false;
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
    const panel = this.add
      .rectangle(width / 2, height / 2, 420, 280, 0x1a1a2e, 1)
      .setStrokeStyle(4, 0xf6e05e)
      .setScale(0.85)
      .setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 180, ease: 'Back.Out' });

    if (this.question.type === 'comparison') {
      this.buttons = this.renderComparisonChoices(width, height);
    } else {
      this.renderPrompt(width, height);
      this.buttons = this.renderChoiceRow(width, height);
    }
  }

  renderChoiceRow(width, height) {
    const choices = this.question.choices;
    const spacing = 120;
    const totalWidth = spacing * (choices.length - 1);
    const startX = width / 2 - totalWidth / 2;
    const y = height / 2 + 40;

    return choices.map((choice, index) => {
      const x = startX + index * spacing;
      const rectangle = this.add
        .rectangle(x, y, 90, 70, 0x2b2b40)
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

  renderComparisonChoices(width, height) {
    this.add
      .text(width / 2, height / 2 - 100, '더 많은 쪽을 골라요', { fontSize: '16px', color: '#a0aec0', fontFamily: 'sans-serif' })
      .setOrigin(0.5);

    const y = height / 2 + 20;
    const panelY = 0;
    const sides = [
      { x: width / 2 - 110, count: this.question.leftCount, value: 'left' },
      { x: width / 2 + 110, count: this.question.rightCount, value: 'right' },
    ];

    const buttons = sides.map(({ x, count, value }) => {
      const choice = this.question.choices.find((c) => c.value === value);
      const rectangle = this.add
        .rectangle(x, y + panelY, 180, 130, 0x2b2b40)
        .setStrokeStyle(2, 0xffffff)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(x, y + panelY, '🍎'.repeat(count), {
          fontSize: '18px',
          align: 'center',
          wordWrap: { width: 160 },
        })
        .setOrigin(0.5);

      rectangle.on('pointerover', () => {
        if (this.answered) return;
        rectangle.setScale(1.05);
      });
      rectangle.on('pointerout', () => {
        rectangle.setScale(1);
      });

      return { rectangle, choice };
    });

    buttons.forEach(({ rectangle, choice }) => {
      rectangle.on('pointerdown', () => {
        if (this.answered) return;
        this.answered = true;
        this.showResult(choice);
      });
    });

    return buttons;
  }

  renderPrompt(width, height) {
    const promptY = height / 2 - 100;
    if (this.question.type === 'shape_match') {
      this.add
        .text(width / 2, promptY - 30, '같은 모양을 찾아요', { fontSize: '14px', color: '#a0aec0', fontFamily: 'sans-serif' })
        .setOrigin(0.5);
      this.drawShape(width / 2, promptY + 15, this.question.targetShape, 50, 0xf6e05e);
    } else if (this.question.type === 'equation') {
      this.add
        .text(width / 2, promptY, `${this.question.promptText} = ?`, { fontSize: '36px', color: '#ffffff', fontFamily: 'sans-serif' })
        .setOrigin(0.5);
    } else if (this.question.type === 'number_sequence') {
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
    } else {
      this.add
        .text(width / 2, promptY, '🍎'.repeat(this.question.promptCount), { fontSize: '32px' })
        .setOrigin(0.5);
    }
  }

  renderChoiceContent(x, y, choice) {
    if (this.question.type === 'shape_match') {
      this.drawShape(x, y, choice.value, 32, 0xffffff);
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
    const message = selected.isCorrect ? '정답! 강한 업그레이드 ⚔️' : '괜찮아요! 작은 업그레이드 💪';
    const color = selected.isCorrect ? '#48bb78' : '#f6ad55';
    const messageY = this.question.type === 'comparison' ? height / 2 + 110 : height / 2 + 95;
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
