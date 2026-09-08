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
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : defaultSave();
  } catch {
    return defaultSave();
  }
}

function writeSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // 저장에 실패해도 게임 진행에는 지장이 없도록 조용히 무시한다
  }
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
