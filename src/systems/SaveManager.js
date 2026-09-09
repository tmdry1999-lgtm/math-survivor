import { getNextUnitId } from '../data/units.js';

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
  const nextUnitId = getNextUnitId(unitId);
  if (nextUnitId && !save.unlockedStages.includes(nextUnitId)) {
    save.unlockedStages.push(nextUnitId);
  }
  writeSave(save);
  return save;
}

// 이미 보유했거나 재화가 부족하면 아무 변화 없이 현재 저장 데이터를 그대로 반환한다.
export function purchaseCosmetic(cosmeticId, cost) {
  const save = getSave();
  if (save.ownedCosmetics.includes(cosmeticId)) {
    return save;
  }
  if (save.currency < cost) {
    return save;
  }
  save.currency -= cost;
  save.ownedCosmetics.push(cosmeticId);
  save.equippedCosmetics.playerColor = cosmeticId;
  writeSave(save);
  return save;
}

// 보유하지 않은 코스메틱은 착용할 수 없다.
export function equipCosmetic(cosmeticId) {
  const save = getSave();
  if (!save.ownedCosmetics.includes(cosmeticId)) {
    return save;
  }
  save.equippedCosmetics.playerColor = cosmeticId;
  writeSave(save);
  return save;
}
