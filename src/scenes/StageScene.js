import Phaser from 'phaser';
import { generateQuestionForUnit } from '../systems/QuestionEngine.js';
import { getSave } from '../systems/SaveManager.js';
import { getCosmeticColor, DEFAULT_COSMETIC_ID } from '../data/cosmetics.js';
import { playAttack, playHit, playLevelUp } from '../systems/SfxPlayer.js';
import { WEAPON_DEFS, WEAPON_IDS, MAX_WEAPON_LEVEL, getWeaponStats } from '../data/weapons.js';

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
const MAX_WEAPONS = 4;
// The reward is planned before the answer is known (so its icon can be previewed), so this
// chance applies regardless of correct/wrong — only the follow-up effect differs by outcome.
const NEW_WEAPON_CHANCE = 0.6;

// 실제로 몰려오는 적을 자동공격으로 물리치며 살아남는 "전투 화면"입니다.
// 방향키/WASD 또는 화면의 가상 조이스틱으로 캐릭터를 움직이고, 무기는 자동으로
// 발사됩니다. 경험치(XP)가 차서 레벨업하면 수학 문제 화면이 뜨고, 맞히면 무기가
// 더 강해집니다. 제한 시간이 다 되면 결과 화면으로 넘어갑니다.
export class StageScene extends Phaser.Scene {
  constructor() {
    super('Stage');
  }

  // 스테이지를 새로 시작할 때 점수/레벨/무기 등 상태값을 처음 상태로 초기화한다.
  init(data) {
    this.unitId = data.unitId;
    this.xp = 0;
    this.level = 0;
    this.correctAnswers = 0;
    this.totalQuestions = 0;
    this.weapons = [];
    this.pendingReward = null;
    this.isPaused = false;
    this.remainingMs = STAGE_DURATION_MS;
    this.spawnBatchSize = 1;
    this.difficultyRampCount = 0;
  }

  // 화면이 시작될 때 배경, 캐릭터, 적을 담을 그룹, 키보드 입력, 각종 타이머와
  // 이벤트 리스너를 한 번에 세팅한다.
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

    this.difficultyTimer = this.time.addEvent({
      delay: SPAWN_RAMP_INTERVAL_MS,
      loop: true,
      callback: this.rampDifficulty,
      callbackScope: this,
    });

