import Phaser from 'phaser';

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
    this.add
      .rectangle(width / 2, height / 2, 420, 280, 0x1a1a2e, 1)
      .setStrokeStyle(4, 0xf6e05e);

    this.add
      .text(width / 2, height / 2 - 100, '🍎'.repeat(this.question.promptCount), {
        fontSize: '32px',
      })
      .setOrigin(0.5);

    const startX = width / 2 - 120;
    this.buttons = this.question.choices.map((choice, index) => {
      const x = startX + index * 120;
      const rectangle = this.add
        .rectangle(x, height / 2 + 40, 90, 70, 0x2b2b40)
        .setStrokeStyle(2, 0xffffff)
        .setInteractive({ useHandCursor: true });

      this.add
        .text(x, height / 2 + 40, String(choice.value), { fontSize: '28px', fontFamily: 'sans-serif' })
        .setOrigin(0.5);

      rectangle.on('pointerdown', () => {
        if (this.answered) return;
        this.answered = true;
        this.showResult(choice);
      });

      return { rectangle, choice };
    });
  }

  showResult(selected) {
    this.buttons.forEach(({ rectangle, choice }) => {
      if (choice.isCorrect) {
        rectangle.setStrokeStyle(4, 0x48bb78);
      } else if (choice === selected) {
        rectangle.setStrokeStyle(4, 0xf56565);
      }
    });

    this.time.delayedCall(600, () => {
      this.scene.get('Stage').events.emit('question-answered', {
        isCorrect: selected.isCorrect,
      });
    });
  }
}
