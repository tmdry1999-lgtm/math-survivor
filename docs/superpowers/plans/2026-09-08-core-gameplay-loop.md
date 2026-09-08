# 핵심 게임플레이 루프 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phaser 3 + Vite로 "이동(자동공격) → 레벨업 시 문제 팝업(정답/오답 모두 업그레이드, 페널티 없음) → 스테이지 클리어 → 결과/저장" 핵심 루프를 단원 1개(`nums_within_9`, 9까지의 수)로 처음부터 끝까지 동작하게 만든다.

**Architecture:** Phaser 3 씬 3개(`Boot`, `Stage`, `Result`)와 오버레이 씬(`Question`)으로 게임을 구성한다. 문제 생성 로직(`QuestionEngine`)과 저장 로직(`SaveManager`)은 Phaser에 의존하지 않는 순수 JS 모듈로 분리해 Vitest로 단위 테스트한다. 실제 도트 그래픽은 이 단계에서 다루지 않고, `Phaser.Graphics.generateTexture`로 만든 단색 원(placeholder)을 사용한다 — 나중에 Kenney 에셋으로 교체할 때 텍스처 키만 바꾸면 되도록 스프라이트 키 이름(`player`, `enemy`, `xpOrb`)만 먼저 확정한다. 허브 화면, 코스메틱 상점, 나머지 10개 단원은 이 플랜의 범위 밖이며 별도 플랜에서 다룬다.

**Tech Stack:** Phaser 3 (Arcade Physics), Vite (dev server/bundler), Vitest + jsdom (단위 테스트), 순수 JavaScript(TypeScript 미사용), 브라우저 localStorage.

**Spec:** `docs/design/01-게임-기획서.md`, `docs/design/02-단원별-문제설계.md`

## Global Constraints

- 조작은 이동만(방향키+WASD 둘 다 지원), 공격은 자동이어야 한다. (스펙 2절, 3절)
- 문제는 숫자/기호/그림 중심이며 텍스트는 최소화한다. (스펙 5.1절)
- 오답은 페널티 없이 "약한 업그레이드"만 지급한다. HP 감소나 게임오버로 이어지는 부정적 페널티는 없다. (스펙 5.3절)
- 진행 저장은 로그인 없이 브라우저 localStorage에 자동 저장하며, 스키마는 `{ currency, unlockedStages, stageProgress, ownedCosmetics, equippedCosmetics }` 형태를 따른다. (스펙 7절)
- 재화(가칭 "별조각")는 스테이지 클리어 시 정답률에 비례해 지급한다. (스펙 6절)
- 문제 생성 로직은 순수 함수로 분리해 자동 테스트로 정답 정확성을 검증한다. (스펙 11절)

---

### Task 1: 프로젝트 스캐폴드 & 툴체인

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.js`
- Create: `.gitignore`
- Create: `src/main.js` (임시 placeholder, Task 2에서 완성)

**Interfaces:**
- Consumes: 없음 (최초 작업)
- Produces: `npm run dev`(개발 서버), `npm test`(vitest), 이후 모든 태스크가 이 위에서 동작.

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "math-survivor",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "phaser": "^3.80.1"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "vitest": "^2.1.0",
    "jsdom": "^25.0.0"
  }
}
```