    this.events.on('question-answered', this.onQuestionAnswered, this);
    this.events.on('resume-game', this.resumeGameplay, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off('question-answered', this.onQuestionAnswered, this);
      this.events.off('resume-game', this.resumeGameplay, this);
    });

    this.input.keyboard.on('keydown-ESC', () => {
      if (this.isPaused) return;
      this.openPauseMenu();
    });

    this.killCount = 0;
    this.buildHud();
    this.updateHud();

    // 첫 무기(화살)를 시작부터 들고 시작해 바로 전투에 참여할 수 있게 한다.
    this.acquireWeapon('arrow');

    this.buildVirtualJoystick();
  }

  // 화면 오른쪽 아래에 떠 있는 일시정지(⏸️) 버튼.
  buildPauseButton() {
    const x = this.scale.width - 34;
    const y = this.scale.height - 34;
    const background = this.add
      .circle(x, y, 22, 0x1a1a2e, 0.8)
      .setStrokeStyle(2, 0xf6e05e)
      .setScrollFactor(0)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, '⏸️', { fontSize: '16px' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21);

    background.on('pointerover', () => background.setScale(1.08));
    background.on('pointerout', () => background.setScale(1));
    background.on('pointerdown', () => {
      if (this.isPaused) return;
      this.openPauseMenu();
    });
  }

  // 화면 왼쪽 아래에 스마트폰/태블릿용 가상 조이스틱(원 안의 손잡이)을 만든다.
  // 손잡이를 누르고 드래그하면 그 방향으로 캐릭터가 움직인다.
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

  // 손가락(또는 마우스)이 조이스틱 중심에서 얼마나, 어느 방향으로 떨어져 있는지 계산해서
  // 손잡이 위치를 옮기고, 그 방향/세기를 이동 방향 벡터(joystickVector)에 저장한다.
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

  // 게임 무대(아레나)의 바닥, 얼룩무늬, 장식물, 사방 벽을 그린다.
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

  // 매 프레임(1초에 수십 번)마다 실행되는 게임의 심장박동 같은 함수.
  // 남은 시간 계산, 캐릭터 이동, 적이 플레이어를 쫓아오게 하기, 무기 자동발사를 처리한다.
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

    this.updateWeapons(delta);
  }

  // 들고 있는 무기마다 남은 재장전 시간을 줄이고, 다 되면 자동으로 한 번 발사한다.
  updateWeapons(delta) {
    this.weapons.forEach((weapon) => {
      weapon.cooldownRemaining -= delta;
      if (weapon.cooldownRemaining <= 0) {
        const stats = getWeaponStats(weapon.id, weapon.level);
        this.fireWeapon(weapon, stats);
        weapon.cooldownRemaining = stats.interval;
      }
    });
  }

  // 화면 위쪽 정보창(HUD)을 만든다: 경험치 바, 남은 시간 바, 레벨/처치 수/시간 글씨,
  // 그리고 오른쪽에 늘어선 무기 아이콘 칸들.
  buildHud() {
    const barX = 20;
    const barWidth = 760;
    const textStyle = { fontSize: '15px', color: '#ffffff', fontFamily: 'sans-serif' };

    this.add.rectangle(400, 26, 800, 52, 0x000000, 0.55).setScrollFactor(0).setDepth(15);
    this.buildPauseButton();

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
      .text(barX + barWidth, 24, '', textStyle)
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(18);

    // 장착한 무기를 오른쪽부터 아이콘으로 나열 (레벨 숫자와 진화 시 금색 테두리 포함).
    this.weaponSlots = [];
    for (let i = 0; i < MAX_WEAPONS; i += 1) {
      const x = barX + barWidth - 90 - i * 40;
      const badge = this.add
        .circle(x, 24, 15, 0x2b2b40, 1)
        .setStrokeStyle(2, 0x555566)
        .setScrollFactor(0)
        .setDepth(18)
        .setVisible(false);
      const icon = this.add
        .text(x, 24, '', { fontSize: '14px' })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(19)
        .setVisible(false);
      const levelText = this.add
        .text(x + 10, 32, '', { fontSize: '10px', color: '#f6e05e', fontFamily: 'sans-serif', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(19)
        .setVisible(false);
      this.weaponSlots.push({ badge, icon, levelText });
    }
  }

  // 매 프레임 정보창의 숫자와 막대 길이를 최신 상태로 다시 그려준다.
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

    this.weaponSlots.forEach((slot, index) => {
      const weapon = this.weapons[index];
      const has = Boolean(weapon);
      slot.badge.setVisible(has);
      slot.icon.setVisible(has);
      slot.levelText.setVisible(has);
      if (has) {
        const def = WEAPON_DEFS[weapon.id];
        slot.icon.setText(def.icon);
        slot.levelText.setText(`${weapon.level}`);
        slot.badge.setStrokeStyle(2, weapon.evolved ? 0xf6e05e : 0x555566);
      }
    });
  }

  // 나의 방(허브)에서 고른 캐릭터 색을 이 스테이지의 캐릭터에도 그대로 입혀준다.
  applyEquippedPlayerColor() {
    const save = getSave();
    const equippedId = save.equippedCosmetics.playerColor ?? DEFAULT_COSMETIC_ID;
    this.player.setTint(getCosmeticColor(equippedId));
  }

  // 새 적을 등장시킬 타이밍이 되면 한 번에 몇 마리를 만들지 정해서 spawnOneEnemy를 반복 호출한다.
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

  // 화면 바깥쪽 보이지 않는 곳에서 적 한 마리를 나타나게 하고, 커지는 등장 애니메이션을 재생한다.
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

  // 플레이어 기준으로 정해진 사거리(range) 안에 있는 적들 중 가장 가까운 순서로
  // count 마리를 뽑아 돌려준다. (무기가 조준할 대상을 정할 때 사용)
  findNearestEnemies(count, range) {
    return this.enemies
      .getChildren()
      .map((enemy) => ({ enemy, distance: Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) }))
      .filter(({ distance }) => distance <= range)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, count)
      .map(({ enemy }) => enemy);
  }

  // 무기 종류(behavior)에 따라 실제로 발사하는 방법을 다르게 골라준다.
  // homing = 가까운 적 하나를 따라가는 유도탄, pierce = 일직선으로 관통하는 찌르기,
  // aoe = 목표 지점에서 터지며 주변을 휩쓰는 폭발, orbit = 내 주변을 도는 공격.
  fireWeapon(weapon, stats) {
    const def = WEAPON_DEFS[weapon.id];
    if (def.behavior === 'homing') {
      const [target] = this.findNearestEnemies(1, stats.range);
      if (target) this.fireHomingShot(target, def, weapon.evolved);
    } else if (def.behavior === 'pierce') {
      this.firePierceShot(stats, def, weapon.evolved);
    } else if (def.behavior === 'aoe') {
      const [target] = this.findNearestEnemies(1, stats.range);
      if (target) this.fireAoeShot(target, stats.radius, def, weapon.evolved);
    } else if (def.behavior === 'orbit') {
      this.fireOrbitPulse(stats.radius, def, weapon.evolved);
    }
  }

  // 유도탄 무기(화살, 마법 구슬): 목표 적을 향해 투사체가 날아가고, 도착하면 처치한다.
  fireHomingShot(targetEnemy, def, evolved) {
    playAttack();
    const targetX = targetEnemy.x;
    const targetY = targetEnemy.y;
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, targetX, targetY);
    const projectile = this.add
      .image(this.player.x, this.player.y, def.texture)
      .setTint(def.color)
      .setScale(evolved ? 2 : 1.5)
      .setRotation(angle + Math.PI / 4);
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

  // 관통 무기(창, 얼음창): 플레이어 앞으로 일직선 경로를 그리고, 그 경로 위에 있는
  // 적을 한꺼번에 모두 처치한다.
  firePierceShot(stats, def, evolved) {
    const [nearest] = this.findNearestEnemies(1, stats.range);
    if (!nearest) return;
    playAttack();

    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, nearest.x, nearest.y);
    const endX = this.player.x + Math.cos(angle) * stats.range;
    const endY = this.player.y + Math.sin(angle) * stats.range;

    const streak = this.add
      .line(0, 0, this.player.x, this.player.y, endX, endY, def.color, 0.5)
      .setLineWidth(evolved ? 5 : 3)
      .setOrigin(0, 0);
    this.tweens.add({ targets: streak, alpha: 0, duration: 220, onComplete: () => streak.destroy() });

    // 칼 스프라이트가 사거리 끝까지 재빨리 미끄러지듯 지나가는 연출(적중 판정은 즉시 계산됨).
    const blade = this.add
      .image(this.player.x, this.player.y, def.texture)
      .setTint(def.color)
      .setScale(evolved ? 1.8 : 1.4)
      .setRotation(angle + Math.PI / 4);
    this.tweens.add({
      targets: blade,
      x: endX,
      y: endY,
      duration: 180,
      onComplete: () => blade.destroy(),
    });

    const dx = endX - this.player.x;
    const dy = endY - this.player.y;
    const lineLengthSq = Math.max(1, dx * dx + dy * dy);
    [...this.enemies.getChildren()].forEach((enemy) => {
      if (!enemy.active) return;
      const t = Phaser.Math.Clamp(((enemy.x - this.player.x) * dx + (enemy.y - this.player.y) * dy) / lineLengthSq, 0, 1);
      const closestX = this.player.x + t * dx;
      const closestY = this.player.y + t * dy;
      if (Phaser.Math.Distance.Between(enemy.x, enemy.y, closestX, closestY) <= stats.corridor) {
        this.handleEnemyDefeated(enemy);
      }
    });
  }

  // 폭발 무기(불덩이, 폭탄): 목표 지점까지 투사체가 날아간 뒤 그 자리에서 explodeAt으로 터진다.
  fireAoeShot(targetEnemy, radius, def, evolved) {
    playAttack();
    const targetX = targetEnemy.x;
    const targetY = targetEnemy.y;
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, targetX, targetY);
    const projectile = this.add
      .image(this.player.x, this.player.y, def.texture)
      .setTint(def.color)
      .setScale(evolved ? 1.9 : 1.5)
      .setRotation(angle);
    const travelDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, targetX, targetY);
    const duration = Phaser.Math.Clamp(travelDistance * 1.2, 80, 220);

    this.tweens.add({
      targets: projectile,
      x: targetX,
      y: targetY,
      rotation: angle + Math.PI * 2,
      duration,
      onComplete: () => {
        projectile.destroy();
        this.explodeAt(targetX, targetY, radius, def.color);
      },
    });
  }

  // 지정한 위치에 둥근 폭발 효과를 그리고, 그 반경 안에 있는 적을 모두 처치한다.
  explodeAt(x, y, radius, color) {
    const ring = this.add.circle(x, y, 4, color, 0.5).setStrokeStyle(2, color, 1);
    this.tweens.add({ targets: ring, radius, alpha: 0, duration: 250, onComplete: () => ring.destroy() });

    [...this.enemies.getChildren()].forEach((enemy) => {
      if (!enemy.active) return;
      if (Phaser.Math.Distance.Between(enemy.x, enemy.y, x, y) <= radius) {
        this.handleEnemyDefeated(enemy);
      }
    });
  }

  // 회전 무기(회전 도끼, 회오리): 나를 중심으로 원 모양 판정 범위가 한 번 퍼져나가며,
  // 그 안에 있던 적을 모두 처치한다.
  fireOrbitPulse(radius, def, evolved) {
    playAttack();
    const ring = this.add
      .circle(this.player.x, this.player.y, 6, def.color, evolved ? 0.35 : 0.22)
      .setStrokeStyle(evolved ? 3 : 2, def.color, 0.8);
    this.tweens.add({ targets: ring, radius, alpha: 0, duration: 300, onComplete: () => ring.destroy() });

    // 무기 아이콘이 플레이어 주위를 한 바퀴 휙 돌며 판정 범위를 눈으로 보여준다.
    const icon = this.add
      .image(this.player.x, this.player.y - radius * 0.6, def.texture)
      .setTint(def.color)
      .setScale(evolved ? 1.7 : 1.3);
    this.tweens.add({
      targets: icon,
      angle: 360,
      duration: 300,
      onComplete: () => icon.destroy(),
    });

    [...this.enemies.getChildren()].forEach((enemy) => {
      if (!enemy.active) return;
      if (Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) <= radius) {
        this.handleEnemyDefeated(enemy);
      }
    });
  }

  // 적 하나가 쓰러졌을 때: 효과음, 화면 흔들림, 번쩍임, 반짝이 파티클을 재생하고
  // 처치 수를 늘린 뒤 경험치를 1 준다.
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

  // 경험치를 더하고, 다음 레벨업에 필요한 양을 넘으면 레벨을 올리고 문제 화면을 띄운다.
  gainXp(amount) {
    this.xp += amount;
    const threshold = LEVEL_XP_THRESHOLDS[this.level];
    if (threshold !== undefined && this.xp >= threshold) {
      this.level += 1;
      this.openQuestion();
    }
  }

  // 전투를 일시정지한다 (물리엔진 정지 + 적 스폰/난이도 타이머 정지). 문제 화면이 뜨거나
  // ESC를 눌렀을 때 호출된다.
  pauseGameplay() {
    this.isPaused = true;
    this.physics.pause();
    this.spawnTimer.paused = true;
    this.difficultyTimer.paused = true;
  }

  resumeGameplay() {
    this.isPaused = false;
    this.physics.resume();
    this.spawnTimer.paused = false;
    this.difficultyTimer.paused = false;
  }

  openPauseMenu() {
    this.pauseGameplay();
    this.scene.launch('Pause');
  }

  // 레벨업 시 실행: 효과음/화면 번쩍임을 재생하고, 전투를 멈춘 뒤 이번에 받을 보상을
  // 미리 정해서(planWeaponReward) 문제 화면을 띄운다.
  openQuestion() {
    playLevelUp();
    this.cameras.main.flash(150, 246, 224, 94);
    this.pauseGameplay();
    const difficulty = this.getDifficultyForLevel();
    const question = generateQuestionForUnit(this.unitId, difficulty);
    this.pendingReward = this.planWeaponReward();
    const rewardDef = WEAPON_DEFS[this.pendingReward.weaponId];
    this.scene.launch('Question', { question, rewardIcon: rewardDef.icon, difficulty });
  }

  // 스테이지 초반(레벨 0-2)은 쉬움, 중반(3-6)은 보통, 후반(7+)은 어려움 -
  // 기획서 5.4절의 "초반→후반으로 갈수록 난이도 상승" 요구를 레벨 진행에 맞춰 구현한다.
  getDifficultyForLevel() {
    if (this.level <= 2) return 0;
    if (this.level <= 6) return 1;
    return 2;
  }

  // 정답 여부를 알기 전에 보상 대상을 미리 정해서 문제 화면에 예고 아이콘으로 보여준다.
  planWeaponReward() {
    const ownedIds = this.weapons.map((w) => w.id);
    const canAcquireNew = this.weapons.length < MAX_WEAPONS;
    const availableToAcquire = WEAPON_IDS.filter((id) => !ownedIds.includes(id));

    if (canAcquireNew && availableToAcquire.length > 0 && (this.weapons.length === 0 || Math.random() < NEW_WEAPON_CHANCE)) {
      const weaponId = availableToAcquire[Phaser.Math.Between(0, availableToAcquire.length - 1)];
      return { kind: 'acquire', weaponId };
    }

    const upgradable = this.weapons.filter((w) => w.level < MAX_WEAPON_LEVEL);
    if (upgradable.length === 0) {
      // 모두 최고 레벨이거나(드묾) 무기가 아직 없는 극단적인 경우 - 화살은 항상 보유하게 되므로
      // 실질적으로는 "모두 최고 레벨" 케이스만 남는다. 이때도 아이콘을 보여줘야 하므로 무작위
      // 보유 무기를 골라 쿨다운만 살짝 당겨준다.
      const anyWeapon = this.weapons[Phaser.Math.Between(0, this.weapons.length - 1)];
      return { kind: 'refresh', weaponId: anyWeapon.id };
    }
    const weapon = upgradable[Phaser.Math.Between(0, upgradable.length - 1)];
    return { kind: 'levelup', weaponId: weapon.id };
  }

  // 문제 화면에서 정답/오답 결과가 나오면 미리 정해둔 보상(planWeaponReward의 결과)을
  // 실제로 적용한다. 정답이면 무기를 얻거나 레벨을 올리고, 오답이어도 아주 조금은 도움을 준다.
  applyWeaponReward(reward, isCorrect) {
    if (reward.kind === 'acquire') {
      this.acquireWeapon(reward.weaponId);
    } else if (reward.kind === 'levelup') {
      const weapon = this.weapons.find((w) => w.id === reward.weaponId);
      if (isCorrect) {
        weapon.level = Math.min(MAX_WEAPON_LEVEL, weapon.level + 1);
        if (weapon.level === MAX_WEAPON_LEVEL) {
          this.evolveWeapon(weapon);
        }
      } else {
        // 오답이면 레벨은 그대로 두고 다음 발사까지 남은 시간만 조금 당겨준다(약한 업그레이드).
        weapon.cooldownRemaining = Math.max(0, weapon.cooldownRemaining - 400);
      }
    } else if (reward.kind === 'refresh') {
      const weapon = this.weapons.find((w) => w.id === reward.weaponId);
      weapon.cooldownRemaining = Math.max(0, weapon.cooldownRemaining - (isCorrect ? 500 : 200));
    }

    if (isCorrect) {
      // 정답 보너스: 보유한 모든 무기가 살짝 더 빨리 다시 발사된다.
      this.weapons.forEach((w) => {
        w.cooldownRemaining = Math.max(0, w.cooldownRemaining - 200);
      });
    }
  }

  // 새 무기를 1레벨로 목록에 추가한다.
  acquireWeapon(weaponId) {
    this.weapons.push({ id: weaponId, level: 1, cooldownRemaining: 0, evolved: false });
  }

  // 무기가 최고 레벨에 도달했을 때 "진화" 상태로 표시하고 화려한 효과를 보여준다.
  evolveWeapon(weapon) {
    weapon.evolved = true;
    playLevelUp();
    this.cameras.main.flash(200, 159, 122, 234);
  }

  // 문제 화면에서 "정답/오답 결정됨" 신호를 받으면 보상을 적용하고 문제 화면을 닫은 뒤
  // 전투를 다시 이어간다.
  onQuestionAnswered({ isCorrect }) {
    if (!this.isPaused) return;
    this.totalQuestions += 1;
    if (isCorrect) {
      this.correctAnswers += 1;
    }
    this.applyWeaponReward(this.pendingReward, isCorrect);
    this.scene.stop('Question');
    this.resumeGameplay();
  }

  // 플레이어가 적과 몸으로 부딪혔을 때도 공격이 닿은 것처럼 적을 처치한다.
  handlePlayerHit(player, enemy) {
    this.handleEnemyDefeated(enemy);
  }

  // 20초마다 실행되어 적 등장 속도를 점점 빠르게 만들어 게임을 서서히 어렵게 한다.
  rampDifficulty() {
    this.spawnTimer.delay = Math.max(SPAWN_DELAY_FLOOR_MS, this.spawnTimer.delay - SPAWN_RAMP_STEP_MS);
    this.difficultyRampCount += 1;
    // 두 번의 램프(40초)마다 한 번에 몰아서 스폰하는 적 수를 늘려 후반부에 무리 지어
    // 몰려오는 느낌을 강화한다.
    this.spawnBatchSize = Math.min(MAX_SPAWN_BATCH_SIZE, 1 + Math.floor(this.difficultyRampCount / 2));
  }

  // 제한 시간이 다 되면 타이머를 정리하고, 정답률을 계산해 결과 화면으로 넘어간다.
  finishStage() {
    this.spawnTimer.remove();
    this.difficultyTimer.remove();
    const accuracy = this.totalQuestions === 0 ? 0 : this.correctAnswers / this.totalQuestions;
    this.scene.start('Result', {
      unitId: this.unitId,
      accuracy,
      totalQuestions: this.totalQuestions,
    });
  }
}
