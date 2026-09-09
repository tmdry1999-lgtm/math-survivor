import Phaser from 'phaser';
import { generateQuestionForUnit } from '../systems/QuestionEngine.js';
import { getSave } from '../systems/SaveManager.js';
import { getCosmeticColor, DEFAULT_COSMETIC_ID } from '../data/cosmetics.js';
import { playAttack, playHit, playLevelUp } from '../systems/SfxPlayer.js';

// STAGE_DURATION_MS, the spawn-rate ramp, and LEVEL_XP_THRESHOLDS are tuned together —
// raising the stage duration without extending the threshold table means questions stop
// appearing long before the stage ends.
function buildLevelThresholds(levelCount) {
  const thresholds = [];
  let cumulative = 0;
  let gap = 5;
  for (let i = 0; i < levelCount; i += 1) {
    cumulative += gap;
    thresholds.push(cumulative);
    gap += 2;
  }
  return thresholds;
}

const LEVEL_XP_THRESHOLDS = buildLevelThresholds(10);
const STAGE_DURATION_MS = 120000;
const SPAWN_DELAY_START_MS = 1200;
const SPAWN_DELAY_FLOOR_MS = 500;
const SPAWN_RAMP_STEP_MS = 100;
const SPAWN_RAMP_INTERVAL_MS = 20000;
// The arena is larger than the 800x600 viewport; the camera follows the player around it.
const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 1200;
// player/enemy sprites are 16x16 source tiles; scale them up so they read clearly on the 800x600 world.
const SPRITE_SCALE = 2.5;
const WALL_THICKNESS = 32;
const ENEMY_TEXTURE_KEYS = ['enemySlime', 'enemyGhost', 'enemyOrc'];
const MAX_PROJECTILE_COUNT = 3;
const MULTISHOT_ROLL_CHANCE = 0.15;

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
    this.projectileCount = 1;
    this.pendingUpgradeType = null;
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
    this.tweens.add({
      targets: this.player,
      scaleY: SPRITE_SCALE * 0.94,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.enemies = this.physics.add.group();
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');

    this.physics.add.overlap(this.player, this.enemies, this.handlePlayerHit, null, this);

    this.spawnTimer = this.time.addEvent({
      delay: SPAWN_DELAY_START_MS,
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

    this.difficultyTimer = this.time.addEvent({
      delay: SPAWN_RAMP_INTERVAL_MS,
      loop: true,
      callback: this.rampDifficulty,
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

    this.buildVirtualJoystick();
  }

  buildVirtualJoystick() {
    const baseX = 100;
    const baseY = this.scale.height - 100;
    const baseRadius = 50;

    this.joystickVector = new Phaser.Math.Vector2(0, 0);
    this.joystickPointerId = null;
    this.joystickBaseX = baseX;
    this.joystickBaseY = baseY;
    this.joystickBaseRadius = baseRadius;

    this.joystickBase = this.add
      .circle(baseX, baseY, baseRadius, 0xffffff, 0.15)
      .setStrokeStyle(2, 0xffffff, 0.4)
      .setScrollFactor(0)
      .setDepth(20)
      .setInteractive();
    this.joystickKnob = this.add
      .circle(baseX, baseY, 24, 0xffffff, 0.35)
      .setScrollFactor(0)
      .setDepth(21);

    this.joystickBase.on('pointerdown', (pointer) => {
      this.joystickPointerId = pointer.id;
      this.updateJoystick(pointer);
    });

    this.input.on('pointermove', (pointer) => {
      if (pointer.id === this.joystickPointerId) {
        this.updateJoystick(pointer);
      }
    });

    this.input.on('pointerup', (pointer) => {
      if (pointer.id === this.joystickPointerId) {
        this.joystickPointerId = null;
        this.joystickVector.set(0, 0);
        this.joystickKnob.setPosition(this.joystickBaseX, this.joystickBaseY);
      }
    });
  }

  updateJoystick(pointer) {
    const dx = pointer.x - this.joystickBaseX;
    const dy = pointer.y - this.joystickBaseY;
    const distance = Math.min(this.joystickBaseRadius, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    this.joystickKnob.setPosition(
      this.joystickBaseX + Math.cos(angle) * distance,
      this.joystickBaseY + Math.sin(angle) * distance,
    );
    this.joystickVector.set(Math.cos(angle), Math.sin(angle)).scale(distance / this.joystickBaseRadius);
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

    // Keyboard wins if both are used at once; otherwise fall back to the joystick's
    // analog vector so a light touch still moves slower than a full push to the edge.
    if (velocity.length() === 0 && this.joystickVector.length() > 0) {
      velocity.copy(this.joystickVector);
    } else if (velocity.length() > 1) {
      velocity.normalize();
    }
    velocity.scale(speed);
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
    const multishotSuffix = this.projectileCount > 1 ? `  🎯x${this.projectileCount}` : '';
    this.hudText.setText(`남은 시간 ${secondsLeft}초  레벨 ${this.level}${multishotSuffix}`);
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
      onComplete: () => {
        if (!enemy.active) return;
        this.tweens.add({
          targets: enemy,
          scaleY: SPRITE_SCALE * 0.92,
          duration: 450,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
      },
    });
  }

  performAutoAttack() {
    if (this.isPaused) return;
    this.findNearestEnemies(this.projectileCount).forEach((enemy) => this.fireProjectile(enemy));
  }

  findNearestEnemies(count) {
    return this.enemies
      .getChildren()
      .map((enemy) => ({ enemy, distance: Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) }))
      .filter(({ distance }) => distance <= this.attackRange)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, count)
      .map(({ enemy }) => enemy);
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
    this.difficultyTimer.paused = true;
    const question = generateQuestionForUnit(this.unitId, this.getDifficultyForLevel());
    this.pendingUpgradeType = this.pickUpgradeType();
    this.scene.launch('Question', { question, upgradeType: this.pendingUpgradeType });
  }

  // 스테이지 초반(레벨 0-2)은 쉬움, 중반(3-6)은 보통, 후반(7+)은 어려움 -
  // 기획서 5.4절의 "초반→후반으로 갈수록 난이도 상승" 요구를 레벨 진행에 맞춰 구현한다.
  getDifficultyForLevel() {
    if (this.level <= 2) return 0;
    if (this.level <= 6) return 1;
    return 2;
  }

  pickUpgradeType() {
    if (this.projectileCount < MAX_PROJECTILE_COUNT && Math.random() < MULTISHOT_ROLL_CHANCE) {
      return 'multishot';
    }
    return Math.random() < 0.5 ? 'speed' : 'range';
  }

  applyUpgrade(type, isStrong) {
    if (type === 'multishot') {
      if (isStrong) {
        this.projectileCount = Math.min(MAX_PROJECTILE_COUNT, this.projectileCount + 1);
      } else {
        // 오답이면 다중 사격은 늘리지 않고 대신 작은 사거리 보너스로 대체한다.
        this.attackRange += 5;
      }
    } else if (type === 'range') {
      this.attackRange += isStrong ? 15 : 5;
    } else {
      this.attackIntervalMs = Math.max(250, this.attackIntervalMs - (isStrong ? 100 : 30));
    }
  }

  onQuestionAnswered({ isCorrect }) {
    if (!this.isPaused) return;
    this.totalQuestions += 1;
    if (isCorrect) {
      this.correctAnswers += 1;
    }
    this.applyUpgrade(this.pendingUpgradeType, isCorrect);
    this.attackTimer.delay = this.attackIntervalMs;
    this.scene.stop('Question');
    this.isPaused = false;
    this.physics.resume();
    this.spawnTimer.paused = false;
    this.attackTimer.paused = false;
    this.difficultyTimer.paused = false;
  }

  handlePlayerHit(player, enemy) {
    this.handleEnemyDefeated(enemy);
  }

  rampDifficulty() {
    this.spawnTimer.delay = Math.max(SPAWN_DELAY_FLOOR_MS, this.spawnTimer.delay - SPAWN_RAMP_STEP_MS);
  }

  finishStage() {
    this.spawnTimer.remove();
    this.attackTimer.remove();
    this.difficultyTimer.remove();
    const accuracy = this.totalQuestions === 0 ? 0 : this.correctAnswers / this.totalQuestions;
    this.scene.start('Result', {
      unitId: this.unitId,
      accuracy,
      totalQuestions: this.totalQuestions,
    });
  }
}
