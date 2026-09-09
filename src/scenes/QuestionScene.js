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

    this.renderPrompt(width, height);

    const startX = width / 2 - 120;
    this.buttons = this.question.choices.map((choice, index) => {
      const x = startX + index * 120;
      const y = height / 2 + 40;
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

  renderPrompt(width, height) {
    const promptY = height / 2 - 100;
    if (this.question.type === 'shape_match') {
      this.add
        .text(width / 2, promptY - 30, '같은 모양을 찾아요', { fontSize: '14px', color: '#a0aec0', fontFamily: 'sans-serif' })
        .setOrigin(0.5);
      this.drawShape(width / 2, promptY + 15, this.question.targetShape, 50, 0xf6e05e);
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
    this.add
      .text(width / 2, height / 2 + 95, message, { fontSize: '18px', color, fontFamily: 'sans-serif' })
      .setOrigin(0.5);

    this.time.delayedCall(700, () => {
      this.scene.get('Stage').events.emit('question-answered', {
        isCorrect: selected.isCorrect,
      });
    });
  }
}
