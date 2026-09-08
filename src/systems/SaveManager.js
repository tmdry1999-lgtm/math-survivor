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
