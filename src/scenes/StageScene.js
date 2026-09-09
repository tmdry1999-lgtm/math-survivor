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
const MAX_SPAWN_BATCH_SIZE = 3;
// Hard cap on simultaneously-alive enemies so a slow answerer's screen doesn't fill up
// with hundreds of active sprites/tweens and tank the frame rate.
const MAX_LIVE_ENEMIES = 60;
// The arena is larger than the 800x600 viewport; the camera follows the player around it.
const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 1200;
// player/enemy sprites are 16x16 source tiles; scale them up so they read clearly on the 800x600 world.
// Integer scale (not e.g. 2.5) so pixel art scales cleanly without shimmering as it moves.
const SPRITE_SCALE = 3;
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
    this.spawnBatchSize = 1;
    this.difficultyRampCount = 0;
  }

  create() {
    this.cameras.main.fadeIn(250, 17, 17, 34);
    this.buildBackground();

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.playerAura = this.add.circle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 26, 0xf6e05e, 0.2).setDepth(-1.5);
    this.tweens.add({
      targets: this.playerAura,
      scale: 1.15,
      alpha: 0.1,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.playerShadow = this.add.ellipse(WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 16, 26, 10, 0x000000, 0.35).setDepth(-1);

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

    // lerp 1 (instant follow, no smoothing lag) avoids the sub-pixel jitter that
    // pixelArt's roundPixels causes when the camera lags a fraction of a pixel behind.
    this.cameras.main.startFollow(this.player, true, 1, 1);

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

    this.killCount = 0;
    this.buildHud();
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

    // 단색 바닥이 밋밋해 보이지 않도록 은은한 명암 얼룩을 흩뿌려 지형에 변화를 준다.
    for (let i = 0; i < 40; i += 1) {
      const x = Phaser.Math.Between(WALL_THICKNESS, WORLD_WIDTH - WALL_THICKNESS);
      const y = Phaser.Math.Between(WALL_THICKNESS, WORLD_HEIGHT - WALL_THICKNESS);
      const radius = Phaser.Math.Between(20, 55);
      const isLight = Math.random() < 0.5;
      this.add
        .ellipse(x, y, radius * 2, radius * 1.3, isLight ? 0xffffff : 0x000000, 0.08)
        .setDepth(-9.5);
    }

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
    this.playerShadow.setPosition(this.player.x, this.player.y + 16);
    this.playerAura.setPosition(this.player.x, this.player.y);

    this.enemies.getChildren().forEach((enemy) => {
      this.physics.moveToObject(enemy, this.player, 70);
      if (enemy.shadow) {
        enemy.shadow.setPosition(enemy.x, enemy.y + 14);
      }
    });
  }

  buildHud() {
    const barX = 20;
    const barWidth = 760;
    const textStyle = { fontSize: '15px', color: '#ffffff', fontFamily: 'sans-serif' };

    this.add.rectangle(400, 26, 800, 52, 0x000000, 0.55).setScrollFactor(0).setDepth(15);

    this.add
      .rectangle(barX, 4, barWidth, 5, 0x000000, 0.5)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(16);
    this.xpBarFill = this.add
      .rectangle(barX, 4, barWidth, 5, 0x4fd1c5, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(17);

    this.add
      .rectangle(barX, 48, barWidth, 4, 0x000000, 0.5)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(16);
    this.timeBarFill = this.add
      .rectangle(barX, 48, barWidth, 4, 0xf6ad55, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(17);

    this.levelText = this.add
      .text(barX, 24, '', { ...textStyle, color: '#f6e05e', fontStyle: 'bold' })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(18);
    this.killText = this.add
      .text(barX + 90, 24, '', textStyle)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(18);
    this.timerText = this.add
      .text(barX + barWidth - 60, 24, '', textStyle)
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(18);

    this.multishotBadge = this.add
      .circle(barX + barWidth - 20, 24, 15, 0x2b2b40, 1)
      .setStrokeStyle(2, 0xf6e05e)
      .setScrollFactor(0)
      .setDepth(18)
      .setVisible(false);
    this.multishotText = this.add
      .text(barX + barWidth - 20, 24, '', { fontSize: '12px', color: '#f6e05e', fontFamily: 'sans-serif' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(19)
      .setVisible(false);
  }

  updateHud() {
    const secondsLeft = Math.max(0, Math.ceil(this.remainingMs / 1000));
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    this.timerText.setText(`${minutes}:${String(seconds).padStart(2, '0')}`);

    this.levelText.setText(`Lv.${this.level}`);
    this.killText.setText(`처치 ${this.killCount}`);

    const currentThreshold = LEVEL_XP_THRESHOLDS[this.level] ?? this.xp;
    const previousThreshold = this.level > 0 ? LEVEL_XP_THRESHOLDS[this.level - 1] : 0;
    const levelSpan = Math.max(1, currentThreshold - previousThreshold);
    const xpProgress = Phaser.Math.Clamp((this.xp - previousThreshold) / levelSpan, 0, 1);
    this.xpBarFill.scaleX = xpProgress;

    this.timeBarFill.scaleX = Phaser.Math.Clamp(this.remainingMs / STAGE_DURATION_MS, 0, 1);

    const showMultishot = this.projectileCount > 1;
    this.multishotBadge.setVisible(showMultishot);
    this.multishotText.setVisible(showMultishot);
    if (showMultishot) {
      this.multishotText.setText(`x${this.projectileCount}`);
    }
  }

  applyEquippedPlayerColor() {
    const save = getSave();
    const equippedId = save.equippedCosmetics.playerColor ?? DEFAULT_COSMETIC_ID;
    this.player.setTint(getCosmeticColor(equippedId));
  }

  spawnEnemy() {
    // 난이도 램프가 진행될수록 한 번에 여러 마리를 몰아서 스폰해 무리 지어 몰려오는
    // 느낌을 낸다 (spawnBatchSize는 rampDifficulty에서 점진적으로 늘어남).
    // 처치가 늦어져도 화면에 적이 무한히 쌓여 프레임이 떨어지지 않도록 총원을 제한한다.
    const room = MAX_LIVE_ENEMIES - this.enemies.getLength();
    const spawnCount = Math.max(0, Math.min(this.spawnBatchSize, room));
    for (let i = 0; i < spawnCount; i += 1) {
      this.spawnOneEnemy();
    }
  }

  spawnOneEnemy() {
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
    enemy.shadow = this.add.ellipse(x, y + 14, 22, 8, 0x000000, 0.3).setDepth(-1);
    enemy.once(Phaser.GameObjects.Events.DESTROY, () => enemy.shadow.destroy());
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
    this.killCount += 1;
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
    const difficulty = this.getDifficultyForLevel();
    const question = generateQuestionForUnit(this.unitId, difficulty);
    this.pendingUpgradeType = this.pickUpgradeType();
    this.scene.launch('Question', { question, upgradeType: this.pendingUpgradeType, difficulty });
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
    this.difficultyRampCount += 1;
    // 두 번의 램프(40초)마다 한 번에 몰아서 스폰하는 적 수를 늘려 후반부에 무리 지어
    // 몰려오는 느낌을 강화한다.
    this.spawnBatchSize = Math.min(MAX_SPAWN_BATCH_SIZE, 1 + Math.floor(this.difficultyRampCount / 2));
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
