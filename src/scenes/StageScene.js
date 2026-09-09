import Phaser from 'phaser';
import { generateQuestionForUnit } from '../systems/QuestionEngine.js';
import { getSave } from '../systems/SaveManager.js';
import { getCosmeticColor, DEFAULT_COSMETIC_ID } from '../data/cosmetics.js';
import { playAttack, playHit, playLevelUp } from '../systems/SfxPlayer.js';

// STAGE_DURATION_MS, the spawn interval(1200ms), and LEVEL_XP_THRESHOLDS are tuned together —
// raising the stage duration without extending this list means questions stop appearing
// long before the stage ends.
const LEVEL_XP_THRESHOLDS = [5, 10, 16, 23, 31, 40];
const STAGE_DURATION_MS = 60000;
// The arena is larger than the 800x600 viewport; the camera follows the player around it.
const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 1200;
// player/enemy sprites are 16x16 source tiles; scale them up so they read clearly on the 800x600 world.
const SPRITE_SCALE = 2.5;
const WALL_THICKNESS = 32;
const ENEMY_TEXTURE_KEYS = ['enemySlime', 'enemyGhost', 'enemyOrc'];

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
    this.cameras.main.fadeIn(250, 17, 17, 34);
    this.buildBackground();

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.player = this.physics.add.sprite(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 'player');
    this.player.setScale(SPRITE_SCALE);
    this.player.setCollideWorldBounds(true);
    this.applyEquippedPlayerColor();

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

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
      .setDepth(10)
      .setScrollFactor(0);
    this.updateHud();
  }

  buildBackground() {
    this.add.tileSprite(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 'floor').setDepth(-10);

    const decorKeys = ['decorCoin', 'decorRubble'];
    for (let i = 0; i < 24; i += 1) {
      const key = decorKeys[Phaser.Math.Between(0, decorKeys.length - 1)];
      const x = Phaser.Math.Between(WALL_THICKNESS + 20, WORLD_WIDTH - WALL_THICKNESS - 20);
      const y = Phaser.Math.Between(WALL_THICKNESS + 20, WORLD_HEIGHT - WALL_THICKNESS - 20);
      this.add.image(x, y, key).setScale(SPRITE_SCALE * 0.8).setAlpha(0.5).setDepth(-9);
    }

    this.add.tileSprite(WORLD_WIDTH / 2, WALL_THICKNESS / 2, WORLD_WIDTH, WALL_THICKNESS, 'wall').setDepth(-8);
    this.add
      .tileSprite(WORLD_WIDTH / 2, WORLD_HEIGHT - WALL_THICKNESS / 2, WORLD_WIDTH, WALL_THICKNESS, 'wall')
      .setDepth(-8);
    this.add.tileSprite(WALL_THICKNESS / 2, WORLD_HEIGHT / 2, WALL_THICKNESS, WORLD_HEIGHT, 'wall').setDepth(-8);
    this.add
      .tileSprite(WORLD_WIDTH - WALL_THICKNESS / 2, WORLD_HEIGHT / 2, WALL_THICKNESS, WORLD_HEIGHT, 'wall')
      .setDepth(-8);
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

    if (velocity.x !== 0) {
      this.player.setFlipX(velocity.x < 0);
    }

    this.enemies.getChildren().forEach((enemy) => {
      this.physics.moveToObject(enemy, this.player, 70);
    });
  }

  updateHud() {
    const secondsLeft = Math.max(0, Math.ceil(this.remainingMs / 1000));
    this.hudText.setText(`남은 시간 ${secondsLeft}초  레벨 ${this.level}`);
  }

  applyEquippedPlayerColor() {
    const save = getSave();
    const equippedId = save.equippedCosmetics.playerColor ?? DEFAULT_COSMETIC_ID;
    this.player.setTint(getCosmeticColor(equippedId));
  }

  spawnEnemy() {
    // Spawn in a ring just outside the visible camera area around the player, not fixed map edges —
    // the arena is much bigger than the viewport, so absolute-edge spawns would land far off-screen.
    const camera = this.cameras.main;
    const spawnRadius = Math.max(camera.width, camera.height) / 2 + 60;
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const margin = WALL_THICKNESS + 10;
    const x = Phaser.Math.Clamp(this.player.x + Math.cos(angle) * spawnRadius, margin, WORLD_WIDTH - margin);
    const y = Phaser.Math.Clamp(this.player.y + Math.sin(angle) * spawnRadius, margin, WORLD_HEIGHT - margin);
    const textureKey = ENEMY_TEXTURE_KEYS[Phaser.Math.Between(0, ENEMY_TEXTURE_KEYS.length - 1)];
    const enemy = this.enemies.create(x, y, textureKey);
    enemy.setScale(0);
    this.tweens.add({
      targets: enemy,
      scale: SPRITE_SCALE,
      duration: 200,
      ease: 'Back.Out',
    });
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
      this.fireProjectile(nearestEnemy);
    }
  }

  fireProjectile(targetEnemy) {
    playAttack();
    const projectile = this.add.circle(this.player.x, this.player.y, 5, 0xfff176, 1);
    const targetX = targetEnemy.x;
    const targetY = targetEnemy.y;
    const travelDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, targetX, targetY);
    const duration = Phaser.Math.Clamp(travelDistance * 1.2, 60, 180);

    this.tweens.add({
      targets: projectile,
      x: targetX,
      y: targetY,
      duration,
      onComplete: () => {
        projectile.destroy();
        // targetEnemy may already be gone (e.g. killed by contact) by the time the projectile lands.
        if (targetEnemy.active) {
          this.handleEnemyDefeated(targetEnemy);
        }
      },
    });
  }

  handleEnemyDefeated(enemy) {
    playHit();
    this.cameras.main.shake(60, 0.003);
    this.flashHit(enemy.x, enemy.y);
    this.spawnHitParticles(enemy.x, enemy.y);
    enemy.destroy();
    this.gainXp(1);
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

  spawnHitParticles(x, y) {
    const emitter = this.add.particles(x, y, 'xpOrb', {
      speed: { min: 40, max: 90 },
      lifespan: 250,
      scale: { start: 1, end: 0 },
      quantity: 8,
      emitting: false,
    });
    emitter.explode(8);
    this.time.delayedCall(300, () => emitter.destroy());
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
    playLevelUp();
    this.cameras.main.flash(150, 246, 224, 94);
    this.isPaused = true;
    this.physics.pause();
    this.spawnTimer.paused = true;
    this.attackTimer.paused = true;
    const question = generateQuestionForUnit(this.unitId);
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
    this.handleEnemyDefeated(enemy);
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
