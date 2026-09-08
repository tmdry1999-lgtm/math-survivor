import Phaser from 'phaser';
import { generateCountObjectsQuestion } from '../systems/QuestionEngine.js';

const LEVEL_XP_THRESHOLDS = [5, 10, 16, 23, 31, 40];
const STAGE_DURATION_MS = 60000;
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 600;

export class StageScene extends Phaser.Scene {
  constructor() {
    super('Stage');
  }

  init(data) {
    this.unitId = data.unitId;
    this.xp = 0;
    this.level = 0;
    this.correctAnswers = 0;
    this.totalQuestions = 0;
    this.attackRange = 90;
    this.attackIntervalMs = 700;
    this.isPaused = false;
    this.remainingMs = STAGE_DURATION_MS;
  }

  create() {
    this.player = this.physics.add.sprite(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 'player');
    this.player.setCollideWorldBounds(true);

    this.enemies = this.physics.add.group();
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');

    this.physics.add.overlap(this.player, this.enemies, this.handlePlayerHit, null, this);

    this.spawnTimer = this.time.addEvent({
      delay: 1200,
      loop: true,
      callback: this.spawnEnemy,
      callbackScope: this,
    });

    this.attackTimer = this.time.addEvent({
      delay: this.attackIntervalMs,
      loop: true,
      callback: this.performAutoAttack,
      callbackScope: this,
    });

    this.events.on('question-answered', this.onQuestionAnswered, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off('question-answered', this.onQuestionAnswered, this);
    });

    this.hudText = this.add
      .text(12, 12, '', { fontSize: '16px', color: '#ffffff', fontFamily: 'sans-serif' })
      .setDepth(10);
    this.updateHud();
  }

  update(time, delta) {
    if (this.isPaused) return;

    this.remainingMs -= delta;
    if (this.remainingMs <= 0) {
      this.finishStage();
      return;
    }

    this.updateHud();

    const speed = 160;
    const velocity = new Phaser.Math.Vector2(0, 0);
    if (this.cursors.left.isDown || this.wasd.A.isDown) velocity.x -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) velocity.x += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) velocity.y -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) velocity.y += 1;
    velocity.normalize().scale(speed);
    this.player.setVelocity(velocity.x, velocity.y);

    this.enemies.getChildren().forEach((enemy) => {
      this.physics.moveToObject(enemy, this.player, 70);
    });
  }

  updateHud() {
    const secondsLeft = Math.max(0, Math.ceil(this.remainingMs / 1000));
    this.hudText.setText(`남은 시간 ${secondsLeft}초  레벨 ${this.level}`);
  }

  spawnEnemy() {
    const positions = [
      { x: Phaser.Math.Between(0, WORLD_WIDTH), y: -20 },
      { x: Phaser.Math.Between(0, WORLD_WIDTH), y: WORLD_HEIGHT + 20 },
      { x: -20, y: Phaser.Math.Between(0, WORLD_HEIGHT) },
      { x: WORLD_WIDTH + 20, y: Phaser.Math.Between(0, WORLD_HEIGHT) },
    ];
    const { x, y } = positions[Phaser.Math.Between(0, 3)];
    this.enemies.create(x, y, 'enemy');
  }

  performAutoAttack() {
    if (this.isPaused) return;
    let nearestEnemy = null;
    let nearestDistance = this.attackRange;
    this.enemies.getChildren().forEach((enemy) => {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (distance <= nearestDistance) {
        nearestEnemy = enemy;
        nearestDistance = distance;
      }
    });
    if (nearestEnemy) {
      this.flashHit(nearestEnemy.x, nearestEnemy.y);
      nearestEnemy.destroy();
      this.gainXp(1);
    }
  }

  flashHit(x, y) {
    const flash = this.add.circle(x, y, 18, 0xffffff, 0.9);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.6,
      duration: 200,
      onComplete: () => flash.destroy(),
    });
  }

  gainXp(amount) {
    this.xp += amount;
    const threshold = LEVEL_XP_THRESHOLDS[this.level];
    if (threshold !== undefined && this.xp >= threshold) {
      this.level += 1;
      this.openQuestion();
    }
  }

  openQuestion() {
    this.isPaused = true;
    this.physics.pause();
    this.spawnTimer.paused = true;
    this.attackTimer.paused = true;
    const question = generateCountObjectsQuestion();
    this.scene.launch('Question', { question });
  }

  onQuestionAnswered({ isCorrect }) {
    if (!this.isPaused) return;
    this.totalQuestions += 1;
    if (isCorrect) {
      this.correctAnswers += 1;
      this.attackRange += 15;
      this.attackIntervalMs = Math.max(250, this.attackIntervalMs - 100);
    } else {
      this.attackRange += 5;
      this.attackIntervalMs = Math.max(250, this.attackIntervalMs - 30);
    }
    this.attackTimer.delay = this.attackIntervalMs;
    this.scene.stop('Question');
    this.isPaused = false;
    this.physics.resume();
    this.spawnTimer.paused = false;
    this.attackTimer.paused = false;
  }

  handlePlayerHit(player, enemy) {
    enemy.destroy();
  }

  finishStage() {
    this.spawnTimer.remove();
    this.attackTimer.remove();
    const accuracy = this.totalQuestions === 0 ? 0 : this.correctAnswers / this.totalQuestions;
    this.scene.start('Result', {
      unitId: this.unitId,
      accuracy,
      totalQuestions: this.totalQuestions,
    });
  }
}