- [ ] **Step 2: index.html 작성**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>수학 서바이버</title>
    <style>
      html, body { margin: 0; padding: 0; background: #111122; }
      #app { display: flex; justify-content: center; align-items: center; height: 100vh; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 3: vite.config.js 작성 (vitest 설정 포함)**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
```

- [ ] **Step 4: .gitignore 작성**

```
node_modules
dist
```

- [ ] **Step 5: src/main.js 임시 파일 작성**

Task 2에서 실제 Phaser 설정으로 교체할 자리표시자. 지금은 콘솔 로그만 찍어 빌드 파이프라인이 동작하는지만 확인한다.

```js
console.log('math-survivor bootstrap ok');
```

- [ ] **Step 6: 의존성 설치**

Run: `npm install`
Expected: `node_modules/` 생성, 에러 없이 종료.

- [ ] **Step 7: 개발 서버로 파이프라인 확인**

Run: `npm run dev -- --port 5173 &` 로 잠깐 띄워보고 `curl -s http://localhost:5173/ | grep "수학 서바이버"` 로 HTML이 응답하는지 확인한 뒤 서버를 종료한다. (수동으로 브라우저를 열어 콘솔에 `math-survivor bootstrap ok`가 찍히는지 확인해도 된다.)

- [ ] **Step 8: git 저장소 초기화 및 첫 커밋**

```bash
git init
git add package.json index.html vite.config.js .gitignore src/main.js docs
git commit -m "chore: 프로젝트 스캐폴드 및 기획 문서 추가"
```

---

### Task 2: Phaser 부트스트랩 & Placeholder 텍스처

**Files:**
- Create: `src/scenes/BootScene.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: 없음
- Produces: 텍스처 키 `player`, `enemy`, `xpOrb` (다른 씬에서 `this.add.sprite(x, y, 'player')` 형태로 사용). `BootScene`은 생성 직후 `this.scene.start('Stage', { unitId: 'nums_within_9' })`를 호출해 Task 5의 `StageScene`으로 전환한다(아직 `StageScene`이 없으므로 이 태스크에서는 존재 여부만 준비하고, `StageScene`은 Task 5에서 등록됨).

- [ ] **Step 1: BootScene 작성**

```js
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.createCircleTexture('player', 16, 0x4fd1c5);
    this.createCircleTexture('enemy', 14, 0xf56565);
    this.createCircleTexture('xpOrb', 6, 0xf6e05e);
    this.scene.start('Stage', { unitId: 'nums_within_9' });
  }

  createCircleTexture(key, radius, color) {
    const graphics = this.add.graphics();
    graphics.fillStyle(color, 1);
    graphics.fillCircle(radius, radius, radius);
    graphics.generateTexture(key, radius * 2, radius * 2);
    graphics.destroy();
  }
}
```

- [ ] **Step 2: main.js를 Phaser 게임 설정으로 교체**

```js
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'app',
  backgroundColor: '#2b2b40',
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [BootScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
```

- [ ] **Step 3: 수동 확인**

Run: `npm run dev`
브라우저로 표시된 로컬 주소를 열어, 800x600 캔버스가 뜨고 콘솔 에러가 없는지 확인한다. (`StageScene`이 아직 없으므로 `scene.start('Stage', ...)`는 이 시점에 "scene not found" 경고를 낼 수 있다 — Task 5까지는 정상이다.) 확인 후 서버를 중지한다(Ctrl+C).

- [ ] **Step 4: 커밋**

```bash
git add src/main.js src/scenes/BootScene.js
git commit -m "feat: Phaser 부트스트랩과 placeholder 텍스처 추가"
```

---

### Task 3: QuestionEngine (문제 생성 순수 함수) — TDD

**Files:**
- Create: `src/systems/QuestionEngine.js`
- Test: `tests/questionEngine.test.js`

**Interfaces:**
- Consumes: 없음 (순수 함수, 외부 의존성 없음)
- Produces: `generateCountObjectsQuestion(): { type: 'count_objects', promptCount: number, choices: Array<{ value: number, isCorrect: boolean }> }`. Task 5의 `StageScene`과 Task 6의 `QuestionScene`이 이 반환 형태를 그대로 사용한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
import { describe, it, expect } from 'vitest';
import { generateCountObjectsQuestion } from '../src/systems/QuestionEngine.js';

describe('generateCountObjectsQuestion', () => {
  it('returns exactly 3 choices with exactly one correct answer', () => {
    const question = generateCountObjectsQuestion();
    expect(question.choices).toHaveLength(3);
    expect(question.choices.filter((choice) => choice.isCorrect)).toHaveLength(1);
  });

  it('the correct choice value matches promptCount', () => {
    const question = generateCountObjectsQuestion();
    const correct = question.choices.find((choice) => choice.isCorrect);
    expect(correct.value).toBe(question.promptCount);
  });

  it('promptCount stays within 1 and 9 (9까지의 수 범위)', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateCountObjectsQuestion();
      expect(question.promptCount).toBeGreaterThanOrEqual(1);
      expect(question.promptCount).toBeLessThanOrEqual(9);
    }
  });

  it('choice values contain no duplicates', () => {
    const question = generateCountObjectsQuestion();
    const values = question.choices.map((choice) => choice.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('all choice values stay within the valid 0-9 display range', () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateCountObjectsQuestion();
      question.choices.forEach((choice) => {
        expect(choice.value).toBeGreaterThanOrEqual(0);
        expect(choice.value).toBeLessThanOrEqual(9);
      });
    }
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npx vitest run tests/questionEngine.test.js`
Expected: FAIL — `src/systems/QuestionEngine.js` 모듈이 없어서 import 에러.

- [ ] **Step 3: 최소 구현 작성**

```js
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildChoices(correctValue, minValue, maxValue) {
  const values = new Set([correctValue]);
  let guard = 0;
  while (values.size < 3 && guard < 100) {
    guard += 1;
    const offset = randomInt(1, 2) * (Math.random() < 0.5 ? -1 : 1);
    const candidate = correctValue + offset;
    if (candidate >= minValue && candidate <= maxValue) {
      values.add(candidate);
    }
  }
  // guard 초과로 3개를 못 채운 극단적인 경우(정답이 범위 경계)를 위한 안전망
  let filler = minValue;
  while (values.size < 3 && filler <= maxValue) {
    values.add(filler);
    filler += 1;
  }
  return shuffle([...values]).map((value) => ({
    value,
    isCorrect: value === correctValue,
  }));
}

export function generateCountObjectsQuestion() {
  const promptCount = randomInt(1, 9);
  return {
    type: 'count_objects',
    promptCount,
    choices: buildChoices(promptCount, 0, 9),
  };
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npx vitest run tests/questionEngine.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/systems/QuestionEngine.js tests/questionEngine.test.js
git commit -m "feat: 9까지의 수 문제 생성 QuestionEngine 추가"
```

---

### Task 4: SaveManager (localStorage 저장) — TDD

**Files:**
- Create: `src/systems/SaveManager.js`
- Test: `tests/saveManager.test.js`

**Interfaces:**
- Consumes: 없음 (localStorage만 사용, jsdom 테스트 환경에서 제공됨 — Task 1에서 이미 `vitest.environment = 'jsdom'` 설정 완료)
- Produces: `getSave(): SaveData`, `saveStageResult({ unitId: string, accuracy: number, currencyEarned: number }): SaveData`. `SaveData = { currency: number, unlockedStages: string[], stageProgress: Record<string, { cleared: boolean, bestAccuracy: number, attempts: number }>, ownedCosmetics: string[], equippedCosmetics: Record<string, string> }`. Task 7의 `ResultScene`이 `saveStageResult`를 호출한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { getSave, saveStageResult } from '../src/systems/SaveManager.js';

describe('SaveManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a fresh save with the first stage unlocked when none exists', () => {
    const save = getSave();
    expect(save.currency).toBe(0);
    expect(save.unlockedStages).toEqual(['nums_within_9']);
    expect(save.stageProgress).toEqual({});
  });

  it('adds currency and records stage progress after a clear', () => {
    const save = saveStageResult({ unitId: 'nums_within_9', accuracy: 0.8, currencyEarned: 16 });
    expect(save.currency).toBe(16);
    expect(save.stageProgress.nums_within_9).toEqual({
      cleared: true,
      bestAccuracy: 0.8,
      attempts: 1,
    });
  });

  it('keeps the best accuracy and accumulates currency across repeated attempts', () => {
    saveStageResult({ unitId: 'nums_within_9', accuracy: 0.5, currencyEarned: 10 });
    const save = saveStageResult({ unitId: 'nums_within_9', accuracy: 0.9, currencyEarned: 18 });
    expect(save.stageProgress.nums_within_9.bestAccuracy).toBe(0.9);
    expect(save.stageProgress.nums_within_9.attempts).toBe(2);
    expect(save.currency).toBe(28);
  });

  it('persists across getSave calls (backed by localStorage)', () => {
    saveStageResult({ unitId: 'nums_within_9', accuracy: 1, currencyEarned: 20 });
    const reloaded = getSave();
    expect(reloaded.currency).toBe(20);
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npx vitest run tests/saveManager.test.js`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 최소 구현 작성**

```js
const SAVE_KEY = 'mathSurvivorSave';

function defaultSave() {
  return {
    currency: 0,
    unlockedStages: ['nums_within_9'],
    stageProgress: {},
    ownedCosmetics: [],
    equippedCosmetics: {},
  };
}

export function getSave() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    return defaultSave();
  }
  return JSON.parse(raw);
}

function writeSave(save) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function saveStageResult({ unitId, accuracy, currencyEarned }) {
  const save = getSave();
  save.currency += currencyEarned;
  const existing = save.stageProgress[unitId] ?? { cleared: false, bestAccuracy: 0, attempts: 0 };
  save.stageProgress[unitId] = {
    cleared: true,
    bestAccuracy: Math.max(existing.bestAccuracy, accuracy),
    attempts: existing.attempts + 1,
  };
  writeSave(save);
  return save;
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npx vitest run tests/saveManager.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/systems/SaveManager.js tests/saveManager.test.js
git commit -m "feat: localStorage 기반 SaveManager 추가"
```

---

### Task 5: StageScene (이동 · 자동공격 · 레벨업 트리거)

**Files:**
- Create: `src/scenes/StageScene.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `generateCountObjectsQuestion()` (Task 3, `src/systems/QuestionEngine.js`), 텍스처 키 `player`/`enemy` (Task 2)
- Produces: `this.events.emit('question-answered', { isCorrect: boolean })` 를 리스닝하는 `onQuestionAnswered` 핸들러(Task 6에서 `QuestionScene`이 이 이벤트를 발생시킴). `this.scene.launch('Question', { question })` 호출로 Task 6 씬을 연다. 스테이지 종료 시 `this.scene.start('Result', { unitId, accuracy, totalQuestions })` 호출(Task 7이 소비).

- [ ] **Step 1: StageScene 작성**

```js
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
  }

  update(time, delta) {
    if (this.isPaused) return;

    this.remainingMs -= delta;
    if (this.remainingMs <= 0) {
      this.finishStage();
      return;
    }

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
      nearestEnemy.destroy();
      this.gainXp(1);
    }
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
    const accuracy = this.totalQuestions === 0 ? 1 : this.correctAnswers / this.totalQuestions;
    this.scene.start('Result', {
      unitId: this.unitId,
      accuracy,
      totalQuestions: this.totalQuestions,
    });
  }
}
```

- [ ] **Step 2: main.js에 StageScene 등록**

`src/main.js`의 import와 `scene` 배열을 수정한다.

```js
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { StageScene } from './scenes/StageScene.js';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'app',
  backgroundColor: '#2b2b40',
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [BootScene, StageScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
```

- [ ] **Step 3: 수동 확인**

Run: `npm run dev`
브라우저에서 확인:
- WASD와 방향키 둘 다로 원(플레이어)이 움직이는지
- 화면 가장자리에서 빨간 원(적)이 계속 생성되어 플레이어 쪽으로 다가오는지
- 플레이어가 적과 가까워지면 주기적으로 적이 사라지는지(자동공격)
- 적을 5마리 정도 처치하면 게임이 멈추는지 (Question 씬이 아직 없어 "scene not found" 경고가 콘솔에 뜨는 것은 Task 6 전까지 정상)

- [ ] **Step 4: 커밋**

```bash
git add src/main.js src/scenes/StageScene.js
git commit -m "feat: 이동/자동공격/레벨업 트리거를 포함한 StageScene 추가"
```

---

### Task 6: QuestionScene (문제 팝업 UI)

**Files:**
- Create: `src/scenes/QuestionScene.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `init(data)`로 전달되는 `{ question: { promptCount, choices: [{ value, isCorrect }] } }` (Task 5가 `this.scene.launch('Question', { question })`으로 전달)
- Produces: 보기를 클릭하면 `this.scene.get('Stage').events.emit('question-answered', { isCorrect })`를 호출한다 (Task 5의 `onQuestionAnswered`가 소비).

- [ ] **Step 1: QuestionScene 작성**

```js
import Phaser from 'phaser';

export class QuestionScene extends Phaser.Scene {
  constructor() {
    super('Question');
  }

  init(data) {
    this.question = data.question;
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
    this.question.choices.forEach((choice, index) => {
      const x = startX + index * 120;
      const button = this.add
        .rectangle(x, height / 2 + 40, 90, 70, 0x2b2b40)
        .setStrokeStyle(2, 0xffffff)
        .setInteractive({ useHandCursor: true });

      this.add
        .text(x, height / 2 + 40, String(choice.value), { fontSize: '28px' })
        .setOrigin(0.5);

      button.on('pointerdown', () => {
        this.scene.get('Stage').events.emit('question-answered', {
          isCorrect: choice.isCorrect,
        });
      });
    });
  }
}
```

- [ ] **Step 2: main.js에 QuestionScene 등록**

```js
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { StageScene } from './scenes/StageScene.js';
import { QuestionScene } from './scenes/QuestionScene.js';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'app',
  backgroundColor: '#2b2b40',
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [BootScene, StageScene, QuestionScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
```

- [ ] **Step 3: 수동 확인**

Run: `npm run dev`
적을 5마리 처치해 레벨업을 발생시키고:
- 화면이 멈추고 사과 이모지 개수 + 보기 3개(숫자 버튼)가 뜨는지
- 아무 보기나 클릭하면 팝업이 사라지고 게임이 다시 진행되는지
- 정답을 고르면 그 다음부터 공격이 더 잦아지는지(체감 난이도 하락) 확인

- [ ] **Step 4: 커밋**

```bash
git add src/main.js src/scenes/QuestionScene.js
git commit -m "feat: 문제 팝업 QuestionScene 추가 및 정답/오답 업그레이드 연동"
```

---

### Task 7: ResultScene (클리어 결과 · 저장 · 재도전)

**Files:**
- Create: `src/scenes/ResultScene.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `init(data)`로 전달되는 `{ unitId, accuracy, totalQuestions }` (Task 5의 `finishStage`가 전달), `saveStageResult` (Task 4, `src/systems/SaveManager.js`)
- Produces: "다시 하기" 클릭 시 `this.scene.start('Stage', { unitId })` 호출(Task 5 재사용).

- [ ] **Step 1: ResultScene 작성**

```js
import Phaser from 'phaser';
import { saveStageResult } from '../systems/SaveManager.js';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  init(data) {
    this.resultData = data;
  }

  create() {
    const { width, height } = this.scale;
    const accuracyPercent = Math.round(this.resultData.accuracy * 100);
    const currencyEarned = Math.round(this.resultData.accuracy * 20);

    saveStageResult({
      unitId: this.resultData.unitId,
      accuracy: this.resultData.accuracy,
      currencyEarned,
    });

    this.add
      .text(width / 2, height / 2 - 60, '스테이지 클리어!', { fontSize: '32px', color: '#f6e05e' })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2, `정답률 ${accuracyPercent}%`, { fontSize: '24px', color: '#ffffff' })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 40, `별조각 +${currencyEarned}`, { fontSize: '24px', color: '#ffffff' })
      .setOrigin(0.5);

    const restartButton = this.add
      .text(width / 2, height / 2 + 100, '다시 하기', { fontSize: '20px', color: '#4fd1c5' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    restartButton.on('pointerdown', () => {
      this.scene.start('Stage', { unitId: this.resultData.unitId });
    });
  }
}
```

- [ ] **Step 2: main.js에 ResultScene 등록**

```js
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { StageScene } from './scenes/StageScene.js';
import { QuestionScene } from './scenes/QuestionScene.js';
import { ResultScene } from './scenes/ResultScene.js';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'app',
  backgroundColor: '#2b2b40',
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [BootScene, StageScene, QuestionScene, ResultScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
```

- [ ] **Step 3: 수동 확인 (전체 루프 E2E)**

Run: `npm run dev`
브라우저 개발자 도구를 열어두고:
1. 60초(`STAGE_DURATION_MS`) 동안 플레이하며 문제 팝업에 정답/오답을 섞어서 답한다.
2. 타이머가 끝나면 결과 화면에 정답률과 별조각 획득량이 표시되는지 확인.
3. 개발자 도구 Application 탭에서 `localStorage`의 `mathSurvivorSave` 값이 갱신됐는지 확인 (`currency`, `stageProgress.nums_within_9`).
4. "다시 하기"를 눌러 스테이지가 재시작되는지 확인.
5. 페이지를 새로고침한 뒤 다시 클리어했을 때 `currency`가 이전 값에 누적되는지 확인 (저장이 세션 간에도 유지되는지).

- [ ] **Step 4: 전체 자동 테스트 재확인**

Run: `npm test`
Expected: `questionEngine.test.js`, `saveManager.test.js` 모두 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/main.js src/scenes/ResultScene.js
git commit -m "feat: 결과 화면과 저장/재도전 흐름을 연결해 핵심 루프 완성"
```

---

## 이 플랜 이후 (범위 밖, 다음 플랜에서 다룸)

- 허브("나의 작은 방") 씬과 단원 지도(스테이지 선택 UI)
- 재화로 구매하는 꾸미기(코스메틱) 상점
- 나머지 10개 단원의 문제 템플릿 (`02-단원별-문제설계.md` 2~11번 단원)
- Kenney 등 실제 픽셀 아트 에셋으로 placeholder 텍스처 교체
- 스테이지 순차 잠금 해제 로직 (`unlockedStages` 갱신)
